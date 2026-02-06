"""
Serializers for leave app.
"""

from rest_framework import serializers

from .models import (
    LeaveType, LeavePolicy, LeaveBalance, LeaveRequest, LeaveApproval, LeaveDocument,
    LeavePlan, LeavePlanEntry, LeaveCarryForwardRequest, LeaveReminder
)


class LeaveTypeSerializer(serializers.ModelSerializer):
    """Serializer for LeaveType model."""

    class Meta:
        model = LeaveType
        fields = '__all__'


class LeavePolicySerializer(serializers.ModelSerializer):
    """Serializer for LeavePolicy model."""
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    grade_name = serializers.CharField(source='grade.name', read_only=True)

    class Meta:
        model = LeavePolicy
        fields = '__all__'


class LeaveBalanceSerializer(serializers.ModelSerializer):
    """Serializer for LeaveBalance model."""
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    available_balance = serializers.ReadOnlyField()
    total_entitlement = serializers.ReadOnlyField()

    class Meta:
        model = LeaveBalance
        fields = [
            'id', 'employee', 'leave_type', 'leave_type_name', 'year',
            'opening_balance', 'earned', 'taken', 'pending', 'adjustment',
            'carried_forward', 'encashed', 'lapsed',
            'available_balance', 'total_entitlement'
        ]


class LeaveRequestSerializer(serializers.ModelSerializer):
    """Serializer for LeaveRequest model."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'employee', 'employee_name', 'employee_number',
            'leave_type', 'leave_type_name', 'request_number',
            'start_date', 'end_date', 'number_of_days',
            'is_half_day', 'half_day_type', 'reason',
            'contact_address', 'contact_phone',
            'handover_to', 'handover_notes',
            'status', 'submitted_at', 'approved_at', 'approved_by',
            'rejection_reason', 'balance_at_request',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['request_number', 'status', 'submitted_at', 'approved_at']


class LeaveRequestCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating leave requests."""

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'request_number', 'leave_type', 'start_date', 'end_date',
            'is_half_day', 'half_day_type', 'reason',
            'contact_address', 'contact_phone',
            'handover_to', 'handover_notes',
            'number_of_days', 'status'
        ]
        read_only_fields = ['id', 'request_number', 'number_of_days', 'status']

    def create(self, validated_data):
        user = self.context['request'].user
        if hasattr(user, 'employee'):
            validated_data['employee'] = user.employee

        # Generate request number
        import uuid
        validated_data['request_number'] = f"LV-{uuid.uuid4().hex[:8].upper()}"

        # Calculate days
        leave_request = LeaveRequest(**validated_data)
        validated_data['number_of_days'] = leave_request.calculate_days()

        return super().create(validated_data)


class LeaveApprovalSerializer(serializers.ModelSerializer):
    """Serializer for LeaveApproval model."""

    class Meta:
        model = LeaveApproval
        fields = '__all__'


