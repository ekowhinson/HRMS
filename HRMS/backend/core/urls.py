"""
Core app URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .health import system_status
from .views import (
    EmployeeIDConfigView,
    TwoFactorPolicyView,
    CacheStatsView,
    CacheWarmView,
    CacheClearView,
    LookupDataView,
    AllLookupsView,
    DashboardStatsView,
    AnnouncementViewSet,
    AnnouncementTargetViewSet,
    AnnouncementAttachmentViewSet,
    AttachmentViewSet,
    AuditLogViewSet,
    NotificationViewSet,
    TaskStatusView,
    TaskDownloadView,
)

app_name = 'core'

# Announcement routes
router = DefaultRouter()
router.register(r'announcements', AnnouncementViewSet, basename='announcement')
router.register(r'announcement-targets', AnnouncementTargetViewSet, basename='announcement-target')
router.register(r'announcement-attachments', AnnouncementAttachmentViewSet, basename='announcement-attachment')

# Generic attachments
router.register(r'attachments', AttachmentViewSet, basename='attachment')

# Audit logs
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')

# Notifications
router.register(r'notifications', NotificationViewSet, basename='notification')


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint."""
    return Response({
        'status': 'healthy',
        'service': 'HRMS API',
        'version': '1.0.0'
    })


urlpatterns = [
    path('', health_check, name='health-check'),

    # System status (admin only — detailed observability)
    path('status/', system_status, name='system-status'),

    # Employee ID configuration (admin only)
    path('employee-id-config/', EmployeeIDConfigView.as_view(), name='employee-id-config'),

    # 2FA policy (admin only)
    path('2fa-policy/', TwoFactorPolicyView.as_view(), name='2fa-policy'),

    # Cache management (admin only)
    path('cache/stats/', CacheStatsView.as_view(), name='cache-stats'),
    path('cache/warm/', CacheWarmView.as_view(), name='cache-warm'),
    path('cache/clear/', CacheClearView.as_view(), name='cache-clear'),

    # Lookup data (cached)
    path('lookups/', AllLookupsView.as_view(), name='all-lookups'),
    path('lookups/<str:lookup_type>/', LookupDataView.as_view(), name='lookup-data'),

    # Dashboard stats (cached)
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),

    # Async task status & download
    path('tasks/<str:task_id>/status/', TaskStatusView.as_view(), name='task-status'),
    path('tasks/<str:task_id>/download/', TaskDownloadView.as_view(), name='task-download'),

    # Announcements
    path('', include(router.urls)),
]
