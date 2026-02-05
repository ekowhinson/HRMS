"""
Admin configuration for payroll app.
"""

from django.contrib import admin
from .models import (
    Bank, BankBranch, StaffCategory,
    SalaryBand, SalaryLevel, SalaryNotch,
    PayComponent, SalaryStructure, SalaryStructureComponent,
    EmployeeSalary, TaxBracket, TaxRelief, SSNITRate,
    OvertimeBonusTaxConfig, PayrollCalendar, PayrollPeriod, PayrollRun,
    PayrollItem, AdHocPayment, EmployeeTransaction, PayrollSettings
)


# Bank Setup
@admin.register(Bank)
class BankAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'short_name', 'swift_code', 'is_active']
    list_filter = ['is_active']
    search_fields = ['code', 'name', 'swift_code']
    ordering = ['name']


class BankBranchInline(admin.TabularInline):
    model = BankBranch
    extra = 0
    fields = ['code', 'name', 'sort_code', 'city', 'is_active']


@admin.register(BankBranch)
class BankBranchAdmin(admin.ModelAdmin):
    list_display = ['bank', 'code', 'name', 'city', 'is_active']
    list_filter = ['bank', 'is_active', 'region']
    search_fields = ['code', 'name', 'bank__name']
    ordering = ['bank__name', 'name']
    raw_id_fields = ['bank', 'region']


# Staff Category
@admin.register(StaffCategory)
class StaffCategoryAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'payroll_group', 'sort_order', 'is_active']
    list_filter = ['is_active', 'payroll_group']
    search_fields = ['code', 'name']
    ordering = ['sort_order', 'name']


# Salary Structure (Band/Level/Notch)
@admin.register(SalaryBand)
class SalaryBandAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'min_salary', 'max_salary', 'sort_order', 'is_active']
    list_filter = ['is_active']
    search_fields = ['code', 'name']
    ordering = ['sort_order', 'code']


class SalaryNotchInline(admin.TabularInline):
    model = SalaryNotch
    extra = 0
    fields = ['code', 'name', 'amount', 'sort_order', 'is_active']


@admin.register(SalaryLevel)
class SalaryLevelAdmin(admin.ModelAdmin):
    list_display = ['band', 'code', 'name', 'min_salary', 'max_salary', 'sort_order', 'is_active']
    list_filter = ['band', 'is_active']
    search_fields = ['code', 'name', 'band__name']
    ordering = ['band__sort_order', 'sort_order', 'code']
    raw_id_fields = ['band']
    inlines = [SalaryNotchInline]


@admin.register(SalaryNotch)
class SalaryNotchAdmin(admin.ModelAdmin):
    list_display = ['full_code', 'name', 'amount', 'sort_order', 'is_active']
    list_filter = ['level__band', 'is_active']
    search_fields = ['code', 'name', 'level__code', 'level__band__code']
    ordering = ['level__band__sort_order', 'level__sort_order', 'sort_order']
    raw_id_fields = ['level']


# Pay Components
@admin.register(PayComponent)
class PayComponentAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'component_type', 'category', 'calculation_type', 'is_taxable', 'is_active']
    list_filter = ['component_type', 'category', 'is_taxable', 'is_statutory', 'is_active']
    search_fields = ['code', 'name']
    ordering = ['component_type', 'display_order']
    fieldsets = (
        (None, {'fields': ('code', 'name', 'short_name', 'description')}),
        ('Type & Calculation', {'fields': ('component_type', 'category', 'calculation_type')}),
        ('Values', {'fields': ('default_amount', 'percentage_value', 'formula')}),
        ('Tax Treatment', {'fields': ('is_taxable', 'reduces_taxable', 'is_overtime', 'is_bonus', 'is_part_of_basic', 'is_part_of_gross', 'affects_ssnit')}),
        ('Settings', {'fields': ('is_statutory', 'is_recurring', 'is_prorated', 'is_arrears_applicable', 'requires_approval', 'approval_threshold')}),
        ('Display', {'fields': ('display_order', 'show_on_payslip', 'is_active')}),
    )


# Salary Structures
@admin.register(SalaryStructure)
class SalaryStructureAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'grade', 'effective_from', 'effective_to', 'is_active']
    list_filter = ['is_active', 'grade']
    search_fields = ['code', 'name']
    raw_id_fields = ['grade']


@admin.register(EmployeeSalary)
class EmployeeSalaryAdmin(admin.ModelAdmin):
    list_display = ['employee', 'basic_salary', 'gross_salary', 'effective_from', 'is_current']
    list_filter = ['is_current']
    search_fields = ['employee__employee_number', 'employee__first_name', 'employee__last_name']
    raw_id_fields = ['employee', 'salary_structure', 'approved_by']
    date_hierarchy = 'effective_from'


# Tax Configuration
@admin.register(TaxBracket)
class TaxBracketAdmin(admin.ModelAdmin):
    list_display = ['name', 'min_amount', 'max_amount', 'rate', 'order', 'is_active']
    list_filter = ['is_active']
    ordering = ['order']


@admin.register(TaxRelief)
class TaxReliefAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'relief_type', 'amount', 'percentage', 'is_active']
    list_filter = ['relief_type', 'is_active']
    search_fields = ['code', 'name']


