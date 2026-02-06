"""
Admin configuration for Exit/Offboarding module.
"""

from django.contrib import admin
from .models import (
    ExitType, ExitRequest, ExitInterview, ClearanceDepartment,
    ExitClearance, ExitChecklistItem, AssetReturn, FinalSettlement
)


@admin.register(ExitType)
class ExitTypeAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'notice_period_days', 'requires_exit_interview', 'requires_clearance', 'is_active']
    list_filter = ['is_active', 'requires_exit_interview', 'requires_clearance']
    search_fields = ['code', 'name']
    ordering = ['sort_order', 'name']


@admin.register(ClearanceDepartment)
class ClearanceDepartmentAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'responsible_role', 'is_required', 'is_active']
    list_filter = ['is_active', 'is_required']
    search_fields = ['code', 'name']
    ordering = ['sort_order', 'name']


class ExitClearanceInline(admin.TabularInline):
    model = ExitClearance
    extra = 0
    readonly_fields = ['cleared_by', 'cleared_at']


class AssetReturnInline(admin.TabularInline):
    model = AssetReturn
    extra = 0
    readonly_fields = ['received_by', 'returned_at']


class ExitInterviewInline(admin.StackedInline):
    model = ExitInterview
    extra = 0
    readonly_fields = ['conducted_date']


class FinalSettlementInline(admin.StackedInline):
    model = FinalSettlement
    extra = 0
    readonly_fields = ['gross_settlement', 'total_deductions', 'net_settlement', 'calculated_by', 'calculated_at', 'approved_by', 'approved_at']


@admin.register(ExitRequest)
class ExitRequestAdmin(admin.ModelAdmin):
    list_display = ['request_number', 'employee', 'exit_type', 'status', 'request_date', 'proposed_last_day']
    list_filter = ['status', 'exit_type', 'request_date']
    search_fields = ['request_number', 'employee__first_name', 'employee__last_name', 'employee__employee_number']
    readonly_fields = ['request_number', 'submitted_at', 'reviewed_at', 'approved_at', 'completed_at']
    date_hierarchy = 'request_date'
    inlines = [ExitClearanceInline, AssetReturnInline, ExitInterviewInline, FinalSettlementInline]

    fieldsets = (
        ('Request Details', {
            'fields': ('request_number', 'employee', 'exit_type', 'status')
        }),
        ('Reason', {
            'fields': ('reason', 'additional_comments')
        }),
        ('Dates', {
            'fields': ('request_date', 'notice_start_date', 'proposed_last_day', 'actual_last_day')
        }),
        ('Workflow', {
            'fields': (
                'submitted_at',
                ('reviewed_by', 'reviewed_at', 'review_comments'),
                ('approved_by', 'approved_at', 'approval_comments'),
                ('completed_by', 'completed_at')
            )
        }),
    )


@admin.register(ExitInterview)
class ExitInterviewAdmin(admin.ModelAdmin):
    list_display = ['exit_request', 'status', 'scheduled_date', 'interviewer', 'conducted_date']
    list_filter = ['status']
    search_fields = ['exit_request__request_number', 'exit_request__employee__first_name']
    readonly_fields = ['conducted_date']


@admin.register(ExitClearance)
class ExitClearanceAdmin(admin.ModelAdmin):
    list_display = ['exit_request', 'department', 'is_cleared', 'cleared_by', 'cleared_at']
    list_filter = ['is_cleared', 'department']
    search_fields = ['exit_request__request_number', 'exit_request__employee__first_name']
    readonly_fields = ['cleared_by', 'cleared_at']


@admin.register(ExitChecklistItem)
class ExitChecklistItemAdmin(admin.ModelAdmin):
    list_display = ['item_name', 'clearance', 'is_completed', 'completed_by', 'completed_at']
    list_filter = ['is_completed']
    search_fields = ['item_name']
    readonly_fields = ['completed_by', 'completed_at']


@admin.register(AssetReturn)
class AssetReturnAdmin(admin.ModelAdmin):
    list_display = ['asset_name', 'exit_request', 'asset_type', 'status', 'deduction_amount']
    list_filter = ['status', 'asset_type']
    search_fields = ['asset_name', 'asset_tag', 'exit_request__request_number']
    readonly_fields = ['received_by', 'returned_at']


@admin.register(FinalSettlement)
class FinalSettlementAdmin(admin.ModelAdmin):
    list_display = ['exit_request', 'status', 'gross_settlement', 'total_deductions', 'net_settlement']
    list_filter = ['status']
    search_fields = ['exit_request__request_number', 'exit_request__employee__first_name']
    readonly_fields = ['gross_settlement', 'total_deductions', 'net_settlement', 'calculated_by', 'calculated_at', 'approved_by', 'approved_at', 'paid_at']

    fieldsets = (
        ('Request', {
            'fields': ('exit_request', 'status')
        }),
        ('Earnings', {
            'fields': ('salary_arrears', 'leave_encashment', 'leave_days_encashed', 'gratuity', 'bonus', 'other_earnings', 'other_earnings_details')
        }),
        ('Deductions', {
            'fields': ('loan_balance', 'advance_balance', 'asset_deductions', 'tax_deductions', 'other_deductions', 'other_deductions_details')
        }),
        ('Totals', {
            'fields': ('gross_settlement', 'total_deductions', 'net_settlement')
        }),
        ('Notes', {
            'fields': ('calculation_notes',)
        }),
        ('Approval', {
            'fields': (('calculated_by', 'calculated_at'), ('approved_by', 'approved_at'), ('paid_at', 'payment_reference'))
        }),
    )
