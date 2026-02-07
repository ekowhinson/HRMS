"""
Management command to import missing employees from Excel master data files.
"""
import re
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
import pandas as pd

from employees.models import Employee
from organization.models import Department, WorkLocation, JobGrade, JobPosition
from payroll.models import SalaryLevel, SalaryNotch, EmployeeSalary


class Command(BaseCommand):
    help = 'Import missing employees from Excel master data files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without saving'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=0,
            help='Limit number of employees to import (0 for all)'
        )

    def clean_value(self, value):
        """Clean and validate a value."""
        if pd.isna(value) or str(value).strip() in ['', '0', '0.0', 'nan', 'None', 'NaT']:
            return None
        return str(value).strip()

    def parse_date(self, value):
        """Parse date value."""
        if pd.isna(value):
            return None
        try:
            return pd.to_datetime(value).date()
        except:
            return None

    def parse_grade(self, grade_str):
        """
        Parse grade string like 'Band 5. Level 5C' to extract level code.
        """
        if not grade_str or pd.isna(grade_str):
            return None

        match = re.match(r'Band\s*(\d+)\.\s*Level\s*(\w+)', str(grade_str), re.IGNORECASE)
        if match:
            return match.group(2).upper()
        return None

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        limit = options['limit']

        files = [
            '/home/ekowhinson/projects/expene-tracker-ai/district_staff_data.xlsx',
            '/home/ekowhinson/projects/expene-tracker-ai/managers_data.xlsx',
            '/home/ekowhinson/projects/expene-tracker-ai/non_managers_headoffice_regionaloffice.xlsx',
        ]

        # Get existing employee numbers
        existing_emp_nums = set(
            Employee.objects.filter(is_deleted=False).values_list('employee_number', flat=True)
        )
        self.stdout.write(f'Existing employees: {len(existing_emp_nums)}')

        # Cache lookups
        departments = {}
        locations = {}
        positions = {}
        grades = {}

        # Build grade lookup by salary_level
        for grade in JobGrade.objects.filter(is_deleted=False).select_related('salary_level'):
            if grade.salary_level:
                grades[grade.salary_level.code] = grade

        # Collect all missing employees from all files
        missing_employees = []

        for file_path in files:
            self.stdout.write(f'\nScanning {file_path.split("/")[-1]}...')

            try:
                df = pd.read_excel(file_path)
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Error reading file: {e}'))
                continue

            df.columns = [str(c).strip() for c in df.columns]

            for idx, row in df.iterrows():
                emp_number = row.get('EMPLOYEE_NUMBER')
                if pd.isna(emp_number):
                    continue

                try:
                    emp_number = str(int(float(emp_number)))
                except (ValueError, TypeError):
                    emp_number = str(emp_number).strip()

                # Skip if already exists
                if emp_number in existing_emp_nums:
                    continue

                # Skip if not active
                status = self.clean_value(row.get('USER_STATUS'))
                if status and 'active' not in status.lower():
                    continue

                missing_employees.append({
                    'emp_number': emp_number,
                    'row': row,
                    'source': file_path.split('/')[-1]
                })
                existing_emp_nums.add(emp_number)  # Prevent duplicates across files

            self.stdout.write(f'  Found {len([m for m in missing_employees if m["source"] == file_path.split("/")[-1]])} missing')

        self.stdout.write(f'\nTotal missing employees to import: {len(missing_employees)}')

        if limit > 0:
            missing_employees = missing_employees[:limit]
            self.stdout.write(f'Limited to: {len(missing_employees)}')

        # Import missing employees
        created = 0
        errors = []

        with transaction.atomic():
            for item in missing_employees:
                emp_number = item['emp_number']
                row = item['row']

                # Parse names
                first_name = self.clean_value(row.get('FIRST_NAME'))
                middle_name = self.clean_value(row.get('MIDDLE_NAMES'))
                last_name = self.clean_value(row.get('LAST_NAME'))

                # Fallback to STAFF_NAME if individual names missing
                if not first_name or not last_name:
                    staff_name = self.clean_value(row.get('STAFF_NAME'))
                    if staff_name:
                        parts = staff_name.split()
                        if len(parts) >= 2:
                            first_name = first_name or parts[0].title()
                            last_name = last_name or parts[-1].title()
                            if len(parts) > 2 and not middle_name:
                                middle_name = ' '.join(parts[1:-1]).title()
                        elif len(parts) == 1:
                            first_name = first_name or parts[0].title()
                            last_name = last_name or 'Unknown'

                if not first_name:
                    first_name = 'Unknown'
                if not last_name:
                    last_name = 'Unknown'

                first_name = first_name.title()
                last_name = last_name.title()
                if middle_name:
                    middle_name = middle_name.title()

                # Parse other fields
                ssnit = self.clean_value(row.get('SSNIT'))
                sex = self.clean_value(row.get('SEX'))
                gender = 'M' if sex and sex.upper() in ['M', 'MALE'] else 'F' if sex and sex.upper() in ['F', 'FEMALE'] else 'M'

                dob = self.parse_date(row.get('DATE_OF_BIRTH'))
                if not dob:
                    dob = timezone.now().date().replace(year=1980)

                hire_date = self.parse_date(row.get('ORIGINAL_DATE_OF_HIRE'))
                if not hire_date:
                    hire_date = timezone.now().date()

                job_title = self.clean_value(row.get('JOB_NAME')) or 'Staff'

                # Parse grade
                grade_str = self.clean_value(row.get('GRADE'))
                level_code = self.parse_grade(grade_str)
                job_grade = grades.get(level_code) if level_code else None

                # Get salary notch (default to Notch 1 if grade exists)
                salary_notch = None
                if level_code:
                    try:
                        salary_notch = SalaryNotch.objects.get(level__code=level_code, name='Notch 1')
                    except SalaryNotch.DoesNotExist:
                        pass

                # Get or create department
                dept_name = self.clean_value(row.get('DEPARTMENT'))
                department = None
                if dept_name:
                    if dept_name not in departments:
                        dept = Department.objects.filter(name=dept_name).first()
                        if not dept and not dry_run:
                            base_code = dept_name[:15].upper().replace(' ', '_').replace('/', '_')
                            code = base_code
                            counter = 1
                            while Department.objects.filter(code=code).exists():
                                code = f"{base_code[:12]}_{counter}"
                                counter += 1
                            dept = Department.objects.create(name=dept_name, code=code)
                        departments[dept_name] = dept
                    department = departments.get(dept_name)

                # Default department if none
                if not department:
                    if 'DEFAULT' not in departments:
                        dept = Department.objects.filter(code='DEFAULT').first()
                        if not dept and not dry_run:
                            dept = Department.objects.create(name='Default Department', code='DEFAULT')
                        departments['DEFAULT'] = dept
                    department = departments.get('DEFAULT')

                # Get or create location
                location_name = self.clean_value(row.get('LOCATION'))
                location = None
                if location_name:
                    if location_name not in locations:
                        loc = WorkLocation.objects.filter(name=location_name).first()
                        if not loc and not dry_run:
                            base_code = location_name[:10].upper().replace(' ', '_').replace('/', '_')
                            code = base_code
                            counter = 1
                            while WorkLocation.objects.filter(code=code).exists():
                                code = f"{base_code[:7]}_{counter}"
                                counter += 1
                            loc = WorkLocation.objects.create(name=location_name, code=code)
                        locations[location_name] = loc
                    location = locations.get(location_name)

                # Get or create position
                if job_title not in positions:
                    pos = JobPosition.objects.filter(title=job_title).first()
                    if not pos and not dry_run:
                        base_code = job_title[:15].upper().replace(' ', '_').replace('/', '_')
                        code = base_code
                        counter = 1
                        while JobPosition.objects.filter(code=code).exists():
                            code = f"{base_code[:12]}_{counter}"
                            counter += 1
                        pos = JobPosition.objects.create(title=job_title, code=code, description=job_title)
                    positions[job_title] = pos
                position = positions.get(job_title)

                # Create employee
                if not dry_run:
                    try:
                        # Check SSNIT uniqueness
                        if ssnit and Employee.objects.filter(ssnit_number=ssnit, is_deleted=False).exists():
                            ssnit = None

                        employee = Employee.objects.create(
                            employee_number=emp_number,
                            first_name=first_name,
                            middle_name=middle_name or '',
                            last_name=last_name,
                            ssnit_number=ssnit,
                            gender=gender,
                            date_of_birth=dob,
                            date_of_joining=hire_date,
                            grade=job_grade,
                            salary_notch=salary_notch,
                            department=department,
                            position=position,
                            work_location=location,
                            employment_type='PERMANENT',
                            status='ACTIVE',
                            mobile_phone='N/A',
                            residential_address='N/A',
                            residential_city='Accra',
                        )

                        # Create EmployeeSalary if notch exists
                        if salary_notch and salary_notch.amount:
                            EmployeeSalary.objects.create(
                                employee=employee,
                                effective_from=hire_date,
                                basic_salary=salary_notch.amount,
                                is_current=True
                            )

                    except Exception as e:
                        if len(errors) < 20:
                            errors.append(f'{emp_number}: {str(e)[:50]}')
                        continue

                created += 1

            if dry_run:
                self.stdout.write(self.style.WARNING('\n=== DRY RUN - No changes saved ==='))
                transaction.set_rollback(True)

        self.stdout.write('\n=== Summary ===')
        self.stdout.write(self.style.SUCCESS(f'  Employees created: {created}') if not dry_run else f'  Would create: {created}')

        if errors:
            self.stdout.write(self.style.WARNING(f'\nErrors ({len(errors)}):'))
            for err in errors[:10]:
                self.stdout.write(f'  - {err}')
