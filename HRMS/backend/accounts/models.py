"""
Custom User model and authentication-related models for HRMS.
"""

import uuid
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from django.utils import timezone
from django.conf import settings

from core.models import TimeStampedModel


class UserManager(BaseUserManager):
    """Custom user manager for the User model."""

    def create_user(self, email, password=None, **extra_fields):
        """Create and save a regular user with the given email and password."""
        if not email:
            raise ValueError('Users must have an email address')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a superuser with the given email and password."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class AuthProvider(TimeStampedModel):
    """
    Authentication provider configuration.
    Stores settings for each enabled auth method (Local, LDAP, Azure AD).
    """
    class ProviderType(models.TextChoices):
        LOCAL = 'LOCAL', 'Local (Email/Password)'
        LDAP = 'LDAP', 'LDAP/Active Directory'
        AZURE_AD = 'AZURE_AD', 'Azure Active Directory'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    provider_type = models.CharField(
        max_length=20,
        choices=ProviderType.choices,
        unique=True
    )
    is_enabled = models.BooleanField(default=False)
    is_default = models.BooleanField(default=False)
    priority = models.PositiveSmallIntegerField(default=0)

    # Provider-specific configuration (JSON)
    # LDAP: server_uri, bind_dn, bind_password, user_search_base, etc.
    # Azure AD: client_id, client_secret, tenant_id, redirect_uri, etc.
    config = models.JSONField(default=dict, blank=True)

    # User provisioning settings
    auto_provision_users = models.BooleanField(
        default=True,
        help_text='Automatically create user accounts on first login'
    )
    auto_link_by_email = models.BooleanField(
        default=True,
        help_text='Link to existing user accounts by email'
    )
    default_role = models.ForeignKey(
        'Role',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='auth_provider_defaults',
        help_text='Default role for auto-provisioned users'
    )

    # Domain restrictions (empty = all allowed)
    allowed_domains = models.JSONField(
        default=list,
        blank=True,
        help_text='List of allowed email domains (empty = all allowed)'
    )

    # Connection status
    last_connection_test = models.DateTimeField(null=True, blank=True)
    last_connection_status = models.BooleanField(null=True, blank=True)
    last_connection_error = models.TextField(null=True, blank=True)

    # Sync status (for LDAP)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_sync_count = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'auth_providers'
        ordering = ['priority', 'name']
        verbose_name = 'Authentication Provider'
        verbose_name_plural = 'Authentication Providers'

    def __str__(self):
        status = "enabled" if self.is_enabled else "disabled"
        return f"{self.name} ({self.provider_type}) - {status}"

    def save(self, *args, **kwargs):
        # Ensure only one default provider
        if self.is_default:
            AuthProvider.objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)

    def get_config_value(self, key, default=None):
        """Safely get a configuration value."""
        return self.config.get(key, default)

    def set_config_value(self, key, value):
        """Set a configuration value."""
        self.config[key] = value

    def check_domain_allowed(self, email):
        """Check if email domain is allowed for this provider."""
        if not self.allowed_domains:
            return True
        domain = email.split('@')[-1].lower()
        return domain in [d.lower() for d in self.allowed_domains]


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    """
    Custom User model that uses email as the unique identifier.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    username = models.CharField(max_length=50, unique=True, null=True, blank=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, null=True, blank=True)

    # Status fields
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)

    # Authentication source tracking
    auth_source = models.CharField(
        max_length=20,
        choices=AuthProvider.ProviderType.choices,
        default='LOCAL',
        db_index=True,
        help_text='The authentication provider used for this user'
    )
    external_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        db_index=True,
        help_text='External ID from LDAP/Azure AD'
    )
    is_external_auth = models.BooleanField(
        default=False,
        help_text='User authenticates via external provider'
    )
    can_change_password = models.BooleanField(
        default=True,
        help_text='False for LDAP/Azure AD users'
    )

    # Security fields
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    lockout_until = models.DateTimeField(null=True, blank=True)
    password_changed_at = models.DateTimeField(null=True, blank=True)
    must_change_password = models.BooleanField(default=False)

    # 2FA fields
    class TwoFactorMethod(models.TextChoices):
        TOTP = 'TOTP', 'Authenticator App'
        EMAIL = 'EMAIL', 'Email OTP'
        SMS = 'SMS', 'SMS OTP'

    two_factor_enabled = models.BooleanField(default=False)
    two_factor_method = models.CharField(
        max_length=5,
        choices=TwoFactorMethod.choices,
        default=TwoFactorMethod.EMAIL,
    )
    two_factor_secret = models.CharField(max_length=32, null=True, blank=True)
    backup_codes = models.JSONField(null=True, blank=True)

    # Organization (tenant)
    organization = models.ForeignKey(
        'organization.Organization',
        on_delete=models.CASCADE,
        related_name='users',
        null=True,
        blank=True,
    )

    # Profile
    phone_number = models.CharField(max_length=20, null=True, blank=True)
    # Profile photo stored as binary data
    profile_photo_data = models.BinaryField(null=True, blank=True)
    profile_photo_name = models.CharField(max_length=255, null=True, blank=True)
    profile_photo_mime = models.CharField(max_length=100, null=True, blank=True)

    # Timestamps
    last_login_at = models.DateTimeField(null=True, blank=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f"{self.full_name} ({self.email})"

    @property
    def full_name(self):
        """Return the user's full name."""
        if self.middle_name:
            return f"{self.first_name} {self.middle_name} {self.last_name}"
        return f"{self.first_name} {self.last_name}"

    def is_locked_out(self):
        """Check if the user account is locked."""
        if self.lockout_until and timezone.now() < self.lockout_until:
            return True
        return False

    def increment_failed_login(self):
        """Increment failed login attempts and lock account if threshold reached."""
        self.failed_login_attempts += 1
        max_attempts = settings.HRMS_SETTINGS.get('MAX_FAILED_LOGIN_ATTEMPTS', 5)
        lockout_minutes = settings.HRMS_SETTINGS.get('ACCOUNT_LOCKOUT_DURATION_MINUTES', 30)

        if self.failed_login_attempts >= max_attempts:
            self.lockout_until = timezone.now() + timezone.timedelta(minutes=lockout_minutes)

        self.save(update_fields=['failed_login_attempts', 'lockout_until'])

    def reset_failed_login(self):
        """Reset failed login attempts after successful login."""
        self.failed_login_attempts = 0
        self.lockout_until = None
        self.save(update_fields=['failed_login_attempts', 'lockout_until'])

    def password_needs_change(self):
        """Check if password needs to be changed based on expiry policy."""
        if self.must_change_password:
            return True
        if not self.password_changed_at:
            return False
        expiry_days = settings.HRMS_SETTINGS.get('PASSWORD_EXPIRY_DAYS', 90)
        expiry_date = self.password_changed_at + timezone.timedelta(days=expiry_days)
        return timezone.now() > expiry_date

    def set_profile_photo(self, file_obj):
        """Store profile photo as binary data."""
        import mimetypes
        import hashlib

        if file_obj is None:
            self.profile_photo_data = None
            self.profile_photo_name = None
            self.profile_photo_mime = None
            return

        content = file_obj.read() if hasattr(file_obj, 'read') else file_obj
        self.profile_photo_data = content
        self.profile_photo_name = getattr(file_obj, 'name', 'profile_photo')

        if hasattr(file_obj, 'content_type'):
            self.profile_photo_mime = file_obj.content_type
        else:
            mime_type, _ = mimetypes.guess_type(self.profile_photo_name)
            self.profile_photo_mime = mime_type or 'image/jpeg'

    def get_profile_photo_base64(self):
        """Return profile photo as base64 string."""
        import base64
        if self.profile_photo_data:
            return base64.b64encode(self.profile_photo_data).decode('utf-8')
        return None

    def get_profile_photo_data_uri(self):
        """Return profile photo as data URI."""
        if self.profile_photo_data and self.profile_photo_mime:
            import base64
            b64 = base64.b64encode(self.profile_photo_data).decode('utf-8')
            return f"data:{self.profile_photo_mime};base64,{b64}"
        return None

    @property
    def has_profile_photo(self):
        """Check if user has a profile photo."""
        return self.profile_photo_data is not None


