"""
Seed command for NHIA-specific loan types.
"""

from django.core.management.base import BaseCommand
from benefits.models import LoanType


class Command(BaseCommand):
    help = 'Seed standard NHIA loan types'

    def handle(self, *args, **options):
        loan_types = [
            {
                'code': 'SAL-ADV',
                'name': 'Salary Advance',
                'description': 'Advance on salary up to 1 month gross, repayable over 12 months with no interest. '
                              'Requires 12-month wait after last deduction to apply again.',
                'max_salary_multiplier': 1,
                'salary_component': LoanType.SalaryComponent.GROSS,
                'max_tenure_months': 12,
                'min_tenure_months': 1,
                'interest_rate': 0,
                'interest_type': 'SIMPLE',
                'min_service_months': 6,
                'max_active_loans': 1,
                'cooldown_months': 12,
                'require_guarantor': False,
                'number_of_guarantors': 0,
                'max_deduction_percentage': 33.33,
                'approval_levels': 2,
                'auto_post_to_payroll': True,
                'is_active': True,
            },
            {
                'code': 'SPEC-ADV',
                'name': 'Special Advance',
                'description': 'Special advance up to 2 months basic salary, repayable over 24 months with no interest. '
                              'For emergencies and special circumstances.',
                'max_salary_multiplier': 2,
                'salary_component': LoanType.SalaryComponent.BASIC,
                'max_tenure_months': 24,
                'min_tenure_months': 6,
                'interest_rate': 0,
                'interest_type': 'SIMPLE',
                'min_service_months': 12,
                'max_active_loans': 1,
                'cooldown_months': 6,
                'require_guarantor': True,
                'number_of_guarantors': 1,
                'max_deduction_percentage': 25,
                'approval_levels': 3,
                'auto_post_to_payroll': True,
                'is_active': True,
            },
            {
                'code': 'CAR-LOAN',
                'name': 'Car Loan',
                'description': 'Vehicle financing loan up to 6 months gross salary, repayable over 60 months.',
                'max_salary_multiplier': 6,
                'salary_component': LoanType.SalaryComponent.GROSS,
                'max_tenure_months': 60,
                'min_tenure_months': 12,
                'interest_rate': 5,
                'interest_type': 'REDUCING',
                'min_service_months': 24,
                'max_active_loans': 1,
                'cooldown_months': 12,
                'require_guarantor': True,
                'number_of_guarantors': 2,
                'max_deduction_percentage': 40,
                'approval_levels': 3,
                'auto_post_to_payroll': True,
                'is_active': True,
            },
            {
                'code': 'HOUSE-LOAN',
                'name': 'Housing Loan',
                'description': 'Housing/mortgage loan up to 12 months gross salary, repayable over 120 months.',
                'max_salary_multiplier': 12,
                'salary_component': LoanType.SalaryComponent.GROSS,
                'max_tenure_months': 120,
                'min_tenure_months': 24,
                'interest_rate': 8,
                'interest_type': 'REDUCING',
                'min_service_months': 36,
                'max_active_loans': 1,
                'cooldown_months': 24,
                'require_guarantor': True,
                'number_of_guarantors': 2,
                'max_deduction_percentage': 40,
                'approval_levels': 4,
                'auto_post_to_payroll': True,
                'is_active': True,
            },
            {
                'code': 'PERS-LOAN',
                'name': 'Personal Loan',
                'description': 'General purpose personal loan up to 3 months net salary.',
                'max_salary_multiplier': 3,
                'salary_component': LoanType.SalaryComponent.NET,
                'max_tenure_months': 36,
                'min_tenure_months': 6,
                'interest_rate': 10,
                'interest_type': 'REDUCING',
                'min_service_months': 12,
                'max_active_loans': 1,
                'cooldown_months': 6,
                'require_guarantor': True,
                'number_of_guarantors': 1,
                'max_deduction_percentage': 33.33,
                'approval_levels': 2,
                'auto_post_to_payroll': True,
                'is_active': True,
            },
        ]

        created_count = 0
        updated_count = 0

        for loan_type_data in loan_types:
            code = loan_type_data['code']
            obj, created = LoanType.objects.update_or_create(
                code=code,
                defaults=loan_type_data
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created loan type: {obj.name}'))
            else:
                updated_count += 1
                self.stdout.write(self.style.WARNING(f'Updated loan type: {obj.name}'))

        self.stdout.write(self.style.SUCCESS(
            f'\nLoan types seeding complete: {created_count} created, {updated_count} updated'
        ))
