"""
Redis caching utilities for HRMS.
Provides decorators and helper functions for efficient caching.
"""

import hashlib
import json
import logging
from functools import wraps
from typing import Any, Callable, Optional, List, Union

from django.core.cache import caches
from django.conf import settings
from django.db.models import QuerySet

logger = logging.getLogger(__name__)

# Cache aliases
DEFAULT_CACHE = 'default'
PERSISTENT_CACHE = 'persistent'
VOLATILE_CACHE = 'volatile'

# Cache timeouts (seconds)
CACHE_TIMEOUT_SHORT = 60  # 1 minute
CACHE_TIMEOUT_MEDIUM = 300  # 5 minutes
CACHE_TIMEOUT_LONG = 3600  # 1 hour
CACHE_TIMEOUT_DAY = 86400  # 24 hours

# Cache key prefixes for different data types
CACHE_PREFIX_EMPLOYEE = 'emp'
CACHE_PREFIX_ORGANIZATION = 'org'
CACHE_PREFIX_PAYROLL = 'pay'
CACHE_PREFIX_LEAVE = 'leave'
CACHE_PREFIX_DASHBOARD = 'dash'
CACHE_PREFIX_REPORT = 'rpt'
CACHE_PREFIX_LOOKUP = 'lookup'


def get_cache(alias: str = DEFAULT_CACHE):
    """Get cache instance by alias."""
    return caches[alias]


def make_cache_key(*args, prefix: str = '') -> str:
    """
    Generate a consistent cache key from arguments.
    Uses MD5 hash for complex objects to ensure key validity.
    """
    key_parts = [prefix] if prefix else []

    for arg in args:
        if isinstance(arg, (dict, list)):
            # Hash complex objects
            arg_str = json.dumps(arg, sort_keys=True, default=str)
            key_parts.append(hashlib.md5(arg_str.encode()).hexdigest()[:12])
        elif arg is not None:
            key_parts.append(str(arg))

    return ':'.join(key_parts)


def cached_queryset(
    timeout: int = CACHE_TIMEOUT_MEDIUM,
    cache_alias: str = DEFAULT_CACHE,
    key_prefix: str = '',
    vary_on: List[str] = None
):
    """
    Decorator to cache queryset results.

    Usage:
        @cached_queryset(timeout=300, key_prefix='employees')
        def get_active_employees(department_id=None):
            qs = Employee.objects.filter(is_deleted=False)
            if department_id:
                qs = qs.filter(department_id=department_id)
            return qs

    Args:
        timeout: Cache timeout in seconds
        cache_alias: Which cache to use (default, persistent, volatile)
        key_prefix: Prefix for cache key
        vary_on: List of argument names that affect the cache key
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Build cache key from function name and arguments
            cache_key_parts = [key_prefix or func.__name__]

            if vary_on:
                for key in vary_on:
                    if key in kwargs:
                        cache_key_parts.append(f"{key}:{kwargs[key]}")
            else:
                # Include all kwargs in key
                for k, v in sorted(kwargs.items()):
                    cache_key_parts.append(f"{k}:{v}")

            cache_key = make_cache_key(*cache_key_parts)
            cache = get_cache(cache_alias)

            # Try to get from cache
            cached_result = cache.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache HIT: {cache_key}")
                return cached_result

            # Execute function and cache result
            logger.debug(f"Cache MISS: {cache_key}")
            result = func(*args, **kwargs)

            # If result is a QuerySet, evaluate it before caching
            if isinstance(result, QuerySet):
                result = list(result)

            cache.set(cache_key, result, timeout)
            return result

        # Add method to invalidate cache
        wrapper.invalidate = lambda **kwargs: invalidate_cache_key(
            make_cache_key(key_prefix or func.__name__, *[f"{k}:{v}" for k, v in sorted(kwargs.items())]),
            cache_alias
        )

        return wrapper
    return decorator


def cached_property_redis(
    timeout: int = CACHE_TIMEOUT_MEDIUM,
    cache_alias: str = DEFAULT_CACHE,
    key_prefix: str = ''
):
    """
    Decorator for caching expensive property computations.

    Usage:
        class Employee:
            @cached_property_redis(timeout=300, key_prefix='emp_stats')
            def total_leave_balance(self):
                return self.leave_balances.aggregate(total=Sum('balance'))['total']
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(self):
            cache_key = make_cache_key(
                key_prefix or func.__name__,
                self.__class__.__name__,
                getattr(self, 'id', getattr(self, 'pk', id(self)))
            )
            cache = get_cache(cache_alias)

            cached_result = cache.get(cache_key)
            if cached_result is not None:
                return cached_result

            result = func(self)
            cache.set(cache_key, result, timeout)
            return result

        return wrapper
    return decorator


