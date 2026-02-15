import uuid
from django.db import models
from django.conf import settings


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='assistant_conversations',
    )
    title = models.CharField(max_length=255, default='New Chat')
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'assistant_conversations'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at']),
        ]

    def __str__(self):
        return f"{self.title} ({self.user})"


class Message(models.Model):
    class Role(models.TextChoices):
        USER = 'user', 'User'
        ASSISTANT = 'assistant', 'Assistant'
        SYSTEM = 'system', 'System'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    role = models.CharField(max_length=10, choices=Role.choices)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'assistant_messages'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
        ]

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"


class MessageAttachment(models.Model):
    """File attached to a chat message, stored as binary in DB."""

    class FileType(models.TextChoices):
        DATA = 'DATA', 'Data'
        IMAGE = 'IMAGE', 'Image'
        DOCUMENT = 'DOCUMENT', 'Document'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='attachments',
    )
    message = models.ForeignKey(
        Message,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='attachments',
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='assistant_attachments',
    )

    file_data = models.BinaryField()
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField()
    mime_type = models.CharField(max_length=100)

    file_type = models.CharField(max_length=10, choices=FileType.choices)
    parsed_summary = models.TextField(blank=True, default='')
    parsed_metadata = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'assistant_attachments'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['uploaded_by']),
        ]

    def __str__(self):
        return f"{self.file_name} ({self.file_type})"


class PromptTemplate(models.Model):
    """Pre-built instructional prompts for common agentic tasks."""

    class Category(models.TextChoices):
        DATA_ANALYSIS = 'DATA_ANALYSIS', 'Data Analysis'
        DATA_LOADING = 'DATA_LOADING', 'Data Loading'
        VARIATION_CHECK = 'VARIATION_CHECK', 'Variation Check'
        IMAGE_RECOGNITION = 'IMAGE_RECOGNITION', 'Image Recognition'
        DATA_EXTRACTION = 'DATA_EXTRACTION', 'Data Extraction'
        PAYROLL_CHECK = 'PAYROLL_CHECK', 'Payroll Check'
        GENERAL = 'GENERAL', 'General'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=255)
    prompt_text = models.TextField()
    category = models.CharField(max_length=20, choices=Category.choices)
    icon = models.CharField(max_length=50, default='SparklesIcon')
    requires_file = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'assistant_prompt_templates'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


# ── Import pipeline models ──────────────────────────────────────────────────


class ImportSession(models.Model):
    """Tracks the lifecycle of a single data-import operation."""

    class EntityType(models.TextChoices):
        EMPLOYEE_TRANSACTION = 'EMPLOYEE_TRANSACTION', 'Employee Transaction'
        EMPLOYEE = 'EMPLOYEE', 'Employee'
        BANK_ACCOUNT = 'BANK_ACCOUNT', 'Bank Account'
        PAY_COMPONENT = 'PAY_COMPONENT', 'Pay Component'
        BANK = 'BANK', 'Bank'

    class Status(models.TextChoices):
        UPLOADED = 'UPLOADED', 'Uploaded'
        MAPPING = 'MAPPING', 'AI Mapping'
        MAPPED = 'MAPPED', 'Mapped'
        PREVIEWED = 'PREVIEWED', 'Previewed'
        CONFIRMED = 'CONFIRMED', 'Confirmed'
        EXECUTING = 'EXECUTING', 'Executing'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='import_sessions',
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='import_sessions',
    )
    attachment = models.ForeignKey(
        MessageAttachment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='import_sessions',
    )

    entity_type = models.CharField(max_length=30, choices=EntityType.choices)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.UPLOADED,
    )

    # Column mapping
    column_mapping = models.JSONField(
        null=True, blank=True,
        help_text='AI-proposed column mapping: {source_col: target_field}',
    )
    confirmed_mapping = models.JSONField(
        null=True, blank=True,
        help_text='User-adjusted column mapping',
    )

    # Import parameters
    import_params = models.JSONField(
        null=True, blank=True,
        help_text='Parameters: effective_from, status, rollback_on_error, etc.',
    )

    # Progress counters
    total_rows = models.PositiveIntegerField(default=0)
    rows_created = models.PositiveIntegerField(default=0)
    rows_updated = models.PositiveIntegerField(default=0)
    rows_skipped = models.PositiveIntegerField(default=0)
    rows_errored = models.PositiveIntegerField(default=0)

    # Error tracking
    error_details = models.JSONField(null=True, blank=True)

    # Celery integration
    celery_task_id = models.CharField(max_length=255, null=True, blank=True)
    progress_key = models.CharField(
        max_length=255, null=True, blank=True,
        help_text='Redis cache key for live progress',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'assistant_import_sessions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"Import {self.entity_type} — {self.status} ({self.id})"


class ImportPreviewRow(models.Model):
    """One row from a dry-run preview before the actual import."""

    class Action(models.TextChoices):
        CREATE = 'CREATE', 'Create'
        UPDATE = 'UPDATE', 'Update'
        SKIP = 'SKIP', 'Skip'
        ERROR = 'ERROR', 'Error'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        ImportSession,
        on_delete=models.CASCADE,
        related_name='preview_rows',
    )
    row_number = models.PositiveIntegerField()

    action = models.CharField(max_length=10, choices=Action.choices)
    parsed_data = models.JSONField(help_text='Mapped data after column mapping')
    raw_data = models.JSONField(help_text='Original row from the file')

    existing_record_id = models.UUIDField(
        null=True, blank=True,
        help_text='PK of existing record for UPDATE actions',
    )
    changes = models.JSONField(
        null=True, blank=True,
        help_text='Diff: {field: {old: ..., new: ...}} for UPDATE actions',
    )
    errors = models.JSONField(null=True, blank=True)
    warnings = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = 'assistant_import_preview_rows'
        ordering = ['row_number']
        indexes = [
            models.Index(fields=['session', 'action']),
        ]

    def __str__(self):
        return f"Row {self.row_number} — {self.action}"


class ImportResult(models.Model):
    """Execution log for one row after the confirmed import runs."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        ImportSession,
        on_delete=models.CASCADE,
        related_name='results',
    )
    row_number = models.PositiveIntegerField()

    action_taken = models.CharField(max_length=10)
    record_id = models.UUIDField(null=True, blank=True)
    record_type = models.CharField(max_length=100, null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'assistant_import_results'
        ordering = ['row_number']

    def __str__(self):
        return f"Result row {self.row_number} — {self.action_taken}"
