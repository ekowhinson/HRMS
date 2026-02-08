"""
Payroll management models for NHIA HRMS.
Includes salary structures, payroll processing, and statutory compliance.
"""

import re
import base64
import hashlib
import mimetypes
from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal

from core.models import BaseModel


class Bank(BaseModel):
    """
    Bank setup for salary payments.
    """
    code = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    short_name = models.CharField(max_length=50, null=True, blank=True)
    swift_code = models.CharField(max_length=20, null=True, blank=True)
    sort_code = models.CharField(max_length=20, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    website = models.URLField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'banks'
        ordering = ['name']
        verbose_name = 'Bank'
        verbose_name_plural = 'Banks'

    def __str__(self):
        return f"{self.code} - {self.name}"


class BankBranch(BaseModel):
    """
    Bank branch setup linked to parent bank.
    """
    bank = models.ForeignKey(
        Bank,
        on_delete=models.CASCADE,
        related_name='branches'
    )
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=200)
    sort_code = models.CharField(max_length=20, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    region = models.ForeignKey(
        'core.Region',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bank_branches'
    )
    phone = models.CharField(max_length=50, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'bank_branches'
        ordering = ['bank__name', 'name']
        unique_together = ['bank', 'code']
        verbose_name = 'Bank Branch'
        verbose_name_plural = 'Bank Branches'

    def __str__(self):
        return f"{self.bank.name} - {self.name}"

    @property
    def full_name(self):
        """Return bank name with branch."""
        return f"{self.bank.name} - {self.name}"


class StaffCategory(BaseModel):
    """
    Staff category for payroll groupings (e.g., District Staff, HQ Staff, Contract Staff).
    Used to group employees for payroll processing and reporting.
    """
    code = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    payroll_group = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text='Payroll processing group (e.g., Districts Payroll, HQ Payroll)'
    )
    # Link to salary structure
    salary_band = models.ForeignKey(
        'SalaryBand',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='staff_categories',
        help_text='Default salary band for this staff category'
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'staff_categories'
        ordering = ['sort_order', 'name']
        verbose_name = 'Staff Category'
        verbose_name_plural = 'Staff Categories'

    def __str__(self):
        return f"{self.code} - {self.name}"


class SalaryBand(BaseModel):
    """
    Salary band/scale (e.g., Band 1, Band 2, Band 3, Band 4).
    """
    code = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    min_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    max_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'salary_bands'
        ordering = ['sort_order', 'code']
        verbose_name = 'Salary Band'
        verbose_name_plural = 'Salary Bands'

    def __str__(self):
        return f"{self.code} - {self.name}"


class SalaryLevel(BaseModel):
    """
    Salary level within a band (e.g., Level 1, Level 2, Level 3, Level 4A, Level 4B).
    """
    band = models.ForeignKey(
        SalaryBand,
        on_delete=models.CASCADE,
        related_name='levels'
    )
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    min_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    max_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'salary_levels'
        ordering = ['band__sort_order', 'sort_order', 'code']
        unique_together = ['band', 'code']
        verbose_name = 'Salary Level'
        verbose_name_plural = 'Salary Levels'

    def __str__(self):
        return f"{self.band.code}/{self.code} - {self.name}"


class SalaryNotch(BaseModel):
    """
    Salary notch/step within a level (e.g., Notch 1, Notch 2, Notch 7B).
    Full structure: Band/Level/Notch (e.g., Band 4/Level 4B/Notch 2)
    """
    level = models.ForeignKey(
        SalaryLevel,
        on_delete=models.CASCADE,
        related_name='notches'
    )
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=100)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Base salary amount for this notch'
    )
    description = models.TextField(null=True, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'salary_notches'
        ordering = ['level__band__sort_order', 'level__sort_order', 'sort_order']
        unique_together = ['level', 'code']
        verbose_name = 'Salary Notch'
        verbose_name_plural = 'Salary Notches'

    def __str__(self):
        return f"{self.level.band.code}/{self.level.code}/{self.code}"

    @property
    def full_code(self):
        """Return full Band/Level/Notch code."""
        return f"{self.level.band.code}/{self.level.code}/{self.code}"

    @property
    def full_name(self):
        """Return full descriptive name."""
        return f"{self.level.band.name}/{self.level.name}/{self.name}"


class PayComponent(BaseModel):
    """
    Pay components (earnings and deductions).
    """
    class ComponentType(models.TextChoices):
        EARNING = 'EARNING', 'Earning'
        DEDUCTION = 'DEDUCTION', 'Deduction'
        EMPLOYER_CONTRIBUTION = 'EMPLOYER', 'Employer Contribution'

    class CalculationType(models.TextChoices):
        FIXED = 'FIXED', 'Fixed Amount'
        PERCENTAGE_BASIC = 'PCT_BASIC', 'Percentage of Basic'
        PERCENTAGE_GROSS = 'PCT_GROSS', 'Percentage of Gross'
        FORMULA = 'FORMULA', 'Custom Formula'
        LOOKUP = 'LOOKUP', 'Lookup Table'

    class ComponentCategory(models.TextChoices):
        BASIC = 'BASIC', 'Basic Salary'
        ALLOWANCE = 'ALLOWANCE', 'Allowance'
        BONUS = 'BONUS', 'Bonus'
        STATUTORY = 'STATUTORY', 'Statutory Deduction'
        OVERTIME = 'OVERTIME', 'Overtime'
        SHIFT = 'SHIFT', 'Shift Allowance'
        LOAN = 'LOAN', 'Loan Deduction'
        FUND = 'FUND', 'Fund Contribution'
        OTHER = 'OTHER', 'Other'

    code = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    short_name = models.CharField(max_length=50, null=True, blank=True)
    description = models.TextField(null=True, blank=True)

    component_type = models.CharField(
        max_length=20,
        choices=ComponentType.choices,
        default=ComponentType.EARNING
    )
    calculation_type = models.CharField(
        max_length=20,
        choices=CalculationType.choices,
        default=CalculationType.FIXED
    )
    category = models.CharField(
        max_length=20,
        choices=ComponentCategory.choices,
        default=ComponentCategory.OTHER
    )

    # Calculation parameters
    default_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    percentage_value = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    formula = models.TextField(null=True, blank=True)

    # Tax treatment
    is_taxable = models.BooleanField(default=True)
    reduces_taxable = models.BooleanField(
        default=False,
        help_text='For deductions: if True, this deduction reduces taxable income (pre-tax deduction)'
    )
    is_overtime = models.BooleanField(
        default=False,
        help_text='If True, this earning is treated as overtime and taxed at special rates'
    )
    is_bonus = models.BooleanField(
        default=False,
        help_text='If True, this earning is treated as bonus and taxed at special rates'
    )
    is_part_of_basic = models.BooleanField(default=False)
    is_part_of_gross = models.BooleanField(default=True)
    affects_ssnit = models.BooleanField(default=False)

    # Settings
    is_statutory = models.BooleanField(default=False)
    is_recurring = models.BooleanField(default=True)
    is_prorated = models.BooleanField(default=True)
    is_arrears_applicable = models.BooleanField(default=True)

    # Approval settings
    requires_approval = models.BooleanField(default=False)
    approval_threshold = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Display
    display_order = models.PositiveSmallIntegerField(default=0)
    show_on_payslip = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'pay_components'
        ordering = ['component_type', 'display_order', 'name']

    def __str__(self):
        return f"{self.code} - {self.name}"


class SalaryStructure(BaseModel):
    """
    Salary structure template for grades/positions.
    """
    code = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    grade = models.ForeignKey(
        'organization.JobGrade',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='salary_structures'
    )
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'salary_structures'
        ordering = ['grade__level', 'name']

    def __str__(self):
        return f"{self.code} - {self.name}"


class SalaryStructureComponent(BaseModel):
    """
    Components within a salary structure.
    """
    salary_structure = models.ForeignKey(
        SalaryStructure,
        on_delete=models.CASCADE,
        related_name='components'
    )
    pay_component = models.ForeignKey(
        PayComponent,
        on_delete=models.CASCADE,
        related_name='structure_components'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    percentage = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    formula = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'salary_structure_components'
        unique_together = ['salary_structure', 'pay_component']
        ordering = ['pay_component__display_order']

    def __str__(self):
        return f"{self.salary_structure.code} - {self.pay_component.code}"


class EmployeeSalary(BaseModel):
    """
    Employee's current salary assignment.
    """
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='salaries'
    )
    salary_structure = models.ForeignKey(
        SalaryStructure,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='employee_salaries'
    )
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2)
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default='GHS')

    effective_from = models.DateField(db_index=True)
    effective_to = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=True)

    # Approval
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_salaries'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    reason = models.TextField(null=True, blank=True)
    reference_number = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        db_table = 'employee_salaries'
        ordering = ['-effective_from']
        indexes = [
            models.Index(fields=['employee', 'is_current']),
        ]

    def __str__(self):
        return f"{self.employee.employee_number} - {self.basic_salary} - {self.effective_from}"


