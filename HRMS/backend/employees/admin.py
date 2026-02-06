"""
Employee management admin configuration.
"""

from django.contrib import admin
from .models import (
    Employee, EmergencyContact, Dependent, Education,
    WorkExperience, Certification, Skill, BankAccount, EmploymentHistory,
    DataUpdateRequest, DataUpdateDocument,
    ServiceRequestType, ServiceRequest, ServiceRequestComment, ServiceRequestDocument
)


class EmergencyContactInline(admin.TabularInline):
    model = EmergencyContact
    extra = 0


class DependentInline(admin.TabularInline):
    model = Dependent
    extra = 0


class BankAccountInline(admin.TabularInline):
    model = BankAccount
    extra = 0
    fields = ['bank_name', 'account_number', 'account_name', 'is_primary', 'is_active']


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ['employee_number', 'full_name', 'department', 'position', 'status', 'employment_type']
    list_filter = ['status', 'employment_type', 'department', 'grade']
    search_fields = ['employee_number', 'first_name', 'last_name', 'work_email']
    ordering = ['employee_number']
    inlines = [EmergencyContactInline, DependentInline, BankAccountInline]

    def full_name(self, obj):
        return obj.full_name
    full_name.short_description = 'Name'


@admin.register(EmergencyContact)
class EmergencyContactAdmin(admin.ModelAdmin):
    list_display = ['employee', 'name', 'relationship', 'phone_primary', 'is_primary']
    list_filter = ['is_primary', 'relationship']
    search_fields = ['name', 'employee__employee_number']


@admin.register(Dependent)
class DependentAdmin(admin.ModelAdmin):
    list_display = ['employee', 'name', 'relationship', 'date_of_birth', 'is_eligible_for_benefits']
    list_filter = ['relationship', 'is_eligible_for_benefits']
    search_fields = ['name', 'employee__employee_number']


@admin.register(Education)
class EducationAdmin(admin.ModelAdmin):
    list_display = ['employee', 'institution', 'qualification_level', 'field_of_study', 'end_date']
    list_filter = ['qualification_level']
    search_fields = ['employee__employee_number', 'institution']


@admin.register(WorkExperience)
class WorkExperienceAdmin(admin.ModelAdmin):
    list_display = ['employee', 'company_name', 'position', 'start_date', 'end_date']
    search_fields = ['employee__employee_number', 'company_name', 'position']


@admin.register(Certification)
class CertificationAdmin(admin.ModelAdmin):
    list_display = ['employee', 'name', 'issuing_organization', 'issue_date', 'expiry_date']
    search_fields = ['employee__employee_number', 'name']


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ['employee', 'name', 'proficiency']
    list_filter = ['proficiency']
    search_fields = ['employee__employee_number', 'name']


@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = ['employee', 'display_bank_name', 'account_number', 'is_primary', 'is_active', 'is_verified']
    list_filter = ['is_primary', 'is_active', 'is_verified']
    search_fields = ['employee__employee_number', 'account_number']


@admin.register(EmploymentHistory)
class EmploymentHistoryAdmin(admin.ModelAdmin):
    list_display = ['employee', 'change_type', 'effective_date', 'new_department', 'new_position']
    list_filter = ['change_type']
    search_fields = ['employee__employee_number']
    ordering = ['-effective_date']


# Data Update Request Admin

class DataUpdateDocumentInline(admin.TabularInline):
    model = DataUpdateDocument
    extra = 0
    fields = ['file_name', 'document_type', 'uploaded_by', 'created_at']
    readonly_fields = ['file_name', 'uploaded_by', 'created_at']


@admin.register(DataUpdateRequest)
class DataUpdateRequestAdmin(admin.ModelAdmin):
    list_display = [
        'request_number', 'employee', 'request_type', 'status',
        'submitted_at', 'reviewed_by', 'reviewed_at'
    ]
    list_filter = ['status', 'request_type']
    search_fields = ['request_number', 'employee__employee_number', 'employee__first_name', 'employee__last_name']
    ordering = ['-created_at']
    readonly_fields = ['request_number', 'submitted_at', 'reviewed_at', 'applied_at']
    inlines = [DataUpdateDocumentInline]
    fieldsets = (
        ('Request', {
            'fields': ('request_number', 'employee', 'request_type', 'status')
        }),
        ('Data Changes', {
            'fields': ('old_values', 'new_values', 'reason')
        }),
        ('Submission', {
            'fields': ('submitted_at',)
        }),
        ('Review', {
            'fields': ('reviewed_by', 'reviewed_at', 'review_comments', 'rejection_reason'),
            'classes': ('collapse',)
        }),
        ('Application', {
            'fields': ('applied_at', 'applied_by'),
            'classes': ('collapse',)
        }),
    )


