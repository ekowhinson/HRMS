"""
Leave management models for HRMS.
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
    is_emergency = models.BooleanField(
        default=False,
        help_text='Emergency leave types bypass advance notice requirements'
    )

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


class LeavePlan(BaseModel):
    """
    Annual leave plan for employees.
    Employees must plan their annual leave at the beginning of each year.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        REVISION_REQUESTED = 'REVISION', 'Revision Requested'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='leave_plans'
    )
    year = models.PositiveSmallIntegerField(db_index=True)

    # Summary
    total_planned_days = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    leave_entitlement = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    brought_forward = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_leave_plans'
    )
    revision_reason = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)

    # Comments
    employee_notes = models.TextField(blank=True)
    manager_comments = models.TextField(blank=True)

    class Meta:
        db_table = 'leave_plans'
        unique_together = ['employee', 'year']
        ordering = ['-year', 'employee']

    def __str__(self):
        return f"{self.employee.employee_number} - {self.year} Leave Plan"

    @property
    def unplanned_days(self):
        """Calculate days not yet planned."""
        total_available = self.leave_entitlement + self.brought_forward
        return total_available - self.total_planned_days

    def calculate_total_days(self):
        """Calculate total planned days from entries."""
        total = self.entries.aggregate(
            total=models.Sum('number_of_days')
        )['total'] or Decimal('0')
        self.total_planned_days = total
        return total


class LeavePlanEntry(BaseModel):
    """
    Individual planned leave periods within a leave plan.
    """
    class Status(models.TextChoices):
        PLANNED = 'PLANNED', 'Planned'
        REQUESTED = 'REQUESTED', 'Leave Requested'
        TAKEN = 'TAKEN', 'Leave Taken'
        CANCELLED = 'CANCELLED', 'Cancelled'
        RESCHEDULED = 'RESCHEDULED', 'Rescheduled'

    leave_plan = models.ForeignKey(
        LeavePlan,
        on_delete=models.CASCADE,
        related_name='entries'
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.PROTECT,
        related_name='plan_entries'
    )

    # Dates
    start_date = models.DateField()
    end_date = models.DateField()
    number_of_days = models.DecimalField(max_digits=5, decimal_places=2)

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PLANNED
    )

    # Link to actual leave request if created
    leave_request = models.ForeignKey(
        LeaveRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='plan_entry'
    )

    description = models.CharField(max_length=200, blank=True)
    quarter = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'leave_plan_entries'
        ordering = ['leave_plan', 'start_date']

    def __str__(self):
        return f"{self.leave_plan.employee.employee_number} - {self.start_date} to {self.end_date}"

    def save(self, *args, **kwargs):
        # Calculate quarter based on start date
        if self.start_date:
            month = self.start_date.month
            self.quarter = (month - 1) // 3 + 1
        super().save(*args, **kwargs)


class LeaveCarryForwardRequest(BaseModel):
    """
    Request for carrying forward leave balance beyond the standard limit.
    Requires CEO approval per SRS.
    """
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending Approval'
        HR_APPROVED = 'HR_APPROVED', 'HR Approved'
        CEO_APPROVED = 'CEO_APPROVED', 'CEO Approved'
        REJECTED = 'REJECTED', 'Rejected'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='carry_forward_requests'
    )
    from_year = models.PositiveSmallIntegerField()
    to_year = models.PositiveSmallIntegerField()

    # Balance details
    available_balance = models.DecimalField(max_digits=5, decimal_places=2)
    standard_carry_forward = models.DecimalField(
        max_digits=5, decimal_places=2, default=5,
        help_text='Standard carry forward limit (default 5 days)'
    )
    requested_carry_forward = models.DecimalField(max_digits=5, decimal_places=2)
    additional_days_requested = models.DecimalField(
        max_digits=5, decimal_places=2,
        help_text='Days beyond standard limit requiring CEO approval'
    )
    approved_carry_forward = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    days_to_lapse = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    # Reason
    reason = models.TextField(help_text='Justification for carrying forward more than 5 days')

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    # HR Approval
    hr_reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hr_reviewed_carry_forwards'
    )
    hr_reviewed_at = models.DateTimeField(null=True, blank=True)
    hr_comments = models.TextField(blank=True)

    # CEO Approval (required for carry forward > 5 days)
    ceo_approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ceo_approved_carry_forwards'
    )
    ceo_approved_at = models.DateTimeField(null=True, blank=True)
    ceo_comments = models.TextField(blank=True)

    rejection_reason = models.TextField(blank=True)

    class Meta:
        db_table = 'leave_carry_forward_requests'
        ordering = ['-from_year', 'employee']
        unique_together = ['employee', 'from_year']

    def __str__(self):
        return f"{self.employee.employee_number} - {self.from_year} to {self.to_year}"

    def save(self, *args, **kwargs):
        # Calculate additional days requested
        if self.requested_carry_forward > self.standard_carry_forward:
            self.additional_days_requested = self.requested_carry_forward - self.standard_carry_forward
        else:
            self.additional_days_requested = Decimal('0')
        super().save(*args, **kwargs)