class LeaveDocumentSerializer(serializers.ModelSerializer):
    """Serializer for LeaveDocument model."""
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True)
    file = serializers.FileField(write_only=True, required=False)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = LeaveDocument
        fields = [
            'id', 'leave_request', 'file', 'file_url', 'file_name',
            'mime_type', 'file_size', 'document_type', 'description',
            'uploaded_by', 'uploaded_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'file_name', 'mime_type', 'file_size', 'uploaded_by', 'created_at']

    def get_file_url(self, obj):
        """Return file as data URI."""
        if obj.has_file:
            return obj.get_file_data_uri()
        return None

    def create(self, validated_data):
        file_obj = validated_data.pop('file', None)
        instance = super().create(validated_data)
        if file_obj:
            instance.set_file(file_obj)
            instance.save()
        return instance

    def update(self, instance, validated_data):
        file_obj = validated_data.pop('file', None)
        instance = super().update(instance, validated_data)
        if file_obj:
            instance.set_file(file_obj)
            instance.save()
        return instance


class LeaveCalendarEventSerializer(serializers.ModelSerializer):
    """Serializer for calendar view of leave requests."""
    title = serializers.SerializerMethodField()
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    employee_photo = serializers.SerializerMethodField()
    department_name = serializers.CharField(source='employee.department.name', read_only=True)
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    color = serializers.CharField(source='leave_type.color_code', read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'request_number', 'title',
            'employee', 'employee_name', 'employee_number', 'employee_photo',
            'department_name', 'leave_type', 'leave_type_name', 'color',
            'start_date', 'end_date', 'number_of_days', 'status'
        ]

    def get_title(self, obj):
        return f"{obj.employee.full_name} - {obj.leave_type.name}"

    def get_employee_photo(self, obj):
        """Return employee photo as data URI."""
        if obj.employee and obj.employee.has_photo:
            return obj.employee.get_photo_data_uri()
        return None


class TeamLeaveSerializer(serializers.ModelSerializer):
    """Serializer for team leave view."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    employee_photo = serializers.SerializerMethodField()
    position_title = serializers.CharField(source='employee.position.title', read_only=True)
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    leave_type_color = serializers.CharField(source='leave_type.color_code', read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'request_number',
            'employee', 'employee_name', 'employee_number', 'employee_photo',
            'position_title', 'leave_type', 'leave_type_name', 'leave_type_color',
            'start_date', 'end_date', 'number_of_days', 'status',
            'reason', 'created_at', 'approved_at'
        ]

    def get_employee_photo(self, obj):
        """Return employee photo as data URI."""
        if obj.employee and obj.employee.has_photo:
            return obj.employee.get_photo_data_uri()
        return None


# Leave Planning Serializers

class LeavePlanEntrySerializer(serializers.ModelSerializer):
    """Serializer for LeavePlanEntry model."""
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    leave_type_color = serializers.CharField(source='leave_type.color_code', read_only=True)

    class Meta:
        model = LeavePlanEntry
        fields = [
            'id', 'leave_plan', 'leave_type', 'leave_type_name', 'leave_type_color',
            'start_date', 'end_date', 'number_of_days', 'status',
            'leave_request', 'description', 'quarter',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['quarter']


class LeavePlanSerializer(serializers.ModelSerializer):
    """Serializer for LeavePlan model."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True)
    entries = LeavePlanEntrySerializer(many=True, read_only=True)
    unplanned_days = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = LeavePlan
        fields = [
            'id', 'employee', 'employee_name', 'employee_number', 'department_name',
            'year', 'total_planned_days', 'leave_entitlement', 'brought_forward',
            'unplanned_days', 'status', 'submitted_at', 'approved_at',
            'approved_by', 'approved_by_name',
            'revision_reason', 'rejection_reason',
            'employee_notes', 'manager_comments',
            'entries', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'total_planned_days', 'status', 'submitted_at', 'approved_at', 'approved_by'
        ]


class LeavePlanCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a leave plan."""
    entries = LeavePlanEntrySerializer(many=True, write_only=True, required=False)

    class Meta:
        model = LeavePlan
        fields = [
            'year', 'leave_entitlement', 'brought_forward',
            'employee_notes', 'entries'
        ]

    def create(self, validated_data):
        entries_data = validated_data.pop('entries', [])
        user = self.context['request'].user

        if hasattr(user, 'employee'):
            validated_data['employee'] = user.employee

        plan = LeavePlan.objects.create(**validated_data)

        # Create entries
        for entry_data in entries_data:
            LeavePlanEntry.objects.create(leave_plan=plan, **entry_data)

        # Calculate total days
        plan.calculate_total_days()
        plan.save()

        return plan


class LeaveCarryForwardRequestSerializer(serializers.ModelSerializer):
    """Serializer for LeaveCarryForwardRequest model."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    hr_reviewer_name = serializers.CharField(source='hr_reviewer.get_full_name', read_only=True, allow_null=True)
    ceo_approver_name = serializers.CharField(source='ceo_approver.get_full_name', read_only=True, allow_null=True)
    requires_ceo_approval = serializers.SerializerMethodField()

    class Meta:
        model = LeaveCarryForwardRequest
        fields = [
            'id', 'employee', 'employee_name', 'employee_number',
            'from_year', 'to_year',
            'available_balance', 'standard_carry_forward',
            'requested_carry_forward', 'additional_days_requested',
            'approved_carry_forward', 'days_to_lapse',
            'reason', 'status',
            'hr_reviewer', 'hr_reviewer_name', 'hr_reviewed_at', 'hr_comments',
            'ceo_approver', 'ceo_approver_name', 'ceo_approved_at', 'ceo_comments',
            'rejection_reason', 'requires_ceo_approval',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'additional_days_requested', 'status',
            'hr_reviewer', 'hr_reviewed_at', 'ceo_approver', 'ceo_approved_at'
        ]

    def get_requires_ceo_approval(self, obj):
        return obj.additional_days_requested > 0


class LeaveReminderSerializer(serializers.ModelSerializer):
    """Serializer for LeaveReminder model."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)

    class Meta:
        model = LeaveReminder
        fields = [
            'id', 'employee', 'employee_name', 'employee_number',
            'year', 'reminder_type', 'outstanding_balance', 'message',
            'sent_at', 'read_at', 'acknowledged', 'acknowledged_at',
            'created_at'
        ]
        read_only_fields = ['sent_at', 'read_at', 'acknowledged_at']


class LeavePlanCalendarSerializer(serializers.ModelSerializer):
    """Serializer for calendar view of leave plan entries."""
    employee_name = serializers.CharField(source='leave_plan.employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='leave_plan.employee.employee_number', read_only=True)
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    leave_type_color = serializers.CharField(source='leave_type.color_code', read_only=True)
    is_planned = serializers.SerializerMethodField()

    class Meta:
        model = LeavePlanEntry
        fields = [
            'id', 'employee_name', 'employee_number',
            'leave_type', 'leave_type_name', 'leave_type_color',
            'start_date', 'end_date', 'number_of_days',
            'status', 'description', 'quarter', 'is_planned'
        ]

    def get_is_planned(self, obj):
        return obj.status == LeavePlanEntry.Status.PLANNED


# ========================================
# Location-Based Workflow Serializers
# ========================================

from .models import (
    LeaveApprovalWorkflowTemplate, LeaveApprovalWorkflowLevel,
    LocationWorkflowMapping, LeaveRequestWorkflowStatus,
    LeaveApprovalAction, LeaveRelieverValidation
)


class LeaveApprovalWorkflowLevelSerializer(serializers.ModelSerializer):
    """Serializer for LeaveApprovalWorkflowLevel model."""
    approver_type_display = serializers.CharField(source='get_approver_type_display', read_only=True)
    approver_role_name = serializers.CharField(source='approver_role.name', read_only=True, allow_null=True)

    class Meta:
        model = LeaveApprovalWorkflowLevel
        fields = '__all__'


class LeaveApprovalWorkflowTemplateSerializer(serializers.ModelSerializer):
    """Serializer for LeaveApprovalWorkflowTemplate model."""
    location_category_display = serializers.CharField(source='get_location_category_display', read_only=True)
    levels = LeaveApprovalWorkflowLevelSerializer(many=True, read_only=True)
    levels_count = serializers.SerializerMethodField()

    class Meta:
        model = LeaveApprovalWorkflowTemplate
        fields = '__all__'

    def get_levels_count(self, obj):
        return obj.levels.count()


class LeaveApprovalWorkflowTemplateCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating workflow template with levels."""
    levels = LeaveApprovalWorkflowLevelSerializer(many=True, required=False)

    class Meta:
        model = LeaveApprovalWorkflowTemplate
        fields = ['code', 'name', 'description', 'location_category', 'is_active', 'is_default', 'max_levels', 'levels']

    def create(self, validated_data):
        levels_data = validated_data.pop('levels', [])
        template = LeaveApprovalWorkflowTemplate.objects.create(**validated_data)

        for idx, level_data in enumerate(levels_data):
            level_data['level'] = idx + 1
            LeaveApprovalWorkflowLevel.objects.create(template=template, **level_data)

        return template


class LocationWorkflowMappingSerializer(serializers.ModelSerializer):
    """Serializer for LocationWorkflowMapping model."""
    location_name = serializers.CharField(source='location.name', read_only=True)
    location_code = serializers.CharField(source='location.code', read_only=True)
    workflow_template_name = serializers.CharField(source='workflow_template.name', read_only=True)

    class Meta:
        model = LocationWorkflowMapping
        fields = '__all__'


class LeaveApprovalActionSerializer(serializers.ModelSerializer):
    """Serializer for LeaveApprovalAction model."""
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    actor_name = serializers.CharField(source='actor.get_full_name', read_only=True, allow_null=True)
    level_name = serializers.CharField(source='workflow_level.name', read_only=True, allow_null=True)

    class Meta:
        model = LeaveApprovalAction
        fields = '__all__'


class LeaveRequestWorkflowStatusSerializer(serializers.ModelSerializer):
    """Serializer for LeaveRequestWorkflowStatus model."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    workflow_template_name = serializers.CharField(source='workflow_template.name', read_only=True, allow_null=True)
    pending_approver_name = serializers.CharField(source='pending_approver.get_full_name', read_only=True, allow_null=True)
    actions = LeaveApprovalActionSerializer(many=True, read_only=True)
    progress_percentage = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequestWorkflowStatus
        fields = '__all__'

    def get_progress_percentage(self, obj):
        if obj.total_levels == 0:
            return 0
        approved_levels = obj.actions.filter(action='APPROVE').count()
        return int((approved_levels / obj.total_levels) * 100)


class LeaveRelieverValidationSerializer(serializers.ModelSerializer):
    """Serializer for LeaveRelieverValidation model."""
    reliever_name = serializers.CharField(source='reliever.full_name', read_only=True)
    reliever_number = serializers.CharField(source='reliever.employee_number', read_only=True)
    validation_status_display = serializers.CharField(source='get_validation_status_display', read_only=True)
    conflicting_leave_details = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRelieverValidation
        fields = '__all__'

    def get_conflicting_leave_details(self, obj):
        if obj.conflicting_leave:
            return {
                'request_number': obj.conflicting_leave.request_number,
                'start_date': obj.conflicting_leave.start_date,
                'end_date': obj.conflicting_leave.end_date,
            }
        return None


class ValidateRelieverSerializer(serializers.Serializer):
    """Serializer for validating reliever before leave submission."""
    reliever_id = serializers.UUIDField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()


class WorkflowActionSerializer(serializers.Serializer):
    """Serializer for performing workflow actions."""
    action = serializers.ChoiceField(choices=LeaveApprovalAction.ActionType.choices)
    comments = serializers.CharField(required=False, allow_blank=True)
    delegate_to = serializers.UUIDField(required=False, allow_null=True)
    modified_start_date = serializers.DateField(required=False, allow_null=True)
    modified_end_date = serializers.DateField(required=False, allow_null=True)
