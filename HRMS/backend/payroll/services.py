"""
Payroll computation services for NHIA HRMS.
Handles Ghana PAYE tax calculation, SSNIT contributions, and payroll processing.
"""

import csv
import io
import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import date, timedelta
from typing import Optional
from dataclasses import dataclass

from django.db import models, transaction
from django.db.models import Sum, Q
from django.utils import timezone
from django.core.files.base import ContentFile
from django.conf import settings
from django.core.cache import cache

from employees.models import Employee, BankAccount
from .models import (
    PayrollRun, PayrollPeriod, PayrollItem, PayrollItemDetail, PayrollApproval,
    EmployeeSalary, EmployeeSalaryComponent, PayComponent, AdHocPayment,
    TaxBracket, TaxRelief, SSNITRate, BankFile, Payslip, EmployeeTransaction,
    OvertimeBonusTaxConfig, BackpayRequest
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
    proration_factor: Decimal = Decimal('1')
    days_payable: int = 0
    total_days: int = 0
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
        return EmployeeSalary.objects.filter(
            employee=employee,
            is_current=True,
            effective_from__lte=self.period.end_date
        ).order_by('-effective_from').first()

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
        - Individual transactions for the employee (target_type='INDIVIDUAL')
        - Grade-based transactions for the employee's grade (target_type='GRADE')
        - Band-based transactions for the employee's salary band (target_type='BAND')
        - ACTIVE status transactions
        - Recurring transactions where effective_from <= period end
        - One-time transactions specifically for this period
        """
        # Build filter for which transactions apply to this employee
        employee_filter = Q(target_type='INDIVIDUAL', employee=employee)

        # Add grade-based transactions if employee has a grade
        if employee.grade_id:
            employee_filter |= Q(target_type='GRADE', job_grade_id=employee.grade_id)

        # Add band-based transactions if employee's grade has a salary band
        if employee.grade and hasattr(employee.grade, 'salary_band') and employee.grade.salary_band_id:
            employee_filter |= Q(target_type='BAND', salary_band_id=employee.grade.salary_band_id)
        # Also check via salary_notch -> level -> band
        elif employee.salary_notch and employee.salary_notch.level and employee.salary_notch.level.band_id:
            employee_filter |= Q(target_type='BAND', salary_band_id=employee.salary_notch.level.band_id)

        return list(EmployeeTransaction.objects.filter(
            employee_filter,
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

    def calculate_proration_factor(self, employee: Employee) -> tuple[Decimal, int, int]:
        """
        Calculate proration factor for mid-period joiners/exiters.

        Returns: (factor, days_payable, total_days)
        - factor=1.0 means full salary (no proration needed)
        - Uses calendar days (holidays are paid per SRS)
        """
        period_start = self.period.start_date
        period_end = self.period.end_date
        total_days = (period_end - period_start).days + 1

        effective_start = period_start
        effective_end = period_end

        # New hire joining mid-period
        if employee.date_of_joining and employee.date_of_joining > period_start:
            # Find the first working day of the period (skip Sat/Sun)
            first_working_day = period_start
            while first_working_day.weekday() >= 5:  # 5=Saturday, 6=Sunday
                first_working_day += timedelta(days=1)

            if employee.date_of_joining <= first_working_day:
                pass  # No proration — joined on or before first working day
            else:
                effective_start = employee.date_of_joining

        # Employee exiting mid-period
        if employee.date_of_exit and employee.date_of_exit < period_end:
            effective_end = employee.date_of_exit

        days_payable = (effective_end - effective_start).days + 1
        days_payable = max(0, days_payable)

        if days_payable >= total_days:
            return Decimal('1'), total_days, total_days

        factor = Decimal(str(days_payable)) / Decimal(str(total_days))
        return factor, days_payable, total_days

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

        # Calculate proration factor for mid-period joiners/exiters
        proration_factor, days_payable, total_days = self.calculate_proration_factor(employee)

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

        # Process basic salary (apply proration if component is prorated)
        basic_component = PayComponent.objects.filter(code='BASIC', is_active=True).first()
        prorated_basic = basic_salary  # default if no basic component found
        if basic_component:
            if basic_component.is_prorated and proration_factor < Decimal('1'):
                prorated_basic = (basic_salary * proration_factor).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            else:
                prorated_basic = basic_salary
            details.append({
                'pay_component': basic_component,
                'amount': prorated_basic,
                'quantity': Decimal('1'),
            })
            add_earning(basic_component, prorated_basic)

        # Process salary components
        salary_components = EmployeeSalaryComponent.objects.filter(
            employee_salary=salary,
            is_active=True
        ).select_related('pay_component')

        for comp in salary_components:
            if comp.pay_component.code == 'BASIC':
                continue

            amount = comp.amount
            # Apply proration to components flagged as prorated
            if comp.pay_component.is_prorated and proration_factor < Decimal('1'):
                amount = (amount * proration_factor).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

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

            # Prorate recurring transactions with prorated components
            if txn.is_recurring and txn.pay_component.is_prorated and proration_factor < Decimal('1'):
                txn_amount = (txn_amount * proration_factor).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            if txn_amount > 0:
                details.append({
                    'pay_component': txn.pay_component,
                    'amount': txn_amount,
                    'quantity': txn.quantity,
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

        # Calculate SSNIT contributions (on prorated basic if applicable)
        ssnit_base = prorated_basic if basic_component and basic_component.is_prorated else basic_salary
        ssnit_employee, ssnit_employer, tier2_employer = self.calculate_ssnit(ssnit_base)

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
            basic_salary=prorated_basic if basic_component else basic_salary,
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
            proration_factor=proration_factor,
            days_payable=days_payable,
            total_days=total_days,
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
        start_time = timezone.now()

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

        employees = list(self.get_eligible_employees())
        employee_count = len(employees)

        # Initialize progress tracking in cache
        progress_key = f'payroll_progress_{self.payroll_run.id}'
        cache.set(progress_key, {
            'status': 'computing',
            'total': employee_count,
            'processed': 0,
            'current_employee': '',
            'percentage': 0,
            'started_at': timezone.now().isoformat(),
        }, timeout=3600)  # 1 hour timeout

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
        processed_count = 0

        for employee in employees:
            # Update progress in cache
            processed_count += 1
            percentage = int((processed_count / employee_count) * 100) if employee_count > 0 else 0
            cache.set(progress_key, {
                'status': 'computing',
                'total': employee_count,
                'processed': processed_count,
                'current_employee': employee.full_name,
                'percentage': percentage,
                'started_at': cache.get(progress_key, {}).get('started_at', ''),
            }, timeout=3600)

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
                days_worked=computation.days_payable,
                proration_factor=computation.proration_factor,
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

        # Apply approved backpay requests
        from .backpay_service import BackpayService
        approved_backpays = BackpayRequest.objects.filter(
            status='APPROVED',
            applied_to_run__isnull=True
        ).select_related('employee', 'new_salary', 'old_salary')

        for bp in approved_backpays:
            payroll_item = PayrollItem.objects.filter(
                payroll_run=self.payroll_run,
                employee=bp.employee
            ).first()
            if payroll_item:
                try:
                    service = BackpayService(bp.employee, bp.reason)
                    service.apply_to_payroll(bp, self.payroll_run)
                    # Update payroll item totals in running totals
                    payroll_item.refresh_from_db()
                    total_gross = total_gross + bp.total_arrears_earnings
                    total_deductions = total_deductions + bp.total_arrears_deductions
                    total_net = total_net + bp.net_arrears
                except Exception as e:
                    errors.append({
                        'employee_id': bp.employee.id,
                        'employee_number': bp.employee.employee_number,
                        'error': f'Backpay application failed: {str(e)}'
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

        # Update period status to COMPUTED
        if self.period.status in [PayrollPeriod.Status.OPEN, PayrollPeriod.Status.PROCESSING]:
            self.period.status = PayrollPeriod.Status.COMPUTED
            self.period.save(update_fields=['status', 'updated_at'])

        # Mark progress as complete
        cache.set(progress_key, {
            'status': 'completed',
            'total': employee_count,
            'processed': employee_count,
            'current_employee': '',
            'percentage': 100,
            'completed_at': timezone.now().isoformat(),
            'total_employees': total_employees,
            'errors_count': len(errors),
        }, timeout=300)  # Keep for 5 minutes after completion

        # Create summary audit log entry (replaces per-record signal-based audit)
        end_time = timezone.now()
        duration = (end_time - start_time).total_seconds()
        try:
            from core.models import AuditLog
            from core.middleware import get_current_user, get_current_request

            audit_user = get_current_user() or user
            ip_address = None
            user_agent = ''
            request = get_current_request()
            if request:
                x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
                ip_address = x_forwarded.split(',')[0].strip() if x_forwarded else request.META.get('REMOTE_ADDR')
                user_agent = request.META.get('HTTP_USER_AGENT', '')

            AuditLog.objects.create(
                user=audit_user,
                action=AuditLog.ActionType.CREATE,
                model_name='PayrollRun',
                object_id=str(self.payroll_run.pk),
                object_repr=f'Payroll computation: {self.payroll_run.run_number}'[:255],
                changes={
                    'started_at': start_time.isoformat(),
                    'completed_at': end_time.isoformat(),
                    'duration_seconds': round(duration, 2),
                    'total_employees': total_employees,
                    'total_gross': str(total_gross),
                    'total_deductions': str(total_deductions),
                    'total_net': str(total_net),
                    'error_count': len(errors),
                    'period_name': self.period.name,
                },
                ip_address=ip_address,
                user_agent=user_agent,
            )
        except Exception:
            import logging
            logging.getLogger('nhia_hrms').warning(
                'Failed to create payroll computation audit log', exc_info=True
            )

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

        # Update period status to APPROVED
        if self.period.status in [PayrollPeriod.Status.OPEN, PayrollPeriod.Status.PROCESSING, PayrollPeriod.Status.COMPUTED]:
            self.period.status = PayrollPeriod.Status.APPROVED
            self.period.save(update_fields=['status', 'updated_at'])

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

        # Revert period status to OPEN since run was rejected
        if self.period.status in [PayrollPeriod.Status.COMPUTED, PayrollPeriod.Status.APPROVED]:
            self.period.status = PayrollPeriod.Status.OPEN
            self.period.save(update_fields=['status', 'updated_at'])

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

            file_content = output.getvalue().encode('utf-8')
            safe_bank_name = bank_name.replace(' ', '_').replace('/', '_')
            file_name = f'{self.payroll_run.run_number}_{safe_bank_name}_{date.today().strftime("%Y%m%d")}.csv'

            bank_file = BankFile.objects.create(
                payroll_run=self.payroll_run,
                bank_name=bank_name,
                file_data=file_content,
                file_name=file_name,
                file_size=len(file_content),
                mime_type='text/csv',
                file_format='CSV',
                total_amount=total_amount,
                transaction_count=len(bank_items),
                generated_by=user,
                generated_at=timezone.now(),
            )
            bank_files.append(bank_file)

        return bank_files

    def generate_payslips(self, user) -> list[Payslip]:
        """Generate payslips for all employees in the payroll run."""
        start_time = timezone.now()

        if self.payroll_run.status not in [PayrollRun.Status.COMPUTED, PayrollRun.Status.APPROVED, PayrollRun.Status.PAID]:
            raise ValueError(f'Cannot generate payslips for payroll in status: {self.payroll_run.status}')

        items = PayrollItem.objects.filter(
            payroll_run=self.payroll_run
        ).exclude(
            status=PayrollItem.Status.ERROR
        ).select_related(
            'employee', 'employee__department', 'employee__position',
            'employee__division', 'employee__directorate', 'employee__grade',
            'employee__salary_notch', 'employee__salary_notch__level',
            'employee__salary_notch__level__band', 'employee__work_location'
        ).prefetch_related('details', 'details__pay_component')

        payslips = []

        for item in items:
            if hasattr(item, 'payslip'):
                continue

            payslip_number = f'PS-{self.payroll_run.run_number}-{item.employee.employee_number}'

            # Generate PDF payslip
            file_content = self._generate_payslip_pdf(item)
            file_name = f'{payslip_number}.pdf'

            payslip = Payslip.objects.create(
                payroll_item=item,
                payslip_number=payslip_number,
                file_data=file_content,
                file_name=file_name,
                file_size=len(file_content),
                mime_type='application/pdf',
                generated_at=timezone.now(),
            )
            payslips.append(payslip)

        # Create summary audit log entry
        end_time = timezone.now()
        duration = (end_time - start_time).total_seconds()
        try:
            from core.models import AuditLog
            from core.middleware import get_current_user, get_current_request

            audit_user = get_current_user() or user
            ip_address = None
            user_agent = ''
            request = get_current_request()
            if request:
                x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
                ip_address = x_forwarded.split(',')[0].strip() if x_forwarded else request.META.get('REMOTE_ADDR')
                user_agent = request.META.get('HTTP_USER_AGENT', '')

            AuditLog.objects.create(
                user=audit_user,
                action=AuditLog.ActionType.CREATE,
                model_name='Payslip',
                object_id=str(self.payroll_run.pk),
                object_repr=f'Payslip generation: {self.payroll_run.run_number}'[:255],
                changes={
                    'started_at': start_time.isoformat(),
                    'completed_at': end_time.isoformat(),
                    'duration_seconds': round(duration, 2),
                    'payslips_generated': len(payslips),
                    'period_name': self.period.name,
                },
                ip_address=ip_address,
                user_agent=user_agent,
            )
        except Exception:
            import logging
            logging.getLogger('nhia_hrms').warning(
                'Failed to create payslip generation audit log', exc_info=True
            )

        return payslips

    def _generate_payslip_pdf(self, item: PayrollItem) -> bytes:
        """Generate payslip as PDF matching NHIS design."""
        import io
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch, cm, mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1.5*cm,
            leftMargin=1.5*cm,
            topMargin=1*cm,
            bottomMargin=1*cm
        )

        elements = []
        styles = getSampleStyleSheet()

        # Colors matching the sample
        header_green = colors.HexColor('#008751')
        header_blue = colors.HexColor('#0077B6')
        light_blue = colors.HexColor('#E8F4F8')
        yellow_green = colors.HexColor('#8DC63F')

        # Custom styles
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontSize=16,
            textColor=header_green,
            alignment=TA_CENTER,
            spaceAfter=2,
            fontName='Helvetica-Bold'
        )

        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=styles['Normal'],
            fontSize=12,
            alignment=TA_CENTER,
            spaceAfter=10,
            fontName='Helvetica-Bold'
        )

        section_header_style = ParagraphStyle(
            'SectionHeader',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.white,
            alignment=TA_LEFT,
            fontName='Helvetica-Bold'
        )

        # Get employee data
        emp = item.employee
        period_name = self.period.name if self.period else 'N/A'

        # Get organization name from settings
        org_name = getattr(settings, 'PAYROLL', {}).get('ORGANIZATION_NAME', 'NATIONAL HEALTH INSURANCE')
        org_code = getattr(settings, 'PAYROLL', {}).get('ORGANIZATION_CODE', 'NHIS')

        # Get salary notch info
        old_notch = ''
        new_notch = ''
        if emp.salary_notch:
            notch = emp.salary_notch
            if notch.level and notch.level.band:
                new_notch = f"Band {notch.level.band.code}/Level {notch.level.code}/Notch {notch.code}"
                old_notch = new_notch  # Same for now, can be enhanced with history

        # === HEADER WITH LOGO PLACEHOLDER ===
        # Create a header table with logo area and title
        logo_style = ParagraphStyle(
            'Logo',
            parent=styles['Normal'],
            fontSize=24,
            textColor=header_green,
            alignment=TA_LEFT,
            fontName='Helvetica-Bold'
        )

        # Logo placeholder (green NHIS text styled like a logo)
        logo_text = f'<font color="#008751"><b>{org_code}</b></font>'

        header_data = [[
            Paragraph(logo_text, logo_style),
            Paragraph(f'<u>{org_name.upper()}</u>', title_style)
        ]]
        header_table = Table(header_data, colWidths=[3*cm, 13.5*cm])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ]))
        elements.append(header_table)
        elements.append(Paragraph(f'<u>PAYSLIP FOR</u>&nbsp;&nbsp;&nbsp;&nbsp;<u>{period_name.upper()}</u>', subtitle_style))
        elements.append(Spacer(1, 10))

        # === EMPLOYEE INFO TABLE ===
        emp_info_data = [
            ['FULL NAME:', emp.full_name, 'BANK NAME:', item.bank_name or ''],
            ['STAFF ID:', emp.employee_number, 'BANK BRANCH:', item.bank_branch or ''],
            ['DEPARTMENT:', emp.department.name if emp.department else '', 'ACCOUNT #:', item.bank_account_number or ''],
            ['LOCATION:', emp.work_location.name if emp.work_location else 'HEAD OFFICE', 'SOCIAL SECURITY #:', emp.ssnit_number or ''],
            ['JOB TITLE:', emp.position.title if emp.position else '', 'GRADE:', emp.grade.name if emp.grade else ''],
            ['OLD LEVEL/NOTCH:', old_notch, 'NEW LEVEL/NOTCH:', new_notch],
        ]

        emp_table = Table(emp_info_data, colWidths=[2.5*cm, 5.5*cm, 3*cm, 5.5*cm])
        emp_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F5F5F5')),
            ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#F5F5F5')),
        ]))
        elements.append(emp_table)
        elements.append(Spacer(1, 10))

        # === BASIC SALARY ===
        basic_data = [['BASIC SALARY', f'{float(item.basic_salary):,.2f}']]
        basic_table = Table(basic_data, colWidths=[13*cm, 3.5*cm])
        basic_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), header_blue),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(basic_table)

        # === ALLOWANCES AND DEDUCTIONS ===
        # Collect allowances (earnings excluding basic)
        allowances = []
        for detail in item.details.all():
            if detail.pay_component.component_type == 'EARNING' and detail.pay_component.code != 'BASIC':
                allowances.append((detail.pay_component.name, float(detail.amount)))

        # Collect deductions
        deductions = []
        for detail in item.details.all():
            if detail.pay_component.component_type == 'DEDUCTION':
                deductions.append((detail.pay_component.name, float(detail.amount)))

        # Add statutory deductions
        if item.ssnit_employee and float(item.ssnit_employee) > 0:
            deductions.append(('Employee SSF', float(item.ssnit_employee)))
        if item.paye and float(item.paye) > 0:
            deductions.append(('Income Tax', float(item.paye)))

        # Build allowances/deductions table
        max_rows = max(len(allowances), len(deductions), 1)
        allow_ded_data = [['ALLOWANCES', 'AMOUNT', 'DEDUCTIONS', 'AMOUNT']]

        for i in range(max_rows):
            row = []
            if i < len(allowances):
                row.extend([allowances[i][0], f'{allowances[i][1]:,.2f}'])
            else:
                row.extend(['', ''])
            if i < len(deductions):
                row.extend([deductions[i][0], f'{deductions[i][1]:,.2f}'])
            else:
                row.extend(['', ''])
            allow_ded_data.append(row)

        allow_ded_table = Table(allow_ded_data, colWidths=[5*cm, 3.25*cm, 5*cm, 3.25*cm])
        allow_ded_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (1, 0), header_blue),
            ('BACKGROUND', (2, 0), (3, 0), header_blue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('LINEAFTER', (1, 0), (1, -1), 1, colors.grey),
        ]))
        elements.append(allow_ded_table)
        elements.append(Spacer(1, 10))

        # === PAY SUMMARY ===
        summary_header = [['PAY SUMMARY']]
        summary_header_table = Table(summary_header, colWidths=[16.5*cm])
        summary_header_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), header_blue),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary_header_table)

        # Get YTD values (calculate from current period for now)
        total_earnings = float(item.gross_earnings)
        total_deductions = float(item.total_deductions)
        net_salary = float(item.net_salary)
        tax_relief = 0.00  # Can be enhanced

        # Calculate YTD by querying all payroll items for the same employee in the current year
        current_year = self.period.year if self.period else timezone.now().year

        # Get all approved/paid payroll items for this employee in the current year
        ytd_items = PayrollItem.objects.filter(
            employee=emp,
            payroll_run__payroll_period__year=current_year,
            payroll_run__status__in=[PayrollRun.Status.COMPUTED, PayrollRun.Status.APPROVED, PayrollRun.Status.PAID]
        ).aggregate(
            total_earnings=Sum('gross_earnings'),
            total_ssf=Sum('ssnit_employee'),
            total_tax=Sum('paye'),
            total_net=Sum('net_salary'),
            total_deductions=Sum('total_deductions')
        )

        earnings_ytd = float(ytd_items['total_earnings'] or total_earnings)
        ssf_ytd = float(ytd_items['total_ssf'] or item.ssnit_employee or 0)
        tax_ytd = float(ytd_items['total_tax'] or item.paye or 0)
        net_ytd = float(ytd_items['total_net'] or net_salary)

        # Calculate PF YTD from payroll item details
        pf_ytd_items = PayrollItemDetail.objects.filter(
            payroll_item__employee=emp,
            payroll_item__payroll_run__payroll_period__year=current_year,
            payroll_item__payroll_run__status__in=[PayrollRun.Status.COMPUTED, PayrollRun.Status.APPROVED, PayrollRun.Status.PAID],
            pay_component__code__icontains='PF'
        ).filter(
            pay_component__component_type='DEDUCTION'
        ).aggregate(total=Sum('amount'))
        pf_ytd = float(pf_ytd_items['total'] or 0)

        # Calculate loan deductions YTD
        loan_ytd_items = PayrollItemDetail.objects.filter(
            payroll_item__employee=emp,
            payroll_item__payroll_run__payroll_period__year=current_year,
            payroll_item__payroll_run__status__in=[PayrollRun.Status.COMPUTED, PayrollRun.Status.APPROVED, PayrollRun.Status.PAID],
            pay_component__name__icontains='loan'
        ).aggregate(total=Sum('amount'))
        loans_ytd = float(loan_ytd_items['total'] or 0)

        # Employee PF calculation (from current period details)
        emp_pf = 0.00
        employer_pf = 0.00
        for detail in item.details.all():
            if 'provident' in detail.pay_component.name.lower() or 'pf' in detail.pay_component.code.lower():
                if detail.pay_component.component_type == 'DEDUCTION':
                    emp_pf = float(detail.amount)
                elif detail.pay_component.component_type == 'EMPLOYER':
                    employer_pf = float(detail.amount)

        # Calculate cumulative PF to date
        emp_pf_ytd = PayrollItemDetail.objects.filter(
            payroll_item__employee=emp,
            payroll_item__payroll_run__status__in=[PayrollRun.Status.COMPUTED, PayrollRun.Status.APPROVED, PayrollRun.Status.PAID],
            pay_component__code__icontains='PF',
            pay_component__component_type='DEDUCTION'
        ).aggregate(total=Sum('amount'))

        employer_pf_ytd = PayrollItemDetail.objects.filter(
            payroll_item__employee=emp,
            payroll_item__payroll_run__status__in=[PayrollRun.Status.COMPUTED, PayrollRun.Status.APPROVED, PayrollRun.Status.PAID],
            pay_component__code__icontains='PF',
            pay_component__component_type='EMPLOYER'
        ).aggregate(total=Sum('amount'))

        emp_pf_to_date = float(emp_pf_ytd['total'] or emp_pf)
        employer_pf_to_date = float(employer_pf_ytd['total'] or employer_pf)
        total_pf_to_date = emp_pf_to_date + employer_pf_to_date

        summary_data = [
            ['TOTAL EARNINGS', f'{total_earnings:,.2f}', 'TOTAL DEDUCTIONS', f'{total_deductions:,.2f}'],
            ['TAX RELIEF', f'{tax_relief:,.2f}', 'NET SALARY', f'{net_salary:,.2f}'],
            ['', '', '', ''],
            ['TOTAL EARNINGS YTD', f'{earnings_ytd:,.2f}', 'EMPLOYEE PF TO DATE', f'{emp_pf_to_date:,.2f}'],
            ['EMPLOYEE SSF YTD', f'{ssf_ytd:,.2f}', '', ''],
            ['EMPLOYEE PF YTD', f'{pf_ytd:,.2f}', 'EMPLOYER PF TO DATE', f'{employer_pf_to_date:,.2f}'],
            ['INCOME TAX YTD', f'{tax_ytd:,.2f}', '', ''],
            ['LOANS & ADV. DED. YTD', f'{loans_ytd:,.2f}', 'TOTAL PF TO DATE', f'{total_pf_to_date:,.2f}'],
            ['NET SALARY YTD', f'{net_ytd:,.2f}', '', ''],
        ]

        summary_table = Table(summary_data, colWidths=[4.5*cm, 3.75*cm, 4.5*cm, 3.75*cm])
        summary_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('LINEAFTER', (1, 0), (1, -1), 1, colors.grey),
            # Underline key values
            ('LINEBELOW', (1, 0), (1, 0), 1, colors.black),  # Total Earnings
            ('LINEBELOW', (3, 0), (3, 0), 1, colors.black),  # Total Deductions
            ('LINEBELOW', (3, 1), (3, 1), 1.5, colors.black),  # Net Salary
            ('LINEBELOW', (1, 3), (1, 3), 1, colors.black),  # Earnings YTD
            ('LINEBELOW', (1, 8), (1, 8), 1, colors.black),  # Net Salary YTD
            ('LINEBELOW', (3, 7), (3, 7), 1, colors.black),  # Total PF
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 10))

        # === LOAN DETAILS ===
        loan_header = [['LOAN DETAILS']]
        loan_header_table = Table(loan_header, colWidths=[16.5*cm])
        loan_header_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), header_blue),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(loan_header_table)

        # Get loan deductions from payroll item details
        loan_details = []
        for detail in item.details.all():
            if 'loan' in detail.pay_component.name.lower():
                loan_details.append([detail.pay_component.name, f'{float(detail.amount):,.2f}'])

        if loan_details:
            loan_table = Table(loan_details, colWidths=[12*cm, 4.5*cm])
            loan_table.setStyle(TableStyle([
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ]))
            elements.append(loan_table)
        else:
            # Empty loan section
            empty_loan = Table([['No active loans']], colWidths=[16.5*cm])
            empty_loan.setStyle(TableStyle([
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.grey),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
            ]))
            elements.append(empty_loan)

        elements.append(Spacer(1, 20))

        # === FOOTER ===
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.grey,
            alignment=TA_LEFT
        )
        elements.append(Paragraph(f'Printed On: {timezone.now().isoformat()}', footer_style))

        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer.read()
