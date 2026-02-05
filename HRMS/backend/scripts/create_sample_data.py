#!/usr/bin/env python
"""
Sample data creation script for NHIA HRMS.
Creates 5 records for each model with realistic Ghana-specific data.
"""

import os
import sys
import django
from decimal import Decimal
from datetime import date, timedelta

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from organization.models import (
    Department, JobGrade, JobCategory, JobPosition,
    CostCenter, WorkLocation, Holiday
)
from employees.models import Employee, BankAccount, EmergencyContact
from leave.models import LeaveType, LeaveBalance, LeaveRequest
from benefits.models import LoanType, LoanAccount, BenefitType, BenefitClaim, ExpenseType
from payroll.models import (
    PayComponent, SalaryStructure, EmployeeSalary,
    TaxBracket, SSNITRate, PayrollPeriod, PayrollRun
)


def create_job_grades():
    """Create 5 job grades."""
    print("Creating Job Grades...")
    grades = [
        {'code': 'GD01', 'name': 'Executive Director', 'level': 1, 'min_salary': Decimal('25000'), 'max_salary': Decimal('35000'), 'is_management': True, 'annual_leave_days': 30},
        {'code': 'GD02', 'name': 'Director', 'level': 2, 'min_salary': Decimal('18000'), 'max_salary': Decimal('25000'), 'is_management': True, 'annual_leave_days': 28},
        {'code': 'GD03', 'name': 'Manager', 'level': 3, 'min_salary': Decimal('12000'), 'max_salary': Decimal('18000'), 'is_management': True, 'annual_leave_days': 25},
        {'code': 'GD04', 'name': 'Senior Officer', 'level': 4, 'min_salary': Decimal('6000'), 'max_salary': Decimal('12000'), 'is_management': False, 'annual_leave_days': 21},
        {'code': 'GD05', 'name': 'Officer', 'level': 5, 'min_salary': Decimal('3000'), 'max_salary': Decimal('6000'), 'is_management': False, 'annual_leave_days': 21},
    ]
    created = []
    for g in grades:
        obj, _ = JobGrade.objects.get_or_create(code=g['code'], defaults=g)
        created.append(obj)
        print(f"  - {obj.code}: {obj.name}")
    return created


def create_job_categories():
    """Create 5 job categories."""
    print("Creating Job Categories...")
    categories = [
        {'code': 'ADM', 'name': 'Administrative', 'description': 'Administrative and support roles'},
        {'code': 'FIN', 'name': 'Finance', 'description': 'Finance and accounting roles'},
        {'code': 'ICT', 'name': 'Information Technology', 'description': 'IT and technical roles'},
        {'code': 'HRM', 'name': 'Human Resources', 'description': 'HR and people management roles'},
        {'code': 'OPS', 'name': 'Operations', 'description': 'Operations and field roles'},
    ]
    created = []
    for c in categories:
        obj, _ = JobCategory.objects.get_or_create(code=c['code'], defaults=c)
        created.append(obj)
        print(f"  - {obj.code}: {obj.name}")
    return created


def create_departments():
    """Create 5 departments."""
    print("Creating Departments...")
    departments = [
        {'code': 'FIN', 'name': 'Finance & Accounts', 'description': 'Financial management and accounting'},
        {'code': 'HRM', 'name': 'Human Resources', 'description': 'Human resource management'},
        {'code': 'ICT', 'name': 'Information Technology', 'description': 'IT systems and infrastructure'},
        {'code': 'OPS', 'name': 'Operations', 'description': 'Core operations and service delivery'},
        {'code': 'ADM', 'name': 'Administration', 'description': 'General administration and support'},
    ]
    created = []
    for d in departments:
        obj, _ = Department.objects.get_or_create(code=d['code'], defaults=d)
        created.append(obj)
        print(f"  - {obj.code}: {obj.name}")
    return created


