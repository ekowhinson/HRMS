"""
Serializers for organization app.
"""

from rest_framework import serializers

from core.models import Region, District
from .models import (
    Division, Directorate, OrganizationUnit, Department, JobGrade, JobCategory,
    JobPosition, CostCenter, WorkLocation, Holiday
)


class RegionSerializer(serializers.ModelSerializer):
    """Serializer for Region model."""

    class Meta:
        model = Region
        fields = ['id', 'code', 'name', 'country', 'is_active']


class DistrictSerializer(serializers.ModelSerializer):
    """Serializer for District model."""
    region_name = serializers.CharField(source='region.name', read_only=True)

    class Meta:
        model = District
        fields = ['id', 'code', 'name', 'region', 'region_name', 'is_active']


class DivisionSerializer(serializers.ModelSerializer):
    """Serializer for Division model."""
    head_name = serializers.CharField(source='head.full_name', read_only=True)

    class Meta:
        model = Division
        fields = [
            'id', 'code', 'name', 'short_name', 'description',
            'head', 'head_name', 'sort_order', 'is_active'
        ]


class DirectorateSerializer(serializers.ModelSerializer):
    """Serializer for Directorate model."""
    division_name = serializers.CharField(source='division.name', read_only=True)
    head_name = serializers.CharField(source='head.full_name', read_only=True)
    full_path = serializers.ReadOnlyField()

    class Meta:
        model = Directorate
        fields = [
            'id', 'code', 'name', 'short_name', 'division', 'division_name',
            'description', 'head', 'head_name', 'sort_order', 'is_active', 'full_path'
        ]


class OrganizationUnitSerializer(serializers.ModelSerializer):
    """Serializer for OrganizationUnit model."""
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    full_path = serializers.ReadOnlyField()

    class Meta:
        model = OrganizationUnit
        fields = [
            'id', 'code', 'name', 'short_name', 'unit_type', 'parent', 'parent_name',
            'region', 'head', 'cost_center_code', 'description', 'address', 'phone', 'email',
            'level', 'sort_order', 'is_active', 'effective_from', 'effective_to', 'full_path'
        ]


class DepartmentSerializer(serializers.ModelSerializer):
    """Serializer for Department model."""
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    head_name = serializers.CharField(source='head.full_name', read_only=True)
    directorate_name = serializers.CharField(source='directorate.name', read_only=True)
    full_path = serializers.ReadOnlyField()

    class Meta:
        model = Department
        fields = [
            'id', 'code', 'name', 'short_name', 'directorate', 'directorate_name',
            'parent', 'parent_name', 'head', 'head_name', 'cost_center_code',
            'description', 'is_active', 'full_path'
        ]


class JobGradeSerializer(serializers.ModelSerializer):
    """Serializer for JobGrade model."""
    salary_band_name = serializers.CharField(source='salary_band.name', read_only=True, allow_null=True)
    salary_band_code = serializers.CharField(source='salary_band.code', read_only=True, allow_null=True)
    salary_level_name = serializers.CharField(source='salary_level.name', read_only=True, allow_null=True)
    salary_level_code = serializers.CharField(source='salary_level.code', read_only=True, allow_null=True)

    class Meta:
        model = JobGrade
        fields = [
            'id', 'code', 'name', 'level', 'description',
            'salary_band', 'salary_band_name', 'salary_band_code',
            'salary_level', 'salary_level_name', 'salary_level_code',
            'min_salary', 'max_salary', 'mid_salary',
            'annual_leave_days', 'sick_leave_days',
            'is_management', 'is_active'
        ]


class JobCategorySerializer(serializers.ModelSerializer):
    """Serializer for JobCategory model."""

    class Meta:
        model = JobCategory
        fields = ['id', 'code', 'name', 'description', 'is_active']


class JobPositionSerializer(serializers.ModelSerializer):
    """Serializer for JobPosition model."""
    grade_name = serializers.CharField(source='grade.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    current_headcount = serializers.ReadOnlyField()
    vacancy_count = serializers.ReadOnlyField()

    class Meta:
        model = JobPosition
        fields = [
            'id', 'code', 'title', 'short_title', 'grade', 'grade_name',
            'category', 'category_name', 'department', 'department_name',
            'reports_to', 'description', 'responsibilities', 'requirements',
            'headcount_budget', 'current_headcount', 'vacancy_count',
            'is_supervisor', 'is_active'
        ]


class CostCenterSerializer(serializers.ModelSerializer):
    """Serializer for CostCenter model."""

    class Meta:
        model = CostCenter
        fields = [
            'id', 'code', 'name', 'description', 'organization_unit',
            'parent', 'manager', 'budget_amount', 'fiscal_year', 'is_active'
        ]


class WorkLocationSerializer(serializers.ModelSerializer):
    """Serializer for WorkLocation model."""
    region_name = serializers.CharField(source='region.name', read_only=True)

    class Meta:
        model = WorkLocation
        fields = [
            'id', 'code', 'name', 'address', 'city', 'region', 'region_name',
            'organization_unit', 'latitude', 'longitude', 'phone',
            'is_headquarters', 'is_active'
        ]


class HolidaySerializer(serializers.ModelSerializer):
    """Serializer for Holiday model."""
    region_name = serializers.CharField(source='region.name', read_only=True)

    class Meta:
        model = Holiday
        fields = [
            'id', 'name', 'date', 'holiday_type', 'region', 'region_name',
            'description', 'is_paid', 'year'
        ]