class EmployeeSalaryComponent(BaseModel):
    """
    Individual salary components for an employee.
    """
    employee_salary = models.ForeignKey(
        EmployeeSalary,
        on_delete=models.CASCADE,
        related_name='components'
    )
    pay_component = models.ForeignKey(
        PayComponent,
        on_delete=models.CASCADE,
        related_name='employee_components'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'employee_salary_components'
        unique_together = ['employee_salary', 'pay_component']
        ordering = ['pay_component__display_order']

    def __str__(self):
        return f"{self.employee_salary.employee.employee_number} - {self.pay_component.code}"


class TaxBracket(BaseModel):
    """
    Ghana PAYE tax brackets.
    """
    name = models.CharField(max_length=100)
    min_amount = models.DecimalField(max_digits=12, decimal_places=2)
    max_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    rate = models.DecimalField(max_digits=5, decimal_places=2)
    cumulative_tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'tax_brackets'
        ordering = ['order', 'min_amount']

    def __str__(self):
        return f"{self.name} - {self.rate}%"


class TaxRelief(BaseModel):
    """
    Tax relief types and amounts.
    """
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    relief_type = models.CharField(
        max_length=20,
        choices=[
            ('FIXED', 'Fixed Amount'),
            ('PERCENTAGE', 'Percentage'),
        ],
        default='FIXED'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    max_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'tax_reliefs'
        ordering = ['name']

    def __str__(self):
        return f"{self.code} - {self.name}"


class SSNITRate(BaseModel):
    """
    SSNIT contribution rates.
    """
    tier = models.CharField(
        max_length=10,
        choices=[
            ('TIER_1', 'Tier 1 (Mandatory)'),
            ('TIER_2', 'Tier 2 (Occupational)'),
            ('TIER_3', 'Tier 3 (Voluntary)'),
        ]
    )
    employer_rate = models.DecimalField(max_digits=5, decimal_places=2)
    employee_rate = models.DecimalField(max_digits=5, decimal_places=2)
    max_contribution = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'ssnit_rates'
        ordering = ['tier', '-effective_from']

    def __str__(self):
        return f"{self.tier} - Employer: {self.employer_rate}%, Employee: {self.employee_rate}%"


class OvertimeBonusTaxConfig(BaseModel):
    """
    Configurable overtime and bonus tax rates for Ghana.

    Ghana Tax Rules (per GRA):
    - Overtime: Only junior staff earning up to annual threshold qualify for preferential rates
    - Overtime rates: 5% up to 50% of basic, 10% on excess (for qualifying employees)
    - Bonus: 5% flat rate up to 15% of annual basic, excess added to PAYE
    - Non-residents: Flat rate on both overtime and bonus
    """
    name = models.CharField(max_length=100, default='Ghana Tax Configuration')
    description = models.TextField(null=True, blank=True)

    # Overtime Tax Configuration
    overtime_annual_salary_threshold = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=18000,
        help_text='Annual salary threshold for overtime tax eligibility (GHS). Employees earning above this have overtime taxed via PAYE.'
    )
    overtime_basic_percentage_threshold = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=50,
        help_text='Percentage of monthly basic salary threshold for lower overtime tax rate'
    )
    overtime_rate_below_threshold = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=5,
        help_text='Tax rate (%) for overtime up to the basic percentage threshold'
    )
    overtime_rate_above_threshold = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=10,
        help_text='Tax rate (%) for overtime exceeding the basic percentage threshold'
    )

    # Bonus Tax Configuration
    bonus_annual_basic_percentage_threshold = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=15,
        help_text='Percentage of annual basic salary threshold for flat bonus tax rate'
    )
    bonus_flat_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=5,
        help_text='Flat tax rate (%) for bonus up to the threshold'
    )
    bonus_excess_to_paye = models.BooleanField(
        default=True,
        help_text='If True, bonus exceeding threshold is added to taxable income for PAYE'
    )

    # Non-Resident Rates
    non_resident_overtime_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=20,
        help_text='Flat overtime tax rate (%) for non-residents'
    )
    non_resident_bonus_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=20,
        help_text='Flat bonus tax rate (%) for non-residents'
    )

    # Validity
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'overtime_bonus_tax_config'
        ordering = ['-effective_from']
        verbose_name = 'Overtime & Bonus Tax Configuration'
        verbose_name_plural = 'Overtime & Bonus Tax Configurations'

    def __str__(self):
        return f"{self.name} (from {self.effective_from})"

    @classmethod
    def get_active_config(cls, as_of_date=None):
        """Get the active configuration for a given date."""
        from django.db.models import Q
        from django.utils import timezone

        if as_of_date is None:
            as_of_date = timezone.now().date()

        return cls.objects.filter(
            is_active=True,
            effective_from__lte=as_of_date
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=as_of_date)
        ).order_by('-effective_from').first()


