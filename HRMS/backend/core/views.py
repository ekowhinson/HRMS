"""
Core views including cache management, lookup data, and announcements endpoints.
"""

from rest_framework import status, viewsets, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from django.core.cache import caches
from django.conf import settings
from django.utils import timezone
from django.db.models import Q

from .caching import (
    CacheManager,
    get_cache,
    CACHE_TIMEOUT_SHORT,
    CACHE_TIMEOUT_MEDIUM,
    CACHE_TIMEOUT_LONG,
)
from .models import (
    Announcement, AnnouncementTarget, AnnouncementRead, AnnouncementAttachment
)
from .serializers import (
    AnnouncementSerializer, AnnouncementListSerializer, AnnouncementCreateSerializer,
    AnnouncementTargetSerializer, AnnouncementReadSerializer,
    AnnouncementAttachmentSerializer, DashboardAnnouncementSerializer
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


# ============================================
# Announcement ViewSets
# ============================================

class AnnouncementViewSet(viewsets.ModelViewSet):
    """
    ViewSet for announcements.
    Supports company-wide and targeted announcements with read tracking.
    """
    queryset = Announcement.objects.prefetch_related('targets', 'attachments')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'category', 'priority', 'is_company_wide']
    search_fields = ['title', 'content', 'summary']
    ordering = ['-pin_to_top', '-published_at', '-created_at']
    lookup_field = 'slug'

    def get_serializer_class(self):
        if self.action == 'list':
            return AnnouncementListSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return AnnouncementCreateSerializer
        return AnnouncementSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        # Admin/HR see all announcements
        if user.is_superuser or user.is_staff:
            return queryset

        hr_roles = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN']
        user_roles = list(user.user_roles.filter(is_active=True).values_list('role__code', flat=True))
        if any(role in hr_roles for role in user_roles):
            return queryset

        # Regular employees see only published announcements targeted to them
        if hasattr(user, 'employee'):
            employee = user.employee
            now = timezone.now()

            # Published and not expired
            base_filter = Q(status=Announcement.Status.PUBLISHED) & (
                Q(expiry_date__isnull=True) | Q(expiry_date__gt=now)
            )

            # Company-wide OR targeted to employee's department/grade/location
            targeting = (
                Q(is_company_wide=True) |
                Q(targets__department=employee.department) |
                Q(targets__grade=employee.grade) |
                Q(targets__work_location=employee.work_location) |
                Q(targets__employment_type=employee.employment_type)
            )

            return queryset.filter(base_filter & targeting).distinct()

        return queryset.none()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def publish(self, request, slug=None):
        """Publish an announcement."""
        announcement = self.get_object()

        if announcement.status == Announcement.Status.PUBLISHED:
            return Response(
                {'error': 'Announcement is already published'},
                status=status.HTTP_400_BAD_REQUEST
            )

        announcement.publish(user=request.user)
        serializer = self.get_serializer(announcement)
        return Response({'message': 'Announcement published', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def archive(self, request, slug=None):
        """Archive an announcement."""
        announcement = self.get_object()
        announcement.status = Announcement.Status.ARCHIVED
        announcement.save()
        return Response({'message': 'Announcement archived'})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, slug=None):
        """Mark announcement as read by current user."""
        announcement = self.get_object()

        if not hasattr(request.user, 'employee'):
            return Response(
                {'error': 'User has no employee record'},
                status=status.HTTP_400_BAD_REQUEST
            )

        read_record, created = AnnouncementRead.objects.get_or_create(
            announcement=announcement,
            employee=request.user.employee
        )

        return Response({
            'message': 'Marked as read',
            'was_new': created
        })

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, slug=None):
        """Acknowledge an announcement."""
        announcement = self.get_object()

        if not announcement.requires_acknowledgement:
            return Response(
                {'error': 'This announcement does not require acknowledgement'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not hasattr(request.user, 'employee'):
            return Response(
                {'error': 'User has no employee record'},
                status=status.HTTP_400_BAD_REQUEST
            )

        read_record, _ = AnnouncementRead.objects.get_or_create(
            announcement=announcement,
            employee=request.user.employee
        )
        read_record.acknowledge()

        return Response({'message': 'Announcement acknowledged'})

    @action(detail=True, methods=['get'])
    def read_stats(self, request, slug=None):
        """Get read statistics for an announcement."""
        announcement = self.get_object()

        reads = announcement.reads.select_related('employee')
        target_employees = announcement.get_target_employees()

        stats = {
            'total_targets': target_employees.count(),
            'total_read': reads.count(),
            'acknowledged': reads.filter(acknowledged=True).count(),
            'unread': target_employees.exclude(
                id__in=reads.values_list('employee_id', flat=True)
            ).count()
        }

        stats['read_percentage'] = round(
            (stats['total_read'] / stats['total_targets'] * 100), 1
        ) if stats['total_targets'] > 0 else 0

        return Response(stats)

    @action(detail=True, methods=['get'])
    def readers(self, request, slug=None):
        """Get list of users who have read an announcement."""
        announcement = self.get_object()
        reads = announcement.reads.select_related('employee').order_by('-read_at')
        serializer = AnnouncementReadSerializer(reads, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_announcements(self, request):
        """Get announcements for current user (employee portal)."""
        queryset = self.get_queryset()
        serializer = AnnouncementListSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Get recent announcements for dashboard widget."""
        queryset = self.get_queryset().filter(
            show_on_dashboard=True
        )[:5]  # Limit to 5 for dashboard
        serializer = DashboardAnnouncementSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def unread(self, request):
        """Get unread announcements for current user."""
        if not hasattr(request.user, 'employee'):
            return Response([])

        employee = request.user.employee
        read_announcement_ids = AnnouncementRead.objects.filter(
            employee=employee
        ).values_list('announcement_id', flat=True)

        queryset = self.get_queryset().exclude(id__in=read_announcement_ids)
        serializer = AnnouncementListSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def pending_acknowledgement(self, request):
        """Get announcements requiring acknowledgement from current user."""
        if not hasattr(request.user, 'employee'):
            return Response([])

        employee = request.user.employee

        # Get acknowledged announcement IDs
        acknowledged_ids = AnnouncementRead.objects.filter(
            employee=employee,
            acknowledged=True
        ).values_list('announcement_id', flat=True)

        queryset = self.get_queryset().filter(
            requires_acknowledgement=True
        ).exclude(id__in=acknowledged_ids)

        serializer = AnnouncementListSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)


class AnnouncementTargetViewSet(viewsets.ModelViewSet):
    """ViewSet for announcement targeting rules."""
    queryset = AnnouncementTarget.objects.select_related(
        'announcement', 'department', 'grade', 'work_location'
    )
    serializer_class = AnnouncementTargetSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['announcement', 'department', 'grade', 'work_location']


class AnnouncementAttachmentViewSet(viewsets.ModelViewSet):
    """ViewSet for announcement attachments."""
    queryset = AnnouncementAttachment.objects.select_related('announcement')
    serializer_class = AnnouncementAttachmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['announcement']
