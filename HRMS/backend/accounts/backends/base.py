"""
Base authentication backend with common functionality.
"""

import logging
from django.contrib.auth.backends import BaseBackend
from django.utils import timezone

logger = logging.getLogger(__name__)


class MultiProviderBackendMixin:
    """
    Common functionality for multi-provider authentication backends.
    """
    provider_type = None  # Override in subclasses: 'LOCAL', 'LDAP', 'AZURE_AD'

    def get_provider(self):
        """Get the enabled provider configuration from database."""
        from accounts.models import AuthProvider
        try:
            return AuthProvider.objects.get(
                provider_type=self.provider_type,
                is_enabled=True
            )
        except AuthProvider.DoesNotExist:
            return None

    def get_or_create_user(self, email, user_data, provider):
        """
        Get existing user or create new one based on provider settings.

        Args:
            email: User's email address
            user_data: Dict with first_name, last_name, external_id, etc.
            provider: AuthProvider instance

        Returns:
            tuple: (user, created) where created is True if user was created
        """
        from accounts.models import User

        user = None
        created = False

        # Try to find existing user by email
        if provider.auto_link_by_email:
            user = User.objects.filter(email__iexact=email).first()
            if user:
                logger.info(f"Found existing user by email: {email}")

        # Auto-provision if enabled and no user found
        if not user and provider.auto_provision_users:
            user = self._create_user(email, user_data, provider)
            created = True
            logger.info(f"Auto-provisioned user: {email}")

        return user, created

    def _create_user(self, email, user_data, provider):
        """Create a new user from external provider data."""
        from accounts.models import User, UserRole

        user = User.objects.create_user(
            email=email,
            password=None,  # No local password for external auth
            first_name=user_data.get('first_name', ''),
            last_name=user_data.get('last_name', ''),
            middle_name=user_data.get('middle_name', ''),
            is_external_auth=True,
            can_change_password=False,
            auth_source=self.provider_type,
            external_id=user_data.get('external_id'),
            is_verified=True,  # External auth users are pre-verified
        )

        # Assign default role if configured
        if provider.default_role:
            UserRole.objects.create(
                user=user,
                role=provider.default_role,
                is_primary=True
            )
            logger.info(f"Assigned default role {provider.default_role.name} to {email}")

        return user

    def link_user_to_provider(self, user, provider, external_id=None, external_username=None, provider_data=None):
        """Create or update UserAuthProvider link."""
        from accounts.models import UserAuthProvider

        link, created = UserAuthProvider.objects.update_or_create(
            user=user,
            provider=provider,
            defaults={
                'external_id': external_id,
                'external_username': external_username,
                'provider_data': provider_data or {},
                'is_active': True,
            }
        )

        # Record login
        link.record_login()

        return link, created

    def link_to_employee(self, user, email):
        """Attempt to link user to existing employee by email."""
        from employees.models import Employee
        from django.db import models

        employee = Employee.objects.filter(
            models.Q(work_email__iexact=email) |
            models.Q(personal_email__iexact=email),
            user__isnull=True
        ).first()

        if employee:
            employee.user = user
            employee.save(update_fields=['user'])
            logger.info(f"Linked user {email} to employee {employee.employee_number}")
            return employee
        return None

    def log_auth_event(self, event_type, email, user=None, provider=None, request=None, extra_data=None):
        """Log an authentication event."""
        from accounts.models import AuthenticationLog

        ip_address = None
        user_agent = None

        if request:
            ip_address = self._get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')

        AuthenticationLog.objects.create(
            user=user,
            email=email,
            event_type=event_type,
            auth_provider=provider,
            ip_address=ip_address,
            user_agent=user_agent,
            extra_data=extra_data
        )

    def _get_client_ip(self, request):
        """Extract client IP from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    def update_user_from_provider(self, user, user_data):
        """Update user fields from provider data if changed."""
        updated_fields = []

        if user_data.get('first_name') and user.first_name != user_data['first_name']:
            user.first_name = user_data['first_name']
            updated_fields.append('first_name')

        if user_data.get('last_name') and user.last_name != user_data['last_name']:
            user.last_name = user_data['last_name']
            updated_fields.append('last_name')

        if user_data.get('external_id') and user.external_id != user_data['external_id']:
            user.external_id = user_data['external_id']
            updated_fields.append('external_id')

        if updated_fields:
            user.save(update_fields=updated_fields)
            logger.info(f"Updated user {user.email} fields: {updated_fields}")

        return updated_fields
