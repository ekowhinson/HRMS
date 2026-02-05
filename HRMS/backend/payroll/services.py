"""
Payroll computation services for NHIA HRMS.
Handles Ghana PAYE tax calculation, SSNIT contributions, and payroll processing.
"""

import csv
import io
import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from typing import Optional
from dataclasses import dataclass

from django.db import models, transaction
from django.db.models import Sum, Q
from django.utils import timezone
from django.core.files.base import ContentFile

from employees.models import Employee, BankAccount
from .models import (
    PayrollRun, PayrollPeriod, PayrollItem, PayrollItemDetail, PayrollApproval,
    EmployeeSalary, EmployeeSalaryComponent, PayComponent, AdHocPayment,
    TaxBracket, TaxRelief, SSNITRate, BankFile, Payslip, EmployeeTransaction,
    OvertimeBonusTaxConfig
)


@dataclass
class PayrollComputationResult:
    """Result of payroll computation for an employee."""
    success: bool
    employee_id: int
    basic_salary: Decimal = Decimal('0')
    gross_earnings: Decimal = Decimal('0')
    total_deductions: Decimal = Decimal('0')
    net_salary: Decimal = Decimal('0')
    taxable_income: Decimal = Decimal('0')
    paye: Decimal = Decimal('0')
    overtime_tax: Decimal = Decimal('0')
    bonus_tax: Decimal = Decimal('0')
    total_overtime: Decimal = Decimal('0')
    total_bonus: Decimal = Decimal('0')
    ssnit_employee: Decimal = Decimal('0')
    ssnit_employer: Decimal = Decimal('0')
    tier2_employer: Decimal = Decimal('0')
    employer_cost: Decimal = Decimal('0')
    error_message: Optional[str] = None