class LeaveReminder(BaseModel):
    """
    Leave reminders for employees with outstanding balance.
    Especially for Q4 reminders about using leave before year end.
    """
    class ReminderType(models.TextChoices):
        Q4_OUTSTANDING = 'Q4', 'Q4 Outstanding Balance'
        PLAN_DUE = 'PLAN_DUE', 'Leave Plan Due'
        CARRY_FORWARD_DEADLINE = 'CF_DEADLINE', 'Carry Forward Deadline'
        BALANCE_WARNING = 'BALANCE', 'Low Balance Warning'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='leave_reminders'
    )
    year = models.PositiveSmallIntegerField()
    reminder_type = models.CharField(max_length=20, choices=ReminderType.choices)

    # Reminder details
    outstanding_balance = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    message = models.TextField()

    # Tracking
    sent_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    acknowledged = models.BooleanField(default=False)
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'leave_reminders'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.employee.employee_number} - {self.reminder_type} - {self.year}"


# ========================================
# Location-Based Approval Workflow
# ========================================

class LeaveApprovalWorkflowTemplate(BaseModel):
    """
    Templates for leave approval workflows by location type.
    Approval chains by location type:
    - District: Staff → District Manager → Regional Director
    - Regional: Officers → Unit Head → Regional Director
    - CPC: Officers → Supervisors → Deputy Director
    - Head Office: Officers → Unit Head → Deputy Director → Director → DCE
    - Standalone: Direct to CEO
    """
    class LocationCategory(models.TextChoices):
        DISTRICT = 'DISTRICT', 'District Office'
        REGIONAL = 'REGIONAL', 'Regional Office'
        CPC = 'CPC', 'Claims Processing Center'
        HEAD_OFFICE = 'HEAD_OFFICE', 'Head Office'
        STANDALONE = 'STANDALONE', 'Standalone Office'

    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    location_category = models.CharField(
        max_length=20,
        choices=LocationCategory.choices
    )
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(
        default=False,
        help_text='Use this workflow if no specific mapping exists'
    )

    # Maximum levels (for validation)
    max_levels = models.PositiveSmallIntegerField(default=5)

    class Meta:
        db_table = 'leave_approval_workflow_templates'
        ordering = ['location_category', 'name']

    def __str__(self):
        return f"{self.code} - {self.name} ({self.location_category})"


