"""
Management command to create grade-based allowance transactions.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal

from organization.models import JobGrade
from payroll.models import PayComponent, EmployeeTransaction


class Command(BaseCommand):
    help = 'Create grade-based allowance transactions'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without saving'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing grade-based transactions first'
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        clear_existing = options['clear']

        # Define grade-to-allowance mappings
        # Format: {grade_code: [(component_code, amount_or_none), ...]}
        # If amount is None, it means use the percentage from the component

        # Directors (Level 7, 6A, 6B) - All director allowances
        director_grades = ['DIR', 'ADIR', 'ASDIR']  # Director, Associate Director, Assistant Director
        director_allowances = [
            ('UTILITY', None),           # 6% of basic
            ('VEHICLE_MAINT', None),     # 18% of basic
            ('SECURITY', None),          # 6% of basic
            ('ENTERTAIN', None),         # 6% of basic
            ('DOMESTIC', None),          # 6% of basic
            ('RESP_ALLOW', None),        # 18% of basic
            ('RENT_ALLOW', None),        # 24% of basic
            ('FUEL_ALLOW', Decimal('2802.40')),  # ~40 gallons @ 70.06/gallon
        ]

        # Managers (Level 5A, 5B, 5C, 5D)
        manager_grades = ['PM', 'SM', 'MGR', 'AM']  # Principal/Senior/Manager/Assistant Manager
        manager_allowances = [
            ('UTILITY', None),           # 6% of basic
            ('VEHICLE_ALLOW', None),     # 18% of basic
            ('FUEL_ALLOW', Decimal('2101.80')),  # 30 gallons @ 70.06/gallon
        ]

        # Senior Officers (Level 4A, 4B, 3A, 3B)
        senior_officer_grades = ['CAO', 'PAO', 'SAO', 'AO']
        senior_officer_allowances = [
            ('UTILITY', None),           # 6% of basic
            ('TRANSPORT', Decimal('450.00')),  # Fixed transport
        ]

        # Admin Assistants (Level 2A, 2B, 2C, 2D)
        admin_assistant_grades = ['CAA', 'PAA', 'SAA', 'AA']
        admin_assistant_allowances = [
            ('UTILITY', None),           # 6% of basic
            ('TRANSPORT', Decimal('300.00')),  # Fixed transport
        ]

        # Ancillary Staff (Level 1A, 1B, 1C, 1D)
        ancillary_grades = ['CAS', 'PAS', 'SAS', 'AS']
        ancillary_allowances = [
            ('UTILITY', None),           # 6% of basic
            ('TRANSPORT', Decimal('300.00')),  # Fixed transport
        ]

        # Combine all mappings
        grade_allowance_map = {}
        for grade_code in director_grades:
            grade_allowance_map[grade_code] = director_allowances
        for grade_code in manager_grades:
            grade_allowance_map[grade_code] = manager_allowances
        for grade_code in senior_officer_grades:
            grade_allowance_map[grade_code] = senior_officer_allowances
        for grade_code in admin_assistant_grades:
            grade_allowance_map[grade_code] = admin_assistant_allowances
        for grade_code in ancillary_grades:
            grade_allowance_map[grade_code] = ancillary_allowances

        # Cache components
        components = {pc.code: pc for pc in PayComponent.objects.filter(is_active=True)}

        with transaction.atomic():
            # Clear existing grade-based transactions if requested
            if clear_existing:
                deleted_count = EmployeeTransaction.objects.filter(
                    target_type='GRADE',
                    is_deleted=False
                ).update(is_deleted=True)
                self.stdout.write(f'Cleared {deleted_count} existing grade-based transactions')

            created = 0
            skipped = 0
            errors = []

            for grade_code, allowances in grade_allowance_map.items():
                # Find the JobGrade
                try:
                    job_grade = JobGrade.objects.get(code=grade_code, is_deleted=False)
                except JobGrade.DoesNotExist:
                    errors.append(f'JobGrade not found: {grade_code}')
                    continue

                self.stdout.write(f'\nProcessing {grade_code} - {job_grade.name}:')

                for component_code, fixed_amount in allowances:
                    component = components.get(component_code)
                    if not component:
                        errors.append(f'Component not found: {component_code}')
                        continue

                    # Check if transaction already exists
                    existing = EmployeeTransaction.objects.filter(
                        target_type='GRADE',
                        job_grade=job_grade,
                        pay_component=component,
                        is_deleted=False,
                        status__in=['PENDING', 'APPROVED']
                    ).first()

                    if existing:
                        self.stdout.write(f'  SKIP: {component_code} (already exists)')
                        skipped += 1
                        continue

                    # Determine amount
                    if fixed_amount is not None:
                        amount = fixed_amount
                        calc_type = 'FIXED'
                    elif component.calculation_type == 'PCT_BASIC' and component.percentage_value:
                        amount = component.percentage_value
                        calc_type = 'PERCENTAGE'
                    else:
                        amount = component.default_amount or Decimal('0')
                        calc_type = 'FIXED'

                    if not dry_run:
                        # Use override fields based on calculation type
                        trans_data = {
                            'target_type': 'GRADE',
                            'job_grade': job_grade,
                            'employee': None,
                            'pay_component': component,
                            'effective_from': '2025-01-01',
                            'is_recurring': True,
                            'status': 'APPROVED',
                            'description': f'{component.name} for {job_grade.name}'
                        }

                        if calc_type == 'PERCENTAGE':
                            trans_data['override_type'] = 'PCT'  # Correct enum value
                            trans_data['override_percentage'] = amount
                        else:
                            trans_data['override_type'] = 'FIXED'
                            trans_data['override_amount'] = amount

                        trans = EmployeeTransaction.objects.create(**trans_data)
                        self.stdout.write(self.style.SUCCESS(
                            f'  CREATED: {component_code} - {calc_type} {amount}'
                        ))
                    else:
                        self.stdout.write(f'  WOULD CREATE: {component_code} - {calc_type} {amount}')

                    created += 1

            if dry_run:
                self.stdout.write(self.style.WARNING('\n=== DRY RUN - No changes saved ==='))
                transaction.set_rollback(True)

        self.stdout.write('\n=== Summary ===')
        self.stdout.write(self.style.SUCCESS(f'  Created: {created}') if not dry_run else f'  Would create: {created}')
        self.stdout.write(f'  Skipped (existing): {skipped}')

        if errors:
            self.stdout.write(self.style.WARNING('\nErrors:'))
            for err in errors[:10]:
                self.stdout.write(f'  - {err}')