class PayrollService:
    """Service class for payroll computation and processing."""

    def __init__(self, payroll_run: PayrollRun):
        self.payroll_run = payroll_run
        self.period = payroll_run.payroll_period
        self._tax_brackets = None
        self._ssnit_rates = None
        self._tax_reliefs = None
        self._overtime_bonus_config = None

    @property
    def overtime_bonus_config(self):
        """Get active overtime/bonus tax configuration, cached."""
        if self._overtime_bonus_config is None:
            self._overtime_bonus_config = OvertimeBonusTaxConfig.get_active_config(
                as_of_date=self.period.end_date
            )
        return self._overtime_bonus_config

    @property
    def tax_brackets(self):
        """Get active tax brackets, cached."""
        if self._tax_brackets is None:
            self._tax_brackets = list(
                TaxBracket.objects.filter(
                    is_active=True,
                    effective_from__lte=self.period.end_date
                ).filter(
                    Q(effective_to__isnull=True) |
                    Q(effective_to__gte=self.period.start_date)
                ).order_by('order', 'min_amount')
            )
        return self._tax_brackets

    @property
    def ssnit_rates(self):
        """Get active SSNIT rates, cached."""
        if self._ssnit_rates is None:
            self._ssnit_rates = {
                rate.tier: rate for rate in SSNITRate.objects.filter(
                    is_active=True,
                    effective_from__lte=self.period.end_date
                ).filter(
                    Q(effective_to__isnull=True) |
                    Q(effective_to__gte=self.period.start_date)
                )
            }
        return self._ssnit_rates

    @property
    def tax_reliefs(self):
        """Get active tax reliefs, cached."""
        if self._tax_reliefs is None:
            self._tax_reliefs = list(
                TaxRelief.objects.filter(
                    is_active=True,
                    effective_from__lte=self.period.end_date
                ).filter(
                    Q(effective_to__isnull=True) |
                    Q(effective_to__gte=self.period.start_date)
                )
            )
        return self._tax_reliefs

    def calculate_paye(self, taxable_income: Decimal) -> Decimal:
        """
        Calculate Ghana PAYE tax using progressive tax brackets.

        Ghana PAYE is calculated on monthly taxable income after SSNIT deductions.
        Tax brackets are applied progressively.
        """
        if taxable_income <= 0:
            return Decimal('0')

        total_tax = Decimal('0')
        remaining_income = taxable_income

        for bracket in self.tax_brackets:
            if remaining_income <= 0:
                break

            bracket_min = bracket.min_amount
            bracket_max = bracket.max_amount

            if bracket_max is None:
                taxable_in_bracket = remaining_income
            else:
                bracket_range = bracket_max - bracket_min
                taxable_in_bracket = min(remaining_income, bracket_range)

            tax_in_bracket = taxable_in_bracket * (bracket.rate / Decimal('100'))
            total_tax += tax_in_bracket
            remaining_income -= taxable_in_bracket

        return total_tax.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def calculate_overtime_tax(
        self,
        overtime_amount: Decimal,
        basic_salary: Decimal,
        annual_salary: Decimal,
        is_resident: bool = True
    ) -> tuple[Decimal, bool]:
        """
        Calculate Ghana overtime tax using configurable rates.

        Ghana Overtime Tax Rules (per GRA):
        - Only junior staff earning up to annual threshold qualify for preferential rates
        - Residents (qualifying):
          - If overtime <= X% of monthly basic salary: lower rate
          - If overtime > X%: lower rate on first X%, higher rate on excess
        - Residents (non-qualifying): Overtime added to PAYE
        - Non-Residents: Flat rate

        Args:
            overtime_amount: Total overtime earnings for the month
            basic_salary: Employee's monthly basic salary
            annual_salary: Employee's annual salary for threshold check
            is_resident: Whether the employee is a Ghana tax resident

        Returns:
            Tuple of (overtime_tax, qualifies_for_preferential_rate)
            - If not qualifying, overtime should be added to taxable income for PAYE
        """
        if overtime_amount <= 0:
            return Decimal('0'), True

        config = self.overtime_bonus_config

        # Use default values if no configuration exists
        if config is None:
            # Fallback to hardcoded defaults
            annual_threshold = Decimal('18000')
            basic_pct_threshold = Decimal('50')
            rate_below = Decimal('5')
            rate_above = Decimal('10')
            non_resident_rate = Decimal('20')
        else:
            annual_threshold = config.overtime_annual_salary_threshold
            basic_pct_threshold = config.overtime_basic_percentage_threshold
            rate_below = config.overtime_rate_below_threshold
            rate_above = config.overtime_rate_above_threshold
            non_resident_rate = config.non_resident_overtime_rate

        # Non-resident flat rate
        if not is_resident:
            tax = overtime_amount * (non_resident_rate / Decimal('100'))
            return tax.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP), True

        # Check if employee qualifies for preferential overtime tax rates
        # Only junior staff earning up to the annual threshold qualify
        if annual_salary > annual_threshold:
            # Does NOT qualify - overtime will be added to regular taxable income
            return Decimal('0'), False

        # Qualifies for preferential rates - calculate overtime tax
        threshold = basic_salary * (basic_pct_threshold / Decimal('100'))

        if overtime_amount <= threshold:
            # All overtime taxed at lower rate
            tax = overtime_amount * (rate_below / Decimal('100'))
        else:
            # First portion at lower rate, excess at higher rate
            tax_on_threshold = threshold * (rate_below / Decimal('100'))
            excess = overtime_amount - threshold
            tax_on_excess = excess * (rate_above / Decimal('100'))
            tax = tax_on_threshold + tax_on_excess

        return tax.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP), True

    def calculate_bonus_tax(self, bonus_amount: Decimal, annual_basic_salary: Decimal, is_resident: bool = True) -> tuple[Decimal, Decimal]:
        """
        Calculate Ghana bonus tax using configurable rates.

        Ghana Bonus Tax Rules (per GRA):
        - Residents:
          - Bonus up to X% of annual basic salary: flat tax rate
          - Excess over X%: Added to regular income and taxed progressively (if configured)
        - Non-Residents: Flat rate

        Args:
            bonus_amount: Total bonus amount
            annual_basic_salary: Employee's annual basic salary (monthly * 12)
            is_resident: Whether the employee is a Ghana tax resident

        Returns:
            Tuple of (bonus_tax, excess_to_add_to_income)
            - bonus_tax: The flat tax on eligible bonus
            - excess_to_add_to_income: Amount to add to regular taxable income
        """
        if bonus_amount <= 0:
            return Decimal('0'), Decimal('0')

        config = self.overtime_bonus_config

        # Use default values if no configuration exists
        if config is None:
            # Fallback to hardcoded defaults
            annual_basic_pct_threshold = Decimal('15')
            flat_rate = Decimal('5')
            excess_to_paye = True
            non_resident_rate = Decimal('20')
        else:
            annual_basic_pct_threshold = config.bonus_annual_basic_percentage_threshold
            flat_rate = config.bonus_flat_rate
            excess_to_paye = config.bonus_excess_to_paye
            non_resident_rate = config.non_resident_bonus_rate

        # Non-resident flat rate
        if not is_resident:
            tax = bonus_amount * (non_resident_rate / Decimal('100'))
            return tax.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP), Decimal('0')

        # Resident bonus tax calculation
        threshold = annual_basic_salary * (annual_basic_pct_threshold / Decimal('100'))

        if bonus_amount <= threshold:
            # All bonus taxed at flat rate
            tax = bonus_amount * (flat_rate / Decimal('100'))
            excess = Decimal('0')
        else:
            # First portion taxed at flat rate
            tax = threshold * (flat_rate / Decimal('100'))
            # Excess handling
            if excess_to_paye:
                excess = bonus_amount - threshold
            else:
                # Tax entire bonus at flat rate
                tax = bonus_amount * (flat_rate / Decimal('100'))
                excess = Decimal('0')

        return tax.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP), excess

    def calculate_ssnit(self, basic_salary: Decimal) -> tuple[Decimal, Decimal, Decimal]:
        """
        Calculate SSNIT contributions (Tier 1 and Tier 2).

        Returns: (employee_contribution, employer_tier1, employer_tier2)

        Ghana SSNIT:
        - Tier 1 (SSNIT): Employer 13%, Employee 5.5%
        - Tier 2 (Occupational): Employer 5%
        """
        tier1_rate = self.ssnit_rates.get('TIER_1')
        tier2_rate = self.ssnit_rates.get('TIER_2')

        employee_contribution = Decimal('0')
        employer_tier1 = Decimal('0')
        employer_tier2 = Decimal('0')

        if tier1_rate:
            employee_contribution = (basic_salary * tier1_rate.employee_rate / Decimal('100'))
            employer_tier1 = (basic_salary * tier1_rate.employer_rate / Decimal('100'))

            if tier1_rate.max_contribution:
                employee_contribution = min(employee_contribution, tier1_rate.max_contribution)

        if tier2_rate:
            employer_tier2 = (basic_salary * tier2_rate.employer_rate / Decimal('100'))

        return (
            employee_contribution.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            employer_tier1.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            employer_tier2.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        )

    def get_eligible_employees(self):
        """Get all employees eligible for this payroll run."""
        return Employee.objects.filter(
            status__in=['ACTIVE', 'ON_LEAVE', 'PROBATION', 'NOTICE'],
            date_of_joining__lte=self.period.end_date
        ).select_related(
            'department', 'position', 'grade'
        ).prefetch_related(
            'salaries', 'bank_accounts'
        )

    def get_employee_salary(self, employee: Employee) -> Optional[EmployeeSalary]:
        """Get the current salary for an employee."""
        try:
            return EmployeeSalary.objects.get(
                employee=employee,
                is_current=True,
                effective_from__lte=self.period.end_date
            )
        except EmployeeSalary.DoesNotExist:
            return None

    def get_adhoc_payments(self, employee: Employee) -> list[AdHocPayment]:
        """Get approved ad-hoc payments for the employee in this period."""
        return list(AdHocPayment.objects.filter(
            employee=employee,
            payroll_period=self.period,
            status='APPROVED'
        ).select_related('pay_component'))

    def get_active_transactions(self, employee: Employee) -> list[EmployeeTransaction]:
        """
        Get all active employee transactions effective for this payroll period.

        Includes:
        - ACTIVE status transactions
        - Recurring transactions where effective_from <= period end
        - One-time transactions specifically for this period
        """
        return list(EmployeeTransaction.objects.filter(
            employee=employee,
            status='ACTIVE',
            effective_from__lte=self.period.end_date
        ).filter(
            # Either no end date (ongoing) or end date is after period start
            Q(effective_to__isnull=True) | Q(effective_to__gte=self.period.start_date)
        ).filter(
            # Either recurring OR one-time for this specific period
            Q(is_recurring=True) | Q(payroll_period=self.period)
        ).select_related('pay_component'))

    def calculate_tax_relief(self, gross_salary: Decimal) -> Decimal:
        """
        Calculate total tax relief amount.

        Tax reliefs reduce taxable income before PAYE calculation.
        """
        total_relief = Decimal('0')

        for relief in self.tax_reliefs:
            if relief.relief_type == 'FIXED':
                amount = relief.amount or Decimal('0')
            elif relief.relief_type == 'PERCENTAGE':
                pct = relief.percentage or Decimal('0')
                amount = (gross_salary * pct / Decimal('100'))
                # Apply cap if specified
                if relief.max_amount:
                    amount = min(amount, relief.max_amount)
            else:
                amount = Decimal('0')

            total_relief += amount

        return total_relief.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def compute_employee_payroll(self, employee: Employee) -> PayrollComputationResult:
        """
        Compute payroll for a single employee.

        Ghana Payroll Tax Rules Applied:
        1. Regular earnings: Taxed progressively via PAYE brackets
        2. Overtime: Taxed separately at flat rates (5%/10% for residents, 20% for non-residents)
        3. Bonus: 5% flat tax up to 15% of annual basic; excess added to PAYE
        4. Non-taxable earnings: Excluded from taxable income
        5. Pre-tax deductions (reduces_taxable): Reduce taxable income before PAYE
        6. Tax reliefs: Applied to reduce taxable income
        """
        salary = self.get_employee_salary(employee)
        if not salary:
            return PayrollComputationResult(
                success=False,
                employee_id=employee.id,
                error_message='No active salary record found'
            )

        basic_salary = salary.basic_salary
        annual_basic_salary = basic_salary * Decimal('12')

        # Determine if employee is a tax resident (default to True if not specified)
        is_resident = getattr(employee, 'is_tax_resident', True)

        # Track earnings by category for proper tax treatment
        regular_taxable_earnings = Decimal('0')  # Subject to progressive PAYE
        non_taxable_earnings = Decimal('0')  # Exempt from all tax
        overtime_earnings = Decimal('0')  # Subject to overtime tax rates
        bonus_earnings = Decimal('0')  # Subject to bonus tax rates
        pre_tax_deductions = Decimal('0')  # Deductions that reduce taxable income
        other_deductions = Decimal('0')  # Regular deductions (after tax)
        employer_contributions = Decimal('0')  # Track employer contributions separately
        details = []

        # Helper function to categorize earnings
        def add_earning(component, amount):
            nonlocal regular_taxable_earnings, non_taxable_earnings, overtime_earnings, bonus_earnings

            if component.is_overtime:
                overtime_earnings += amount
            elif component.is_bonus:
                bonus_earnings += amount
            elif component.is_taxable:
                regular_taxable_earnings += amount
            else:
                non_taxable_earnings += amount

        # Helper function to categorize deductions
        def add_deduction(component, amount):
            nonlocal pre_tax_deductions, other_deductions

            if component.reduces_taxable:
                pre_tax_deductions += amount
            else:
                other_deductions += amount

        # Process basic salary
        basic_component = PayComponent.objects.filter(code='BASIC', is_active=True).first()
        if basic_component:
            details.append({
                'pay_component': basic_component,
                'amount': basic_salary,
                'quantity': Decimal('1'),
            })
            add_earning(basic_component, basic_salary)

        # Process salary components
        salary_components = EmployeeSalaryComponent.objects.filter(
            employee_salary=salary,
            is_active=True
        ).select_related('pay_component')

        for comp in salary_components:
            if comp.pay_component.code == 'BASIC':
                continue

            amount = comp.amount
            details.append({
                'pay_component': comp.pay_component,
                'amount': amount,
                'quantity': Decimal('1'),
            })

            if comp.pay_component.component_type == 'EARNING':
                add_earning(comp.pay_component, amount)
            elif comp.pay_component.component_type == 'DEDUCTION':
                add_deduction(comp.pay_component, amount)
            elif comp.pay_component.component_type == 'EMPLOYER':
                employer_contributions += amount

        # Calculate gross earnings (all earnings regardless of tax treatment)
        earnings = regular_taxable_earnings + non_taxable_earnings + overtime_earnings + bonus_earnings

        # Process ad-hoc payments
        adhoc_payments = self.get_adhoc_payments(employee)
        for adhoc in adhoc_payments:
            details.append({
                'pay_component': adhoc.pay_component,
                'amount': adhoc.amount,
                'quantity': Decimal('1'),
                'notes': adhoc.description,
            })

            if adhoc.pay_component.component_type == 'EARNING':
                # Check special tax treatment flags first, then fall back to is_taxable
                if adhoc.pay_component.is_overtime:
                    overtime_earnings += adhoc.amount
                elif adhoc.pay_component.is_bonus:
                    bonus_earnings += adhoc.amount
                elif adhoc.is_taxable:  # Ad-hoc payments have their own is_taxable flag
                    regular_taxable_earnings += adhoc.amount
                else:
                    non_taxable_earnings += adhoc.amount
                earnings += adhoc.amount
            elif adhoc.pay_component.component_type == 'DEDUCTION':
                add_deduction(adhoc.pay_component, adhoc.amount)
            elif adhoc.pay_component.component_type == 'EMPLOYER':
                employer_contributions += adhoc.amount

        # Process active employee transactions (recurring and one-time)
        active_transactions = self.get_active_transactions(employee)
        for txn in active_transactions:
            # Skip if component is already handled by salary components (avoid duplicates)
            existing_codes = {comp.pay_component.code for comp in salary_components}
            if txn.pay_component.code in existing_codes:
                continue

            # Calculate the transaction amount
            txn_amount = txn.calculate_amount(basic_salary, earnings)

            if txn_amount > 0:
                details.append({
                    'pay_component': txn.pay_component,
                    'amount': txn_amount,
                    'quantity': Decimal('1'),
                    'notes': f'{txn.reference_number}: {txn.description or ""}',
                })

                if txn.pay_component.component_type == 'EARNING':
                    add_earning(txn.pay_component, txn_amount)
                    earnings += txn_amount
                elif txn.pay_component.component_type == 'DEDUCTION':
                    add_deduction(txn.pay_component, txn_amount)
                elif txn.pay_component.component_type == 'EMPLOYER':
                    employer_contributions += txn_amount

        gross_earnings = earnings

        # Calculate SSNIT contributions
        ssnit_employee, ssnit_employer, tier2_employer = self.calculate_ssnit(basic_salary)

        # Calculate tax relief
        tax_relief = self.calculate_tax_relief(gross_earnings)

        # Calculate Overtime Tax (separate from PAYE for qualifying employees)
        # Only employees earning up to the annual threshold qualify for preferential rates
        # Non-qualifying employees have overtime added to PAYE instead
        overtime_tax, overtime_qualifies = self.calculate_overtime_tax(
            overtime_earnings, basic_salary, annual_basic_salary, is_resident
        )
        overtime_to_paye = Decimal('0')
        if not overtime_qualifies:
            # Employee doesn't qualify for preferential overtime tax
            # Overtime should be added to taxable income for progressive PAYE
            overtime_to_paye = overtime_earnings

        # Calculate Bonus Tax (separate from PAYE)
        # Bonus tax returns: (flat_tax, excess_to_add_to_income)
        bonus_tax, bonus_excess = self.calculate_bonus_tax(bonus_earnings, annual_basic_salary, is_resident)

        # Calculate Taxable Income for PAYE
        # Taxable = Regular Taxable Earnings + Overtime (if not qualifying) + Bonus Excess
        #           - SSNIT Employee - Tax Relief - Pre-tax Deductions
        # Note: Qualifying overtime, Bonus (up to threshold), and Non-taxable earnings are excluded
        taxable_income = (
            regular_taxable_earnings +
            overtime_to_paye +  # Only added if employee doesn't qualify for preferential OT rates
            bonus_excess -
            ssnit_employee -
            tax_relief -
            pre_tax_deductions
        )
        taxable_income = max(taxable_income, Decimal('0'))  # Ensure non-negative

        # Calculate PAYE on taxable income
        paye = self.calculate_paye(taxable_income)

        # Add statutory deduction details
        ssnit_component = PayComponent.objects.filter(code='SSNIT_EMP', is_active=True).first()
        if ssnit_component:
            details.append({
                'pay_component': ssnit_component,
                'amount': ssnit_employee,
                'quantity': Decimal('1'),
            })

        paye_component = PayComponent.objects.filter(code='PAYE', is_active=True).first()
        if paye_component:
            details.append({
                'pay_component': paye_component,
                'amount': paye,
                'quantity': Decimal('1'),
            })

        # Add overtime tax as a detail if applicable
        if overtime_tax > 0:
            overtime_tax_component = PayComponent.objects.filter(code='OVERTIME_TAX', is_active=True).first()
            if overtime_tax_component:
                details.append({
                    'pay_component': overtime_tax_component,
                    'amount': overtime_tax,
                    'quantity': Decimal('1'),
                    'notes': f'Overtime: GHS {overtime_earnings} (5%/10% rate)',
                })

        # Add bonus tax as a detail if applicable
        if bonus_tax > 0:
            bonus_tax_component = PayComponent.objects.filter(code='BONUS_TAX', is_active=True).first()
            if bonus_tax_component:
                details.append({
                    'pay_component': bonus_tax_component,
                    'amount': bonus_tax,
                    'quantity': Decimal('1'),
                    'notes': f'Bonus: GHS {bonus_earnings} (5% flat rate)',
                })

        # Total deductions = Other deductions + Pre-tax deductions + SSNIT + PAYE + Overtime Tax + Bonus Tax
        total_deductions = other_deductions + pre_tax_deductions + ssnit_employee + paye + overtime_tax + bonus_tax
        net_salary = gross_earnings - total_deductions

        # Employer cost includes gross salary, SSNIT contributions, and any employer-type transactions
        employer_cost = gross_earnings + ssnit_employer + tier2_employer + employer_contributions

        return PayrollComputationResult(
            success=True,
            employee_id=employee.id,
            basic_salary=basic_salary,
            gross_earnings=gross_earnings,
            total_deductions=total_deductions,
            net_salary=net_salary,
            taxable_income=taxable_income,
            paye=paye,
            overtime_tax=overtime_tax,
            bonus_tax=bonus_tax,
            total_overtime=overtime_earnings,
            total_bonus=bonus_earnings,
            ssnit_employee=ssnit_employee,
            ssnit_employer=ssnit_employer,
            tier2_employer=tier2_employer,
            employer_cost=employer_cost,
        ), details

    @transaction.atomic
    def compute_payroll(self, user) -> dict:
        """
        Compute payroll for all eligible employees.
        Returns summary statistics.

        Allows recomputation for:
        - DRAFT: Initial computation
        - COMPUTED: Rerun to pick up changes (transactions, salaries, etc.)
        - REJECTED: Recompute after corrections
        """
        allowed_statuses = ['DRAFT', 'COMPUTED', 'REJECTED']
        if self.payroll_run.status not in allowed_statuses:
            raise ValueError(
                f'Cannot compute payroll in status: {self.payroll_run.status}. '
                f'Payroll must be in one of: {", ".join(allowed_statuses)}'
            )

        # Ensure the payroll period is still open for processing
        closed_period_statuses = ['PAID', 'CLOSED']
        if self.period.status in closed_period_statuses:
            raise ValueError(
                f'Cannot compute payroll for {self.period.status.lower()} period. '
                f'The payroll period must be open for recomputation.'
            )

        # Clear existing payroll items before recomputation
        PayrollItem.objects.filter(payroll_run=self.payroll_run).delete()

        self.payroll_run.status = PayrollRun.Status.COMPUTING
        self.payroll_run.save(update_fields=['status'])

        employees = self.get_eligible_employees()
        total_employees = 0
        total_gross = Decimal('0')
        total_deductions = Decimal('0')
        total_net = Decimal('0')
        total_employer_cost = Decimal('0')
        total_paye = Decimal('0')
        total_overtime_tax = Decimal('0')
        total_bonus_tax = Decimal('0')
        total_ssnit_employee = Decimal('0')
        total_ssnit_employer = Decimal('0')
        total_tier2_employer = Decimal('0')
        errors = []

        for employee in employees:
            result = self.compute_employee_payroll(employee)

            if isinstance(result, tuple):
                computation, details = result
            else:
                computation = result
                details = []

            bank_account = BankAccount.objects.filter(
                employee=employee,
                is_primary=True,
                is_active=True
            ).first()

            payroll_item = PayrollItem.objects.create(
                payroll_run=self.payroll_run,
                employee=employee,
                employee_salary=self.get_employee_salary(employee),
                status=PayrollItem.Status.COMPUTED if computation.success else PayrollItem.Status.ERROR,
                basic_salary=computation.basic_salary,
                gross_earnings=computation.gross_earnings,
                total_deductions=computation.total_deductions,
                net_salary=computation.net_salary,
                employer_cost=computation.employer_cost,
                taxable_income=computation.taxable_income,
                paye=computation.paye,
                overtime_tax=computation.overtime_tax,
                bonus_tax=computation.bonus_tax,
                total_overtime=computation.total_overtime,
                total_bonus=computation.total_bonus,
                ssnit_employee=computation.ssnit_employee,
                ssnit_employer=computation.ssnit_employer,
                tier2_employer=computation.tier2_employer,
                bank_name=bank_account.bank_name if bank_account else None,
                bank_account_number=bank_account.account_number if bank_account else None,
                bank_branch=bank_account.branch_name if bank_account else None,
                error_message=computation.error_message,
            )

            for detail in details:
                PayrollItemDetail.objects.create(
                    payroll_item=payroll_item,
                    **detail
                )

            if computation.success:
                total_employees += 1
                total_gross += computation.gross_earnings
                total_deductions += computation.total_deductions
                total_net += computation.net_salary
                total_employer_cost += computation.employer_cost
                total_paye += computation.paye
                total_overtime_tax += computation.overtime_tax
                total_bonus_tax += computation.bonus_tax
                total_ssnit_employee += computation.ssnit_employee
                total_ssnit_employer += computation.ssnit_employer
                total_tier2_employer += computation.tier2_employer
            else:
                errors.append({
                    'employee_id': employee.id,
                    'employee_number': employee.employee_number,
                    'error': computation.error_message
                })

        self.payroll_run.status = PayrollRun.Status.COMPUTED
        self.payroll_run.total_employees = total_employees
        self.payroll_run.total_gross = total_gross
        self.payroll_run.total_deductions = total_deductions
        self.payroll_run.total_net = total_net
        self.payroll_run.total_employer_cost = total_employer_cost
        self.payroll_run.total_paye = total_paye
        self.payroll_run.total_overtime_tax = total_overtime_tax
        self.payroll_run.total_bonus_tax = total_bonus_tax
        self.payroll_run.total_ssnit_employee = total_ssnit_employee
        self.payroll_run.total_ssnit_employer = total_ssnit_employer
        self.payroll_run.total_tier2_employer = total_tier2_employer
        self.payroll_run.computed_by = user
        self.payroll_run.computed_at = timezone.now()
        self.payroll_run.save()

        return {
            'total_employees': total_employees,
            'total_gross': str(total_gross),
            'total_deductions': str(total_deductions),
            'total_net': str(total_net),
            'total_employer_cost': str(total_employer_cost),
            'total_paye': str(total_paye),
            'total_ssnit_employee': str(total_ssnit_employee),
            'total_ssnit_employer': str(total_ssnit_employer),
            'total_tier2_employer': str(total_tier2_employer),
            'errors': errors,
        }

    @transaction.atomic
    def approve_payroll(self, user, comments: str = None) -> dict:
        """Approve the payroll run."""
        if self.payroll_run.status != PayrollRun.Status.COMPUTED:
            raise ValueError(f'Cannot approve payroll in status: {self.payroll_run.status}')

        error_items = PayrollItem.objects.filter(
            payroll_run=self.payroll_run,
            status=PayrollItem.Status.ERROR
        ).count()

        if error_items > 0:
            raise ValueError(f'Cannot approve payroll with {error_items} items in error')

        PayrollApproval.objects.create(
            payroll_run=self.payroll_run,
            level=1,
            approver=user,
            action='APPROVE',
            comments=comments
        )

        PayrollItem.objects.filter(
            payroll_run=self.payroll_run,
            status=PayrollItem.Status.COMPUTED
        ).update(status=PayrollItem.Status.APPROVED)

        self.payroll_run.status = PayrollRun.Status.APPROVED
        self.payroll_run.approved_by = user
        self.payroll_run.approved_at = timezone.now()
        self.payroll_run.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])

        return {
            'status': 'approved',
            'approved_by': user.email,
            'approved_at': self.payroll_run.approved_at.isoformat(),
        }

    @transaction.atomic
    def reject_payroll(self, user, comments: str) -> dict:
        """Reject the payroll run and return for correction."""
        if self.payroll_run.status not in [PayrollRun.Status.COMPUTED, PayrollRun.Status.REVIEWING]:
            raise ValueError(f'Cannot reject payroll in status: {self.payroll_run.status}')

        PayrollApproval.objects.create(
            payroll_run=self.payroll_run,
            level=1,
            approver=user,
            action='REJECT',
            comments=comments
        )

        self.payroll_run.status = PayrollRun.Status.REJECTED
        self.payroll_run.save(update_fields=['status', 'updated_at'])

        return {
            'status': 'rejected',
            'rejected_by': user.email,
            'comments': comments,
        }

    @transaction.atomic
    def process_payment(self, user, payment_reference: str = None) -> dict:
        """Mark the payroll as paid."""
        if self.payroll_run.status != PayrollRun.Status.APPROVED:
            raise ValueError(f'Cannot process payment for payroll in status: {self.payroll_run.status}')

        self.payroll_run.status = PayrollRun.Status.PROCESSING_PAYMENT
        self.payroll_run.save(update_fields=['status', 'updated_at'])

        payment_date = timezone.now().date()
        reference = payment_reference or f'PAY-{self.payroll_run.run_number}-{payment_date.strftime("%Y%m%d")}'

        PayrollItem.objects.filter(
            payroll_run=self.payroll_run,
            status=PayrollItem.Status.APPROVED
        ).update(
            status=PayrollItem.Status.PAID,
            payment_date=payment_date,
            payment_reference=reference
        )

        AdHocPayment.objects.filter(
            payroll_period=self.period,
            status='APPROVED'
        ).update(
            status='PROCESSED',
            processed_at=timezone.now()
        )

        self.payroll_run.status = PayrollRun.Status.PAID
        self.payroll_run.paid_at = timezone.now()
        self.payroll_run.save(update_fields=['status', 'paid_at', 'updated_at'])

        self.period.status = PayrollPeriod.Status.PAID
        self.period.payment_date = payment_date
        self.period.save(update_fields=['status', 'payment_date', 'updated_at'])

        paid_count = PayrollItem.objects.filter(
            payroll_run=self.payroll_run,
            status=PayrollItem.Status.PAID
        ).count()

        return {
            'status': 'paid',
            'payment_date': payment_date.isoformat(),
            'payment_reference': reference,
            'employees_paid': paid_count,
            'total_amount': str(self.payroll_run.total_net),
        }

    def generate_bank_file(self, user, file_format: str = 'CSV') -> BankFile:
        """Generate bank payment file grouped by bank."""
        if self.payroll_run.status not in [PayrollRun.Status.APPROVED, PayrollRun.Status.PAID]:
            raise ValueError(f'Cannot generate bank file for payroll in status: {self.payroll_run.status}')

        items = PayrollItem.objects.filter(
            payroll_run=self.payroll_run,
            status__in=[PayrollItem.Status.APPROVED, PayrollItem.Status.PAID],
            bank_account_number__isnull=False
        ).select_related('employee').order_by('bank_name', 'employee__employee_number')

        banks = {}
        for item in items:
            bank_name = item.bank_name or 'UNKNOWN'
            if bank_name not in banks:
                banks[bank_name] = []
            banks[bank_name].append(item)

        bank_files = []

        for bank_name, bank_items in banks.items():
            output = io.StringIO()
            writer = csv.writer(output)

            writer.writerow([
                'Employee Number',
                'Employee Name',
                'Bank Account',
                'Bank Branch',
                'Amount',
                'Reference'
            ])

            total_amount = Decimal('0')
            for item in bank_items:
                writer.writerow([
                    item.employee.employee_number,
                    item.employee.full_name,
                    item.bank_account_number,
                    item.bank_branch or '',
                    str(item.net_salary),
                    f'{self.payroll_run.run_number}-{item.employee.employee_number}'
                ])
                total_amount += item.net_salary

            file_content = output.getvalue()
            safe_bank_name = bank_name.replace(' ', '_').replace('/', '_')
            file_name = f'{self.payroll_run.run_number}_{safe_bank_name}_{date.today().strftime("%Y%m%d")}.csv'

            bank_file = BankFile(
                payroll_run=self.payroll_run,
                bank_name=bank_name,
                file_name=file_name,
                file_format='CSV',
                total_amount=total_amount,
                transaction_count=len(bank_items),
                generated_by=user,
            )
            bank_file.file.save(file_name, ContentFile(file_content.encode('utf-8')))
            bank_file.save()
            bank_files.append(bank_file)

        return bank_files

    def generate_payslips(self, user) -> list[Payslip]:
        """Generate payslips for all employees in the payroll run."""
        if self.payroll_run.status not in [PayrollRun.Status.COMPUTED, PayrollRun.Status.APPROVED, PayrollRun.Status.PAID]:
            raise ValueError(f'Cannot generate payslips for payroll in status: {self.payroll_run.status}')

        items = PayrollItem.objects.filter(
            payroll_run=self.payroll_run
        ).exclude(
            status=PayrollItem.Status.ERROR
        ).select_related(
            'employee', 'employee__department', 'employee__position'
        ).prefetch_related('details', 'details__pay_component')

        payslips = []

        for item in items:
            if hasattr(item, 'payslip'):
                continue

            payslip_number = f'PS-{self.payroll_run.run_number}-{item.employee.employee_number}'

            payslip_content = self._generate_payslip_content(item)

            payslip = Payslip(
                payroll_item=item,
                payslip_number=payslip_number,
            )
            file_name = f'{payslip_number}.txt'
            payslip.file.save(file_name, ContentFile(payslip_content.encode('utf-8')))
            payslip.save()
            payslips.append(payslip)

        return payslips

    def _generate_payslip_content(self, item: PayrollItem) -> str:
        """Generate payslip content as text (placeholder for PDF generation)."""
        lines = [
            '=' * 60,
            'NATIONAL HEALTH INSURANCE AUTHORITY',
            'PAYSLIP',
            '=' * 60,
            '',
            f'Period: {self.period.name}',
            f'Payment Date: {item.payment_date or "Pending"}',
            '',
            '-' * 60,
            'EMPLOYEE DETAILS',
            '-' * 60,
            f'Employee Number: {item.employee.employee_number}',
            f'Name: {item.employee.full_name}',
            f'Department: {item.employee.department.name}',
            f'Position: {item.employee.position.title}',
            '',
            '-' * 60,
            'EARNINGS',
            '-' * 60,
        ]

        for detail in item.details.all():
            if detail.pay_component.component_type == 'EARNING':
                lines.append(f'{detail.pay_component.name:40} GHS {detail.amount:>12,.2f}')

        lines.extend([
            '-' * 60,
            f'{"GROSS EARNINGS":40} GHS {item.gross_earnings:>12,.2f}',
            '',
            '-' * 60,
            'DEDUCTIONS',
            '-' * 60,
        ])

        for detail in item.details.all():
            if detail.pay_component.component_type == 'DEDUCTION':
                lines.append(f'{detail.pay_component.name:40} GHS {detail.amount:>12,.2f}')

        lines.extend([
            f'{"SSNIT (Employee)":40} GHS {item.ssnit_employee:>12,.2f}',
            f'{"PAYE Tax":40} GHS {item.paye:>12,.2f}',
            '-' * 60,
            f'{"TOTAL DEDUCTIONS":40} GHS {item.total_deductions:>12,.2f}',
            '',
            '=' * 60,
            f'{"NET SALARY":40} GHS {item.net_salary:>12,.2f}',
            '=' * 60,
            '',
            'BANK DETAILS',
            f'Bank: {item.bank_name or "N/A"}',
            f'Account: {item.bank_account_number or "N/A"}',
            '',
            '-' * 60,
            'EMPLOYER CONTRIBUTIONS',
            '-' * 60,
            f'{"SSNIT Tier 1 (Employer)":40} GHS {item.ssnit_employer:>12,.2f}',
            f'{"SSNIT Tier 2 (Employer)":40} GHS {item.tier2_employer:>12,.2f}',
            f'{"TOTAL EMPLOYER COST":40} GHS {item.employer_cost:>12,.2f}',
            '',
            '=' * 60,
            'This is a computer-generated document.',
            '=' * 60,
        ]
        )

        return '\n'.join(lines)
