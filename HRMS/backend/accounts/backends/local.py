"""
Local (email/password) authentication backend.
"""

import logging
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend

from .base import MultiProviderBackendMixin

logger = logging.getLogger(__name__)
User = get_user_model()


class LocalAuthBackend(MultiProviderBackendMixin, ModelBackend):
    """
    Local authentication backend using email and password.
    Enhanced version of Django's ModelBackend with provider tracking.
    """
    provider_type = 'LOCAL'

    def authenticate(self, request, username=None, password=None, email=None, **kwargs):
        """
        Authenticate user with email/password.

        Args:
            request: HTTP request
            username: Email address (for compatibility)
            password: Password
            email: Email address (alternative to username)
        """
        # Support both 'username' and 'email' parameters
        email = email or username
        if not email or not password:
            return None

        provider = self.get_provider()
        if not provider:
            logger.warning("LOCAL authentication provider not enabled")
            return None

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Run the default password hasher to mitigate timing attacks
            User().set_password(password)
            self.log_auth_event(
                'LOGIN_FAILED',
                email,
                provider=provider,
                request=request,
                extra_data={'reason': 'User not found'}
            )
            return None

        # Check if user can authenticate locally
        if user.is_external_auth and not user.can_change_password:
            logger.warning(f"External auth user {email} attempted local login")
            self.log_auth_event(
                'LOGIN_FAILED',
                email,
                user=user,
                provider=provider,
                request=request,
                extra_data={'reason': 'External auth user cannot login locally'}
            )
            return None

        # Check if account is locked
        if user.is_locked_out():
            self.log_auth_event(
                'LOGIN_FAILED',
                email,
                user=user,
                provider=provider,
                request=request,
                extra_data={'reason': 'Account locked'}
            )
            return None

        # Verify password
        if not user.check_password(password):
            user.increment_failed_login()
            self.log_auth_event(
                'LOGIN_FAILED',
                email,
                user=user,
                provider=provider,
                request=request,
                extra_data={'reason': 'Invalid password', 'attempts': user.failed_login_attempts}
            )
            return None

        # Check if user is active
        if not self.user_can_authenticate(user):
            self.log_auth_event(
                'LOGIN_FAILED',
                email,
                user=user,
                provider=provider,
                request=request,
                extra_data={'reason': 'User inactive'}
            )
            return None

        # Successful authentication
        user.reset_failed_login()

        # Update auth source if needed
        if user.auth_source != 'LOCAL':
            user.auth_source = 'LOCAL'
            user.save(update_fields=['auth_source'])

        # Link to provider
        self.link_user_to_provider(user, provider)

        self.log_auth_event(
            'LOGIN_SUCCESS',
            email,
            user=user,
            provider=provider,
            request=request
        )

        logger.info(f"Local authentication successful for {email}")
        return user

    def get_user(self, user_id):
        """Get user by ID."""
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
