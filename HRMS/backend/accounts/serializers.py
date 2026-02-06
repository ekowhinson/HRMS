"""
Serializers for accounts app.
"""

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q

from .models import User, Role, Permission, UserRole, UserSession, EmailVerificationToken
from employees.models import Employee


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
    role_name = serializers.CharField(source='role.name', read_only=True)
    role_code = serializers.CharField(source='role.code', read_only=True)
    is_effective = serializers.BooleanField(read_only=True)

    class Meta:
        model = UserRole
        fields = [
            'id', 'role', 'role_name', 'role_code', 'scope_type', 'scope_id',
            'is_primary', 'effective_from', 'effective_to', 'is_active', 'is_effective'
        ]


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    full_name = serializers.ReadOnlyField()
    roles = serializers.SerializerMethodField()
    profile_photo_url = serializers.SerializerMethodField()
    employee = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'middle_name', 'last_name',
            'full_name', 'phone_number', 'profile_photo_url', 'is_active', 'is_verified',
            'is_staff', 'is_superuser', 'two_factor_enabled', 'must_change_password',
            'last_login_at', 'last_login_ip', 'created_at', 'updated_at', 'roles', 'employee'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_login_at', 'last_login_ip']

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
            employee = obj.employee
            if employee:
                return {
                    'id': str(employee.id),
                    'employee_number': employee.employee_number,
                    'department_name': employee.department.name if employee.department else None,
                    'position_title': employee.position.title if employee.position else None,
                }
        except Exception:
            pass
        return None


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

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError('No user found with this email address')
        return value


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

    class Meta:
        model = Role
        fields = [
            'id', 'name', 'code', 'description', 'is_system_role', 'is_active',
            'level', 'permissions', 'permissions_count', 'users_count', 'created_at', 'updated_at'
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
        return obj.role_permissions.count()

    def get_users_count(self, obj):
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
