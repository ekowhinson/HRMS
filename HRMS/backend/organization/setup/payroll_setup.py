"""
Payroll seeder: Tax brackets, SSNIT, pay components, banks, staff categories, payroll calendar.
Ghana 2026 statutory data.
"""

from datetime import date
from decimal import Decimal

from .base import BaseSeeder


class PayrollSeeder(BaseSeeder):
    module_name = 'payroll'

    def seed(self):
        self._seed_banks()
        self._seed_staff_categories()
        self._seed_pay_components()
        self._seed_tax_brackets()
        self._seed_ssnit_rates()
        self._seed_overtime_bonus_tax()
        self._seed_tax_reliefs()
        self._seed_payroll_calendar()
        return self.stats

    def _seed_banks(self):
        from payroll.models import Bank

        banks = [
            {'code': 'GCB', 'name': 'GCB Bank Limited', 'short_name': 'GCB', 'swift_code': 'GHCBGHAC'},
            {'code': 'ECO', 'name': 'Ecobank Ghana Limited', 'short_name': 'Ecobank', 'swift_code': 'EABORLAC'},
            {'code': 'STAN', 'name': 'Stanbic Bank Ghana Limited', 'short_name': 'Stanbic', 'swift_code': 'SBICGHAC'},
            {'code': 'CAL', 'name': 'CalBank Limited', 'short_name': 'CalBank', 'swift_code': 'ACABORAC'},
            {'code': 'FID', 'name': 'Fidelity Bank Ghana Limited', 'short_name': 'Fidelity', 'swift_code': 'FABORLAC'},
            {'code': 'SCB', 'name': 'Standard Chartered Bank Ghana', 'short_name': 'StanChart', 'swift_code': 'SCBLGHAC'},
            {'code': 'ABSA', 'name': 'Absa Bank Ghana Limited', 'short_name': 'Absa', 'swift_code': 'BABORLAC'},
            {'code': 'ADB', 'name': 'Agricultural Development Bank', 'short_name': 'ADB', 'swift_code': 'ADNTGHAC'},
            {'code': 'UBA', 'name': 'United Bank for Africa Ghana', 'short_name': 'UBA', 'swift_code': 'UNABORLAC'},
            {'code': 'REP', 'name': 'Republic Bank Ghana Limited', 'short_name': 'Republic', 'swift_code': 'FABORLAC'},
            {'code': 'ACC', 'name': 'Access Bank Ghana Plc', 'short_name': 'Access', 'swift_code': 'ABORLAC'},
            {'code': 'ZEN', 'name': 'Zenith Bank Ghana Limited', 'short_name': 'Zenith', 'swift_code': 'ZEBLGHAC'},
            {'code': 'SG', 'name': 'Societe Generale Ghana', 'short_name': 'SocGen', 'swift_code': 'SGGHGHAC'},
            {'code': 'PRU', 'name': 'Prudential Bank Limited', 'short_name': 'Prudential', 'swift_code': 'PABORLAC'},
            {'code': 'FAB', 'name': 'First Atlantic Bank Limited', 'short_name': 'FirstAtlantic', 'swift_code': 'FABORLAC'},
        ]

        for data in banks:
            code = data.pop('code')
            self._update_or_create(Bank, {'code': code}, data)

    def _seed_staff_categories(self):
        from payroll.models import StaffCategory

        categories = [
            {'code': 'DIST', 'name': 'District Staff', 'description': 'Staff deployed to district offices', 'payroll_group': 'Districts Payroll', 'sort_order': 1},
            {'code': 'HQ', 'name': 'Head Office Staff', 'description': 'Staff at headquarters/head office', 'payroll_group': 'HQ Payroll', 'sort_order': 2},
            {'code': 'CONTRACT', 'name': 'Contract Staff', 'description': 'Employees on fixed-term contracts', 'payroll_group': 'Contract Payroll', 'sort_order': 3},
            {'code': 'TEMP', 'name': 'Temporary Staff', 'description': 'Short-term temporary employees', 'payroll_group': 'Temporary Payroll', 'sort_order': 4},
        ]

        for data in categories:
            code = data.pop('code')
            self._update_or_create(StaffCategory, {'code': code}, data)

    def _seed_pay_components(self):
        from payroll.models import PayComponent

        components = [
            # Earnings
            {
                'code': 'BASIC', 'name': 'Basic Salary', 'short_name': 'Basic',
                'component_type': 'EARNING', 'calculation_type': 'FIXED', 'category': 'SALARY',
                'is_taxable': True, 'is_part_of_basic': True, 'is_part_of_gross': True,
                'affects_ssnit': True, 'is_statutory': False, 'is_recurring': True,
                'is_prorated': True, 'show_on_payslip': True, 'display_order': 1,
            },
            {
                'code': 'HOUSING_ALL', 'name': 'Housing Allowance', 'short_name': 'Housing',
                'component_type': 'EARNING', 'calculation_type': 'PCT_BASIC', 'category': 'ALLOWANCE',
                'is_taxable': True, 'is_part_of_basic': False, 'is_part_of_gross': True,
                'affects_ssnit': False, 'is_recurring': True, 'show_on_payslip': True, 'display_order': 2,
            },
            {
                'code': 'TRANSPORT_ALL', 'name': 'Transport Allowance', 'short_name': 'Transport',
                'component_type': 'EARNING', 'calculation_type': 'FIXED', 'category': 'ALLOWANCE',
                'is_taxable': True, 'is_part_of_basic': False, 'is_part_of_gross': True,
                'affects_ssnit': False, 'is_recurring': True, 'show_on_payslip': True, 'display_order': 3,
            },
            {
                'code': 'RISK_ALL', 'name': 'Risk Allowance', 'short_name': 'Risk',
                'component_type': 'EARNING', 'calculation_type': 'PCT_BASIC', 'category': 'ALLOWANCE',
                'is_taxable': True, 'is_part_of_basic': False, 'is_part_of_gross': True,
                'affects_ssnit': False, 'is_recurring': True, 'show_on_payslip': True, 'display_order': 4,
            },
            {
                'code': 'PROF_ALL', 'name': 'Professional Allowance', 'short_name': 'Prof. Allow',
                'component_type': 'EARNING', 'calculation_type': 'FIXED', 'category': 'ALLOWANCE',
                'is_taxable': True, 'is_part_of_basic': False, 'is_part_of_gross': True,
                'affects_ssnit': False, 'is_recurring': True, 'show_on_payslip': True, 'display_order': 5,
            },
            {
                'code': 'RESP_ALL', 'name': 'Responsibility Allowance', 'short_name': 'Resp. Allow',
                'component_type': 'EARNING', 'calculation_type': 'FIXED', 'category': 'ALLOWANCE',
                'is_taxable': True, 'is_part_of_basic': False, 'is_part_of_gross': True,
                'affects_ssnit': False, 'is_recurring': True, 'show_on_payslip': True, 'display_order': 6,
            },
            # Overtime
            {
                'code': 'OT_WEEKDAY', 'name': 'Overtime - Weekday', 'short_name': 'OT Weekday',
                'component_type': 'EARNING', 'calculation_type': 'FORMULA', 'category': 'OVERTIME',
                'is_taxable': True, 'is_overtime': True, 'is_part_of_gross': False,
                'is_recurring': False, 'show_on_payslip': True, 'display_order': 10,
            },
            {
                'code': 'OT_WEEKEND', 'name': 'Overtime - Weekend', 'short_name': 'OT Weekend',
                'component_type': 'EARNING', 'calculation_type': 'FORMULA', 'category': 'OVERTIME',
                'is_taxable': True, 'is_overtime': True, 'is_part_of_gross': False,
                'is_recurring': False, 'show_on_payslip': True, 'display_order': 11,
            },
            {
                'code': 'OT_HOLIDAY', 'name': 'Overtime - Holiday', 'short_name': 'OT Holiday',
                'component_type': 'EARNING', 'calculation_type': 'FORMULA', 'category': 'OVERTIME',
                'is_taxable': True, 'is_overtime': True, 'is_part_of_gross': False,
                'is_recurring': False, 'show_on_payslip': True, 'display_order': 12,
            },
            # Statutory deductions
            {
                'code': 'SSNIT_EMP', 'name': 'SSNIT Tier 1 (Employee)', 'short_name': 'SSNIT T1',
                'component_type': 'DEDUCTION', 'calculation_type': 'PCT_BASIC', 'category': 'STATUTORY',
                'percentage_value': Decimal('5.5000'),
                'is_taxable': False, 'reduces_taxable': True, 'affects_ssnit': True,
                'is_statutory': True, 'is_recurring': True, 'show_on_payslip': True, 'display_order': 20,
            },
            {
                'code': 'SSNIT_ER', 'name': 'SSNIT Tier 1 (Employer)', 'short_name': 'SSNIT Er',
                'component_type': 'DEDUCTION', 'calculation_type': 'PCT_BASIC', 'category': 'STATUTORY',
                'percentage_value': Decimal('13.0000'),
                'is_taxable': False, 'reduces_taxable': False, 'affects_ssnit': True,
                'is_statutory': True, 'is_recurring': True, 'show_on_payslip': False, 'display_order': 21,
            },
            {
                'code': 'TIER2_EMP', 'name': 'SSNIT Tier 2 (Employee)', 'short_name': 'Tier 2',
                'component_type': 'DEDUCTION', 'calculation_type': 'PCT_BASIC', 'category': 'STATUTORY',
                'percentage_value': Decimal('5.0000'),
                'is_taxable': False, 'reduces_taxable': True, 'affects_ssnit': True,
                'is_statutory': True, 'is_recurring': True, 'show_on_payslip': True, 'display_order': 22,
            },
            {
                'code': 'PAYE', 'name': 'Pay As You Earn (PAYE)', 'short_name': 'PAYE',
                'component_type': 'DEDUCTION', 'calculation_type': 'FORMULA', 'category': 'STATUTORY',
                'is_taxable': False, 'is_statutory': True, 'is_recurring': True,
                'show_on_payslip': True, 'display_order': 25,
            },
            # Tax on overtime/bonus
            {
                'code': 'OVERTIME_TAX', 'name': 'Overtime Tax', 'short_name': 'OT Tax',
                'component_type': 'DEDUCTION', 'calculation_type': 'FORMULA', 'category': 'STATUTORY',
                'is_taxable': False, 'is_statutory': True, 'is_recurring': False,
                'show_on_payslip': True, 'display_order': 26,
            },
            {
                'code': 'BONUS_TAX', 'name': 'Bonus Tax', 'short_name': 'Bonus Tax',
                'component_type': 'DEDUCTION', 'calculation_type': 'FORMULA', 'category': 'STATUTORY',
                'is_taxable': False, 'is_bonus': True, 'is_statutory': True, 'is_recurring': False,
                'show_on_payslip': True, 'display_order': 27,
            },
            # Loan deduction
            {
                'code': 'LOAN_DED', 'name': 'Loan Deduction', 'short_name': 'Loan',
                'component_type': 'DEDUCTION', 'calculation_type': 'FIXED', 'category': 'LOAN',
                'is_taxable': False, 'is_statutory': False, 'is_recurring': True,
                'show_on_payslip': True, 'display_order': 30,
            },
            # Third-party deduction
            {
                'code': '3RD_PARTY', 'name': 'Third Party Deduction', 'short_name': '3rd Party',
                'component_type': 'DEDUCTION', 'calculation_type': 'FIXED', 'category': 'OTHER',
                'is_taxable': False, 'is_statutory': False, 'is_recurring': True,
                'show_on_payslip': True, 'display_order': 35,
            },
        ]

        for data in components:
            code = data.pop('code')
            self._update_or_create(PayComponent, {'code': code}, data)

    def _seed_tax_brackets(self):
        from payroll.models import TaxBracket

        # Ghana PAYE 2026 monthly brackets
        brackets = [
            {'order': 1, 'min_amount': Decimal('0'), 'max_amount': Decimal('490.00'), 'rate': Decimal('0'), 'cumulative_tax': Decimal('0'), 'name': 'First GHS 490'},
            {'order': 2, 'min_amount': Decimal('490.00'), 'max_amount': Decimal('600.00'), 'rate': Decimal('5.00'), 'cumulative_tax': Decimal('5.50'), 'name': 'Next GHS 110'},
            {'order': 3, 'min_amount': Decimal('600.00'), 'max_amount': Decimal('730.00'), 'rate': Decimal('10.00'), 'cumulative_tax': Decimal('18.50'), 'name': 'Next GHS 130'},
            {'order': 4, 'min_amount': Decimal('730.00'), 'max_amount': Decimal('3896.67'), 'rate': Decimal('17.50'), 'cumulative_tax': Decimal('572.67'), 'name': 'Next GHS 3,166.67'},
            {'order': 5, 'min_amount': Decimal('3896.67'), 'max_amount': Decimal('19896.67'), 'rate': Decimal('25.00'), 'cumulative_tax': Decimal('4572.67'), 'name': 'Next GHS 16,000'},
            {'order': 6, 'min_amount': Decimal('19896.67'), 'max_amount': Decimal('50416.67'), 'rate': Decimal('30.00'), 'cumulative_tax': Decimal('13728.67'), 'name': 'Next GHS 30,520'},
            {'order': 7, 'min_amount': Decimal('50416.67'), 'max_amount': None, 'rate': Decimal('35.00'), 'cumulative_tax': Decimal('13728.67'), 'name': 'Exceeding GHS 50,416.67'},
        ]

        effective_from = date(self.year, 1, 1)
        effective_to = date(self.year, 12, 31)

        for data in brackets:
            order = data.pop('order')
            data['effective_from'] = effective_from
            data['effective_to'] = effective_to
            data['is_active'] = True
            self._update_or_create(
                TaxBracket,
                {'order': order, 'effective_from': effective_from},
                data
            )

    def _seed_ssnit_rates(self):
        from payroll.models import SSNITRate

        rates = [
            {
                'tier': 'TIER_1',
                'employee_rate': Decimal('5.50'),
                'employer_rate': Decimal('13.00'),
                'effective_from': date(self.year, 1, 1),
                'is_active': True,
            },
            {
                'tier': 'TIER_2',
                'employee_rate': Decimal('5.00'),
                'employer_rate': Decimal('0.00'),
                'effective_from': date(self.year, 1, 1),
                'is_active': True,
            },
            {
                'tier': 'TIER_3',
                'employee_rate': Decimal('5.00'),
                'employer_rate': Decimal('5.00'),
                'effective_from': date(self.year, 1, 1),
                'is_active': True,
            },
        ]

        for data in rates:
            tier = data.pop('tier')
            self._update_or_create(
                SSNITRate,
                {'tier': tier, 'effective_from': data['effective_from']},
                data
            )

    def _seed_overtime_bonus_tax(self):
        from payroll.models import OvertimeBonusTaxConfig

        data = {
            'name': f'Ghana Tax Configuration {self.year}',
            'overtime_annual_salary_threshold': Decimal('18000.00'),
            'overtime_basic_percentage_threshold': Decimal('50.00'),
            'overtime_rate_below_threshold': Decimal('5.00'),
            'overtime_rate_above_threshold': Decimal('10.00'),
            'bonus_annual_basic_percentage_threshold': Decimal('15.00'),
            'bonus_flat_rate': Decimal('5.00'),
            'bonus_excess_to_paye': True,
            'non_resident_overtime_rate': Decimal('20.00'),
            'non_resident_bonus_rate': Decimal('20.00'),
            'is_active': True,
        }

        self._update_or_create(
            OvertimeBonusTaxConfig,
            {'effective_from': date(self.year, 1, 1)},
            data
        )

    def _seed_tax_reliefs(self):
        from payroll.models import TaxRelief

        reliefs = [
            {
                'code': 'PERSONAL',
                'name': 'Personal Relief',
                'description': 'Standard personal tax relief',
                'relief_type': 'FIXED',
                'amount': Decimal('0'),
                'effective_from': date(self.year, 1, 1),
                'is_active': True,
            },
            {
                'code': 'DISABILITY',
                'name': 'Disability Relief',
                'description': '25% of assessable income for persons with disability',
                'relief_type': 'PERCENTAGE',
                'percentage': Decimal('25.00'),
                'effective_from': date(self.year, 1, 1),
                'is_active': True,
            },
        ]

        for data in reliefs:
            code = data.pop('code')
            self._update_or_create(TaxRelief, {'code': code}, data)

    def _seed_payroll_calendar(self):
        from payroll.models import PayrollCalendar, PayrollPeriod
        import calendar as cal_module

        for month in range(1, 13):
            last_day = cal_module.monthrange(self.year, month)[1]
            month_name = cal_module.month_name[month]

            # Create PayrollCalendar entry (one per month)
            cal_obj, _ = self._update_or_create(
                PayrollCalendar,
                {'year': self.year, 'month': month},
                {
                    'name': f'{month_name} {self.year}',
                    'start_date': date(self.year, month, 1),
                    'end_date': date(self.year, month, last_day),
                    'is_active': True,
                }
            )

            # Create corresponding PayrollPeriod
            self._update_or_create(
                PayrollPeriod,
                {'year': self.year, 'month': month, 'is_supplementary': False},
                {
                    'calendar': cal_obj,
                    'name': f'{month_name} {self.year}',
                    'start_date': date(self.year, month, 1),
                    'end_date': date(self.year, month, last_day),
                    'payment_date': date(self.year, month, min(25, last_day)),
                    'status': 'OPEN',
                }
            )
