"""
Admin configuration for organization app.
"""

from django.contrib import admin
from .models import (
    Organization, License,
    Division, Directorate, OrganizationUnit, Department,
    JobGrade, JobCategory, JobPosition, CostCenter,
    WorkLocation, Holiday
)


class LicenseInline(admin.TabularInline):
    model = License
    extra = 0
    fields = ['license_key', 'license_type', 'max_users', 'max_employees', 'valid_from', 'valid_until', 'is_active']
    readonly_fields = ['license_key']


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'subscription_plan', 'max_users', 'max_employees', 'is_active', 'setup_completed']
    list_filter = ['subscription_plan', 'is_active', 'setup_completed']
    search_fields = ['code', 'name', 'slug']
    ordering = ['name']
    inlines = [LicenseInline]
    fieldsets = (
        (None, {'fields': ('name', 'code', 'slug', 'is_active')}),
        ('Subscription', {'fields': ('subscription_plan', 'max_employees', 'max_users', 'trial_expires_at', 'modules_enabled')}),
        ('Configuration', {'fields': ('country', 'currency', 'currency_symbol', 'timezone', 'date_format')}),
        ('Contact', {'fields': ('email_domain', 'website', 'address', 'phone', 'from_email')}),
    )


@admin.register(License)
class LicenseAdmin(admin.ModelAdmin):
    list_display = ['license_key', 'organization', 'license_type', 'max_users', 'max_employees', 'valid_from', 'valid_until', 'is_active']
    list_filter = ['license_type', 'is_active']
    search_fields = ['license_key', 'organization__name', 'organization__code']
    raw_id_fields = ['organization', 'issued_by']
    readonly_fields = ['license_key', 'created_at', 'updated_at']
    ordering = ['-valid_from']


# Division and Directorate (Organization Hierarchy)
class DirectorateInline(admin.TabularInline):
    model = Directorate
    extra = 0
    fields = ['code', 'name', 'short_name', 'sort_order', 'is_active']


@admin.register(Division)
class DivisionAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'short_name', 'head', 'sort_order', 'is_active']
    list_filter = ['is_active']
    search_fields = ['code', 'name']
    ordering = ['sort_order', 'name']
    raw_id_fields = ['head']
    inlines = [DirectorateInline]


class DepartmentInline(admin.TabularInline):
    model = Department
    extra = 0
    fields = ['code', 'name', 'short_name', 'is_active']


@admin.register(Directorate)
class DirectorateAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'division', 'head', 'sort_order', 'is_active']
    list_filter = ['division', 'is_active']
    search_fields = ['code', 'name', 'division__name']
    ordering = ['division__sort_order', 'sort_order', 'name']
    raw_id_fields = ['division', 'head']
    inlines = [DepartmentInline]


# Organization Units
@admin.register(OrganizationUnit)
class OrganizationUnitAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'unit_type', 'parent', 'level', 'is_active']
    list_filter = ['unit_type', 'is_active', 'region']
    search_fields = ['code', 'name']
    ordering = ['level', 'sort_order', 'name']
    raw_id_fields = ['parent', 'region', 'head']


# Department
@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'directorate', 'head', 'is_active']
    list_filter = ['directorate__division', 'directorate', 'is_active']
    search_fields = ['code', 'name', 'directorate__name']
    ordering = ['name']
    raw_id_fields = ['directorate', 'organization_unit', 'parent', 'head']


# Job Structure
@admin.register(JobGrade)
class JobGradeAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'level', 'min_salary', 'max_salary', 'is_management', 'is_active']
    list_filter = ['is_management', 'is_active']
    search_fields = ['code', 'name']
    ordering = ['level']


@admin.register(JobCategory)
class JobCategoryAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'is_active']
    list_filter = ['is_active']
    search_fields = ['code', 'name']
    ordering = ['name']


@admin.register(JobPosition)
class JobPositionAdmin(admin.ModelAdmin):
    list_display = ['code', 'title', 'grade', 'category', 'department', 'is_supervisor', 'is_active']
    list_filter = ['grade', 'category', 'is_supervisor', 'is_active']
    search_fields = ['code', 'title', 'department__name']
    ordering = ['grade__level', 'title']
    raw_id_fields = ['grade', 'category', 'department', 'reports_to']


# Cost Centers
@admin.register(CostCenter)
class CostCenterAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'organization_unit', 'manager', 'is_active']
    list_filter = ['is_active']
    search_fields = ['code', 'name']
    ordering = ['code']
    raw_id_fields = ['organization_unit', 'parent', 'manager']


# Work Locations
@admin.register(WorkLocation)
class WorkLocationAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'city', 'region', 'is_headquarters', 'is_active']
    list_filter = ['region', 'is_headquarters', 'is_active']
    search_fields = ['code', 'name', 'city']
    ordering = ['name']
    raw_id_fields = ['region', 'organization_unit']


# Holidays
@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ['name', 'date', 'holiday_type', 'year', 'is_paid']
    list_filter = ['holiday_type', 'year', 'is_paid']
    search_fields = ['name']
    date_hierarchy = 'date'
    ordering = ['date']
