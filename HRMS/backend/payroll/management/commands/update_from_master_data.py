"""
Management command to update employee master data from Excel files.
Updates: SSNIT, gender, date of birth, hire date, region, district, division, directorate, department.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
import pandas as pd

from employees.models import Employee
from organization.models import Department, WorkLocation
from core.models import Region, District


class Command(BaseCommand):
    help = 'Update employee master data from Excel files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without saving'
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

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        files = [
            '/home/ekowhinson/projects/expene-tracker-ai/district_staff_data.xlsx',
            '/home/ekowhinson/projects/expene-tracker-ai/managers_data.xlsx',
            '/home/ekowhinson/projects/expene-tracker-ai/non_managers_headoffice_regionaloffice.xlsx',
        ]

        # Cache lookups
        regions = {}
        districts = {}
        departments = {}
        locations = {}

        # Statistics
        total_processed = 0
        total_updated = 0
        not_found = 0
        field_updates = {
            'ssnit_number': 0,
            'gender': 0,
            'date_of_birth': 0,
            'date_of_joining': 0,
            'department': 0,
            'work_location': 0,
            'first_name': 0,
            'middle_name': 0,
            'last_name': 0,
        }

        with transaction.atomic():
            for file_path in files:
                self.stdout.write(f'\n=== Processing {file_path.split("/")[-1]} ===')

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

                    total_processed += 1

                    # Find employee
                    try:
                        employee = Employee.objects.get(employee_number=emp_number, is_deleted=False)
                    except Employee.DoesNotExist:
                        not_found += 1
                        continue

                    updated_fields = []

                    # Update SSNIT if missing
                    ssnit = self.clean_value(row.get('SSNIT'))
                    if ssnit and not employee.ssnit_number:
                        # Check for duplicates
                        if not Employee.objects.filter(ssnit_number=ssnit, is_deleted=False).exclude(id=employee.id).exists():
                            if not dry_run:
                                employee.ssnit_number = ssnit
                            updated_fields.append('ssnit_number')
                            field_updates['ssnit_number'] += 1

                    # Update gender if placeholder
                    sex = self.clean_value(row.get('SEX'))
                    if sex and employee.gender == 'M':  # M was the placeholder
                        gender = 'M' if sex.upper() in ['M', 'MALE'] else 'F' if sex.upper() in ['F', 'FEMALE'] else None
                        if gender and gender != employee.gender:
                            if not dry_run:
                                employee.gender = gender
                            updated_fields.append('gender')
                            field_updates['gender'] += 1

                    # Update date of birth if placeholder (1980)
                    dob = self.parse_date(row.get('DATE_OF_BIRTH'))
                    if dob and employee.date_of_birth and employee.date_of_birth.year == 1980:
                        if not dry_run:
                            employee.date_of_birth = dob
                        updated_fields.append('date_of_birth')
                        field_updates['date_of_birth'] += 1

                    # Update hire date
                    hire_date = self.parse_date(row.get('ORIGINAL_DATE_OF_HIRE'))
                    if hire_date and employee.date_of_joining != hire_date:
                        if not dry_run:
                            employee.date_of_joining = hire_date
                        updated_fields.append('date_of_joining')
                        field_updates['date_of_joining'] += 1

                    # Update names if they were placeholders
                    first_name = self.clean_value(row.get('FIRST_NAME'))
                    if first_name:
                        first_name = first_name.title()
                        if employee.first_name != first_name:
                            if not dry_run:
                                employee.first_name = first_name
                            updated_fields.append('first_name')
                            field_updates['first_name'] += 1

                    middle_name = self.clean_value(row.get('MIDDLE_NAMES'))
                    if middle_name:
                        middle_name = middle_name.title()
                        if employee.middle_name != middle_name:
                            if not dry_run:
                                employee.middle_name = middle_name
                            updated_fields.append('middle_name')
                            field_updates['middle_name'] += 1

                    last_name = self.clean_value(row.get('LAST_NAME'))
                    if last_name:
                        last_name = last_name.title()
                        if employee.last_name != last_name:
                            if not dry_run:
                                employee.last_name = last_name
                            updated_fields.append('last_name')
                            field_updates['last_name'] += 1

                    # Update department
                    dept_name = self.clean_value(row.get('DEPARTMENT'))
                    if dept_name and not employee.department:
                        if dept_name not in departments:
                            dept = Department.objects.filter(name=dept_name).first()
                            if not dept:
                                base_code = dept_name[:15].upper().replace(' ', '_').replace('/', '_')
                                code = base_code
                                counter = 1
                                while Department.objects.filter(code=code).exists():
                                    code = f"{base_code[:12]}_{counter}"
                                    counter += 1
                                if not dry_run:
                                    dept = Department.objects.create(name=dept_name, code=code)
                            departments[dept_name] = dept
                        if departments.get(dept_name):
                            if not dry_run:
                                employee.department = departments[dept_name]
                            updated_fields.append('department')
                            field_updates['department'] += 1

                    # Update work location
                    location_name = self.clean_value(row.get('LOCATION'))
                    if location_name and not employee.work_location:
                        if location_name not in locations:
                            loc = WorkLocation.objects.filter(name=location_name).first()
                            if not loc:
                                base_code = location_name[:10].upper().replace(' ', '_').replace('/', '_')
                                code = base_code
                                counter = 1
                                while WorkLocation.objects.filter(code=code).exists():
                                    code = f"{base_code[:7]}_{counter}"
                                    counter += 1
                                if not dry_run:
                                    loc = WorkLocation.objects.create(name=location_name, code=code)
                            locations[location_name] = loc
                        if locations.get(location_name):
                            if not dry_run:
                                employee.work_location = locations[location_name]
                            updated_fields.append('work_location')
                            field_updates['work_location'] += 1

                    # Save if any updates
                    if updated_fields and not dry_run:
                        employee.save(update_fields=updated_fields)
                        total_updated += 1

                self.stdout.write(f'  Processed rows: {len(df)}')

            if dry_run:
                self.stdout.write(self.style.WARNING('\n=== DRY RUN - No changes saved ==='))
                transaction.set_rollback(True)

        self.stdout.write('\n=== Summary ===')
        self.stdout.write(f'  Total records processed: {total_processed}')
        self.stdout.write(f'  Employees updated: {total_updated}')
        self.stdout.write(f'  Employees not found: {not_found}')

        self.stdout.write('\n  Field updates:')
        for field, count in field_updates.items():
            if count > 0:
                self.stdout.write(f'    {field}: {count}')
