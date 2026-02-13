"""
Benefits seeder: Loan types, benefit types, expense types, funeral grants,
medical lens, third-party lenders.
"""

from decimal import Decimal

from .base import BaseSeeder


class BenefitsSeeder(BaseSeeder):
    module_name = 'benefits'

    def seed(self):
        self._seed_loan_types()
        self._seed_benefit_types()
        self._seed_expense_types()
        self._seed_funeral_grant_types()
        self._seed_medical_lens()
        self._seed_third_party_lenders()
        return self.stats

    def _seed_loan_types(self):
        from benefits.models import LoanType

        loan_types = [
            {
                'code': 'SAL-ADV',
                'name': 'Salary Advance',
                'description': 'Advance on salary up to 1 month gross, repayable over 12 months with no interest.',
                'max_salary_multiplier': Decimal('1'),
                'salary_component': LoanType.SalaryComponent.GROSS,
                'max_tenure_months': 12,
                'min_tenure_months': 1,
                'interest_rate': Decimal('0'),
                'interest_type': 'SIMPLE',
                'min_service_months': 6,
                'max_active_loans': 1,
                'cooldown_months': 12,
                'require_guarantor': False,
                'number_of_guarantors': 0,
                'max_deduction_percentage': Decimal('33.33'),
                'approval_levels': 2,
                'auto_post_to_payroll': True,
            },
            {
                'code': 'SPEC-ADV',
                'name': 'Special Advance',
                'description': 'Special advance up to 2 months basic salary, repayable over 24 months.',
                'max_salary_multiplier': Decimal('2'),
                'salary_component': LoanType.SalaryComponent.BASIC,
                'max_tenure_months': 24,
                'min_tenure_months': 6,
                'interest_rate': Decimal('0'),
                'interest_type': 'SIMPLE',
                'min_service_months': 12,
                'max_active_loans': 1,
                'cooldown_months': 6,
                'require_guarantor': True,
                'number_of_guarantors': 1,
                'max_deduction_percentage': Decimal('25'),
                'approval_levels': 3,
                'auto_post_to_payroll': True,
            },
            {
                'code': 'CAR-LOAN',
                'name': 'Car Loan',
                'description': 'Vehicle financing loan up to 6 months gross salary, repayable over 60 months.',
                'max_salary_multiplier': Decimal('6'),
                'salary_component': LoanType.SalaryComponent.GROSS,
                'max_tenure_months': 60,
                'min_tenure_months': 12,
                'interest_rate': Decimal('5'),
                'interest_type': 'REDUCING',
                'min_service_months': 24,
                'max_active_loans': 1,
                'cooldown_months': 12,
                'require_guarantor': True,
                'number_of_guarantors': 2,
                'max_deduction_percentage': Decimal('40'),
                'approval_levels': 3,
                'auto_post_to_payroll': True,
            },
            {
                'code': 'HOUSE-LOAN',
                'name': 'Housing Loan',
                'description': 'Housing/mortgage loan up to 12 months gross salary, repayable over 120 months.',
                'max_salary_multiplier': Decimal('12'),
                'salary_component': LoanType.SalaryComponent.GROSS,
                'max_tenure_months': 120,
                'min_tenure_months': 24,
                'interest_rate': Decimal('8'),
                'interest_type': 'REDUCING',
                'min_service_months': 36,
                'max_active_loans': 1,
                'cooldown_months': 24,
                'require_guarantor': True,
                'number_of_guarantors': 2,
                'max_deduction_percentage': Decimal('40'),
                'approval_levels': 4,
                'auto_post_to_payroll': True,
            },
            {
                'code': 'PERS-LOAN',
                'name': 'Personal Loan',
                'description': 'General purpose personal loan up to 3 months net salary.',
                'max_salary_multiplier': Decimal('3'),
                'salary_component': LoanType.SalaryComponent.NET,
                'max_tenure_months': 36,
                'min_tenure_months': 6,
                'interest_rate': Decimal('10'),
                'interest_type': 'REDUCING',
                'min_service_months': 12,
                'max_active_loans': 1,
                'cooldown_months': 6,
                'require_guarantor': True,
                'number_of_guarantors': 1,
                'max_deduction_percentage': Decimal('33.33'),
                'approval_levels': 2,
                'auto_post_to_payroll': True,
            },
        ]

        for data in loan_types:
            code = data.pop('code')
            self._update_or_create(LoanType, {'code': code}, data)

    def _seed_benefit_types(self):
        from benefits.models import BenefitType

        benefit_types = [
            {
                'code': 'MEDICAL',
                'name': 'Medical Benefit',
                'description': 'Annual medical allowance/reimbursement',
                'category': 'MEDICAL',
                'annual_limit': Decimal('5000.00'),
                'requires_receipt': True,
            },
            {
                'code': 'TRANSPORT',
                'name': 'Transport Benefit',
                'description': 'Transport allowance benefit',
                'category': 'TRANSPORT',
                'requires_receipt': False,
            },
            {
                'code': 'HOUSING',
                'name': 'Housing Benefit',
                'description': 'Housing support benefit',
                'category': 'HOUSING',
                'requires_receipt': True,
            },
            {
                'code': 'EDUCATION',
                'name': 'Education Benefit',
                'description': 'Education support/tuition reimbursement',
                'category': 'EDUCATION',
                'annual_limit': Decimal('3000.00'),
                'requires_receipt': True,
            },
        ]

        for data in benefit_types:
            code = data.pop('code')
            self._update_or_create(BenefitType, {'code': code}, data)

    def _seed_expense_types(self):
        from benefits.models import ExpenseType

        expense_types = [
            {'code': 'TRAVEL', 'name': 'Travel Expenses', 'category': 'TRAVEL', 'requires_receipt': True},
            {'code': 'MEALS', 'name': 'Meals & Entertainment', 'category': 'MEALS', 'requires_receipt': True},
            {'code': 'ACCOMM', 'name': 'Accommodation', 'category': 'ACCOMMODATION', 'requires_receipt': True},
            {'code': 'FUEL', 'name': 'Fuel & Mileage', 'category': 'FUEL', 'requires_receipt': True},
            {'code': 'COMMS', 'name': 'Communication', 'category': 'COMMUNICATION', 'requires_receipt': True},
            {'code': 'OFFICE', 'name': 'Office Supplies', 'category': 'OFFICE', 'requires_receipt': True},
            {'code': 'TRAINING', 'name': 'Training Expenses', 'category': 'TRAINING', 'requires_receipt': True},
        ]

        for data in expense_types:
            code = data.pop('code')
            self._update_or_create(ExpenseType, {'code': code}, data)

    def _seed_funeral_grant_types(self):
        from benefits.models import CustomBenefitType

        funeral_grants = [
            {
                'code': 'FUN_SELF',
                'name': 'Funeral Grant - Self (Death in Service)',
                'description': 'Funeral grant payable upon death of employee in service',
                'category': 'GRANT',
                'max_amount': Decimal('5000.00'),
                'amount_calculation': 'FIXED',
                'max_occurrences': 1,
                'requires_receipt': True,
                'required_documents': ['Death Certificate', 'Burial Permit'],
            },
            {
                'code': 'FUN_SPOUSE',
                'name': 'Funeral Grant - Spouse',
                'description': 'Funeral grant for death of employee spouse',
                'category': 'GRANT',
                'max_amount': Decimal('3000.00'),
                'amount_calculation': 'FIXED',
                'max_occurrences': 1,
                'requires_receipt': True,
                'required_documents': ['Death Certificate', 'Marriage Certificate'],
            },
            {
                'code': 'FUN_CHILD',
                'name': 'Funeral Grant - Child',
                'description': 'Funeral grant for death of employee child',
                'category': 'GRANT',
                'max_amount': Decimal('2000.00'),
                'amount_calculation': 'FIXED',
                'max_occurrences': 3,
                'requires_receipt': True,
                'required_documents': ['Death Certificate', 'Birth Certificate'],
            },
            {
                'code': 'FUN_PARENT',
                'name': 'Funeral Grant - Parent',
                'description': 'Funeral grant for death of employee parent',
                'category': 'GRANT',
                'max_amount': Decimal('2000.00'),
                'amount_calculation': 'FIXED',
                'max_occurrences': 2,
                'requires_receipt': True,
                'required_documents': ['Death Certificate'],
            },
            {
                'code': 'FUN_DEP',
                'name': 'Funeral Grant - Dependent',
                'description': 'Funeral grant for death of registered dependent',
                'category': 'GRANT',
                'max_amount': Decimal('1500.00'),
                'amount_calculation': 'FIXED',
                'max_occurrences': 2,
                'requires_receipt': True,
                'required_documents': ['Death Certificate'],
            },
        ]

        for data in funeral_grants:
            code = data.pop('code')
            self._update_or_create(CustomBenefitType, {'code': code}, data)

    def _seed_medical_lens(self):
        from benefits.models import MedicalLensBenefit

        self._update_or_create(
            MedicalLensBenefit,
            {'code': 'MED_LENS'},
            {
                'name': 'Medical Lens Benefit',
                'max_amount': Decimal('500.00'),
                'eligibility_period_months': 24,
                'min_service_months': 6,
                'requires_prescription': True,
                'is_active': True,
            }
        )

    def _seed_third_party_lenders(self):
        from benefits.models import ThirdPartyLender

        lenders = [
            {
                'code': 'CREDIT_UNION',
                'name': 'Staff Credit Union',
                'lender_type': 'WELFARE',
                'description': 'Staff credit union savings and loan deductions',
                'remittance_frequency': 'MONTHLY',
            },
            {
                'code': 'SLTF',
                'name': 'Student Loan Trust Fund',
                'lender_type': 'OTHER',
                'description': 'Student loan repayment deductions',
                'remittance_frequency': 'MONTHLY',
            },
            {
                'code': 'MOW_RENT',
                'name': 'Ministry of Works (Rent)',
                'lender_type': 'RENT',
                'description': 'Government housing rent deductions',
                'default_deduction_percentage': Decimal('10.00'),
                'remittance_frequency': 'MONTHLY',
            },
        ]

        for data in lenders:
            code = data.pop('code')
            self._update_or_create(ThirdPartyLender, {'code': code}, data)