class LeaveApprovalWorkflowLevel(BaseModel):
    """
    Approval levels within a workflow template.
    """
    class ApproverType(models.TextChoices):
        SUPERVISOR = 'SUPERVISOR', 'Direct Supervisor'
        UNIT_HEAD = 'UNIT_HEAD', 'Unit Head'
        DEPARTMENT_HEAD = 'DEPT_HEAD', 'Department Head'
        DISTRICT_MANAGER = 'DIST_MGR', 'District Manager'
        REGIONAL_DIRECTOR = 'REG_DIR', 'Regional Director'
        DEPUTY_DIRECTOR = 'DEP_DIR', 'Deputy Director'
        DIRECTOR = 'DIRECTOR', 'Director'
        DCE = 'DCE', 'Deputy CEO'
        CEO = 'CEO', 'CEO'
        ROLE_BASED = 'ROLE', 'Based on Role'
        SPECIFIC_USER = 'USER', 'Specific User'

    template = models.ForeignKey(
        LeaveApprovalWorkflowTemplate,
        on_delete=models.CASCADE,
        related_name='levels'
    )
    level = models.PositiveSmallIntegerField()
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    approver_type = models.CharField(
        max_length=20,
        choices=ApproverType.choices
    )

    # Optional: specific role or user
    approver_role = models.ForeignKey(
        'accounts.Role',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='leave_approval_levels'
    )
    approver_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='leave_approval_levels'
    )

    # Conditional approval
    days_threshold = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text='Only require this level if days exceed threshold'
    )
    apply_to_grades = models.JSONField(
        default=list, blank=True,
        help_text='List of grade codes this level applies to (empty = all)'
    )

    # Configuration
    can_skip = models.BooleanField(
        default=False,
        help_text='Can be skipped if approver is same as previous level'
    )
    can_reject = models.BooleanField(default=True)
    can_modify_dates = models.BooleanField(default=False)
    requires_comments = models.BooleanField(default=False)
    auto_escalate_hours = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Auto-escalate after this many hours (null = no auto-escalate)'
    )

    class Meta:
        db_table = 'leave_approval_workflow_levels'
        ordering = ['template', 'level']
        unique_together = ['template', 'level']

    def __str__(self):
        return f"{self.template.name} - Level {self.level}: {self.name}"


class LocationWorkflowMapping(BaseModel):
    """
    Map specific work locations to approval workflow templates.
    """
    location = models.ForeignKey(
        'organization.WorkLocation',
        on_delete=models.CASCADE,
        related_name='leave_workflow_mappings'
    )
    workflow_template = models.ForeignKey(
        LeaveApprovalWorkflowTemplate,
        on_delete=models.CASCADE,
        related_name='location_mappings'
    )
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'location_workflow_mappings'
        ordering = ['location', '-effective_from']

    def __str__(self):
        return f"{self.location.name} → {self.workflow_template.name}"


class LeaveRequestWorkflowStatus(BaseModel):
    """
    Track workflow status for a leave request.
    """
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        CANCELLED = 'CANCELLED', 'Cancelled'

    leave_request = models.OneToOneField(
        LeaveRequest,
        on_delete=models.CASCADE,
        related_name='workflow_status'
    )
    workflow_template = models.ForeignKey(
        LeaveApprovalWorkflowTemplate,
        on_delete=models.SET_NULL,
        null=True,
        related_name='request_statuses'
    )

    # Current state
    current_level = models.PositiveSmallIntegerField(default=1)
    total_levels = models.PositiveSmallIntegerField(default=1)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    # Pending approver info
    pending_approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pending_leave_approvals'
    )
    pending_since = models.DateTimeField(null=True, blank=True)

    # Completion
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'leave_request_workflow_status'

    def __str__(self):
        return f"{self.leave_request.request_number} - Level {self.current_level}/{self.total_levels}"

    def advance_to_next_level(self):
        """Move to next approval level."""
        if self.current_level < self.total_levels:
            self.current_level += 1
            self.pending_since = timezone.now()
            self.save()
            return True
        return False


class LeaveApprovalAction(BaseModel):
    """
    Track individual approval actions within the workflow.
    """
    class ActionType(models.TextChoices):
        APPROVE = 'APPROVE', 'Approved'
        REJECT = 'REJECT', 'Rejected'
        FORWARD = 'FORWARD', 'Forwarded'
        RETURN = 'RETURN', 'Returned for Revision'
        ESCALATE = 'ESCALATE', 'Escalated'
        DELEGATE = 'DELEGATE', 'Delegated'

    workflow_status = models.ForeignKey(
        LeaveRequestWorkflowStatus,
        on_delete=models.CASCADE,
        related_name='actions'
    )
    workflow_level = models.ForeignKey(
        LeaveApprovalWorkflowLevel,
        on_delete=models.SET_NULL,
        null=True
    )
    level_number = models.PositiveSmallIntegerField()

    action = models.CharField(max_length=20, choices=ActionType.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='leave_approval_actions'
    )
    acted_at = models.DateTimeField(auto_now_add=True)
    comments = models.TextField(blank=True)

    # If delegated
    delegated_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='delegated_leave_actions'
    )

    # If dates were modified
    original_start_date = models.DateField(null=True, blank=True)
    original_end_date = models.DateField(null=True, blank=True)
    modified_start_date = models.DateField(null=True, blank=True)
    modified_end_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'leave_approval_actions'
        ordering = ['workflow_status', 'level_number', 'acted_at']

    def __str__(self):
        return f"{self.workflow_status.leave_request.request_number} - L{self.level_number} - {self.action}"


