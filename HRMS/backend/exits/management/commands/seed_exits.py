"""
Management command to seed default exit types and clearance departments.
"""

from django.core.management.base import BaseCommand
from exits.models import ExitType, ClearanceDepartment


class Command(BaseCommand):
    help = 'Seeds default exit types and clearance departments'

    def handle(self, *args, **options):
        self.stdout.write('Seeding exit types and clearance departments...')

        # Exit Types
        exit_types = [
            {
                'code': 'RESIGNATION',
                'name': 'Resignation',
                'description': 'Voluntary resignation by employee',
                'requires_notice': True,
                'notice_period_days': 30,
                'requires_exit_interview': True,
                'requires_clearance': True,
                'sort_order': 1,
            },
            {
                'code': 'RETIREMENT',
                'name': 'Retirement',
                'description': 'Retirement at end of service',
                'requires_notice': True,
                'notice_period_days': 90,
                'requires_exit_interview': True,
                'requires_clearance': True,
                'sort_order': 2,
            },
            {
                'code': 'TERMINATION',
                'name': 'Termination',
                'description': 'Termination of employment by organization',
                'requires_notice': False,
                'notice_period_days': 0,
                'requires_exit_interview': False,
                'requires_clearance': True,
                'sort_order': 3,
            },
            {
                'code': 'END_OF_CONTRACT',
                'name': 'End of Contract',
                'description': 'Contract period ended without renewal',
                'requires_notice': True,
                'notice_period_days': 14,
                'requires_exit_interview': True,
                'requires_clearance': True,
                'sort_order': 4,
            },
            {
                'code': 'REDUNDANCY',
                'name': 'Redundancy',
                'description': 'Position made redundant',
                'requires_notice': True,
                'notice_period_days': 30,
                'requires_exit_interview': True,
                'requires_clearance': True,
                'sort_order': 5,
            },
            {
                'code': 'DEATH',
                'name': 'Death in Service',
                'description': 'Employee deceased while in service',
                'requires_notice': False,
                'notice_period_days': 0,
                'requires_exit_interview': False,
                'requires_clearance': True,
                'sort_order': 6,
            },
            {
                'code': 'DISMISSAL',
                'name': 'Dismissal',
                'description': 'Dismissal for misconduct or cause',
                'requires_notice': False,
                'notice_period_days': 0,
                'requires_exit_interview': False,
                'requires_clearance': True,
                'sort_order': 7,
            },
            {
                'code': 'TRANSFER',
                'name': 'Transfer Out',
                'description': 'Transfer to another organization/agency',
                'requires_notice': True,
                'notice_period_days': 30,
                'requires_exit_interview': True,
                'requires_clearance': True,
                'sort_order': 8,
            },
        ]

        for et_data in exit_types:
            exit_type, created = ExitType.objects.update_or_create(
                code=et_data['code'],
                defaults=et_data
            )
            status = 'Created' if created else 'Updated'
            self.stdout.write(f'  {status}: {exit_type.name}')

        # Clearance Departments
        clearance_depts = [
            {
                'code': 'HR',
                'name': 'Human Resources',
                'description': 'HR department clearance',
                'checklist_items': '''ID Card returned
Access card/keys returned
Personnel file updated
Exit interview completed
Final leave balance calculated
Handover notes received''',
                'responsible_role': 'HR Officer',
                'is_required': True,
                'sort_order': 1,
            },
            {
                'code': 'IT',
                'name': 'Information Technology',
                'description': 'IT department clearance',
                'checklist_items': '''Laptop/computer returned
Email account disabled
System access revoked
Phone/mobile device returned
Software licenses transferred
Data backup completed''',
                'responsible_role': 'IT Officer',
                'is_required': True,
                'sort_order': 2,
            },
            {
                'code': 'FINANCE',
                'name': 'Finance',
                'description': 'Finance department clearance',
                'checklist_items': '''Outstanding advances cleared
Loan balances calculated
Expense claims settled
Credit card returned
Petty cash balanced
Bank details confirmed for settlement''',
                'responsible_role': 'Finance Officer',
                'is_required': True,
                'sort_order': 3,
            },
            {
                'code': 'ADMIN',
                'name': 'Administration',
                'description': 'Admin department clearance',
                'checklist_items': '''Office keys returned
Parking card returned
Furniture/equipment returned
Building access removed
Company vehicle returned
Fuel card returned''',
                'responsible_role': 'Admin Officer',
                'is_required': True,
                'sort_order': 4,
            },
            {
                'code': 'DIRECT_SUPV',
                'name': 'Direct Supervisor',
                'description': 'Direct supervisor clearance',
                'checklist_items': '''Work handover completed
Ongoing projects documented
Team briefed
Knowledge transfer done
Client contacts handed over''',
                'responsible_role': 'Supervisor',
                'is_required': True,
                'sort_order': 5,
            },
            {
                'code': 'DEPT_HEAD',
                'name': 'Department Head',
                'description': 'Department head clearance',
                'checklist_items': '''No outstanding work
Departmental assets returned
Department files updated
Successor identified''',
                'responsible_role': 'Department Head',
                'is_required': True,
                'sort_order': 6,
            },
            {
                'code': 'LIBRARY',
                'name': 'Library/Resource Center',
                'description': 'Library clearance',
                'checklist_items': '''Books returned
Fines cleared
Resource materials returned''',
                'responsible_role': 'Librarian',
                'is_required': False,
                'sort_order': 7,
            },
            {
                'code': 'SECURITY',
                'name': 'Security',
                'description': 'Security department clearance',
                'checklist_items': '''Access badges returned
Security clearance revoked
Biometric data removed
Vehicle permit returned''',
                'responsible_role': 'Security Officer',
                'is_required': True,
                'sort_order': 8,
            },
        ]

        for cd_data in clearance_depts:
            dept, created = ClearanceDepartment.objects.update_or_create(
                code=cd_data['code'],
                defaults=cd_data
            )
            status = 'Created' if created else 'Updated'
            self.stdout.write(f'  {status}: {dept.name}')

        self.stdout.write(self.style.SUCCESS('\nSuccessfully seeded exit data!'))
