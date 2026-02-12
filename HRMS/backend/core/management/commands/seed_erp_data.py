"""
Seed realistic data for all ERP modules (Finance, Procurement, Inventory, Projects).

Usage:
    python manage.py seed_erp_data
    python manage.py seed_erp_data --clear   # Clear ERP data first
"""

import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone


class Command(BaseCommand):
    help = 'Seed realistic ERP data for Finance, Procurement, Inventory, and Projects.'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear ERP data before seeding.')

    def handle(self, *args, **options):
        if options['clear']:
            self._clear_data()

        with transaction.atomic():
            self.stdout.write(self.style.MIGRATE_HEADING('\n=== Seeding Chart of Accounts ==='))
            self.seed_accounts()

            self.stdout.write(self.style.MIGRATE_HEADING('\n=== Seeding Fiscal Years & Periods ==='))
            self.seed_fiscal_years()

            self.stdout.write(self.style.MIGRATE_HEADING('\n=== Seeding Vendors ==='))
            self.seed_vendors()

            self.stdout.write(self.style.MIGRATE_HEADING('\n=== Seeding Customers ==='))
            self.seed_customers()

            self.stdout.write(self.style.MIGRATE_HEADING('\n=== Seeding Budgets ==='))
            self.seed_budgets()

            self.stdout.write(self.style.MIGRATE_HEADING('\n=== Seeding Inventory Items & Warehouses ==='))
            self.seed_inventory()

            self.stdout.write(self.style.MIGRATE_HEADING('\n=== Seeding Assets ==='))
            self.seed_assets()

            self.stdout.write(self.style.MIGRATE_HEADING('\n=== Seeding Purchase Orders ==='))
            self.seed_procurement()

            self.stdout.write(self.style.MIGRATE_HEADING('\n=== Seeding Journal Entries ==='))
            self.seed_journal_entries()

            self.stdout.write(self.style.MIGRATE_HEADING('\n=== Seeding Vendor & Customer Invoices ==='))
            self.seed_invoices()

            self.stdout.write(self.style.MIGRATE_HEADING('\n=== Seeding Projects ==='))
            self.seed_projects()

            self.stdout.write(self.style.MIGRATE_HEADING('\n=== Seeding Bank Accounts ==='))
            self.seed_bank_accounts()

        self.stdout.write(self.style.SUCCESS('\nAll ERP data seeded successfully!\n'))

    def _clear_data(self):
        from finance.models import (
            JournalLine, JournalEntry, BudgetCommitment, Budget,
            VendorInvoice, CustomerInvoice, Payment, Vendor, Customer,
            FiscalPeriod, FiscalYear, Account, OrganizationBankAccount,
            BankStatement, BankStatementLine, ExchangeRate,
        )
        from inventory.models import (
            AssetDepreciation, AssetTransfer, Asset, StockEntry,
            StockLedger, Item, ItemCategory, Warehouse,
        )
        from procurement.models import (
            GRNItem, GoodsReceiptNote, PurchaseOrderItem, PurchaseOrder,
            RequisitionItem, PurchaseRequisition,
        )
        from projects.models import Project, Milestone, Timesheet

        self.stdout.write('Clearing ERP data...')
        JournalLine.objects.all().delete()
        JournalEntry.objects.all().delete()
        BudgetCommitment.objects.all().delete()
        Budget.objects.all().delete()
        Payment.objects.all().delete()
        VendorInvoice.objects.all().delete()
        CustomerInvoice.objects.all().delete()
        BankStatementLine.objects.all().delete()
        BankStatement.objects.all().delete()
        OrganizationBankAccount.objects.all().delete()
        ExchangeRate.objects.all().delete()
        GRNItem.objects.all().delete()
        GoodsReceiptNote.objects.all().delete()
        PurchaseOrderItem.objects.all().delete()
        PurchaseOrder.objects.all().delete()
        RequisitionItem.objects.all().delete()
        PurchaseRequisition.objects.all().delete()
        AssetDepreciation.objects.all().delete()
        AssetTransfer.objects.all().delete()
        Asset.objects.all().delete()
        StockEntry.objects.all().delete()
        StockLedger.objects.all().delete()
        Item.objects.all().delete()
        ItemCategory.objects.all().delete()
        Warehouse.objects.all().delete()
        Timesheet.objects.all().delete()
        Milestone.objects.all().delete()
        Project.objects.all().delete()
        Vendor.objects.all().delete()
        Customer.objects.all().delete()
        FiscalPeriod.objects.all().delete()
        FiscalYear.objects.all().delete()
        Account.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('  Done clearing.'))

    # ------------------------------------------------------------------
    # Chart of Accounts (Ghana-standard CoA)
    # ------------------------------------------------------------------
    def seed_accounts(self):
        from finance.models import Account

        # Check if accounts already exist
        if Account.objects.filter(code='1000').exists():
            self.stdout.write('  Accounts already seeded, skipping.')
            return

        accounts = [
            # Assets (1xxx)
            ('1000', 'Assets', 'ASSET', None, True),
            ('1100', 'Current Assets', 'ASSET', '1000', True),
            ('1110', 'Cash and Cash Equivalents', 'ASSET', '1100', False),
            ('1111', 'GCB Bank - Main', 'ASSET', '1110', False),
            ('1112', 'Ecobank - Payroll', 'ASSET', '1110', False),
            ('1113', 'Petty Cash', 'ASSET', '1110', False),
            ('1120', 'Accounts Receivable', 'ASSET', '1100', False),
            ('1130', 'Inventory', 'ASSET', '1100', False),
            ('1140', 'Prepaid Expenses', 'ASSET', '1100', False),
            ('1200', 'Non-Current Assets', 'ASSET', '1000', True),
            ('1210', 'Property, Plant & Equipment', 'ASSET', '1200', False),
            ('1220', 'Vehicles', 'ASSET', '1200', False),
            ('1230', 'IT Equipment', 'ASSET', '1200', False),
            ('1240', 'Office Furniture', 'ASSET', '1200', False),
            ('1250', 'Accumulated Depreciation', 'ASSET', '1200', False),
            # Liabilities (2xxx)
            ('2000', 'Liabilities', 'LIABILITY', None, True),
            ('2100', 'Current Liabilities', 'LIABILITY', '2000', True),
            ('2110', 'Accounts Payable', 'LIABILITY', '2100', False),
            ('2120', 'Accrued Expenses', 'LIABILITY', '2100', False),
            ('2130', 'PAYE Tax Payable', 'LIABILITY', '2100', False),
            ('2140', 'SSNIT Payable', 'LIABILITY', '2100', False),
            ('2150', 'Tier 2 Payable', 'LIABILITY', '2100', False),
            ('2160', 'Net Pay Payable', 'LIABILITY', '2100', False),
            ('2170', 'Loan Deductions Payable', 'LIABILITY', '2100', False),
            ('2180', 'Other Deductions Payable', 'LIABILITY', '2100', False),
            ('2200', 'Non-Current Liabilities', 'LIABILITY', '2000', True),
            ('2210', 'Long-term Loans', 'LIABILITY', '2200', False),
            # Equity (3xxx)
            ('3000', 'Equity', 'EQUITY', None, True),
            ('3100', 'Share Capital', 'EQUITY', '3000', False),
            ('3200', 'Retained Earnings', 'EQUITY', '3000', False),
            # Revenue (4xxx)
            ('4000', 'Revenue', 'REVENUE', None, True),
            ('4100', 'Service Revenue', 'REVENUE', '4000', False),
            ('4200', 'Product Sales', 'REVENUE', '4000', False),
            ('4300', 'Consulting Revenue', 'REVENUE', '4000', False),
            ('4400', 'Other Income', 'REVENUE', '4000', False),
            # Expenses (5xxx)
            ('5000', 'Expenses', 'EXPENSE', None, True),
            ('5100', 'Salary & Wages', 'EXPENSE', '5000', True),
            ('5110', 'Basic Salary Expense', 'EXPENSE', '5100', False),
            ('5120', 'Allowance Expense', 'EXPENSE', '5100', False),
            ('5130', 'Bonus Expense', 'EXPENSE', '5100', False),
            ('5140', 'Overtime Expense', 'EXPENSE', '5100', False),
            ('5150', 'Shift Allowance Expense', 'EXPENSE', '5100', False),
            ('5160', 'Employer SSNIT Expense', 'EXPENSE', '5100', False),
            ('5170', 'Employer Tier 2 Expense', 'EXPENSE', '5100', False),
            ('5200', 'Operating Expenses', 'EXPENSE', '5000', True),
            ('5210', 'Rent Expense', 'EXPENSE', '5200', False),
            ('5220', 'Utilities Expense', 'EXPENSE', '5200', False),
            ('5230', 'Office Supplies', 'EXPENSE', '5200', False),
            ('5240', 'Travel & Transport', 'EXPENSE', '5200', False),
            ('5250', 'Professional Fees', 'EXPENSE', '5200', False),
            ('5260', 'Insurance Expense', 'EXPENSE', '5200', False),
            ('5270', 'Training & Development', 'EXPENSE', '5200', False),
            ('5280', 'Depreciation Expense', 'EXPENSE', '5200', False),
            ('5290', 'Maintenance & Repairs', 'EXPENSE', '5200', False),
            ('5300', 'Communication', 'EXPENSE', '5200', False),
        ]

        # Create accounts in order (parents first)
        acct_map = {}
        for code, name, acct_type, parent_code, is_header in accounts:
            parent = acct_map.get(parent_code)
            acct = Account.objects.create(
                code=code,
                name=name,
                account_type=acct_type,
                parent=parent,
                is_header=is_header,
                is_active=True,
                currency='GHS',
            )
            acct_map[code] = acct

        self.stdout.write(self.style.SUCCESS(f'  Created {len(accounts)} accounts'))

    # ------------------------------------------------------------------
    # Fiscal Years & Periods
    # ------------------------------------------------------------------
    def seed_fiscal_years(self):
        from finance.models import FiscalYear, FiscalPeriod

        if FiscalYear.objects.exists():
            self.stdout.write('  Fiscal years already seeded, skipping.')
            return

        for year in [2025, 2026]:
            fy = FiscalYear.objects.create(
                name=f"FY {year}",
                start_date=date(year, 1, 1),
                end_date=date(year, 12, 31),
                is_closed=(year < 2026),
            )
            for month in range(1, 13):
                if month == 12:
                    end = date(year, 12, 31)
                else:
                    end = date(year, month + 1, 1) - timedelta(days=1)

                is_closed = (year < 2026) or (year == 2026 and month < 2)
                FiscalPeriod.objects.create(
                    fiscal_year=fy,
                    name=f"{year}-{month:02d}",
                    period_number=month,
                    start_date=date(year, month, 1),
                    end_date=end,
                    is_closed=is_closed,
                )

            self.stdout.write(f'  Created FY {year} with 12 periods')

    # ------------------------------------------------------------------
    # Vendors
    # ------------------------------------------------------------------
    def seed_vendors(self):
        from finance.models import Vendor

        if Vendor.objects.exists():
            self.stdout.write('  Vendors already seeded, skipping.')
            return

        vendors = [
            ('V001', 'Melcom Group', 'Office Supplies', 'P.O. Box AN 7828, Accra', 'GH9876543210', '030-222-0123'),
            ('V002', 'CompuGhana Ltd', 'IT Equipment', 'Ring Road, Accra', 'GH1234567890', '030-233-4567'),
            ('V003', 'Jandel Furniture', 'Office Furniture', 'Spintex Road, Accra', 'GH5678901234', '030-244-5678'),
            ('V004', 'MTN Business', 'Telecommunications', 'Independence Ave, Accra', 'GH4321098765', '030-255-6789'),
            ('V005', 'ECG Commercial', 'Electricity', 'Electro Volta House, Accra', 'GH8765432109', '030-266-7890'),
            ('V006', 'Ghacem Ltd', 'Building Materials', 'Tema Industrial Area', 'GH2345678901', '022-777-0123'),
            ('V007', 'Pambros Salt Industries', 'Industrial Supplies', 'Winneba Road', 'GH3456789012', '024-888-1234'),
            ('V008', 'Accra Brewery', 'Beverages/Events', 'N. Industrial Area', 'GH6789012345', '030-222-9999'),
            ('V009', 'Star Assurance', 'Insurance', 'Farrar Ave, Accra', 'GH7890123456', '030-233-8888'),
            ('V010', 'Deloitte Ghana', 'Audit & Consulting', '4 Liberation Rd, Accra', 'GH0123456789', '030-244-7777'),
        ]

        for code, name, category, address, tax_id, phone in vendors:
            Vendor.objects.create(
                code=code,
                name=name,
                address=address,
                tax_id=tax_id,
                contact_phone=phone,
                contact_name=f"Sales Dept - {name}",
                contact_email=f"sales@{name.lower().replace(' ', '').replace('&', '')[:12]}.com.gh",
                payment_terms_days=30,
                is_active=True,
            )

        self.stdout.write(self.style.SUCCESS(f'  Created {len(vendors)} vendors'))

    # ------------------------------------------------------------------
    # Customers
    # ------------------------------------------------------------------
    def seed_customers(self):
        from finance.models import Customer

        if Customer.objects.exists():
            self.stdout.write('  Customers already seeded, skipping.')
            return

        customers = [
            ('C001', 'Ghana Revenue Authority', 'Revenue House, Accra', 'GRA-001'),
            ('C002', 'Tullow Oil Ghana', '9 Wuogon Close, Airport', 'TOG-002'),
            ('C003', 'Vodafone Ghana', 'PMB, Accra-North', 'VFG-003'),
            ('C004', 'Stanbic Bank Ghana', 'Valco Trust House', 'SBG-004'),
            ('C005', 'University of Ghana', 'Legon, Accra', 'UOG-005'),
        ]

        for code, name, address, tax_id in customers:
            Customer.objects.create(
                code=code,
                name=name,
                address=address,
                contact_name=f"Finance Dept - {name}",
                contact_email=f"finance@{code.lower()}.example.com",
                payment_terms_days=30,
                is_active=True,
            )

        self.stdout.write(self.style.SUCCESS(f'  Created {len(customers)} customers'))

    # ------------------------------------------------------------------
    # Budgets
    # ------------------------------------------------------------------
    def seed_budgets(self):
        from finance.models import Budget, FiscalYear, Account

        if Budget.objects.exists():
            self.stdout.write('  Budgets already seeded, skipping.')
            return

        fy_2026 = FiscalYear.objects.filter(name='FY 2026').first()
        if not fy_2026:
            self.stdout.write('  No FY 2026 found, skipping budgets.')
            return

        expense_accounts = Account.objects.filter(
            account_type='EXPENSE', is_header=False, code__startswith='5'
        )

        for acct in expense_accounts:
            amount = Decimal(random.randint(50000, 500000))
            Budget.objects.create(
                fiscal_year=fy_2026,
                account=acct,
                original_amount=amount,
                revised_amount=amount,
                status='APPROVED',
            )

        self.stdout.write(self.style.SUCCESS(f'  Created {expense_accounts.count()} budgets for FY 2026'))

    # ------------------------------------------------------------------
    # Inventory: Warehouses, Categories, Items
    # ------------------------------------------------------------------
    def seed_inventory(self):
        from inventory.models import Item, ItemCategory, Warehouse

        if Warehouse.objects.exists():
            self.stdout.write('  Inventory already seeded, skipping.')
            return

        # Warehouses
        warehouses = [
            ('WH-MAIN', 'Main Warehouse', 'Accra Head Office'),
            ('WH-TEMA', 'Tema Store', 'Tema Industrial Area'),
            ('WH-KSI', 'Kumasi Store', 'Kumasi Adum'),
        ]
        wh_map = {}
        for code, name, location in warehouses:
            wh = Warehouse.objects.create(
                code=code, name=name, address=location, is_active=True,
            )
            wh_map[code] = wh

        # Categories
        categories_data = [
            ('Office Supplies', False),
            ('IT Equipment', True),
            ('Furniture', True),
            ('Cleaning Supplies', False),
            ('Safety Equipment', False),
            ('Stationery', False),
        ]
        cat_map = {}
        for name, is_asset in categories_data:
            cat = ItemCategory.objects.create(
                name=name, is_asset_category=is_asset,
            )
            cat_map[name] = cat

        # Items
        items_data = [
            ('ITM-001', 'A4 Paper (Ream)', 'Office Supplies', False, Decimal('25.00')),
            ('ITM-002', 'Toner Cartridge HP', 'Office Supplies', False, Decimal('350.00')),
            ('ITM-003', 'Dell Laptop Latitude', 'IT Equipment', True, Decimal('8500.00')),
            ('ITM-004', 'HP LaserJet Printer', 'IT Equipment', True, Decimal('4200.00')),
            ('ITM-005', 'Office Desk (Executive)', 'Furniture', True, Decimal('3500.00')),
            ('ITM-006', 'Office Chair (Ergonomic)', 'Furniture', True, Decimal('2800.00')),
            ('ITM-007', 'Hand Sanitizer (5L)', 'Cleaning Supplies', False, Decimal('45.00')),
            ('ITM-008', 'Fire Extinguisher', 'Safety Equipment', False, Decimal('250.00')),
            ('ITM-009', 'Whiteboard Marker Set', 'Stationery', False, Decimal('35.00')),
            ('ITM-010', 'Projector Epson', 'IT Equipment', True, Decimal('6500.00')),
            ('ITM-011', 'UPS 1500VA', 'IT Equipment', True, Decimal('1800.00')),
            ('ITM-012', 'Network Switch 24-port', 'IT Equipment', True, Decimal('3200.00')),
        ]

        for code, name, cat_name, is_asset, cost in items_data:
            Item.objects.create(
                code=code,
                name=name,
                category=cat_map[cat_name],
                is_stockable=True,
                is_asset=is_asset,
                standard_cost=cost,
                reorder_level=5 if not is_asset else 0,
                reorder_qty=10 if not is_asset else 0,
                is_active=True,
            )

        self.stdout.write(self.style.SUCCESS(
            f'  Created {len(warehouses)} warehouses, {len(categories_data)} categories, {len(items_data)} items'
        ))

    # ------------------------------------------------------------------
    # Assets
    # ------------------------------------------------------------------
    def seed_assets(self):
        from inventory.models import Asset, ItemCategory

        if Asset.objects.exists():
            self.stdout.write('  Assets already seeded, skipping.')
            return

        assets_data = [
            ('AST-001', 'Dell Latitude 5540 - CEO', 'IT Equipment', Decimal('8500.00'), 36, 'STRAIGHT_LINE', Decimal('500.00')),
            ('AST-002', 'Dell Latitude 5540 - CFO', 'IT Equipment', Decimal('8500.00'), 36, 'STRAIGHT_LINE', Decimal('500.00')),
            ('AST-003', 'HP LaserJet Pro M404', 'IT Equipment', Decimal('4200.00'), 60, 'STRAIGHT_LINE', Decimal('200.00')),
            ('AST-004', 'Toyota Hilux 2024', 'Furniture', Decimal('285000.00'), 96, 'DECLINING_BALANCE', Decimal('30000.00')),
            ('AST-005', 'Executive Desk Set - CEO', 'Furniture', Decimal('5500.00'), 84, 'STRAIGHT_LINE', Decimal('300.00')),
            ('AST-006', 'Conference Table (12-seater)', 'Furniture', Decimal('12000.00'), 120, 'STRAIGHT_LINE', Decimal('500.00')),
            ('AST-007', 'Epson EB-2250U Projector', 'IT Equipment', Decimal('6500.00'), 48, 'SUM_OF_YEARS', Decimal('400.00')),
            ('AST-008', 'Server Dell PowerEdge R750', 'IT Equipment', Decimal('45000.00'), 60, 'STRAIGHT_LINE', Decimal('2000.00')),
            ('AST-009', 'UPS APC Smart 3000VA', 'IT Equipment', Decimal('5800.00'), 60, 'STRAIGHT_LINE', Decimal('300.00')),
            ('AST-010', 'Office Building Renovation', 'Furniture', Decimal('150000.00'), 120, 'STRAIGHT_LINE', Decimal('10000.00')),
        ]

        for asset_num, name, cat_name, cost, life_months, method, salvage in assets_data:
            cat = ItemCategory.objects.filter(name=cat_name).first()
            Asset.objects.create(
                asset_number=asset_num,
                name=name,
                category=cat,
                acquisition_date=date(2025, random.randint(1, 6), random.randint(1, 28)),
                acquisition_cost=cost,
                current_value=cost,
                accumulated_depreciation=Decimal('0'),
                depreciation_method=method,
                useful_life_months=life_months,
                salvage_value=salvage,
                status='ACTIVE',
            )

        self.stdout.write(self.style.SUCCESS(f'  Created {len(assets_data)} assets'))

    # ------------------------------------------------------------------
    # Procurement: Requisitions, POs, GRNs
    # ------------------------------------------------------------------
    def seed_procurement(self):
        from procurement.models import (
            PurchaseOrder, PurchaseOrderItem,
            GoodsReceiptNote, GRNItem,
        )
        from finance.models import Vendor
        from inventory.models import Item, Warehouse
        from employees.models import Employee

        if PurchaseOrder.objects.exists():
            self.stdout.write('  Procurement already seeded, skipping.')
            return

        vendors = list(Vendor.objects.all())
        items = list(Item.objects.all())
        warehouse = Warehouse.objects.first()
        employee = Employee.objects.first()

        if not vendors or not items:
            self.stdout.write('  No vendors/items found, skipping procurement.')
            return

        # Create 5 Purchase Orders
        for i in range(1, 6):
            vendor = vendors[i % len(vendors)]
            po = PurchaseOrder.objects.create(
                po_number=f"PO-202602-{i:04d}",
                vendor=vendor,
                order_date=date(2026, 1, 15) + timedelta(days=i * 5),
                delivery_date=date(2026, 2, 15) + timedelta(days=i * 5),
                status='RECEIVED' if i <= 3 else 'APPROVED',
                total_amount=Decimal('0'),
            )

            total = Decimal('0')
            selected_items = random.sample(items, min(3, len(items)))
            for j, item in enumerate(selected_items):
                qty = Decimal(random.randint(2, 20))
                price = item.standard_cost
                line_total = qty * price
                PurchaseOrderItem.objects.create(
                    purchase_order=po,
                    description=item.name,
                    item=item,
                    quantity=qty,
                    unit_of_measure='EACH',
                    unit_price=price,
                    total=line_total,
                )
                total += line_total

            po.total_amount = total
            po.save(update_fields=['total_amount'])

            # Create GRN for received POs (needs employee for received_by)
            if po.status == 'RECEIVED' and warehouse and employee:
                grn = GoodsReceiptNote.objects.create(
                    grn_number=f"GRN-202602-{i:04d}",
                    purchase_order=po,
                    received_by=employee,
                    receipt_date=po.delivery_date,
                    status='ACCEPTED',
                    warehouse=warehouse,
                    inspection_notes='Goods received in good condition.',
                )
                for po_item in po.items.all():
                    GRNItem.objects.create(
                        grn=grn,
                        po_item=po_item,
                        received_qty=po_item.quantity,
                        accepted_qty=po_item.quantity,
                        rejected_qty=0,
                    )

        self.stdout.write(self.style.SUCCESS('  Created 5 POs with GRNs'))

    # ------------------------------------------------------------------
    # Journal Entries (sample GL transactions)
    # ------------------------------------------------------------------
    def seed_journal_entries(self):
        from finance.models import JournalEntry, JournalLine, FiscalPeriod, Account

        if JournalEntry.objects.exists():
            self.stdout.write('  Journal entries already seeded, skipping.')
            return

        period = FiscalPeriod.objects.filter(name='2026-01').first()
        if not period:
            self.stdout.write('  No fiscal period found, skipping.')
            return

        entries = [
            ('JV-202601-0001', 'Monthly rent payment', [
                ('5210', Decimal('15000.00'), Decimal('0')),
                ('1111', Decimal('0'), Decimal('15000.00')),
            ]),
            ('JV-202601-0002', 'Office supplies purchase', [
                ('5230', Decimal('3500.00'), Decimal('0')),
                ('2110', Decimal('0'), Decimal('3500.00')),
            ]),
            ('JV-202601-0003', 'Service revenue - GRA contract', [
                ('1120', Decimal('45000.00'), Decimal('0')),
                ('4100', Decimal('0'), Decimal('45000.00')),
            ]),
            ('JV-202601-0004', 'Consulting revenue - Tullow Oil', [
                ('1120', Decimal('85000.00'), Decimal('0')),
                ('4300', Decimal('0'), Decimal('85000.00')),
            ]),
            ('JV-202601-0005', 'Electricity bill', [
                ('5220', Decimal('4200.00'), Decimal('0')),
                ('1111', Decimal('0'), Decimal('4200.00')),
            ]),
            ('JV-202601-0006', 'Insurance premium', [
                ('5260', Decimal('8500.00'), Decimal('0')),
                ('1111', Decimal('0'), Decimal('8500.00')),
            ]),
        ]

        acct_map = {a.code: a for a in Account.objects.filter(code__startswith=('1', '2', '3', '4', '5'))}

        for entry_num, desc, lines in entries:
            total_dr = sum(dr for _, dr, _ in lines)
            total_cr = sum(cr for _, _, cr in lines)

            je = JournalEntry.objects.create(
                entry_number=entry_num,
                journal_date=date(2026, 1, 15),
                fiscal_period=period,
                description=desc,
                source='MANUAL',
                status='POSTED',
                total_debit=total_dr,
                total_credit=total_cr,
                posted_at=timezone.now(),
            )

            for acct_code, dr, cr in lines:
                acct = acct_map.get(acct_code)
                if acct:
                    JournalLine.objects.create(
                        journal_entry=je,
                        account=acct,
                        description=desc,
                        debit_amount=dr,
                        credit_amount=cr,
                    )

        self.stdout.write(self.style.SUCCESS(f'  Created {len(entries)} journal entries'))

    # ------------------------------------------------------------------
    # Vendor & Customer Invoices
    # ------------------------------------------------------------------
    def seed_invoices(self):
        from finance.models import VendorInvoice, CustomerInvoice, Vendor, Customer

        if VendorInvoice.objects.exists():
            self.stdout.write('  Invoices already seeded, skipping.')
            return

        vendors = list(Vendor.objects.all()[:5])
        customers = list(Customer.objects.all())

        # Vendor invoices (AP)
        for i, vendor in enumerate(vendors):
            amount = Decimal(random.randint(5000, 50000))
            paid = amount if i < 2 else Decimal('0')
            inv_status = 'PAID' if i < 2 else ('PENDING' if i < 4 else 'APPROVED')

            VendorInvoice.objects.create(
                vendor=vendor,
                invoice_number=f"VINV-202601-{i+1:04d}",
                invoice_date=date(2026, 1, 10 + i * 3),
                due_date=date(2026, 2, 10 + i * 3),
                total_amount=amount,
                paid_amount=paid,
                status=inv_status,
                description=f"Invoice from {vendor.name}",
            )

        # Customer invoices (AR)
        for i, customer in enumerate(customers):
            amount = Decimal(random.randint(20000, 100000))
            paid = amount if i < 1 else Decimal('0')
            inv_status = 'PAID' if i < 1 else ('SENT' if i < 3 else 'OVERDUE')

            CustomerInvoice.objects.create(
                customer=customer,
                invoice_number=f"CINV-202601-{i+1:04d}",
                invoice_date=date(2026, 1, 5 + i * 5),
                due_date=date(2026, 2, 5 + i * 5),
                total_amount=amount,
                paid_amount=paid,
                status=inv_status,
                description=f"Invoice to {customer.name}",
            )

        self.stdout.write(self.style.SUCCESS(
            f'  Created {len(vendors)} vendor invoices, {len(customers)} customer invoices'
        ))

    # ------------------------------------------------------------------
    # Projects
    # ------------------------------------------------------------------
    def seed_projects(self):
        from projects.models import Project, Milestone

        if Project.objects.exists():
            self.stdout.write('  Projects already seeded, skipping.')
            return

        projects_data = [
            ('PRJ-001', 'ERP Implementation', 'Full ERP system rollout', Decimal('500000.00'), 'ACTIVE'),
            ('PRJ-002', 'Office Renovation', 'Head office renovation', Decimal('150000.00'), 'ACTIVE'),
            ('PRJ-003', 'Employee Training Program', 'Annual training initiative', Decimal('80000.00'), 'PLANNING'),
            ('PRJ-004', 'IT Infrastructure Upgrade', 'Network and server upgrade', Decimal('200000.00'), 'ACTIVE'),
            ('PRJ-005', 'ISO Certification', 'ISO 9001 certification process', Decimal('120000.00'), 'PLANNING'),
        ]

        for code, name, desc, budget_amt, proj_status in projects_data:
            project = Project.objects.create(
                code=code,
                name=name,
                description=desc,
                budget_amount=budget_amt,
                actual_cost=Decimal('0'),
                status=proj_status,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 12, 31),
            )

            # Add milestones
            milestones = [
                (f"Phase 1 - {name}", date(2026, 3, 31), 'IN_PROGRESS'),
                (f"Phase 2 - {name}", date(2026, 6, 30), 'PENDING'),
                (f"Phase 3 - {name}", date(2026, 9, 30), 'PENDING'),
                (f"Completion - {name}", date(2026, 12, 15), 'PENDING'),
            ]
            for m_name, target, m_status in milestones:
                Milestone.objects.create(
                    project=project,
                    name=m_name,
                    due_date=target,
                    status=m_status,
                )

        self.stdout.write(self.style.SUCCESS(f'  Created {len(projects_data)} projects with milestones'))

    # ------------------------------------------------------------------
    # Bank Accounts
    # ------------------------------------------------------------------
    def seed_bank_accounts(self):
        from finance.models import OrganizationBankAccount, Account

        if OrganizationBankAccount.objects.exists():
            self.stdout.write('  Bank accounts already seeded, skipping.')
            return

        gl_cash = Account.objects.filter(code='1111').first()
        gl_payroll = Account.objects.filter(code='1112').first()
        gl_petty = Account.objects.filter(code='1113').first()

        if not gl_cash:
            self.stdout.write('  No GL cash account found, skipping.')
            return

        banks = [
            ('GCB Main Account', 'GCB Bank', '1234567890', 'Accra Main', gl_cash),
            ('Ecobank Payroll', 'Ecobank Ghana', '0987654321', 'Accra Central', gl_payroll or gl_cash),
            ('Stanbic Operations', 'Stanbic Bank', '5678901234', 'Airport City', gl_petty or gl_cash),
        ]

        for name, bank, acct_num, branch, gl_acct in banks:
            OrganizationBankAccount.objects.create(
                name=name,
                bank_name=bank,
                account_number=acct_num,
                branch=branch,
                currency='GHS',
                gl_account=gl_acct,
                is_active=True,
            )

        self.stdout.write(self.style.SUCCESS(f'  Created {len(banks)} bank accounts'))
