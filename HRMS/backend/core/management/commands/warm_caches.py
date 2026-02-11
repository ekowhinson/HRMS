"""
Management command to pre-warm all caches.

Usage:
    python manage.py warm_caches          # Warm core caches (org, lookups, dashboard)
    python manage.py warm_caches --reports # Also warm report view caches
"""

import logging
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Pre-warm HRMS caches with commonly used data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reports',
            action='store_true',
            help='Also warm report view caches by executing report views',
        )

    def handle(self, *args, **options):
        from core.caching import CacheManager

        self.stdout.write('Warming core caches...')

        try:
            CacheManager.warm_cache()
            self.stdout.write(self.style.SUCCESS('Core caches warmed successfully'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Core cache warming failed: {e}'))
            return

        if options['reports']:
            self._warm_report_caches()

    def _warm_report_caches(self):
        """Warm report caches by executing report views via RequestFactory."""
        from django.test import RequestFactory
        from django.contrib.auth import get_user_model
        from rest_framework.test import force_authenticate

        User = get_user_model()

        try:
            # Get an admin user for authenticated requests
            admin_user = User.objects.filter(is_superuser=True, is_active=True).first()
            if not admin_user:
                self.stdout.write(self.style.WARNING(
                    'No active superuser found - skipping report cache warming'
                ))
                return

            factory = RequestFactory()

            report_views = [
                ('reports.views', 'DashboardView', '/api/v1/reports/dashboard/'),
                ('reports.views', 'HRDashboardView', '/api/v1/reports/hr-dashboard/'),
                ('reports.views', 'PayrollDashboardView', '/api/v1/reports/payroll-dashboard/'),
                ('reports.views', 'LeaveDashboardView', '/api/v1/reports/leave-dashboard/'),
                ('reports.views', 'HeadcountReportView', '/api/v1/reports/headcount/'),
                ('reports.views', 'DemographicsReportView', '/api/v1/reports/demographics/'),
            ]

            warmed = 0
            for module_name, view_name, path in report_views:
                try:
                    import importlib
                    module = importlib.import_module(module_name)
                    view_class = getattr(module, view_name)

                    request = factory.get(path)
                    force_authenticate(request, user=admin_user)

                    # Use as_view() so DRF renders the response properly
                    view_func = view_class.as_view()
                    response = view_func(request)
                    response.render()
                    warmed += 1
                except Exception as e:
                    self.stdout.write(self.style.WARNING(
                        f'  Failed to warm {view_name}: {e}'
                    ))

            self.stdout.write(self.style.SUCCESS(
                f'Report caches warmed: {warmed}/{len(report_views)} views'
            ))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Report cache warming failed: {e}'))
