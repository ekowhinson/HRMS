"""
Management command to create overtime and bonus tax pay components.

Creates:
- OT_WEEKDAY  (1.5x hourly rate)
- OT_WEEKEND  (2.0x hourly rate)
- OT_HOLIDAY  (2.5x hourly rate)
- OVERTIME_TAX (statutory deduction)
- BONUS_TAX   (statutory deduction)
"""
from django.core.management.base import BaseCommand

from payroll.models import PayComponent


OVERTIME_COMPONENTS = [
    {
        'code': 'OT_WEEKDAY',
        'name': 'Weekday Overtime',
        'defaults': {
            'component_type': 'EARNING',
            'calculation_type': 'FORMULA',
            'category': 'OVERTIME',
            'formula': 'basic / 176 * 1.5',
            'is_overtime': True,
            'is_taxable': False,
            'is_recurring': False,
            'is_prorated': False,
            'is_part_of_gross': True,
            'affects_ssnit': False,
            'is_statutory': False,
            'display_order': 20,
            'show_on_payslip': True,
        },
    },
    {
        'code': 'OT_WEEKEND',
        'name': 'Weekend Overtime',
        'defaults': {
            'component_type': 'EARNING',
            'calculation_type': 'FORMULA',
            'category': 'OVERTIME',
            'formula': 'basic / 176 * 2.0',
            'is_overtime': True,
            'is_taxable': False,
            'is_recurring': False,
            'is_prorated': False,
            'is_part_of_gross': True,
            'affects_ssnit': False,
            'is_statutory': False,
            'display_order': 21,
            'show_on_payslip': True,
        },
    },
    {
        'code': 'OT_HOLIDAY',
        'name': 'Holiday Overtime',
        'defaults': {
            'component_type': 'EARNING',
            'calculation_type': 'FORMULA',
            'category': 'OVERTIME',
            'formula': 'basic / 176 * 2.5',
            'is_overtime': True,
            'is_taxable': False,
            'is_recurring': False,
            'is_prorated': False,
            'is_part_of_gross': True,
            'affects_ssnit': False,
            'is_statutory': False,
            'display_order': 22,
            'show_on_payslip': True,
        },
    },
    {
        'code': 'OVERTIME_TAX',
        'name': 'Overtime Tax',
        'defaults': {
            'component_type': 'DEDUCTION',
            'calculation_type': 'FIXED',
            'category': 'STATUTORY',
            'is_taxable': False,
            'is_statutory': True,
            'is_recurring': False,
            'is_prorated': False,
            'display_order': 23,
            'show_on_payslip': True,
        },
    },
    {
        'code': 'BONUS_TAX',
        'name': 'Bonus Tax',
        'defaults': {
            'component_type': 'DEDUCTION',
            'calculation_type': 'FIXED',
            'category': 'STATUTORY',
            'is_taxable': False,
            'is_statutory': True,
            'is_recurring': False,
            'is_prorated': False,
            'display_order': 24,
            'show_on_payslip': True,
        },
    },
]


class Command(BaseCommand):
    help = 'Create overtime pay components and overtime/bonus tax deduction components'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without saving',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        created_count = 0
        existing_count = 0

        for comp in OVERTIME_COMPONENTS:
            code = comp['code']
            name = comp['name']
            defaults = {**comp['defaults'], 'name': name, 'is_active': True}

            existing = PayComponent.objects.filter(code=code).first()
            if existing:
                self.stdout.write(f'  EXISTS: {code} - {existing.name}')
                existing_count += 1
                continue

            if not dry_run:
                PayComponent.objects.create(code=code, **defaults)
                self.stdout.write(self.style.SUCCESS(f'  CREATED: {code} - {name}'))
            else:
                self.stdout.write(f'  WOULD CREATE: {code} - {name}')
            created_count += 1

        if dry_run:
            self.stdout.write(self.style.WARNING('\n=== DRY RUN - No changes saved ==='))

        self.stdout.write('\n=== Summary ===')
        if dry_run:
            self.stdout.write(f'  Would create: {created_count}')
        else:
            self.stdout.write(self.style.SUCCESS(f'  Created: {created_count}'))
        self.stdout.write(f'  Already existed: {existing_count}')