def create_job_positions(grades, departments):
    """Create 5 job positions."""
    print("Creating Job Positions...")
    positions = [
        {'code': 'CEO', 'title': 'Chief Executive Officer', 'grade': grades[0], 'department': departments[3], 'is_supervisor': True, 'headcount_budget': 1},
        {'code': 'CFO', 'title': 'Chief Finance Officer', 'grade': grades[1], 'department': departments[0], 'is_supervisor': True, 'headcount_budget': 1},
        {'code': 'HRM', 'title': 'HR Manager', 'grade': grades[2], 'department': departments[1], 'is_supervisor': True, 'headcount_budget': 2},
        {'code': 'SACCT', 'title': 'Senior Accountant', 'grade': grades[3], 'department': departments[0], 'is_supervisor': False, 'headcount_budget': 5},
        {'code': 'HROFC', 'title': 'HR Officer', 'grade': grades[4], 'department': departments[1], 'is_supervisor': False, 'headcount_budget': 10},
    ]
    created = []
    for p in positions:
        obj, _ = JobPosition.objects.get_or_create(code=p['code'], defaults=p)
        created.append(obj)
        print(f"  - {obj.code}: {obj.title}")
    return created


def create_work_locations():
    """Create 5 work locations."""
    print("Creating Work Locations...")
    locations = [
        {'code': 'HQ', 'name': 'Head Office', 'address': 'Independence Avenue, Accra', 'city': 'Accra', 'is_headquarters': True},
        {'code': 'ASH', 'name': 'Ashanti Regional Office', 'address': 'Harper Road, Kumasi', 'city': 'Kumasi', 'is_headquarters': False},
        {'code': 'NTH', 'name': 'Northern Regional Office', 'address': 'Hospital Road, Tamale', 'city': 'Tamale', 'is_headquarters': False},
        {'code': 'WES', 'name': 'Western Regional Office', 'address': 'Market Circle, Takoradi', 'city': 'Takoradi', 'is_headquarters': False},
        {'code': 'VLT', 'name': 'Volta Regional Office', 'address': 'Main Street, Ho', 'city': 'Ho', 'is_headquarters': False},
    ]
    created = []
    for loc in locations:
        obj, _ = WorkLocation.objects.get_or_create(code=loc['code'], defaults=loc)
        created.append(obj)
        print(f"  - {obj.code}: {obj.name}")
    return created


def create_cost_centers():
    """Create 5 cost centers."""
    print("Creating Cost Centers...")
    cost_centers = [
        {'code': 'CC001', 'name': 'Head Office Operations', 'description': 'Central administration costs', 'budget_amount': Decimal('5000000'), 'fiscal_year': 2025},
        {'code': 'CC002', 'name': 'Regional Operations', 'description': 'Regional office costs', 'budget_amount': Decimal('3000000'), 'fiscal_year': 2025},
        {'code': 'CC003', 'name': 'IT Infrastructure', 'description': 'Technology and systems', 'budget_amount': Decimal('2000000'), 'fiscal_year': 2025},
        {'code': 'CC004', 'name': 'Human Capital', 'description': 'HR and training', 'budget_amount': Decimal('1500000'), 'fiscal_year': 2025},
        {'code': 'CC005', 'name': 'Finance & Audit', 'description': 'Financial management', 'budget_amount': Decimal('1000000'), 'fiscal_year': 2025},
    ]
    created = []
    for cc in cost_centers:
        obj, _ = CostCenter.objects.get_or_create(code=cc['code'], defaults=cc)
        created.append(obj)
        print(f"  - {obj.code}: {obj.name}")
    return created


