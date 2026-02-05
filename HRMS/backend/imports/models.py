"""
Models for data import functionality.
"""

import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone

from core.models import BaseModel, BinaryFileMixin


class ImportJob(BaseModel, BinaryFileMixin):
    """
    Tracks file import jobs with their status and progress.
    """
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PARSING = 'PARSING', 'Parsing File'
        MAPPING = 'MAPPING', 'Column Mapping'
        VALIDATING = 'VALIDATING', 'Validating Data'
        PREVIEW = 'PREVIEW', 'Ready for Preview'
        IMPORTING = 'IMPORTING', 'Importing Data'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    class TargetModel(models.TextChoices):
        EMPLOYEES = 'employees', 'Employees'
        LEAVE_BALANCES = 'leave_balances', 'Leave Balances'
        TRANSACTIONS = 'transactions', 'Payroll Transactions'
        DEPARTMENTS = 'departments', 'Departments'
        POSITIONS = 'positions', 'Job Positions'
        GRADES = 'grades', 'Job Grades'
        JOB_CATEGORIES = 'job_categories', 'Job Categories'
        # Organization hierarchy
        DIVISIONS = 'divisions', 'Divisions'
        DIRECTORATES = 'directorates', 'Directorates'
        WORK_LOCATIONS = 'work_locations', 'Work Locations'
        # Payroll setup
        BANKS = 'banks', 'Banks'
        BANK_BRANCHES = 'bank_branches', 'Bank Branches'
        STAFF_CATEGORIES = 'staff_categories', 'Staff Categories'
        SALARY_BANDS = 'salary_bands', 'Salary Bands'
        SALARY_LEVELS = 'salary_levels', 'Salary Levels'
        SALARY_NOTCHES = 'salary_notches', 'Salary Notches'
        PAY_COMPONENTS = 'pay_components', 'Pay Components'
        # Leave setup
        LEAVE_TYPES = 'leave_types', 'Leave Types'
        HOLIDAYS = 'holidays', 'Holidays'
        # Employee related
        BANK_ACCOUNTS = 'bank_accounts', 'Bank Accounts'

    # File info (uses BinaryFileMixin for file_data, file_name, etc.)
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=20)  # csv, xlsx, xls, txt, pdf

    # Import configuration
    target_model = models.CharField(
        max_length=50,
        choices=TargetModel.choices,
        db_index=True
    )
    instructions = models.TextField(
        null=True,
        blank=True,
        help_text="User's natural language instructions for mapping"
    )
    column_mapping = models.JSONField(
        default=dict,
        help_text="Maps source columns to target fields"
    )
    mapping_confidence = models.JSONField(
        default=dict,
        help_text="Confidence scores for each mapping (0-1)"
    )

    # Source file structure
    headers = models.JSONField(
        default=list,
        help_text="Column headers from source file"
    )
    sample_data = models.JSONField(
        default=list,
        help_text="Sample rows for preview (first 5-10 rows)"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )
    total_rows = models.PositiveIntegerField(default=0)
    processed_rows = models.PositiveIntegerField(default=0)
    success_count = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)
    skip_count = models.PositiveIntegerField(default=0)

    # Error tracking
    errors = models.JSONField(
        default=list,
        help_text="List of error details by row"
    )
    validation_errors = models.JSONField(
        default=list,
        help_text="Validation errors from preview"
    )

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Template reference (if using saved template)
    template = models.ForeignKey(
        'ImportTemplate',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='jobs'
    )

    class Meta:
        db_table = 'import_jobs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['target_model', 'status']),
        ]

    def __str__(self):
        return f"Import {self.id} - {self.target_model} ({self.status})"

    @property
    def progress_percentage(self):
        """Calculate progress percentage."""
        if self.total_rows == 0:
            return 0
        return round((self.processed_rows / self.total_rows) * 100, 1)

    @property
    def is_processing(self):
        """Check if import is actively processing."""
        return self.status in [
            self.Status.PARSING,
            self.Status.VALIDATING,
            self.Status.IMPORTING
        ]

    def start_processing(self):
        """Mark job as started."""
        self.status = self.Status.PARSING
        self.started_at = timezone.now()
        self.save(update_fields=['status', 'started_at'])

    def complete(self):
        """Mark job as completed."""
        self.status = self.Status.COMPLETED
        self.completed_at = timezone.now()
        self.save(update_fields=['status', 'completed_at'])

    def fail(self, error_message):
        """Mark job as failed."""
        self.status = self.Status.FAILED
        self.completed_at = timezone.now()
        self.errors.append({
            'type': 'system',
            'message': error_message,
            'timestamp': timezone.now().isoformat()
        })
        self.save(update_fields=['status', 'completed_at', 'errors'])


class ImportTemplate(BaseModel):
    """
    Saved import templates for reuse.
    """
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    target_model = models.CharField(
        max_length=50,
        choices=ImportJob.TargetModel.choices,
        db_index=True
    )
    column_mapping = models.JSONField(default=dict)
    default_values = models.JSONField(
        default=dict,
        help_text="Default values for unmapped fields"
    )
    transformation_rules = models.JSONField(
        default=dict,
        help_text="Data transformation rules"
    )
    is_public = models.BooleanField(
        default=False,
        help_text="Available to all users"
    )

    class Meta:
        db_table = 'import_templates'
        ordering = ['target_model', 'name']
        unique_together = ['name', 'created_by']

    def __str__(self):
        return f"{self.name} ({self.target_model})"


class ImportLog(models.Model):
    """
    Detailed log of import operations for a job.
    """
    class LogLevel(models.TextChoices):
        DEBUG = 'DEBUG', 'Debug'
        INFO = 'INFO', 'Info'
        WARNING = 'WARNING', 'Warning'
        ERROR = 'ERROR', 'Error'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    import_job = models.ForeignKey(
        ImportJob,
        on_delete=models.CASCADE,
        related_name='logs'
    )
    level = models.CharField(max_length=10, choices=LogLevel.choices)
    message = models.TextField()
    row_number = models.PositiveIntegerField(null=True, blank=True)
    field_name = models.CharField(max_length=100, null=True, blank=True)
    original_value = models.TextField(null=True, blank=True)
    processed_value = models.TextField(null=True, blank=True)
    extra_data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'import_logs'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['import_job', 'level']),
            models.Index(fields=['import_job', 'row_number']),
        ]

    def __str__(self):
        return f"{self.level}: {self.message[:50]}"
