"""
Management command to populate the modules field on existing Role records.

Run once after the migration that adds Role.modules:
    python manage.py seed_role_modules
"""

from django.core.management.base import BaseCommand
from accounts.models import Role


ALL_MODULES = list(Role.VALID_MODULES)

ROLE_MODULE_MAP = {
    # Super-admins — everything
    'SUPER_ADMIN': ALL_MODULES,
    'ADMIN': ALL_MODULES,
    'SUPERUSER': ALL_MODULES,

    # Org admin
    'ORG_ADMIN': ['hr', 'payroll', 'administration'],

    # HR family
    'HR': ['hr'],
    'HR_ADMIN': ['hr'],
    'HR_MANAGER': ['hr'],
    'HR_OFFICER': ['hr'],
    'HR_DIRECTOR': ['hr'],

    # Payroll family
    'PAYROLL_ADMIN': ['payroll', 'payroll_setup'],
    'PAYROLL_MANAGER': ['payroll', 'payroll_setup'],
    'PAYROLL_OFFICER': ['payroll'],
    'PAYROLL_DATA_ENTRY': ['payroll'],

    # Finance family
    'CFO': ['finance'],
    'FINANCE_MANAGER': ['finance'],
    'FINANCE_DIRECTOR': ['finance'],
    'ACCOUNTANT': ['finance'],
    'AP_CLERK': ['finance'],
    'BUDGET_OFFICER': ['finance'],

    # Procurement
    'PROCUREMENT_MANAGER': ['procurement'],
    'PROCUREMENT_OFFICER': ['procurement'],

    # Inventory / Assets
    'STORES_MANAGER': ['inventory'],
    'STORES_OFFICER': ['inventory'],
    'ASSET_MANAGER': ['inventory'],

    # Projects
    'PROJECT_MANAGER': ['projects'],

    # Manufacturing
    'MANUFACTURING_MANAGER': ['manufacturing'],
    'PRODUCTION_SUPERVISOR': ['manufacturing'],
    'QUALITY_INSPECTOR': ['manufacturing'],

    # Self-service only (no modules)
    'EMPLOYEE': [],
    'SUPERVISOR': [],
    'DEPARTMENT_HEAD': [],
}


class Command(BaseCommand):
    help = 'Populate the modules field on existing roles based on role code.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without writing to the database.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        updated = 0
        skipped = 0

        for role in Role.objects.all():
            modules = ROLE_MODULE_MAP.get(role.code.upper())
            if modules is None:
                self.stdout.write(
                    self.style.WARNING(f'  SKIP  {role.code} — no mapping defined')
                )
                skipped += 1
                continue

            if role.modules == modules:
                self.stdout.write(f'  OK    {role.code} — already up to date')
                continue

            if dry_run:
                self.stdout.write(
                    self.style.NOTICE(
                        f'  DRY   {role.code} — would set modules={modules}'
                    )
                )
            else:
                role.modules = modules
                role.save(update_fields=['modules'])
                self.stdout.write(
                    self.style.SUCCESS(f'  SET   {role.code} → {modules}')
                )
            updated += 1

        verb = 'Would update' if dry_run else 'Updated'
        self.stdout.write(
            self.style.SUCCESS(
                f'\nDone. {verb} {updated} role(s), skipped {skipped}.'
            )
        )
