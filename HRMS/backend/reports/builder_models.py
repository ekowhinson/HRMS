"""Models for ad-hoc report builder."""

from django.db import models
from django.conf import settings
from core.models import BaseModel


class ReportDefinition(BaseModel):
    """Saved report configuration."""
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    data_source = models.CharField(max_length=100)  # 'app_label.model_name'
    columns = models.JSONField(default=list)  # [{"field": "employee_number", "label": "Emp #", "aggregate": null}]
    filters = models.JSONField(default=list)  # [{"field": "status", "operator": "=", "value": "ACTIVE"}]
    group_by = models.JSONField(default=list)  # ["department__name"]
    aggregations = models.JSONField(default=list)  # [{"field": "basic_salary", "function": "SUM", "label": "Total"}]
    ordering = models.JSONField(default=list)  # ["-basic_salary"]
    chart_config = models.JSONField(default=dict, blank=True)  # {"type": "bar", "x_axis": "...", "y_axis": "..."}
    is_public = models.BooleanField(default=False)
    shared_with_roles = models.ManyToManyField('accounts.Role', blank=True, related_name='shared_reports')
    shared_with_users = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='shared_reports')
    last_run_at = models.DateTimeField(null=True, blank=True)
    run_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.name


class ScheduledReport(BaseModel):
    """Automated report execution schedule."""

    class ScheduleType(models.TextChoices):
        DAILY = 'DAILY', 'Daily'
        WEEKLY = 'WEEKLY', 'Weekly'
        MONTHLY = 'MONTHLY', 'Monthly'
        QUARTERLY = 'QUARTERLY', 'Quarterly'

    class ExportFormat(models.TextChoices):
        CSV = 'CSV', 'CSV'
        EXCEL = 'EXCEL', 'Excel'
        PDF = 'PDF', 'PDF'

    report = models.ForeignKey(ReportDefinition, on_delete=models.CASCADE, related_name='schedules')
    schedule_type = models.CharField(max_length=20, choices=ScheduleType.choices)
    schedule_config = models.JSONField(default=dict)  # {"day_of_week": 1, "hour": 8, "minute": 0}
    recipients = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='report_subscriptions')
    email_recipients = models.JSONField(default=list, blank=True)
    export_format = models.CharField(max_length=10, choices=ExportFormat.choices, default=ExportFormat.CSV)
    is_active = models.BooleanField(default=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    next_run_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.report.name} - {self.schedule_type}"


class ReportExecution(BaseModel):
    """Log of report executions."""

    class Status(models.TextChoices):
        RUNNING = 'RUNNING', 'Running'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    report = models.ForeignKey(ReportDefinition, on_delete=models.CASCADE, related_name='executions')
    executed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='report_executions')
    executed_at = models.DateTimeField(auto_now_add=True)
    parameters = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RUNNING)
    row_count = models.PositiveIntegerField(null=True, blank=True)
    execution_time_ms = models.PositiveIntegerField(null=True, blank=True)
    result_cache_key = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ['-executed_at']

    def __str__(self):
        return f"{self.report.name} - {self.executed_at}"
