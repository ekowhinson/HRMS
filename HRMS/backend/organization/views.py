"""
Organization structure views.
"""

from rest_framework import viewsets, generics
from rest_framework.views import APIView
from rest_framework.response import Response

from core.models import Region, District
from core.caching import CachedModelMixin, cached_view
from core.pagination import StandardResultsSetPagination
from .models import (
    Division, Directorate, OrganizationUnit, Department, JobGrade, JobCategory,
    JobPosition, CostCenter, WorkLocation, Holiday
)
from .serializers import (
    DivisionSerializer, DirectorateSerializer, OrganizationUnitSerializer,
    DepartmentSerializer, JobGradeSerializer, JobCategorySerializer,
    JobPositionSerializer, CostCenterSerializer, WorkLocationSerializer,
    HolidaySerializer, RegionSerializer, DistrictSerializer
)


class DivisionViewSet(CachedModelMixin, viewsets.ModelViewSet):
    """ViewSet for Divisions."""
    queryset = Division.objects.select_related('head')
    serializer_class = DivisionSerializer
    filterset_fields = ['is_active']
    search_fields = ['code', 'name']
    ordering = ['sort_order', 'name']
    cache_timeout = 3600
    cache_alias = 'long'
    cache_key_prefix = 'division'

    @cached_view(timeout=3600, key_prefix='org_divisions', vary_on_user=False, vary_on_params=['is_active'])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


class DirectorateViewSet(CachedModelMixin, viewsets.ModelViewSet):
    """ViewSet for Directorates."""
    queryset = Directorate.objects.select_related('division', 'head')
    serializer_class = DirectorateSerializer
    filterset_fields = ['is_active', 'division']
    search_fields = ['code', 'name']
    ordering = ['division__sort_order', 'sort_order', 'name']
    cache_timeout = 3600
    cache_alias = 'long'
    cache_key_prefix = 'directorate'

    @cached_view(timeout=3600, key_prefix='org_directorates', vary_on_user=False, vary_on_params=['is_active', 'division'])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


class OrganizationUnitViewSet(viewsets.ModelViewSet):
    """ViewSet for Organization Units."""
    queryset = OrganizationUnit.objects.select_related('parent', 'region')
    serializer_class = OrganizationUnitSerializer
    filterset_fields = ['unit_type', 'is_active', 'parent']
    search_fields = ['code', 'name']
    ordering = ['level', 'sort_order', 'name']


class DepartmentViewSet(CachedModelMixin, viewsets.ModelViewSet):
    """ViewSet for Departments."""
    queryset = Department.objects.select_related('parent', 'head', 'directorate', 'directorate__division')
    serializer_class = DepartmentSerializer
    filterset_fields = ['is_active', 'parent', 'directorate']
    search_fields = ['code', 'name']
    ordering = ['name']
    cache_timeout = 3600
    cache_alias = 'long'
    cache_key_prefix = 'department'

    @cached_view(timeout=3600, key_prefix='org_departments', vary_on_user=False, vary_on_params=['is_active', 'parent', 'directorate'])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


class JobGradeViewSet(CachedModelMixin, viewsets.ModelViewSet):
    """ViewSet for Job Grades."""
    queryset = JobGrade.objects.all()
    serializer_class = JobGradeSerializer
    filterset_fields = ['is_active', 'is_management']
    ordering = ['level']
    cache_timeout = 3600
    cache_alias = 'long'
    cache_key_prefix = 'jobgrade'

    @cached_view(timeout=3600, key_prefix='org_grades', vary_on_user=False, vary_on_params=['is_active'])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


class JobCategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for Job Categories."""
    queryset = JobCategory.objects.all()
    serializer_class = JobCategorySerializer
    filterset_fields = ['is_active']
    ordering = ['name']

    @cached_view(timeout=3600, key_prefix='org_categories', vary_on_user=False, vary_on_params=['is_active'])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


class JobPositionViewSet(CachedModelMixin, viewsets.ModelViewSet):
    """ViewSet for Job Positions."""
    queryset = JobPosition.objects.select_related('grade', 'category', 'department')
    serializer_class = JobPositionSerializer
    filterset_fields = ['is_active', 'grade', 'department', 'is_supervisor']
    search_fields = ['code', 'title']
    pagination_class = StandardResultsSetPagination
    ordering = ['title']
    cache_timeout = 3600
    cache_alias = 'long'
    cache_key_prefix = 'jobposition'

    @cached_view(timeout=3600, key_prefix='org_positions', vary_on_user=False, vary_on_params=['is_active', 'grade', 'department'])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


class CostCenterViewSet(viewsets.ModelViewSet):
    """ViewSet for Cost Centers."""
    queryset = CostCenter.objects.select_related('organization_unit', 'parent')
    serializer_class = CostCenterSerializer
    filterset_fields = ['is_active']
    search_fields = ['code', 'name']
    ordering = ['code']

    @cached_view(timeout=3600, key_prefix='org_cost_centers', vary_on_user=False, vary_on_params=['is_active'])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


class WorkLocationViewSet(CachedModelMixin, viewsets.ModelViewSet):
    """ViewSet for Work Locations."""
    queryset = WorkLocation.objects.select_related('region', 'organization_unit')
    serializer_class = WorkLocationSerializer
    pagination_class = None  # Lookup data - return all results for dropdowns
    filterset_fields = ['is_active', 'region', 'is_headquarters']
    search_fields = ['code', 'name', 'city']
    ordering = ['name']
    cache_timeout = 3600
    cache_alias = 'long'
    cache_key_prefix = 'worklocation'

    @cached_view(timeout=3600, key_prefix='org_locations', vary_on_user=False, vary_on_params=['is_active', 'region'])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


class HolidayViewSet(viewsets.ModelViewSet):
    """ViewSet for Holidays."""
    queryset = Holiday.objects.select_related('region')
    serializer_class = HolidaySerializer
    filterset_fields = ['year', 'holiday_type', 'region']
    ordering = ['date']


class OrgChartView(APIView):
    """Get organization chart data."""

    @cached_view(timeout=3600, key_prefix='org_chart', vary_on_user=False)
    def get(self, request):
        # Return hierarchical org chart data
        root_units = OrganizationUnit.objects.filter(parent=None, is_active=True)
        data = []
        for unit in root_units:
            data.append(self._build_tree(unit))
        return Response(data)

    def _build_tree(self, unit):
        children = unit.children.filter(is_active=True)
        return {
            'id': str(unit.id),
            'code': unit.code,
            'name': unit.name,
            'unit_type': unit.unit_type,
            'head': unit.head.full_name if unit.head else None,
            'children': [self._build_tree(child) for child in children]
        }


class RegionListView(generics.ListAPIView):
    """List all regions."""
    queryset = Region.objects.filter(is_active=True)
    serializer_class = RegionSerializer

    @cached_view(timeout=3600, key_prefix='org_regions', vary_on_user=False)
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


class DistrictListView(generics.ListAPIView):
    """List districts by region."""
    serializer_class = DistrictSerializer

    def get_queryset(self):
        queryset = District.objects.filter(is_active=True)
        region_id = self.request.query_params.get('region')
        if region_id:
            queryset = queryset.filter(region_id=region_id)
        return queryset

    @cached_view(timeout=3600, key_prefix='org_districts', vary_on_user=False, vary_on_params=['region'])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)
