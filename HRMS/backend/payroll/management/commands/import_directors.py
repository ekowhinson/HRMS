"""
Management command to import directors from Excel file.
"""
import re
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
import pandas as pd

from employees.models import Employee, BankAccount
from organization.models import Department, WorkLocation, JobGrade, JobPosition
from payroll.models import Bank, SalaryLevel, SalaryNotch, EmployeeSalary


class Command(BaseCommand):
    help = 'Import directors from Excel file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            default='/home/ekowhinson/projects/expene-tracker-ai/payroll_data_directors_deputy_directors.xlsx',
            help='Path to the Excel file'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without saving'
        )

    def parse_notch(self, notch_str):
        """
        Parse NOTCH_NEW field like "Band 6/Level 6B/Notch 10" or "Band 7/Level 7/Notch 6".
        Returns (level_code, notch_number) or (None, None) if invalid.
        """
        if not notch_str or pd.isna(notch_str):
            return None, None

        # Match pattern: Band X/Level XY/Notch Z
        match = re.match(r'Band\s*(\d+)/Level\s*(\w+)/Notch\s*(\d+)', str(notch_str), re.IGNORECASE)
        if match:
            level_code = match.group(2).upper()
            notch_num = int(match.group(3))
            return level_code, notch_num

        return None, None

    def parse_name(self, name_str):
        """Parse name like 'SURNAME, FIRST MIDDLE' into first_name, last_name."""
        if not name_str or pd.isna(name_str):
            return None, None

        name_str = str(name_str).strip()

        if ',' in name_str:
            parts = name_str.split(',', 1)
            last_name = parts[0].strip().title()
            first_name = parts[1].strip().title() if len(parts) > 1 else ''
        else:
            parts = name_str.split()
            if len(parts) >= 2:
                first_name = parts[0].title()
                last_name = ' '.join(parts[1:]).title()
            else:
                first_name = name_str.title()
                last_name = ''

        return first_name, last_name

    def clean_value(self, value):
        """Clean and validate a value."""
        if pd.isna(value) or str(value).strip() in ['', '0', '0.0', 'nan', 'None']:
            return None
        return str(value).strip()

    def handle(self, *args, **options):
        file_path = options['file']
        dry_run = options['dry_run']

        self.stdout.write(f'Reading Excel file: {file_path}')

        try:
            df = pd.read_excel(file_path)
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error reading file: {e}'))
            return

        df.columns = [str(c).strip() for c in df.columns]
        self.stdout.write(f'Columns: {list(df.columns)}')
        self.stdout.write(f'Total rows: {len(df)}')

        # Cache lookups
        banks = {}
        locations = {}
        departments = {}
        levels = {l.code: l for l in SalaryLevel.objects.all()}
        grades = {}

        # Build grade lookup by salary_level
        for grade in JobGrade.objects.filter(is_deleted=False).select_related('salary_level'):
            if grade.salary_level:
                grades[grade.salary_level.code] = grade

        created = 0
        skipped = 0
        errors = []

        with transaction.atomic():
            for idx, row in df.iterrows():
                emp_number = row.get('EMPLOYEE_NUMBER')
                if pd.isna(emp_number):
                    continue

                try:
                    emp_number = str(int(float(emp_number)))
                except (ValueError, TypeError):
                    emp_number = str(emp_number).strip()

                # Check if employee already exists
                if Employee.objects.filter(employee_number=emp_number, is_deleted=False).exists():
                    skipped += 1
                    continue

                # Parse name
                name = row.get('NAME')
                first_name, last_name = self.parse_name(name)
                if not first_name:
                    errors.append(f'Row {idx}: Invalid name: {name}')
                    continue

                # Parse notch
                notch_str = row.get('NOTCH_NEW')
                level_code, notch_num = self.parse_notch(notch_str)

                # Find grade and notch
                job_grade = grades.get(level_code) if level_code else None
                salary_notch = None

                if level_code and notch_num:
                    try:
                        salary_notch = SalaryNotch.objects.get(
                            level__code=level_code,
                            name=f'Notch {notch_num}'
                        )
                    except SalaryNotch.DoesNotExist:
                        if len(errors) < 20:
                            errors.append(f'Row {idx}: Notch not found: {level_code} Notch {notch_num}')

                # Get or create location
                location_name = self.clean_value(row.get('LOCATION'))
                location = None
                if location_name:
                    if location_name not in locations:
                        # Try to find existing location by name first
                        loc = WorkLocation.objects.filter(name=location_name).first()
                        if not loc:
                            # Generate unique code
                            base_code = location_name[:10].upper().replace(' ', '_').replace('/', '_')
                            code = base_code
                            counter = 1
                            while WorkLocation.objects.filter(code=code).exists():
                                code = f"{base_code[:7]}_{counter}"
                                counter += 1
                            loc = WorkLocation.objects.create(name=location_name, code=code)
                        locations[location_name] = loc
                    location = locations[location_name]

                # Get or create department
                dept_name = self.clean_value(row.get('DIRECTORATE/DEPARTMENT'))
                department = None
                if dept_name:
                    if dept_name not in departments:
                        # Try to find existing department by name first
                        dept = Department.objects.filter(name=dept_name).first()
                        if not dept:
                            # Generate unique code
                            base_code = dept_name[:15].upper().replace(' ', '_').replace('/', '_')
                            code = base_code
                            counter = 1
                            while Department.objects.filter(code=code).exists():
                                code = f"{base_code[:12]}_{counter}"
                                counter += 1
                            dept = Department.objects.create(name=dept_name, code=code)
                        departments[dept_name] = dept
                    department = departments[dept_name]

                # Get other fields
                ssnit = self.clean_value(row.get('SSNIT NO'))
                job_title = self.clean_value(row.get('JOB_NAME')) or 'Director'
                staff_category = self.clean_value(row.get('STAFF_CATEGORY'))
                effective_date = row.get('EFFECTIVE_DATE')

                # Ensure department exists (required field)
                if not department:
                    # Use a default department
                    department, _ = Department.objects.get_or_create(
                        code='DIRECTORATE',
                        defaults={'name': 'Directorate'}
                    )

                # Get or create position
                position_name = job_title
                position = None
                if position_name:
                    position = JobPosition.objects.filter(title=position_name).first()
                    if not position:
                        # Generate unique code
                        base_code = position_name[:15].upper().replace(' ', '_').replace('/', '_')
                        code = base_code
                        counter = 1
                        while JobPosition.objects.filter(code=code).exists():
                            code = f"{base_code[:12]}_{counter}"
                            counter += 1
                        position = JobPosition.objects.create(
                            title=position_name,
                            code=code,
                            description=position_name
                        )

                # Parse effective date
                try:
                    joining_date = pd.to_datetime(effective_date).date() if pd.notna(effective_date) else timezone.now().date()
                except:
                    joining_date = timezone.now().date()

                # Create employee
                if not dry_run:
                    employee = Employee.objects.create(
                        employee_number=emp_number,
                        first_name=first_name,
                        last_name=last_name,
                        ssnit_number=ssnit,
                        grade=job_grade,
                        salary_notch=salary_notch,
                        department=department,
                        position=position,
                        work_location=location,
                        employment_type='PERMANENT',
                        status='ACTIVE',
                        date_of_joining=joining_date,
                        # Required fields with defaults
                        date_of_birth=timezone.now().date().replace(year=1980),  # Placeholder
                        gender='M',  # Default
                        mobile_phone='N/A',  # Placeholder
                        residential_address='N/A',  # Placeholder
                        residential_city='Accra',  # Default
                    )

                    # Create EmployeeSalary if notch exists
                    if salary_notch and salary_notch.amount:
                        EmployeeSalary.objects.create(
                            employee=employee,
                            effective_from=joining_date,
                            basic_salary=salary_notch.amount,
                            is_current=True
                        )

                    # Create bank account
                    bank_name = self.clean_value(row.get('BANK'))
                    account_number = self.clean_value(row.get('ACCOUNT NO'))

                    if bank_name and account_number:
                        # Clean account number
                        account_number = account_number.replace('.0', '')

                        if bank_name not in banks:
                            # Try to find existing bank by name first
                            bank = Bank.objects.filter(name=bank_name).first()
                            if not bank:
                                # Generate unique code
                                base_code = bank_name[:10].upper().replace(' ', '_').replace('/', '_')
                                code = base_code
                                counter = 1
                                while Bank.objects.filter(code=code).exists():
                                    code = f"{base_code[:7]}_{counter}"
                                    counter += 1
                                bank = Bank.objects.create(name=bank_name, code=code, is_active=True)
                            banks[bank_name] = bank
                        bank = banks[bank_name]

                        BankAccount.objects.create(
                            employee=employee,
                            bank=bank,
                            account_number=account_number,
                            account_name=f'{first_name} {last_name}',
                            is_primary=True,
                            is_active=True
                        )

                    self.stdout.write(f'  Created: {emp_number} - {first_name} {last_name} ({level_code or "No grade"})')

                created += 1

            if dry_run:
                self.stdout.write(self.style.WARNING('\n=== DRY RUN - No changes saved ==='))
                transaction.set_rollback(True)

        self.stdout.write('\n=== Summary ===')
        self.stdout.write(self.style.SUCCESS(f'  Created: {created}') if not dry_run else f'  Would create: {created}')
        self.stdout.write(f'  Skipped (already exists): {skipped}')

        if errors:
            self.stdout.write(self.style.WARNING(f'\nErrors ({len(errors)}):'))
            for err in errors[:15]:
                self.stdout.write(f'  - {err}')
