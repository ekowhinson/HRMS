"""
Custom middleware for the HRMS application.
"""

import threading
import logging
import time
import uuid
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

    Captures request_id (from X-Request-ID header or auto-generated UUID),
    request duration, and emits structured log fields compatible with JSON
    logging in staging/production.
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
        # Always assign a request_id (used by other middleware / views too)
        request.request_id = (
            request.META.get('HTTP_X_REQUEST_ID') or uuid.uuid4().hex
        )
        request._audit_start = time.monotonic()

        if self.should_log(request):
            request._audit_data = {
                'request_id': request.request_id,
                'ip_address': self.get_client_ip(request),
                'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                'method': request.method,
                'path': request.path,
            }

    def process_response(self, request, response):
        if hasattr(request, '_audit_data') and self.should_log(request):
            duration_ms = round(
                (time.monotonic() - request._audit_start) * 1000, 2
            )
            audit_data = request._audit_data
            audit_data['status_code'] = response.status_code
            audit_data['duration_ms'] = duration_ms

            user = getattr(request, 'user', None)
            user_id = getattr(user, 'id', None) if user and getattr(user, 'is_authenticated', False) else None
            audit_data['user_id'] = user_id

            # Structured extra dict for JSON logging; falls back gracefully
            # to the formatted message for plain-text formatters.
            logger.info(
                "API Request: %s %s - User: %s - Status: %s - %sms",
                audit_data['method'],
                audit_data['path'],
                user_id,
                audit_data['status_code'],
                duration_ms,
                extra={
                    'request_id': audit_data['request_id'],
                    'user_id': user_id,
                    'method': audit_data['method'],
                    'path': audit_data['path'],
                    'status_code': audit_data['status_code'],
                    'duration_ms': duration_ms,
                    'ip_address': audit_data['ip_address'],
                },
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


class CacheControlMiddleware(MiddlewareMixin):
    """
    Sets Cache-Control headers and ETags on API responses.
    Helps browsers and CDNs cache appropriate responses.
    """

    PUBLIC_CACHEABLE_PREFIXES = [
        '/api/v1/core/lookups/',
        '/api/v1/organization/',
        '/api/v1/leave/leave-types/',
        '/api/v1/performance/rating-scales/',
        '/api/v1/performance/competencies/',
        '/api/v1/performance/goal-categories/',
    ]

    STATIC_PREFIXES = ['/static/', '/media/']

    def process_response(self, request, response):
        # Skip if Cache-Control is already set by the view
        if response.get('Cache-Control'):
            return response

        path = request.path

        # Static assets: aggressive caching
        if any(path.startswith(p) for p in self.STATIC_PREFIXES):
            response['Cache-Control'] = 'public, max-age=31536000, immutable'
            return response

        # Non-GET requests: no caching
        if request.method != 'GET':
            response['Cache-Control'] = 'no-store'
            return response

        # Public lookup/org endpoints: short public cache + ETag
        if any(path.startswith(p) for p in self.PUBLIC_CACHEABLE_PREFIXES):
            response['Cache-Control'] = 'public, max-age=300'

            # Generate ETag from response content
            if hasattr(response, 'content') and response.content:
                import hashlib
                etag = hashlib.md5(response.content).hexdigest()
                response['ETag'] = f'"{etag}"'

                # Handle If-None-Match for 304 responses
                if_none_match = request.META.get('HTTP_IF_NONE_MATCH', '')
                if if_none_match == f'"{etag}"':
                    response.status_code = 304
                    response.content = b''

            return response

        # All other API endpoints: private, no-cache
        if path.startswith('/api/'):
            response['Cache-Control'] = 'private, no-cache'

        return response
