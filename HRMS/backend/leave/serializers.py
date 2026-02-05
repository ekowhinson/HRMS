"""
Serializers for leave app.
"""

from rest_framework import serializers

from .models import LeaveType, LeavePolicy, LeaveBalance, LeaveRequest, LeaveApproval, LeaveDocument


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
