"""
Core app URL configuration.
"""

from django.urls import path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .views import (
    CacheStatsView,
    CacheWarmView,
    CacheClearView,
    LookupDataView,
    AllLookupsView,
    DashboardStatsView,
)

app_name = 'core'


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint."""
    return Response({
        'status': 'healthy',
        'service': 'NHIA HRMS API',
        'version': '1.0.0'
    })


urlpatterns = [
    path('', health_check, name='health-check'),

    # Cache management (admin only)
    path('cache/stats/', CacheStatsView.as_view(), name='cache-stats'),
    path('cache/warm/', CacheWarmView.as_view(), name='cache-warm'),
    path('cache/clear/', CacheClearView.as_view(), name='cache-clear'),

    # Lookup data (cached)
    path('lookups/', AllLookupsView.as_view(), name='all-lookups'),
    path('lookups/<str:lookup_type>/', LookupDataView.as_view(), name='lookup-data'),

    # Dashboard stats (cached)
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
]