class Role(TimeStampedModel):
    """
    System roles for RBAC.
    """
    VALID_MODULES = [
        'hr', 'payroll', 'payroll_setup', 'finance', 'procurement',
        'inventory', 'projects', 'manufacturing', 'administration',
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    description = models.TextField(null=True, blank=True)
    is_system_role = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    level = models.PositiveSmallIntegerField(default=0)
    district = models.ForeignKey(
        'core.District',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='roles',
        help_text='Optional district scope for location-based roles'
    )
    modules = models.JSONField(
        default=list,
        blank=True,
        help_text='List of module codes this role grants sidebar access to.'
    )

    class Meta:
        db_table = 'roles'
        ordering = ['level', 'name']

    def __str__(self):
        return self.name


class Permission(models.Model):
    """
    Granular permissions for RBAC.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=100, unique=True, db_index=True)
    description = models.TextField(null=True, blank=True)
    module = models.CharField(max_length=50, db_index=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'permissions'
        ordering = ['module', 'name']
        unique_together = ['module', 'code']

    def __str__(self):
        return f"{self.module}.{self.code}"


class RolePermission(models.Model):
    """
    Many-to-many relationship between roles and permissions.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='role_permissions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'role_permissions'
        unique_together = ['role', 'permission']

    def __str__(self):
        return f"{self.role.name} - {self.permission.code}"


class UserRole(TimeStampedModel):
    """
    User role assignments with optional scope (department, region, etc.).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_roles')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='user_roles')

    # Scope fields (for row-level security)
    scope_type = models.CharField(
        max_length=20,
        choices=[
            ('global', 'Global'),
            ('region', 'Region'),
            ('department', 'Department'),
            ('team', 'Team'),
        ],
        default='global'
    )
    scope_id = models.UUIDField(null=True, blank=True)

    is_primary = models.BooleanField(default=False)
    effective_from = models.DateField(default=timezone.now)
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'user_roles'
        ordering = ['-is_primary', 'role__level']

    def __str__(self):
        return f"{self.user.email} - {self.role.name}"

    @property
    def is_effective(self):
        """Check if the role assignment is currently effective."""
        today = timezone.now().date()
        if not self.is_active:
            return False
        if self.effective_from > today:
            return False
        if self.effective_to and self.effective_to < today:
            return False
        return True


class UserOrganization(TimeStampedModel):
    """
    Many-to-many through model linking users to organizations.
    Allows a user to belong to multiple organizations and switch between them.
    """
    class OrgRole(models.TextChoices):
        MEMBER = 'member', 'Member'
        ADMIN = 'admin', 'Admin'
        VIEWER = 'viewer', 'Viewer'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_organizations')
    organization = models.ForeignKey(
        'organization.Organization',
        on_delete=models.CASCADE,
        related_name='organization_users',
    )
    role = models.CharField(
        max_length=50,
        choices=OrgRole.choices,
        default=OrgRole.MEMBER,
    )
    is_default = models.BooleanField(
        default=False,
        help_text='Default organization selected on login',
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_organizations'
        unique_together = ('user', 'organization')
        ordering = ['-is_default', 'organization__name']

    def __str__(self):
        return f"{self.user.email} - {self.organization.name} ({self.role})"

    def save(self, *args, **kwargs):
        # Ensure only one default org per user
        if self.is_default:
            UserOrganization.objects.filter(
                user=self.user,
                is_default=True,
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class UserSession(TimeStampedModel):
    """
    Track user sessions for security and audit.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    session_key = models.CharField(max_length=255, unique=True)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(null=True, blank=True)
    device_info = models.JSONField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    last_activity = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = 'user_sessions'
        ordering = ['-last_activity']

    def __str__(self):
        return f"{self.user.email} - {self.ip_address}"

    def is_expired(self):
        """Check if the session has expired."""
        return timezone.now() > self.expires_at


class PasswordHistory(models.Model):
    """
    Track password history to prevent reuse.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_history')
    password_hash = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'password_history'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.created_at}"


class UserAuthProvider(TimeStampedModel):
    """
    Links users to their authentication providers.
    Supports account linking (same user, multiple providers).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='linked_providers'
    )
    provider = models.ForeignKey(
        AuthProvider,
        on_delete=models.CASCADE,
        related_name='user_links'
    )

    # External identifiers from the provider
    external_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text='Unique ID from external provider (e.g., objectGUID, Azure oid)'
    )
    external_username = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text='Username in external system (e.g., sAMAccountName)'
    )

    # Metadata from external provider
    provider_data = models.JSONField(
        default=dict,
        blank=True,
        help_text='Additional data from the provider'
    )

    # Status
    is_primary = models.BooleanField(
        default=False,
        help_text='Primary authentication method for this user'
    )
    is_active = models.BooleanField(default=True)
    last_login = models.DateTimeField(null=True, blank=True)
    login_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'user_auth_providers'
        unique_together = ['user', 'provider']
        ordering = ['-is_primary', '-last_login']
        verbose_name = 'User Auth Provider Link'
        verbose_name_plural = 'User Auth Provider Links'
        indexes = [
            models.Index(fields=['external_id', 'provider']),
            models.Index(fields=['external_username', 'provider']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.provider.name}"

    def save(self, *args, **kwargs):
        # Ensure only one primary provider per user
        if self.is_primary:
            UserAuthProvider.objects.filter(
                user=self.user,
                is_primary=True
            ).exclude(pk=self.pk).update(is_primary=False)
        super().save(*args, **kwargs)

    def record_login(self):
        """Record a successful login via this provider."""
        self.last_login = timezone.now()
        self.login_count += 1
        self.save(update_fields=['last_login', 'login_count'])


class AuthenticationLog(models.Model):
    """
    Log all authentication events.
    """
    class EventType(models.TextChoices):
        # Local authentication
        LOGIN_SUCCESS = 'LOGIN_SUCCESS', 'Login Success'
        LOGIN_FAILED = 'LOGIN_FAILED', 'Login Failed'
        LOGOUT = 'LOGOUT', 'Logout'
        PASSWORD_CHANGE = 'PASSWORD_CHANGE', 'Password Change'
        PASSWORD_RESET = 'PASSWORD_RESET', 'Password Reset'
        TWO_FACTOR_SUCCESS = '2FA_SUCCESS', '2FA Success'
        TWO_FACTOR_FAILED = '2FA_FAILED', '2FA Failed'
        ACCOUNT_LOCKED = 'ACCOUNT_LOCKED', 'Account Locked'
        ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED', 'Account Unlocked'
        # LDAP authentication
        LDAP_LOGIN_SUCCESS = 'LDAP_SUCCESS', 'LDAP Login Success'
        LDAP_LOGIN_FAILED = 'LDAP_FAILED', 'LDAP Login Failed'
        LDAP_SYNC = 'LDAP_SYNC', 'LDAP User Sync'
        # Azure AD authentication
        AZURE_LOGIN_SUCCESS = 'AZURE_SUCCESS', 'Azure AD Login Success'
        AZURE_LOGIN_FAILED = 'AZURE_FAILED', 'Azure AD Login Failed'
        # Account management
        ACCOUNT_PROVISIONED = 'PROVISIONED', 'Account Auto-Provisioned'
        ACCOUNT_LINKED = 'LINKED', 'Account Linked to Provider'
        PROVIDER_CONFIGURED = 'PROVIDER_CFG', 'Provider Configured'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='auth_logs')
    email = models.EmailField()
    event_type = models.CharField(max_length=20, choices=EventType.choices, db_index=True)
    auth_provider = models.ForeignKey(
        AuthProvider,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='auth_logs',
        help_text='Authentication provider used'
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    location = models.CharField(max_length=200, null=True, blank=True)
    extra_data = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'authentication_logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['event_type', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.event_type} - {self.email} - {self.timestamp}"


class EmailVerificationToken(models.Model):
    """
    Token for email verification during employee signup.
    """
    class TokenType(models.TextChoices):
        SIGNUP = 'SIGNUP', 'Employee Signup'
        EMAIL_CHANGE = 'EMAIL_CHANGE', 'Email Change'
        PASSWORD_RESET = 'PASSWORD_RESET', 'Password Reset'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(db_index=True)
    token = models.CharField(max_length=64, unique=True, db_index=True)
    token_type = models.CharField(
        max_length=20,
        choices=TokenType.choices,
        default=TokenType.SIGNUP
    )
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='verification_tokens'
    )
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'email_verification_tokens'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email', 'token_type']),
            models.Index(fields=['token', 'is_used']),
        ]

    def __str__(self):
        return f"{self.email} - {self.token_type}"

    @property
    def is_expired(self):
        """Check if the token has expired."""
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        """Check if the token is valid (not used and not expired)."""
        return not self.is_used and not self.is_expired

    @classmethod
    def generate_token(cls):
        """Generate a secure random token."""
        import secrets
        return secrets.token_urlsafe(48)

    @classmethod
    def create_signup_token(cls, email, employee, expiry_hours=24):
        """Create a new signup verification token."""
        # Invalidate any existing tokens for this email
        cls.objects.filter(
            email=email,
            token_type=cls.TokenType.SIGNUP,
            is_used=False
        ).update(is_used=True)

        # Create new token
        return cls.objects.create(
            email=email,
            token=cls.generate_token(),
            token_type=cls.TokenType.SIGNUP,
            employee=employee,
            expires_at=timezone.now() + timezone.timedelta(hours=expiry_hours)
        )

    @classmethod
    def create_password_reset_token(cls, email, expiry_hours=1):
        """Create a new password reset token."""
        # Invalidate any existing password reset tokens for this email
        cls.objects.filter(
            email=email,
            token_type=cls.TokenType.PASSWORD_RESET,
            is_used=False
        ).update(is_used=True)

        # Create new token
        return cls.objects.create(
            email=email,
            token=cls.generate_token(),
            token_type=cls.TokenType.PASSWORD_RESET,
            expires_at=timezone.now() + timezone.timedelta(hours=expiry_hours)
        )
