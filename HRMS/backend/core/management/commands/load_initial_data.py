"""
Management command to load initial data for HRMS.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal

from accounts.models import Role, Permission
from organization.models import JobGrade, JobCategory
from leave.models import LeaveType, LeavePolicy
from payroll.models import TaxBracket, TaxRelief, SSNITRate, PayComponent
from discipline.models import MisconductCategory, GrievanceCategory


class Command(BaseCommand):
    help = 'Load initial data for HRMS'

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write('Loading initial data...\n')

        self.load_roles()
        self.load_permissions()
        self.load_job_grades()
        self.load_job_categories()
        self.load_leave_types()
        self.load_tax_brackets()
        self.load_tax_reliefs()
        self.load_ssnit_rates()
        self.load_pay_components()
        self.load_misconduct_categories()
        self.load_grievance_categories()

        self.stdout.write(self.style.SUCCESS('\nInitial data loaded successfully!'))

    def load_roles(self):
        """Load system roles."""
        roles = [
            ('SUPER_ADMIN', 'Super Administrator', 'Full system access'),
            ('HR_DIRECTOR', 'HR Director', 'HR department head with full HR access'),
            ('HR_MANAGER', 'HR Manager', 'HR management access'),
            ('HR_OFFICER', 'HR Officer', 'Basic HR operations'),
            ('PAYROLL_MANAGER', 'Payroll Manager', 'Full payroll access'),
            ('PAYROLL_OFFICER', 'Payroll Officer', 'Basic payroll operations'),
            ('DEPARTMENT_HEAD', 'Department Head', 'Department management access'),
            ('SUPERVISOR', 'Supervisor', 'Team supervision access'),
            ('EMPLOYEE', 'Employee', 'Self-service access only'),
            ('RECRUITMENT_OFFICER', 'Recruitment Officer', 'Recruitment management'),
            ('FINANCE_OFFICER', 'Finance Officer', 'Finance related approvals'),
        ]

        for code, name, description in roles:
            Role.objects.get_or_create(
                code=code,
                defaults={'name': name, 'description': description, 'is_active': True}
            )
        self.stdout.write(f'  Loaded {len(roles)} roles')

    def load_permissions(self):
        """Load system permissions."""
        permissions = [
            # Employee permissions
            ('employee.view', 'View Employees', 'employees'),
            ('employee.create', 'Create Employees', 'employees'),
            ('employee.edit', 'Edit Employees', 'employees'),
            ('employee.delete', 'Delete Employees', 'employees'),
            # Leave permissions
            ('leave.view', 'View Leave Requests', 'leave'),
            ('leave.create', 'Create Leave Requests', 'leave'),
            ('leave.approve', 'Approve Leave Requests', 'leave'),
            ('leave.admin', 'Administer Leave', 'leave'),
            # Payroll permissions
            ('payroll.view', 'View Payroll', 'payroll'),
            ('payroll.process', 'Process Payroll', 'payroll'),
            ('payroll.approve', 'Approve Payroll', 'payroll'),
            ('payroll.admin', 'Administer Payroll', 'payroll'),
            # Benefits permissions
            ('benefits.view', 'View Benefits', 'benefits'),
            ('benefits.apply', 'Apply for Benefits', 'benefits'),
            ('benefits.approve', 'Approve Benefits', 'benefits'),
            # Recruitment permissions
            ('recruitment.view', 'View Recruitment', 'recruitment'),
            ('recruitment.manage', 'Manage Recruitment', 'recruitment'),
            # Reports permissions
            ('reports.view', 'View Reports', 'reports'),
            ('reports.export', 'Export Reports', 'reports'),
            # Admin permissions
            ('admin.users', 'Manage Users', 'admin'),
            ('admin.settings', 'Manage Settings', 'admin'),
        ]

        for code, name, module in permissions:
            Permission.objects.get_or_create(
                code=code,
                defaults={'name': name, 'module': module, 'is_active': True}
            )
        self.stdout.write(f'  Loaded {len(permissions)} permissions')

    def load_job_grades(self):
        """Load sample job grades."""
        grades = [
            ('GS-1', 'Grade 1 - Entry Level', 1, Decimal('2500'), Decimal('3500')),
            ('GS-2', 'Grade 2 - Junior Officer', 2, Decimal('3500'), Decimal('5000')),
            ('GS-3', 'Grade 3 - Officer', 3, Decimal('5000'), Decimal('7000')),
            ('GS-4', 'Grade 4 - Senior Officer', 4, Decimal('7000'), Decimal('10000')),
            ('GS-5', 'Grade 5 - Principal Officer', 5, Decimal('10000'), Decimal('14000')),
            ('GS-6', 'Grade 6 - Assistant Manager', 6, Decimal('14000'), Decimal('18000')),
            ('GS-7', 'Grade 7 - Manager', 7, Decimal('18000'), Decimal('25000')),
            ('GS-8', 'Grade 8 - Senior Manager', 8, Decimal('25000'), Decimal('35000')),
            ('GS-9', 'Grade 9 - Director', 9, Decimal('35000'), Decimal('50000')),
            ('GS-10', 'Grade 10 - Executive Director', 10, Decimal('50000'), Decimal('80000')),
        ]

        for code, name, level, min_sal, max_sal in grades:
            JobGrade.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'level': level,
                    'min_salary': min_sal,
                    'max_salary': max_sal,
                    'is_active': True
                }
            )
        self.stdout.write(f'  Loaded {len(grades)} job grades')

    def load_job_categories(self):
        """Load job categories."""
        categories = [
            ('ADMIN', 'Administrative', 'Administrative and support roles'),
            ('TECH', 'Technical', 'Technical and IT roles'),
            ('FIN', 'Finance', 'Finance and accounting roles'),
            ('HR', 'Human Resources', 'HR and people management roles'),
            ('OPS', 'Operations', 'Operations and field roles'),
            ('MGMT', 'Management', 'Management and leadership roles'),
            ('MED', 'Medical', 'Medical and health services roles'),
            ('LEGAL', 'Legal', 'Legal and compliance roles'),
        ]

        for code, name, description in categories:
            JobCategory.objects.get_or_create(
                code=code,
                defaults={'name': name, 'description': description, 'is_active': True}
            )
        self.stdout.write(f'  Loaded {len(categories)} job categories')

    def load_leave_types(self):
        """Load leave types."""
        leave_types = [
            ('ANNUAL', 'Annual Leave', 21, True, True, True),
            ('SICK', 'Sick Leave', 10, True, False, False),
            ('MATERNITY', 'Maternity Leave', 90, True, False, False),
            ('PATERNITY', 'Paternity Leave', 5, True, False, False),
            ('COMPASSIONATE', 'Compassionate Leave', 5, True, False, False),
            ('STUDY', 'Study Leave', 30, True, False, False),
            ('UNPAID', 'Leave Without Pay', 30, False, False, False),
            ('MARRIAGE', 'Marriage Leave', 5, True, False, False),
            ('CASUAL', 'Casual Leave', 5, True, False, False),
        ]

        for code, name, default_days, is_paid, carry_forward, encashable in leave_types:
            LeaveType.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'default_days': default_days,
                    'is_paid': is_paid,
                    'allow_carry_forward': carry_forward,
                    'allow_encashment': encashable,
                    'is_active': True
                }
            )
        self.stdout.write(f'  Loaded {len(leave_types)} leave types')

    def load_tax_brackets(self):
        """Load Ghana PAYE tax brackets (2024 rates)."""
        brackets = [
            ('First GHS 490', Decimal('0'), Decimal('490'), Decimal('0'), Decimal('0'), 1),
            ('Next GHS 110', Decimal('490'), Decimal('600'), Decimal('5'), Decimal('0'), 2),
            ('Next GHS 130', Decimal('600'), Decimal('730'), Decimal('10'), Decimal('5.50'), 3),
            ('Next GHS 3166.67', Decimal('730'), Decimal('3896.67'), Decimal('17.5'), Decimal('18.50'), 4),
            ('Next GHS 16103.33', Decimal('3896.67'), Decimal('20000'), Decimal('25'), Decimal('572.67'), 5),
            ('Next GHS 30000', Decimal('20000'), Decimal('50000'), Decimal('30'), Decimal('4598.50'), 6),
            ('Exceeding GHS 50000', Decimal('50000'), None, Decimal('35'), Decimal('13598.50'), 7),
        ]

        # Clear existing brackets
        TaxBracket.objects.filter(is_active=True).update(is_active=False)

        for name, min_amt, max_amt, rate, cumulative, order in brackets:
            TaxBracket.objects.create(
                name=name,
                min_amount=min_amt,
                max_amount=max_amt,
                rate=rate,
                cumulative_tax=cumulative,
                effective_from='2024-01-01',
                order=order,
                is_active=True
            )
        self.stdout.write(f'  Loaded {len(brackets)} tax brackets')

    def load_tax_reliefs(self):
        """Load Ghana tax reliefs."""
        reliefs = [
            ('MARRIAGE', 'Marriage Relief', Decimal('200')),
            ('CHILD', 'Child Education Relief', Decimal('100')),
            ('AGED_DEPENDENT', 'Aged Dependent Relief', Decimal('50')),
            ('DISABILITY', 'Disability Relief', Decimal('300')),
            ('OLD_AGE', 'Old Age Relief (60+)', Decimal('200')),
        ]

        for code, name, amount in reliefs:
            TaxRelief.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'amount': amount,
                    'relief_type': 'FIXED',
                    'effective_from': '2024-01-01',
                    'is_active': True
                }
            )
        self.stdout.write(f'  Loaded {len(reliefs)} tax reliefs')

    def load_ssnit_rates(self):
        """Load SSNIT contribution rates."""
        rates = [
            ('TIER_1', Decimal('13'), Decimal('5.5')),  # Tier 1: Employer 13%, Employee 5.5%
            ('TIER_2', Decimal('5'), Decimal('0')),     # Tier 2: Employer 5%, Employee 0%
            ('TIER_3', Decimal('0'), Decimal('5')),     # Tier 3: Voluntary, Employee 5%
        ]

        # Clear existing rates
        SSNITRate.objects.filter(is_active=True).update(is_active=False)

        for tier, employer_rate, employee_rate in rates:
            SSNITRate.objects.create(
                tier=tier,
                employer_rate=employer_rate,
                employee_rate=employee_rate,
                effective_from='2024-01-01',
                is_active=True
            )
        self.stdout.write(f'  Loaded {len(rates)} SSNIT rates')

    def load_pay_components(self):
        """Load standard pay components."""
        components = [
            ('BASIC', 'Basic Salary', 'EARNING', True, False, 1),
            ('HOUSING', 'Housing Allowance', 'EARNING', False, False, 2),
            ('TRANSPORT', 'Transport Allowance', 'EARNING', False, False, 3),
            ('RESPONSIBILITY', 'Responsibility Allowance', 'EARNING', False, False, 4),
            ('ACTING', 'Acting Allowance', 'EARNING', False, False, 5),
            ('OVERTIME', 'Overtime', 'EARNING', False, False, 6),
            ('BONUS', 'Bonus', 'EARNING', False, False, 7),
            ('SSNIT_EE', 'SSNIT Employee Contribution', 'DEDUCTION', False, True, 1),
            ('PAYE', 'PAYE Tax', 'DEDUCTION', False, True, 2),
            ('LOAN', 'Loan Deduction', 'DEDUCTION', False, False, 3),
            ('UNION', 'Union Dues', 'DEDUCTION', False, False, 4),
            ('WELFARE', 'Staff Welfare', 'DEDUCTION', False, False, 5),
            ('SSNIT_ER', 'SSNIT Employer Contribution', 'EMPLOYER', False, True, 1),
            ('TIER2_ER', 'Tier 2 Employer Contribution', 'EMPLOYER', False, True, 2),
        ]

        for code, name, comp_type, taxable, statutory, order in components:
            PayComponent.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'component_type': comp_type,
                    'is_taxable': taxable,
                    'is_statutory': statutory,
                    'display_order': order,
                    'is_active': True
                }
            )
        self.stdout.write(f'  Loaded {len(components)} pay components')

    def load_misconduct_categories(self):
        """Load misconduct categories for discipline module."""
        categories = [
            ('ABSENCE', 'Unauthorized Absence', 'Absence without permission or notification', 'MINOR'),
            ('LATENESS', 'Persistent Lateness', 'Repeated late arrival to work', 'MINOR'),
            ('INSUBORDINATION', 'Insubordination', 'Refusal to follow lawful instructions', 'MODERATE'),
            ('NEGLIGENCE', 'Negligence', 'Failure to perform duties with due care', 'MODERATE'),
            ('MISCONDUCT', 'General Misconduct', 'Violation of workplace rules', 'MODERATE'),
            ('HARASSMENT', 'Harassment', 'Harassment of colleagues or clients', 'MAJOR'),
            ('FRAUD', 'Fraud', 'Fraudulent activities or falsification', 'GROSS'),
            ('THEFT', 'Theft', 'Theft of organization property', 'GROSS'),
            ('VIOLENCE', 'Violence', 'Physical violence or threats', 'GROSS'),
            ('SUBSTANCE', 'Substance Abuse', 'Use of drugs or alcohol at work', 'MAJOR'),
            ('CONFIDENTIALITY', 'Breach of Confidentiality', 'Unauthorized disclosure of information', 'MAJOR'),
            ('CONFLICT', 'Conflict of Interest', 'Undisclosed conflict of interest', 'MODERATE'),
        ]

        for code, name, description, severity in categories:
            MisconductCategory.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'description': description,
                    'severity': severity,
                    'is_active': True
                }
            )
        self.stdout.write(f'  Loaded {len(categories)} misconduct categories')

    def load_grievance_categories(self):
        """Load grievance categories."""
        categories = [
            ('WORKPLACE', 'Workplace Conditions', 'Issues related to physical work environment'),
            ('HARASSMENT', 'Harassment', 'Harassment or bullying complaints'),
            ('DISCRIMINATION', 'Discrimination', 'Discrimination based on protected characteristics'),
            ('COMPENSATION', 'Compensation', 'Issues related to pay or benefits'),
            ('WORKLOAD', 'Workload', 'Excessive or unreasonable workload'),
            ('MANAGEMENT', 'Management Issues', 'Concerns about management decisions'),
            ('POLICY', 'Policy Violations', 'Violations of company policies'),
            ('INTERPERSONAL', 'Interpersonal Conflict', 'Conflicts between employees'),
            ('SAFETY', 'Health & Safety', 'Health and safety concerns'),
            ('OTHER', 'Other', 'Other grievances not categorized above'),
        ]

        for code, name, description in categories:
            GrievanceCategory.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'description': description,
                    'is_active': True
                }
            )
        self.stdout.write(f'  Loaded {len(categories)} grievance categories')