def create_employees(departments, positions, grades, locations):
    """Create 5 employees."""
    print("Creating Employees...")
    employees_data = [
        {
            'employee_number': 'NHIA001',
            'first_name': 'Kwame',
            'last_name': 'Asante',
            'gender': 'M',
            'date_of_birth': date(1975, 5, 15),
            'mobile_phone': '0244123456',
            'personal_email': 'kwame.asante@gmail.com',
            'ghana_card_number': 'GHA-123456789-1',
            'ssnit_number': 'A12345678901',
            'residential_address': '15 Liberation Road',
            'residential_city': 'Accra',
            'date_of_joining': date(2010, 1, 15),
            'department': departments[3],  # Operations
            'position': positions[0],  # CEO
            'grade': grades[0],  # Executive Director
            'work_location': locations[0],  # HQ
            'marital_status': 'MARRIED',
            'status': 'ACTIVE',
            'employment_type': 'PERMANENT',
        },
        {
            'employee_number': 'NHIA002',
            'first_name': 'Akosua',
            'last_name': 'Mensah',
            'gender': 'F',
            'date_of_birth': date(1980, 8, 20),
            'mobile_phone': '0244789012',
            'personal_email': 'akosua.mensah@gmail.com',
            'ghana_card_number': 'GHA-234567890-2',
            'ssnit_number': 'A23456789012',
            'residential_address': '25 Ring Road East',
            'residential_city': 'Accra',
            'date_of_joining': date(2012, 3, 1),
            'department': departments[0],  # Finance
            'position': positions[1],  # CFO
            'grade': grades[1],  # Director
            'work_location': locations[0],  # HQ
            'marital_status': 'MARRIED',
            'status': 'ACTIVE',
            'employment_type': 'PERMANENT',
        },
        {
            'employee_number': 'NHIA003',
            'first_name': 'Yaw',
            'last_name': 'Owusu',
            'gender': 'M',
            'date_of_birth': date(1985, 3, 10),
            'mobile_phone': '0244345678',
            'personal_email': 'yaw.owusu@gmail.com',
            'ghana_card_number': 'GHA-345678901-3',
            'ssnit_number': 'A34567890123',
            'residential_address': '10 Osu Oxford Street',
            'residential_city': 'Accra',
            'date_of_joining': date(2015, 6, 15),
            'department': departments[1],  # HR
            'position': positions[2],  # HR Manager
            'grade': grades[2],  # Manager
            'work_location': locations[0],  # HQ
            'marital_status': 'SINGLE',
            'status': 'ACTIVE',
            'employment_type': 'PERMANENT',
        },
        {
            'employee_number': 'NHIA004',
            'first_name': 'Ama',
            'last_name': 'Boateng',
            'gender': 'F',
            'date_of_birth': date(1990, 11, 25),
            'mobile_phone': '0244901234',
            'personal_email': 'ama.boateng@gmail.com',
            'ghana_card_number': 'GHA-456789012-4',
            'ssnit_number': 'A45678901234',
            'residential_address': '5 Labone Estate',
            'residential_city': 'Accra',
            'date_of_joining': date(2018, 9, 1),
            'department': departments[0],  # Finance
            'position': positions[3],  # Senior Accountant
            'grade': grades[3],  # Senior Officer
            'work_location': locations[0],  # HQ
            'marital_status': 'SINGLE',
            'status': 'ACTIVE',
            'employment_type': 'PERMANENT',
        },
        {
            'employee_number': 'NHIA005',
            'first_name': 'Kofi',
            'last_name': 'Adjei',
            'gender': 'M',
            'date_of_birth': date(1995, 7, 8),
            'mobile_phone': '0244567890',
            'personal_email': 'kofi.adjei@gmail.com',
            'ghana_card_number': 'GHA-567890123-5',
            'ssnit_number': 'A56789012345',
            'residential_address': '20 East Legon',
            'residential_city': 'Accra',
            'date_of_joining': date(2020, 2, 1),
            'department': departments[1],  # HR
            'position': positions[4],  # HR Officer
            'grade': grades[4],  # Officer
            'work_location': locations[0],  # HQ
            'marital_status': 'SINGLE',
            'status': 'ACTIVE',
            'employment_type': 'PERMANENT',
        },
    ]

    created = []
    for emp_data in employees_data:
        obj, _ = Employee.objects.get_or_create(
            employee_number=emp_data['employee_number'],
            defaults=emp_data
        )
        created.append(obj)
        print(f"  - {obj.employee_number}: {obj.full_name}")
    return created


