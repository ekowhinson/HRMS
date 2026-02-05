"""
Management command to create payroll calendar and periods for a year.

Usage:
    python manage.py create_payroll_periods 2025
    python manage.py create_payroll_periods 2025 2026 2027
    python manage.py create_payroll_periods --year 2025
"""

from django.core.management.base import BaseCommand, CommandError
from payroll.models import PayrollCalendar, PayrollPeriod


class Command(BaseCommand):
    help = 'Create payroll calendar and periods for specified year(s)'

    def add_arguments(self, parser):
        parser.add_argument(
            'years',
            nargs='*',
            type=int,
            help='Year(s) to create payroll periods for'
        )
        parser.add_argument(
            '--year',
            type=int,
            help='Single year to create payroll periods for'
        )
        parser.add_argument(
            '--calendar-only',
            action='store_true',
            help='Only create calendar entries, not payroll periods'
        )

    def handle(self, *args, **options):
        years = options['years']
        single_year = options.get('year')
        calendar_only = options.get('calendar_only', False)

        # Combine years from positional args and --year option
        if single_year:
            years = list(years) + [single_year]

        if not years:
            raise CommandError('Please specify at least one year. Example: python manage.py create_payroll_periods 2025')

        # Remove duplicates and sort
        years = sorted(set(years))

        for year in years:
            if year < 1900 or year > 2100:
                self.stderr.write(self.style.WARNING(f'Skipping invalid year: {year}'))
                continue

            self.stdout.write(f'\nProcessing year {year}...')

            # Create calendar entries
            calendars = PayrollCalendar.create_year_calendar(year)
            if calendars:
                self.stdout.write(self.style.SUCCESS(f'  Created {len(calendars)} calendar months'))
            else:
                existing = PayrollCalendar.objects.filter(year=year).count()
                self.stdout.write(f'  Calendar entries already exist ({existing} months)')

            # Create payroll periods (unless calendar-only)
            if not calendar_only:
                periods = PayrollPeriod.create_year_periods(year)
                if periods:
                    self.stdout.write(self.style.SUCCESS(f'  Created {len(periods)} payroll periods'))
                else:
                    existing = PayrollPeriod.objects.filter(year=year, is_supplementary=False).count()
                    self.stdout.write(f'  Payroll periods already exist ({existing} periods)')

        # Summary
        self.stdout.write('\n' + '=' * 50)
        self.stdout.write(self.style.SUCCESS('Summary:'))
        for year in years:
            cal_count = PayrollCalendar.objects.filter(year=year).count()
            period_count = PayrollPeriod.objects.filter(year=year, is_supplementary=False).count()
            self.stdout.write(f'  {year}: {cal_count} calendar months, {period_count} payroll periods')
