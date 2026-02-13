"""
Serializers for employees app.
"""

from rest_framework import serializers

from .models import (
    Employee, EmergencyContact, Dependent, Education,
    WorkExperience, Certification, Skill, BankAccount, EmploymentHistory,
    DataUpdateRequest, DataUpdateDocument,
    ServiceRequestType, ServiceRequest, ServiceRequestComment, ServiceRequestDocument
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


class EmployeeSalaryNestedSerializer(serializers.Serializer):
    """Nested serializer for salary information in employee detail."""
    basic_salary = serializers.DecimalField(max_digits=12, decimal_places=2)
    gross_salary = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    total_allowances = serializers.SerializerMethodField()
    total_deductions = serializers.SerializerMethodField()
    net_salary = serializers.SerializerMethodField()
    effective_from = serializers.DateField()
    salary_structure_name = serializers.CharField(source='salary_structure.name', allow_null=True)

    def get_total_allowances(self, obj):
        """Calculate total allowances from salary components."""
        from decimal import Decimal
        if hasattr(obj, 'components'):
            # Use prefetched components - iterate in Python to avoid extra queries
            components = obj.components.all()
            total = Decimal('0')
            for comp in components:
                if comp.pay_component.component_type == 'EARNING' and not comp.pay_component.is_part_of_basic:
                    total += comp.amount or Decimal('0')
            return total
        # If no components, estimate from gross - basic
        if obj.gross_salary and obj.basic_salary:
            return obj.gross_salary - obj.basic_salary
        return Decimal('0')

    def get_total_deductions(self, obj):
        """Calculate total deductions from salary components."""
        from decimal import Decimal
        if hasattr(obj, 'components'):
            # Use prefetched components - iterate in Python to avoid extra queries
            components = obj.components.all()
            total = Decimal('0')
            for comp in components:
                if comp.pay_component.component_type == 'DEDUCTION':
                    total += comp.amount or Decimal('0')
            return total
        return Decimal('0')

    def get_net_salary(self, obj):
        """Calculate net salary (gross - deductions)."""
        from decimal import Decimal
        gross = obj.gross_salary or obj.basic_salary or Decimal('0')
        deductions = self.get_total_deductions(obj)
        return gross - deductions


class EmployeeSerializer(EmployeePhotoMixin, serializers.ModelSerializer):
    """Full serializer for employee detail."""
    full_name = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()
    years_of_service = serializers.ReadOnlyField()

    # Organization hierarchy
    division_name = serializers.CharField(source='division.name', read_only=True, allow_null=True)
    directorate_name = serializers.CharField(source='directorate.name', read_only=True, allow_null=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    position_title = serializers.CharField(source='position.title', read_only=True, allow_null=True)
    grade_name = serializers.CharField(source='grade.name', read_only=True, allow_null=True)
    grade_level = serializers.IntegerField(source='grade.level', read_only=True, allow_null=True)
    work_location_name = serializers.CharField(source='work_location.name', read_only=True, allow_null=True)
    cost_center_name = serializers.CharField(source='cost_center.name', read_only=True, allow_null=True)
    staff_category_name = serializers.CharField(source='staff_category.name', read_only=True, allow_null=True)

    # Supervisor
    supervisor_name = serializers.CharField(source='supervisor.full_name', read_only=True, allow_null=True)
    supervisor_employee_number = serializers.CharField(source='supervisor.employee_number', read_only=True, allow_null=True)

    # Salary structure
    salary_band_name = serializers.SerializerMethodField()
    salary_level_name = serializers.SerializerMethodField()
    salary_notch_name = serializers.SerializerMethodField()
    salary_notch_amount = serializers.SerializerMethodField()

    # Region and district
    region_name = serializers.CharField(source='residential_region.name', read_only=True, allow_null=True)
    district_name = serializers.CharField(source='residential_district.name', read_only=True, allow_null=True)

    # Bank account (primary) - read fields
    bank_name = serializers.SerializerMethodField()
    bank_branch = serializers.SerializerMethodField()
    bank_account_number = serializers.SerializerMethodField()
    bank_accounts_list = serializers.SerializerMethodField()

    # Bank account - write fields (for create/update)
    bank_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    branch_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    account_number = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    account_name = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    account_type = serializers.ChoiceField(
        write_only=True, required=False, allow_null=True,
        choices=[('SAVINGS', 'Savings'), ('CURRENT', 'Current'), ('OTHER', 'Other')]
    )

    photo = serializers.SerializerMethodField()
    leave_balances = serializers.SerializerMethodField()
    salary = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'photo_data', 'photo_name', 'photo_mime']

    def get_salary_band_name(self, obj):
        if obj.salary_notch and obj.salary_notch.level and obj.salary_notch.level.band:
            return obj.salary_notch.level.band.name
        return None

    def get_salary_level_name(self, obj):
        if obj.salary_notch and obj.salary_notch.level:
            return obj.salary_notch.level.name
        return None

    def get_salary_notch_name(self, obj):
        if obj.salary_notch:
            return obj.salary_notch.name
        return None

    def get_salary_notch_amount(self, obj):
        if obj.salary_notch:
            return str(obj.salary_notch.amount)
        return None

    def _get_primary_bank(self, obj):
        """Get primary bank account from prefetch or fallback to query."""
        accounts = getattr(obj, 'active_bank_accounts', None)
        if accounts is None:
            accounts = list(obj.bank_accounts.filter(is_deleted=False))
        primary = next((a for a in accounts if a.is_primary), None)
        return primary or (accounts[0] if accounts else None)

    def get_bank_name(self, obj):
        acct = self._get_primary_bank(obj)
        return acct.bank_name if acct else None

    def get_bank_branch(self, obj):
        acct = self._get_primary_bank(obj)
        return acct.branch_name if acct else None

    def get_bank_account_number(self, obj):
        acct = self._get_primary_bank(obj)
        return acct.account_number if acct else None

    def get_bank_accounts_list(self, obj):
        accounts = getattr(obj, 'active_bank_accounts', None)
        if accounts is None:
            accounts = obj.bank_accounts.filter(is_deleted=False)
        return BankAccountSerializer(accounts, many=True).data

    def get_leave_balances(self, obj):
        balances = getattr(obj, 'current_leave_balances', None)
        if balances is None:
            from leave.models import LeaveBalance
            from django.utils import timezone
            balances = LeaveBalance.objects.filter(
                employee=obj, year=timezone.now().year
            ).select_related('leave_type')
        return LeaveBalanceNestedSerializer(balances, many=True).data

    def get_salary(self, obj):
        """Get current salary information for the employee."""
        salary_list = getattr(obj, 'current_salary_list', None)
        if salary_list is None:
            from payroll.models import EmployeeSalary
            salary_list = list(EmployeeSalary.objects.filter(
                employee=obj, is_current=True
            ).select_related('salary_structure').prefetch_related('components__pay_component'))
        current_salary = salary_list[0] if salary_list else None
        return EmployeeSalaryNestedSerializer(current_salary).data if current_salary else None

    def update(self, instance, validated_data):
        # Extract bank account data
        bank_id = validated_data.pop('bank_id', None)
        branch_id = validated_data.pop('branch_id', None)
        account_number = validated_data.pop('account_number', None)
        account_name = validated_data.pop('account_name', None)
        account_type = validated_data.pop('account_type', None)

        # Update employee fields
        instance = super().update(instance, validated_data)

        # Handle bank account update if any bank data provided
        if any([bank_id, branch_id, account_number, account_name]):
            self._update_bank_account(
                instance, bank_id, branch_id, account_number, account_name, account_type
            )

        return instance

    def _update_bank_account(self, employee, bank_id, branch_id, account_number, account_name, account_type):
        """Create or update primary bank account for employee."""
        from payroll.models import Bank, BankBranch

        # Try to get existing primary bank account
        bank_account = employee.bank_accounts.filter(is_primary=True, is_deleted=False).first()

        # Prepare bank account data
        bank_data = {}

        if bank_id:
            try:
                bank = Bank.objects.get(id=bank_id)
                bank_data['bank'] = bank
                bank_data['bank_name'] = bank.name
                bank_data['bank_code'] = bank.code
            except Bank.DoesNotExist:
                pass

        if branch_id:
            try:
                branch = BankBranch.objects.get(id=branch_id)
                bank_data['branch'] = branch
                bank_data['branch_name'] = branch.name
                bank_data['branch_code'] = branch.code
            except BankBranch.DoesNotExist:
                pass

        if account_number:
            bank_data['account_number'] = account_number

        if account_name:
            bank_data['account_name'] = account_name

        if account_type:
            bank_data['account_type'] = account_type

        if bank_data:
            if bank_account:
                # Update existing
                for key, value in bank_data.items():
                    setattr(bank_account, key, value)
                bank_account.save()
            else:
                # Create new primary bank account
                bank_data['employee'] = employee
                bank_data['is_primary'] = True
                if 'account_name' not in bank_data:
                    bank_data['account_name'] = employee.full_name
                if 'account_type' not in bank_data:
                    bank_data['account_type'] = 'SAVINGS'
                BankAccount.objects.create(**bank_data)


class EmployeeCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating employees."""
    employee_number = serializers.CharField(required=False, allow_blank=True)

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
        from .models import generate_employee_number
        import json as _json

        validated_data['created_by'] = self.context['request'].user

        # Auto-generate employee_number if not provided
        emp_number = validated_data.get('employee_number', '').strip() if validated_data.get('employee_number') else ''
        if not emp_number:
            # Check if auto_generate is enabled
            try:
                from core.models import SystemConfiguration
                config_obj = SystemConfiguration.objects.get(key='employee_id_config')
                config = _json.loads(config_obj.value)
                auto_generate = config.get('auto_generate', True)
            except SystemConfiguration.DoesNotExist:
                auto_generate = True

            if auto_generate:
                validated_data['employee_number'] = generate_employee_number()
            else:
                raise serializers.ValidationError(
                    {'employee_number': 'Employee number is required when auto-generation is disabled.'}
                )

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
            'id', 'bank', 'branch', 'bank_name', 'bank_code', 'branch_name', 'branch_code',
            'account_name', 'account_number', 'account_type', 'swift_code',
            'is_primary', 'is_active', 'is_verified', 'notes'
        ]
        extra_kwargs = {
            'bank': {'required': False, 'allow_null': True},
            'branch': {'required': False, 'allow_null': True},
        }


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
    organization_name = serializers.SerializerMethodField()
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
            'organization_name',
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

    def get_organization_name(self, obj):
        if obj.user and obj.user.organization:
            return obj.user.organization.name
        return None


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
        # Use annotation from queryset if available (avoids N+1)
        if hasattr(obj, 'is_currently_on_leave'):
            return obj.is_currently_on_leave

        from leave.models import LeaveRequest
        from django.utils import timezone
        today = timezone.now().date()
        return LeaveRequest.objects.filter(
            employee=obj,
            status=LeaveRequest.Status.APPROVED,
            start_date__lte=today,
            end_date__gte=today
        ).exists()


# ============================================
# Data Update Request Serializers
# ============================================

class DataUpdateDocumentSerializer(serializers.ModelSerializer):
    """Serializer for Data Update supporting documents with binary file storage."""
    file = serializers.FileField(write_only=True, required=False)
    file_url = serializers.SerializerMethodField()
    file_info = serializers.SerializerMethodField()
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = DataUpdateDocument
        fields = [
            'id', 'data_update_request', 'file', 'file_url', 'file_info',
            'file_name', 'mime_type', 'file_size', 'file_checksum',
            'document_type', 'document_type_display', 'description',
            'uploaded_by', 'uploaded_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'file_name', 'mime_type', 'file_size', 'file_checksum', 'uploaded_by', 'created_at']

    def get_file_url(self, obj):
        """Return file as data URI for embedding/download."""
        if obj.has_file:
            return obj.get_file_data_uri()
        return None

    def get_file_info(self, obj):
        """Return file metadata."""
        if obj.has_file:
            return {
                'name': obj.file_name,
                'size': obj.file_size,
                'type': obj.mime_type,
                'checksum': obj.file_checksum,
                'is_image': obj.is_image,
                'is_pdf': obj.is_pdf,
                'is_document': obj.is_document,
            }
        return None

    def create(self, validated_data):
        file_obj = validated_data.pop('file', None)
        instance = super().create(validated_data)
        if file_obj:
            instance.set_file(file_obj)
            instance.save()
        return instance


class DataUpdateRequestSerializer(serializers.ModelSerializer):
    """Serializer for Data Update Requests."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    request_type_display = serializers.CharField(source='get_request_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.get_full_name', read_only=True, allow_null=True)
    documents = DataUpdateDocumentSerializer(many=True, read_only=True)
    changes_summary = serializers.ReadOnlyField()

    class Meta:
        model = DataUpdateRequest
        fields = [
            'id', 'request_number', 'employee', 'employee_name', 'employee_number',
            'request_type', 'request_type_display',
            'old_values', 'new_values', 'changes_summary',
            'reason', 'status', 'status_display',
            'submitted_at', 'reviewed_by', 'reviewed_by_name',
            'reviewed_at', 'review_comments', 'rejection_reason',
            'applied_at', 'documents',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'request_number', 'employee', 'status',
            'submitted_at', 'reviewed_by', 'reviewed_at',
            'applied_at', 'applied_by'
        ]


class DataUpdateRequestCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating data update requests."""

    class Meta:
        model = DataUpdateRequest
        fields = [
            'id', 'request_number', 'request_type', 'old_values', 'new_values', 'reason', 'status'
        ]
        read_only_fields = ['id', 'request_number', 'status']

    def create(self, validated_data):
        import uuid
        user = self.context['request'].user

        if hasattr(user, 'employee'):
            validated_data['employee'] = user.employee
        else:
            raise serializers.ValidationError("User does not have an employee record")

        # Generate request number
        validated_data['request_number'] = f"DUR-{uuid.uuid4().hex[:8].upper()}"

        # Capture current values based on request type
        request_type = validated_data.get('request_type')
        employee = validated_data['employee']

        if request_type == DataUpdateRequest.RequestType.PERSONAL and not validated_data.get('old_values'):
            validated_data['old_values'] = {
                'first_name': employee.first_name,
                'middle_name': employee.middle_name,
                'last_name': employee.last_name,
                'marital_status': employee.marital_status,
                'nationality': employee.nationality,
            }

        return super().create(validated_data)


class BankUpdateRequestSerializer(serializers.Serializer):
    """Specialized serializer for bank details update request."""
    bank_name = serializers.CharField(max_length=100)
    branch_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    account_number = serializers.CharField(max_length=50)
    account_name = serializers.CharField(max_length=200)
    account_type = serializers.ChoiceField(choices=['SAVINGS', 'CURRENT', 'OTHER'], default='SAVINGS')
    reason = serializers.CharField()

    def validate_account_number(self, value):
        """Validate account number format."""
        if len(value) < 8:
            raise serializers.ValidationError("Account number must be at least 8 characters")
        return value


class NameChangeRequestSerializer(serializers.Serializer):
    """Specialized serializer for name change request."""
    title = serializers.CharField(max_length=20, required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=100, required=False)
    middle_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=100, required=False)
    maiden_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    reason = serializers.CharField()

    def validate(self, data):
        """Ensure at least one name field is provided."""
        name_fields = ['title', 'first_name', 'middle_name', 'last_name', 'maiden_name']
        if not any(data.get(field) for field in name_fields):
            raise serializers.ValidationError("At least one name field must be provided")
        return data


class AddressUpdateRequestSerializer(serializers.Serializer):
    """Specialized serializer for address update request."""
    residential_address = serializers.CharField(required=False, allow_blank=True)
    residential_city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    postal_address = serializers.CharField(required=False, allow_blank=True)
    digital_address = serializers.CharField(max_length=50, required=False, allow_blank=True)
    region = serializers.UUIDField(required=False, allow_null=True)
    district = serializers.UUIDField(required=False, allow_null=True)
    reason = serializers.CharField()


class EmergencyContactUpdateSerializer(serializers.Serializer):
    """Specialized serializer for emergency contact update request."""
    action = serializers.ChoiceField(choices=['ADD', 'UPDATE', 'DELETE'])
    contact_id = serializers.UUIDField(required=False, allow_null=True)  # For UPDATE/DELETE
    name = serializers.CharField(max_length=200, required=False)
    relationship = serializers.CharField(max_length=50, required=False)
    phone_primary = serializers.CharField(max_length=20, required=False)
    phone_secondary = serializers.CharField(max_length=20, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    is_primary = serializers.BooleanField(required=False, default=False)
    reason = serializers.CharField()

    def validate(self, data):
        """Validate based on action type."""
        action = data.get('action')
        if action == 'ADD':
            required_fields = ['name', 'relationship', 'phone_primary']
            for field in required_fields:
                if not data.get(field):
                    raise serializers.ValidationError(f"{field} is required for adding a new contact")
        elif action in ['UPDATE', 'DELETE']:
            if not data.get('contact_id'):
                raise serializers.ValidationError("contact_id is required for update/delete actions")
        return data


class DependentUpdateSerializer(serializers.Serializer):
    """Specialized serializer for dependent update request."""
    action = serializers.ChoiceField(choices=['ADD', 'UPDATE', 'DELETE'])
    dependent_id = serializers.UUIDField(required=False, allow_null=True)  # For UPDATE/DELETE
    first_name = serializers.CharField(max_length=100, required=False)
    last_name = serializers.CharField(max_length=100, required=False)
    relationship = serializers.CharField(max_length=50, required=False)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.ChoiceField(choices=['M', 'F'], required=False)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    is_beneficiary = serializers.BooleanField(required=False, default=False)
    reason = serializers.CharField()

    def validate(self, data):
        """Validate based on action type."""
        action = data.get('action')
        if action == 'ADD':
            required_fields = ['first_name', 'last_name', 'relationship']
            for field in required_fields:
                if not data.get(field):
                    raise serializers.ValidationError(f"{field} is required for adding a new dependent")
        elif action in ['UPDATE', 'DELETE']:
            if not data.get('dependent_id'):
                raise serializers.ValidationError("dependent_id is required for update/delete actions")
        return data


# ============================================
# HR Service Request Serializers
# ============================================

class ServiceRequestTypeSerializer(serializers.ModelSerializer):
    """Serializer for ServiceRequestType model."""

    class Meta:
        model = ServiceRequestType
        fields = [
            'id', 'code', 'name', 'description',
            'sla_days', 'requires_manager_approval', 'requires_hr_approval',
            'requires_document', 'is_active', 'sort_order'
        ]


class ServiceRequestDocumentSerializer(serializers.ModelSerializer):
    """Serializer for Service Request documents."""
    file = serializers.FileField(write_only=True, required=False)
    file_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)

    class Meta:
        model = ServiceRequestDocument
        fields = [
            'id', 'service_request', 'file', 'file_url',
            'file_name', 'mime_type', 'file_size', 'description',
            'uploaded_by', 'uploaded_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'file_name', 'mime_type', 'file_size', 'uploaded_by', 'created_at']

    def get_file_url(self, obj):
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


class ServiceRequestCommentSerializer(serializers.ModelSerializer):
    """Serializer for Service Request comments."""
    commented_by_name = serializers.CharField(source='commented_by.get_full_name', read_only=True)

    class Meta:
        model = ServiceRequestComment
        fields = [
            'id', 'service_request', 'comment', 'comment_type',
            'is_visible_to_employee', 'commented_by', 'commented_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'commented_by', 'created_at']


class ServiceRequestSerializer(serializers.ModelSerializer):
    """Full serializer for Service Request."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    request_type_name = serializers.CharField(source='request_type.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    sla_status_display = serializers.CharField(source='get_sla_status_display', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True, allow_null=True)
    resolved_by_name = serializers.CharField(source='resolved_by.get_full_name', read_only=True, allow_null=True)
    days_until_sla = serializers.ReadOnlyField()
    is_overdue = serializers.ReadOnlyField()
    comments = ServiceRequestCommentSerializer(many=True, read_only=True)
    documents = ServiceRequestDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = ServiceRequest
        fields = [
            'id', 'request_number', 'employee', 'employee_name', 'employee_number',
            'request_type', 'request_type_name',
            'subject', 'description', 'priority', 'priority_display',
            'status', 'status_display',
            'submitted_at', 'acknowledged_at',
            'sla_deadline', 'sla_status', 'sla_status_display',
            'days_until_sla', 'is_overdue',
            'assigned_to', 'assigned_to_name', 'assigned_location',
            'resolved_at', 'resolved_by', 'resolved_by_name',
            'resolution_notes', 'rejection_reason',
            'is_escalated', 'escalated_at', 'escalated_to', 'escalation_reason',
            'satisfaction_rating', 'feedback',
            'comments', 'documents',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'request_number', 'employee', 'status',
            'submitted_at', 'acknowledged_at', 'sla_deadline', 'sla_status',
            'resolved_at', 'resolved_by', 'escalated_at'
        ]


class ServiceRequestCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating service requests."""

    class Meta:
        model = ServiceRequest
        fields = [
            'id', 'request_number', 'request_type',
            'subject', 'description', 'priority', 'status'
        ]
        read_only_fields = ['id', 'request_number', 'status']

    def create(self, validated_data):
        import uuid
        user = self.context['request'].user

        if hasattr(user, 'employee'):
            validated_data['employee'] = user.employee
        else:
            raise serializers.ValidationError("User does not have an employee record")

        # Generate request number
        validated_data['request_number'] = f"SR-{uuid.uuid4().hex[:8].upper()}"

        return super().create(validated_data)


class ServiceRequestListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing service requests."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    request_type_name = serializers.CharField(source='request_type.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    sla_status_display = serializers.CharField(source='get_sla_status_display', read_only=True)
    days_until_sla = serializers.ReadOnlyField()
    is_overdue = serializers.ReadOnlyField()

    class Meta:
        model = ServiceRequest
        fields = [
            'id', 'request_number', 'employee', 'employee_name', 'employee_number',
            'request_type', 'request_type_name',
            'subject', 'priority', 'status', 'status_display',
            'sla_deadline', 'sla_status', 'sla_status_display',
            'days_until_sla', 'is_overdue',
            'submitted_at', 'created_at'
        ]