def create_bank_accounts(employees):
    """Create bank accounts for employees."""
    print("Creating Bank Accounts...")
    banks = ['GCB Bank', 'Ecobank Ghana', 'Stanbic Bank', 'Fidelity Bank', 'Absa Bank Ghana']

    for i, emp in enumerate(employees):
        obj, _ = BankAccount.objects.get_or_create(
            employee=emp,
            is_primary=True,
            defaults={
                'bank_name': banks[i],
                'branch_name': 'Accra Main',
                'account_name': emp.full_name,
                'account_number': f'100{i+1}234567890',
                'account_type': 'SAVINGS',
                'is_active': True,
            }
        )
        print(f"  - {emp.employee_number}: {obj.bank_name}")


def create_emergency_contacts(employees):
    """Create emergency contacts for employees."""
    print("Creating Emergency Contacts...")
    contacts = [
        ('Abena Asante', 'SPOUSE', '0244111111'),
        ('Kweku Mensah', 'SPOUSE', '0244222222'),
        ('Mary Owusu', 'PARENT', '0244333333'),
        ('Samuel Boateng', 'SIBLING', '0244444444'),
        ('Grace Adjei', 'PARENT', '0244555555'),
    ]

    for i, emp in enumerate(employees):
        name, rel, phone = contacts[i]
        obj, _ = EmergencyContact.objects.get_or_create(
            employee=emp,
            name=name,
            defaults={
                'relationship': rel,
                'phone_primary': phone,
                'is_primary': True,
            }
        )
        print(f"  - {emp.employee_number}: {obj.name}")


def create_leave_types():
    """Create 5 leave types."""
    print("Creating Leave Types...")
    leave_types = [
        {'code': 'ANN', 'name': 'Annual Leave', 'default_days': Decimal('21'), 'is_paid': True, 'allow_carry_forward': True, 'max_carry_forward_days': Decimal('10'), 'color_code': '#3B82F6'},
        {'code': 'SICK', 'name': 'Sick Leave', 'default_days': Decimal('10'), 'is_paid': True, 'requires_document': True, 'document_required_after_days': 2, 'color_code': '#EF4444'},
        {'code': 'MAT', 'name': 'Maternity Leave', 'default_days': Decimal('90'), 'is_paid': True, 'applies_to_gender': 'F', 'consecutive_days_only': True, 'color_code': '#EC4899'},
        {'code': 'PAT', 'name': 'Paternity Leave', 'default_days': Decimal('14'), 'is_paid': True, 'applies_to_gender': 'M', 'color_code': '#8B5CF6'},
        {'code': 'STU', 'name': 'Study Leave', 'default_days': Decimal('30'), 'is_paid': True, 'min_service_months': 24, 'color_code': '#10B981'},
    ]
    created = []
    for lt in leave_types:
        obj, _ = LeaveType.objects.get_or_create(code=lt['code'], defaults=lt)
        created.append(obj)
        print(f"  - {obj.code}: {obj.name}")
    return created


def create_leave_balances(employees, leave_types):
    """Create leave balances for employees."""
    print("Creating Leave Balances...")
    year = 2025

    for emp in employees:
        for lt in leave_types[:2]:  # Only annual and sick leave for all
            obj, _ = LeaveBalance.objects.get_or_create(
                employee=emp,
                leave_type=lt,
                year=year,
                defaults={
                    'opening_balance': Decimal('0'),
                    'earned': lt.default_days,
                    'taken': Decimal('0'),
                    'pending': Decimal('0'),
                }
            )
            print(f"  - {emp.employee_number}: {lt.code} = {obj.earned} days")


