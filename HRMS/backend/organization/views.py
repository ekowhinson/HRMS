"""
Organization structure views.
"""

from rest_framework import viewsets, generics
from rest_framework.views import APIView
from rest_framework.response import Response

from core.models import Region, District
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


class DivisionViewSet(viewsets.ModelViewSet):
    """ViewSet for Divisions."""
    queryset = Division.objects.select_related('head')
    serializer_class = DivisionSerializer
    filterset_fields = ['is_active']
    search_fields = ['code', 'name']
    ordering = ['sort_order', 'name']


class DirectorateViewSet(viewsets.ModelViewSet):
    """ViewSet for Directorates."""
    queryset = Directorate.objects.select_related('division', 'head')
    serializer_class = DirectorateSerializer
    filterset_fields = ['is_active', 'division']
    search_fields = ['code', 'name']
    ordering = ['division__sort_order', 'sort_order', 'name']


class OrganizationUnitViewSet(viewsets.ModelViewSet):
    """ViewSet for Organization Units."""
    queryset = OrganizationUnit.objects.select_related('parent', 'region')
    serializer_class = OrganizationUnitSerializer
    filterset_fields = ['unit_type', 'is_active', 'parent']
    search_fields = ['code', 'name']
    ordering = ['level', 'sort_order', 'name']


class DepartmentViewSet(viewsets.ModelViewSet):
    """ViewSet for Departments."""
    queryset = Department.objects.select_related('parent', 'head', 'directorate', 'directorate__division')
    serializer_class = DepartmentSerializer
    filterset_fields = ['is_active', 'parent', 'directorate']
    search_fields = ['code', 'name']
    ordering = ['name']


class JobGradeViewSet(viewsets.ModelViewSet):
    """ViewSet for Job Grades."""
    queryset = JobGrade.objects.all()
    serializer_class = JobGradeSerializer
    filterset_fields = ['is_active', 'is_management']
    ordering = ['level']


class JobCategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for Job Categories."""
    queryset = JobCategory.objects.all()
    serializer_class = JobCategorySerializer
    filterset_fields = ['is_active']
    ordering = ['name']


class JobPositionViewSet(viewsets.ModelViewSet):
    """ViewSet for Job Positions."""
    queryset = JobPosition.objects.select_related('grade', 'category', 'department')
    serializer_class = JobPositionSerializer
    filterset_fields = ['is_active', 'grade', 'department', 'is_supervisor']
    search_fields = ['code', 'title']
    ordering = ['grade__level', 'title']


class CostCenterViewSet(viewsets.ModelViewSet):
    """ViewSet for Cost Centers."""
    queryset = CostCenter.objects.select_related('organization_unit', 'parent')
    serializer_class = CostCenterSerializer
    filterset_fields = ['is_active']
    search_fields = ['code', 'name']
    ordering = ['code']


class WorkLocationViewSet(viewsets.ModelViewSet):
    """ViewSet for Work Locations."""
    queryset = WorkLocation.objects.select_related('region', 'organization_unit')
    serializer_class = WorkLocationSerializer
    filterset_fields = ['is_active', 'region', 'is_headquarters']
    search_fields = ['code', 'name', 'city']
    ordering = ['name']


class HolidayViewSet(viewsets.ModelViewSet):
    """ViewSet for Holidays."""
    queryset = Holiday.objects.select_related('region')
    serializer_class = HolidaySerializer
    filterset_fields = ['year', 'holiday_type', 'region']
    ordering = ['date']


class OrgChartView(APIView):
    """Get organization chart data."""

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


class DistrictListView(generics.ListAPIView):
    """List districts by region."""
    serializer_class = DistrictSerializer

    def get_queryset(self):
        queryset = District.objects.filter(is_active=True)
        region_id = self.request.query_params.get('region')
        if region_id:
            queryset = queryset.filter(region_id=region_id)
        return queryset
