"""
Serializers for Exit/Offboarding module.
"""

from rest_framework import serializers
from django.utils import timezone

from .models import (
    ExitType, ExitRequest, ExitInterview, ClearanceDepartment,
    ExitClearance, ExitChecklistItem, AssetReturn, FinalSettlement
)


class ExitTypeSerializer(serializers.ModelSerializer):
    """Serializer for ExitType model."""

    class Meta:
        model = ExitType
        fields = [
            'id', 'code', 'name', 'description', 'requires_notice',
            'notice_period_days', 'requires_exit_interview', 'requires_clearance',
            'is_active', 'sort_order'
        ]


class ClearanceDepartmentSerializer(serializers.ModelSerializer):
    """Serializer for ClearanceDepartment model."""

    class Meta:
        model = ClearanceDepartment
        fields = [
            'id', 'code', 'name', 'description', 'checklist_items',
            'responsible_role', 'is_required', 'is_active', 'sort_order'
        ]


class ExitChecklistItemSerializer(serializers.ModelSerializer):
    """Serializer for ExitChecklistItem model."""
    completed_by_name = serializers.CharField(
        source='completed_by.get_full_name',
        read_only=True,
        default=''
    )

    class Meta:
        model = ExitChecklistItem
        fields = [
            'id', 'clearance', 'item_name', 'description', 'is_completed',
            'completed_by', 'completed_by_name', 'completed_at', 'notes'
        ]
        read_only_fields = ['completed_by', 'completed_at']


class ExitClearanceSerializer(serializers.ModelSerializer):
    """Serializer for ExitClearance model."""
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_code = serializers.CharField(source='department.code', read_only=True)
    cleared_by_name = serializers.CharField(
        source='cleared_by.get_full_name',
        read_only=True,
        default=''
    )
    checklist_items = ExitChecklistItemSerializer(many=True, read_only=True)

    class Meta:
        model = ExitClearance
        fields = [
            'id', 'exit_request', 'department', 'department_name', 'department_code',
            'is_cleared', 'cleared_by', 'cleared_by_name', 'cleared_at',
            'comments', 'outstanding_items', 'conditions',
            'amount_owed', 'amount_due', 'checklist_items'
        ]
        read_only_fields = ['cleared_by', 'cleared_at']


class AssetReturnSerializer(serializers.ModelSerializer):
    """Serializer for AssetReturn model."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    received_by_name = serializers.CharField(
        source='received_by.get_full_name',
        read_only=True,
        default=''
    )

    class Meta:
        model = AssetReturn
        fields = [
            'id', 'exit_request', 'asset_name', 'asset_type', 'asset_tag',
            'description', 'status', 'status_display', 'returned_at',
            'received_by', 'received_by_name', 'condition_notes',
            'original_value', 'deduction_amount'
        ]
        read_only_fields = ['received_by', 'returned_at']


class FinalSettlementSerializer(serializers.ModelSerializer):
    """Serializer for FinalSettlement model."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    calculated_by_name = serializers.CharField(
        source='calculated_by.get_full_name',
        read_only=True,
        default=''
    )
    approved_by_name = serializers.CharField(
        source='approved_by.get_full_name',
        read_only=True,
        default=''
    )

    class Meta:
        model = FinalSettlement
        fields = [
            'id', 'exit_request', 'status', 'status_display',
            # Earnings
            'salary_arrears', 'leave_encashment', 'leave_days_encashed',
            'gratuity', 'bonus', 'other_earnings', 'other_earnings_details',
            # Deductions
            'loan_balance', 'advance_balance', 'asset_deductions',
            'tax_deductions', 'other_deductions', 'other_deductions_details',
            # Totals
            'gross_settlement', 'total_deductions', 'net_settlement',
            'calculation_notes',
            # Approval
            'calculated_by', 'calculated_by_name', 'calculated_at',
            'approved_by', 'approved_by_name', 'approved_at',
            'paid_at', 'payment_reference'
        ]
        read_only_fields = [
            'calculated_by', 'calculated_at', 'approved_by', 'approved_at',
            'gross_settlement', 'total_deductions', 'net_settlement'
        ]


