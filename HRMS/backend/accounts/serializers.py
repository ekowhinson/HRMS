"""
Serializers for accounts app.
"""

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q

from .models import User, Role, Permission, UserRole, UserSession, EmailVerificationToken, UserOrganization
from employees.models import Employee
from organization.models import Organization


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT token serializer with additional claims."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token['email'] = user.email
        token['full_name'] = user.full_name

        # Add roles
        roles = user.user_roles.filter(is_active=True).values_list('role__code', flat=True)
        token['roles'] = list(roles)

        # Add active organization
        if user.organization_id:
            token['organization_id'] = str(user.organization_id)

        return token


class LoginSerializer(serializers.Serializer):
    """Serializer for login endpoint."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    two_factor_code = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        user = authenticate(username=email, password=password)

        if not user:
            raise serializers.ValidationError('Invalid credentials')

        if not user.is_active:
            raise serializers.ValidationError('User account is disabled')

        if user.is_locked_out():
            raise serializers.ValidationError('Account is temporarily locked due to too many failed login attempts')

        attrs['user'] = user
        return attrs


class UserRoleDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for UserRole with role info."""
    name = serializers.CharField(source='role.name', read_only=True)
    code = serializers.CharField(source='role.code', read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)
    role_code = serializers.CharField(source='role.code', read_only=True)
    is_effective = serializers.BooleanField(read_only=True)

    class Meta:
        model = UserRole
        fields = [
            'id', 'role', 'name', 'code', 'role_name', 'role_code', 'scope_type', 'scope_id',
            'is_primary', 'effective_from', 'effective_to', 'is_active', 'is_effective'
        ]


class OrganizationBriefSerializer(serializers.ModelSerializer):
    """Brief serializer for Organization — used in auth responses."""

    class Meta:
        model = Organization
        fields = ['id', 'name', 'code', 'logo_data', 'primary_color']


class UserOrganizationSerializer(serializers.ModelSerializer):
    """Serializer for UserOrganization membership."""
    organization = OrganizationBriefSerializer(read_only=True)
    organization_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = UserOrganization
        fields = ['id', 'organization', 'organization_id', 'role', 'is_default', 'joined_at']
        read_only_fields = ['id', 'joined_at']

    def validate_organization_id(self, value):
        try:
            Organization.objects.get(id=value, is_active=True)
        except Organization.DoesNotExist:
            raise serializers.ValidationError('Organization not found or inactive.')
        return value


