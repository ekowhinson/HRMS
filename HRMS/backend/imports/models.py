"""
Models for data import functionality.
"""

import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone

from core.models import BaseModel, BinaryFileMixin


class MultiFileImportBatch(BaseModel):
    """
    Tracks a batch of multiple file imports that are processed together.
    Handles automatic detection, dependency ordering, and coordinated import.
    """
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        ANALYZING = 'ANALYZING', 'Analyzing Files'
        READY = 'READY', 'Ready for Review'
        PROCESSING = 'PROCESSING', 'Processing'
        COMPLETED = 'COMPLETED', 'Completed'
        PARTIALLY_COMPLETED = 'PARTIAL', 'Partially Completed'
        FAILED = 'FAILED', 'Failed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Optional name for this batch import"
    )
    instructions = models.TextField(
        null=True,
        blank=True,
        help_text="User's natural language instructions for the batch"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )

    # File analysis results
    analysis_results = models.JSONField(
        default=dict,
        help_text="AI analysis results for each file"
    )
    processing_order = models.JSONField(
        default=list,
        help_text="Determined order for processing files"
    )
    file_count = models.PositiveIntegerField(default=0)

    # Statistics
    total_rows = models.PositiveIntegerField(default=0)
    processed_rows = models.PositiveIntegerField(default=0)
    success_count = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)
    files_completed = models.PositiveIntegerField(default=0)
    files_failed = models.PositiveIntegerField(default=0)

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Options
    auto_create_dependencies = models.BooleanField(
        default=True,
        help_text="Automatically create missing setup records (e.g., banks, departments)"
    )
    update_existing = models.BooleanField(
        default=True,
        help_text="Update existing records if found"
    )

    # Celery task tracking
    celery_task_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        db_index=True,
        help_text="Celery task ID for background processing"
    )

    class Meta:
        db_table = 'multi_file_import_batches'
        ordering = ['-created_at']

    def __str__(self):
        return f"Batch Import {self.id} ({self.file_count} files) - {self.status}"

    @property
    def progress_percentage(self):
        """Calculate overall progress percentage."""
        if self.total_rows == 0:
            return 0
        return round((self.processed_rows / self.total_rows) * 100, 1)

    @property
    def is_processing(self):
        """Check if batch is actively processing."""
        return self.status in [self.Status.ANALYZING, self.Status.PROCESSING]

    def start_analysis(self):
        """Mark batch as analyzing."""
        self.status = self.Status.ANALYZING
        self.started_at = timezone.now()
        self.save(update_fields=['status', 'started_at'])

    def mark_ready(self):
        """Mark batch as ready for review."""
        self.status = self.Status.READY
        self.save(update_fields=['status'])

    def start_processing(self):
        """Mark batch as processing."""
        self.status = self.Status.PROCESSING
        if not self.started_at:
            self.started_at = timezone.now()
        self.save(update_fields=['status', 'started_at'])

    def complete(self):
        """Mark batch as completed."""
        if self.files_failed > 0:
            self.status = self.Status.PARTIALLY_COMPLETED
        else:
            self.status = self.Status.COMPLETED
        self.completed_at = timezone.now()
        self.save(update_fields=['status', 'completed_at'])

    def fail(self, error_message):
        """Mark batch as failed."""
        self.status = self.Status.FAILED
        self.completed_at = timezone.now()
        self.save(update_fields=['status', 'completed_at'])


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

    # Batch reference (if part of multi-file import)
    batch = models.ForeignKey(
        'MultiFileImportBatch',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='jobs'
    )
    processing_order = models.PositiveIntegerField(
        default=0,
        help_text="Order in which this job should be processed within the batch"
    )
    detected_model = models.CharField(
        max_length=50,
        blank=True,
        help_text="AI-detected target model"
    )
    detection_confidence = models.FloatField(
        default=0.0,
        help_text="AI confidence in the detected model (0-1)"
    )

    # Celery task tracking
    celery_task_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        db_index=True,
        help_text="Celery task ID for background processing"
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


