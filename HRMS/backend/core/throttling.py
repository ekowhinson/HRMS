"""
Custom throttle classes for rate limiting critical endpoints.
"""

from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """Rate limit login attempts."""
    scope = 'login'


class PasswordResetRateThrottle(AnonRateThrottle):
    """Rate limit password reset requests."""
    scope = 'password_reset'


class ApplicationSubmitRateThrottle(AnonRateThrottle):
    """Rate limit public application submissions."""
    scope = 'application_submit'


class PortalLoginRateThrottle(AnonRateThrottle):
    """Rate limit applicant portal login attempts."""
    scope = 'portal_login'
