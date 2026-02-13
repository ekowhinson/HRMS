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
