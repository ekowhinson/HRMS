"""
Roles seeder: ERP roles and permissions.
Global (not tenant-scoped since Role/Permission use TimeStampedModel, not BaseModel).
"""

from .base import BaseSeeder


class RolesSeeder(BaseSeeder):
    module_name = 'roles'

    def seed(self):
        self._seed_roles()
        return self.stats

    def _seed_roles(self):
        from accounts.models import Role

        roles = [
            {'code': 'SUPER_ADMIN', 'name': 'Super Administrator', 'level': 100, 'description': 'Full system access', 'is_system_role': True},
            {'code': 'ORG_ADMIN', 'name': 'Organization Admin', 'level': 90, 'description': 'Organization-level administrator', 'is_system_role': True},
            {'code': 'HR_DIRECTOR', 'name': 'HR Director', 'level': 80, 'description': 'Head of HR department', 'is_system_role': True},
            {'code': 'HR_MANAGER', 'name': 'HR Manager', 'level': 70, 'description': 'HR Manager with full HR module access', 'is_system_role': True},
            {'code': 'HR_OFFICER', 'name': 'HR Officer', 'level': 60, 'description': 'HR Officer with operational HR access', 'is_system_role': True},
            {'code': 'FINANCE_DIRECTOR', 'name': 'Finance Director', 'level': 80, 'description': 'Head of Finance', 'is_system_role': True},
            {'code': 'PAYROLL_MANAGER', 'name': 'Payroll Manager', 'level': 70, 'description': 'Payroll processing and management', 'is_system_role': True},
            {'code': 'PAYROLL_OFFICER', 'name': 'Payroll Officer', 'level': 60, 'description': 'Payroll data entry and processing', 'is_system_role': True},
            {'code': 'DEPARTMENT_HEAD', 'name': 'Department Head', 'level': 50, 'description': 'Department head with team management', 'is_system_role': True},
            {'code': 'LINE_MANAGER', 'name': 'Line Manager', 'level': 40, 'description': 'Line manager/supervisor', 'is_system_role': True},
            {'code': 'EMPLOYEE', 'name': 'Employee', 'level': 10, 'description': 'Regular employee with self-service access', 'is_system_role': True},
        ]

        for data in roles:
            code = data.pop('code')
            self._get_or_create_global(Role, {'code': code}, data)