def create_leave_requests(employees, leave_types):
    """Create 5 leave requests."""
    print("Creating Leave Requests...")
    requests = [
        {'employee': employees[0], 'leave_type': leave_types[0], 'start_date': date(2025, 3, 1), 'end_date': date(2025, 3, 5), 'days': Decimal('5'), 'reason': 'Family vacation', 'status': 'APPROVED'},
        {'employee': employees[1], 'leave_type': leave_types[1], 'start_date': date(2025, 2, 10), 'end_date': date(2025, 2, 12), 'days': Decimal('3'), 'reason': 'Medical appointment', 'status': 'APPROVED'},
        {'employee': employees[2], 'leave_type': leave_types[0], 'start_date': date(2025, 4, 15), 'end_date': date(2025, 4, 25), 'days': Decimal('10'), 'reason': 'Annual vacation', 'status': 'PENDING'},
        {'employee': employees[3], 'leave_type': leave_types[0], 'start_date': date(2025, 5, 1), 'end_date': date(2025, 5, 7), 'days': Decimal('5'), 'reason': 'Personal matters', 'status': 'PENDING'},
        {'employee': employees[4], 'leave_type': leave_types[4], 'start_date': date(2025, 6, 1), 'end_date': date(2025, 6, 30), 'days': Decimal('20'), 'reason': 'Professional certification exam preparation', 'status': 'DRAFT'},
    ]

    created = []
    for i, req in enumerate(requests):
        req_num = f'LV2025{i+1:04d}'
        obj, _ = LeaveRequest.objects.get_or_create(
            request_number=req_num,
            defaults={
                'employee': req['employee'],
                'leave_type': req['leave_type'],
                'start_date': req['start_date'],
                'end_date': req['end_date'],
                'number_of_days': req['days'],
                'reason': req['reason'],
                'status': req['status'],
            }
        )
        created.append(obj)
        print(f"  - {obj.request_number}: {obj.employee.employee_number} - {obj.leave_type.code}")
    return created


def create_loan_types():
    """Create 5 loan types."""
    print("Creating Loan Types...")
    loan_types = [
        {'code': 'SAL', 'name': 'Salary Advance', 'max_salary_multiplier': Decimal('2'), 'max_tenure_months': 3, 'interest_rate': Decimal('0'), 'min_service_months': 6},
        {'code': 'STF', 'name': 'Staff Loan', 'max_salary_multiplier': Decimal('12'), 'max_tenure_months': 36, 'interest_rate': Decimal('8'), 'min_service_months': 12, 'interest_type': 'REDUCING'},
        {'code': 'VEH', 'name': 'Vehicle Loan', 'max_amount': Decimal('150000'), 'max_tenure_months': 60, 'interest_rate': Decimal('12'), 'min_service_months': 24, 'interest_type': 'REDUCING'},
        {'code': 'HSG', 'name': 'Housing Loan', 'max_amount': Decimal('500000'), 'max_tenure_months': 120, 'interest_rate': Decimal('10'), 'min_service_months': 36, 'interest_type': 'REDUCING', 'require_guarantor': True, 'number_of_guarantors': 2},
        {'code': 'EDU', 'name': 'Education Loan', 'max_salary_multiplier': Decimal('6'), 'max_tenure_months': 24, 'interest_rate': Decimal('5'), 'min_service_months': 12},
    ]
    created = []
    for lt in loan_types:
        obj, _ = LoanType.objects.get_or_create(code=lt['code'], defaults=lt)
        created.append(obj)
        print(f"  - {obj.code}: {obj.name}")
    return created


def create_loan_accounts(employees, loan_types):
    """Create 5 loan accounts."""
    print("Creating Loan Accounts...")
    loans = [
        {'employee': employees[2], 'loan_type': loan_types[0], 'principal': Decimal('10000'), 'tenure': 3, 'rate': Decimal('0'), 'status': 'ACTIVE'},
        {'employee': employees[3], 'loan_type': loan_types[1], 'principal': Decimal('50000'), 'tenure': 24, 'rate': Decimal('8'), 'status': 'ACTIVE'},
        {'employee': employees[4], 'loan_type': loan_types[0], 'principal': Decimal('5000'), 'tenure': 2, 'rate': Decimal('0'), 'status': 'PENDING'},
        {'employee': employees[1], 'loan_type': loan_types[4], 'principal': Decimal('30000'), 'tenure': 18, 'rate': Decimal('5'), 'status': 'APPROVED'},
        {'employee': employees[0], 'loan_type': loan_types[2], 'principal': Decimal('100000'), 'tenure': 48, 'rate': Decimal('12'), 'status': 'COMPLETED'},
    ]

    created = []
    for i, loan in enumerate(loans):
        loan_num = f'LN2025{i+1:04d}'
        obj, _ = LoanAccount.objects.get_or_create(
            loan_number=loan_num,
            defaults={
                'employee': loan['employee'],
                'loan_type': loan['loan_type'],
                'principal_amount': loan['principal'],
                'tenure_months': loan['tenure'],
                'interest_rate': loan['rate'],
                'total_amount': loan['principal'],
                'outstanding_balance': loan['principal'] if loan['status'] in ['ACTIVE', 'DISBURSED'] else Decimal('0'),
                'status': loan['status'],
            }
        )
        created.append(obj)
        print(f"  - {obj.loan_number}: {obj.employee.employee_number} - {obj.loan_type.code}")
    return created


