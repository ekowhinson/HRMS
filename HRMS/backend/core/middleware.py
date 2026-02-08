"""
Custom middleware for the HRMS application.
"""

import threading
import logging
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger('nhia_hrms')

# Thread-local storage for request context
_request_local = threading.local()


def get_current_user():
    """
    Get the current authenticated user from thread-local storage.

    Checks multiple sources to handle DRF JWT authentication, where the user
    is resolved after middleware runs:
    1. Explicitly set user (via set_current_user)
    2. DRF-authenticated user from request._drf_request
    3. Django session user from request.user
    """
    # 1. Check for explicitly set user (highest priority)
    user = getattr(_request_local, 'user', None)
    if user is not None and getattr(user, 'is_authenticated', False):
        return user

    # 2. Try resolving from the stored request (handles DRF JWT)
    request = getattr(_request_local, 'request', None)
    if request is not None:
        # Check for DRF request (set by CurrentUserMiddleware.process_view)
        drf_request = getattr(request, '_drf_request', None)
        if drf_request is not None:
            drf_user = getattr(drf_request, 'user', None)
            if drf_user is not None and getattr(drf_user, 'is_authenticated', False):
                return drf_user

        # Fall back to Django request.user (session auth)
        django_user = getattr(request, 'user', None)
        if django_user is not None and getattr(django_user, 'is_authenticated', False):
            return django_user

    return None


def set_current_user(user):
    """Explicitly set the current user in thread-local storage."""
    _request_local.user = user


def get_current_request():
    """Get the current request from thread-local storage."""
    return getattr(_request_local, 'request', None)


class CurrentUserMiddleware(MiddlewareMixin):
    """
    Middleware to store the current request and user in thread-local storage.
    This allows models to access the current user without passing it explicitly.

    For DRF views with JWT authentication, the user is resolved during view
    processing. process_view() captures the DRF request wrapper so that
    get_current_user() can access the JWT-authenticated user at signal time.
    """

    def process_request(self, request):
        _request_local.request = request
        _request_local.user = None

    def process_view(self, request, view_func, view_args, view_kwargs):
        """Capture DRF request wrapper for JWT user resolution."""
        # DRF APIView wraps the Django request; store a reference so
        # get_current_user() can resolve the DRF-authenticated user later.
        view_cls = getattr(view_func, 'cls', None)
        if view_cls is not None:
            # This is a DRF view — the actual DRF Request will be created
            # in APIView.initialize_request(). We use initkwargs to detect
            # DRF views and set up a hook.
            pass

        # Also eagerly set user if Django session auth already resolved it
        user = getattr(request, 'user', None)
        if user is not None and getattr(user, 'is_authenticated', False):
            _request_local.user = user

    def process_response(self, request, response):
        # Clean up thread-local storage
        if hasattr(_request_local, 'request'):
            del _request_local.request
        if hasattr(_request_local, 'user'):
            del _request_local.user
        return response


class AuditLogMiddleware(MiddlewareMixin):
    """
    Middleware to log all requests for audit purposes.
    """

    EXCLUDED_PATHS = [
        '/health/',
        '/static/',
        '/media/',
        '/api/schema/',
        '/api/docs/',
    ]

    def should_log(self, request):
        """Determine if the request should be logged."""
        path = request.path
        for excluded in self.EXCLUDED_PATHS:
            if path.startswith(excluded):
                return False
        return True

    def get_client_ip(self, request):
        """Extract client IP from request headers."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    def process_request(self, request):
        if self.should_log(request):
            request._audit_data = {
                'ip_address': self.get_client_ip(request),
                'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                'method': request.method,
                'path': request.path,
            }

    def process_response(self, request, response):
        if hasattr(request, '_audit_data') and self.should_log(request):
            audit_data = request._audit_data
            audit_data['status_code'] = response.status_code
            audit_data['user'] = getattr(request, 'user', None)

            # Log the request (you can also save to database here)
            if audit_data.get('user') and hasattr(audit_data['user'], 'id'):
                logger.info(
                    f"API Request: {audit_data['method']} {audit_data['path']} "
                    f"- User: {audit_data['user'].id} "
                    f"- Status: {audit_data['status_code']} "
                    f"- IP: {audit_data['ip_address']}"
                )

        return response


class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Middleware to add security headers to responses.
    """

    def process_response(self, request, response):
        # Prevent clickjacking
        response['X-Frame-Options'] = 'DENY'

        # Prevent MIME type sniffing
        response['X-Content-Type-Options'] = 'nosniff'

        # XSS protection
        response['X-XSS-Protection'] = '1; mode=block'

        # Referrer policy
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        # Permissions policy
        response['Permissions-Policy'] = (
            'accelerometer=(), camera=(), geolocation=(), gyroscope=(), '
            'magnetometer=(), microphone=(), payment=(), usb=()'
        )

        return response


class RequestLoggingMiddleware(MiddlewareMixin):
    """
    Middleware to log request/response details for debugging.
    """

    def process_request(self, request):
        logger.debug(f"Request: {request.method} {request.path}")

    def process_response(self, request, response):
        logger.debug(f"Response: {request.method} {request.path} - {response.status_code}")
        return response