class SwitchOrganizationSerializer(serializers.Serializer):
    """Serializer for switching active organization."""
    organization_id = serializers.UUIDField()

    def validate_organization_id(self, value):
        user = self.context['request'].user
        if not UserOrganization.objects.filter(user=user, organization_id=value).exists():
            raise serializers.ValidationError('You are not a member of this organization.')
        try:
            org = Organization.objects.get(id=value, is_active=True)
        except Organization.DoesNotExist:
            raise serializers.ValidationError('Organization not found or inactive.')
        return value


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    full_name = serializers.ReadOnlyField()
    roles = serializers.SerializerMethodField()
    profile_photo_url = serializers.SerializerMethodField()
    employee = serializers.SerializerMethodField()
    active_organization = serializers.SerializerMethodField()
    organizations = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'middle_name', 'last_name',
            'full_name', 'phone_number', 'profile_photo_url', 'is_active', 'is_verified',
            'is_staff', 'is_superuser', 'two_factor_enabled', 'two_factor_method',
            'must_change_password', 'failed_login_attempts', 'lockout_until',
            'last_login_at', 'last_login_ip', 'created_at', 'updated_at',
            'roles', 'employee', 'active_organization', 'organizations'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'last_login_at', 'last_login_ip',
            'failed_login_attempts', 'lockout_until',
        ]

    def get_roles(self, obj):
        user_roles = obj.user_roles.filter(is_active=True).select_related('role')
        return UserRoleDetailSerializer(user_roles, many=True).data

    def get_profile_photo_url(self, obj):
        """Return profile photo as data URI."""
        if obj.has_profile_photo:
            return obj.get_profile_photo_data_uri()
        return None

    def get_employee(self, obj):
        """Return linked employee info if exists."""
        try:
            # Use select_related employee from queryset if available
            employee = obj.employee
            if employee:
                dept = getattr(employee, 'department', None)
                pos = getattr(employee, 'position', None)
                return {
                    'id': str(employee.id),
                    'employee_number': employee.employee_number,
                    'department_name': dept.name if dept else None,
                    'position_title': pos.title if pos else None,
                }
        except Employee.DoesNotExist:
            pass
        return None

    def get_active_organization(self, obj):
        """Return the user's active organization."""
        if obj.organization:
            return OrganizationBriefSerializer(obj.organization).data
        return None

    def get_organizations(self, obj):
        """Return all organizations the user belongs to."""
        memberships = obj.user_organizations.select_related('organization').all()
        return [{
            'id': str(m.organization.id),
            'name': m.organization.name,
            'code': m.organization.code,
            'role': m.role,
            'is_default': m.is_default,
        } for m in memberships]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if request and request.user != instance:
            if not (request.user.is_staff or request.user.is_superuser):
                for field in ('failed_login_attempts', 'lockout_until', 'last_login_ip', 'is_superuser'):
                    data.pop(field, None)
        return data


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating users (admin)."""
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    roles = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)

    class Meta:
        model = User
        fields = [
            'email', 'username', 'first_name', 'middle_name', 'last_name',
            'phone_number', 'password', 'password_confirm', 'is_active', 'is_staff', 'roles'
        ]

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password_confirm'):
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match'})
        return attrs

    def create(self, validated_data):
        roles = validated_data.pop('roles', [])
        user = User.objects.create_user(**validated_data)

        # Assign roles if provided
        for role_id in roles:
            try:
                role = Role.objects.get(id=role_id, is_active=True)
                UserRole.objects.create(user=user, role=role)
            except Role.DoesNotExist:
                pass

        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile."""
    profile_photo = serializers.ImageField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = ['first_name', 'middle_name', 'last_name', 'phone_number', 'profile_photo']

    def update(self, instance, validated_data):
        # Handle profile photo upload separately
        profile_photo = validated_data.pop('profile_photo', None)
        if profile_photo is not None:
            instance.set_profile_photo(profile_photo)

        return super().update(instance, validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing password."""
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect')
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match'})
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for password reset request."""
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for password reset confirmation."""
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match'})
        return attrs


class RoleSerializer(serializers.ModelSerializer):
    """Serializer for Role model."""
    permissions = serializers.SerializerMethodField()
    permissions_count = serializers.SerializerMethodField()
    users_count = serializers.SerializerMethodField()
    district_name = serializers.CharField(source='district.name', read_only=True, allow_null=True)
    region_name = serializers.CharField(source='district.region.name', read_only=True, allow_null=True)

    class Meta:
        model = Role
        fields = [
            'id', 'name', 'code', 'description', 'is_system_role', 'is_active',
            'level', 'district', 'district_name', 'region_name',
            'permissions', 'permissions_count', 'users_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'is_system_role', 'created_at', 'updated_at']

    def get_permissions(self, obj):
        """Return full permission objects."""
        permissions = Permission.objects.filter(
            role_permissions__role=obj,
            is_active=True
        )
        return PermissionSerializer(permissions, many=True).data

    def get_permissions_count(self, obj):
        if hasattr(obj, 'permissions_count_annotated'):
            return obj.permissions_count_annotated
        return obj.role_permissions.count()

    def get_users_count(self, obj):
        if hasattr(obj, 'active_users_count_annotated'):
            return obj.active_users_count_annotated
        return obj.user_roles.filter(is_active=True).count()


class PermissionSerializer(serializers.ModelSerializer):
    """Serializer for Permission model."""

    class Meta:
        model = Permission
        fields = ['id', 'name', 'code', 'description', 'module', 'is_active']


class UserRoleSerializer(serializers.ModelSerializer):
    """Serializer for UserRole model."""
    role_name = serializers.CharField(source='role.name', read_only=True)
    role_code = serializers.CharField(source='role.code', read_only=True)

    class Meta:
        model = UserRole
        fields = [
            'id', 'user', 'role', 'role_name', 'role_code', 'scope_type', 'scope_id',
            'is_primary', 'effective_from', 'effective_to', 'is_active'
        ]


class UserSessionSerializer(serializers.ModelSerializer):
    """Serializer for UserSession model."""

    class Meta:
        model = UserSession
        fields = [
            'id', 'ip_address', 'user_agent', 'device_info', 'is_active',
            'last_activity', 'expires_at', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class EmployeeSignupSerializer(serializers.Serializer):
    """Serializer for employee signup initiation."""
    email = serializers.EmailField()
    employee_number = serializers.CharField(required=False, allow_blank=True)
    ghana_card_number = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        email = attrs.get('email')
        employee_number = attrs.get('employee_number', '').strip()
        ghana_card_number = attrs.get('ghana_card_number', '').strip()

        # Must provide either employee_number or ghana_card_number
        if not employee_number and not ghana_card_number:
            raise serializers.ValidationError({
                'employee_number': 'Either employee number or Ghana Card number is required'
            })

        # Find the employee
        query = Q()
        if employee_number:
            query |= Q(employee_number__iexact=employee_number)
        if ghana_card_number:
            query |= Q(ghana_card_number__iexact=ghana_card_number)

        try:
            employee = Employee.objects.get(query)
        except Employee.DoesNotExist:
            raise serializers.ValidationError({
                'employee_number': 'No employee found with the provided information'
            })
        except Employee.MultipleObjectsReturned:
            raise serializers.ValidationError({
                'employee_number': 'Multiple records found. Please contact HR.'
            })

        # Check if employee already has a user account
        if employee.user is not None:
            raise serializers.ValidationError({
                'email': 'This employee already has an account. Please use the login page.'
            })

        # Check if email is already registered
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError({
                'email': 'An account with this email already exists'
            })

        attrs['employee'] = employee
        return attrs


class VerifyEmailTokenSerializer(serializers.Serializer):
    """Serializer for validating email verification token."""
    token = serializers.CharField()

    def validate_token(self, value):
        try:
            token = EmailVerificationToken.objects.get(
                token=value,
                token_type=EmailVerificationToken.TokenType.SIGNUP
            )
        except EmailVerificationToken.DoesNotExist:
            raise serializers.ValidationError('Invalid or expired token')

        if not token.is_valid:
            if token.is_used:
                raise serializers.ValidationError('This token has already been used')
            if token.is_expired:
                raise serializers.ValidationError('This token has expired')
            raise serializers.ValidationError('Invalid token')

        self.context['verification_token'] = token
        return value


class CompleteSignupSerializer(serializers.Serializer):
    """Serializer for completing employee signup."""
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)

    def validate_token(self, value):
        try:
            token = EmailVerificationToken.objects.get(
                token=value,
                token_type=EmailVerificationToken.TokenType.SIGNUP
            )
        except EmailVerificationToken.DoesNotExist:
            raise serializers.ValidationError('Invalid or expired token')

        if not token.is_valid:
            if token.is_used:
                raise serializers.ValidationError('This token has already been used')
            if token.is_expired:
                raise serializers.ValidationError('This token has expired')
            raise serializers.ValidationError('Invalid token')

        self.context['verification_token'] = token
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': 'Passwords do not match'
            })
        return attrs


class EmployeeInfoSerializer(serializers.Serializer):
    """Serializer for returning employee info during signup verification."""
    id = serializers.UUIDField()
    employee_number = serializers.CharField()
    full_name = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    department_name = serializers.CharField(source='department.name', allow_null=True)
    position_title = serializers.CharField(source='position.title', allow_null=True)
    work_email = serializers.EmailField(allow_null=True)
    photo = serializers.SerializerMethodField()

    def get_photo(self, obj):
        """Return photo as data URI."""
        if obj.has_photo:
            return obj.get_photo_data_uri()
        return None


class AuthenticationLogSerializer(serializers.ModelSerializer):
    """Serializer for AuthenticationLog model."""
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)

    class Meta:
        from .models import AuthenticationLog
        model = AuthenticationLog
        fields = [
            'id', 'user', 'email', 'event_type', 'event_type_display',
            'ip_address', 'user_agent', 'location', 'extra_data', 'timestamp'
        ]


class UserRoleAssignSerializer(serializers.Serializer):
    """Serializer for assigning a role to a user."""
    role = serializers.UUIDField()
    scope_type = serializers.ChoiceField(
        choices=['global', 'region', 'department', 'team'],
        default='global'
    )
    scope_id = serializers.UUIDField(required=False, allow_null=True)
    effective_from = serializers.DateField(required=False)
    effective_to = serializers.DateField(required=False, allow_null=True)
    is_primary = serializers.BooleanField(default=False)

    def validate_role(self, value):
        try:
            Role.objects.get(id=value, is_active=True)
        except Role.DoesNotExist:
            raise serializers.ValidationError('Role not found or inactive')
        return value


class RoleUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating a role with permissions."""
    permissions = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True
    )

    class Meta:
        model = Role
        fields = ['name', 'description', 'level', 'is_active', 'permissions']

    def update(self, instance, validated_data):
        from .models import RolePermission

        permissions = validated_data.pop('permissions', None)

        # Update role fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update permissions if provided
        if permissions is not None:
            # Clear existing permissions
            instance.role_permissions.all().delete()
            # Add new permissions
            for perm_id in permissions:
                try:
                    permission = Permission.objects.get(id=perm_id)
                    RolePermission.objects.create(role=instance, permission=permission)
                except Permission.DoesNotExist:
                    pass

        return instance