def create_benefit_types():
    """Create 5 benefit types."""
    print("Creating Benefit Types...")
    benefit_types = [
        {'code': 'MED', 'name': 'Medical Expenses', 'category': 'MEDICAL', 'annual_limit': Decimal('10000'), 'per_claim_limit': Decimal('5000'), 'requires_receipt': True},
        {'code': 'TRN', 'name': 'Transport Allowance', 'category': 'TRANSPORT', 'annual_limit': Decimal('6000'), 'requires_receipt': False},
        {'code': 'HSG', 'name': 'Housing Allowance', 'category': 'HOUSING', 'annual_limit': Decimal('24000'), 'requires_receipt': False},
        {'code': 'EDU', 'name': 'Education Support', 'category': 'EDUCATION', 'annual_limit': Decimal('15000'), 'per_claim_limit': Decimal('5000'), 'requires_receipt': True},
        {'code': 'INS', 'name': 'Life Insurance', 'category': 'INSURANCE', 'requires_receipt': False},
    ]
    created = []
    for bt in benefit_types:
        obj, _ = BenefitType.objects.get_or_create(code=bt['code'], defaults=bt)
        created.append(obj)
        print(f"  - {obj.code}: {obj.name}")
    return created


def create_expense_types():
    """Create 5 expense types."""
    print("Creating Expense Types...")
    expense_types = [
        {'code': 'TRV', 'name': 'Travel', 'category': 'TRAVEL', 'requires_receipt': True, 'requires_approval': True},
        {'code': 'MEL', 'name': 'Meals', 'category': 'MEALS', 'max_amount': Decimal('200'), 'requires_receipt': True},
        {'code': 'ACC', 'name': 'Accommodation', 'category': 'ACCOMMODATION', 'requires_receipt': True},
        {'code': 'FUL', 'name': 'Fuel', 'category': 'FUEL', 'mileage_rate': Decimal('2.50'), 'requires_receipt': True},
        {'code': 'COM', 'name': 'Communication', 'category': 'COMMUNICATION', 'max_amount': Decimal('500'), 'requires_receipt': True},
    ]
    created = []
    for et in expense_types:
        obj, _ = ExpenseType.objects.get_or_create(code=et['code'], defaults=et)
        created.append(obj)
        print(f"  - {obj.code}: {obj.name}")
    return created


def create_pay_components():
    """Create pay components."""
    print("Creating Pay Components...")
    components = [
        {'code': 'BASIC', 'name': 'Basic Salary', 'component_type': 'EARNING', 'calculation_type': 'FIXED', 'is_part_of_basic': True, 'is_taxable': True, 'affects_ssnit': True, 'display_order': 1},
        {'code': 'RENT', 'name': 'Rent Allowance', 'component_type': 'EARNING', 'calculation_type': 'PCT_BASIC', 'percentage_value': Decimal('0.20'), 'is_taxable': True, 'display_order': 2},
        {'code': 'TRANS', 'name': 'Transport Allowance', 'component_type': 'EARNING', 'calculation_type': 'FIXED', 'default_amount': Decimal('500'), 'is_taxable': True, 'display_order': 3},
        {'code': 'PAYE', 'name': 'Income Tax (PAYE)', 'component_type': 'DEDUCTION', 'calculation_type': 'LOOKUP', 'is_statutory': True, 'display_order': 10},
        {'code': 'SSNIT', 'name': 'SSNIT Contribution', 'component_type': 'DEDUCTION', 'calculation_type': 'PCT_BASIC', 'percentage_value': Decimal('0.055'), 'is_statutory': True, 'display_order': 11},
        {'code': 'TIER2', 'name': 'Tier 2 Pension', 'component_type': 'EMPLOYER', 'calculation_type': 'PCT_BASIC', 'percentage_value': Decimal('0.05'), 'is_statutory': True, 'display_order': 20},
        {'code': 'SSNIT_ER', 'name': 'SSNIT Employer', 'component_type': 'EMPLOYER', 'calculation_type': 'PCT_BASIC', 'percentage_value': Decimal('0.13'), 'is_statutory': True, 'display_order': 21},
    ]
    created = []
    for c in components:
        obj, _ = PayComponent.objects.get_or_create(code=c['code'], defaults=c)
        created.append(obj)
        print(f"  - {obj.code}: {obj.name}")
    return created


