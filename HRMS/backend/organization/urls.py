"""
Organization structure URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views
from .tenant_views import TenantSetupViewSet, TenantConfigViewSet

app_name = 'organization'

router = DefaultRouter()
router.register(r'divisions', views.DivisionViewSet, basename='division')
router.register(r'directorates', views.DirectorateViewSet, basename='directorate')
router.register(r'units', views.OrganizationUnitViewSet, basename='organization-unit')
router.register(r'departments', views.DepartmentViewSet, basename='department')
router.register(r'grades', views.JobGradeViewSet, basename='job-grade')
router.register(r'categories', views.JobCategoryViewSet, basename='job-category')
router.register(r'positions', views.JobPositionViewSet, basename='job-position')
router.register(r'cost-centers', views.CostCenterViewSet, basename='cost-center')
router.register(r'locations', views.WorkLocationViewSet, basename='work-location')
router.register(r'holidays', views.HolidayViewSet, basename='holiday')

# Tenant administration
router.register(r'tenants', TenantSetupViewSet, basename='tenant')

urlpatterns = [
    path('', include(router.urls)),

    # Org chart
    path('chart/', views.OrgChartView.as_view(), name='org-chart'),

    # Reference data
    path('regions/', views.RegionListView.as_view(), name='region-list'),
    path('districts/', views.DistrictListView.as_view(), name='district-list'),

    # Tenant config (current tenant)
    path('tenant/config/', TenantConfigViewSet.as_view({
        'get': 'list',
        'put': 'create',
    }), name='tenant-config'),
    path('tenant/config/branding/', TenantConfigViewSet.as_view({
        'post': 'branding',
    }), name='tenant-branding'),
]
