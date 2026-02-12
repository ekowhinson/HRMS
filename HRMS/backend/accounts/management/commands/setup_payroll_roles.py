"""
Management command to create PAYROLL_DATA_ENTRY role and set up
user accounts for Financial Accounting employees.

Usage:
    python manage.py setup_payroll_roles
"""

import os

from django.core.management.base import BaseCommand
from accounts.models import User, Role, UserRole
from employees.models import Employee


# Employee assignments:
# PAYROLL_DATA_ENTRY users (can create/edit upgrade requests, cannot approve)
DATA_ENTRY_EMPLOYEES = [
    {'employee_number': '10537', 'name': 'Eric Acheampong'},
    {'employee_number': '24471', 'name': 'Emelia Norteye'},
]

# PAYROLL_ADMIN users (can approve/reject, cannot create entries)
PAYROLL_ADMIN_EMPLOYEES = [
    {'employee_number': '24472', 'name': 'Lucy Twum-Barimah'},
    {'employee_number': '24484', 'name': 'Stanley Otabil-Donkoh'},
]

DEFAULT_PASSWORD = 'Hrms@2026!'


class Command(BaseCommand):
    help = 'Create PAYROLL_DATA_ENTRY role and user accounts for Financial Accounting employees'

    def handle(self, *args, **options):
        # 1. Create PAYROLL_DATA_ENTRY role if it doesn't exist
        role_de, created = Role.objects.get_or_create(
            code='PAYROLL_DATA_ENTRY',
            defaults={
                'name': 'Payroll Data Entry',
                'description': 'Can create and edit salary upgrade requests but cannot approve or reject them.',
                'is_system_role': True,
                'is_active': True,
                'level': 30,
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created role: {role_de.name} (code={role_de.code})'))
        else:
            self.stdout.write(f'Role already exists: {role_de.name}')

        # 2. Ensure PAYROLL_ADMIN role exists
        role_admin, created = Role.objects.get_or_create(
            code='PAYROLL_ADMIN',
            defaults={
                'name': 'Payroll Admin',
                'description': 'Can approve or reject salary upgrade requests but cannot create them.',
                'is_system_role': True,
                'is_active': True,
                'level': 40,
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created role: {role_admin.name}'))
        else:
            self.stdout.write(f'Role already exists: {role_admin.name}')

        # 3. Create user accounts and assign roles
        self._setup_users(DATA_ENTRY_EMPLOYEES, role_de, 'PAYROLL_DATA_ENTRY')
        self._setup_users(PAYROLL_ADMIN_EMPLOYEES, role_admin, 'PAYROLL_ADMIN')

        self.stdout.write(self.style.SUCCESS('\nSetup complete.'))

    def _setup_users(self, employee_list, role, role_label):
        for emp_info in employee_list:
            emp_number = emp_info['employee_number']
            try:
                employee = Employee.objects.get(employee_number=emp_number)
            except Employee.DoesNotExist:
                self.stdout.write(self.style.WARNING(
                    f'  Employee {emp_number} ({emp_info["name"]}) not found — skipping.'
                ))
                continue

            # Determine email
            email = employee.work_email or employee.personal_email
            if not email:
                email = f'{employee.first_name.lower()}.{employee.last_name.lower()}{os.getenv("ORG_EMAIL_DOMAIN", "@example.com")}'

            # Create or get user
            user, user_created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': employee.first_name,
                    'last_name': employee.last_name,
                    'is_active': True,
                    'is_verified': True,
                    'must_change_password': True,
                },
            )
            if user_created:
                user.set_password(DEFAULT_PASSWORD)
                user.save()
                self.stdout.write(self.style.SUCCESS(
                    f'  Created user: {user.email} (password: {DEFAULT_PASSWORD})'
                ))
            else:
                self.stdout.write(f'  User already exists: {user.email}')

            # Link user to employee
            if not employee.user_id:
                employee.user = user
                employee.save(update_fields=['user'])
                self.stdout.write(f'    Linked to employee {emp_number}')
            elif str(employee.user_id) != str(user.id):
                self.stdout.write(self.style.WARNING(
                    f'    Employee {emp_number} already linked to a different user — skipping link.'
                ))

            # Assign role
            ur, ur_created = UserRole.objects.get_or_create(
                user=user,
                role=role,
                defaults={
                    'scope_type': 'global',
                    'is_primary': True,
                    'is_active': True,
                },
            )
            if ur_created:
                self.stdout.write(self.style.SUCCESS(
                    f'    Assigned role: {role_label}'
                ))
            else:
                self.stdout.write(f'    Role {role_label} already assigned')
