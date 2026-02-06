"""
Core models providing base functionality for all HRMS models.
"""

import uuid
import base64
import hashlib
import mimetypes
from django.db import models
from django.conf import settings
from django.utils import timezone


class TimeStampedModel(models.Model):
    """
    Abstract base model with created/updated timestamps.
    """
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteManager(models.Manager):
    """
    Manager that excludes soft-deleted records by default.
    """
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)

    def with_deleted(self):
        """Return all objects including soft-deleted ones."""
        return super().get_queryset()

    def deleted_only(self):
        """Return only soft-deleted objects."""
        return super().get_queryset().filter(is_deleted=True)


class SoftDeleteModel(models.Model):
    """
    Abstract base model with soft delete functionality.
    """
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_deleted'
    )

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False, user=None):
        """Soft delete the record."""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.deleted_by = user
        self.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])

    def hard_delete(self, using=None, keep_parents=False):
        """Permanently delete the record."""
        super().delete(using=using, keep_parents=keep_parents)

    def restore(self):
        """Restore a soft-deleted record."""
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])


class AuditModel(TimeStampedModel, SoftDeleteModel):
    """
    Abstract base model with full audit trail.
    Combines timestamps, soft delete, and user tracking.
    """
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_created'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_updated'
    )

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """
    Abstract base model with UUID primary key.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class BaseModel(UUIDModel, AuditModel):
    """
    Full-featured base model combining UUID, timestamps, soft delete, and audit fields.
    Use this as the base for most HRMS models.
    """
    class Meta:
        abstract = True
        ordering = ['-created_at']


class BinaryFileMixin(models.Model):
    """
    Abstract mixin for storing files as binary data in the database.
    Use this for attachments, documents, images, etc.
    """
    file_data = models.BinaryField(null=True, blank=True)
    file_name = models.CharField(max_length=255, null=True, blank=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=100, null=True, blank=True)
    file_checksum = models.CharField(max_length=64, null=True, blank=True)

    class Meta:
        abstract = True

    def set_file(self, file_obj, filename=None):
        """
        Store a file object as binary data.
        Args:
            file_obj: File-like object (Django UploadedFile, BytesIO, etc.)
            filename: Optional filename override
        """
        if file_obj is None:
            self.file_data = None
            self.file_name = None
            self.file_size = None
            self.mime_type = None
            self.file_checksum = None
            return

        # Read file content
        if hasattr(file_obj, 'read'):
            content = file_obj.read()
            if hasattr(file_obj, 'seek'):
                file_obj.seek(0)  # Reset file pointer
        else:
            content = file_obj

        # Get filename
        if filename:
            self.file_name = filename
        elif hasattr(file_obj, 'name'):
            self.file_name = file_obj.name
        else:
            self.file_name = 'unnamed_file'

        # Store binary data
        self.file_data = content
        self.file_size = len(content)

        # Determine MIME type
        if hasattr(file_obj, 'content_type'):
            self.mime_type = file_obj.content_type
        else:
            mime_type, _ = mimetypes.guess_type(self.file_name)
            self.mime_type = mime_type or 'application/octet-stream'

        # Calculate checksum
        self.file_checksum = hashlib.sha256(content).hexdigest()

    def get_file_data(self):
        """Return the raw binary data."""
        return self.file_data

    def get_file_base64(self):
        """Return file data as base64 encoded string."""
        if self.file_data:
            return base64.b64encode(self.file_data).decode('utf-8')
        return None

    def get_file_data_uri(self):
        """Return file as a data URI for embedding in HTML/responses."""
        if self.file_data and self.mime_type:
            b64_data = base64.b64encode(self.file_data).decode('utf-8')
            return f"data:{self.mime_type};base64,{b64_data}"
        return None

    @property
    def has_file(self):
        """Check if file data exists."""
        return self.file_data is not None and len(self.file_data) > 0

    @property
    def file_extension(self):
        """Get file extension from filename."""
        if self.file_name:
            parts = self.file_name.rsplit('.', 1)
            if len(parts) > 1:
                return parts[1].lower()
        return None

    @property
    def is_image(self):
        """Check if the file is an image."""
        if self.mime_type:
            return self.mime_type.startswith('image/')
        return False

    @property
    def is_pdf(self):
        """Check if the file is a PDF."""
        return self.mime_type == 'application/pdf'

    @property
    def is_document(self):
        """Check if the file is a document (PDF, Word, etc.)."""
        document_types = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
        ]
        return self.mime_type in document_types


class BinaryImageMixin(BinaryFileMixin):
    """
    Extended mixin specifically for images with dimension tracking.
    """
    image_width = models.PositiveIntegerField(null=True, blank=True)
    image_height = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        abstract = True

    def set_file(self, file_obj, filename=None):
        """Override to also extract image dimensions."""
        super().set_file(file_obj, filename)

        if self.file_data and self.is_image:
            try:
                from PIL import Image
                import io
                img = Image.open(io.BytesIO(self.file_data))
                self.image_width, self.image_height = img.size
            except Exception:
                self.image_width = None
                self.image_height = None


class AuditLog(models.Model):
    """
    Immutable audit log for tracking all data changes.
    """
    class ActionType(models.TextChoices):
        CREATE = 'CREATE', 'Create'
        UPDATE = 'UPDATE', 'Update'
        DELETE = 'DELETE', 'Delete'
        VIEW = 'VIEW', 'View'
        EXPORT = 'EXPORT', 'Export'
        LOGIN = 'LOGIN', 'Login'
        LOGOUT = 'LOGOUT', 'Logout'
        LOGIN_FAILED = 'LOGIN_FAILED', 'Login Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    action = models.CharField(max_length=20, choices=ActionType.choices, db_index=True)
    model_name = models.CharField(max_length=100, db_index=True)
    object_id = models.CharField(max_length=100, null=True, blank=True, db_index=True)
    object_repr = models.CharField(max_length=255, null=True, blank=True)
    changes = models.JSONField(null=True, blank=True)
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    extra_data = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['model_name', 'object_id']),
            models.Index(fields=['action', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.action} - {self.model_name} - {self.timestamp}"


class SystemConfiguration(BaseModel):
    """
    System-wide configuration settings stored in the database.
    """
    key = models.CharField(max_length=100, unique=True, db_index=True)
    value = models.TextField()
    value_type = models.CharField(
        max_length=20,
        choices=[
            ('string', 'String'),
            ('integer', 'Integer'),
            ('float', 'Float'),
            ('boolean', 'Boolean'),
            ('json', 'JSON'),
        ],
        default='string'
    )
    description = models.TextField(null=True, blank=True)
    is_sensitive = models.BooleanField(default=False)
    category = models.CharField(max_length=50, default='general', db_index=True)

    class Meta:
        db_table = 'system_configurations'
        verbose_name = 'System Configuration'
        verbose_name_plural = 'System Configurations'

    def __str__(self):
        return f"{self.key}: {self.value if not self.is_sensitive else '***'}"

    def get_value(self):
        """Return the typed value."""
        if self.value_type == 'integer':
            return int(self.value)
        elif self.value_type == 'float':
            return float(self.value)
        elif self.value_type == 'boolean':
            return self.value.lower() in ('true', '1', 'yes')
        elif self.value_type == 'json':
            import json
            return json.loads(self.value)
        return self.value


class Country(models.Model):
    """
    Country reference data.
    """
    code = models.CharField(max_length=3, primary_key=True)
    name = models.CharField(max_length=100)
    phone_code = models.CharField(max_length=10, null=True, blank=True)
    currency_code = models.CharField(max_length=3, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'countries'
        verbose_name_plural = 'Countries'
        ordering = ['name']

    def __str__(self):
        return self.name


class Region(BaseModel):
    """
    Geographic regions within the country (e.g., Ghana's 16 regions).
    """
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)
    country = models.ForeignKey(
        Country,
        on_delete=models.PROTECT,
        related_name='regions',
        default='GHA'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'regions'
        ordering = ['name']

    def __str__(self):
        return self.name


class District(BaseModel):
    """
    Districts within regions.
    """
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)
    region = models.ForeignKey(
        Region,
        on_delete=models.PROTECT,
        related_name='districts'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'districts'
        ordering = ['region__name', 'name']

    def __str__(self):
        return f"{self.name}, {self.region.name}"


class Attachment(BaseModel, BinaryFileMixin):
    """
    Generic file attachment model with binary storage.
    Files are stored directly in the database as binary data.
    """
    class AttachmentType(models.TextChoices):
        DOCUMENT = 'DOCUMENT', 'Document'
        IMAGE = 'IMAGE', 'Image'
        CERTIFICATE = 'CERTIFICATE', 'Certificate'
        CONTRACT = 'CONTRACT', 'Contract'
        ID_CARD = 'ID_CARD', 'ID Card'
        MEDICAL = 'MEDICAL', 'Medical Document'
        AUDIO = 'AUDIO', 'Audio'
        VIDEO = 'VIDEO', 'Video'
        OTHER = 'OTHER', 'Other'

    attachment_type = models.CharField(
        max_length=20,
        choices=AttachmentType.choices,
        default=AttachmentType.DOCUMENT
    )
    description = models.TextField(null=True, blank=True)
    # For generic foreign key support
    content_type_name = models.CharField(max_length=100, db_index=True, default='')
    object_id = models.CharField(max_length=100, db_index=True, default='')

    class Meta:
        db_table = 'attachments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['content_type_name', 'object_id']),
        ]

    def __str__(self):
        return self.file_name or 'Unnamed attachment'

    @classmethod
    def create_from_file(cls, file_obj, attachment_type, content_type_name, object_id,
                         description=None, created_by=None):
        """
        Factory method to create an attachment from an uploaded file.
        """
        attachment = cls(
            attachment_type=attachment_type,
            content_type_name=content_type_name,
            object_id=str(object_id),
            description=description,
            created_by=created_by,
        )
        attachment.set_file(file_obj)
        attachment.save()
        return attachment


class Notification(BaseModel):
    """
    User notification model.
    """
    class NotificationType(models.TextChoices):
        INFO = 'INFO', 'Information'
        WARNING = 'WARNING', 'Warning'
        ERROR = 'ERROR', 'Error'
        SUCCESS = 'SUCCESS', 'Success'
        TASK = 'TASK', 'Task'
        APPROVAL = 'APPROVAL', 'Approval Required'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=20,
        choices=NotificationType.choices,
        default=NotificationType.INFO
    )
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    link = models.CharField(max_length=500, null=True, blank=True)
    extra_data = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read', '-created_at']),
        ]

    def __str__(self):
        return f"{self.title} - {self.user}"

    def mark_as_read(self):
        """Mark notification as read."""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])


class Announcement(BaseModel):
    """
    Company announcements with targeting capabilities.
    Can be company-wide or targeted to specific departments, grades, or locations.
    """
    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        NORMAL = 'NORMAL', 'Normal'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SCHEDULED = 'SCHEDULED', 'Scheduled'
        PUBLISHED = 'PUBLISHED', 'Published'
        EXPIRED = 'EXPIRED', 'Expired'
        ARCHIVED = 'ARCHIVED', 'Archived'

    class Category(models.TextChoices):
        GENERAL = 'GENERAL', 'General'
        HR = 'HR', 'HR & Admin'
        POLICY = 'POLICY', 'Policy Update'
        EVENT = 'EVENT', 'Event'
        BENEFITS = 'BENEFITS', 'Benefits'
        TRAINING = 'TRAINING', 'Training'
        IT = 'IT', 'IT & Systems'
        SAFETY = 'SAFETY', 'Health & Safety'
        OTHER = 'OTHER', 'Other'

    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    content = models.TextField()
    summary = models.CharField(max_length=500, blank=True, help_text='Short summary for previews')

    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.GENERAL
    )
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.NORMAL
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )

    # Targeting (null = all employees)
    is_company_wide = models.BooleanField(default=True, help_text='If false, uses targeting rules')

    # Scheduling
    publish_date = models.DateTimeField(null=True, blank=True, help_text='When to automatically publish')
    expiry_date = models.DateTimeField(null=True, blank=True, help_text='When announcement expires')

    # Engagement
    requires_acknowledgement = models.BooleanField(default=False)
    allow_comments = models.BooleanField(default=False)

    # Publishing
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='published_announcements'
    )

    # Display settings
    pin_to_top = models.BooleanField(default=False)
    show_on_dashboard = models.BooleanField(default=True)

    # Banner image (optional)
    banner_data = models.BinaryField(null=True, blank=True)
    banner_name = models.CharField(max_length=255, blank=True)
    banner_mime_type = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'announcements'
        ordering = ['-pin_to_top', '-published_at', '-created_at']
        indexes = [
            models.Index(fields=['status', '-published_at']),
            models.Index(fields=['category', 'status']),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            base_slug = slugify(self.title)[:200]
            self.slug = base_slug
            counter = 1
            while Announcement.objects.filter(slug=self.slug).exclude(pk=self.pk).exists():
                self.slug = f"{base_slug}-{counter}"
                counter += 1
        super().save(*args, **kwargs)

    @property
    def is_active(self):
        """Check if announcement is currently active."""
        if self.status != self.Status.PUBLISHED:
            return False
        now = timezone.now()
        if self.expiry_date and now > self.expiry_date:
            return False
        return True

    @property
    def has_banner(self):
        """Check if banner image exists."""
        return self.banner_data is not None and len(self.banner_data) > 0

    def set_banner(self, file_obj):
        """Store banner image from upload."""
        self.banner_data = file_obj.read()
        self.banner_name = file_obj.name
        self.banner_mime_type = mimetypes.guess_type(file_obj.name)[0] or 'image/jpeg'

    def get_banner_data_uri(self):
        """Return banner as data URI."""
        if self.has_banner:
            encoded = base64.b64encode(self.banner_data).decode('utf-8')
            return f"data:{self.banner_mime_type};base64,{encoded}"
        return None

    def publish(self, user=None):
        """Publish the announcement."""
        self.status = self.Status.PUBLISHED
        self.published_at = timezone.now()
        self.published_by = user
        self.save()

    def get_target_employees(self):
        """Get list of employees who should see this announcement."""
        from employees.models import Employee

        if self.is_company_wide:
            return Employee.objects.filter(status=Employee.EmploymentStatus.ACTIVE)

        # Get targeted employees
        targets = self.targets.all()
        employee_ids = set()

        for target in targets:
            qs = Employee.objects.filter(status=Employee.EmploymentStatus.ACTIVE)

            if target.department:
                qs = qs.filter(department=target.department)
            if target.grade:
                qs = qs.filter(grade=target.grade)
            if target.work_location:
                qs = qs.filter(work_location=target.work_location)
            if target.employment_type:
                qs = qs.filter(employment_type=target.employment_type)

            employee_ids.update(qs.values_list('id', flat=True))

        return Employee.objects.filter(id__in=employee_ids)


class AnnouncementTarget(BaseModel):
    """
    Targeting rules for an announcement.
    Multiple targets can be added for OR logic (any matching employee sees it).
    """
    announcement = models.ForeignKey(
        Announcement,
        on_delete=models.CASCADE,
        related_name='targets'
    )

    # Target criteria (null = all for that dimension)
    department = models.ForeignKey(
        'organization.Department',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='announcement_targets'
    )
    grade = models.ForeignKey(
        'organization.JobGrade',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='announcement_targets'
    )
    work_location = models.ForeignKey(
        'organization.WorkLocation',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='announcement_targets'
    )
    employment_type = models.CharField(max_length=20, blank=True)

    class Meta:
        db_table = 'announcement_targets'

    def __str__(self):
        parts = []
        if self.department:
            parts.append(f"Dept: {self.department.name}")
        if self.grade:
            parts.append(f"Grade: {self.grade.name}")
        if self.work_location:
            parts.append(f"Location: {self.work_location.name}")
        if self.employment_type:
            parts.append(f"Type: {self.employment_type}")
        return ' | '.join(parts) or 'All Employees'


class AnnouncementRead(BaseModel):
    """
    Tracks which users have read/acknowledged announcements.
    """
    announcement = models.ForeignKey(
        Announcement,
        on_delete=models.CASCADE,
        related_name='reads'
    )
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='announcement_reads'
    )
    read_at = models.DateTimeField(auto_now_add=True)
    acknowledged = models.BooleanField(default=False)
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'announcement_reads'
        unique_together = ['announcement', 'employee']

    def __str__(self):
        return f"{self.employee.employee_number} read {self.announcement.title}"

    def acknowledge(self):
        """Mark as acknowledged."""
        if not self.acknowledged:
            self.acknowledged = True
            self.acknowledged_at = timezone.now()
            self.save()


class AnnouncementAttachment(BaseModel):
    """
    File attachments for announcements.
    """
    announcement = models.ForeignKey(
        Announcement,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file_data = models.BinaryField()
    file_name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100)
    file_size = models.PositiveIntegerField(default=0)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'announcement_attachments'

    def __str__(self):
        return self.file_name

    @property
    def has_file(self):
        """Check if file data exists."""
        return self.file_data is not None and len(self.file_data) > 0

    def set_file(self, file_obj):
        """Store file from upload."""
        self.file_data = file_obj.read()
        self.file_name = file_obj.name
        self.mime_type = mimetypes.guess_type(file_obj.name)[0] or 'application/octet-stream'
        self.file_size = len(self.file_data)

    def get_file_data_uri(self):
        """Return file as data URI."""
        if self.has_file:
            encoded = base64.b64encode(self.file_data).decode('utf-8')
            return f"data:{self.mime_type};base64,{encoded}"
        return None
