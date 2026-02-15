"""
Management command to backfill UserOrganization records for existing users.

Users who have an organization set but no UserOrganization membership record
will get one created automatically.

Usage:
    python manage.py backfill_user_organizations
    python manage.py backfill_user_organizations --dry-run
"""

from django.core.management.base import BaseCommand
from accounts.models import User, UserOrganization


class Command(BaseCommand):
    help = 'Backfill missing UserOrganization records for users with an organization set'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        created = 0
        skipped = 0

        users = User.objects.filter(organization__isnull=False).select_related('organization')

        for user in users:
            exists = UserOrganization.objects.filter(
                user=user, organization=user.organization
            ).exists()
            if exists:
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(
                    f'  Would create: {user.email} -> {user.organization.name}'
                )
            else:
                UserOrganization.objects.create(
                    user=user,
                    organization=user.organization,
                    role='member',
                    is_default=True,
                )
            created += 1

        prefix = '[DRY RUN] ' if dry_run else ''
        self.stdout.write(self.style.SUCCESS(
            f'{prefix}Done. Created: {created}, Skipped (already exist): {skipped}'
        ))
