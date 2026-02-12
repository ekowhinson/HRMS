"""Admin configuration for projects app."""

from django.contrib import admin
from .models import (
    Project, ProjectTask, Resource, Timesheet,
    ProjectBudget, Milestone, ProjectBilling,
)


class ProjectTaskInline(admin.TabularInline):
    model = ProjectTask
    extra = 0
    fields = ['name', 'assigned_to', 'start_date', 'end_date', 'status', 'priority', 'sort_order']
    show_change_link = True


class ResourceInline(admin.TabularInline):
    model = Resource
    extra = 0
    fields = ['employee', 'role', 'allocation_percent', 'start_date', 'end_date', 'hourly_rate']


class MilestoneInline(admin.TabularInline):
    model = Milestone
    extra = 0
    fields = ['name', 'due_date', 'amount', 'status', 'completion_date']
    show_change_link = True


class ProjectBudgetInline(admin.TabularInline):
    model = ProjectBudget
    extra = 0
    fields = ['account', 'description', 'budget_amount', 'spent_amount']


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = [
        'code', 'name', 'project_manager', 'department', 'status',
        'priority', 'start_date', 'end_date', 'budget_amount',
        'actual_cost', 'completion_percentage',
    ]
    list_filter = ['status', 'priority', 'department']
    search_fields = ['code', 'name', 'description']
    ordering = ['-start_date']
    readonly_fields = ['created_at', 'updated_at', 'created_by', 'updated_by']
    inlines = [ProjectTaskInline, ResourceInline, MilestoneInline, ProjectBudgetInline]
    fieldsets = (
        ('Project Details', {
            'fields': ('code', 'name', 'description', 'customer'),
        }),
        ('Management', {
            'fields': ('project_manager', 'department', 'status', 'priority'),
        }),
        ('Schedule', {
            'fields': ('start_date', 'end_date', 'completion_percentage'),
        }),
        ('Financials', {
            'fields': ('budget_amount', 'actual_cost'),
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by'),
            'classes': ('collapse',),
        }),
    )


@admin.register(ProjectTask)
class ProjectTaskAdmin(admin.ModelAdmin):
    list_display = [
        'project', 'name', 'assigned_to', 'status',
        'priority', 'start_date', 'end_date',
        'estimated_hours', 'actual_hours', 'sort_order',
    ]
    list_filter = ['status', 'priority', 'project']
    search_fields = ['name', 'description', 'project__code', 'project__name']
    ordering = ['project', 'sort_order', 'start_date']
    readonly_fields = ['created_at', 'updated_at', 'created_by', 'updated_by']
    raw_id_fields = ['project', 'assigned_to', 'parent']


@admin.register(Resource)
class ResourceAdmin(admin.ModelAdmin):
    list_display = [
        'project', 'employee', 'role', 'allocation_percent',
        'start_date', 'end_date', 'hourly_rate',
    ]
    list_filter = ['role', 'project']
    search_fields = [
        'employee__first_name', 'employee__last_name',
        'employee__employee_number', 'project__code', 'project__name',
    ]
    ordering = ['project', 'employee']
    readonly_fields = ['created_at', 'updated_at', 'created_by', 'updated_by']
    raw_id_fields = ['project', 'employee']


@admin.register(Timesheet)
class TimesheetAdmin(admin.ModelAdmin):
    list_display = [
        'employee', 'project', 'task', 'date', 'hours',
        'status', 'approved_by', 'approved_at',
    ]
    list_filter = ['status', 'project', 'date']
    search_fields = [
        'employee__first_name', 'employee__last_name',
        'employee__employee_number', 'project__code', 'description',
    ]
    ordering = ['-date']
    readonly_fields = ['approved_at', 'created_at', 'updated_at', 'created_by', 'updated_by']
    raw_id_fields = ['employee', 'project', 'task', 'approved_by']
    date_hierarchy = 'date'


@admin.register(ProjectBudget)
class ProjectBudgetAdmin(admin.ModelAdmin):
    list_display = [
        'project', 'account', 'description', 'budget_amount', 'spent_amount',
    ]
    list_filter = ['project']
    search_fields = ['project__code', 'account__code', 'account__name', 'description']
    ordering = ['project', 'account']
    readonly_fields = ['created_at', 'updated_at', 'created_by', 'updated_by']
    raw_id_fields = ['project', 'account']


@admin.register(Milestone)
class MilestoneAdmin(admin.ModelAdmin):
    list_display = [
        'project', 'name', 'due_date', 'amount', 'status', 'completion_date',
    ]
    list_filter = ['status', 'project']
    search_fields = ['name', 'description', 'project__code', 'project__name']
    ordering = ['due_date']
    readonly_fields = ['created_at', 'updated_at', 'created_by', 'updated_by']
    raw_id_fields = ['project']


@admin.register(ProjectBilling)
class ProjectBillingAdmin(admin.ModelAdmin):
    list_display = [
        'project', 'billing_type', 'milestone', 'amount', 'billing_date',
    ]
    list_filter = ['billing_type', 'project']
    search_fields = ['project__code', 'project__name', 'description']
    ordering = ['-billing_date']
    readonly_fields = ['created_at', 'updated_at', 'created_by', 'updated_by']
    raw_id_fields = ['project', 'milestone', 'customer_invoice']
