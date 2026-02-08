"""
Serializers for the Workflow / Approval module.
"""

from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType

from .models import (
    WorkflowDefinition,
    ApprovalLevel,
    WorkflowInstance,
    ApprovalRequest,
    ApproverType,
)


# ── Approval Level ────────────────────────────────────────────────

class ApprovalLevelSerializer(serializers.ModelSerializer):
    approver_type_display = serializers.CharField(
        source='get_approver_type_display', read_only=True
    )
    approver_role_name = serializers.CharField(
        source='approver_role.name', read_only=True, default=None
    )
    approver_user_name = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalLevel
        fields = [
            'id', 'level', 'name', 'description',
            'approver_type', 'approver_type_display',
            'approver_role', 'approver_role_name',
            'approver_user', 'approver_user_name',
            'approver_field',
            'amount_threshold_min', 'amount_threshold_max', 'amount_field',
            'required_approvals', 'allow_self_approval',
            'can_skip', 'skip_if_same_as_previous',
        ]

    def get_approver_user_name(self, obj):
        if obj.approver_user:
            return obj.approver_user.full_name
        return None


class ApprovalLevelWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalLevel
        fields = [
            'level', 'name', 'description',
            'approver_type', 'approver_role', 'approver_user',
            'approver_field',
            'amount_threshold_min', 'amount_threshold_max', 'amount_field',
            'required_approvals', 'allow_self_approval',
            'can_skip', 'skip_if_same_as_previous',
        ]


# ── Workflow Definition ───────────────────────────────────────────

class WorkflowDefinitionListSerializer(serializers.ModelSerializer):
    content_type_display = serializers.SerializerMethodField()
    level_count = serializers.SerializerMethodField()

    class Meta:
        model = WorkflowDefinition
        fields = [
            'id', 'code', 'name', 'description',
            'workflow_type', 'content_type', 'content_type_display',
            'is_active', 'is_default', 'version',
            'level_count',
        ]

    def get_content_type_display(self, obj):
        return f"{obj.content_type.app_label}.{obj.content_type.model}"

    def get_level_count(self, obj):
        return obj.approval_levels.count()


class WorkflowDefinitionDetailSerializer(serializers.ModelSerializer):
    content_type_display = serializers.SerializerMethodField()
    approval_levels = ApprovalLevelSerializer(many=True, read_only=True)

    class Meta:
        model = WorkflowDefinition
        fields = [
            'id', 'code', 'name', 'description',
            'workflow_type', 'content_type', 'content_type_display',
            'is_active', 'is_default', 'version',
            'require_all_approvers', 'allow_parallel_approval',
            'auto_approve_timeout_days', 'notify_on_status_change',
            'approval_levels',
            'created_at', 'updated_at',
        ]

    def get_content_type_display(self, obj):
        return f"{obj.content_type.app_label}.{obj.content_type.model}"


class WorkflowDefinitionCreateSerializer(serializers.ModelSerializer):
    content_type_key = serializers.CharField(
        write_only=True,
        help_text='Format: app_label.model (e.g. leave.leaverequest)'
    )
    approval_levels = ApprovalLevelWriteSerializer(many=True, required=False)

    class Meta:
        model = WorkflowDefinition
        fields = [
            'code', 'name', 'description',
            'workflow_type', 'content_type_key',
            'is_active', 'is_default',
            'require_all_approvers', 'allow_parallel_approval',
            'auto_approve_timeout_days', 'notify_on_status_change',
            'approval_levels',
        ]

    def validate_content_type_key(self, value):
        try:
            app_label, model = value.split('.')
            ct = ContentType.objects.get(app_label=app_label, model=model)
            return ct
        except (ValueError, ContentType.DoesNotExist):
            raise serializers.ValidationError(
                f"Invalid content type '{value}'. Use format: app_label.model"
            )

    def validate_approval_levels(self, value):
        if value and len(value) > 5:
            raise serializers.ValidationError("Maximum 5 approval levels allowed")
        return value

    def create(self, validated_data):
        levels_data = validated_data.pop('approval_levels', [])
        ct = validated_data.pop('content_type_key')
        validated_data['content_type'] = ct

        workflow = WorkflowDefinition.objects.create(**validated_data)

        for level_data in levels_data:
            ApprovalLevel.objects.create(workflow=workflow, **level_data)

        return workflow

    def update(self, instance, validated_data):
        levels_data = validated_data.pop('approval_levels', None)
        ct = validated_data.pop('content_type_key', None)
        if ct:
            validated_data['content_type'] = ct

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if levels_data is not None:
            # Replace all levels
            instance.approval_levels.all().delete()
            for level_data in levels_data:
                ApprovalLevel.objects.create(workflow=instance, **level_data)

        return instance


