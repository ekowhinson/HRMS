"""
Custom DRF authentication classes that update thread-local user storage.

When using JWT authentication, DRF resolves the user during view processing
(after Django middleware has already run). This module wraps the standard
authentication classes to also update the thread-local so that audit signals
and other code can access the authenticated user.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.authentication import SessionAuthentication as BaseSessionAuthentication

from .middleware import set_current_user


class AuditJWTAuthentication(JWTAuthentication):
    """JWT authentication that updates thread-local user for audit logging."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, token = result
            set_current_user(user)
        return result


class AuditSessionAuthentication(BaseSessionAuthentication):
    """Session authentication that updates thread-local user for audit logging."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, _ = result
            set_current_user(user)
        return result
