"""
Core views including cache management and lookup data endpoints.
"""

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.core.cache import caches
from django.conf import settings

from .caching import (
    CacheManager,
    get_cache,
    CACHE_TIMEOUT_SHORT,
    CACHE_TIMEOUT_MEDIUM,
    CACHE_TIMEOUT_LONG,
)


class CacheStatsView(APIView):
    """
    Get cache statistics and status.
    GET /api/v1/cache/stats/
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        try:
            cache = get_cache('default')

            # Try to get cache info (Redis-specific)
            stats = {
                'enabled': settings.CACHES.get('default', {}).get('BACKEND', '').endswith('RedisCache'),
                'backend': settings.CACHES.get('default', {}).get('BACKEND', 'unknown'),
            }

            # Test cache connectivity
            test_key = '_cache_test_'
            cache.set(test_key, 'ok', 10)
            test_result = cache.get(test_key)
            cache.delete(test_key)

            stats['connected'] = test_result == 'ok'
            stats['status'] = 'healthy' if stats['connected'] else 'error'

            return Response(stats)

        except Exception as e:
            return Response({
                'enabled': False,
                'connected': False,
                'status': 'error',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CacheWarmView(APIView):
    """
    Warm (pre-populate) the cache with commonly used data.
    POST /api/v1/cache/warm/
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        try:
            CacheManager.warm_cache()
            return Response({
                'status': 'success',
                'message': 'Cache warmed successfully'
            })
        except Exception as e:
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CacheClearView(APIView):
    """
    Clear all or specific cache entries.
    POST /api/v1/cache/clear/
    Body: {"cache_type": "all" | "employees" | "organization" | "lookups"}
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        cache_type = request.data.get('cache_type', 'all')

        try:
            if cache_type == 'all':
                # Clear all caches
                for alias in ['default', 'persistent', 'volatile']:
                    try:
                        caches[alias].clear()
                    except:
                        pass
                message = 'All caches cleared'

            elif cache_type == 'employees':
                CacheManager.invalidate_employee_caches()
                message = 'Employee caches cleared'

            elif cache_type == 'organization':
                CacheManager.invalidate_organization_caches()
                message = 'Organization caches cleared'

            elif cache_type == 'lookups':
                cache = get_cache('persistent')
                for lookup_type in ['grades', 'positions', 'banks', 'leave_types', 'pay_components', 'staff_categories', 'work_locations']:
                    cache.delete(f"hrms_persist:lookup:{lookup_type}")
                message = 'Lookup caches cleared'

            else:
                return Response({
                    'status': 'error',
                    'message': f'Unknown cache type: {cache_type}'
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'status': 'success',
                'message': message
            })

        except Exception as e:
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LookupDataView(APIView):
    """
    Get cached lookup data for dropdowns and forms.
    GET /api/v1/lookups/{lookup_type}/

    Supported lookup types:
    - grades
    - positions
    - banks
    - leave_types
    - pay_components
    - staff_categories
    - work_locations
    - organization (divisions, directorates, departments)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, lookup_type):
        if lookup_type == 'organization':
            data = CacheManager.get_organization_structure()
        elif lookup_type in ['grades', 'positions', 'banks', 'leave_types', 'pay_components', 'staff_categories', 'work_locations']:
            data = CacheManager.get_lookup_data(lookup_type)
        else:
            return Response({
                'error': f'Unknown lookup type: {lookup_type}'
            }, status=status.HTTP_400_BAD_REQUEST)

        if data is None:
            return Response({
                'error': f'Failed to load lookup data: {lookup_type}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(data)


class AllLookupsView(APIView):
    """
    Get all lookup data in a single request.
    GET /api/v1/lookups/
    Useful for initial page load to minimize API calls.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        lookups = {
            'organization': CacheManager.get_organization_structure(),
            'grades': CacheManager.get_lookup_data('grades'),
            'positions': CacheManager.get_lookup_data('positions'),
            'banks': CacheManager.get_lookup_data('banks'),
            'leave_types': CacheManager.get_lookup_data('leave_types'),
            'pay_components': CacheManager.get_lookup_data('pay_components'),
            'staff_categories': CacheManager.get_lookup_data('staff_categories'),
            'work_locations': CacheManager.get_lookup_data('work_locations'),
        }

        return Response(lookups)


class DashboardStatsView(APIView):
    """
    Get cached dashboard statistics.
    GET /api/v1/dashboard/stats/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stats = CacheManager.get_dashboard_stats(
            user_id=str(request.user.id) if request.user.is_authenticated else None
        )
        return Response(stats)