@admin.register(DataUpdateDocument)
class DataUpdateDocumentAdmin(admin.ModelAdmin):
    list_display = ['data_update_request', 'file_name', 'document_type', 'uploaded_by', 'created_at']
    list_filter = ['document_type']
    search_fields = ['file_name', 'data_update_request__request_number']


# ========================================
# Service Request Admin
# ========================================

@admin.register(ServiceRequestType)
class ServiceRequestTypeAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'sla_days', 'requires_manager_approval', 'requires_hr_approval', 'is_active', 'sort_order']
    list_filter = ['is_active', 'requires_manager_approval', 'requires_hr_approval']
    search_fields = ['code', 'name', 'description']
    ordering = ['sort_order', 'name']
    fieldsets = (
        ('Basic Info', {
            'fields': ('code', 'name', 'description')
        }),
        ('SLA & Workflow', {
            'fields': ('sla_days', 'auto_response_message', 'requires_manager_approval', 'requires_hr_approval', 'route_to_location_hr')
        }),
        ('Documents', {
            'fields': ('requires_document', 'document_types_accepted')
        }),
        ('Settings', {
            'fields': ('is_active', 'sort_order')
        }),
    )


class ServiceRequestCommentInline(admin.TabularInline):
    model = ServiceRequestComment
    extra = 0
    fields = ['commented_by', 'comment', 'comment_type', 'is_visible_to_employee', 'created_at']
    readonly_fields = ['commented_by', 'created_at']


class ServiceRequestDocumentInline(admin.TabularInline):
    model = ServiceRequestDocument
    extra = 0
    fields = ['file_name', 'mime_type', 'file_size', 'uploaded_by', 'created_at']
    readonly_fields = ['uploaded_by', 'created_at']


@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    list_display = [
        'request_number', 'employee', 'request_type', 'subject', 'status',
        'priority', 'sla_status', 'assigned_to', 'created_at'
    ]
    list_filter = ['status', 'priority', 'sla_status', 'request_type']
    search_fields = [
        'request_number', 'subject', 'employee__employee_number',
        'employee__first_name', 'employee__last_name'
    ]
    ordering = ['-created_at']
    readonly_fields = [
        'request_number', 'submitted_at', 'acknowledged_at',
        'resolved_at', 'escalated_at', 'sla_deadline'
    ]
    inlines = [ServiceRequestCommentInline, ServiceRequestDocumentInline]
    fieldsets = (
        ('Request Info', {
            'fields': ('request_number', 'employee', 'request_type', 'subject', 'description', 'priority')
        }),
        ('Status & SLA', {
            'fields': ('status', 'sla_status', 'sla_deadline')
        }),
        ('Assignment', {
            'fields': ('assigned_to', 'assigned_location')
        }),
        ('Timestamps', {
            'fields': ('submitted_at', 'acknowledged_at'),
            'classes': ('collapse',)
        }),
        ('Resolution', {
            'fields': ('resolution_notes', 'rejection_reason', 'resolved_by', 'resolved_at'),
            'classes': ('collapse',)
        }),
        ('Escalation', {
            'fields': ('is_escalated', 'escalated_to', 'escalated_at', 'escalation_reason'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ServiceRequestComment)
class ServiceRequestCommentAdmin(admin.ModelAdmin):
    list_display = ['service_request', 'commented_by', 'comment_type', 'is_visible_to_employee', 'created_at']
    list_filter = ['comment_type', 'is_visible_to_employee']
    search_fields = ['service_request__request_number', 'comment']
    ordering = ['-created_at']


@admin.register(ServiceRequestDocument)
class ServiceRequestDocumentAdmin(admin.ModelAdmin):
    list_display = ['service_request', 'file_name', 'mime_type', 'file_size', 'uploaded_by', 'created_at']
    list_filter = ['mime_type']
    search_fields = ['file_name', 'service_request__request_number']
    ordering = ['-created_at']
