"""
Leave management admin configuration.
"""

from django.contrib import admin
from .models import (
    LeaveType, LeavePolicy, LeaveBalance, LeaveRequest, LeaveApproval, LeaveDocument,
    LeavePlan, LeavePlanEntry, LeaveCarryForwardRequest, LeaveReminder,
    LeaveApprovalWorkflowTemplate, LeaveApprovalWorkflowLevel, LocationWorkflowMapping,
    LeaveRequestWorkflowStatus, LeaveApprovalAction, LeaveRelieverValidation
)


@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'accrual_type', 'default_days', 'max_days', 'is_paid', 'is_active']
    list_filter = ['is_active', 'is_paid', 'accrual_type']
    search_fields = ['code', 'name']
    ordering = ['sort_order', 'name']


@admin.register(LeavePolicy)
class LeavePolicyAdmin(admin.ModelAdmin):
    list_display = ['name', 'leave_type', 'grade', 'entitled_days', 'is_active']
    list_filter = ['leave_type', 'is_active']
    search_fields = ['name']


class LeaveApprovalInline(admin.TabularInline):
    model = LeaveApproval
    extra = 0
    readonly_fields = ['action_at']


class LeaveDocumentInline(admin.TabularInline):
    model = LeaveDocument
    extra = 0
    fields = ['file_name', 'document_type', 'uploaded_by', 'created_at']
    readonly_fields = ['file_name', 'uploaded_by', 'created_at']


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ['request_number', 'employee', 'leave_type', 'start_date', 'end_date', 'number_of_days', 'status']
    list_filter = ['status', 'leave_type', 'start_date']
    search_fields = ['request_number', 'employee__employee_number', 'employee__first_name', 'employee__last_name']
    ordering = ['-created_at']
    readonly_fields = ['request_number']
    inlines = [LeaveApprovalInline, LeaveDocumentInline]


@admin.register(LeaveBalance)
class LeaveBalanceAdmin(admin.ModelAdmin):
    list_display = ['employee', 'leave_type', 'year', 'opening_balance', 'earned', 'taken', 'pending', 'available_balance']
    list_filter = ['year', 'leave_type']
    search_fields = ['employee__employee_number', 'employee__first_name', 'employee__last_name']
    ordering = ['-year', 'employee']


@admin.register(LeaveApproval)
class LeaveApprovalAdmin(admin.ModelAdmin):
    list_display = ['leave_request', 'level', 'action', 'approver', 'action_at']
    list_filter = ['action', 'level']


@admin.register(LeaveDocument)
class LeaveDocumentAdmin(admin.ModelAdmin):
    list_display = ['leave_request', 'file_name', 'document_type', 'uploaded_by', 'created_at']
    list_filter = ['document_type']


# Leave Planning Admin

class LeavePlanEntryInline(admin.TabularInline):
    model = LeavePlanEntry
    extra = 0
    fields = ['leave_type', 'start_date', 'end_date', 'number_of_days', 'status', 'quarter']
    readonly_fields = ['quarter']


@admin.register(LeavePlan)
class LeavePlanAdmin(admin.ModelAdmin):
    list_display = ['employee', 'year', 'total_planned_days', 'leave_entitlement', 'status', 'submitted_at', 'approved_at']
    list_filter = ['year', 'status']
    search_fields = ['employee__employee_number', 'employee__first_name', 'employee__last_name']
    ordering = ['-year', 'employee']
    readonly_fields = ['total_planned_days', 'submitted_at', 'approved_at']
    inlines = [LeavePlanEntryInline]


@admin.register(LeavePlanEntry)
class LeavePlanEntryAdmin(admin.ModelAdmin):
    list_display = ['leave_plan', 'leave_type', 'start_date', 'end_date', 'number_of_days', 'status', 'quarter']
    list_filter = ['status', 'leave_type', 'quarter']
    ordering = ['start_date']
    readonly_fields = ['quarter']


