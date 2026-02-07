"""
Management command to update employee data (Ghana Card, SSNIT, Bank accounts) from Excel.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
import pandas as pd

from employees.models import Employee, BankAccount
from payroll.models import Bank, BankBranch


class Command(BaseCommand):
    help = 'Update employee data (Ghana Card, SSNIT, Bank accounts) from Excel file'

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

    def clean_value(self, value):
        """Clean and validate a value."""
        if pd.isna(value) or str(value).strip() in ['', '0', '0.0', 'nan', 'None']:
            return None
        return str(value).strip()

    def handle(self, *args, **options):
        file_path = options['file']
        dry_run = options['dry_run']

        self.stdout.write(f'Reading Excel file: {file_path}')
        xlsx = pd.ExcelFile(file_path)

        sheet_configs = [
            ('Directors', 3),
            ('Managers_Payroll', 8),
            ('Districts Payroll', 8),
            ('Non Management Payroll', 8),
        ]

        # Collect all data
        all_data = []

        for sheet_name, default_header in sheet_configs:
            self.stdout.write(f'\nProcessing {sheet_name}...')

            header_row = self.find_header_row(xlsx, sheet_name)
            if header_row is None:
                header_row = default_header

            df = pd.read_excel(xlsx, sheet_name=sheet_name, header=header_row)
            df.columns = [str(c).strip() for c in df.columns]

            # Find columns
            staff_col = self.get_column(df, ['STAFF ID'])
            ssnit_col = self.get_column(df, ['SSNIT NUMBER', 'SSNIT'])
            nia_col = self.get_column(df, ['NIA NUMBER', 'NIA'])
            bank_name_col = self.get_column(df, ['BANK NAME'])
            bank_code_col = self.get_column(df, ['BANK CODE'])
            branch_col = self.get_column(df, ['BANK BRANCH', 'BRANCH NAME'])
            branch_code_col = self.get_column(df, ['BRANCH CODE'])
            account_col = self.get_column(df, ['ACCOUNT NUMBER', 'ACCOUNT'])

            self.stdout.write(f'  Columns found: Staff={staff_col is not None}, SSNIT={ssnit_col is not None}, '
                            f'NIA={nia_col is not None}, Bank={bank_name_col is not None}, Account={account_col is not None}')

            for _, row in df.iterrows():
                staff_id = row.get(staff_col) if staff_col else None
                if pd.isna(staff_id):
                    continue

                try:
                    staff_id = int(float(staff_id))
                except (ValueError, TypeError):
                    continue

                data = {
                    'staff_id': staff_id,
                    'ssnit': self.clean_value(row.get(ssnit_col)) if ssnit_col else None,
                    'nia': self.clean_value(row.get(nia_col)) if nia_col else None,
                    'bank_name': self.clean_value(row.get(bank_name_col)) if bank_name_col else None,
                    'bank_code': self.clean_value(row.get(bank_code_col)) if bank_code_col else None,
                    'branch_name': self.clean_value(row.get(branch_col)) if branch_col else None,
                    'branch_code': self.clean_value(row.get(branch_code_col)) if branch_code_col else None,
                    'account_number': self.clean_value(row.get(account_col)) if account_col else None,
                    'sheet': sheet_name
                }

                # Clean account number (remove .0 from float conversion)
                if data['account_number']:
                    data['account_number'] = data['account_number'].replace('.0', '')

                all_data.append(data)

            self.stdout.write(f'  Collected {len([d for d in all_data if d["sheet"] == sheet_name])} records')

        self.stdout.write(f'\nTotal records collected: {len(all_data)}')

        # Process updates
        nia_updated = 0
        ssnit_updated = 0
        bank_created = 0
        bank_updated = 0
        not_found = 0

        # Cache banks
        banks = {}

        with transaction.atomic():
            for data in all_data:
                staff_id = data['staff_id']

                # Find employee
                try:
                    employee = Employee.objects.get(employee_number=str(staff_id), is_deleted=False)
                except Employee.DoesNotExist:
                    not_found += 1
                    continue

                updated_fields = []

                # Update Ghana Card (NIA) - check for duplicates first
                if data['nia'] and (not employee.ghana_card_number or employee.ghana_card_number != data['nia']):
                    # Check if Ghana Card already exists for another employee
                    nia_exists = Employee.objects.filter(
                        ghana_card_number=data['nia'],
                        is_deleted=False
                    ).exclude(id=employee.id).exists()

                    if not nia_exists:
                        if not dry_run:
                            employee.ghana_card_number = data['nia']
                        updated_fields.append('ghana_card_number')
                        nia_updated += 1

                # Update SSNIT if missing (check for duplicates first)
                if data['ssnit'] and not employee.ssnit_number:
                    # Check if SSNIT already exists for another employee
                    ssnit_exists = Employee.objects.filter(
                        ssnit_number=data['ssnit'],
                        is_deleted=False
                    ).exclude(id=employee.id).exists()

                    if not ssnit_exists:
                        if not dry_run:
                            employee.ssnit_number = data['ssnit']
                        updated_fields.append('ssnit_number')
                        ssnit_updated += 1

                if updated_fields and not dry_run:
                    employee.save(update_fields=updated_fields)

                # Handle bank account
                if data['bank_name'] and data['account_number']:
                    # Find or create bank
                    bank_key = data['bank_name']
                    if bank_key not in banks:
                        bank, _ = Bank.objects.get_or_create(
                            name=data['bank_name'],
                            defaults={'code': data['bank_code'] or '', 'is_active': True}
                        )
                        banks[bank_key] = bank
                    bank = banks[bank_key]

                    # Check if employee has this bank account
                    existing_account = BankAccount.objects.filter(
                        employee=employee,
                        account_number=data['account_number'],
                        is_deleted=False
                    ).first()

                    if not existing_account:
                        # Check if employee has any bank account
                        has_account = BankAccount.objects.filter(
                            employee=employee,
                            is_deleted=False
                        ).exists()

                        if not dry_run:
                            BankAccount.objects.create(
                                employee=employee,
                                bank=bank,
                                account_number=data['account_number'],
                                account_name=f"{employee.first_name} {employee.last_name}",
                                is_primary=not has_account,  # Primary if first account
                                is_active=True
                            )
                        bank_created += 1
                    else:
                        # Update bank if different
                        if existing_account.bank != bank:
                            if not dry_run:
                                existing_account.bank = bank
                                existing_account.save(update_fields=['bank'])
                            bank_updated += 1

            if dry_run:
                self.stdout.write(self.style.WARNING('\n=== DRY RUN - No changes saved ==='))
                transaction.set_rollback(True)

        self.stdout.write('\n=== Summary ===')
        self.stdout.write(f'  Ghana Card (NIA) updated: {nia_updated}')
        self.stdout.write(f'  SSNIT updated: {ssnit_updated}')
        self.stdout.write(f'  Bank accounts created: {bank_created}')
        self.stdout.write(f'  Bank accounts updated: {bank_updated}')
        self.stdout.write(f'  Employees not found: {not_found}')
