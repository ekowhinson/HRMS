"""
Custom middleware for the HRMS application.
"""

import threading
import logging
import time
import uuid
from django.utils.deprecation import MiddlewareMixin

from core.logging import set_log_context, clear_log_context, request_stats

logger = logging.getLogger('hrms')

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


def get_current_tenant():
    """Get the current tenant from thread-local storage."""
    return getattr(_request_local, 'tenant', None)


def set_current_tenant(tenant):
    """Set the current tenant in thread-local storage."""
    _request_local.tenant = tenant


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
    trace_id (from X-Cloud-Trace-Context for GCP Cloud Trace integration),
    request duration, and emits structured log fields compatible with JSON
    logging in staging/production.

    Also propagates request_id and trace_id into thread-local log context
    so that all loggers (including SQL and Celery) automatically include them.
    """

    EXCLUDED_PATHS = [
        '/healthz/',
        '/readyz/',
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

    def _extract_trace_id(self, request):
        """
        Extract trace_id from GCP's X-Cloud-Trace-Context header.
        Format: TRACE_ID/SPAN_ID;o=TRACE_TRUE
        Falls back to empty string if not present.
        """
        trace_header = request.META.get('HTTP_X_CLOUD_TRACE_CONTEXT', '')
        if trace_header:
            return trace_header.split('/')[0]
        return ''

    def process_request(self, request):
        # Always assign a request_id (used by other middleware / views too)
        request.request_id = (
            request.META.get('HTTP_X_REQUEST_ID') or uuid.uuid4().hex
        )
        request.trace_id = self._extract_trace_id(request)
        request._audit_start = time.monotonic()

        # Propagate into thread-local log context for all downstream loggers
        set_log_context(
            request_id=request.request_id,
            trace_id=request.trace_id,
        )

        if self.should_log(request):
            request._audit_data = {
                'request_id': request.request_id,
                'trace_id': request.trace_id,
                'ip_address': self.get_client_ip(request),
                'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                'method': request.method,
                'path': request.path,
                'query_string': request.META.get('QUERY_STRING', ''),
            }

    def process_response(self, request, response):
        if hasattr(request, '_audit_data') and self.should_log(request):
            duration_ms = round(
                (time.monotonic() - request._audit_start) * 1000, 2
            )

            # Record timing for /api/status/ percentile stats
            request_stats.record(duration_ms)

            audit_data = request._audit_data
            audit_data['status_code'] = response.status_code
            audit_data['duration_ms'] = duration_ms
            audit_data['response_size'] = len(response.content) if hasattr(response, 'content') else 0
            audit_data['content_length'] = request.META.get('CONTENT_LENGTH', 0)

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
                    'event': 'http_request',
                    'request_id': audit_data['request_id'],
                    'trace_id': audit_data.get('trace_id', ''),
                    'user_id': str(user_id) if user_id else '',
                    'method': audit_data['method'],
                    'path': audit_data['path'],
                    'query_string': audit_data.get('query_string', ''),
                    'status_code': audit_data['status_code'],
                    'duration_ms': duration_ms,
                    'response_size': audit_data.get('response_size', 0),
                    'ip_address': audit_data['ip_address'],
                },
            )

        # Inject request_id into response header for client-side correlation
        if hasattr(request, 'request_id'):
            response['X-Request-ID'] = request.request_id

        # Clear thread-local log context
        clear_log_context()

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


class ModuleAccessMiddleware:
    """
    Enforce license-based module access.
    Maps URL prefixes to module names and checks the tenant's active license.
    Superusers bypass all module checks.
    """

    MODULE_URL_MAP = {
        '/api/v1/employees/': 'employees',
        '/api/v1/payroll/': 'payroll',
        '/api/v1/leave/': 'leave',
        '/api/v1/benefits/': 'benefits',
        '/api/v1/performance/': 'performance',
        '/api/v1/recruitment/': 'recruitment',
        '/api/v1/discipline/': 'discipline',
        '/api/v1/training/': 'training',
        '/api/v1/exits/': 'exits',
        '/api/v1/finance/': 'finance',
        '/api/v1/procurement/': 'procurement',
        '/api/v1/inventory/': 'inventory',
        '/api/v1/projects/': 'projects',
        '/api/v1/reports/': 'reports',
        '/api/v1/workflow/': 'workflow',
    }

    SKIP_PREFIXES = [
        '/api/v1/auth/',
        '/api/v1/core/',
        '/api/v1/organization/',
        '/api/v1/accounts/',
        '/admin/',
        '/static/',
        '/media/',
        '/healthz/',
        '/readyz/',
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Skip non-API paths and allowed prefixes
        path = request.path
        if any(path.startswith(prefix) for prefix in self.SKIP_PREFIXES):
            return self.get_response(request)

        # Superusers bypass module checks
        user = getattr(request, 'user', None)
        if user and getattr(user, 'is_superuser', False):
            return self.get_response(request)

        # Determine which module this path maps to
        module_name = None
        for prefix, module in self.MODULE_URL_MAP.items():
            if path.startswith(prefix):
                module_name = module
                break

        if module_name:
            tenant = getattr(request, 'tenant', None)
            if tenant and not tenant.is_module_enabled(module_name):
                import json
                from django.http import JsonResponse
                return JsonResponse(
                    {
                        'error': 'module_disabled',
                        'detail': f'The "{module_name}" module is not enabled for your organization. '
                                  f'Contact your administrator to upgrade your license.',
                    },
                    status=403,
                )

        return self.get_response(request)


class TenantMiddleware:
    """
    Resolve tenant from request and store in thread-local.

    Resolution order:
    1. X-Tenant-ID header (API clients)
    2. Authenticated user's organization
    3. Default organization (single-tenant fallback)
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        tenant = self._resolve_tenant(request)
        set_current_tenant(tenant)
        request.tenant = tenant
        try:
            response = self.get_response(request)
        finally:
            set_current_tenant(None)
        return response

    def _resolve_tenant(self, request):
        from organization.models import Organization

        # 1. Header — verify user is a member of the requested org
        tenant_id = request.META.get('HTTP_X_TENANT_ID')
        if tenant_id:
            try:
                org = Organization.objects.get(id=tenant_id, is_active=True)
                # Verify membership if user is authenticated
                if hasattr(request, 'user') and request.user.is_authenticated:
                    from accounts.models import UserOrganization
                    if UserOrganization.objects.filter(
                        user=request.user,
                        organization=org,
                    ).exists():
                        return org
                    # Superusers can access any org
                    if request.user.is_superuser:
                        return org
                    # Not a member — fall through to user's active org
                else:
                    return org
            except (Organization.DoesNotExist, ValueError):
                pass

        # 2. Authenticated user's active organization
        if hasattr(request, 'user') and request.user.is_authenticated:
            org = getattr(request.user, 'organization', None)
            if org is not None:
                return org

        # 3. Default org (single-tenant backward compatibility)
        try:
            return Organization.objects.filter(is_active=True).first()
        except Exception:
            return None
