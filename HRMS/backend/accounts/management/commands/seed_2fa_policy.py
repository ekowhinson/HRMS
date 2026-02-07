"""
Management command to seed default 2FA policy configuration.
Safe to run multiple times (uses get_or_create).
"""

from django.core.management.base import BaseCommand
from core.models import SystemConfiguration


class Command(BaseCommand):
    help = 'Seed default 2FA policy into SystemConfiguration'

    DEFAULTS = [
        {
            'key': 'tfa_enforcement',
            'value': 'optional',
            'value_type': 'string',
            'description': '2FA enforcement level: optional, required, or required_admins',
            'category': 'security',
        },
        {
            'key': 'tfa_allowed_methods',
            'value': '["EMAIL","SMS","TOTP"]',
            'value_type': 'json',
            'description': 'Allowed 2FA methods',
            'category': 'security',
        },
        {
            'key': 'tfa_grace_period_days',
            'value': '7',
            'value_type': 'integer',
            'description': 'Days new users have to set up 2FA when enforcement is enabled',
            'category': 'security',
        },
    ]

    def handle(self, *args, **options):
        for item in self.DEFAULTS:
            obj, created = SystemConfiguration.objects.get_or_create(
                key=item['key'],
                defaults={
                    'value': item['value'],
                    'value_type': item['value_type'],
                    'description': item['description'],
                    'category': item['category'],
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created: {item["key"]} = {item["value"]}'))
            else:
                self.stdout.write(f'Already exists: {item["key"]} = {obj.value}')

        self.stdout.write(self.style.SUCCESS('2FA policy seeding complete.'))
