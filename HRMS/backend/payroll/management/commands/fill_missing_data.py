"""
Management command to fill missing employee data from Excel files.
Fills: SSNIT, Ghana Card, Date of Birth, Grade, Salary Notch, Bank Account, Salary Record.
"""
import re
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
import pandas as pd

from employees.models import Employee, BankAccount
from organization.models import JobGrade
from payroll.models import Bank, SalaryLevel, SalaryNotch, EmployeeSalary


class Command(BaseCommand):
    help = 'Fill missing employee data from Excel files'

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

    def parse_grade(self, grade_str):
        """Parse grade string like 'Band 5. Level 5C' to extract level code."""
        if not grade_str or pd.isna(grade_str):
            return None
        match = re.match(r'Band\s*(\d+)\.\s*Level\s*(\w+)', str(grade_str), re.IGNORECASE)
        if match:
            return match.group(2).upper()
        return None

    def find_header_row(self, xlsx, sheet_name):
        """Find the row index containing 'STAFF ID' header."""
        df_raw = pd.read_excel(xlsx, sheet_name=sheet_name, header=None, nrows=20)
        for i, row in df_raw.iterrows():
            row_vals = [str(v).upper().strip() for v in row.values if pd.notna(v)]
            if 'STAFF ID' in row_vals:
                return i
        return None

    def get_column(self, df, patterns):
        """Find column matching any of the patterns."""
        for col in df.columns:
            col_str = str(col).upper()
            for pattern in patterns:
                if pattern.upper() in col_str:
                    return col
        return None

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        # Build lookup data from all Excel files
        excel_data = {}  # emp_number -> data dict

        # Main payroll file (has SSNIT, NIA, Bank data)
        payroll_file = '/home/ekowhinson/projects/expene-tracker-ai/Staff Data for Payroll Implementation-23.12.25.xlsx'
        self.stdout.write(f'\nReading {payroll_file.split("/")[-1]}...')

        xlsx = pd.ExcelFile(payroll_file)
        for sheet_name in xlsx.sheet_names:
            header_row = self.find_header_row(xlsx, sheet_name)
            if header_row is None:
                continue

            df = pd.read_excel(xlsx, sheet_name=sheet_name, header=header_row)
            df.columns = [str(c).strip() for c in df.columns]

            staff_col = self.get_column(df, ['STAFF ID'])
            ssnit_col = self.get_column(df, ['SSNIT NUMBER', 'SSNIT'])
            nia_col = self.get_column(df, ['NIA NUMBER', 'NIA'])
            grade_col = self.get_column(df, ['GRADE'])
            step_col = self.get_column(df, ['GRADE STEP'])
            bank_col = self.get_column(df, ['BANK NAME'])
            branch_col = self.get_column(df, ['BANK BRANCH'])
            account_col = self.get_column(df, ['ACCOUNT NUMBER'])
            hire_date_col = self.get_column(df, ['HIRE DATE'])

            for _, row in df.iterrows():
                staff_id = row.get(staff_col) if staff_col else None
                if pd.isna(staff_id):
                    continue
                try:
                    emp_number = str(int(float(staff_id)))
                except:
                    continue

                if emp_number not in excel_data:
                    excel_data[emp_number] = {}

                # Collect data
                if ssnit_col:
                    val = self.clean_value(row.get(ssnit_col))
                    if val:
                        excel_data[emp_number]['ssnit'] = val
                if nia_col:
                    val = self.clean_value(row.get(nia_col))
                    if val:
                        excel_data[emp_number]['ghana_card'] = val
                if grade_col:
                    val = self.clean_value(row.get(grade_col))
                    if val:
                        excel_data[emp_number]['grade'] = val
                        excel_data[emp_number]['level_code'] = self.parse_grade(val)
                if step_col:
                    val = row.get(step_col)
                    try:
                        excel_data[emp_number]['step'] = int(float(val)) if not pd.isna(val) else 1
                    except:
                        excel_data[emp_number]['step'] = 1
                if bank_col:
                    val = self.clean_value(row.get(bank_col))
                    if val:
                        excel_data[emp_number]['bank_name'] = val
                if branch_col:
                    val = self.clean_value(row.get(branch_col))
                    if val:
                        excel_data[emp_number]['branch_name'] = val
                if account_col:
                    val = self.clean_value(row.get(account_col))
                    if val:
                        excel_data[emp_number]['account_number'] = val.replace('.0', '')
                if hire_date_col:
                    val = self.parse_date(row.get(hire_date_col))
                    if val:
                        excel_data[emp_number]['hire_date'] = val

            self.stdout.write(f'  {sheet_name}: collected data for {len([e for e in excel_data if excel_data[e]])} employees')

        # Master data files (has DOB, more SSNIT)
        master_files = [
            '/home/ekowhinson/projects/expene-tracker-ai/district_staff_data.xlsx',
            '/home/ekowhinson/projects/expene-tracker-ai/managers_data.xlsx',
            '/home/ekowhinson/projects/expene-tracker-ai/non_managers_headoffice_regionaloffice.xlsx',
        ]

        for file_path in master_files:
            self.stdout.write(f'\nReading {file_path.split("/")[-1]}...')
            try:
                df = pd.read_excel(file_path)
                df.columns = [str(c).strip() for c in df.columns]

                for _, row in df.iterrows():
                    emp_number = row.get('EMPLOYEE_NUMBER')
                    if pd.isna(emp_number):
                        continue
                    try:
                        emp_number = str(int(float(emp_number)))
                    except:
                        continue

                    if emp_number not in excel_data:
                        excel_data[emp_number] = {}

                    # DOB
                    dob = self.parse_date(row.get('DATE_OF_BIRTH'))
                    if dob:
                        excel_data[emp_number]['dob'] = dob

                    # SSNIT (backup)
                    ssnit = self.clean_value(row.get('SSNIT'))
                    if ssnit and 'ssnit' not in excel_data[emp_number]:
                        excel_data[emp_number]['ssnit'] = ssnit

                    # Grade (backup)
                    grade = self.clean_value(row.get('GRADE'))
                    if grade and 'grade' not in excel_data[emp_number]:
                        excel_data[emp_number]['grade'] = grade
                        excel_data[emp_number]['level_code'] = self.parse_grade(grade)

                self.stdout.write(f'  Processed {len(df)} rows')
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  Error: {e}'))

        self.stdout.write(f'\nTotal Excel data collected for {len(excel_data)} employees')

        # Cache lookups
        grades = {}
        for grade in JobGrade.objects.filter(is_deleted=False).select_related('salary_level'):
            if grade.salary_level:
                grades[grade.salary_level.code] = grade

        banks = {}

        # Statistics
        stats = {
            'ssnit_filled': 0,
            'ghana_card_filled': 0,
            'dob_filled': 0,
            'grade_filled': 0,
            'notch_filled': 0,
            'bank_created': 0,
            'salary_created': 0,
            'hire_date_filled': 0,
        }

        # Process employees with missing data
        with transaction.atomic():
            # Get employees with missing data
            employees = Employee.objects.filter(is_deleted=False)

            for emp in employees:
                emp_number = emp.employee_number
                if emp_number not in excel_data:
                    continue

                data = excel_data[emp_number]
                updated_fields = []

                # Fill SSNIT if missing
                if not emp.ssnit_number and data.get('ssnit'):
                    ssnit = data['ssnit']
                    # Check for duplicates
                    if not Employee.objects.filter(ssnit_number=ssnit, is_deleted=False).exclude(id=emp.id).exists():
                        if not dry_run:
                            emp.ssnit_number = ssnit
                        updated_fields.append('ssnit_number')
                        stats['ssnit_filled'] += 1

                # Fill Ghana Card if missing
                if not emp.ghana_card_number and data.get('ghana_card'):
                    ghana_card = data['ghana_card']
                    # Check for duplicates
                    if not Employee.objects.filter(ghana_card_number=ghana_card, is_deleted=False).exclude(id=emp.id).exists():
                        if not dry_run:
                            emp.ghana_card_number = ghana_card
                        updated_fields.append('ghana_card_number')
                        stats['ghana_card_filled'] += 1

                # Fill DOB if placeholder (1980)
                if emp.date_of_birth and emp.date_of_birth.year == 1980 and data.get('dob'):
                    if not dry_run:
                        emp.date_of_birth = data['dob']
                    updated_fields.append('date_of_birth')
                    stats['dob_filled'] += 1

                # Fill hire date if different
                if data.get('hire_date') and emp.date_of_joining != data['hire_date']:
                    if not dry_run:
                        emp.date_of_joining = data['hire_date']
                    updated_fields.append('date_of_joining')
                    stats['hire_date_filled'] += 1

                # Fill grade if missing
                if not emp.grade and data.get('level_code'):
                    level_code = data['level_code']
                    job_grade = grades.get(level_code)
                    if job_grade:
                        if not dry_run:
                            emp.grade = job_grade
                        updated_fields.append('grade')
                        stats['grade_filled'] += 1

                        # Also try to fill salary notch
                        if not emp.salary_notch:
                            step = data.get('step', 1)
                            try:
                                notch = SalaryNotch.objects.get(level__code=level_code, name=f'Notch {step}')
                                if not dry_run:
                                    emp.salary_notch = notch
                                updated_fields.append('salary_notch')
                                stats['notch_filled'] += 1
                            except SalaryNotch.DoesNotExist:
                                pass

                # Save employee updates
                if updated_fields and not dry_run:
                    emp.save(update_fields=updated_fields)

                # Create bank account if missing
                if data.get('bank_name') and data.get('account_number'):
                    has_bank = BankAccount.objects.filter(employee=emp, is_deleted=False).exists()
                    if not has_bank:
                        bank_name = data['bank_name']
                        if bank_name not in banks:
                            bank = Bank.objects.filter(name=bank_name).first()
                            if not bank and not dry_run:
                                code = bank_name[:10].upper().replace(' ', '_')
                                counter = 1
                                while Bank.objects.filter(code=code).exists():
                                    code = f"{bank_name[:7].upper().replace(' ', '_')}_{counter}"
                                    counter += 1
                                bank = Bank.objects.create(name=bank_name, code=code, is_active=True)
                            banks[bank_name] = bank

                        if banks.get(bank_name) and not dry_run:
                            BankAccount.objects.create(
                                employee=emp,
                                bank=banks[bank_name],
                                account_number=data['account_number'],
                                account_name=f'{emp.first_name} {emp.last_name}',
                                is_primary=True,
                                is_active=True
                            )
                        stats['bank_created'] += 1

                # Create salary record if missing
                if emp.salary_notch and emp.salary_notch.amount:
                    has_salary = EmployeeSalary.objects.filter(employee=emp, is_current=True).exists()
                    if not has_salary and not dry_run:
                        EmployeeSalary.objects.create(
                            employee=emp,
                            effective_from=emp.date_of_joining or timezone.now().date(),
                            basic_salary=emp.salary_notch.amount,
                            is_current=True
                        )
                        stats['salary_created'] += 1

            if dry_run:
                self.stdout.write(self.style.WARNING('\n=== DRY RUN - No changes saved ==='))
                transaction.set_rollback(True)

        self.stdout.write('\n=== Summary ===')
        for field, count in stats.items():
            if count > 0:
                self.stdout.write(f'  {field}: {count}')

        # Show remaining gaps
        self.stdout.write('\n=== Remaining Gaps ===')
        remaining = {
            'ssnit': Employee.objects.filter(is_deleted=False, ssnit_number__isnull=True).count(),
            'ghana_card': Employee.objects.filter(is_deleted=False, ghana_card_number__isnull=True).count(),
            'grade': Employee.objects.filter(is_deleted=False, grade__isnull=True).count(),
            'notch': Employee.objects.filter(is_deleted=False, salary_notch__isnull=True).count(),
        }
        for field, count in remaining.items():
            self.stdout.write(f'  {field}: {count}')
