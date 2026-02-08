"""
Company Policy Module Models.

Handles SOPs, Policies, and staff acknowledgement tracking.
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from core.models import AuditModel


class PolicyCategory(AuditModel):
    """
    Categories for organizing policies and SOPs.
    Examples: HR, Finance, Operations, IT, Compliance, Safety
    """
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True, help_text="Icon class name")
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Policy Category"
        verbose_name_plural = "Policy Categories"
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class Policy(AuditModel):
    """
    Company policy or Standard Operating Procedure (SOP).
    """
    class Type(models.TextChoices):
        POLICY = 'POLICY', 'Policy'
        SOP = 'SOP', 'Standard Operating Procedure'
        GUIDELINE = 'GUIDELINE', 'Guideline'
        MANUAL = 'MANUAL', 'Manual'
        CIRCULAR = 'CIRCULAR', 'Circular'
        MEMO = 'MEMO', 'Memo'

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        APPROVED = 'APPROVED', 'Approved'
        PUBLISHED = 'PUBLISHED', 'Published'
        ARCHIVED = 'ARCHIVED', 'Archived'

    # Basic Information
    title = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True, help_text="Policy reference code")
    category = models.ForeignKey(
        PolicyCategory,
        on_delete=models.PROTECT,
        related_name='policies'
    )
    policy_type = models.CharField(
        max_length=20,
        choices=Type.choices,
        default=Type.POLICY
    )

    # Content
    summary = models.TextField(blank=True, help_text="Brief summary of the policy")
    content = models.TextField(blank=True, default='', help_text="Full policy content (supports markdown)")

    # Versioning
    version = models.CharField(max_length=20, default='1.0')
    version_notes = models.TextField(blank=True, help_text="What changed in this version")

    # Status & Dates
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )
    effective_date = models.DateField(null=True, blank=True)
    review_date = models.DateField(null=True, blank=True, help_text="Next review date")
    expiry_date = models.DateField(null=True, blank=True)

    # Publishing
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='published_policies'
    )

    # Approval
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_policies'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Acknowledgement Settings
    requires_acknowledgement = models.BooleanField(
        default=True,
        help_text="Staff must acknowledge reading this policy"
    )
    acknowledgement_deadline_days = models.PositiveIntegerField(
        default=14,
        help_text="Days to acknowledge after publication"
    )

    # Targeting
    applies_to_all = models.BooleanField(
        default=True,
        help_text="Applies to all employees"
    )
    target_departments = models.ManyToManyField(
        'organization.Department',
        blank=True,
        related_name='targeted_policies',
        help_text="Specific departments (if not all)"
    )
    target_divisions = models.ManyToManyField(
        'organization.Division',
        blank=True,
        related_name='targeted_policies',
        help_text="Specific divisions (if not all)"
    )

    # Attachments
    attachment = models.BinaryField(null=True, blank=True)
    attachment_name = models.CharField(max_length=255, blank=True)
    attachment_type = models.CharField(max_length=100, blank=True)
    attachment_size = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        verbose_name = "Policy"
        verbose_name_plural = "Policies"
        ordering = ['-published_at', '-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['category']),
            models.Index(fields=['policy_type']),
            models.Index(fields=['effective_date']),
        ]

    def __str__(self):
        return f"{self.code} - {self.title}"

    @property
    def is_active(self):
        """Check if policy is currently active."""
        today = timezone.now().date()
        if self.status != self.Status.PUBLISHED:
            return False
        if self.effective_date and self.effective_date > today:
            return False
        if self.expiry_date and self.expiry_date < today:
            return False
        return True

    @property
    def acknowledgement_count(self):
        """Number of acknowledgements received."""
        return self.acknowledgements.count()

    @property
    def pending_acknowledgement_count(self):
        """Number of employees yet to acknowledge."""
        from employees.models import Employee
        if self.applies_to_all:
            total = Employee.objects.filter(status='ACTIVE').count()
        else:
            total = Employee.objects.filter(
                status='ACTIVE',
                department__in=self.target_departments.all()
            ).count()
        return total - self.acknowledgement_count

    def publish(self, user):
        """Publish the policy."""
        self.status = self.Status.PUBLISHED
        self.published_at = timezone.now()
        self.published_by = user
        self.save()

    def archive(self):
        """Archive the policy."""
        self.status = self.Status.ARCHIVED
        self.save()


class PolicyVersion(AuditModel):
    """
    Version history for policies.
    Created automatically when a published policy is updated.
    """
    policy = models.ForeignKey(
        Policy,
        on_delete=models.CASCADE,
        related_name='versions'
    )
    version = models.CharField(max_length=20)
    title = models.CharField(max_length=255)
    content = models.TextField()
    version_notes = models.TextField(blank=True)
    effective_date = models.DateField(null=True, blank=True)

    # Snapshot of who created this version
    versioned_at = models.DateTimeField(auto_now_add=True)
    versioned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='policy_versions'
    )

    class Meta:
        verbose_name = "Policy Version"
        verbose_name_plural = "Policy Versions"
        ordering = ['-versioned_at']
        unique_together = ['policy', 'version']

    def __str__(self):
        return f"{self.policy.code} v{self.version}"


class PolicyAcknowledgement(AuditModel):
    """
    Record of employee acknowledging a policy.
    """
    policy = models.ForeignKey(
        Policy,
        on_delete=models.CASCADE,
        related_name='acknowledgements'
    )
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='policy_acknowledgements'
    )

    # Acknowledgement Details
    acknowledged_at = models.DateTimeField(auto_now_add=True)
    acknowledged_version = models.CharField(max_length=20)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    # Digital Signature (optional)
    signature_hash = models.CharField(max_length=64, blank=True)

    # Comments
    comments = models.TextField(blank=True, help_text="Optional comments from employee")

    class Meta:
        verbose_name = "Policy Acknowledgement"
        verbose_name_plural = "Policy Acknowledgements"
        ordering = ['-acknowledged_at']
        unique_together = ['policy', 'employee']
        indexes = [
            models.Index(fields=['policy', 'employee']),
            models.Index(fields=['acknowledged_at']),
        ]

    def __str__(self):
        return f"{self.employee} acknowledged {self.policy.code}"


class PolicyNotification(AuditModel):
    """
    Notifications sent for policy acknowledgements.
    """
    class Type(models.TextChoices):
        NEW_POLICY = 'NEW', 'New Policy Published'
        REMINDER = 'REMINDER', 'Acknowledgement Reminder'
        OVERDUE = 'OVERDUE', 'Overdue Acknowledgement'
        UPDATE = 'UPDATE', 'Policy Updated'

    policy = models.ForeignKey(
        Policy,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='policy_notifications'
    )
    notification_type = models.CharField(
        max_length=20,
        choices=Type.choices
    )
    sent_at = models.DateTimeField(auto_now_add=True)
    sent_via = models.CharField(max_length=20, default='EMAIL')  # EMAIL, SMS, SYSTEM
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Policy Notification"
        verbose_name_plural = "Policy Notifications"
        ordering = ['-sent_at']

    def __str__(self):
        return f"{self.notification_type} to {self.employee} for {self.policy.code}"
