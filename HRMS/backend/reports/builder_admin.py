"""Admin for report builder models."""

from django.contrib import admin
from .builder_models import ReportDefinition, ScheduledReport, ReportExecution


@admin.register(ReportDefinition)
class ReportDefinitionAdmin(admin.ModelAdmin):
    list_display = ['name', 'data_source', 'is_public', 'run_count', 'last_run_at', 'created_at']
    list_filter = ['is_public', 'data_source']
    search_fields = ['name', 'description']


@admin.register(ScheduledReport)
class ScheduledReportAdmin(admin.ModelAdmin):
    list_display = ['report', 'schedule_type', 'export_format', 'is_active', 'last_run_at', 'next_run_at']
    list_filter = ['schedule_type', 'is_active', 'export_format']


@admin.register(ReportExecution)
class ReportExecutionAdmin(admin.ModelAdmin):
    list_display = ['report', 'executed_by', 'executed_at', 'status', 'row_count', 'execution_time_ms']
    list_filter = ['status']
