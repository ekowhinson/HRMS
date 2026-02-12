"""
Management command to seed ERP roles and granular permissions.

Usage:
    python manage.py seed_erp_roles          # Create roles & permissions
    python manage.py seed_erp_roles --clear  # Remove then re-seed
"""

from django.core.management.base import BaseCommand
from accounts.models import Role, Permission, RolePermission


# Permissions grouped by module
PERMISSIONS_BY_MODULE = {
    'finance': [
        ('finance.gl.create', 'Create Journal Entry', 'Create GL journal entries'),
        ('finance.gl.view', 'View Journal Entries', 'View GL journal entries'),
        ('finance.gl.post', 'Post Journal Entry', 'Post/approve journal entries'),
        ('finance.gl.reverse', 'Reverse Journal Entry', 'Reverse posted journal entries'),
        ('finance.gl.close_period', 'Close Fiscal Period', 'Close fiscal periods'),
        ('finance.ap.create', 'Create AP Invoice', 'Create vendor invoices'),
        ('finance.ap.view', 'View AP Invoices', 'View vendor invoices'),
        ('finance.ap.process', 'Process AP Payment', 'Process vendor payments'),
        ('finance.ap.approve', 'Approve AP Payment', 'Approve vendor payments'),
        ('finance.ar.create', 'Create AR Invoice', 'Create customer invoices'),
        ('finance.ar.view', 'View AR Invoices', 'View customer invoices'),
        ('finance.ar.process', 'Process AR Receipt', 'Process customer receipts'),
        ('finance.ar.approve', 'Approve AR Receipt', 'Approve customer receipts'),
        ('finance.budget.create', 'Create Budget', 'Create budget entries'),
        ('finance.budget.view', 'View Budgets', 'View budget records'),
        ('finance.budget.approve', 'Approve Budget', 'Approve budget entries'),
        ('finance.budget.transfer', 'Transfer Budget', 'Transfer between budget lines'),
        ('finance.reports.view', 'View Financial Reports', 'View financial statements and reports'),
        ('finance.vendor.create', 'Create Vendor', 'Create vendor records'),
        ('finance.vendor.manage', 'Manage Vendors', 'Edit/deactivate vendor records'),
    ],
    'procurement': [
        ('procurement.requisition.create', 'Create Requisition', 'Create purchase requisitions'),
        ('procurement.requisition.approve', 'Approve Requisition', 'Approve purchase requisitions'),
        ('procurement.requisition.view', 'View Requisitions', 'View purchase requisitions'),
        ('procurement.po.create', 'Create PO', 'Create purchase orders'),
        ('procurement.po.approve', 'Approve PO', 'Approve purchase orders'),
        ('procurement.po.view', 'View POs', 'View purchase orders'),
        ('procurement.po.close', 'Close PO', 'Close purchase orders'),
        ('procurement.grn.create', 'Create GRN', 'Create goods receipt notes'),
        ('procurement.grn.view', 'View GRNs', 'View goods receipt notes'),
        ('procurement.grn.accept', 'Accept GRN', 'Accept/reject goods receipt notes'),
        ('procurement.rfq.create', 'Create RFQ', 'Create requests for quotation'),
        ('procurement.rfq.manage', 'Manage RFQs', 'Manage RFQ process'),
        ('procurement.vendor_eval', 'Evaluate Vendors', 'Evaluate vendor performance'),
    ],
    'inventory': [
        ('inventory.receipt.create', 'Create Stock Receipt', 'Record stock receipts'),
        ('inventory.issue.create', 'Create Stock Issue', 'Record stock issues'),
        ('inventory.transfer.create', 'Create Stock Transfer', 'Create stock transfers'),
        ('inventory.adjustment.create', 'Create Adjustment', 'Create stock adjustments'),
        ('inventory.cycle_count.perform', 'Perform Cycle Count', 'Conduct inventory cycle counts'),
        ('inventory.cycle_count.approve', 'Approve Cycle Count', 'Approve cycle count results'),
        ('inventory.warehouse.manage', 'Manage Warehouses', 'Create/edit warehouses'),
        ('inventory.item.manage', 'Manage Items', 'Create/edit inventory items'),
        ('inventory.asset.register', 'Register Asset', 'Register fixed assets'),
        ('inventory.asset.view', 'View Assets', 'View asset register'),
        ('inventory.asset.transfer', 'Transfer Asset', 'Transfer asset custodianship'),
        ('inventory.asset.dispose', 'Dispose Asset', 'Dispose/retire assets'),
        ('inventory.asset.approve_disposal', 'Approve Asset Disposal', 'Approve asset disposals'),
        ('inventory.reports.view', 'View Inventory Reports', 'View inventory reports'),
    ],
    'payroll': [
        ('payroll.process', 'Process Payroll', 'Run payroll computation'),
        ('payroll.approve', 'Approve Payroll', 'Approve computed payroll'),
        ('payroll.view', 'View Payroll', 'View payroll records'),
        ('payroll.manage_deductions', 'Manage Deductions', 'Configure deductions'),
        ('payroll.manage_allowances', 'Manage Allowances', 'Configure allowances'),
        ('payroll.view_payslips', 'View Payslips', 'View employee payslips'),
        ('payroll.manage_tax', 'Manage Tax Settings', 'Configure tax rules'),
        ('payroll.generate_statutory', 'Generate Statutory Reports', 'SSNIT/tax/provident reports'),
    ],
    'projects': [
        ('projects.create', 'Create Project', 'Create new projects'),
        ('projects.view', 'View Projects', 'View project details'),
        ('projects.edit', 'Edit Project', 'Edit project details'),
        ('projects.close', 'Close Project', 'Close/archive projects'),
        ('projects.manage_budget', 'Manage Project Budget', 'Manage project budgets'),
        ('projects.manage_team', 'Manage Project Team', 'Assign/remove members'),
        ('projects.manage_milestones', 'Manage Milestones', 'Create/manage milestones'),
        ('projects.approve_timesheet', 'Approve Timesheets', 'Approve project timesheets'),
        ('projects.view_reports', 'View Project Reports', 'View project reports'),
    ],
}