# ============================================
# Authentication Provider Serializers
# ============================================

from .models import AuthProvider, UserAuthProvider


class AuthProviderSerializer(serializers.ModelSerializer):
    """
    Public serializer for auth providers (limited info).
    """
    class Meta:
        model = AuthProvider
        fields = ['id', 'name', 'provider_type', 'is_enabled', 'is_default']
        read_only_fields = fields


class AuthProviderConfigSerializer(serializers.ModelSerializer):
    """
    Admin serializer for auth provider configuration.
    """
    default_role_name = serializers.CharField(source='default_role.name', read_only=True)
    users_count = serializers.SerializerMethodField()

    class Meta:
        model = AuthProvider
        fields = [
            'id', 'name', 'provider_type', 'is_enabled', 'is_default', 'priority',
            'config', 'auto_provision_users', 'auto_link_by_email',
            'default_role', 'default_role_name', 'allowed_domains',
            'last_connection_test', 'last_connection_status', 'last_connection_error',
            'last_sync_at', 'last_sync_count', 'users_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'provider_type', 'default_role_name', 'users_count',
            'last_connection_test', 'last_connection_status', 'last_connection_error',
            'last_sync_at', 'last_sync_count', 'created_at', 'updated_at'
        ]

    def get_users_count(self, obj):
        return UserAuthProvider.objects.filter(provider=obj, is_active=True).count()

    def validate_config(self, value):
        """Validate provider-specific configuration."""
        provider_type = self.instance.provider_type if self.instance else None

        if provider_type == 'LDAP':
            required_fields = ['server_uri']
            for field in required_fields:
                if not value.get(field):
                    raise serializers.ValidationError(f"LDAP config requires '{field}'")

        elif provider_type == 'AZURE_AD':
            required_fields = ['tenant_id', 'client_id', 'client_secret']
            for field in required_fields:
                if not value.get(field):
                    raise serializers.ValidationError(f"Azure AD config requires '{field}'")

        return value


class UserAuthProviderSerializer(serializers.ModelSerializer):
    """
    Serializer for user auth provider links.
    """
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    provider_type = serializers.CharField(source='provider.provider_type', read_only=True)

    class Meta:
        model = UserAuthProvider
        fields = [
            'id', 'provider', 'provider_name', 'provider_type',
            'external_id', 'external_username', 'is_primary', 'is_active',
            'last_login', 'login_count', 'created_at'
        ]
        read_only_fields = ['id', 'external_id', 'external_username', 'last_login', 'login_count', 'created_at']


# ============================================
# Two-Factor Authentication Serializers
# ============================================

class TwoFactorSetupSerializer(serializers.Serializer):
    """Serializer for 2FA setup verification."""
    method = serializers.ChoiceField(
        choices=['TOTP', 'EMAIL', 'SMS'],
        required=False,
        default='EMAIL',
    )
    code = serializers.CharField(min_length=6, max_length=6)

    def validate_code(self, value):
        if not value.isdigit():
            raise serializers.ValidationError('Code must be 6 digits')
        return value


class TwoFactorDisableSerializer(serializers.Serializer):
    """Serializer for disabling 2FA."""
    password = serializers.CharField(write_only=True)