def create_tax_brackets():
    """Create Ghana PAYE tax brackets (2024 rates)."""
    print("Creating Tax Brackets...")
    brackets = [
        {'name': 'First GHS 490', 'min_amount': Decimal('0'), 'max_amount': Decimal('490'), 'rate': Decimal('0'), 'cumulative_tax': Decimal('0'), 'order': 1},
        {'name': 'Next GHS 110', 'min_amount': Decimal('490'), 'max_amount': Decimal('600'), 'rate': Decimal('5'), 'cumulative_tax': Decimal('5.50'), 'order': 2},
        {'name': 'Next GHS 130', 'min_amount': Decimal('600'), 'max_amount': Decimal('730'), 'rate': Decimal('10'), 'cumulative_tax': Decimal('18.50'), 'order': 3},
        {'name': 'Next GHS 3166.67', 'min_amount': Decimal('730'), 'max_amount': Decimal('3896.67'), 'rate': Decimal('17.5'), 'cumulative_tax': Decimal('572.67'), 'order': 4},
        {'name': 'Next GHS 16395', 'min_amount': Decimal('3896.67'), 'max_amount': Decimal('20291.67'), 'rate': Decimal('25'), 'cumulative_tax': Decimal('4671.42'), 'order': 5},
        {'name': 'Exceeding GHS 20291.67', 'min_amount': Decimal('20291.67'), 'max_amount': None, 'rate': Decimal('30'), 'cumulative_tax': Decimal('0'), 'order': 6},
    ]
    created = []
    effective_date = date(2024, 1, 1)
    for b in brackets:
        obj, _ = TaxBracket.objects.get_or_create(
            name=b['name'],
            effective_from=effective_date,
            defaults={**b, 'effective_from': effective_date}
        )
        created.append(obj)
        print(f"  - {obj.name}: {obj.rate}%")
    return created


def create_ssnit_rates():
    """Create SSNIT contribution rates."""
    print("Creating SSNIT Rates...")
    rates = [
        {'tier': 'TIER_1', 'employer_rate': Decimal('13'), 'employee_rate': Decimal('5.5')},
        {'tier': 'TIER_2', 'employer_rate': Decimal('5'), 'employee_rate': Decimal('0')},
        {'tier': 'TIER_3', 'employer_rate': Decimal('0'), 'employee_rate': Decimal('5')},
    ]
    created = []
    effective_date = date(2024, 1, 1)
    for r in rates:
        obj, _ = SSNITRate.objects.get_or_create(
            tier=r['tier'],
            effective_from=effective_date,
            defaults={**r, 'effective_from': effective_date}
        )
        created.append(obj)
        print(f"  - {obj.tier}: Employer {obj.employer_rate}%, Employee {obj.employee_rate}%")
    return created


def create_payroll_periods():
    """Create payroll periods for 2025."""
    print("Creating Payroll Periods...")
    created = []
    for month in range(1, 6):  # Jan to May 2025
        start = date(2025, month, 1)
        if month == 12:
            end = date(2025, 12, 31)
        else:
            end = date(2025, month + 1, 1) - timedelta(days=1)

        name = start.strftime('%B %Y')
        obj, _ = PayrollPeriod.objects.get_or_create(
            year=2025,
            month=month,
            is_supplementary=False,
            defaults={
                'name': name,
                'start_date': start,
                'end_date': end,
                'payment_date': date(2025, month, 28),
                'status': 'CLOSED' if month < 2 else 'OPEN',
            }
        )
        created.append(obj)
        print(f"  - {obj.name}: {obj.status}")
    return created


