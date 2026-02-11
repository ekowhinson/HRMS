"""
Management command to seed Ghana bank sort codes into the database.

Reads from ghana_bank_sort_codes.csv and populates Bank and BankBranch models.

Usage:
    python manage.py seed_banks
    python manage.py seed_banks --clear
    python manage.py seed_banks --csv /path/to/file.csv
"""

import csv
import os

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Region
from payroll.models import Bank, BankBranch


# SWIFT codes for Ghana banks (from Bank of Ghana directory)
BANK_SWIFT_CODES = {
    '01': 'BAGHGHAC',   # Bank of Ghana
    '02': 'SCBLGHAC',   # Standard Chartered
    '03': 'BARCGHAC',   # ABSA/Barclays
    '04': 'GHCBGHAC',   # GCB Bank
    '05': 'NIBGGHAC',   # NIB
    '06': 'STBGGHAC',   # UBA
    '07': 'AREXGHAC',   # Apex Bank
    '08': 'ADNTGHAC',   # ADB
    '09': 'SSEBGHAC',   # Societe Generale
    '10': 'MBGHGHAC',   # UMB
    '11': 'HFCAGHAC',   # Republic Bank
    '12': 'ZEBLGHAC',   # Zenith Bank
    '13': 'ECOCGHAC',   # Ecobank
    '14': 'ACCCGHAC',   # CalBank
    '16': 'MTALGHAC',   # UT Bank
    '17': 'FAMCGHAC',   # First Atlantic
    '18': 'PUBKGHAC',   # Prudential Bank
    '19': 'SBICGHAC',   # Stanbic Bank
    '21': 'AMMAGHAC',   # OmniBSIC
    '22': 'UBGHGHAC',   # GT Bank
    '23': 'GTBIGHAC',   # Guaranty Trust
    '24': 'FBLIGHAC',   # Fidelity Bank
    '26': 'BARBGHAC',   # Bank of Baroda
    '27': 'BSAHGHAC',   # BSIC Ghana
    '28': 'ABNGGHAC',   # Access Bank
    '29': 'ENRBGHAC',   # Energy Bank
    '34': 'CBGHGHAC',   # Consolidated Bank
}

# CSV region name → DB region name aliases
REGION_ALIASES = {
    'greater accra': 'gr. accra',
}


class Command(BaseCommand):
    help = 'Seed Ghana bank and branch data from sort codes CSV'

    def add_arguments(self, parser):
        parser.add_argument(
            '--csv',
            type=str,
            default=None,
            help='Path to CSV file (default: ghana_bank_sort_codes.csv in project root)'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing bank and branch data before seeding'
        )

    def handle(self, *args, **options):
        csv_path = options['csv']
        if not csv_path:
            # Default: project root (two levels up from HRMS/backend/)
            project_root = os.path.dirname(os.path.dirname(str(settings.BASE_DIR)))
            csv_path = os.path.join(project_root, 'ghana_bank_sort_codes.csv')

        if not os.path.exists(csv_path):
            self.stderr.write(self.style.ERROR(f'CSV file not found: {csv_path}'))
            return

        self.stdout.write(f'Reading CSV: {csv_path}')

        # Read CSV
        rows = []
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(row)

        self.stdout.write(f'Found {len(rows)} branch records')

        # Build region cache (case-insensitive)
        region_cache = {}
        for region in Region.objects.filter(is_active=True):
            region_cache[region.name.lower()] = region

        # Collect unique banks
        banks_data = {}
        for row in rows:
            bank_code = row['Bank Code'].strip().zfill(2)
            if bank_code not in banks_data:
                banks_data[bank_code] = row['Bank Name'].strip()

        self.stdout.write(f'Found {len(banks_data)} unique banks')

        if options['clear']:
            self.stdout.write(self.style.WARNING('Clearing existing bank branch and bank data...'))
            BankBranch.all_objects.all().delete()
            Bank.all_objects.all().delete()
            self.stdout.write(self.style.SUCCESS('Cleared.'))

        # Seed data in a transaction
        with transaction.atomic():
            banks_created = 0
            banks_updated = 0
            branches_created = 0
            branches_updated = 0
            region_misses = set()

            # Create/update banks
            bank_objects = {}
            for bank_code, bank_name in sorted(banks_data.items()):
                swift_code = BANK_SWIFT_CODES.get(bank_code)
                bank, created = Bank.objects.update_or_create(
                    code=bank_code,
                    defaults={
                        'name': bank_name.title(),
                        'swift_code': swift_code,
                        'is_active': True,
                    }
                )
                bank_objects[bank_code] = bank
                if created:
                    banks_created += 1
                else:
                    banks_updated += 1

            self.stdout.write(f'Banks: {banks_created} created, {banks_updated} updated')

            # Create/update branches
            for row in rows:
                sort_code = row['Sort Code'].strip()
                bank_code = row['Bank Code'].strip().zfill(2)
                branch_name = row['Branch Name'].strip()
                region_name = row.get('Region/Zone', '').strip()

                bank = bank_objects[bank_code]

                # Lookup region (case-insensitive, then alias, then partial match)
                region = None
                if region_name:
                    name_lower = region_name.lower()
                    region = region_cache.get(name_lower)
                    if not region:
                        # Try alias mapping
                        alias = REGION_ALIASES.get(name_lower)
                        if alias:
                            region = region_cache.get(alias)
                    if not region:
                        # Try partial match
                        for key, reg in region_cache.items():
                            if name_lower in key or key in name_lower:
                                region = reg
                                break
                        if not region:
                            region_misses.add(region_name)

                _, created = BankBranch.objects.update_or_create(
                    bank=bank,
                    code=sort_code,
                    defaults={
                        'name': branch_name,
                        'sort_code': sort_code,
                        'region': region,
                        'is_active': True,
                    }
                )
                if created:
                    branches_created += 1
                else:
                    branches_updated += 1

        # Summary
        self.stdout.write('')
        self.stdout.write('=' * 50)
        self.stdout.write(self.style.SUCCESS('Seed complete!'))
        self.stdout.write(f'  Banks:    {banks_created} created, {banks_updated} updated')
        self.stdout.write(f'  Branches: {branches_created} created, {branches_updated} updated')
        self.stdout.write(f'  Total banks in DB:    {Bank.objects.count()}')
        self.stdout.write(f'  Total branches in DB: {BankBranch.objects.count()}')

        if region_misses:
            self.stdout.write('')
            self.stdout.write(self.style.WARNING(
                f'Could not match {len(region_misses)} region(s): {", ".join(sorted(region_misses))}'
            ))
            self.stdout.write('These branches were created without a region link.')
