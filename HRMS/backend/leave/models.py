"""
Leave management models for NHIA HRMS.
"""

import base64
import hashlib
import mimetypes
from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal

from core.models import BaseModel


class LeaveType(BaseModel):
    """
    Types of leave available in the system.
    """
    class AccrualType(models.TextChoices):
        NONE = 'NONE', 'No Accrual'
        MONTHLY = 'MONTHLY', 'Monthly'
        QUARTERLY = 'QUARTERLY', 'Quarterly'
        YEARLY = 'YEARLY', 'Yearly'
        ON_HIRE = 'ON_HIRE', 'On Hire Date'

    code = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)

    # Entitlement
    default_days = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    max_days = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    min_days_per_request = models.DecimalField(max_digits=4, decimal_places=2, default=0.5)
    max_days_per_request = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    # Accrual settings
    accrual_type = models.CharField(
        max_length=20,
        choices=AccrualType.choices,
        default=AccrualType.YEARLY
    )
    accrual_rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    # Carry forward
    allow_carry_forward = models.BooleanField(default=False)
    max_carry_forward_days = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    carry_forward_expiry_months = models.PositiveSmallIntegerField(null=True, blank=True)

    # Encashment
    allow_encashment = models.BooleanField(default=False)
    max_encashment_days = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    # Rules
    is_paid = models.BooleanField(default=True)
    requires_approval = models.BooleanField(default=True)
    requires_document = models.BooleanField(default=False)
    document_required_after_days = models.PositiveSmallIntegerField(null=True, blank=True)
    min_service_months = models.PositiveSmallIntegerField(default=0)
    applies_to_gender = models.CharField(
        max_length=1,
        choices=[('M', 'Male'), ('F', 'Female'), ('A', 'All')],
        default='A'
    )
    max_instances_per_year = models.PositiveSmallIntegerField(null=True, blank=True)
    consecutive_days_only = models.BooleanField(default=False)
    include_weekends = models.BooleanField(default=False)
    include_holidays = models.BooleanField(default=False)
    advance_notice_days = models.PositiveSmallIntegerField(default=0)

    # Display
    color_code = models.CharField(max_length=7, default='#3B82F6')
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'leave_types'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f"{self.code} - {self.name}"


class LeavePolicy(BaseModel):
    """
    Leave policies that can vary by grade, position, or employment type.
    """
    name = models.CharField(max_length=100)
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name='policies'
    )

    # Applicability
    grade = models.ForeignKey(
        'organization.JobGrade',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='leave_policies'
    )
    employment_type = models.CharField(max_length=20, null=True, blank=True)
    department = models.ForeignKey(
        'organization.Department',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='leave_policies'
    )

    # Override defaults
    entitled_days = models.DecimalField(max_digits=5, decimal_places=2)
    max_carry_forward_days = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'leave_policies'
        ordering = ['leave_type', 'name']

    def __str__(self):
        return f"{self.name} - {self.leave_type.name}"


class LeaveBalance(BaseModel):
    """
    Employee leave balance tracking.
    """
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='leave_balances'
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name='balances'
    )
    year = models.PositiveSmallIntegerField(db_index=True)

    # Balance tracking
    opening_balance = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    earned = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    taken = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    pending = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    adjustment = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    carried_forward = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    encashed = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    lapsed = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    class Meta:
        db_table = 'leave_balances'
        unique_together = ['employee', 'leave_type', 'year']
        ordering = ['employee', 'leave_type', 'year']

    def __str__(self):
        return f"{self.employee.employee_number} - {self.leave_type.code} - {self.year}"

    @property
    def available_balance(self):
        """Calculate available balance."""
        return (
            self.opening_balance +
            self.earned +
            self.carried_forward +
            self.adjustment -
            self.taken -
            self.pending -
            self.encashed -
            self.lapsed
        )

    @property
    def total_entitlement(self):
        """Calculate total entitlement for the year."""
        return self.opening_balance + self.earned + self.carried_forward + self.adjustment