class ExitInterviewSerializer(serializers.ModelSerializer):
    """Serializer for ExitInterview model."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    interviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = ExitInterview
        fields = [
            'id', 'exit_request', 'scheduled_date', 'conducted_date',
            'interviewer', 'interviewer_name', 'status', 'status_display',
            # Content
            'reason_for_leaving', 'would_recommend_employer', 'would_return',
            # Ratings
            'job_satisfaction', 'management_satisfaction', 'work_environment',
            'compensation_satisfaction', 'growth_opportunities', 'work_life_balance',
            # Feedback
            'liked_most', 'liked_least', 'suggestions', 'reason_detailed',
            'future_plans', 'confidential_notes',
            # Attachment
            'has_attachment', 'attachment_name'
        ]

    def get_interviewer_name(self, obj):
        if obj.interviewer:
            return obj.interviewer.full_name
        return ''


class ExitRequestListSerializer(serializers.ModelSerializer):
    """Serializer for listing ExitRequest records."""
    employee_name = serializers.SerializerMethodField()
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    department_name = serializers.SerializerMethodField()
    exit_type_name = serializers.CharField(source='exit_type.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    pending_clearances = serializers.IntegerField(source='pending_clearances_count', read_only=True)
    total_clearances = serializers.SerializerMethodField()

    class Meta:
        model = ExitRequest
        fields = [
            'id', 'request_number', 'employee', 'employee_name', 'employee_number',
            'department_name', 'exit_type', 'exit_type_name', 'reason',
            'request_date', 'proposed_last_day', 'actual_last_day',
            'status', 'status_display', 'pending_clearances', 'total_clearances',
            'submitted_at', 'approved_at', 'completed_at'
        ]

    def get_employee_name(self, obj):
        return obj.employee.full_name if obj.employee else ''

    def get_department_name(self, obj):
        if obj.employee and obj.employee.department:
            return obj.employee.department.name
        return ''

    def get_total_clearances(self, obj):
        return obj.clearances.count()


class ExitRequestDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for ExitRequest."""
    employee_name = serializers.SerializerMethodField()
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    department_name = serializers.SerializerMethodField()
    position_name = serializers.SerializerMethodField()
    exit_type_name = serializers.CharField(source='exit_type.name', read_only=True)
    exit_type_data = ExitTypeSerializer(source='exit_type', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    reviewed_by_name = serializers.CharField(
        source='reviewed_by.get_full_name',
        read_only=True,
        default=''
    )
    approved_by_name = serializers.CharField(
        source='approved_by.get_full_name',
        read_only=True,
        default=''
    )
    completed_by_name = serializers.CharField(
        source='completed_by.get_full_name',
        read_only=True,
        default=''
    )

    # Related data
    clearances = ExitClearanceSerializer(many=True, read_only=True)
    asset_returns = AssetReturnSerializer(many=True, read_only=True)
    exit_interview = ExitInterviewSerializer(read_only=True)
    final_settlement = FinalSettlementSerializer(read_only=True)

    # Computed fields
    is_clearance_complete = serializers.BooleanField(read_only=True)
    pending_clearances_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ExitRequest
        fields = [
            'id', 'request_number', 'employee', 'employee_name', 'employee_number',
            'department_name', 'position_name',
            'exit_type', 'exit_type_name', 'exit_type_data',
            'reason', 'additional_comments',
            'request_date', 'notice_start_date', 'proposed_last_day', 'actual_last_day',
            'status', 'status_display',
            # Approval flow
            'submitted_at', 'reviewed_by', 'reviewed_by_name', 'reviewed_at', 'review_comments',
            'approved_by', 'approved_by_name', 'approved_at', 'approval_comments',
            'completed_by', 'completed_by_name', 'completed_at',
            # Related
            'clearances', 'asset_returns', 'exit_interview', 'final_settlement',
            'is_clearance_complete', 'pending_clearances_count',
            'created_at', 'updated_at'
        ]

    def get_employee_name(self, obj):
        return obj.employee.full_name if obj.employee else ''

    def get_department_name(self, obj):
        if obj.employee and obj.employee.department:
            return obj.employee.department.name
        return ''

    def get_position_name(self, obj):
        if obj.employee and obj.employee.position:
            return obj.employee.position.name
        return ''


class ExitRequestCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating ExitRequest."""

    class Meta:
        model = ExitRequest
        fields = [
            'employee', 'exit_type', 'reason', 'additional_comments',
            'request_date', 'notice_start_date', 'proposed_last_day', 'actual_last_day'
        ]

    def create(self, validated_data):
        # Request number is auto-generated in the model
        instance = ExitRequest.objects.create(**validated_data)

        # Create clearances for all required departments
        if instance.exit_type.requires_clearance:
            departments = ClearanceDepartment.objects.filter(is_active=True)
            for dept in departments:
                ExitClearance.objects.create(
                    exit_request=instance,
                    department=dept
                )
                # Create default checklist items
                if dept.checklist_items:
                    for item in dept.checklist_items.strip().split('\n'):
                        if item.strip():
                            ExitChecklistItem.objects.create(
                                clearance=instance.clearances.get(department=dept),
                                item_name=item.strip()
                            )

        # Create exit interview if required
        if instance.exit_type.requires_exit_interview:
            ExitInterview.objects.create(exit_request=instance)

        # Create final settlement record
        FinalSettlement.objects.create(exit_request=instance)

        return instance


class SubmitExitRequestSerializer(serializers.Serializer):
    """Serializer for submitting exit request."""
    pass  # No additional data needed


class ApproveExitRequestSerializer(serializers.Serializer):
    """Serializer for approving/rejecting exit request."""
    action = serializers.ChoiceField(choices=['approve', 'reject'])
    comments = serializers.CharField(required=False, allow_blank=True)
    actual_last_day = serializers.DateField(required=False)


class ClearanceActionSerializer(serializers.Serializer):
    """Serializer for clearance actions."""
    comments = serializers.CharField(required=False, allow_blank=True)
    outstanding_items = serializers.CharField(required=False, allow_blank=True)
    conditions = serializers.CharField(required=False, allow_blank=True)
    amount_owed = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    amount_due = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)


class ReturnAssetSerializer(serializers.Serializer):
    """Serializer for asset return action."""
    status = serializers.ChoiceField(choices=AssetReturn.Status.choices)
    condition_notes = serializers.CharField(required=False, allow_blank=True)
    deduction_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)


class CalculateSettlementSerializer(serializers.Serializer):
    """Serializer for settlement calculation."""
    salary_arrears = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    leave_encashment = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    leave_days_encashed = serializers.DecimalField(max_digits=5, decimal_places=2, default=0)
    gratuity = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    bonus = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_earnings = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_earnings_details = serializers.CharField(required=False, allow_blank=True)
    loan_balance = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    advance_balance = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    asset_deductions = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_deductions = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_deductions = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_deductions_details = serializers.CharField(required=False, allow_blank=True)
    calculation_notes = serializers.CharField(required=False, allow_blank=True)