def _perms_starting_with(*prefixes):
    """Collect all permission codes that start with any of the given prefixes."""
    codes = []
    for module_perms in PERMISSIONS_BY_MODULE.values():
        for code, _name, _desc in module_perms:
            if any(code.startswith(p) for p in prefixes):
                codes.append(code)
    return codes


def _all_module_perms(module):
    """All permission codes for a module."""
    return [code for code, _n, _d in PERMISSIONS_BY_MODULE.get(module, [])]


ERP_ROLES = [
    {
        'code': 'CFO',
        'name': 'Chief Finance Officer',
        'description': 'Full access to all finance and reporting functions.',
        'level': 90,
        'permissions': _all_module_perms('finance'),
    },
    {
        'code': 'FINANCE_MANAGER',
        'name': 'Finance Manager',
        'description': 'Manages day-to-day finance operations: GL, AP, AR, Budgets.',
        'level': 80,
        'permissions': _perms_starting_with(
            'finance.gl.', 'finance.ap.', 'finance.ar.', 'finance.budget.',
        ),
    },
    {
        'code': 'ACCOUNTANT',
        'name': 'Accountant',
        'description': 'Creates and views journal entries, processes AP/AR. Cannot post journals.',
        'level': 60,
        'permissions': [
            'finance.gl.create', 'finance.gl.view',
            'finance.ap.create', 'finance.ap.view', 'finance.ap.process',
            'finance.ar.create', 'finance.ar.view', 'finance.ar.process',
        ],
    },
    {
        'code': 'AP_CLERK',
        'name': 'AP Clerk',
        'description': 'Handles accounts payable: vendor invoices and payments.',
        'level': 40,
        'permissions': _perms_starting_with('finance.ap.'),
    },
    {
        'code': 'BUDGET_OFFICER',
        'name': 'Budget Officer',
        'description': 'Manages budget creation, monitoring, and transfers.',
        'level': 50,
        'permissions': _perms_starting_with('finance.budget.'),
    },
    {
        'code': 'PROCUREMENT_MANAGER',
        'name': 'Procurement Manager',
        'description': 'Full authority over procurement operations.',
        'level': 80,
        'permissions': _all_module_perms('procurement'),
    },
    {
        'code': 'PROCUREMENT_OFFICER',
        'name': 'Procurement Officer',
        'description': 'Handles requisitions, POs, and GRNs. Cannot approve POs.',
        'level': 50,
        'permissions': _perms_starting_with(
            'procurement.requisition.', 'procurement.po.create',
            'procurement.po.view', 'procurement.grn.',
        ),
    },
    {
        'code': 'STORES_MANAGER',
        'name': 'Stores Manager',
        'description': 'Full authority over inventory and warehouse operations.',
        'level': 70,
        'permissions': _all_module_perms('inventory'),
    },
    {
        'code': 'STORES_OFFICER',
        'name': 'Stores Officer',
        'description': 'Handles stock receipts, issues, and cycle counts.',
        'level': 40,
        'permissions': _perms_starting_with(
            'inventory.receipt.', 'inventory.issue.', 'inventory.cycle_count.',
        ),
    },
    {
        'code': 'ASSET_MANAGER',
        'name': 'Asset Manager',
        'description': 'Manages fixed asset lifecycle: registration, depreciation, disposal.',
        'level': 60,
        'permissions': _perms_starting_with('inventory.asset.'),
    },
    {
        'code': 'PROJECT_MANAGER',
        'name': 'Project Manager',
        'description': 'Full authority over project operations.',
        'level': 70,
        'permissions': _all_module_perms('projects'),
    },
]