class LeaveRequest(BaseModel):
    """
    Leave application/request.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PENDING = 'PENDING', 'Pending Approval'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        CANCELLED = 'CANCELLED', 'Cancelled'
        RECALLED = 'RECALLED', 'Recalled'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='leave_requests'
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.PROTECT,
        related_name='requests'
    )

    # Request details
    request_number = models.CharField(max_length=20, unique=True, db_index=True)
    start_date = models.DateField(db_index=True)
    end_date = models.DateField()
    number_of_days = models.DecimalField(max_digits=5, decimal_places=2)
    is_half_day = models.BooleanField(default=False)
    half_day_type = models.CharField(
        max_length=10,
        choices=[('FIRST', 'First Half'), ('SECOND', 'Second Half')],
        null=True,
        blank=True
    )

    reason = models.TextField()
    contact_address = models.TextField(null=True, blank=True)
    contact_phone = models.CharField(max_length=20, null=True, blank=True)

    # Handover
    handover_to = models.ForeignKey(
        'employees.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='leave_handovers'
    )
    handover_notes = models.TextField(null=True, blank=True)

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_leaves'
    )
    rejection_reason = models.TextField(null=True, blank=True)
    cancellation_reason = models.TextField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    # Balance snapshot at time of request
    balance_at_request = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = 'leave_requests'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['start_date', 'end_date']),
        ]

    def __str__(self):
        return f"{self.request_number} - {self.employee.employee_number}"

    def calculate_days(self):
        """Calculate number of working days between start and end date."""
        from organization.models import Holiday

        if self.is_half_day:
            return Decimal('0.5')

        total_days = 0
        current_date = self.start_date
        while current_date <= self.end_date:
            # Check if weekend
            is_weekend = current_date.weekday() >= 5

            # Check if holiday
            is_holiday = Holiday.objects.filter(
                date=current_date,
                is_deleted=False
            ).exists()

            if self.leave_type.include_weekends or not is_weekend:
                if self.leave_type.include_holidays or not is_holiday:
                    total_days += 1

            current_date += timezone.timedelta(days=1)

        return Decimal(str(total_days))


class LeaveApproval(BaseModel):
    """
    Leave approval workflow tracking.
    """
    class Action(models.TextChoices):
        APPROVE = 'APPROVE', 'Approved'
        REJECT = 'REJECT', 'Rejected'
        FORWARD = 'FORWARD', 'Forwarded'
        RETURN = 'RETURN', 'Returned'

    leave_request = models.ForeignKey(
        LeaveRequest,
        on_delete=models.CASCADE,
        related_name='approvals'
    )
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='leave_approvals'
    )
    level = models.PositiveSmallIntegerField(default=1)
    action = models.CharField(max_length=20, choices=Action.choices)
    comments = models.TextField(null=True, blank=True)
    action_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'leave_approvals'
        ordering = ['leave_request', 'level', '-action_at']

    def __str__(self):
        return f"{self.leave_request.request_number} - Level {self.level} - {self.action}"


class LeaveBalanceAdjustment(BaseModel):
    """
    Manual adjustments to leave balance.
    """
    class AdjustmentType(models.TextChoices):
        CREDIT = 'CREDIT', 'Credit'
        DEBIT = 'DEBIT', 'Debit'
        CARRY_FORWARD = 'CARRY_FORWARD', 'Carry Forward'
        ENCASHMENT = 'ENCASHMENT', 'Encashment'
        LAPSE = 'LAPSE', 'Lapse'
        CORRECTION = 'CORRECTION', 'Correction'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='leave_adjustments'
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name='adjustments'
    )
    year = models.PositiveSmallIntegerField()
    adjustment_type = models.CharField(max_length=20, choices=AdjustmentType.choices)
    days = models.DecimalField(max_digits=5, decimal_places=2)
    reason = models.TextField()
    reference_number = models.CharField(max_length=50, null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='approved_leave_adjustments'
    )

    class Meta:
        db_table = 'leave_balance_adjustments'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.employee.employee_number} - {self.adjustment_type} - {self.days} days"


class LeaveRecall(BaseModel):
    """
    Track leave recalls (when employee is called back from leave).
    """
    leave_request = models.ForeignKey(
        LeaveRequest,
        on_delete=models.CASCADE,
        related_name='recalls'
    )
    recall_date = models.DateField()
    recall_reason = models.TextField()
    days_recalled = models.DecimalField(max_digits=5, decimal_places=2)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='approved_recalls'
    )
    compensation_type = models.CharField(
        max_length=20,
        choices=[
            ('DAYS', 'Additional Leave Days'),
            ('PAY', 'Monetary Compensation'),
            ('NONE', 'No Compensation'),
        ],
        default='DAYS'
    )
    compensation_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'leave_recalls'
        ordering = ['-recall_date']

    def __str__(self):
        return f"{self.leave_request.request_number} - Recall on {self.recall_date}"


class LeaveDocument(BaseModel):
    """
    Supporting documents for leave requests (medical certificates, etc.).
    """
    class DocumentType(models.TextChoices):
        MEDICAL_CERTIFICATE = 'MEDICAL', 'Medical Certificate'
        TRAVEL_ITINERARY = 'TRAVEL', 'Travel Itinerary'
        DEATH_CERTIFICATE = 'DEATH', 'Death Certificate'
        BIRTH_CERTIFICATE = 'BIRTH', 'Birth Certificate'
        MARRIAGE_CERTIFICATE = 'MARRIAGE', 'Marriage Certificate'
        OTHER = 'OTHER', 'Other'

    leave_request = models.ForeignKey(
        LeaveRequest,
        on_delete=models.CASCADE,
        related_name='documents'
    )
    # Binary file storage
    file_data = models.BinaryField(null=True, blank=True)
    file_name = models.CharField(max_length=255, default='')
    file_size = models.PositiveIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=100, null=True, blank=True)
    file_checksum = models.CharField(max_length=64, null=True, blank=True)
    document_type = models.CharField(
        max_length=20,
        choices=DocumentType.choices,
        default=DocumentType.OTHER
    )
    description = models.TextField(null=True, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_leave_documents'
    )

    class Meta:
        db_table = 'leave_documents'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.leave_request.request_number} - {self.file_name}"

    def set_file(self, file_obj, filename=None):
        """Store a file as binary data."""
        if file_obj is None:
            self.file_data = None
            self.file_name = None
            self.file_size = None
            self.mime_type = None
            self.file_checksum = None
            return

        # Read file content
        content = file_obj.read() if hasattr(file_obj, 'read') else file_obj

        # Get filename
        if filename:
            self.file_name = filename
        elif hasattr(file_obj, 'name'):
            self.file_name = file_obj.name
        else:
            self.file_name = 'document'

        # Store binary data
        self.file_data = content
        self.file_size = len(content)

        # Determine MIME type
        if hasattr(file_obj, 'content_type'):
            self.mime_type = file_obj.content_type
        else:
            mime, _ = mimetypes.guess_type(self.file_name)
            self.mime_type = mime or 'application/octet-stream'

        # Calculate checksum
        self.file_checksum = hashlib.sha256(content).hexdigest()

    def get_file_base64(self):
        """Return file data as base64 encoded string."""
        if self.file_data:
            return base64.b64encode(self.file_data).decode('utf-8')
        return None

    def get_file_data_uri(self):
        """Return file as a data URI."""
        if self.file_data and self.mime_type:
            b64_data = base64.b64encode(self.file_data).decode('utf-8')
            return f"data:{self.mime_type};base64,{b64_data}"
        return None

    @property
    def has_file(self):
        """Check if file data exists."""
        return self.file_data is not None
