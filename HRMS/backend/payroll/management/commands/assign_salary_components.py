"""
Management command to assign salary components to employees based on their salary band.

Reads each employee's band (via employee.grade.salary_band) and creates
EmployeeSalaryComponent records using the NHIA band-to-allowance rules.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal

from employees.models import Employee
from payroll.models import (
    PayComponent,
    EmployeeSalary,
    EmployeeSalaryComponent,
    SalaryBand,
)


# ---------------------------------------------------------------------------
# Band-to-component rules
# Each entry: (component_code, calc_type, value)
#   calc_type='PCT'   -> amount = basic_salary * value / 100
#   calc_type='FIXED' -> amount = value
# ---------------------------------------------------------------------------

COMMON_DEDUCTIONS = [
    ('SSNIT_T1_EE', 'PCT', Decimal('5.5')),
    ('PF_EMP', 'PCT', Decimal('5')),
]

COMMON_EMPLOYER = [
    ('SSNIT_T1_ER', 'PCT', Decimal('13')),
    ('SSNIT_T2_ER', 'PCT', Decimal('5')),
]

BAND_EARNINGS = {
    # Band 1 – Support / Ancillary
    'BAND_1': [
        ('UTILITY', 'PCT', Decimal('6')),
        ('TRANSPORT', 'FIXED', Decimal('300')),
    ],
    # Band 2 – Junior Officer / Admin Assistant
    'BAND_2': [
        ('UTILITY', 'PCT', Decimal('6')),
        ('TRANSPORT', 'FIXED', Decimal('300')),
    ],
    # Band 3 – Officer
    'BAND_3': [
        ('UTILITY', 'PCT', Decimal('6')),
        ('TRANSPORT', 'FIXED', Decimal('300')),
    ],
    # Band 4 – Senior Officer
    'BAND_4': [
        ('UTILITY', 'PCT', Decimal('6')),
        ('TRANSPORT', 'FIXED', Decimal('450')),
    ],
    # Band 5 – Manager
    'BAND_5': [
        ('UTILITY', 'PCT', Decimal('6')),
        ('VEHICLE_MAINT', 'PCT', Decimal('18')),
        ('FUEL_ALLOW', 'FIXED', Decimal('2101.80')),
    ],
    # Band 6 – Director
    'BAND_6': [
        ('UTILITY', 'PCT', Decimal('6')),
        ('VEHICLE_MAINT', 'PCT', Decimal('18')),
        ('FUEL_ALLOW', 'FIXED', Decimal('2802.40')),
        ('SECURITY', 'PCT', Decimal('6')),
        ('ENTERTAIN', 'PCT', Decimal('6')),
        ('DOMESTIC', 'PCT', Decimal('6')),
        ('RESP_ALLOW', 'PCT', Decimal('18')),
        ('RENT_ALLOW', 'PCT', Decimal('24')),
    ],
    # Band 7 – Senior Director
    'BAND_7': [
        ('UTILITY', 'PCT', Decimal('6')),
        ('VEHICLE_MAINT', 'PCT', Decimal('18')),
        ('FUEL_ALLOW', 'FIXED', Decimal('3503.00')),
        ('SECURITY', 'PCT', Decimal('6')),
        ('ENTERTAIN', 'PCT', Decimal('6')),
        ('DOMESTIC', 'PCT', Decimal('6')),
        ('RESP_ALLOW', 'PCT', Decimal('18')),
        ('RENT_ALLOW', 'PCT', Decimal('24')),
    ],
}

# New-style band codes mapped to legacy equivalents
NEW_BAND_MAP = {
    'BAND-A': 'BAND_1',
    'BAND-B': 'BAND_2',
    'BAND-C': 'BAND_3',
    'BAND-D': 'BAND_4',
    'BAND-E': 'BAND_5',
    'BAND-F': 'BAND_6',
}


def _resolve_band_code(code):
    """Return the canonical band code for rule lookup."""
    if code in BAND_EARNINGS:
        return code
    return NEW_BAND_MAP.get(code)


class Command(BaseCommand):
    help = 'Assign salary components to employees based on salary band rules'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without writing to the database',
        )
        parser.add_argument(
            '--band',
            type=str,
            default=None,
            help='Process only employees in a specific band code (e.g. BAND_5 or BAND-E)',
        )
        parser.add_argument(
            '--overwrite',
            action='store_true',
            help='Replace existing components (default: skip employees who already have components)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        band_filter = options['band']
        overwrite = options['overwrite']

        # Pre-load PayComponents
        pc_map = {pc.code: pc for pc in PayComponent.objects.filter(is_active=True)}

        # Validate that every referenced component code exists
        all_codes = set()
        for rules in BAND_EARNINGS.values():
            all_codes.update(code for code, _, _ in rules)
        for code, _, _ in COMMON_DEDUCTIONS + COMMON_EMPLOYER:
            all_codes.add(code)

        missing = all_codes - set(pc_map.keys())
        if missing:
            self.stderr.write(self.style.ERROR(
                f'Missing PayComponent codes: {", ".join(sorted(missing))}'
            ))
            return

        # Build queryset: active employees with a current salary
        employees_qs = Employee.objects.filter(
            status='ACTIVE',
            is_deleted=False,
            salaries__is_current=True,
        ).select_related(
            'grade__salary_band',
        ).prefetch_related(
            'salaries',
        ).distinct().order_by('pk')

        if band_filter:
            resolved = _resolve_band_code(band_filter)
            if resolved:
                # Filter by band codes that map to this resolved code
                band_codes = [band_filter]
                # Also include the reverse mapping
                if band_filter in NEW_BAND_MAP:
                    band_codes.append(NEW_BAND_MAP[band_filter])
                elif band_filter in BAND_EARNINGS:
                    # Also include new-style alias
                    for new, legacy in NEW_BAND_MAP.items():
                        if legacy == band_filter:
                            band_codes.append(new)
                employees_qs = employees_qs.filter(
                    grade__salary_band__code__in=band_codes
                )
            else:
                employees_qs = employees_qs.filter(
                    grade__salary_band__code=band_filter
                )

        total = employees_qs.count()
        self.stdout.write(f'Found {total} active employees with current salary to process')

        if total == 0:
            self.stdout.write(self.style.WARNING('No employees to process.'))
            return

        # Stats
        stats = {
            'processed': 0,
            'skipped_has_components': 0,
            'skipped_no_grade': 0,
            'skipped_no_band': 0,
            'skipped_unmapped_band': 0,
            'components_created': 0,
            'components_deleted': 0,
            'band_counts': {},
        }

        with transaction.atomic():
            for idx, emp in enumerate(employees_qs.iterator(chunk_size=500), 1):
                # Get current salary
                emp_salary = emp.salaries.filter(is_current=True).first()
                if not emp_salary:
                    continue

                # Check existing components
                existing_count = EmployeeSalaryComponent.objects.filter(
                    employee_salary=emp_salary
                ).count()

                if existing_count > 0 and not overwrite:
                    stats['skipped_has_components'] += 1
                    continue

                # Resolve band
                if not emp.grade:
                    stats['skipped_no_grade'] += 1
                    continue

                band = emp.grade.salary_band
                if not band:
                    stats['skipped_no_band'] += 1
                    continue

                canonical = _resolve_band_code(band.code)
                if not canonical:
                    stats['skipped_unmapped_band'] += 1
                    if band.code not in stats:
                        self.stdout.write(self.style.WARNING(
                            f'  Unmapped band: {band.code} ({band.name})'
                        ))
                        stats[band.code] = True  # only warn once
                    continue

                earnings_rules = BAND_EARNINGS[canonical]
                all_rules = earnings_rules + COMMON_DEDUCTIONS + COMMON_EMPLOYER
                basic = emp_salary.basic_salary

                # Delete existing if overwrite
                if overwrite and existing_count > 0:
                    deleted, _ = EmployeeSalaryComponent.objects.filter(
                        employee_salary=emp_salary
                    ).delete()
                    stats['components_deleted'] += deleted

                # Create components
                components_to_create = []
                for comp_code, calc_type, value in all_rules:
                    pc = pc_map[comp_code]
                    if calc_type == 'PCT':
                        amount = (basic * value / Decimal('100')).quantize(Decimal('0.01'))
                    else:
                        amount = value

                    components_to_create.append(
                        EmployeeSalaryComponent(
                            employee_salary=emp_salary,
                            pay_component=pc,
                            amount=amount,
                            is_active=True,
                        )
                    )

                EmployeeSalaryComponent.objects.bulk_create(
                    components_to_create,
                    ignore_conflicts=True,
                )
                created_count = len(components_to_create)
                stats['components_created'] += created_count
                stats['processed'] += 1
                stats['band_counts'][canonical] = stats['band_counts'].get(canonical, 0) + 1

                # Progress
                if idx % 500 == 0 or idx == total:
                    self.stdout.write(f'  Progress: {idx}/{total} employees ...')

            if dry_run:
                self.stdout.write(self.style.WARNING('\n=== DRY RUN — rolling back all changes ==='))
                transaction.set_rollback(True)

        # Summary
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS('SUMMARY'))
        self.stdout.write('=' * 60)
        self.stdout.write(f'  Employees processed:           {stats["processed"]}')
        self.stdout.write(f'  Components created:            {stats["components_created"]}')
        if stats['components_deleted']:
            self.stdout.write(f'  Components deleted (overwrite): {stats["components_deleted"]}')
        self.stdout.write(f'  Skipped (already has comps):   {stats["skipped_has_components"]}')
        self.stdout.write(f'  Skipped (no grade):            {stats["skipped_no_grade"]}')
        self.stdout.write(f'  Skipped (no band on grade):    {stats["skipped_no_band"]}')
        self.stdout.write(f'  Skipped (unmapped band):       {stats["skipped_unmapped_band"]}')
        self.stdout.write('')
        self.stdout.write('  Components per band:')
        for band_code in sorted(stats['band_counts']):
            count = stats['band_counts'][band_code]
            rules_count = len(BAND_EARNINGS[band_code]) + len(COMMON_DEDUCTIONS) + len(COMMON_EMPLOYER)
            self.stdout.write(f'    {band_code:10s}  {count:5d} employees  x {rules_count} components = {count * rules_count}')
        self.stdout.write('=' * 60)