class PayrollCalendar(BaseModel):
    """
    Payroll calendar for tracking months and years.
    Used to link transactions to specific calendar periods.
    """
    MONTH_CHOICES = [
        (1, 'January'), (2, 'February'), (3, 'March'), (4, 'April'),
        (5, 'May'), (6, 'June'), (7, 'July'), (8, 'August'),
        (9, 'September'), (10, 'October'), (11, 'November'), (12, 'December'),
    ]

    MONTH_NAMES = {
        1: 'January', 2: 'February', 3: 'March', 4: 'April',
        5: 'May', 6: 'June', 7: 'July', 8: 'August',
        9: 'September', 10: 'October', 11: 'November', 12: 'December',
    }

    year = models.PositiveSmallIntegerField(db_index=True)
    month = models.PositiveSmallIntegerField(choices=MONTH_CHOICES, db_index=True)
    name = models.CharField(
        max_length=50,
        help_text='e.g., "January 2025"'
    )
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'payroll_calendar'
        ordering = ['-year', '-month']
        unique_together = ['year', 'month']
        verbose_name = 'Payroll Calendar'
        verbose_name_plural = 'Payroll Calendar'

    def __str__(self):
        return self.name

    @property
    def month_name(self):
        return self.MONTH_NAMES.get(self.month, '')

    @classmethod
    def create_year_calendar(cls, year: int, user=None) -> list:
        """
        Create all 12 calendar months for a given year.

        Args:
            year: The year to create calendar entries for
            user: Optional user for created_by field

        Returns:
            List of created PayrollCalendar objects
        """
        import calendar
        from datetime import date

        created = []
        for month in range(1, 13):
            # Check if already exists
            if cls.objects.filter(year=year, month=month).exists():
                continue

            # Get last day of month
            _, last_day = calendar.monthrange(year, month)
            month_name = cls.MONTH_NAMES[month]

            cal = cls.objects.create(
                year=year,
                month=month,
                name=f"{month_name} {year}",
                start_date=date(year, month, 1),
                end_date=date(year, month, last_day),
                is_active=True,
                created_by=user
            )
            created.append(cal)

        return created

    @classmethod
    def get_or_create_month(cls, year: int, month: int, user=None):
        """Get or create a specific calendar month."""
        import calendar
        from datetime import date

        cal, created = cls.objects.get_or_create(
            year=year,
            month=month,
            defaults={
                'name': f"{cls.MONTH_NAMES[month]} {year}",
                'start_date': date(year, month, 1),
                'end_date': date(year, month, calendar.monthrange(year, month)[1]),
                'is_active': True,
                'created_by': user
            }
        )
        return cal, created