@admin.register(SSNITRate)
class SSNITRateAdmin(admin.ModelAdmin):
    list_display = ['tier', 'employer_rate', 'employee_rate', 'effective_from', 'is_active']
    list_filter = ['tier', 'is_active']


@admin.register(OvertimeBonusTaxConfig)
class OvertimeBonusTaxConfigAdmin(admin.ModelAdmin):
    list_display = ['name', 'effective_from', 'effective_to', 'is_active']
    list_filter = ['is_active']


# Payroll Calendar
@admin.register(PayrollCalendar)
class PayrollCalendarAdmin(admin.ModelAdmin):
    list_display = ['name', 'year', 'month', 'start_date', 'end_date', 'is_active']
    list_filter = ['year', 'is_active']
    search_fields = ['name']
    ordering = ['-year', '-month']
    actions = ['create_year_calendar']

    @admin.action(description='Create full year calendar')
    def create_year_calendar(self, request, queryset):
        """Admin action to create a full year calendar."""
        from django.contrib import messages
        # Get the year from the first selected item
        if queryset.exists():
            year = queryset.first().year
            created = PayrollCalendar.create_year_calendar(year, request.user)
            messages.success(request, f'Created {len(created)} calendar months for {year}')
        else:
            messages.warning(request, 'No items selected')


# Payroll Processing
@admin.register(PayrollPeriod)
class PayrollPeriodAdmin(admin.ModelAdmin):
    list_display = ['name', 'year', 'month', 'start_date', 'end_date', 'status', 'calendar']
    list_filter = ['status', 'year', 'calendar']
    search_fields = ['name']
    date_hierarchy = 'start_date'
    actions = ['create_year_periods']

    @admin.action(description='Create full year periods')
    def create_year_periods(self, request, queryset):
        """Admin action to create a full year of payroll periods."""
        from django.contrib import messages
        if queryset.exists():
            year = queryset.first().year
            created = PayrollPeriod.create_year_periods(year, request.user)
            messages.success(request, f'Created {len(created)} payroll periods for {year}')


@admin.register(PayrollRun)
class PayrollRunAdmin(admin.ModelAdmin):
    list_display = ['run_number', 'payroll_period', 'status', 'total_employees', 'total_net', 'run_date']
    list_filter = ['status', 'payroll_period']
    search_fields = ['run_number']
    date_hierarchy = 'run_date'
    readonly_fields = ['run_number', 'total_employees', 'total_gross', 'total_deductions', 'total_net']


@admin.register(PayrollItem)
class PayrollItemAdmin(admin.ModelAdmin):
    list_display = ['payroll_run', 'employee', 'basic_salary', 'gross_earnings', 'total_deductions', 'net_salary', 'status']
    list_filter = ['status', 'payroll_run']
    search_fields = ['employee__employee_number', 'employee__first_name', 'employee__last_name']
    raw_id_fields = ['payroll_run', 'employee', 'employee_salary']


@admin.register(AdHocPayment)
class AdHocPaymentAdmin(admin.ModelAdmin):
    list_display = ['employee', 'payment_type', 'pay_component', 'amount', 'status', 'payroll_period']
    list_filter = ['payment_type', 'status', 'payroll_period']
    search_fields = ['employee__employee_number', 'description']
    raw_id_fields = ['employee', 'pay_component', 'payroll_period', 'approved_by']


@admin.register(EmployeeTransaction)
class EmployeeTransactionAdmin(admin.ModelAdmin):
    list_display = ['reference_number', 'employee', 'pay_component', 'override_type', 'status', 'effective_from', 'calendar']
    list_filter = ['status', 'override_type', 'is_recurring', 'calendar']
    search_fields = ['reference_number', 'employee__employee_number']
    raw_id_fields = ['employee', 'pay_component', 'payroll_period', 'calendar', 'approved_by']
    date_hierarchy = 'effective_from'


# Payroll Settings (Singleton)
@admin.register(PayrollSettings)
class PayrollSettingsAdmin(admin.ModelAdmin):
    """
    Admin for global payroll settings (singleton pattern).
    Only one record should exist with pk=1.
    """
    list_display = ['get_active_calendar_display', 'get_active_period_display', 'auto_advance_period', 'updated_at']
    readonly_fields = ['updated_at', 'updated_by']
    raw_id_fields = ['active_calendar', 'active_period']
    fieldsets = (
        ('Active Period', {
            'fields': ('active_calendar', 'active_period'),
            'description': 'The currently active payroll calendar and period. All new transactions will automatically be linked to this calendar.'
        }),
        ('Settings', {
            'fields': ('auto_advance_period', 'default_transaction_status'),
        }),
        ('Audit', {
            'fields': ('updated_at', 'updated_by'),
            'classes': ('collapse',),
        }),
    )

    def get_active_calendar_display(self, obj):
        return obj.active_calendar.name if obj.active_calendar else 'Not Set'
    get_active_calendar_display.short_description = 'Active Calendar'

    def get_active_period_display(self, obj):
        return obj.active_period.name if obj.active_period else 'Not Set'
    get_active_period_display.short_description = 'Active Period'

    def has_add_permission(self, request):
        # Only allow adding if no settings exist
        return not PayrollSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        # Never allow deleting the settings
        return False

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
