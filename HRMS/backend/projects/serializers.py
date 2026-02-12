"""Serializers for project management."""

from rest_framework import serializers

from .models import (
    Project, ProjectTask, Resource, Timesheet,
    ProjectBudget, Milestone, ProjectBilling,
)


class ProjectTaskSerializer(serializers.ModelSerializer):
    """Serializer for project tasks."""
    project_code = serializers.CharField(source='project.code', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    parent_name = serializers.CharField(source='parent.name', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    subtask_count = serializers.SerializerMethodField()

    class Meta:
        model = ProjectTask
        fields = [
            'id', 'project', 'project_code', 'name', 'description',
            'parent', 'parent_name', 'assigned_to', 'assigned_to_name',
            'start_date', 'end_date', 'estimated_hours', 'actual_hours',
            'status', 'status_display', 'priority', 'sort_order',
            'subtask_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.full_name
        return None

    def get_subtask_count(self, obj):
        if hasattr(obj, '_subtask_count'):
            return obj._subtask_count
        return obj.subtasks.count()


class ResourceSerializer(serializers.ModelSerializer):
    """Serializer for project resource allocations."""
    project_code = serializers.CharField(source='project.code', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_number = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = Resource
        fields = [
            'id', 'project', 'project_code', 'project_name',
            'employee', 'employee_name', 'employee_number',
            'role', 'role_display', 'allocation_percent',
            'start_date', 'end_date', 'hourly_rate', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_employee_name(self, obj):
        if obj.employee:
            return obj.employee.full_name
        return None

    def get_employee_number(self, obj):
        if obj.employee:
            return obj.employee.employee_number
        return None


class TimesheetSerializer(serializers.ModelSerializer):
    """Serializer for timesheet entries."""
    employee_name = serializers.SerializerMethodField()
    employee_number = serializers.SerializerMethodField()
    project_code = serializers.CharField(source='project.code', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    task_name = serializers.CharField(source='task.name', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Timesheet
        fields = [
            'id', 'employee', 'employee_name', 'employee_number',
            'project', 'project_code', 'project_name',
            'task', 'task_name', 'date', 'hours', 'description',
            'status', 'status_display',
            'approved_by', 'approved_by_name', 'approved_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'approved_by', 'approved_at', 'created_at', 'updated_at']

    def get_employee_name(self, obj):
        if obj.employee:
            return obj.employee.full_name
        return None

    def get_employee_number(self, obj):
        if obj.employee:
            return obj.employee.employee_number
        return None

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name()
        return None


class ProjectBudgetSerializer(serializers.ModelSerializer):
    """Serializer for project budget line items."""
    project_code = serializers.CharField(source='project.code', read_only=True)
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)
    remaining_amount = serializers.SerializerMethodField()

    class Meta:
        model = ProjectBudget
        fields = [
            'id', 'project', 'project_code',
            'account', 'account_code', 'account_name',
            'description', 'budget_amount', 'spent_amount', 'remaining_amount',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_remaining_amount(self, obj):
        return obj.budget_amount - obj.spent_amount


class MilestoneSerializer(serializers.ModelSerializer):
    """Serializer for project milestones."""
    project_code = serializers.CharField(source='project.code', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Milestone
        fields = [
            'id', 'project', 'project_code', 'project_name',
            'name', 'description', 'due_date', 'amount',
            'status', 'status_display', 'completion_date',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProjectBillingSerializer(serializers.ModelSerializer):
    """Serializer for project billing records."""
    project_code = serializers.CharField(source='project.code', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    billing_type_display = serializers.CharField(source='get_billing_type_display', read_only=True)
    milestone_name = serializers.CharField(source='milestone.name', read_only=True, allow_null=True)

    class Meta:
        model = ProjectBilling
        fields = [
            'id', 'project', 'project_code', 'project_name',
            'billing_type', 'billing_type_display',
            'milestone', 'milestone_name',
            'customer_invoice', 'amount', 'billing_date', 'description',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProjectListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for project lists."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    project_manager_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    task_count = serializers.SerializerMethodField()
    resource_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'code', 'name', 'status', 'status_display',
            'project_manager', 'project_manager_name',
            'department', 'department_name',
            'start_date', 'end_date', 'priority',
            'budget_amount', 'actual_cost', 'completion_percentage',
            'task_count', 'resource_count',
            'created_at',
        ]

    def get_project_manager_name(self, obj):
        if obj.project_manager:
            return obj.project_manager.full_name
        return None

    def get_task_count(self, obj):
        if hasattr(obj, '_task_count'):
            return obj._task_count
        return obj.tasks.count()

    def get_resource_count(self, obj):
        if hasattr(obj, '_resource_count'):
            return obj._resource_count
        return obj.resources.count()


class ProjectSerializer(serializers.ModelSerializer):
    """Full serializer for project detail."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    project_manager_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    customer_name = serializers.SerializerMethodField()

    tasks = ProjectTaskSerializer(many=True, read_only=True)
    resources = ResourceSerializer(many=True, read_only=True)
    milestones = MilestoneSerializer(many=True, read_only=True)
    budget_lines = ProjectBudgetSerializer(many=True, read_only=True)

    total_budget = serializers.SerializerMethodField()
    total_spent = serializers.SerializerMethodField()
    total_billed = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'code', 'name', 'description',
            'project_manager', 'project_manager_name',
            'department', 'department_name',
            'customer', 'customer_name',
            'start_date', 'end_date',
            'budget_amount', 'actual_cost', 'completion_percentage',
            'status', 'status_display', 'priority',
            'total_budget', 'total_spent', 'total_billed',
            'tasks', 'resources', 'milestones', 'budget_lines',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_project_manager_name(self, obj):
        if obj.project_manager:
            return obj.project_manager.full_name
        return None

    def get_customer_name(self, obj):
        if obj.customer:
            return obj.customer.name
        return None

    def get_total_budget(self, obj):
        budget_lines = getattr(obj, 'prefetched_budget_lines', None)
        if budget_lines is not None:
            return sum(bl.budget_amount for bl in budget_lines)
        return obj.budget_lines.aggregate(
            total=models.Sum('budget_amount')
        )['total'] or 0

    def get_total_spent(self, obj):
        budget_lines = getattr(obj, 'prefetched_budget_lines', None)
        if budget_lines is not None:
            return sum(bl.spent_amount for bl in budget_lines)
        return obj.budget_lines.aggregate(
            total=models.Sum('spent_amount')
        )['total'] or 0

    def get_total_billed(self, obj):
        return obj.billings.aggregate(
            total=models.Sum('amount')
        )['total'] or 0