class Dataset(BaseModel):
    """
    Stores a merged dataset with metadata from AI-powered data analysis.
    Allows users to combine multiple source files with configurable joins.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        ANALYZING = 'ANALYZING', 'Analyzing'
        READY = 'READY', 'Ready for Configuration'
        MERGED = 'MERGED', 'Merged'
        SAVED = 'SAVED', 'Saved'
        FAILED = 'FAILED', 'Failed'

    name = models.CharField(
        max_length=200,
        help_text="Name for this dataset"
    )
    description = models.TextField(
        null=True,
        blank=True,
        help_text="Optional description of the dataset"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )

    # Merged data storage
    merged_data = models.BinaryField(
        null=True,
        blank=True,
        help_text="Merged CSV/JSON data"
    )
    merged_headers = models.JSONField(
        default=list,
        help_text="Column headers of the merged data"
    )
    merged_row_count = models.PositiveIntegerField(
        default=0,
        help_text="Total rows in merged data"
    )
    merged_sample_data = models.JSONField(
        default=list,
        help_text="First 10 rows of merged data for preview"
    )

    # AI analysis results
    ai_analysis = models.JSONField(
        default=dict,
        help_text="AI-generated join suggestions and analysis"
    )

    # Source file statistics
    file_count = models.PositiveIntegerField(default=0)
    total_source_rows = models.PositiveIntegerField(default=0)

    # Error tracking
    error_message = models.TextField(
        null=True,
        blank=True,
        help_text="Error message if merge failed"
    )

    class Meta:
        db_table = 'datasets'
        ordering = ['-created_at']

    def __str__(self):
        return f"Dataset: {self.name} ({self.status})"

    @property
    def is_ready_for_merge(self):
        """Check if dataset has files and join config ready for merge."""
        return self.files.count() >= 2 and self.joins.exists()

    def start_analysis(self):
        """Mark dataset as analyzing."""
        self.status = self.Status.ANALYZING
        self.save(update_fields=['status'])

    def mark_ready(self):
        """Mark dataset as ready for configuration."""
        self.status = self.Status.READY
        self.save(update_fields=['status'])

    def mark_merged(self):
        """Mark dataset as merged."""
        self.status = self.Status.MERGED
        self.save(update_fields=['status'])

    def mark_saved(self):
        """Mark dataset as saved."""
        self.status = self.Status.SAVED
        self.save(update_fields=['status'])

    def fail(self, error_message):
        """Mark dataset as failed."""
        self.status = self.Status.FAILED
        self.error_message = error_message
        self.save(update_fields=['status', 'error_message'])


class DatasetFile(BaseModel, BinaryFileMixin):
    """
    Links source files to a dataset with metadata about the file structure.
    """
    dataset = models.ForeignKey(
        Dataset,
        on_delete=models.CASCADE,
        related_name='files'
    )
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=20)  # csv, xlsx, xls

    # File structure
    headers = models.JSONField(
        default=list,
        help_text="Column headers from source file"
    )
    sample_data = models.JSONField(
        default=list,
        help_text="Sample rows for preview (first 10 rows)"
    )
    row_count = models.PositiveIntegerField(default=0)

    # Detected patterns
    detected_data_types = models.JSONField(
        default=dict,
        help_text="Detected data type for each column"
    )
    detected_patterns = models.JSONField(
        default=dict,
        help_text="Detected patterns (id_columns, date_columns, etc.)"
    )

    # User-configurable
    alias = models.CharField(
        max_length=50,
        blank=True,
        help_text="Alias for use in joins (e.g., 'employees')"
    )
    order = models.PositiveIntegerField(
        default=0,
        help_text="Order of file in the dataset"
    )

    class Meta:
        db_table = 'dataset_files'
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=['dataset', 'order']),
        ]

    def __str__(self):
        return f"{self.file_name} in {self.dataset.name}"

    def save(self, *args, **kwargs):
        # Auto-generate alias from filename if not set
        if not self.alias:
            name = self.file_name.rsplit('.', 1)[0]
            self.alias = name.lower().replace(' ', '_').replace('-', '_')[:50]
        super().save(*args, **kwargs)


class JoinConfiguration(BaseModel):
    """
    Stores join settings between two files in a dataset.
    """
    class JoinType(models.TextChoices):
        INNER = 'inner', 'Inner Join'
        LEFT = 'left', 'Left Join'
        RIGHT = 'right', 'Right Join'
        OUTER = 'outer', 'Outer Join'

    class RelationshipType(models.TextChoices):
        ONE_TO_ONE = '1:1', 'One to One'
        ONE_TO_MANY = '1:N', 'One to Many'
        MANY_TO_ONE = 'N:1', 'Many to One'
        MANY_TO_MANY = 'N:N', 'Many to Many'

    dataset = models.ForeignKey(
        Dataset,
        on_delete=models.CASCADE,
        related_name='joins'
    )
    left_file = models.ForeignKey(
        DatasetFile,
        on_delete=models.CASCADE,
        related_name='joins_as_left'
    )
    left_column = models.CharField(max_length=255)
    right_file = models.ForeignKey(
        DatasetFile,
        on_delete=models.CASCADE,
        related_name='joins_as_right'
    )
    right_column = models.CharField(max_length=255)
    join_type = models.CharField(
        max_length=10,
        choices=JoinType.choices,
        default=JoinType.LEFT
    )

    # AI suggestion metadata
    is_ai_suggested = models.BooleanField(default=False)
    ai_confidence = models.FloatField(
        default=0.0,
        help_text="AI confidence score (0-1)"
    )
    ai_reasoning = models.TextField(
        blank=True,
        help_text="AI explanation for this join suggestion"
    )
    relationship_type = models.CharField(
        max_length=5,
        choices=RelationshipType.choices,
        blank=True,
        help_text="Detected relationship cardinality"
    )

    # Sample matches for validation
    sample_matches = models.JSONField(
        default=list,
        help_text="Sample matching rows to validate the join"
    )

    # Order in join chain
    order = models.PositiveIntegerField(
        default=0,
        help_text="Order of join execution"
    )

    class Meta:
        db_table = 'join_configurations'
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=['dataset', 'order']),
        ]

    def __str__(self):
        return f"{self.left_file.alias}.{self.left_column} {self.join_type} {self.right_file.alias}.{self.right_column}"
