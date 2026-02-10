"""
Management command to sync employee data from payroll Excel file and merge duplicate banks.

Phase 1: Merge duplicate banks (hardcoded map of ~20 pairs)
Phase 2: Read Excel data from all 4 sheets
Phase 3: Update employee records (Ghana Card, SSNIT, Staff Category, Salary Notch, Bank Account)
Phase 4: Print summary report
"""
import re
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count, Q
import pandas as pd

from employees.models import Employee, BankAccount
from organization.models import WorkLocation
from payroll.models import Bank, BankBranch, StaffCategory, SalaryNotch


# Canonical bank code -> list of duplicate bank codes to merge into it
BANK_MERGE_MAP = {
    'GH030100': ['30107', 'ABSA_BANK_'],
    'GH040100': ['40199'],
    'GH080100': ['80230', 'AGRIC._DEV'],
    'GH130100': ['130801', 'ECOBANK_(G'],
    'GH190100': ['190701', 'STANBIC_BA'],
    'GH240100': ['240101'],
    'GH110100': ['110402', 'REPUBLIC_B'],
    'GH020100': ['20617', 'STANDARD_C'],
    'GH230100': ['230119', 'GUARANTY_T'],
    'GH050100': ['50204'],
    'GH140100': ['140401'],
    'GH210100': ['210801', 'BANK_OF_AF'],
    'GH220100': ['340614'],
    'GH090100': ['90701', 'SOCIETE_GE'],
    'GH170100': ['170101'],
    'GH280100': ['280105'],
    'GH180100': ['180606'],
    'GH120100': ['120101'],
    'GH060100': ['60102'],
    'GH100100': ['100204'],
    'GH330100': ['330106'],
    'GH360100': ['360101'],
}

# Banks to clean up (delete if empty, deactivate otherwise)
BANKS_TO_CLEANUP = ['ARB_APEX_&', 'UNIBANK_GH', 'UT_BANK']

# Sheet configurations: (sheet_name, header_row_0idx, staff_category_uuid)
SHEET_CONFIGS = [
    ('Directors', 3, 'c2d78579'),
    ('Managers_Payroll', 8, '28c516f0'),
    ('Districts Payroll', 8, '11bd059e'),
    ('Non Management Payroll', 8, '38f86b09'),
]

PAYROLL_FILE = '/home/ekowhinson/projects/expene-tracker-ai/Staff Data for Payroll Implementation-23.12.25.xlsx'