def create_employee_salaries(employees, grades):
    """Create employee salaries."""
    print("Creating Employee Salaries...")
    salaries = [
        {'employee': employees[0], 'basic': Decimal('30000')},
        {'employee': employees[1], 'basic': Decimal('22000')},
        {'employee': employees[2], 'basic': Decimal('15000')},
        {'employee': employees[3], 'basic': Decimal('8000')},
        {'employee': employees[4], 'basic': Decimal('4500')},
    ]

    created = []
    for sal in salaries:
        obj, _ = EmployeeSalary.objects.get_or_create(
            employee=sal['employee'],
            is_current=True,
            defaults={
                'basic_salary': sal['basic'],
                'gross_salary': sal['basic'] * Decimal('1.3'),  # Basic + allowances
                'effective_from': date(2024, 1, 1),
                'currency': 'GHS',
            }
        )
        created.append(obj)
        print(f"  - {obj.employee.employee_number}: GHS {obj.basic_salary}")
    return created


def create_holidays():
    """Create Ghana public holidays for 2025."""
    print("Creating Holidays...")
    holidays = [
        {'name': "New Year's Day", 'date': date(2025, 1, 1)},
        {'name': 'Independence Day', 'date': date(2025, 3, 6)},
        {'name': 'Good Friday', 'date': date(2025, 4, 18)},
        {'name': 'Easter Monday', 'date': date(2025, 4, 21)},
        {'name': 'May Day', 'date': date(2025, 5, 1)},
        {'name': 'Eid al-Fitr', 'date': date(2025, 3, 30)},
        {'name': 'Republic Day', 'date': date(2025, 7, 1)},
        {'name': 'Founders Day', 'date': date(2025, 8, 4)},
        {'name': 'Kwame Nkrumah Memorial Day', 'date': date(2025, 9, 21)},
        {'name': 'Christmas Day', 'date': date(2025, 12, 25)},
    ]
    created = []
    for h in holidays[:5]:  # First 5
        obj, _ = Holiday.objects.get_or_create(
            name=h['name'],
            date=h['date'],
            defaults={
                'holiday_type': 'PUBLIC',
                'is_paid': True,
                'year': h['date'].year,
            }
        )
        created.append(obj)
        print(f"  - {obj.name}: {obj.date}")
    return created


def main():
    """Run all sample data creation."""
    print("=" * 60)
    print("NHIA HRMS - Sample Data Creation Script")
    print("=" * 60)
    print()

    # Organization
    grades = create_job_grades()
    print()

    categories = create_job_categories()
    print()

    departments = create_departments()
    print()

    positions = create_job_positions(grades, departments)
    print()

    locations = create_work_locations()
    print()

    cost_centers = create_cost_centers()
    print()

    # Employees
    employees = create_employees(departments, positions, grades, locations)
    print()

    create_bank_accounts(employees)
    print()

    create_emergency_contacts(employees)
    print()

    # Leave
    leave_types = create_leave_types()
    print()

    create_leave_balances(employees, leave_types)
    print()

    create_leave_requests(employees, leave_types)
    print()

    # Benefits & Loans
    loan_types = create_loan_types()
    print()

    create_loan_accounts(employees, loan_types)
    print()

    benefit_types = create_benefit_types()
    print()

    expense_types = create_expense_types()
    print()

    # Payroll
    pay_components = create_pay_components()
    print()

    create_tax_brackets()
    print()

    create_ssnit_rates()
    print()

    payroll_periods = create_payroll_periods()
    print()

    create_employee_salaries(employees, grades)
    print()

    # Holidays
    create_holidays()
    print()

    print("=" * 60)
    print("Sample data creation complete!")
    print("=" * 60)


if __name__ == '__main__':
    main()
