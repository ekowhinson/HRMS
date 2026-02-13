"""
Management command to set up an organization with statutory and sample data.
"""

from django.core.management.base import BaseCommand, CommandError

from organization.models import Organization
from organization.setup import setup_organization


class Command(BaseCommand):
    help = 'Set up an organization with statutory data, lookup tables, and sample structures'

    def add_arguments(self, parser):
        group = parser.add_mutually_exclusive_group(required=True)
        group.add_argument(
            '--org-code',
            type=str,
            help='Organization code (e.g., ORG001)',
        )
        group.add_argument(
            '--org-id',
            type=str,
            help='Organization UUID',
        )
        parser.add_argument(
            '--modules',
            type=str,
            default='',
            help='Comma-separated list of modules to seed (default: all). '
                 'Options: roles, organization, payroll, leave, benefits, '
                 'performance, discipline, workflow, recruitment',
        )
        parser.add_argument(
            '--year',
            type=int,
            default=None,
            help='Year for payroll calendar and holidays (default: current year)',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Re-run setup even if already completed',
        )

    def handle(self, *args, **options):
        # Find the organization
        if options['org_code']:
            try:
                org = Organization.objects.get(code=options['org_code'])
            except Organization.DoesNotExist:
                raise CommandError(
                    f'Organization with code "{options["org_code"]}" not found'
                )
        else:
            try:
                org = Organization.objects.get(id=options['org_id'])
            except Organization.DoesNotExist:
                raise CommandError(
                    f'Organization with ID "{options["org_id"]}" not found'
                )

        # Check if already set up
        if org.setup_completed and not options['force']:
            self.stdout.write(self.style.WARNING(
                f'Organization "{org.name}" ({org.code}) has already been set up. '
                f'Use --force to re-run.'
            ))
            return

        # Parse modules
        modules = None
        if options['modules']:
            modules = [m.strip() for m in options['modules'].split(',')]

        self.stdout.write(self.style.SUCCESS(
            f'\nSetting up organization: {org.name} ({org.code})'
        ))
        if modules:
            self.stdout.write(f'  Modules: {", ".join(modules)}')
        else:
            self.stdout.write('  Modules: ALL')

        # Run setup
        result = setup_organization(
            org=org,
            modules=modules,
            year=options['year'],
            stdout=self.stdout,
            style=self.style,
        )

        # Print summary
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write(self.style.SUCCESS('SETUP COMPLETE'))
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write(f'  Total created: {result["total_created"]}')
        self.stdout.write(f'  Total updated: {result["total_updated"]}')
        self.stdout.write('')

        for module, stats in result['results'].items():
            self.stdout.write(
                f'  {module:20s} created={stats["created"]:3d}  '
                f'updated={stats["updated"]:3d}  skipped={stats["skipped"]:3d}'
            )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Organization "{org.name}" setup completed successfully!'
        ))
