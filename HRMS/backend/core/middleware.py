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
    """Get the current user from thread-local storage."""
    return getattr(_request_local, 'user', None)


def get_current_request():
    """Get the current request from thread-local storage."""
    return getattr(_request_local, 'request', None)


class CurrentUserMiddleware(MiddlewareMixin):
    """
    Middleware to store the current request and user in thread-local storage.
    This allows models to access the current user without passing it explicitly.
    """

    def process_request(self, request):
        _request_local.request = request
        _request_local.user = getattr(request, 'user', None)

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