# ── Approval Request ──────────────────────────────────────────────

class ApprovalRequestSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    responded_by_name = serializers.SerializerMethodField()
    module_name = serializers.SerializerMethodField()
    object_display = serializers.SerializerMethodField()
    workflow_name = serializers.CharField(
        source='instance.workflow.name', read_only=True
    )
    instance_id = serializers.UUIDField(source='instance.id', read_only=True)
    total_levels = serializers.SerializerMethodField()
    level_name = serializers.CharField(
        source='approval_level.name', read_only=True, default=''
    )

    class Meta:
        model = ApprovalRequest
        fields = [
            'id', 'instance_id', 'workflow_name',
            'level_number', 'level_name', 'total_levels',
            'assigned_to', 'assigned_to_name',
            'status', 'requested_at', 'due_date',
            'responded_at', 'responded_by', 'responded_by_name',
            'comments',
            'delegated_to', 'delegated_by', 'delegation_reason',
            'module_name', 'object_display',
        ]

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.full_name
        if obj.assigned_role:
            return f"Role: {obj.assigned_role.name}"
        return 'Unassigned'

    def get_responded_by_name(self, obj):
        if obj.responded_by:
            return obj.responded_by.full_name
        return None

    def get_module_name(self, obj):
        ct = obj.instance.content_type
        return f"{ct.app_label}.{ct.model}"

    def get_object_display(self, obj):
        try:
            content_obj = obj.instance.content_object
            return str(content_obj) if content_obj else f"ID: {obj.instance.object_id}"
        except Exception:
            return f"ID: {obj.instance.object_id}"

    def get_total_levels(self, obj):
        return obj.instance.workflow.approval_levels.count()


# ── Workflow Instance ─────────────────────────────────────────────

class WorkflowInstanceSerializer(serializers.ModelSerializer):
    workflow_name = serializers.CharField(source='workflow.name', read_only=True)
    workflow_code = serializers.CharField(source='workflow.code', read_only=True)
    content_type_display = serializers.SerializerMethodField()
    object_display = serializers.SerializerMethodField()
    current_state_name = serializers.CharField(
        source='current_state.name', read_only=True
    )
    started_by_name = serializers.SerializerMethodField()
    total_levels = serializers.SerializerMethodField()
    approval_requests = ApprovalRequestSerializer(many=True, read_only=True)

    class Meta:
        model = WorkflowInstance
        fields = [
            'id', 'workflow', 'workflow_name', 'workflow_code',
            'content_type', 'content_type_display',
            'object_id', 'object_display',
            'current_state', 'current_state_name',
            'current_approval_level', 'total_levels',
            'status', 'started_at', 'completed_at',
            'started_by', 'started_by_name',
            'approval_requests',
        ]

    def get_content_type_display(self, obj):
        return f"{obj.content_type.app_label}.{obj.content_type.model}"

    def get_object_display(self, obj):
        try:
            content_obj = obj.content_object
            return str(content_obj) if content_obj else f"ID: {obj.object_id}"
        except Exception:
            return f"ID: {obj.object_id}"

    def get_started_by_name(self, obj):
        if obj.started_by:
            return obj.started_by.full_name
        return None

    def get_total_levels(self, obj):
        return obj.workflow.approval_levels.count()


# ── Approval Action (input) ──────────────────────────────────────

class ApprovalActionSerializer(serializers.Serializer):
    ACTION_CHOICES = [
        ('APPROVE', 'Approve'),
        ('REJECT', 'Reject'),
        ('DELEGATE', 'Delegate'),
        ('RETURN', 'Return'),
    ]

    action = serializers.ChoiceField(choices=ACTION_CHOICES)
    comments = serializers.CharField(required=False, allow_blank=True, default='')
    delegated_to = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, data):
        if data['action'] == 'DELEGATE' and not data.get('delegated_to'):
            raise serializers.ValidationError(
                {'delegated_to': 'Required when action is DELEGATE'}
            )
        return data


# ── Set Levels (bulk) ─────────────────────────────────────────────

class SetLevelsSerializer(serializers.Serializer):
    levels = ApprovalLevelWriteSerializer(many=True)

    def validate_levels(self, value):
        if len(value) > 5:
            raise serializers.ValidationError("Maximum 5 approval levels allowed")
        if len(value) == 0:
            raise serializers.ValidationError("At least one approval level is required")
        # Ensure unique level numbers
        level_nums = [l['level'] for l in value]
        if len(level_nums) != len(set(level_nums)):
            raise serializers.ValidationError("Level numbers must be unique")
        return value


# ── Approver Type choices (for frontend dropdowns) ────────────────

class ApproverTypeSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()
