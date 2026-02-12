"""Models for tenant backup and restore system."""

import uuid
from django.db import models
from django.conf import settings
from .models import UUIDModel, TimeStampedModel


class TenantBackup(UUIDModel, TimeStampedModel):
    """
    A point-in-time snapshot of all data belonging to one Organization.
    Does NOT inherit BaseModel (no tenant FK on itself - it's a system-level record).
    """

    class BackupType(models.TextChoices):
        FULL = 'FULL', 'Full'
        SELECTIVE = 'SELECTIVE', 'Selective'
        INCREMENTAL = 'INCREMENTAL', 'Incremental'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'
        EXPIRED = 'EXPIRED', 'Expired'
        RESTORING = 'RESTORING', 'Restoring'

    organization = models.ForeignKey(
        'organization.Organization',
        on_delete=models.CASCADE,
        related_name='backups',
    )
    backup_number = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # Backup scope
    backup_type = models.CharField(max_length=20, choices=BackupType.choices, default=BackupType.FULL)
    modules_included = models.JSONField(default=list)

    # Status tracking
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    progress_percent = models.SmallIntegerField(default=0)
    progress_detail = models.CharField(max_length=255, blank=True)

    # File storage
    file_data = models.BinaryField(null=True, blank=True)
    file_path = models.CharField(max_length=500, blank=True)
    file_size_bytes = models.BigIntegerField(null=True, blank=True)
    file_checksum = models.CharField(max_length=64, blank=True)
    file_format = models.CharField(max_length=20, default='json.gz')

    # Metadata
    record_counts = models.JSONField(default=dict)
    total_records = models.PositiveIntegerField(default=0)
    tables_included = models.JSONField(default=list)
    django_version = models.CharField(max_length=20, blank=True)
    schema_version = models.CharField(max_length=64, blank=True)

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    # Lifecycle
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_backups',
    )
    retention_days = models.PositiveIntegerField(default=90)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_locked = models.BooleanField(default=False)

    class Meta:
        db_table = 'tenant_backups'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', '-created_at']),
            models.Index(fields=['status']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f"{self.backup_number} - {self.organization.name}"


class TenantRestore(UUIDModel, TimeStampedModel):
    """Log of restore operations performed from a backup."""

    class RestoreType(models.TextChoices):
        FULL = 'FULL', 'Full'
        SELECTIVE = 'SELECTIVE', 'Selective'
        MERGE = 'MERGE', 'Merge'
        REPLACE = 'REPLACE', 'Replace'

    class RestoreMode(models.TextChoices):
        OVERWRITE = 'OVERWRITE', 'Overwrite'
        SKIP_EXISTING = 'SKIP_EXISTING', 'Skip Existing'
        MERGE = 'MERGE', 'Merge'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PRE_BACKUP = 'PRE_BACKUP', 'Creating Safety Backup'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'
        ROLLED_BACK = 'ROLLED_BACK', 'Rolled Back'

    organization = models.ForeignKey(
        'organization.Organization',
        on_delete=models.CASCADE,
        related_name='restores',
    )
    backup = models.ForeignKey(TenantBackup, on_delete=models.CASCADE, related_name='restores')
    restore_number = models.CharField(max_length=100, unique=True)

    # Restore scope
    restore_type = models.CharField(max_length=20, choices=RestoreType.choices, default=RestoreType.FULL)
    modules_restored = models.JSONField(default=list)
    restore_mode = models.CharField(max_length=20, choices=RestoreMode.choices, default=RestoreMode.OVERWRITE)

    # Pre-restore safety
    pre_restore_backup = models.ForeignKey(
        TenantBackup, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='safety_for_restores',
    )
    pre_restore_completed = models.BooleanField(default=False)

    # Status
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    progress_percent = models.SmallIntegerField(default=0)
    progress_detail = models.CharField(max_length=255, blank=True)

    # Results
    records_restored = models.JSONField(default=dict)
    records_skipped = models.JSONField(default=dict)
    records_failed = models.JSONField(default=dict)
    total_restored = models.PositiveIntegerField(default=0)
    total_skipped = models.PositiveIntegerField(default=0)
    total_failed = models.PositiveIntegerField(default=0)
    error_log = models.TextField(blank=True)

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)

    # Audit
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='initiated_restores',
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='approved_restores',
    )

    class Meta:
        db_table = 'tenant_restores'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.restore_number} - {self.organization.name}"


class BackupSchedule(UUIDModel, TimeStampedModel):
    """Automated backup schedule per tenant."""

    class ScheduleType(models.TextChoices):
        DAILY = 'DAILY', 'Daily'
        WEEKLY = 'WEEKLY', 'Weekly'
        MONTHLY = 'MONTHLY', 'Monthly'

    organization = models.ForeignKey(
        'organization.Organization',
        on_delete=models.CASCADE,
        related_name='backup_schedules',
    )
    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)

    schedule_type = models.CharField(max_length=20, choices=ScheduleType.choices)
    schedule_config = models.JSONField(default=dict)

    backup_type = models.CharField(
        max_length=20, choices=TenantBackup.BackupType.choices,
        default=TenantBackup.BackupType.FULL,
    )
    modules_included = models.JSONField(default=list)
    retention_days = models.PositiveIntegerField(default=90)
    max_backups = models.PositiveIntegerField(default=30)

    last_run_at = models.DateTimeField(null=True, blank=True)
    next_run_at = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(max_length=20, null=True, blank=True)
    consecutive_failures = models.SmallIntegerField(default=0)

    notify_on_completion = models.BooleanField(default=False)
    notify_on_failure = models.BooleanField(default=True)
    notification_emails = models.JSONField(default=list)

    class Meta:
        db_table = 'backup_schedules'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.organization.name}"
