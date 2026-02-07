"""
Management command to assign salary grades and notches to employees from Excel data.
"""
import re
from django.core.management.base import BaseCommand
from django.db import transaction
import pandas as pd

from employees.models import Employee
from organization.models import JobGrade
from payroll.models import SalaryLevel, SalaryNotch


class Command(BaseCommand):
    help = 'Assign salary grades and notches to employees from Excel file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            default='/home/ekowhinson/projects/expene-tracker-ai/Staff Data for Payroll Implementation-23.12.25.xlsx',
            help='Path to the Excel file'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without saving'
        )

    def parse_grade(self, grade_str):
        """
        Parse grade string like "Band 6. Level 6B" to extract level code.
        Returns (band_number, level_code) or (None, None) if invalid.
        """
        if not grade_str or pd.isna(grade_str):
            return None, None

        # Match patterns like "Band 6. Level 6B" or "Band 5. Level 5C"
        match = re.match(r'Band\s*(\d+)\.\s*Level\s*(\w+)', str(grade_str), re.IGNORECASE)
        if match:
            band_num = match.group(1)
            level_code = match.group(2).upper()
            return band_num, level_code

        return None, None

    def get_notch(self, level_code, step):
        """Get the SalaryNotch for a given level and step number."""
        try:
            step_int = int(step)
            if step_int < 1 or step_int > 10:
                return None

            notch_name = f'Notch {step_int}'
            return SalaryNotch.objects.get(
                level__code=level_code,
                name=notch_name
            )
        except (ValueError, SalaryNotch.DoesNotExist):
            return None

    def get_job_grade(self, level_code):
        """Get the JobGrade for a given level code."""
        try:
            # First try to find JobGrade with matching salary_level
            level = SalaryLevel.objects.get(code=level_code)
            grade = JobGrade.objects.filter(salary_level=level).first()
            return grade
        except SalaryLevel.DoesNotExist:
            return None

    def find_header_row(self, xlsx, sheet_name):
        """Find the row index containing 'STAFF ID' header."""
        df_raw = pd.read_excel(xlsx, sheet_name=sheet_name, header=None, nrows=20)
        for i, row in df_raw.iterrows():
            row_vals = [str(v).upper().strip() for v in row.values if pd.notna(v)]
            if 'STAFF ID' in row_vals and 'GRADE' in row_vals:
                return i
        return None

    def read_sheet_data(self, xlsx, sheet_name):
        """Read sheet data with proper header detection."""
        header_row = self.find_header_row(xlsx, sheet_name)
        if header_row is None:
            return None, None

        # Read with the correct header row
        df = pd.read_excel(xlsx, sheet_name=sheet_name, header=header_row)

        # Clean up column names
        df.columns = [str(c).strip() for c in df.columns]

        return df, header_row

    def handle(self, *args, **options):
        file_path = options['file']
        dry_run = options['dry_run']

        self.stdout.write(f'Reading Excel file: {file_path}')
        xlsx = pd.ExcelFile(file_path)

        sheet_names = ['Directors', 'Managers_Payroll', 'Districts Payroll', 'Non Management Payroll']
        all_assignments = []

        for sheet_name in sheet_names:
            self.stdout.write(f'\nProcessing {sheet_name}...')

            df, header_row = self.read_sheet_data(xlsx, sheet_name)
            if df is None:
                self.stdout.write(self.style.WARNING(f'  Could not find header row'))
                continue

            self.stdout.write(f'  Header row: {header_row}, Columns: {list(df.columns)[:5]}...')

            # Find required columns
            staff_id_col = None
            grade_col = None
            step_col = None

            for col in df.columns:
                col_upper = str(col).upper().strip()
                if col_upper == 'STAFF ID':
                    staff_id_col = col
                elif col_upper == 'GRADE':
                    grade_col = col
                elif col_upper == 'GRADE STEP':
                    step_col = col

            if not all([staff_id_col, grade_col, step_col]):
                missing = []
                if not staff_id_col:
                    missing.append('STAFF ID')
                if not grade_col:
                    missing.append('GRADE')
                if not step_col:
                    missing.append('GRADE STEP')
                self.stdout.write(self.style.WARNING(f'  Missing columns: {missing}'))
                continue

            self.stdout.write(f'  Found columns: {staff_id_col}, {grade_col}, {step_col}')

            count = 0
            for _, row in df.iterrows():
                staff_id = row.get(staff_id_col)
                grade_str = row.get(grade_col)
                step = row.get(step_col)

                if pd.isna(staff_id) or pd.isna(grade_str):
                    continue

                try:
                    staff_id = int(float(staff_id))
                except (ValueError, TypeError):
                    continue

                band_num, level_code = self.parse_grade(grade_str)
                if not level_code:
                    continue

                try:
                    step_int = int(float(step)) if not pd.isna(step) else 1
                except (ValueError, TypeError):
                    step_int = 1

                all_assignments.append({
                    'staff_id': staff_id,
                    'level_code': level_code,
                    'step': step_int,
                    'sheet': sheet_name
                })
                count += 1

            self.stdout.write(f'  Found {count} valid records')

        self.stdout.write(f'\nTotal assignments to process: {len(all_assignments)}')

        # Process assignments
        updated = 0
        not_found = 0
        no_grade = 0
        no_notch = 0
        errors = []

        with transaction.atomic():
            for assignment in all_assignments:
                staff_id = assignment['staff_id']
                level_code = assignment['level_code']
                step = assignment['step']

                # Find employee
                try:
                    employee = Employee.objects.get(employee_number=str(staff_id), is_deleted=False)
                except Employee.DoesNotExist:
                    not_found += 1
                    continue

                # Find grade
                job_grade = self.get_job_grade(level_code)
                if not job_grade:
                    no_grade += 1
                    if len(errors) < 50:
                        errors.append(f'No JobGrade for level {level_code} (Staff {staff_id})')
                    continue

                # Find notch
                notch = self.get_notch(level_code, step)
                if not notch:
                    no_notch += 1
                    if len(errors) < 50:
                        errors.append(f'No notch for {level_code} step {step} (Staff {staff_id})')
                    continue

                # Update employee
                if not dry_run:
                    employee.grade = job_grade
                    employee.salary_notch = notch
                    employee.save(update_fields=['grade', 'salary_notch'])

                updated += 1

            if dry_run:
                self.stdout.write(self.style.WARNING('\n=== DRY RUN - No changes saved ==='))
                transaction.set_rollback(True)

        self.stdout.write('\n=== Results ===')
        self.stdout.write(self.style.SUCCESS(f'  Would update: {updated}') if dry_run else self.style.SUCCESS(f'  Updated: {updated}'))
        self.stdout.write(f'  Employee not found: {not_found}')
        self.stdout.write(f'  No matching grade: {no_grade}')
        self.stdout.write(f'  No matching notch: {no_notch}')

        if errors[:10]:
            self.stdout.write('\nSample errors:')
            for err in errors[:10]:
                self.stdout.write(f'  - {err}')
