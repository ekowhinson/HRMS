"""
Management command to seed default HRMS core values.
"""

from django.core.management.base import BaseCommand

from performance.models import CoreValue


class Command(BaseCommand):
    help = 'Seed default HRMS core values for appraisal assessments'

    CORE_VALUES = [
        {
            'code': 'INT',
            'name': 'Integrity',
            'description': 'Acting with honesty, transparency, and ethical standards in all dealings. '
                           'Maintaining high moral principles and professional ethics.',
            'behavioral_indicators': (
                '- Demonstrates honesty in all communications and transactions\n'
                '- Takes responsibility for mistakes and works to correct them\n'
                '- Maintains confidentiality of sensitive information\n'
                '- Adheres to organizational policies and ethical guidelines\n'
                '- Reports unethical behavior or violations appropriately'
            ),
            'sort_order': 1
        },
        {
            'code': 'CUST',
            'name': 'Customer Focus',
            'description': 'Placing the needs of beneficiaries, members, and stakeholders at the center '
                           'of all activities. Striving to exceed expectations in service delivery.',
            'behavioral_indicators': (
                '- Responds promptly to customer inquiries and concerns\n'
                '- Seeks feedback and uses it to improve service\n'
                '- Goes the extra mile to resolve customer issues\n'
                '- Treats all customers with respect and courtesy\n'
                '- Anticipates customer needs and provides proactive solutions'
            ),
            'sort_order': 2
        },
        {
            'code': 'TEAM',
            'name': 'Teamwork',
            'description': 'Working collaboratively with colleagues to achieve shared goals. '
                           'Supporting team members and contributing to a positive work environment.',
            'behavioral_indicators': (
                '- Collaborates effectively with colleagues across departments\n'
                '- Shares knowledge and resources willingly\n'
                '- Supports team decisions even when personally disagreeing\n'
                '- Contributes positively to team meetings and discussions\n'
                '- Helps colleagues when they face challenges'
            ),
            'sort_order': 3
        },
        {
            'code': 'ACC',
            'name': 'Accountability',
            'description': 'Taking ownership of responsibilities and being answerable for outcomes. '
                           'Meeting deadlines and delivering on commitments.',
            'behavioral_indicators': (
                '- Takes ownership of assigned tasks and sees them through\n'
                '- Meets deadlines consistently without excuses\n'
                '- Accepts responsibility for both successes and failures\n'
                '- Follows through on commitments made to colleagues and stakeholders\n'
                '- Uses resources efficiently and reports on their utilization'
            ),
            'sort_order': 4
        },
        {
            'code': 'EXC',
            'name': 'Excellence',
            'description': 'Striving for the highest standards in all work. '
                           'Continuously improving performance and seeking innovative solutions.',
            'behavioral_indicators': (
                '- Produces high-quality work that meets or exceeds standards\n'
                '- Continuously seeks ways to improve processes and outcomes\n'
                '- Stays current with best practices and industry developments\n'
                '- Takes initiative to solve problems and improve efficiency\n'
                '- Demonstrates attention to detail in all work'
            ),
            'sort_order': 5
        },
    ]

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Update existing core values with new data',
        )

    def handle(self, *args, **options):
        force_update = options.get('force', False)
        created_count = 0
        updated_count = 0
        skipped_count = 0

        self.stdout.write('Seeding HRMS core values...\n')

        for value_data in self.CORE_VALUES:
            code = value_data['code']

            existing = CoreValue.objects.filter(code=code).first()

            if existing:
                if force_update:
                    for key, val in value_data.items():
                        setattr(existing, key, val)
                    existing.save()
                    updated_count += 1
                    self.stdout.write(f'  Updated: {code} - {value_data["name"]}')
                else:
                    skipped_count += 1
                    self.stdout.write(f'  Skipped (exists): {code} - {value_data["name"]}')
            else:
                CoreValue.objects.create(**value_data)
                created_count += 1
                self.stdout.write(self.style.SUCCESS(
                    f'  Created: {code} - {value_data["name"]}'
                ))

        self.stdout.write('\nSummary:')
        self.stdout.write(f'  Created: {created_count}')
        self.stdout.write(f'  Updated: {updated_count}')
        self.stdout.write(f'  Skipped: {skipped_count}')

        self.stdout.write(self.style.SUCCESS('\nCore values seeding complete!'))