class LeaveRelieverValidation(BaseModel):
    """
    Track reliever validation for leave requests.
    Ensures reliever is on duty during the requested leave period.
    """
    class ValidationStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending Validation'
        VALID = 'VALID', 'Valid - On Duty'
        INVALID = 'INVALID', 'Invalid - Reliever on Leave'
        CONFLICT = 'CONFLICT', 'Conflict - Already Relieving Others'
        APPROVED = 'APPROVED', 'Override Approved'

    leave_request = models.OneToOneField(
        LeaveRequest,
        on_delete=models.CASCADE,
        related_name='reliever_validation'
    )
    reliever = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='reliever_assignments'
    )

    validation_status = models.CharField(
        max_length=20,
        choices=ValidationStatus.choices,
        default=ValidationStatus.PENDING
    )
    validation_message = models.TextField(blank=True)

    # Conflicts found
    conflicting_leave = models.ForeignKey(
        LeaveRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conflicting_reliever_requests',
        help_text='Leave request where reliever is also on leave'
    )
    conflicting_reliever_duty = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='overlapping_assignments',
        help_text='Another reliever assignment that conflicts'
    )

    # Override
    override_approved = models.BooleanField(default=False)
    override_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reliever_overrides'
    )
    override_reason = models.TextField(blank=True)
    override_at = models.DateTimeField(null=True, blank=True)

    validated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'leave_reliever_validations'

    def __str__(self):
        return f"{self.leave_request.request_number} - Reliever: {self.reliever.full_name}"

    def validate(self):
        """Validate reliever availability."""
        from django.db.models import Q

        leave_start = self.leave_request.start_date
        leave_end = self.leave_request.end_date

        # Check if reliever has approved leave during this period
        reliever_leaves = LeaveRequest.objects.filter(
            employee=self.reliever,
            status=LeaveRequest.Status.APPROVED,
        ).filter(
            Q(start_date__lte=leave_end, end_date__gte=leave_start)
        )

        if reliever_leaves.exists():
            self.validation_status = self.ValidationStatus.INVALID
            self.conflicting_leave = reliever_leaves.first()
            self.validation_message = (
                f"Reliever {self.reliever.full_name} is on leave from "
                f"{self.conflicting_leave.start_date} to {self.conflicting_leave.end_date}"
            )
            self.validated_at = timezone.now()
            self.save()
            return False

        # Check if reliever is already assigned as reliever for another leave
        other_assignments = LeaveRelieverValidation.objects.filter(
            reliever=self.reliever,
            validation_status__in=[
                self.ValidationStatus.VALID,
                self.ValidationStatus.APPROVED
            ],
            leave_request__status=LeaveRequest.Status.APPROVED,
        ).exclude(
            leave_request=self.leave_request
        ).filter(
            Q(leave_request__start_date__lte=leave_end, leave_request__end_date__gte=leave_start)
        )

        if other_assignments.exists():
            self.validation_status = self.ValidationStatus.CONFLICT
            self.conflicting_reliever_duty = other_assignments.first()
            self.validation_message = (
                f"Reliever {self.reliever.full_name} is already relieving "
                f"{self.conflicting_reliever_duty.leave_request.employee.full_name} "
                f"during this period"
            )
            self.validated_at = timezone.now()
            self.save()
            return False

        # Passed all checks
        self.validation_status = self.ValidationStatus.VALID
        self.validation_message = "Reliever is available and on duty"
        self.validated_at = timezone.now()
        self.save()
        return True
