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


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    full_name = serializers.ReadOnlyField()
    roles = serializers.SerializerMethodField()
    profile_photo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'middle_name', 'last_name',
            'full_name', 'phone_number', 'profile_photo', 'is_active', 'is_verified',
            'is_staff', 'is_superuser', 'two_factor_enabled', 'created_at', 'last_login_at', 'roles'
        ]
        read_only_fields = ['id', 'created_at', 'last_login_at', 'is_verified', 'is_staff', 'is_superuser']

    def get_roles(self, obj):
        return list(obj.user_roles.filter(is_active=True).values_list('role__code', flat=True))

    def get_profile_photo(self, obj):
        """Return profile photo as data URI."""
        if obj.has_profile_photo:
            return obj.get_profile_photo_data_uri()
        return None


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating users."""
    password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'email', 'username', 'first_name', 'middle_name', 'last_name',
            'phone_number', 'password', 'confirm_password'
        ]

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match'})
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
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

    class Meta:
        model = Role
        fields = ['id', 'name', 'code', 'description', 'is_system_role', 'is_active', 'level', 'permissions']
        read_only_fields = ['id', 'is_system_role']

    def get_permissions(self, obj):
        return list(obj.role_permissions.values_list('permission__code', flat=True))


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
