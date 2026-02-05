"""
Serializers for employees app.
"""

from rest_framework import serializers

from .models import (
    Employee, EmergencyContact, Dependent, Education,
    WorkExperience, Certification, Skill, BankAccount, EmploymentHistory
)


class EmployeePhotoMixin:
    """Mixin to handle employee photo as data URI."""

    def get_photo(self, obj):
        """Return photo as data URI or None."""
        if obj.has_photo:
            return obj.get_photo_data_uri()
        return None


class EmployeeListSerializer(EmployeePhotoMixin, serializers.ModelSerializer):
    """Lightweight serializer for employee lists."""
    full_name = serializers.ReadOnlyField()
    department_name = serializers.CharField(source='department.name', read_only=True)
    position_title = serializers.CharField(source='position.title', read_only=True)
    grade_name = serializers.CharField(source='grade.name', read_only=True)
    photo = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id', 'employee_number', 'full_name', 'first_name', 'last_name',
            'work_email', 'mobile_phone', 'status', 'employment_type',
            'department_name', 'position_title', 'grade_name', 'date_of_joining', 'photo'
        ]


class LeaveBalanceNestedSerializer(serializers.Serializer):
    """Nested serializer for leave balances in employee detail."""
    leave_type_name = serializers.CharField(source='leave_type.name')
    total_entitlement = serializers.DecimalField(max_digits=5, decimal_places=2)
    taken = serializers.DecimalField(max_digits=5, decimal_places=2)
    available_balance = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)


class EmployeeSerializer(EmployeePhotoMixin, serializers.ModelSerializer):
    """Full serializer for employee detail."""
    full_name = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()
    years_of_service = serializers.ReadOnlyField()
    department_name = serializers.CharField(source='department.name', read_only=True)
    position_title = serializers.CharField(source='position.title', read_only=True)
    grade_name = serializers.CharField(source='grade.name', read_only=True)
    supervisor_name = serializers.CharField(source='supervisor.full_name', read_only=True)
    photo = serializers.SerializerMethodField()
    leave_balances = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'photo_data', 'photo_name', 'photo_mime']

    def get_leave_balances(self, obj):
        from leave.models import LeaveBalance
        balances = LeaveBalance.objects.filter(employee=obj).select_related('leave_type')
        return LeaveBalanceNestedSerializer(balances, many=True).data


class EmployeeCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating employees."""

    class Meta:
        model = Employee
        fields = [
            'employee_number', 'title', 'first_name', 'middle_name', 'last_name',
            'date_of_birth', 'gender', 'marital_status', 'nationality',
            'ghana_card_number', 'ssnit_number', 'tin_number',
            'personal_email', 'work_email', 'mobile_phone',
            'residential_address', 'residential_city',
            'employment_type', 'date_of_joining',
            'department', 'position', 'grade', 'supervisor'
        ]

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class EmergencyContactSerializer(serializers.ModelSerializer):
    """Serializer for emergency contacts."""

    class Meta:
        model = EmergencyContact
        fields = [
            'id', 'name', 'relationship', 'phone_primary', 'phone_secondary',
            'email', 'address', 'is_primary'
        ]


class DependentSerializer(serializers.ModelSerializer):
    """Serializer for dependents."""
    age = serializers.ReadOnlyField()

    class Meta:
        model = Dependent
        fields = [
            'id', 'name', 'relationship', 'date_of_birth', 'gender', 'age',
            'ghana_card_number', 'is_disabled', 'is_student', 'school_name',
            'is_eligible_for_benefits', 'notes'
        ]


class EducationSerializer(serializers.ModelSerializer):
    """Serializer for education records."""

    class Meta:
        model = Education
        fields = [
            'id', 'qualification_level', 'qualification_name', 'field_of_study',
            'institution', 'institution_country', 'start_date', 'end_date',
            'grade', 'certificate_number', 'is_verified', 'notes'
        ]


class WorkExperienceSerializer(serializers.ModelSerializer):
    """Serializer for work experience."""
    duration_months = serializers.ReadOnlyField()

    class Meta:
        model = WorkExperience
        fields = [
            'id', 'company_name', 'position', 'department', 'location',
            'start_date', 'end_date', 'is_current', 'responsibilities',
            'reason_for_leaving', 'reference_name', 'reference_contact',
            'is_verified', 'duration_months', 'notes'
        ]


class CertificationSerializer(serializers.ModelSerializer):
    """Serializer for certifications."""
    is_expired = serializers.ReadOnlyField()

    class Meta:
        model = Certification
        fields = [
            'id', 'name', 'issuing_organization', 'credential_id',
            'issue_date', 'expiry_date', 'does_not_expire',
            'verification_url', 'is_verified', 'is_expired', 'notes'
        ]


class SkillSerializer(serializers.ModelSerializer):
    """Serializer for skills."""

    class Meta:
        model = Skill
        fields = [
            'id', 'name', 'category', 'proficiency',
            'years_of_experience', 'last_used', 'is_primary', 'notes'
        ]


class BankAccountSerializer(serializers.ModelSerializer):
    """Serializer for bank accounts."""

    class Meta:
        model = BankAccount
        fields = [
            'id', 'bank_name', 'bank_code', 'branch_name', 'branch_code',
            'account_name', 'account_number', 'account_type', 'swift_code',
            'is_primary', 'is_active', 'is_verified', 'notes'
        ]


class EmploymentHistorySerializer(serializers.ModelSerializer):
    """Serializer for employment history."""

    class Meta:
        model = EmploymentHistory
        fields = '__all__'


class EmployeeProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for employee self-service profile updates.
    Only allows updating specific fields that employees can self-manage.
    """
    photo = serializers.ImageField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Employee
        fields = [
            'mobile_phone', 'home_phone', 'personal_email',
            'residential_address', 'residential_city', 'postal_address',
            'digital_address', 'photo', 'blood_group'
        ]

    def validate_mobile_phone(self, value):
        # Basic phone validation
        if value and len(value) < 10:
            raise serializers.ValidationError('Phone number must be at least 10 digits')
        return value

    def update(self, instance, validated_data):
        # Handle photo upload separately
        photo = validated_data.pop('photo', None)
        if photo is not None:
            instance.set_photo(photo)

        return super().update(instance, validated_data)


