"""
Management command to merge duplicate PayComponent (transaction type) entries.

Multiple seeding sources created duplicate entries for the same concept with
different codes. This command merges them into canonical entries and reassigns
all related records.

Usage:
    python manage.py cleanup_transaction_types --dry-run   # Preview changes
    python manage.py cleanup_transaction_types              # Execute cleanup
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from payroll.models import (
    PayComponent,
    EmployeeTransaction,
    PayrollItemDetail,
    AdHocPayment,
    SalaryStructureComponent,
    EmployeeSalaryComponent,
    BackpayDetail,
)


# Each merge group: (canonical_code, [duplicate_codes], {fixes for canonical})
MERGE_GROUPS = [
    {
        'canonical': 'SSF_EMP',
        'duplicates': ['SSNIT_EMP', 'SSNIT_T1_EE'],
        'fixes': {},
    },
    {
        'canonical': 'SSF_EMPR',
        'duplicates': ['SSNIT_ER', 'SSNIT_T1_ER'],
        'fixes': {'component_type': 'EMPLOYER'},
    },
    {
        'canonical': 'TRANSPORT',
        'duplicates': ['TRANSPORT_ALL'],
        'fixes': {'category': 'ALLOWANCE'},
    },
    {
        'canonical': 'HOUSING_ALL',
        'duplicates': ['HOUSING'],
        'fixes': {'percentage_value': 20},
    },
    {
        'canonical': 'RESP_ALLOW',
        'duplicates': ['RESP_ALL'],
        'fixes': {},
    },
    {
        'canonical': 'PROF_ALLOW',
        'duplicates': ['PROF_ALL'],
        'fixes': {},
    },
    {
        'canonical': 'OT_WEEKDAY',
        'duplicates': ['WEEKDAY OVT', 'OVERTIME'],
        'fixes': {'copy_formula_from': 'WEEKDAY OVT'},
    },
    {
        'canonical': 'VEHICLE_ALLOW',
        'duplicates': ['VEHICLE_MAINT'],
        'fixes': {},
    },
    {
        'canonical': 'SSNIT_T2_ER',
        'duplicates': ['TIER2_EMPR'],
        'fixes': {},
    },
]

# All models with a FK to PayComponent that need reassignment
FK_TABLES = [
    (EmployeeTransaction, 'employee_transactions'),
    (PayrollItemDetail, 'payroll_details'),
    (AdHocPayment, 'adhoc_payments'),
    (SalaryStructureComponent, 'structure_components'),
    (EmployeeSalaryComponent, 'employee_components'),
    (BackpayDetail, 'backpay_details'),
]


class Command(BaseCommand):
    help = 'Merge duplicate PayComponent entries and reassign all related records'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without making any modifications',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING('=== DRY RUN — no changes will be made ===\n'))
        else:
            self.stdout.write(self.style.WARNING('=== EXECUTING CLEANUP ===\n'))

        total_reassigned = 0
        total_removed = 0
        total_fixes = 0

        try:
            with transaction.atomic():
                for group in MERGE_GROUPS:
                    reassigned, removed, fixes = self._process_group(group, dry_run)
                    total_reassigned += reassigned
                    total_removed += removed
                    total_fixes += fixes

                if dry_run:
                    # Roll back all changes in dry-run mode
                    raise DryRunRollback()

        except DryRunRollback:
            pass

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Summary: {total_removed} duplicates removed, '
            f'{total_reassigned} records reassigned, '
            f'{total_fixes} data fixes applied'
        ))

        if dry_run:
            self.stdout.write(self.style.WARNING('(Dry run — nothing was changed)'))

    def _process_group(self, group, dry_run):
        canonical_code = group['canonical']
        duplicate_codes = group['duplicates']
        fixes = group['fixes']

        self.stdout.write(self.style.MIGRATE_HEADING(
            f'--- Group: {canonical_code} <- {", ".join(duplicate_codes)} ---'
        ))

        # Look up canonical component (use all_objects to bypass soft-delete filter)
        canonical = PayComponent.all_objects.filter(code=canonical_code).first()
        if not canonical:
            self.stdout.write(self.style.WARNING(
                f'  Canonical component {canonical_code} not found — skipping group'
            ))
            return 0, 0, 0

        total_reassigned = 0
        total_removed = 0
        total_fixes = 0

        # Process each duplicate
        for dup_code in duplicate_codes:
            duplicate = PayComponent.all_objects.filter(code=dup_code).first()
            if not duplicate:
                self.stdout.write(f'  Duplicate {dup_code} not found — skipping')
                continue

            if duplicate.is_deleted:
                self.stdout.write(f'  Duplicate {dup_code} already deleted — skipping')
                continue

            # Reassign FK references from duplicate to canonical
            for model_class, related_name in FK_TABLES:
                table_name = model_class.__name__
                count = model_class.all_objects.filter(pay_component=duplicate).count()

                if count > 0:
                    if not dry_run:
                        model_class.all_objects.filter(
                            pay_component=duplicate
                        ).update(pay_component=canonical)

                    self.stdout.write(self.style.SUCCESS(
                        f'  Reassigned {count} {table_name} records: '
                        f'{dup_code} -> {canonical_code}'
                    ))
                    total_reassigned += count

            # Soft-delete the duplicate
            if not dry_run:
                duplicate.is_active = False
                duplicate.is_deleted = True
                duplicate.save(update_fields=['is_active', 'is_deleted'])

            self.stdout.write(self.style.ERROR(f'  Removed duplicate: {dup_code}'))
            total_removed += 1

        # Apply data fixes to canonical
        if fixes:
            update_fields = []

            # Handle special case: copy formula from a duplicate
            copy_formula_from = fixes.pop('copy_formula_from', None)
            if copy_formula_from and not canonical.formula:
                source = PayComponent.all_objects.filter(code=copy_formula_from).first()
                if source and source.formula:
                    canonical.formula = source.formula
                    update_fields.append('formula')
                    self.stdout.write(f'  Fixed {canonical_code}: copied formula from {copy_formula_from}')
                    total_fixes += 1

            # Apply remaining field fixes
            for field, value in fixes.items():
                current_value = getattr(canonical, field)
                if current_value != value:
                    if not dry_run:
                        setattr(canonical, field, value)
                    update_fields.append(field)
                    self.stdout.write(f'  Fixed {canonical_code}: {field} = {value}')
                    total_fixes += 1

            if update_fields and not dry_run:
                canonical.save(update_fields=update_fields)

        return total_reassigned, total_removed, total_fixes


class DryRunRollback(Exception):
    """Raised to trigger transaction rollback in dry-run mode."""
    pass
