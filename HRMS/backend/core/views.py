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
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import HttpResponse

from .models import (
    Announcement, AnnouncementTarget, AnnouncementRead, AnnouncementAttachment,
    Attachment, AuditLog, Notification
)
from .serializers import (
    AnnouncementSerializer, AnnouncementListSerializer, AnnouncementCreateSerializer,
    AnnouncementTargetSerializer, AnnouncementReadSerializer,
    AnnouncementAttachmentSerializer, DashboardAnnouncementSerializer,
    AttachmentSerializer, AttachmentListSerializer,
    AuditLogSerializer, NotificationSerializer
)


class EmployeeIDConfigView(APIView):
    """
    Admin endpoint to get/update employee ID generation configuration.
    GET: Return current config (with defaults if none set).
    PUT: Validate and save config.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    DEFAULT_CONFIG = {
        'prefix': 'EMP',
        'suffix': '',
        'next_number': 1,
        'increment': 1,
        'padding': 4,
        'auto_generate': True,
    }

    def get(self, request):
        import json as _json
        from .models import SystemConfiguration

        try:
            config_obj = SystemConfiguration.objects.get(key='employee_id_config')
            config = _json.loads(config_obj.value)
        except SystemConfiguration.DoesNotExist:
            config = self.DEFAULT_CONFIG.copy()

        # Ensure all keys are present (fill in defaults for any missing keys)
        for key, default in self.DEFAULT_CONFIG.items():
            config.setdefault(key, default)

        return Response(config)

    def put(self, request):
        import json as _json
        from .models import SystemConfiguration

        data = request.data

        # Validate fields
        config = {}
        config['prefix'] = str(data.get('prefix', '')).strip()
        config['suffix'] = str(data.get('suffix', '')).strip()

        try:
            config['next_number'] = int(data.get('next_number', 1))
            if config['next_number'] < 1:
                raise ValueError
        except (ValueError, TypeError):
            return Response(
                {'error': 'next_number must be a positive integer'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            config['increment'] = int(data.get('increment', 1))
            if config['increment'] < 1:
                raise ValueError
        except (ValueError, TypeError):
            return Response(
                {'error': 'increment must be a positive integer'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            config['padding'] = int(data.get('padding', 4))
            if config['padding'] < 1 or config['padding'] > 10:
                raise ValueError
        except (ValueError, TypeError):
            return Response(
                {'error': 'padding must be an integer between 1 and 10'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        config['auto_generate'] = bool(data.get('auto_generate', True))

        SystemConfiguration.objects.update_or_create(
            key='employee_id_config',
            defaults={
                'value': _json.dumps(config),
                'value_type': 'json',
                'category': 'employees',
                'description': 'Employee ID auto-generation configuration',
            },
        )

        return Response({
            'message': 'Employee ID configuration saved',
            **config,
        })


class TwoFactorPolicyView(APIView):
    """
    Admin endpoint to get/update org-wide 2FA policy.
    GET: Return current policy values.
    PUT: Update policy values.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        from accounts.tfa_policy import TFAPolicy
        return Response({
            'tfa_enforcement': TFAPolicy.get('tfa_enforcement'),
            'tfa_allowed_methods': TFAPolicy.allowed_methods(),
            'tfa_grace_period_days': TFAPolicy.grace_period_days(),
        })

    def put(self, request):
        import json as _json
        from .models import SystemConfiguration
        from accounts.tfa_policy import TFAPolicy

        data = request.data
        updated = []

        if 'tfa_enforcement' in data:
            val = data['tfa_enforcement']
            if val not in ('optional', 'required', 'required_admins'):
                return Response(
                    {'error': 'tfa_enforcement must be optional, required, or required_admins'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            obj, _ = SystemConfiguration.objects.update_or_create(
                key='tfa_enforcement',
                defaults={'value': val, 'value_type': 'string', 'category': 'security'},
            )
            updated.append('tfa_enforcement')

        if 'tfa_allowed_methods' in data:
            methods = data['tfa_allowed_methods']
            if not isinstance(methods, list) or not all(m in ('EMAIL', 'SMS', 'TOTP') for m in methods):
                return Response(
                    {'error': 'tfa_allowed_methods must be a list containing EMAIL, SMS, and/or TOTP'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not methods:
                return Response(
                    {'error': 'At least one method must be allowed'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            obj, _ = SystemConfiguration.objects.update_or_create(
                key='tfa_allowed_methods',
                defaults={'value': _json.dumps(methods), 'value_type': 'json', 'category': 'security'},
            )
            updated.append('tfa_allowed_methods')

        if 'tfa_grace_period_days' in data:
            try:
                days = int(data['tfa_grace_period_days'])
                if days < 0:
                    raise ValueError
            except (ValueError, TypeError):
                return Response(
                    {'error': 'tfa_grace_period_days must be a non-negative integer'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            obj, _ = SystemConfiguration.objects.update_or_create(
                key='tfa_grace_period_days',
                defaults={'value': str(days), 'value_type': 'integer', 'category': 'security'},
            )
            updated.append('tfa_grace_period_days')

        return Response({
            'message': 'Policy updated',
            'updated': updated,
            'tfa_enforcement': TFAPolicy.get('tfa_enforcement'),
            'tfa_allowed_methods': TFAPolicy.allowed_methods(),
            'tfa_grace_period_days': TFAPolicy.grace_period_days(),
        })


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


# ============================================
# Document Handling Mixins and ViewSets
# ============================================

class DocumentViewSetMixin:
    """
    Mixin for ViewSets that handle document operations.
    Provides upload, download, and delete actions for models using BinaryFileMixin.

    Usage:
        class MyModelViewSet(DocumentViewSetMixin, viewsets.ModelViewSet):
            ...

        # Then the model will have:
        # POST /my-model/{id}/upload_document/
        # GET /my-model/{id}/download_document/
        # DELETE /my-model/{id}/delete_document/
    """

    @action(detail=True, methods=['POST'], parser_classes=[MultiPartParser, FormParser])
    def upload_document(self, request, pk=None):
        """Upload a document to the object."""
        obj = self.get_object()
        file_obj = request.FILES.get('file')

        if not file_obj:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if model has set_file method
        if not hasattr(obj, 'set_file'):
            return Response(
                {'error': 'This model does not support document upload'},
                status=status.HTTP_400_BAD_REQUEST
            )

        obj.set_file(file_obj)
        obj.save()

        return Response({
            'message': 'Document uploaded successfully',
            'file_info': {
                'name': obj.file_name,
                'size': obj.file_size,
                'type': obj.mime_type,
                'checksum': obj.file_checksum,
            }
        })

    @action(detail=True, methods=['GET'])
    def download_document(self, request, pk=None):
        """Download document as file attachment."""
        obj = self.get_object()

        if not hasattr(obj, 'has_file') or not obj.has_file:
            return Response(
                {'error': 'No document attached'},
                status=status.HTTP_404_NOT_FOUND
            )

        response = HttpResponse(
            obj.file_data,
            content_type=obj.mime_type or 'application/octet-stream'
        )
        response['Content-Disposition'] = f'attachment; filename="{obj.file_name}"'
        response['Content-Length'] = obj.file_size

        return response

    @action(detail=True, methods=['DELETE'])
    def delete_document(self, request, pk=None):
        """Remove document from the object."""
        obj = self.get_object()

        if not hasattr(obj, 'set_file'):
            return Response(
                {'error': 'This model does not support document operations'},
                status=status.HTTP_400_BAD_REQUEST
            )

        obj.set_file(None)
        obj.save()

        return Response({'message': 'Document deleted successfully'})


class AttachmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for generic attachments.
    Supports file upload with base64 binary storage.

    Endpoints:
    - GET /attachments/ - List attachments (filter by content_type_name and object_id)
    - POST /attachments/ - Upload new attachment
    - GET /attachments/{id}/ - Get attachment details with file data
    - GET /attachments/{id}/download/ - Download file as attachment
    - DELETE /attachments/{id}/ - Delete attachment
    """
    queryset = Attachment.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['content_type_name', 'object_id', 'attachment_type']
    search_fields = ['file_name', 'description']
    ordering = ['-created_at']
    parser_classes = [MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.action == 'list':
            return AttachmentListSerializer
        return AttachmentSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['GET'])
    def download(self, request, pk=None):
        """Download attachment file."""
        attachment = self.get_object()

        if not attachment.has_file:
            return Response(
                {'error': 'No file attached'},
                status=status.HTTP_404_NOT_FOUND
            )

        response = HttpResponse(
            attachment.file_data,
            content_type=attachment.mime_type or 'application/octet-stream'
        )
        response['Content-Disposition'] = f'attachment; filename="{attachment.file_name}"'
        response['Content-Length'] = attachment.file_size

        return response

    @action(detail=False, methods=['GET'])
    def for_object(self, request):
        """
        Get all attachments for a specific object.
        Query params: content_type_name, object_id
        """
        content_type_name = request.query_params.get('content_type_name')
        object_id = request.query_params.get('object_id')

        if not content_type_name or not object_id:
            return Response(
                {'error': 'content_type_name and object_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        queryset = self.queryset.filter(
            content_type_name=content_type_name,
            object_id=object_id
        )

        serializer = AttachmentListSerializer(queryset, many=True)
        return Response(serializer.data)


# ============================================
# Audit Log ViewSet
# ============================================

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for querying the system audit trail.
    Shows all data change events (CREATE, UPDATE, DELETE) across all models.
    """
    queryset = AuditLog.objects.select_related('user').order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'action': ['exact'],
        'model_name': ['exact'],
        'user': ['exact'],
        'timestamp': ['gte', 'lte'],
    }
    search_fields = ['object_repr', 'model_name']
    ordering_fields = ['timestamp', 'action', 'model_name']
    ordering = ['-timestamp']

    @action(detail=False, methods=['get'])
    def model_names(self, request):
        """Return distinct model names for the filter dropdown."""
        names = (
            AuditLog.objects
            .values_list('model_name', flat=True)
            .distinct()
            .order_by('model_name')
        )
        return Response(list(names))


# ============================================
# Notification ViewSet
# ============================================

class NotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for user notifications.
    Scoped to the current authenticated user only.
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['notification_type', 'is_read']
    ordering = ['-created_at']

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications."""
        count = Notification.objects.filter(
            user=request.user, is_read=False
        ).count()
        return Response({'count': count})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a single notification as read."""
        notification = self.get_object()
        notification.mark_as_read()
        return Response({'message': 'Marked as read'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read for current user."""
        updated = Notification.objects.filter(
            user=request.user, is_read=False
        ).update(is_read=True, read_at=timezone.now())
        return Response({'message': f'{updated} notifications marked as read'})