class Command(BaseCommand):
    help = 'Seed ERP roles and permissions for Finance, Procurement, Inventory, Payroll, and Projects.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Remove all seeded ERP roles before re-seeding.',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self._clear_seeded_data()

        self.stdout.write(self.style.MIGRATE_HEADING('\n=== Seeding ERP Permissions ===\n'))
        perm_map = self._seed_permissions()

        self.stdout.write(self.style.MIGRATE_HEADING('\n=== Seeding ERP Roles ===\n'))
        self._seed_roles(perm_map)

        total_perms = Permission.objects.filter(
            module__in=PERMISSIONS_BY_MODULE.keys()
        ).count()
        total_roles = Role.objects.filter(
            code__in=[r['code'] for r in ERP_ROLES]
        ).count()

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. {total_perms} permissions and {total_roles} ERP roles active.\n'
        ))

    def _seed_permissions(self):
        perm_map = {}
        created_count = 0
        existing_count = 0

        for module, perms in PERMISSIONS_BY_MODULE.items():
            for code, name, description in perms:
                perm, created = Permission.objects.get_or_create(
                    code=code,
                    defaults={
                        'name': name,
                        'description': description,
                        'module': module,
                        'is_active': True,
                    },
                )
                if created:
                    created_count += 1
                    self.stdout.write(f'  + {code}')
                else:
                    existing_count += 1
                    updated_fields = []
                    if perm.name != name:
                        perm.name = name
                        updated_fields.append('name')
                    if perm.description != description:
                        perm.description = description
                        updated_fields.append('description')
                    if perm.module != module:
                        perm.module = module
                        updated_fields.append('module')
                    if updated_fields:
                        perm.save(update_fields=updated_fields)

                perm_map[code] = perm

        self.stdout.write(
            f'\n  Permissions: {created_count} created, {existing_count} existed.'
        )
        return perm_map

    def _seed_roles(self, perm_map):
        for role_def in ERP_ROLES:
            role, created = Role.objects.get_or_create(
                code=role_def['code'],
                defaults={
                    'name': role_def['name'],
                    'description': role_def['description'],
                    'is_system_role': True,
                    'is_active': True,
                    'level': role_def['level'],
                },
            )

            if created:
                self.stdout.write(self.style.SUCCESS(
                    f"  + Role '{role.name}' (code={role.code}, level={role.level})"
                ))
            else:
                self.stdout.write(f"  = Role '{role.name}' already exists")

            # Assign permissions
            assigned_count = 0
            unique_codes = list(dict.fromkeys(role_def['permissions']))

            for perm_code in unique_codes:
                perm = perm_map.get(perm_code)
                if not perm:
                    continue

                _, rp_created = RolePermission.objects.get_or_create(
                    role=role,
                    permission=perm,
                )
                if rp_created:
                    assigned_count += 1

            self.stdout.write(f"    {assigned_count} permissions assigned")

    def _clear_seeded_data(self):
        role_codes = [r['code'] for r in ERP_ROLES]
        roles = Role.objects.filter(code__in=role_codes)

        rp_count = RolePermission.objects.filter(role__in=roles).count()
        RolePermission.objects.filter(role__in=roles).delete()
        self.stdout.write(f'  Removed {rp_count} role-permission assignments.')

        r_count = roles.count()
        roles.delete()
        self.stdout.write(f'  Removed {r_count} roles.')

        all_codes = []
        for perms in PERMISSIONS_BY_MODULE.values():
            for code, _, _ in perms:
                all_codes.append(code)
        p_count = Permission.objects.filter(code__in=all_codes).count()
        Permission.objects.filter(code__in=all_codes).delete()
        self.stdout.write(f'  Removed {p_count} permissions.')

        self.stdout.write(self.style.SUCCESS('  Cleared all seeded ERP data.\n'))
