"""
Management command to create individual employee allowance/deduction transactions from Excel data.
"""
import re
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
import pandas as pd

from employees.models import Employee
from payroll.models import PayComponent, EmployeeTransaction


class Command(BaseCommand):
    help = 'Create individual employee allowance/deduction transactions from Excel file'

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
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing individual transactions first'
        )

    def find_header_row(self, xlsx, sheet_name):
        """Find the row index containing 'STAFF ID' header."""
        df_raw = pd.read_excel(xlsx, sheet_name=sheet_name, header=None, nrows=20)
        for i, row in df_raw.iterrows():
            row_vals = [str(v).upper().strip() for v in row.values if pd.notna(v)]
            if 'STAFF ID' in row_vals and 'GRADE' in row_vals:
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

    def parse_decimal(self, value):
        """Parse value to Decimal, handling various formats."""
        if pd.isna(value) or value in ['Yes', 'No', '', None]:
            return None
        try:
            return Decimal(str(value))
        except:
            return None

    def handle(self, *args, **options):
        file_path = options['file']
        dry_run = options['dry_run']
        clear_existing = options['clear']

        self.stdout.write(f'Reading Excel file: {file_path}')
        xlsx = pd.ExcelFile(file_path)

        # Ensure required pay components exist
        self.ensure_components()

        # Cache components
        components = {pc.code: pc for pc in PayComponent.objects.filter(is_active=True)}

        # Track all transactions to create
        all_transactions = []

        sheet_names = ['Directors', 'Managers_Payroll', 'Districts Payroll', 'Non Management Payroll']

        for sheet_name in sheet_names:
            self.stdout.write(f'\nProcessing {sheet_name}...')

            header_row = self.find_header_row(xlsx, sheet_name)
            if header_row is None:
                self.stdout.write(self.style.WARNING(f'  Could not find header row'))
                continue

            df = pd.read_excel(xlsx, sheet_name=sheet_name, header=header_row)
            df.columns = [str(c).strip() for c in df.columns]

            # Find columns
            staff_id_col = self.get_column(df, ['STAFF ID'])
            pf_col = self.get_column(df, ['PF Contribution', 'Employee PF'])
            union_col = self.get_column(df, ['UNICOF', 'PAWU'])
            rent_col = self.get_column(df, ['Rent=10', 'Rent='])
            vehicle_col = self.get_column(df, ['Vehicle Allownce', 'Vehicle Allowance', 'Vehicle Maint'])
            fuel_col = self.get_column(df, ['Fuel Allowance'])
            transport_col = self.get_column(df, ['Transport Allowance'])

            self.stdout.write(f'  Found columns: PF={pf_col is not None}, Union={union_col is not None}, '
                            f'Rent={rent_col is not None}, Vehicle={vehicle_col is not None}, '
                            f'Fuel={fuel_col is not None}, Transport={transport_col is not None}')

            count = 0
            for _, row in df.iterrows():
                staff_id = row.get(staff_id_col)
                if pd.isna(staff_id):
                    continue

                try:
                    staff_id = int(float(staff_id))
                except (ValueError, TypeError):
                    continue

                # Process PF Contribution (varies from 5% to 11.5%)
                if pf_col:
                    pf_rate = self.parse_decimal(row.get(pf_col))
                    if pf_rate and pf_rate > 0:
                        # Convert from decimal to percentage (0.05 -> 5)
                        pf_pct = pf_rate * 100 if pf_rate < 1 else pf_rate
                        all_transactions.append({
                            'staff_id': staff_id,
                            'component_code': 'PF_EMP',
                            'override_type': 'PCT',
                            'override_percentage': pf_pct,
                            'override_amount': None,
                            'sheet': sheet_name
                        })

                # Process Union Dues (UNICOF 2% or PAWU 1.5%)
                if union_col:
                    union_rate = self.parse_decimal(row.get(union_col))
                    if union_rate and union_rate > 0:
                        union_pct = union_rate * 100 if union_rate < 1 else union_rate
                        # Determine which union based on rate
                        if union_pct >= 2:
                            component_code = 'UNICOF'
                        else:
                            component_code = 'PAWU'

                        all_transactions.append({
                            'staff_id': staff_id,
                            'component_code': component_code,
                            'override_type': 'PCT',
                            'override_percentage': union_pct,
                            'override_amount': None,
                            'sheet': sheet_name
                        })

                # Process Rent Deduction (10%)
                if rent_col:
                    rent_rate = self.parse_decimal(row.get(rent_col))
                    if rent_rate and rent_rate > 0:
                        rent_pct = rent_rate * 100 if rent_rate < 1 else rent_rate
                        all_transactions.append({
                            'staff_id': staff_id,
                            'component_code': 'RENT',
                            'override_type': 'PCT',
                            'override_percentage': rent_pct,
                            'override_amount': None,
                            'sheet': sheet_name
                        })

                # Process Vehicle Allowance (individual fixed amounts for some)
                if vehicle_col:
                    vehicle_amt = self.parse_decimal(row.get(vehicle_col))
                    # Only create if it's a fixed amount (not 0.18 which is the standard 18%)
                    if vehicle_amt and vehicle_amt > 1 and vehicle_amt != Decimal('0.18'):
                        all_transactions.append({
                            'staff_id': staff_id,
                            'component_code': 'VEHICLE_ALLOW',
                            'override_type': 'FIXED',
                            'override_percentage': None,
                            'override_amount': vehicle_amt,
                            'sheet': sheet_name
                        })

                # Process Fuel Allowance (individual amounts)
                if fuel_col:
                    fuel_amt = self.parse_decimal(row.get(fuel_col))
                    if fuel_amt and fuel_amt > 0:
                        all_transactions.append({
                            'staff_id': staff_id,
                            'component_code': 'FUEL_ALLOW',
                            'override_type': 'FIXED',
                            'override_percentage': None,
                            'override_amount': fuel_amt,
                            'sheet': sheet_name
                        })

                # Process Transport Allowance (individual amounts)
                if transport_col:
                    transport_amt = self.parse_decimal(row.get(transport_col))
                    if transport_amt and transport_amt > 0:
                        all_transactions.append({
                            'staff_id': staff_id,
                            'component_code': 'TRANSPORT',
                            'override_type': 'FIXED',
                            'override_percentage': None,
                            'override_amount': transport_amt,
                            'sheet': sheet_name
                        })

                count += 1

            self.stdout.write(f'  Processed {count} employees')

        self.stdout.write(f'\nTotal transactions to create: {len(all_transactions)}')

        # Group transactions by employee for reporting
        emp_counts = {}
        for t in all_transactions:
            emp_counts[t['staff_id']] = emp_counts.get(t['staff_id'], 0) + 1

        self.stdout.write(f'Unique employees: {len(emp_counts)}')

        # Process transactions
        with transaction.atomic():
            if clear_existing:
                deleted = EmployeeTransaction.objects.filter(
                    target_type='INDIVIDUAL',
                    is_deleted=False
                ).update(is_deleted=True)
                self.stdout.write(f'Cleared {deleted} existing individual transactions')

            created = 0
            not_found = 0
            no_component = 0
            skipped = 0

            for trans_data in all_transactions:
                staff_id = trans_data['staff_id']
                component_code = trans_data['component_code']

                # Find employee
                try:
                    employee = Employee.objects.get(employee_number=str(staff_id), is_deleted=False)
                except Employee.DoesNotExist:
                    not_found += 1
                    continue

                # Find component
                component = components.get(component_code)
                if not component:
                    no_component += 1
                    continue

                # Check if transaction already exists
                existing = EmployeeTransaction.objects.filter(
                    target_type='INDIVIDUAL',
                    employee=employee,
                    pay_component=component,
                    is_deleted=False,
                    status__in=['PENDING', 'APPROVED']
                ).first()

                if existing:
                    skipped += 1
                    continue

                if not dry_run:
                    trans = EmployeeTransaction.objects.create(
                        target_type='INDIVIDUAL',
                        employee=employee,
                        job_grade=None,
                        pay_component=component,
                        override_type=trans_data['override_type'],
                        override_percentage=trans_data['override_percentage'],
                        override_amount=trans_data['override_amount'],
                        effective_from='2025-01-01',
                        is_recurring=True,
                        status='APPROVED',
                        description=f'{component.name} for {employee.first_name} {employee.last_name}'
                    )

                created += 1

            if dry_run:
                self.stdout.write(self.style.WARNING('\n=== DRY RUN - No changes saved ==='))
                transaction.set_rollback(True)

        self.stdout.write('\n=== Summary ===')
        self.stdout.write(self.style.SUCCESS(f'  Created: {created}') if not dry_run else f'  Would create: {created}')
        self.stdout.write(f'  Employee not found: {not_found}')
        self.stdout.write(f'  Component not found: {no_component}')
        self.stdout.write(f'  Skipped (existing): {skipped}')

    def ensure_components(self):
        """Ensure required deduction components exist."""
        deductions = [
            {'code': 'PF_EMP', 'name': 'Employee Provident Fund', 'calc': 'PCT_BASIC'},
            {'code': 'UNICOF', 'name': 'UNICOF Union Dues', 'calc': 'PCT_BASIC'},
            {'code': 'PAWU', 'name': 'PAWU Union Dues', 'calc': 'PCT_BASIC'},
            {'code': 'RENT', 'name': 'Rent Deduction', 'calc': 'PCT_BASIC'},
        ]

        for ded in deductions:
            pc, created = PayComponent.objects.get_or_create(
                code=ded['code'],
                defaults={
                    'name': ded['name'],
                    'component_type': 'DEDUCTION',
                    'calculation_type': ded['calc'],
                    'is_taxable': False,
                    'reduces_taxable': True,
                    'is_recurring': True,
                    'is_active': True,
                    'show_on_payslip': True,
                }
            )
            if created:
                self.stdout.write(f'Created component: {pc.code}')