class PayrollSettings(models.Model):
    """
    Global payroll settings (singleton pattern).
    Stores system-wide payroll configuration including the active period.
    """
    # Active period selection
    active_calendar = models.ForeignKey(
        PayrollCalendar,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='settings_as_active',
        help_text='Currently active payroll calendar month'
    )
    active_period = models.ForeignKey(
        'PayrollPeriod',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='settings_as_active',
        help_text='Currently active payroll period for processing'
    )

    # Auto-advance settings
    auto_advance_period = models.BooleanField(
        default=False,
        help_text='Automatically advance to next period when current period is closed'
    )

    # Default settings for new transactions
    default_transaction_status = models.CharField(
        max_length=20,
        default='ACTIVE',
        help_text='Default status for new employee transactions'
    )

    # Timestamps
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payroll_settings_updates'
    )

    class Meta:
        db_table = 'payroll_settings'
        verbose_name = 'Payroll Settings'
        verbose_name_plural = 'Payroll Settings'

    def __str__(self):
        if self.active_calendar:
            return f"Active Period: {self.active_calendar.name}"
        return "Payroll Settings (No active period)"

    def save(self, *args, **kwargs):
        # Enforce singleton pattern - only one settings record allowed
        if not self.pk and PayrollSettings.objects.exists():
            # Update existing record instead of creating new one
            existing = PayrollSettings.objects.first()
            self.pk = existing.pk
        super().save(*args, **kwargs)

    @classmethod
    def get_settings(cls):
        """
        Get the global payroll settings (creates default if not exists).
        """
        settings_obj, created = cls.objects.get_or_create(pk=1)
        return settings_obj

    @classmethod
    def get_active_calendar(cls):
        """
        Get the currently active payroll calendar.
        Returns None if no active calendar is set.
        """
        settings_obj = cls.get_settings()
        return settings_obj.active_calendar

    @classmethod
    def get_active_period(cls):
        """
        Get the currently active payroll period.
        Returns None if no active period is set.
        """
        settings_obj = cls.get_settings()
        return settings_obj.active_period

    @classmethod
    def set_active_calendar(cls, calendar, user=None):
        """
        Set the active payroll calendar.

        Args:
            calendar: PayrollCalendar instance or ID
            user: User making the change (optional)
        """
        settings_obj = cls.get_settings()

        if isinstance(calendar, (str, int)):
            calendar = PayrollCalendar.objects.get(pk=calendar)

        settings_obj.active_calendar = calendar
        settings_obj.updated_by = user
        settings_obj.save()

        # Also update active_period if there's a matching period
        if calendar:
            period = PayrollPeriod.objects.filter(
                calendar=calendar,
                is_supplementary=False
            ).first()
            if period:
                settings_obj.active_period = period
                settings_obj.save()

        return settings_obj

    @classmethod
    def set_active_period(cls, period, user=None):
        """
        Set the active payroll period (also updates active calendar).

        Args:
            period: PayrollPeriod instance or ID
            user: User making the change (optional)
        """
        settings_obj = cls.get_settings()

        if isinstance(period, (str, int)):
            period = PayrollPeriod.objects.get(pk=period)

        settings_obj.active_period = period
        settings_obj.updated_by = user

        # Also update active_calendar to match
        if period and period.calendar:
            settings_obj.active_calendar = period.calendar

        settings_obj.save()
        return settings_obj

    @classmethod
    def advance_to_next_period(cls, user=None):
        """
        Advance to the next payroll period.
        """
        settings_obj = cls.get_settings()
        current = settings_obj.active_calendar

        if not current:
            return None

        # Find next month
        next_year = current.year
        next_month = current.month + 1
        if next_month > 12:
            next_month = 1
            next_year += 1

        # Get or create next calendar
        next_calendar, _ = PayrollCalendar.get_or_create_month(next_year, next_month, user)

        # Get or create next period
        next_period = PayrollPeriod.objects.filter(
            year=next_year,
            month=next_month,
            is_supplementary=False
        ).first()

        if not next_period:
            # Create the period
            periods = PayrollPeriod.create_year_periods(next_year, user)
            next_period = PayrollPeriod.objects.filter(
                year=next_year,
                month=next_month,
                is_supplementary=False
            ).first()

        settings_obj.active_calendar = next_calendar
        settings_obj.active_period = next_period
        settings_obj.updated_by = user
        settings_obj.save()

        return settings_obj


class PayrollPeriod(BaseModel):
    """
    Payroll periods (usually monthly).
    """
    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Open'
        PROCESSING = 'PROCESSING', 'Processing'
        COMPUTED = 'COMPUTED', 'Computed'
        APPROVED = 'APPROVED', 'Approved'
        PAID = 'PAID', 'Paid'
        CLOSED = 'CLOSED', 'Closed'

    # Link to calendar
    calendar = models.ForeignKey(
        PayrollCalendar,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='payroll_periods',
        help_text='Calendar month/year this period belongs to'
    )

    name = models.CharField(max_length=50)
    year = models.PositiveSmallIntegerField(db_index=True)
    month = models.PositiveSmallIntegerField(db_index=True)
    start_date = models.DateField()
    end_date = models.DateField()
    payment_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True
    )
    is_supplementary = models.BooleanField(default=False)
    parent_period = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='supplementary_periods'
    )
    locked_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='locked_periods'
    )

    class Meta:
        db_table = 'payroll_periods'
        ordering = ['-year', '-month']
        unique_together = ['year', 'month', 'is_supplementary']

    def __str__(self):
        return f"{self.name} ({self.year}-{self.month:02d})"

    def save(self, *args, **kwargs):
        # Auto-link to calendar if not set
        if not self.calendar_id and self.year and self.month:
            cal, _ = PayrollCalendar.get_or_create_month(self.year, self.month)
            self.calendar = cal
        super().save(*args, **kwargs)

    @classmethod
    def create_year_periods(cls, year: int, user=None) -> list:
        """
        Create all 12 payroll periods for a given year.

        Args:
            year: The year to create periods for
            user: Optional user for created_by field

        Returns:
            List of created PayrollPeriod objects
        """
        import calendar
        from datetime import date

        # First create calendar entries
        PayrollCalendar.create_year_calendar(year, user)

        created = []
        for month in range(1, 13):
            # Check if already exists
            if cls.objects.filter(year=year, month=month, is_supplementary=False).exists():
                continue

            # Get calendar entry
            cal = PayrollCalendar.objects.get(year=year, month=month)

            # Get last day of month
            _, last_day = calendar.monthrange(year, month)
            month_name = PayrollCalendar.MONTH_NAMES[month]

            period = cls.objects.create(
                calendar=cal,
                name=f"{month_name} {year}",
                year=year,
                month=month,
                start_date=date(year, month, 1),
                end_date=date(year, month, last_day),
                status=cls.Status.OPEN,
                is_supplementary=False,
                created_by=user
            )
            created.append(period)

        return created