@admin.register(LeaveCarryForwardRequest)
class LeaveCarryForwardRequestAdmin(admin.ModelAdmin):
    list_display = [
        'employee', 'from_year', 'to_year', 'available_balance',
        'standard_carry_forward', 'requested_carry_forward',
        'approved_carry_forward', 'status'
    ]
    list_filter = ['status', 'from_year', 'to_year']
    search_fields = ['employee__employee_number', 'employee__first_name', 'employee__last_name']
    ordering = ['-created_at']
    readonly_fields = ['additional_days_requested', 'hr_reviewed_at', 'ceo_approved_at']
    fieldsets = (
        ('Employee', {
            'fields': ('employee',)
        }),
        ('Period', {
            'fields': ('from_year', 'to_year')
        }),
        ('Balance Details', {
            'fields': (
                'available_balance', 'standard_carry_forward',
                'requested_carry_forward', 'additional_days_requested',
                'approved_carry_forward', 'days_to_lapse'
            )
        }),
        ('Request', {
            'fields': ('reason', 'status')
        }),
        ('HR Review', {
            'fields': ('hr_reviewer', 'hr_reviewed_at', 'hr_comments'),
            'classes': ('collapse',)
        }),
        ('CEO Approval', {
            'fields': ('ceo_approver', 'ceo_approved_at', 'ceo_comments'),
            'classes': ('collapse',)
        }),
        ('Outcome', {
            'fields': ('rejection_reason',),
            'classes': ('collapse',)
        }),
    )


@admin.register(LeaveReminder)
class LeaveReminderAdmin(admin.ModelAdmin):
    list_display = ['employee', 'year', 'reminder_type', 'outstanding_balance', 'sent_at', 'acknowledged']
    list_filter = ['year', 'reminder_type', 'acknowledged']
    search_fields = ['employee__employee_number', 'employee__first_name', 'employee__last_name']
    ordering = ['-created_at']
    readonly_fields = ['sent_at', 'read_at', 'acknowledged_at']


# Location-Based Approval Workflow Admin

class LeaveApprovalWorkflowLevelInline(admin.TabularInline):
    model = LeaveApprovalWorkflowLevel
    extra = 0
    fields = ['level', 'approver_type', 'name', 'can_skip']
    ordering = ['level']


@admin.register(LeaveApprovalWorkflowTemplate)
class LeaveApprovalWorkflowTemplateAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'location_category', 'is_default', 'is_active', 'created_at']
    list_filter = ['location_category', 'is_default', 'is_active']
    search_fields = ['name', 'code', 'description']
    ordering = ['name']
    inlines = [LeaveApprovalWorkflowLevelInline]


@admin.register(LeaveApprovalWorkflowLevel)
class LeaveApprovalWorkflowLevelAdmin(admin.ModelAdmin):
    list_display = ['template', 'level', 'name', 'approver_type', 'can_skip']
    list_filter = ['template', 'approver_type']
    search_fields = ['name', 'template__name']
    ordering = ['template', 'level']


@admin.register(LocationWorkflowMapping)
class LocationWorkflowMappingAdmin(admin.ModelAdmin):
    list_display = ['location', 'workflow_template', 'is_active', 'created_at']
    list_filter = ['workflow_template', 'is_active']
    search_fields = ['location__name', 'workflow_template__name']
    ordering = ['location']


class LeaveApprovalActionInline(admin.TabularInline):
    model = LeaveApprovalAction
    extra = 0
    fields = ['workflow_level', 'action', 'actor', 'comments', 'acted_at']
    readonly_fields = ['acted_at']


@admin.register(LeaveRequestWorkflowStatus)
class LeaveRequestWorkflowStatusAdmin(admin.ModelAdmin):
    list_display = ['leave_request', 'workflow_template', 'current_level', 'status', 'pending_since', 'completed_at']
    list_filter = ['status', 'workflow_template']
    search_fields = ['leave_request__request_number']
    ordering = ['-pending_since']
    readonly_fields = ['pending_since', 'completed_at']
    inlines = [LeaveApprovalActionInline]


@admin.register(LeaveApprovalAction)
class LeaveApprovalActionAdmin(admin.ModelAdmin):
    list_display = ['workflow_status', 'workflow_level', 'action', 'actor', 'acted_at']
    list_filter = ['action']
    ordering = ['-acted_at']
    readonly_fields = ['acted_at']


@admin.register(LeaveRelieverValidation)
class LeaveRelieverValidationAdmin(admin.ModelAdmin):
    list_display = ['leave_request', 'reliever', 'validation_status', 'validated_at']
    list_filter = ['validation_status']
    search_fields = ['leave_request__request_number', 'reliever__first_name', 'reliever__last_name']
    ordering = ['-created_at']
    readonly_fields = ['validated_at']
