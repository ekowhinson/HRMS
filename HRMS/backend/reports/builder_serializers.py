"""Serializers for ad-hoc report builder."""

from rest_framework import serializers
from .builder_models import ReportDefinition, ScheduledReport, ReportExecution


class ReportDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportDefinition
        fields = [
            'id', 'name', 'description', 'data_source', 'columns',
            'filters', 'group_by', 'aggregations', 'ordering',
            'chart_config', 'is_public', 'last_run_at', 'run_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'last_run_at', 'run_count', 'created_at', 'updated_at']


class ScheduledReportSerializer(serializers.ModelSerializer):
    report_name = serializers.CharField(source='report.name', read_only=True)

    class Meta:
        model = ScheduledReport
        fields = [
            'id', 'report', 'report_name', 'schedule_type', 'schedule_config',
            'email_recipients', 'export_format', 'is_active',
            'last_run_at', 'next_run_at', 'created_at',
        ]
        read_only_fields = ['id', 'last_run_at', 'next_run_at', 'created_at']


class ReportExecutionSerializer(serializers.ModelSerializer):
    report_name = serializers.CharField(source='report.name', read_only=True)

    class Meta:
        model = ReportExecution
        fields = [
            'id', 'report', 'report_name', 'executed_by', 'executed_at',
            'parameters', 'status', 'row_count', 'execution_time_ms',
            'error_message', 'created_at',
        ]
        read_only_fields = fields