class EmployeeProfileSerializer(EmployeePhotoMixin, serializers.ModelSerializer):
    """Full profile serializer for self-service view."""
    full_name = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()
    years_of_service = serializers.ReadOnlyField()
    department_name = serializers.CharField(source='department.name', read_only=True)
    position_title = serializers.CharField(source='position.title', read_only=True)
    grade_name = serializers.CharField(source='grade.name', read_only=True)
    supervisor_name = serializers.CharField(source='supervisor.full_name', read_only=True)
    work_location_name = serializers.CharField(source='work_location.name', read_only=True)
    photo = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id', 'employee_number', 'full_name', 'title',
            'first_name', 'middle_name', 'last_name', 'preferred_name',
            'date_of_birth', 'gender', 'marital_status', 'nationality', 'age',
            'ghana_card_number', 'ssnit_number', 'tin_number',
            'personal_email', 'work_email', 'mobile_phone', 'home_phone', 'work_phone',
            'residential_address', 'residential_city', 'postal_address', 'digital_address',
            'status', 'employment_type', 'date_of_joining', 'date_of_confirmation',
            'years_of_service', 'retirement_date',
            'department', 'department_name', 'position', 'position_title',
            'grade', 'grade_name', 'supervisor', 'supervisor_name',
            'work_location', 'work_location_name',
            'photo', 'blood_group'
        ]
        read_only_fields = [
            'id', 'employee_number', 'first_name', 'middle_name', 'last_name',
            'date_of_birth', 'gender', 'ghana_card_number', 'ssnit_number', 'tin_number',
            'status', 'employment_type', 'date_of_joining', 'date_of_confirmation',
            'retirement_date', 'department', 'position', 'grade', 'supervisor',
            'work_location', 'work_email', 'work_phone'
        ]


class MyTeamMemberSerializer(EmployeePhotoMixin, serializers.ModelSerializer):
    """Serializer for team member summary."""
    full_name = serializers.ReadOnlyField()
    position_title = serializers.CharField(source='position.title', read_only=True)
    is_on_leave = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id', 'employee_number', 'full_name', 'first_name', 'last_name',
            'photo', 'position_title', 'work_email', 'mobile_phone',
            'status', 'is_on_leave'
        ]

    def get_is_on_leave(self, obj):
        from leave.models import LeaveRequest
        from django.utils import timezone

        today = timezone.now().date()
        return LeaveRequest.objects.filter(
            employee=obj,
            status=LeaveRequest.Status.APPROVED,
            start_date__lte=today,
            end_date__gte=today
        ).exists()
