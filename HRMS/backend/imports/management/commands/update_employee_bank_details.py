"""
Management command to update employee records with bank details and other missing data from Excel files.
"""
import pandas as pd
from django.core.management.base import BaseCommand
from django.db import transaction
from employees.models import Employee, BankAccount
from payroll.models import Bank, BankBranch, StaffCategory, SalaryNotch


class Command(BaseCommand):
    help = 'Update employee records with bank details and other data from Excel files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--payroll-file',
            type=str,
            default='/home/ekowhinson/projects/expene-tracker-ai/district_payroll_data.xlsx',
            help='Path to the payroll Excel file'
        )
        parser.add_argument(
            '--staff-file',
            type=str,
            default='/home/ekowhinson/projects/expene-tracker-ai/district_staff_data.xlsx',
            help='Path to the staff Excel file'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run without making changes to show what would be updated'
        )

    def handle(self, *args, **options):
        payroll_file = options['payroll_file']
        staff_file = options['staff_file']
        dry_run = options['dry_run']

        # Statistics
        stats = {
            'total_payroll': 0,
            'total_staff': 0,
            'employees_found': 0,
            'employees_not_found': 0,
            'bank_accounts_created': 0,
            'bank_accounts_updated': 0,
            'banks_created': 0,
            'branches_created': 0,
            'gender_updated': 0,
            'dob_updated': 0,
            'staff_category_updated': 0,
            'salary_notch_updated': 0,
            'errors': 0,
        }

        # Read staff data for gender and DOB
        self.stdout.write(f'Reading staff data from: {staff_file}')
        try:
            staff_df = pd.read_excel(staff_file)
            staff_df.columns = staff_df.columns.str.strip()
            stats['total_staff'] = len(staff_df)
            self.stdout.write(f'  Found {len(staff_df)} staff records')
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Failed to read staff file: {e}'))
            staff_df = pd.DataFrame()

        # Read payroll data for bank details
        self.stdout.write(f'Reading payroll data from: {payroll_file}')
        try:
            payroll_df = pd.read_excel(payroll_file)
            payroll_df.columns = payroll_df.columns.str.strip()
            stats['total_payroll'] = len(payroll_df)
            self.stdout.write(f'  Found {len(payroll_df)} payroll records')
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Failed to read payroll file: {e}'))
            payroll_df = pd.DataFrame()

        # Create lookup dictionaries
        staff_lookup = {}
        if not staff_df.empty:
            for _, row in staff_df.iterrows():
                emp_num = str(row.get('EMPLOYEE_NUMBER', '')).strip()
                if emp_num:
                    staff_lookup[emp_num] = row

        payroll_lookup = {}
        if not payroll_df.empty:
            for _, row in payroll_df.iterrows():
                emp_num = str(row.get('EMPLOYEE_NUMBER', '')).strip()
                if emp_num:
                    payroll_lookup[emp_num] = row

        self.stdout.write(f'\nProcessing {len(set(staff_lookup.keys()) | set(payroll_lookup.keys()))} unique employee numbers...')

        try:
            with transaction.atomic():
                # Get all employees
                employees = Employee.objects.all()

                for employee in employees:
                    emp_num = employee.employee_number
                    if not emp_num:
                        continue

                    staff_row = staff_lookup.get(emp_num)
                    payroll_row = payroll_lookup.get(emp_num)

                    if not staff_row is None or not payroll_row is None:
                        stats['employees_found'] += 1
                    else:
                        stats['employees_not_found'] += 1
                        continue

                    updated = False

                    # Update from staff data
                    if staff_row is not None:
                        # Update gender if missing
                        sex = str(staff_row.get('SEX', '')).strip().upper()
                        if sex in ['M', 'F'] and not employee.gender:
                            if not dry_run:
                                employee.gender = 'male' if sex == 'M' else 'female'
                                updated = True
                            stats['gender_updated'] += 1

                        # Update date of birth if missing
                        dob = staff_row.get('DATE_OF_BIRTH')
                        if pd.notna(dob) and not employee.date_of_birth:
                            if not dry_run:
                                try:
                                    if hasattr(dob, 'date'):
                                        employee.date_of_birth = dob.date()
                                    else:
                                        employee.date_of_birth = pd.to_datetime(dob).date()
                                    updated = True
                                except:
                                    pass
                            stats['dob_updated'] += 1

                    # Update from payroll data
                    if payroll_row is not None:
                        # Process bank details
                        bank_name = str(payroll_row.get('BANK', '')).strip()
                        branch_name = str(payroll_row.get('BANK BRANCH', '')).strip()
                        account_no = str(payroll_row.get('ACCOUNT NO', '')).strip()
                        staff_category_name = str(payroll_row.get('STAFF_CATEGORY', '')).strip()
                        notch_code = str(payroll_row.get('NOTCH_NEW', '')).strip()

                        # Update staff category
                        if staff_category_name and staff_category_name != 'nan':
                            category = StaffCategory.objects.filter(name__iexact=staff_category_name).first()
                            if category and employee.staff_category != category:
                                if not dry_run:
                                    employee.staff_category = category
                                    updated = True
                                stats['staff_category_updated'] += 1

                        # Update salary notch
                        if notch_code and notch_code != 'nan':
                            notch = self._find_salary_notch(notch_code)
                            if notch and employee.salary_notch != notch:
                                if not dry_run:
                                    employee.salary_notch = notch
                                    updated = True
                                stats['salary_notch_updated'] += 1

                        # Create/update bank account
                        if bank_name and bank_name != 'nan' and account_no and account_no != 'nan':
                            if not dry_run:
                                self._update_bank_account(
                                    employee, bank_name, branch_name, account_no, stats
                                )
                            else:
                                stats['bank_accounts_created'] += 1

                    if updated and not dry_run:
                        employee.save()

                if dry_run:
                    self.stdout.write(self.style.WARNING('\n=== DRY RUN - Rolling back changes ==='))
                    raise transaction.TransactionManagementError('Dry run rollback')

        except transaction.TransactionManagementError:
            pass  # Expected for dry run
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error during update: {e}'))
            stats['errors'] += 1

        # Print summary
        self.stdout.write('\n' + '=' * 50)
        self.stdout.write(self.style.SUCCESS('Update Complete!'))
        self.stdout.write(f'  Total staff records: {stats["total_staff"]}')
        self.stdout.write(f'  Total payroll records: {stats["total_payroll"]}')
        self.stdout.write(f'  Employees matched: {stats["employees_found"]}')
        self.stdout.write(f'  Employees not matched: {stats["employees_not_found"]}')
        self.stdout.write(f'  Gender updated: {stats["gender_updated"]}')
        self.stdout.write(f'  Date of birth updated: {stats["dob_updated"]}')
        self.stdout.write(f'  Staff category updated: {stats["staff_category_updated"]}')
        self.stdout.write(f'  Salary notch updated: {stats["salary_notch_updated"]}')
        self.stdout.write(f'  Banks created: {stats["banks_created"]}')
        self.stdout.write(f'  Branches created: {stats["branches_created"]}')
        self.stdout.write(f'  Bank accounts created: {stats["bank_accounts_created"]}')
        self.stdout.write(f'  Bank accounts updated: {stats["bank_accounts_updated"]}')
        if stats['errors']:
            self.stdout.write(self.style.WARNING(f'  Errors: {stats["errors"]}'))

    def _find_salary_notch(self, notch_code):
        """Find salary notch from code like 'Band 4/Level 4B/Notch 2'."""
        try:
            # Parse the notch code format: "Band X/Level XY/Notch Z"
            parts = notch_code.split('/')
            if len(parts) >= 3:
                notch_part = parts[2].strip()  # "Notch 2"
                notch_num = notch_part.replace('Notch', '').strip()

                level_part = parts[1].strip()  # "Level 4B"
                level_code = level_part.replace('Level', '').strip()

                # Try to find matching notch
                notch = SalaryNotch.objects.filter(
                    level__code__iexact=level_code,
                    code__iexact=notch_num
                ).first()

                if not notch:
                    # Try with just the number
                    notch = SalaryNotch.objects.filter(
                        level__code__icontains=level_code,
                        name__icontains=notch_num
                    ).first()

                return notch
        except Exception:
            pass
        return None

    def _update_bank_account(self, employee, bank_name, branch_name, account_no, stats):
        """Create or update bank account for employee."""
        # Get or create bank
        bank = None
        if bank_name:
            bank = Bank.objects.filter(name__iexact=bank_name).first()
            if not bank:
                bank_code = self._generate_code(bank_name, 10)
                bank = Bank.objects.create(
                    code=bank_code,
                    name=bank_name,
                    is_active=True,
                )
                stats['banks_created'] += 1

        # Get or create branch
        branch = None
        if branch_name and bank:
            branch = BankBranch.objects.filter(name__iexact=branch_name, bank=bank).first()
            if not branch:
                branch_code = self._generate_code(branch_name, 15)
                branch = BankBranch.objects.create(
                    code=branch_code,
                    name=branch_name,
                    bank=bank,
                    is_active=True,
                )
                stats['branches_created'] += 1

        # Create or update bank account
        existing = BankAccount.objects.filter(
            employee=employee,
            account_number=account_no
        ).first()

        if existing:
            existing.bank = bank
            existing.branch = branch
            existing.bank_name = bank_name
            existing.is_primary = True
            existing.is_active = True
            existing.save()
            stats['bank_accounts_updated'] += 1
        else:
            BankAccount.objects.create(
                employee=employee,
                bank=bank,
                branch=branch,
                bank_name=bank_name,
                account_name=employee.full_name,
                account_number=account_no,
                is_primary=True,
                is_active=True,
            )
            stats['bank_accounts_created'] += 1

            # Deactivate other primary accounts
            BankAccount.objects.filter(
                employee=employee,
                is_primary=True
            ).exclude(account_number=account_no).update(is_primary=False)

    def _generate_code(self, name, max_len):
        """Generate a code from name."""
        words = name.upper().replace('(', '').replace(')', '').replace('-', ' ').split()
        code = ''.join(w[0] for w in words if w)[:max_len]
        return code
