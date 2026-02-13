"""
Ghana statutory tax and SSNIT calculation services.
Handles PAYE tax brackets, overtime/bonus tax, tax reliefs, and SSNIT contributions.
"""

from decimal import Decimal, ROUND_HALF_UP
from django.db.models import Q

from .models import TaxBracket, TaxRelief, SSNITRate, OvertimeBonusTaxConfig


class TaxCalculationService:
    """Service for Ghana PAYE tax calculations."""

    def __init__(self, period):
        self.period = period
        self._tax_brackets = None
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


class SSNITService:
    """Service for Ghana SSNIT contribution calculations."""

    def __init__(self, period):
        self.period = period
        self._ssnit_rates = None

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