def cached_view(
    timeout: int = CACHE_TIMEOUT_MEDIUM,
    cache_alias: str = DEFAULT_CACHE,
    key_prefix: str = '',
    vary_on_user: bool = True,
    vary_on_params: List[str] = None
):
    """
    Decorator to cache API view responses.

    Usage:
        class EmployeeViewSet(viewsets.ModelViewSet):
            @cached_view(timeout=60, key_prefix='emp_list', vary_on_params=['department'])
            def list(self, request):
                ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(self, request, *args, **kwargs):
            # Build cache key
            cache_key_parts = [key_prefix or func.__name__]

            if vary_on_user and request.user.is_authenticated:
                cache_key_parts.append(f"user:{request.user.id}")

            if vary_on_params:
                for param in vary_on_params:
                    value = request.query_params.get(param)
                    if value:
                        cache_key_parts.append(f"{param}:{value}")

            # Add any URL kwargs
            for k, v in kwargs.items():
                cache_key_parts.append(f"{k}:{v}")

            cache_key = make_cache_key(*cache_key_parts)
            cache = get_cache(cache_alias)

            # Only cache GET requests
            if request.method == 'GET':
                cached_result = cache.get(cache_key)
                if cached_result is not None:
                    logger.debug(f"View cache HIT: {cache_key}")
                    return cached_result

            result = func(self, request, *args, **kwargs)

            if request.method == 'GET':
                logger.debug(f"View cache MISS: {cache_key}")
                cache.set(cache_key, result, timeout)

            return result

        return wrapper
    return decorator


def invalidate_cache_key(key: str, cache_alias: str = DEFAULT_CACHE):
    """Invalidate a specific cache key."""
    cache = get_cache(cache_alias)
    cache.delete(key)
    logger.debug(f"Cache invalidated: {key}")


def invalidate_cache_pattern(pattern: str, cache_alias: str = DEFAULT_CACHE):
    """
    Invalidate all cache keys matching a pattern.
    Note: This only works with Redis backend.
    """
    cache = get_cache(cache_alias)

    if hasattr(cache, 'delete_pattern'):
        cache.delete_pattern(pattern)
        logger.debug(f"Cache pattern invalidated: {pattern}")
    else:
        logger.warning(f"Cache backend doesn't support pattern deletion: {pattern}")


def invalidate_model_cache(model_name: str):
    """
    Invalidate all cache entries for a model.
    Call this after model updates.
    """
    patterns = [
        f"hrms:{model_name}:*",
        f"hrms_persist:{model_name}:*",
        f"hrms_volatile:{model_name}:*",
    ]

    for pattern in patterns:
        invalidate_cache_pattern(pattern)


class CacheManager:
    """
    High-level cache management for common HRMS operations.
    """

    @staticmethod
    def get_organization_structure(force_refresh: bool = False):
        """
        Get cached organization structure (divisions, directorates, departments).
        Cached for 24 hours as this changes rarely.
        """
        cache = get_cache(PERSISTENT_CACHE)
        cache_key = make_cache_key(CACHE_PREFIX_ORGANIZATION, 'structure')

        if not force_refresh:
            cached = cache.get(cache_key)
            if cached:
                return cached

        from organization.models import Division, Directorate, Department

        structure = {
            'divisions': list(Division.objects.filter(is_active=True).values('id', 'code', 'name')),
            'directorates': list(Directorate.objects.filter(is_active=True).values('id', 'code', 'name', 'division_id')),
            'departments': list(Department.objects.filter(is_active=True).values('id', 'code', 'name', 'directorate_id')),
        }

        cache.set(cache_key, structure, CACHE_TIMEOUT_DAY)
        return structure

    @staticmethod
    def get_lookup_data(lookup_type: str, force_refresh: bool = False):
        """
        Get cached lookup data (grades, positions, banks, etc.).
        """
        cache = get_cache(PERSISTENT_CACHE)
        cache_key = make_cache_key(CACHE_PREFIX_LOOKUP, lookup_type)

        if not force_refresh:
            cached = cache.get(cache_key)
            if cached:
                return cached

        data = None

        if lookup_type == 'grades':
            from organization.models import JobGrade
            data = list(JobGrade.objects.filter(is_active=True).values('id', 'code', 'name', 'level'))

        elif lookup_type == 'positions':
            from organization.models import JobPosition
            data = list(JobPosition.objects.filter(is_active=True).values('id', 'code', 'title'))

        elif lookup_type == 'banks':
            from payroll.models import Bank
            data = list(Bank.objects.filter(is_active=True).values('id', 'code', 'name'))

        elif lookup_type == 'leave_types':
            from leave.models import LeaveType
            data = list(LeaveType.objects.filter(is_active=True).values('id', 'code', 'name', 'default_days'))

        elif lookup_type == 'pay_components':
            from payroll.models import PayComponent
            data = list(PayComponent.objects.filter(is_active=True).values('id', 'code', 'name', 'component_type'))

        elif lookup_type == 'staff_categories':
            from payroll.models import StaffCategory
            data = list(StaffCategory.objects.filter(is_active=True).values('id', 'code', 'name'))

        elif lookup_type == 'work_locations':
            from organization.models import WorkLocation
            data = list(WorkLocation.objects.filter(is_active=True).values('id', 'code', 'name'))

        if data is not None:
            cache.set(cache_key, data, CACHE_TIMEOUT_DAY)

        return data

    @staticmethod
    def get_employee_count(department_id: str = None, force_refresh: bool = False) -> int:
        """Get cached employee count."""
        cache = get_cache(VOLATILE_CACHE)
        cache_key = make_cache_key(CACHE_PREFIX_EMPLOYEE, 'count', department_id or 'all')

        if not force_refresh:
            cached = cache.get(cache_key)
            if cached is not None:
                return cached

        from employees.models import Employee

        qs = Employee.objects.filter(is_deleted=False)
        if department_id:
            qs = qs.filter(department_id=department_id)

        count = qs.count()
        cache.set(cache_key, count, CACHE_TIMEOUT_SHORT)
        return count

    @staticmethod
    def get_dashboard_stats(user_id: str = None, force_refresh: bool = False) -> dict:
        """Get cached dashboard statistics."""
        cache = get_cache(VOLATILE_CACHE)
        cache_key = make_cache_key(CACHE_PREFIX_DASHBOARD, 'stats', user_id or 'global')

        if not force_refresh:
            cached = cache.get(cache_key)
            if cached:
                return cached

        from employees.models import Employee
        from leave.models import LeaveRequest
        from django.db.models import Count, Q
        from django.utils import timezone

        today = timezone.now().date()

        stats = {
            'total_employees': Employee.objects.filter(is_deleted=False).count(),
            'active_employees': Employee.objects.filter(is_deleted=False, status='active').count(),
            'pending_leave_requests': LeaveRequest.objects.filter(status='pending').count(),
            'employees_on_leave': LeaveRequest.objects.filter(
                status='approved',
                start_date__lte=today,
                end_date__gte=today
            ).count(),
        }

        cache.set(cache_key, stats, CACHE_TIMEOUT_SHORT)
        return stats

    @staticmethod
    def invalidate_employee_caches():
        """Invalidate all employee-related caches."""
        invalidate_cache_pattern(f"*:{CACHE_PREFIX_EMPLOYEE}:*")
        invalidate_cache_pattern(f"*:{CACHE_PREFIX_DASHBOARD}:*")

    @staticmethod
    def invalidate_organization_caches():
        """Invalidate all organization-related caches."""
        invalidate_cache_pattern(f"*:{CACHE_PREFIX_ORGANIZATION}:*")
        invalidate_cache_pattern(f"*:{CACHE_PREFIX_LOOKUP}:*")

    @staticmethod
    def warm_cache():
        """
        Pre-populate commonly used caches.
        Call this on application startup or after cache flush.
        """
        logger.info("Warming cache...")

        # Warm organization structure
        CacheManager.get_organization_structure(force_refresh=True)

        # Warm lookup data
        for lookup_type in ['grades', 'positions', 'banks', 'leave_types', 'pay_components', 'staff_categories', 'work_locations']:
            CacheManager.get_lookup_data(lookup_type, force_refresh=True)

        # Warm dashboard stats
        CacheManager.get_dashboard_stats(force_refresh=True)

        logger.info("Cache warming complete")


# Signal handlers for cache invalidation
def setup_cache_invalidation_signals():
    """
    Setup Django signals to automatically invalidate caches on model changes.
    Call this in AppConfig.ready()
    """
    from django.db.models.signals import post_save, post_delete

    def invalidate_on_employee_change(sender, **kwargs):
        CacheManager.invalidate_employee_caches()

    def invalidate_on_organization_change(sender, **kwargs):
        CacheManager.invalidate_organization_caches()

    # Import models and connect signals
    try:
        from employees.models import Employee
        from organization.models import Department, Division, Directorate, JobPosition, JobGrade

        post_save.connect(invalidate_on_employee_change, sender=Employee)
        post_delete.connect(invalidate_on_employee_change, sender=Employee)

        for model in [Department, Division, Directorate, JobPosition, JobGrade]:
            post_save.connect(invalidate_on_organization_change, sender=model)
            post_delete.connect(invalidate_on_organization_change, sender=model)

        logger.info("Cache invalidation signals connected")
    except Exception as e:
        logger.warning(f"Failed to setup cache invalidation signals: {e}")