class PayrollRun(BaseModel):
    """
    Payroll run/batch execution.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        COMPUTING = 'COMPUTING', 'Computing'
        COMPUTED = 'COMPUTED', 'Computed'
        REVIEWING = 'REVIEWING', 'Under Review'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        PROCESSING_PAYMENT = 'PAYING', 'Processing Payment'
        PAID = 'PAID', 'Paid'
        REVERSED = 'REVERSED', 'Reversed'

    payroll_period = models.ForeignKey(
        PayrollPeriod,
        on_delete=models.PROTECT,
        related_name='runs'
    )
    run_number = models.CharField(max_length=20, unique=True, db_index=True)
    run_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )

    # Statistics
    total_employees = models.PositiveIntegerField(default=0)
    total_gross = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_deductions = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_net = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_employer_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # PAYE totals
    total_paye = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_overtime_tax = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_bonus_tax = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # SSNIT totals
    total_ssnit_employee = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_ssnit_employer = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_tier2_employer = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Workflow
    computed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='computed_payrolls'
    )
    computed_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_payrolls'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'payroll_runs'
        ordering = ['-run_date']

    def __str__(self):
        return f"{self.run_number} - {self.payroll_period.name}"

    def generate_run_number(self):
        """Generate a unique run number based on period."""
        if self.payroll_period:
            year = self.payroll_period.year
            month = self.payroll_period.month
            prefix = f"PR-{year}{month:02d}"
        else:
            from django.utils import timezone
            now = timezone.now()
            prefix = f"PR-{now.year}{now.month:02d}"

        # Find the highest sequence number for this prefix
        # Use all_objects to include soft-deleted records (unique constraint is at DB level)
        existing = PayrollRun.all_objects.filter(
            run_number__startswith=prefix
        ).order_by('-run_number').first()

        if existing and existing.run_number:
            try:
                # Extract sequence number from existing run_number
                seq_str = existing.run_number.split('-')[-1]
                seq = int(seq_str) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1

        return f"{prefix}-{seq:03d}"

    def save(self, *args, **kwargs):
        if not self.run_number:
            self.run_number = self.generate_run_number()
        super().save(*args, **kwargs)


class PayrollItem(BaseModel):
    """
    Individual employee payroll record for a run.
    """
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        COMPUTED = 'COMPUTED', 'Computed'
        APPROVED = 'APPROVED', 'Approved'
        ON_HOLD = 'ON_HOLD', 'On Hold'
        PAID = 'PAID', 'Paid'
        ERROR = 'ERROR', 'Error'

    payroll_run = models.ForeignKey(
        PayrollRun,
        on_delete=models.CASCADE,
        related_name='items'
    )
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.PROTECT,
        related_name='payroll_items'
    )
    employee_salary = models.ForeignKey(
        EmployeeSalary,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='payroll_items'
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    # Summary amounts
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2)
    gross_earnings = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    employer_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Statutory deductions
    taxable_income = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    paye = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    overtime_tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bonus_tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    ssnit_employee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    ssnit_employer = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tier2_employer = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Overtime and bonus amounts (for tax calculation reference)
    total_overtime = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_bonus = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Work days
    days_worked = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    days_absent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    leave_without_pay_days = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Proration
    proration_factor = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=1.0,
        help_text='Proration factor applied (1.0 = full salary, <1.0 = prorated for mid-period join/exit)'
    )

    # Bank details snapshot
    bank_name = models.CharField(max_length=100, null=True, blank=True)
    bank_account_number = models.CharField(max_length=50, null=True, blank=True)
    bank_branch = models.CharField(max_length=100, null=True, blank=True)

    # Payment tracking
    payment_reference = models.CharField(max_length=100, null=True, blank=True)
    payment_date = models.DateField(null=True, blank=True)

    error_message = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'payroll_items'
        ordering = ['employee__employee_number']
        unique_together = ['payroll_run', 'employee']
        indexes = [
            models.Index(fields=['payroll_run', 'status']),
        ]

    def __str__(self):
        return f"{self.payroll_run.run_number} - {self.employee.employee_number}"


class PayrollItemDetail(BaseModel):
    """
    Individual component breakdown for a payroll item.
    """
    payroll_item = models.ForeignKey(
        PayrollItem,
        on_delete=models.CASCADE,
        related_name='details'
    )
    pay_component = models.ForeignKey(
        PayComponent,
        on_delete=models.PROTECT,
        related_name='payroll_details'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.DecimalField(max_digits=8, decimal_places=2, default=1)
    rate = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    is_arrear = models.BooleanField(default=False)
    arrear_months = models.PositiveSmallIntegerField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'payroll_item_details'
        ordering = ['pay_component__display_order']

    def __str__(self):
        return f"{self.payroll_item.employee.employee_number} - {self.pay_component.code}"


class AdHocPayment(BaseModel):
    """
    One-time payments or deductions.
    """
    class PaymentType(models.TextChoices):
        BONUS = 'BONUS', 'Bonus'
        ALLOWANCE = 'ALLOWANCE', 'Allowance'
        ARREARS = 'ARREARS', 'Arrears'
        DEDUCTION = 'DEDUCTION', 'Deduction'
        RECOVERY = 'RECOVERY', 'Recovery'
        REIMBURSEMENT = 'REIMBURSEMENT', 'Reimbursement'
        OTHER = 'OTHER', 'Other'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        PROCESSED = 'PROCESSED', 'Processed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='adhoc_payments'
    )
    pay_component = models.ForeignKey(
        PayComponent,
        on_delete=models.PROTECT,
        related_name='adhoc_payments'
    )
    payment_type = models.CharField(max_length=20, choices=PaymentType.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    is_taxable = models.BooleanField(default=True)
    description = models.TextField()
    reference_number = models.CharField(max_length=50, null=True, blank=True)

    # Processing
    payroll_period = models.ForeignKey(
        PayrollPeriod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='adhoc_payments'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    # Approval
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_adhoc_payments'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'adhoc_payments'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.employee.employee_number} - {self.payment_type} - {self.amount}"


class PayrollApproval(BaseModel):
    """
    Payroll approval workflow.
    """
    payroll_run = models.ForeignKey(
        PayrollRun,
        on_delete=models.CASCADE,
        related_name='approvals'
    )
    level = models.PositiveSmallIntegerField(default=1)
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='payroll_approvals'
    )
    action = models.CharField(
        max_length=20,
        choices=[
            ('APPROVE', 'Approved'),
            ('REJECT', 'Rejected'),
            ('RETURN', 'Returned for Correction'),
        ]
    )
    comments = models.TextField(null=True, blank=True)
    action_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payroll_approvals'
        ordering = ['payroll_run', 'level', '-action_at']

    def __str__(self):
        return f"{self.payroll_run.run_number} - Level {self.level} - {self.action}"


class BankFile(BaseModel):
    """
    Generated bank payment files.
    """
    payroll_run = models.ForeignKey(
        PayrollRun,
        on_delete=models.CASCADE,
        related_name='bank_files'
    )
    bank_name = models.CharField(max_length=100)
    # Binary file storage
    file_data = models.BinaryField(null=True, blank=True)
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=100, null=True, blank=True)
    file_checksum = models.CharField(max_length=64, null=True, blank=True)
    file_format = models.CharField(
        max_length=20,
        choices=[
            ('CSV', 'CSV'),
            ('EXCEL', 'Excel'),
            ('MT940', 'MT940'),
            ('PAIN001', 'ISO 20022 pain.001'),
            ('CUSTOM', 'Custom Format'),
        ]
    )
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    transaction_count = models.PositiveIntegerField()
    generated_at = models.DateTimeField(auto_now_add=True)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='generated_bank_files'
    )
    is_submitted = models.BooleanField(default=False)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'bank_files'
        ordering = ['-generated_at']

    def __str__(self):
        return f"{self.payroll_run.run_number} - {self.bank_name} - {self.file_name}"

    def set_file(self, file_obj, filename=None):
        """Store a file as binary data."""
        if file_obj is None:
            self.file_data = None
            self.file_name = None
            self.file_size = None
            self.mime_type = None
            self.file_checksum = None
            return

        content = file_obj.read() if hasattr(file_obj, 'read') else file_obj

        if filename:
            self.file_name = filename
        elif hasattr(file_obj, 'name'):
            self.file_name = file_obj.name
        else:
            self.file_name = 'bank_file'

        self.file_data = content
        self.file_size = len(content)

        if hasattr(file_obj, 'content_type'):
            self.mime_type = file_obj.content_type
        else:
            mime, _ = mimetypes.guess_type(self.file_name)
            self.mime_type = mime or 'application/octet-stream'

        self.file_checksum = hashlib.sha256(content).hexdigest()

    def get_file_base64(self):
        """Return file data as base64 encoded string."""
        if self.file_data:
            return base64.b64encode(self.file_data).decode('utf-8')
        return None

    def get_file_data_uri(self):
        """Return file as a data URI."""
        if self.file_data and self.mime_type:
            b64_data = base64.b64encode(self.file_data).decode('utf-8')
            return f"data:{self.mime_type};base64,{b64_data}"
        return None

    @property
    def has_file(self):
        """Check if file data exists."""
        return self.file_data is not None


class Payslip(BaseModel):
    """
    Generated payslip documents.
    """
    payroll_item = models.OneToOneField(
        PayrollItem,
        on_delete=models.CASCADE,
        related_name='payslip'
    )
    payslip_number = models.CharField(max_length=50, unique=True)
    # Binary file storage
    file_data = models.BinaryField(null=True, blank=True)
    file_name = models.CharField(max_length=255, null=True, blank=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=100, null=True, blank=True)
    file_checksum = models.CharField(max_length=64, null=True, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    emailed_at = models.DateTimeField(null=True, blank=True)
    viewed_at = models.DateTimeField(null=True, blank=True)
    downloaded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'payslips'
        ordering = ['-generated_at']

    def __str__(self):
        return f"{self.payslip_number}"

    def set_file(self, file_obj, filename=None):
        """Store a file as binary data."""
        if file_obj is None:
            self.file_data = None
            self.file_name = None
            self.file_size = None
            self.mime_type = None
            self.file_checksum = None
            return

        content = file_obj.read() if hasattr(file_obj, 'read') else file_obj

        if filename:
            self.file_name = filename
        elif hasattr(file_obj, 'name'):
            self.file_name = file_obj.name
        else:
            self.file_name = f"{self.payslip_number}.pdf"

        self.file_data = content
        self.file_size = len(content)

        if hasattr(file_obj, 'content_type'):
            self.mime_type = file_obj.content_type
        else:
            mime, _ = mimetypes.guess_type(self.file_name)
            self.mime_type = mime or 'application/pdf'

        self.file_checksum = hashlib.sha256(content).hexdigest()

    def get_file_base64(self):
        """Return file data as base64 encoded string."""
        if self.file_data:
            return base64.b64encode(self.file_data).decode('utf-8')
        return None

    def get_file_data_uri(self):
        """Return file as a data URI."""
        if self.file_data and self.mime_type:
            b64_data = base64.b64encode(self.file_data).decode('utf-8')
            return f"data:{self.mime_type};base64,{b64_data}"
        return None

    @property
    def has_file(self):
        """Check if file data exists."""
        return self.file_data is not None


class EmployeeTransaction(BaseModel):
    """
    Employee transactions (recurring or one-time) with optional value overrides.
    Used for earnings, deductions, loans, fund contributions, overtime, and shift allowances.
    """
    class OverrideType(models.TextChoices):
        NONE = 'NONE', 'Use Default'
        FIXED = 'FIXED', 'Fixed Amount'
        PERCENTAGE = 'PCT', 'Custom Percentage'
        FORMULA = 'FORMULA', 'Custom Formula'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending Approval'
        APPROVED = 'APPROVED', 'Approved'
        ACTIVE = 'ACTIVE', 'Active'
        SUSPENDED = 'SUSPENDED', 'Suspended'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    class TargetType(models.TextChoices):
        INDIVIDUAL = 'INDIVIDUAL', 'Individual Employee'
        GRADE = 'GRADE', 'Job Grade'
        BAND = 'BAND', 'Salary Band'

    # Unique tracking
    reference_number = models.CharField(max_length=50, unique=True, db_index=True)

    # Target type - determines how this transaction is applied
    target_type = models.CharField(
        max_length=20,
        choices=TargetType.choices,
        default=TargetType.INDIVIDUAL,
        db_index=True,
        help_text='Determines whether this transaction applies to an individual, grade, or band'
    )

    # Core relationships - employee is nullable for grade/band transactions
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='transactions',
        null=True,
        blank=True,
        help_text='Required for INDIVIDUAL target type'
    )

    # Grade-based transactions - applies to all employees with this grade
    job_grade = models.ForeignKey(
        'organization.JobGrade',
        on_delete=models.CASCADE,
        related_name='transactions',
        null=True,
        blank=True,
        help_text='Required for GRADE target type'
    )

    # Band-based transactions - applies to all employees with this salary band
    salary_band = models.ForeignKey(
        SalaryBand,
        on_delete=models.CASCADE,
        related_name='transactions',
        null=True,
        blank=True,
        help_text='Required for BAND target type'
    )

    pay_component = models.ForeignKey(
        PayComponent,
        on_delete=models.PROTECT,
        related_name='employee_transactions'
    )

    # Value overrides
    override_type = models.CharField(
        max_length=20,
        choices=OverrideType.choices,
        default=OverrideType.NONE
    )
    override_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    override_percentage = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    override_formula = models.TextField(null=True, blank=True)

    # Recurring vs one-time
    is_recurring = models.BooleanField(default=True)
    effective_from = models.DateField(db_index=True)
    effective_to = models.DateField(null=True, blank=True)

    # Calendar month/year link
    calendar = models.ForeignKey(
        PayrollCalendar,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_transactions',
        help_text='Calendar month/year this transaction applies to'
    )

    # For one-time transactions
    payroll_period = models.ForeignKey(
        PayrollPeriod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_transactions'
    )

    # Status workflow
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )

    # Approval workflow
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_transactions'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approval_notes = models.TextField(null=True, blank=True)

    # Documentation
    description = models.TextField(null=True, blank=True)
    # Binary file storage for supporting document
    document_data = models.BinaryField(null=True, blank=True)
    document_name = models.CharField(max_length=255, null=True, blank=True)
    document_size = models.PositiveIntegerField(null=True, blank=True)
    document_mime = models.CharField(max_length=100, null=True, blank=True)
    document_checksum = models.CharField(max_length=64, null=True, blank=True)

    class Meta:
        db_table = 'employee_transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['pay_component', 'status']),
            models.Index(fields=['effective_from', 'effective_to']),
            models.Index(fields=['target_type', 'status']),
            models.Index(fields=['job_grade', 'status']),
            models.Index(fields=['salary_band', 'status']),
        ]

    def __str__(self):
        if self.target_type == self.TargetType.INDIVIDUAL and self.employee:
            return f"{self.reference_number} - {self.employee.employee_number} - {self.pay_component.code}"
        elif self.target_type == self.TargetType.GRADE and self.job_grade:
            return f"{self.reference_number} - Grade:{self.job_grade.code} - {self.pay_component.code}"
        elif self.target_type == self.TargetType.BAND and self.salary_band:
            return f"{self.reference_number} - Band:{self.salary_band.code} - {self.pay_component.code}"
        return f"{self.reference_number} - {self.pay_component.code}"

    def clean(self):
        """Validate that the appropriate target field is set based on target_type."""
        from django.core.exceptions import ValidationError
        errors = {}

        if self.target_type == self.TargetType.INDIVIDUAL:
            if not self.employee:
                errors['employee'] = 'Employee is required for individual transactions.'
        elif self.target_type == self.TargetType.GRADE:
            if not self.job_grade:
                errors['job_grade'] = 'Job grade is required for grade-based transactions.'
        elif self.target_type == self.TargetType.BAND:
            if not self.salary_band:
                errors['salary_band'] = 'Salary band is required for band-based transactions.'

        if errors:
            raise ValidationError(errors)

    def get_applicable_employees(self):
        """Get all employees this transaction applies to."""
        from employees.models import Employee

        if self.target_type == self.TargetType.INDIVIDUAL:
            return Employee.objects.filter(pk=self.employee_id) if self.employee_id else Employee.objects.none()
        elif self.target_type == self.TargetType.GRADE:
            return Employee.objects.filter(
                grade=self.job_grade,
                status='ACTIVE',
                is_deleted=False
            )
        elif self.target_type == self.TargetType.BAND:
            # Employees linked to this band via their grade's salary_band or via salary_notch
            return Employee.objects.filter(
                models.Q(grade__salary_band=self.salary_band) |
                models.Q(salary_notch__level__band=self.salary_band),
                status='ACTIVE',
                is_deleted=False
            ).distinct()
        return Employee.objects.none()

    def set_document(self, file_obj, filename=None):
        """Store supporting document as binary data."""
        if file_obj is None:
            self.document_data = None
            self.document_name = None
            self.document_size = None
            self.document_mime = None
            self.document_checksum = None
            return

        content = file_obj.read() if hasattr(file_obj, 'read') else file_obj

        if filename:
            self.document_name = filename
        elif hasattr(file_obj, 'name'):
            self.document_name = file_obj.name
        else:
            self.document_name = 'document'

        self.document_data = content
        self.document_size = len(content)

        if hasattr(file_obj, 'content_type'):
            self.document_mime = file_obj.content_type
        else:
            mime, _ = mimetypes.guess_type(self.document_name)
            self.document_mime = mime or 'application/octet-stream'

        self.document_checksum = hashlib.sha256(content).hexdigest()

    def get_document_base64(self):
        """Return document data as base64 encoded string."""
        if self.document_data:
            return base64.b64encode(self.document_data).decode('utf-8')
        return None

    def get_document_data_uri(self):
        """Return document as a data URI."""
        if self.document_data and self.document_mime:
            b64_data = base64.b64encode(self.document_data).decode('utf-8')
            return f"data:{self.document_mime};base64,{b64_data}"
        return None

    @property
    def has_document(self):
        """Check if document data exists."""
        return self.document_data is not None

    def calculate_amount(self, basic_salary: Decimal, gross_salary: Decimal) -> Decimal:
        """
        Calculate the transaction amount based on override type or pay component defaults.

        Args:
            basic_salary: Employee's basic salary
            gross_salary: Employee's gross salary

        Returns:
            Calculated amount as Decimal
        """
        # Determine which calculation to use
        if self.override_type == self.OverrideType.FIXED:
            return self.override_amount or Decimal('0')

        elif self.override_type == self.OverrideType.PERCENTAGE:
            pct = self.override_percentage or Decimal('0')
            # Default to percentage of basic
            return (basic_salary * pct / Decimal('100')).quantize(Decimal('0.01'))

        elif self.override_type == self.OverrideType.FORMULA:
            formula = self.override_formula
            if formula:
                return self._evaluate_formula(formula, basic_salary, gross_salary)
            return Decimal('0')

        # Use pay component defaults (NONE override)
        component = self.pay_component
        calc_type = component.calculation_type

        if calc_type == PayComponent.CalculationType.FIXED:
            return component.default_amount or Decimal('0')

        elif calc_type == PayComponent.CalculationType.PERCENTAGE_BASIC:
            pct = component.percentage_value or Decimal('0')
            return (basic_salary * pct / Decimal('100')).quantize(Decimal('0.01'))

        elif calc_type == PayComponent.CalculationType.PERCENTAGE_GROSS:
            pct = component.percentage_value or Decimal('0')
            return (gross_salary * pct / Decimal('100')).quantize(Decimal('0.01'))

        elif calc_type == PayComponent.CalculationType.FORMULA:
            formula = component.formula
            if formula:
                return self._evaluate_formula(formula, basic_salary, gross_salary)
            return Decimal('0')

        return Decimal('0')

    def _evaluate_formula(self, formula: str, basic_salary: Decimal, gross_salary: Decimal) -> Decimal:
        """
        Safely evaluate a formula with given salary values.

        Supported variables: basic, gross
        Supported functions: min, max, round, abs
        Supported conditionals: value1 if condition else value2

        Example formulas:
        - "basic / 176 * 1.5" (overtime)
        - "min(basic * 0.10, 500)" (capped allowance)
        - "100 + basic * 0.05" (flat + percentage)
        - "0 if gross <= 490 else (gross - 490) * 0.05" (conditional/PAYE)
        """
        # Define allowed names
        allowed_names = {
            'basic': float(basic_salary),
            'gross': float(gross_salary),
            'min': min,
            'max': max,
            'round': round,
            'abs': abs,
            'True': True,
            'False': False,
        }

        try:
            # Sanitize formula - allow safe characters including comparison operators
            # Allows: digits, spaces, math operators, parentheses, commas, letters, underscores,
            # and comparison operators (<, >, =, !)
            if not re.match(r'^[\d\s\+\-\*\/\.\(\)\,a-zA-Z_<>=!]+$', formula):
                return Decimal('0')

            # Evaluate with restricted namespace
            result = eval(formula, {"__builtins__": {}}, allowed_names)
            return Decimal(str(result)).quantize(Decimal('0.01'))
        except Exception:
            return Decimal('0')

    @classmethod
    def generate_reference_number(cls) -> str:
        """Generate a unique reference number for the transaction."""
        import uuid
        from datetime import datetime
        prefix = datetime.now().strftime('%Y%m')
        suffix = uuid.uuid4().hex[:8].upper()
        return f"TXN-{prefix}-{suffix}"

    def save(self, *args, **kwargs):
        if not self.reference_number:
            self.reference_number = self.generate_reference_number()

        # Auto-link to active calendar if not set
        if not self.calendar_id:
            active_calendar = PayrollSettings.get_active_calendar()
            if active_calendar:
                self.calendar = active_calendar

        super().save(*args, **kwargs)