class Command(BaseCommand):
    help = 'Sync employee data from payroll Excel file and merge duplicate banks'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without saving'
        )
        parser.add_argument(
            '--skip-bank-merge',
            action='store_true',
            help='Skip the bank merge phase'
        )
        parser.add_argument(
            '--skip-employee-update',
            action='store_true',
            help='Skip the employee update phase'
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed output for each employee'
        )

    def clean_value(self, value):
        """Clean and validate a cell value. Returns None for empty/formula values."""
        if pd.isna(value):
            return None
        s = str(value).strip()
        if s in ('', '0', '0.0', 'nan', 'None', 'NaT'):
            return None
        # Skip Excel formula cells
        if s.startswith('='):
            return None
        return s

    def find_header_row(self, xlsx, sheet_name):
        """Find the row index containing 'STAFF ID' header."""
        df_raw = pd.read_excel(xlsx, sheet_name=sheet_name, header=None, nrows=20)
        for i, row in df_raw.iterrows():
            row_vals = [str(v).upper().strip() for v in row.values if pd.notna(v)]
            if 'STAFF ID' in row_vals:
                return i
        return None

    def get_column(self, df, patterns):
        """Find column matching any of the patterns (case-insensitive)."""
        for col in df.columns:
            col_str = str(col).upper()
            for pattern in patterns:
                if pattern.upper() in col_str:
                    return col
        return None

    def parse_grade(self, grade_str):
        """Parse grade string like 'Band 5. Level 5C' to extract level code."""
        if not grade_str or pd.isna(grade_str):
            return None
        match = re.match(r'Band\s*(\d+)\.\s*Level\s*(\w+)', str(grade_str), re.IGNORECASE)
        if match:
            return match.group(2).upper()
        return None

    # ── Phase 1: Merge Duplicate Banks ──────────────────────────────

    def merge_banks(self, dry_run, verbose):
        """Merge duplicate banks into canonical GH-prefixed banks."""
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== Phase 1: Merge Duplicate Banks ==='))

        stats = {
            'banks_merged': 0,
            'branches_moved': 0,
            'accounts_reassigned': 0,
            'legacy_accounts_linked': 0,
            'banks_deactivated': 0,
            'banks_deleted': 0,
        }
        errors = []

        for canonical_code, duplicate_codes in BANK_MERGE_MAP.items():
            try:
                canonical = Bank.objects.filter(code=canonical_code, is_deleted=False).first()
            except Bank.DoesNotExist:
                canonical = None

            if not canonical:
                errors.append(f'Canonical bank {canonical_code} not found, skipping')
                continue

            for dup_code in duplicate_codes:
                dup = Bank.objects.filter(code=dup_code, is_deleted=False).first()
                if not dup:
                    if verbose:
                        self.stdout.write(f'  Duplicate bank {dup_code} not found, skipping')
                    continue

                if verbose:
                    self.stdout.write(f'  Merging {dup.code} ({dup.name}) -> {canonical.code} ({canonical.name})')

                # 1. Move branches from duplicate to canonical
                for branch in BankBranch.objects.filter(bank=dup, is_deleted=False):
                    # Check for code collision under canonical bank
                    existing = BankBranch.objects.filter(
                        bank=canonical, code=branch.code, is_deleted=False
                    ).first()

                    if existing:
                        # Collision: reassign accounts from this branch to the existing one
                        accts_moved = BankAccount.objects.filter(
                            branch=branch, is_deleted=False
                        ).count()
                        if accts_moved and not dry_run:
                            BankAccount.objects.filter(
                                branch=branch, is_deleted=False
                            ).update(branch=existing)
                        if verbose and accts_moved:
                            self.stdout.write(f'    Branch {branch.code} collision: moved {accts_moved} accounts to existing branch')
                        # Deactivate the duplicate branch
                        if not dry_run:
                            branch.is_active = False
                            branch.save(update_fields=['is_active'])
                    else:
                        # No collision: re-parent branch
                        if not dry_run:
                            branch.bank = canonical
                            branch.save(update_fields=['bank_id'])
                        stats['branches_moved'] += 1

                # 2. Update BankAccount records that point to the duplicate bank FK
                acct_count = BankAccount.objects.filter(
                    bank=dup, is_deleted=False
                ).count()
                if acct_count:
                    if not dry_run:
                        BankAccount.objects.filter(
                            bank=dup, is_deleted=False
                        ).update(bank=canonical)
                    stats['accounts_reassigned'] += acct_count
                    if verbose:
                        self.stdout.write(f'    Reassigned {acct_count} accounts (FK)')

                # 3. Update BankAccount records with legacy bank_name/bank_code matching the duplicate

                legacy_qs = BankAccount.objects.filter(
                    bank__isnull=True,
                    is_deleted=False,
                ).filter(
                    Q(bank_code=dup.code) | Q(bank_name__iexact=dup.name)
                )
                legacy_count = legacy_qs.count()
                if legacy_count:
                    if not dry_run:
                        legacy_qs.update(bank=canonical)
                    stats['legacy_accounts_linked'] += legacy_count
                    if verbose:
                        self.stdout.write(f'    Linked {legacy_count} legacy accounts')

                # 4. Deactivate the duplicate bank
                if not dry_run:
                    dup.is_active = False
                    dup.save(update_fields=['is_active'])
                stats['banks_merged'] += 1

        # Also link any legacy accounts matching the canonical bank by name
        for canonical_code in BANK_MERGE_MAP.keys():
            canonical = Bank.objects.filter(code=canonical_code, is_deleted=False).first()
            if not canonical:
                continue
            legacy_qs = BankAccount.objects.filter(
                bank__isnull=True,
                is_deleted=False,
            ).filter(
                Q(bank_name__iexact=canonical.name) | Q(bank_code=canonical.code)
            )
            legacy_count = legacy_qs.count()
            if legacy_count:
                if not dry_run:
                    legacy_qs.update(bank=canonical)
                stats['legacy_accounts_linked'] += legacy_count

        # Clean up empty/defunct banks
        for cleanup_code in BANKS_TO_CLEANUP:
            bank = Bank.objects.filter(code=cleanup_code, is_deleted=False).first()
            if not bank:
                continue
            has_accounts = BankAccount.objects.filter(bank=bank, is_deleted=False).exists()
            has_branches = BankBranch.objects.filter(bank=bank, is_deleted=False).exists()
            if not has_accounts and not has_branches:
                if not dry_run:
                    bank.delete()  # soft delete
                stats['banks_deleted'] += 1
                if verbose:
                    self.stdout.write(f'  Deleted empty bank: {bank.code} ({bank.name})')
            else:
                if not dry_run:
                    bank.is_active = False
                    bank.save(update_fields=['is_active'])
                stats['banks_deactivated'] += 1
                if verbose:
                    self.stdout.write(f'  Deactivated bank: {bank.code} ({bank.name})')

        # Print stats
        self.stdout.write(self.style.SUCCESS('\nBank merge results:'))
        for key, val in stats.items():
            if val:
                self.stdout.write(f'  {key}: {val}')

        active_banks = Bank.objects.filter(is_active=True, is_deleted=False).count()
        self.stdout.write(f'  Active banks remaining: {active_banks}')

        if errors:
            self.stdout.write(self.style.WARNING('\nWarnings:'))
            for err in errors:
                self.stdout.write(f'  {err}')

        return stats

    # ── Phase 2: Read Excel Data ────────────────────────────────────

    def read_excel_data(self, verbose):
        """Read all 4 sheets from the payroll Excel file."""
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== Phase 2: Read Excel Data ==='))

        excel_data = {}  # emp_number -> dict

        xlsx = pd.ExcelFile(PAYROLL_FILE)
        self.stdout.write(f'Opened: {PAYROLL_FILE.split("/")[-1]}')
        self.stdout.write(f'Sheets found: {xlsx.sheet_names}')

        for sheet_name, expected_header_row, category_uuid in SHEET_CONFIGS:
            if sheet_name not in xlsx.sheet_names:
                self.stdout.write(self.style.WARNING(f'  Sheet "{sheet_name}" not found, skipping'))
                continue

            # Find header row (verify expected)
            header_row = self.find_header_row(xlsx, sheet_name)
            if header_row is None:
                self.stdout.write(self.style.WARNING(f'  Sheet "{sheet_name}": no STAFF ID header found'))
                continue

            if header_row != expected_header_row:
                self.stdout.write(self.style.WARNING(
                    f'  Sheet "{sheet_name}": header at row {header_row} (expected {expected_header_row})'
                ))

            df = pd.read_excel(xlsx, sheet_name=sheet_name, header=header_row)
            df.columns = [str(c).strip() for c in df.columns]

            # Find columns
            staff_col = self.get_column(df, ['STAFF ID'])
            ssnit_col = self.get_column(df, ['SSNIT NUMBER', 'SSNIT'])
            nia_col = self.get_column(df, ['NIA NUMBER', 'NIA'])
            name_col = self.get_column(df, ['FULL NAME'])
            grade_col = self.get_column(df, ['GRADE'])
            step_col = self.get_column(df, ['GRADE STEP'])
            location_col = self.get_column(df, ['LOCATION'])
            bank_name_col = self.get_column(df, ['BANK NAME'])
            bank_branch_col = self.get_column(df, ['BANK BRANCH'])
            bank_code_col = self.get_column(df, ['BANK CODE'])
            branch_code_col = self.get_column(df, ['BRANCH CODE'])
            account_col = self.get_column(df, ['ACCOUNT NUMBER'])
            hire_date_col = self.get_column(df, ['HIRE DATE'])

            if not staff_col:
                self.stdout.write(self.style.WARNING(f'  Sheet "{sheet_name}": no STAFF ID column'))
                continue

            sheet_count = 0
            for _, row in df.iterrows():
                staff_id = row.get(staff_col)
                if pd.isna(staff_id):
                    continue
                try:
                    emp_number = str(int(float(staff_id)))
                except (ValueError, TypeError):
                    continue

                if emp_number not in excel_data:
                    excel_data[emp_number] = {}

                data = excel_data[emp_number]

                # Always set category from the sheet
                data['category_uuid'] = category_uuid

                if ssnit_col:
                    val = self.clean_value(row.get(ssnit_col))
                    if val:
                        data['ssnit'] = val

                if nia_col:
                    val = self.clean_value(row.get(nia_col))
                    if val:
                        data['ghana_card'] = val

                if name_col:
                    val = self.clean_value(row.get(name_col))
                    if val:
                        data['full_name'] = val

                if grade_col:
                    val = self.clean_value(row.get(grade_col))
                    if val:
                        data['grade'] = val
                        data['level_code'] = self.parse_grade(val)

                if step_col:
                    raw_step = row.get(step_col)
                    try:
                        data['step'] = int(float(raw_step)) if not pd.isna(raw_step) else 1
                    except (ValueError, TypeError):
                        data['step'] = 1

                if location_col:
                    val = self.clean_value(row.get(location_col))
                    if val:
                        data['location'] = val

                if bank_name_col:
                    val = self.clean_value(row.get(bank_name_col))
                    if val:
                        data['bank_name'] = val

                if bank_branch_col:
                    val = self.clean_value(row.get(bank_branch_col))
                    if val:
                        data['branch_name'] = val

                if bank_code_col:
                    val = self.clean_value(row.get(bank_code_col))
                    if val:
                        data['bank_code'] = val

                if branch_code_col:
                    val = self.clean_value(row.get(branch_code_col))
                    if val:
                        data['branch_code'] = val

                if account_col:
                    val = self.clean_value(row.get(account_col))
                    if val:
                        data['account_number'] = val.replace('.0', '')

                sheet_count += 1

            self.stdout.write(f'  {sheet_name}: {sheet_count} employee records')

        self.stdout.write(self.style.SUCCESS(f'\nTotal Excel data: {len(excel_data)} employees'))
        return excel_data

    # ── Phase 3: Update Employee Records ────────────────────────────

    def update_employees(self, excel_data, dry_run, verbose):
        """Update employee records from Excel data."""
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== Phase 3: Update Employee Records ==='))

        stats = {
            'matched': 0,
            'ghana_card_filled': 0,
            'ssnit_filled': 0,
            'staff_category_set': 0,
            'salary_notch_set': 0,
            'work_location_set': 0,
            'bank_account_created': 0,
            'bank_account_updated': 0,
        }
        warnings = []

        # Pre-load caches
        self.stdout.write('Building lookup caches...')

        # StaffCategory by UUID prefix
        categories = {}
        for cat in StaffCategory.objects.filter(is_deleted=False, is_active=True):
            uuid_prefix = str(cat.id)[:8]
            categories[uuid_prefix] = cat

        # WorkLocation by uppercase name
        locations = {}
        for loc in WorkLocation.objects.filter(is_deleted=False):
            locations[loc.name.upper()] = loc

        # Bank by code and by uppercase name
        banks_by_code = {}
        banks_by_name = {}
        for bank in Bank.objects.filter(is_deleted=False, is_active=True):
            banks_by_code[bank.code] = bank
            banks_by_name[bank.name.upper()] = bank

        # BankBranch by (bank_id, code)
        branches_by_key = {}
        for branch in BankBranch.objects.filter(is_deleted=False).select_related('bank'):
            key = (str(branch.bank_id), branch.code)
            branches_by_key[key] = branch

        # SalaryNotch by (level_code, notch_name)
        notches_by_key = {}
        for notch in SalaryNotch.objects.filter(is_deleted=False).select_related('level'):
            key = (notch.level.code, notch.name)
            notches_by_key[key] = notch

        self.stdout.write(f'  Categories: {len(categories)}, Locations: {len(locations)}, '
                          f'Banks: {len(banks_by_code)}, Branches: {len(branches_by_key)}, '
                          f'Notches: {len(notches_by_key)}')

        # Process employees
        employees = Employee.objects.filter(is_deleted=False).select_related(
            'staff_category', 'salary_notch', 'work_location'
        )
        self.stdout.write(f'Processing {employees.count()} employees...\n')

        for emp in employees:
            emp_number = emp.employee_number
            if emp_number not in excel_data:
                continue

            data = excel_data[emp_number]
            stats['matched'] += 1
            updated_fields = []

            # ── Ghana Card (only if missing) ──
            if not emp.ghana_card_number and data.get('ghana_card'):
                ghana_card = data['ghana_card']
                # Check uniqueness
                if not Employee.objects.filter(
                    ghana_card_number=ghana_card, is_deleted=False
                ).exclude(id=emp.id).exists():
                    if not dry_run:
                        emp.ghana_card_number = ghana_card
                    updated_fields.append('ghana_card_number')
                    stats['ghana_card_filled'] += 1
                else:
                    warnings.append(f'{emp_number}: Ghana Card {ghana_card} already assigned to another employee')

            # ── SSNIT (only if missing) ──
            if not emp.ssnit_number and data.get('ssnit'):
                ssnit = data['ssnit']
                if not Employee.objects.filter(
                    ssnit_number=ssnit, is_deleted=False
                ).exclude(id=emp.id).exists():
                    if not dry_run:
                        emp.ssnit_number = ssnit
                    updated_fields.append('ssnit_number')
                    stats['ssnit_filled'] += 1
                else:
                    warnings.append(f'{emp_number}: SSNIT {ssnit} already assigned to another employee')

            # ── Staff Category (always update) ──
            if data.get('category_uuid'):
                category = categories.get(data['category_uuid'])
                if category:
                    if emp.staff_category_id != category.id:
                        if not dry_run:
                            emp.staff_category = category
                        updated_fields.append('staff_category_id')
                        stats['staff_category_set'] += 1

            # ── Salary Notch (always update) ──
            if data.get('level_code'):
                level_code = data['level_code']
                step = data.get('step', 1)
                notch_name = f'Notch {step}'
                notch = notches_by_key.get((level_code, notch_name))
                if notch:
                    if emp.salary_notch_id != notch.id:
                        if not dry_run:
                            emp.salary_notch = notch
                        updated_fields.append('salary_notch_id')
                        stats['salary_notch_set'] += 1
                elif verbose:
                    warnings.append(f'{emp_number}: Notch not found for {level_code}/{notch_name}')

            # ── Work Location (only if different) ──
            if data.get('location'):
                loc_name = data['location'].upper()
                location = locations.get(loc_name)
                if location and emp.work_location_id != location.id:
                    if not dry_run:
                        emp.work_location = location
                    updated_fields.append('work_location_id')
                    stats['work_location_set'] += 1

            # ── Save employee fields ──
            if updated_fields and not dry_run:
                emp.save(update_fields=updated_fields)

            if verbose and updated_fields:
                self.stdout.write(f'  {emp_number}: updated {", ".join(updated_fields)}')

            # ── Bank Account ──
            if data.get('account_number') and data.get('bank_code'):
                self._handle_bank_account(
                    emp, data, banks_by_code, banks_by_name,
                    branches_by_key, stats, warnings, dry_run, verbose
                )

        # Print stats
        self.stdout.write(self.style.SUCCESS('\nEmployee update results:'))
        for key, val in stats.items():
            self.stdout.write(f'  {key}: {val}')

        if warnings:
            self.stdout.write(self.style.WARNING(f'\nWarnings ({len(warnings)}):'))
            for w in warnings[:50]:  # Cap at 50
                self.stdout.write(f'  {w}')
            if len(warnings) > 50:
                self.stdout.write(f'  ... and {len(warnings) - 50} more')

        return stats

    def _handle_bank_account(self, emp, data, banks_by_code, banks_by_name,
                             branches_by_key, stats, warnings, dry_run, verbose):
        """Find or create bank account for an employee."""
        bank_code = data.get('bank_code')
        bank_name = data.get('bank_name', '')
        branch_code = data.get('branch_code')
        account_number = data['account_number']

        # Find bank by code first, then by name
        bank = banks_by_code.get(bank_code)
        if not bank:
            bank = banks_by_name.get(bank_name.upper()) if bank_name else None
        if not bank:
            warnings.append(f'{emp.employee_number}: Bank not found for code={bank_code}, name={bank_name}')
            return

        # Find branch
        branch = None
        if branch_code:
            branch = branches_by_key.get((str(bank.id), branch_code))

        # Check for existing account
        existing_account = BankAccount.objects.filter(
            employee=emp, is_deleted=False
        ).first()

        if existing_account:
            # Update existing account if bank/branch/account changed
            changed = False
            update_fields = []

            if existing_account.bank_id != bank.id:
                if not dry_run:
                    existing_account.bank = bank
                update_fields.append('bank_id')
                changed = True

            if branch and existing_account.branch_id != branch.id:
                if not dry_run:
                    existing_account.branch = branch
                update_fields.append('branch_id')
                changed = True

            if existing_account.account_number != account_number:
                if not dry_run:
                    existing_account.account_number = account_number
                update_fields.append('account_number')
                changed = True

            # Also populate legacy fields for reference
            if bank_code and existing_account.bank_code != bank_code:
                if not dry_run:
                    existing_account.bank_code = bank_code
                update_fields.append('bank_code')
                changed = True

            if branch_code and existing_account.branch_code != branch_code:
                if not dry_run:
                    existing_account.branch_code = branch_code
                update_fields.append('branch_code')
                changed = True

            if changed:
                if not dry_run and update_fields:
                    existing_account.save(update_fields=update_fields)
                stats['bank_account_updated'] += 1
        else:
            # Create new account
            if not dry_run:
                BankAccount.objects.create(
                    employee=emp,
                    bank=bank,
                    branch=branch,
                    bank_name=bank_name,
                    bank_code=bank_code or '',
                    branch_name=data.get('branch_name', ''),
                    branch_code=branch_code or '',
                    account_name=f'{emp.first_name} {emp.last_name}',
                    account_number=account_number,
                    is_primary=True,
                    is_active=True,
                )
            stats['bank_account_created'] += 1

    # ── Phase 4: Summary Report ─────────────────────────────────────

    def print_summary(self, bank_stats, emp_stats):
        """Print final summary with remaining gaps."""
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== Final Summary ==='))

        # Remaining gaps
        self.stdout.write('\nRemaining data gaps:')
        gaps = {
            'Missing Ghana Card': Employee.objects.filter(
                is_deleted=False, ghana_card_number__isnull=True
            ).count(),
            'Missing SSNIT': Employee.objects.filter(
                is_deleted=False, ssnit_number__isnull=True
            ).count(),
            'Missing Staff Category': Employee.objects.filter(
                is_deleted=False, staff_category__isnull=True
            ).count(),
            'Missing Salary Notch': Employee.objects.filter(
                is_deleted=False, salary_notch__isnull=True
            ).count(),
            'Missing Work Location': Employee.objects.filter(
                is_deleted=False, work_location__isnull=True
            ).count(),
            'Missing Bank Account': Employee.objects.filter(
                is_deleted=False
            ).exclude(
                id__in=BankAccount.objects.filter(is_deleted=False).values_list('employee_id', flat=True)
            ).count(),
        }
        for label, count in gaps.items():
            style = self.style.WARNING if count > 0 else self.style.SUCCESS
            self.stdout.write(style(f'  {label}: {count}'))

        # Bank stats
        active_banks = Bank.objects.filter(is_active=True, is_deleted=False).count()
        total_banks = Bank.objects.filter(is_deleted=False).count()
        self.stdout.write(f'\n  Active banks: {active_banks} / {total_banks} total')

    # ── Main handle ─────────────────────────────────────────────────

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        skip_bank_merge = options['skip_bank_merge']
        skip_employee_update = options['skip_employee_update']
        verbose = options['verbose']

        if dry_run:
            self.stdout.write(self.style.WARNING('*** DRY RUN MODE - No changes will be saved ***\n'))

        bank_stats = {}
        emp_stats = {}

        with transaction.atomic():
            # Phase 1: Bank merge
            if not skip_bank_merge:
                bank_stats = self.merge_banks(dry_run, verbose)
            else:
                self.stdout.write(self.style.WARNING('\nSkipping bank merge phase'))

            # Phase 2 & 3: Read Excel and update employees
            if not skip_employee_update:
                excel_data = self.read_excel_data(verbose)
                emp_stats = self.update_employees(excel_data, dry_run, verbose)
            else:
                self.stdout.write(self.style.WARNING('\nSkipping employee update phase'))

            # Phase 4: Summary
            self.print_summary(bank_stats, emp_stats)

            if dry_run:
                self.stdout.write(self.style.WARNING('\n*** DRY RUN - Rolling back all changes ***'))
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS('\nDone.'))
