"""
Exit/Offboarding models for NHIA HRMS.
Handles resignations, retirements, terminations, exit interviews, and clearances.
"""

from django.db import models
from django.conf import settings
from django.utils import timezone

from core.models import AuditModel


class ExitType(AuditModel):
    """
    Types of employee exits (Resignation, Retirement, Termination, etc.)
    """
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    requires_notice = models.BooleanField(default=True)
    notice_period_days = models.PositiveIntegerField(default=30)
    requires_exit_interview = models.BooleanField(default=True)
    requires_clearance = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name = 'Exit Type'
        verbose_name_plural = 'Exit Types'

    def __str__(self):
        return self.name


class ExitRequest(AuditModel):
    """
    Employee exit request (resignation, retirement, termination request).
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        CLEARANCE = 'CLEARANCE', 'Awaiting Clearance'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        WITHDRAWN = 'WITHDRAWN', 'Withdrawn'

    # Reference
    request_number = models.CharField(max_length=20, unique=True)

    # Employee
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.PROTECT,
        related_name='exit_requests'
    )

    # Exit details
    exit_type = models.ForeignKey(
        ExitType,
        on_delete=models.PROTECT,
        related_name='exit_requests'
    )
    reason = models.TextField(help_text='Reason for exit')
    additional_comments = models.TextField(blank=True)

    # Dates
    request_date = models.DateField(default=timezone.now)
    notice_start_date = models.DateField(null=True, blank=True)
    proposed_last_day = models.DateField(help_text='Proposed last working day')
    actual_last_day = models.DateField(null=True, blank=True, help_text='Actual last working day')

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )

    # Approval
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_exit_requests'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_comments = models.TextField(blank=True)

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_exit_requests'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    approval_comments = models.TextField(blank=True)

    # Completion
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_exit_requests'
    )

    class Meta:
        ordering = ['-request_date', '-created_at']
        verbose_name = 'Exit Request'
        verbose_name_plural = 'Exit Requests'

    def __str__(self):
        return f"{self.request_number} - {self.employee}"

    def save(self, *args, **kwargs):
        if not self.request_number:
            # Generate request number
            year = timezone.now().year
            last = ExitRequest.objects.filter(
                request_number__startswith=f'EXIT-{year}'
            ).order_by('-request_number').first()

            if last:
                try:
                    num = int(last.request_number.split('-')[-1]) + 1
                except ValueError:
                    num = 1
            else:
                num = 1

            self.request_number = f'EXIT-{year}-{num:04d}'

        super().save(*args, **kwargs)

    @property
    def is_clearance_complete(self):
        """Check if all clearances are completed."""
        return not self.clearances.filter(is_cleared=False).exists()

    @property
    def pending_clearances_count(self):
        """Get count of pending clearances."""
        return self.clearances.filter(is_cleared=False).count()


class ExitInterview(AuditModel):
    """
    Exit interview record capturing feedback from departing employees.
    """
    class Status(models.TextChoices):
        SCHEDULED = 'SCHEDULED', 'Scheduled'
        COMPLETED = 'COMPLETED', 'Completed'
        DECLINED = 'DECLINED', 'Declined'
        NO_SHOW = 'NO_SHOW', 'No Show'
        CANCELLED = 'CANCELLED', 'Cancelled'

    exit_request = models.OneToOneField(
        ExitRequest,
        on_delete=models.CASCADE,
        related_name='exit_interview'
    )

    # Scheduling
    scheduled_date = models.DateTimeField(null=True, blank=True)
    conducted_date = models.DateTimeField(null=True, blank=True)
    interviewer = models.ForeignKey(
        'employees.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conducted_exit_interviews'
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED
    )

    # Interview Content
    reason_for_leaving = models.TextField(blank=True)
    would_recommend_employer = models.BooleanField(null=True, blank=True)
    would_return = models.BooleanField(null=True, blank=True)

    # Ratings (1-5 scale)
    job_satisfaction = models.IntegerField(null=True, blank=True)
    management_satisfaction = models.IntegerField(null=True, blank=True)
    work_environment = models.IntegerField(null=True, blank=True)
    compensation_satisfaction = models.IntegerField(null=True, blank=True)
    growth_opportunities = models.IntegerField(null=True, blank=True)
    work_life_balance = models.IntegerField(null=True, blank=True)

    # Feedback
    liked_most = models.TextField(blank=True, help_text='What did you like most about working here?')
    liked_least = models.TextField(blank=True, help_text='What did you like least?')
    suggestions = models.TextField(blank=True, help_text='Suggestions for improvement')
    reason_detailed = models.TextField(blank=True, help_text='Detailed reason for leaving')
    future_plans = models.TextField(blank=True, help_text='Future career plans')

    # Additional
    confidential_notes = models.TextField(
        blank=True,
        help_text='HR confidential notes (not shared with employee)'
    )

    # Attachment
    has_attachment = models.BooleanField(default=False)
    attachment = models.BinaryField(null=True, blank=True)
    attachment_name = models.CharField(max_length=255, blank=True)
    attachment_type = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ['-scheduled_date']
        verbose_name = 'Exit Interview'
        verbose_name_plural = 'Exit Interviews'

    def __str__(self):
        return f"Exit Interview - {self.exit_request.employee}"


class ClearanceDepartment(AuditModel):
    """
    Departments required to sign off on employee exit.
    """
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    checklist_items = models.TextField(
        blank=True,
        help_text='Default checklist items for this department (one per line)'
    )
    responsible_role = models.CharField(
        max_length=50,
        blank=True,
        help_text='Role/position responsible for clearance'
    )
    is_required = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name = 'Clearance Department'
        verbose_name_plural = 'Clearance Departments'

    def __str__(self):
        return self.name


class ExitClearance(AuditModel):
    """
    Individual department clearance record for an exit request.
    """
    exit_request = models.ForeignKey(
        ExitRequest,
        on_delete=models.CASCADE,
        related_name='clearances'
    )
    department = models.ForeignKey(
        ClearanceDepartment,
        on_delete=models.PROTECT,
        related_name='clearances'
    )

    # Status
    is_cleared = models.BooleanField(default=False)
    cleared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='exit_clearances_given'
    )
    cleared_at = models.DateTimeField(null=True, blank=True)

    # Details
    comments = models.TextField(blank=True)
    outstanding_items = models.TextField(blank=True, help_text='Any outstanding items to be resolved')
    conditions = models.TextField(blank=True, help_text='Conditions for clearance')

    # Deductions/Obligations
    amount_owed = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text='Amount owed by employee'
    )
    amount_due = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text='Amount due to employee'
    )

    class Meta:
        unique_together = ['exit_request', 'department']
        ordering = ['department__sort_order', 'department__name']
        verbose_name = 'Exit Clearance'
        verbose_name_plural = 'Exit Clearances'

    def __str__(self):
        status = 'Cleared' if self.is_cleared else 'Pending'
        return f"{self.exit_request.employee} - {self.department.name} ({status})"


class ExitChecklistItem(AuditModel):
    """
    Individual checklist items for clearance.
    """
    clearance = models.ForeignKey(
        ExitClearance,
        on_delete=models.CASCADE,
        related_name='checklist_items'
    )
    item_name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_completed = models.BooleanField(default=False)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['id']
        verbose_name = 'Exit Checklist Item'
        verbose_name_plural = 'Exit Checklist Items'

    def __str__(self):
        return self.item_name


class AssetReturn(AuditModel):
    """
    Track return of company assets by departing employee.
    """
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending Return'
        RETURNED = 'RETURNED', 'Returned'
        DAMAGED = 'DAMAGED', 'Returned Damaged'
        LOST = 'LOST', 'Lost/Missing'
        WRITTEN_OFF = 'WRITTEN_OFF', 'Written Off'
        PURCHASED = 'PURCHASED', 'Purchased by Employee'

    exit_request = models.ForeignKey(
        ExitRequest,
        on_delete=models.CASCADE,
        related_name='asset_returns'
    )

    # Asset details
    asset_name = models.CharField(max_length=200)
    asset_type = models.CharField(max_length=50, blank=True)  # Laptop, Phone, ID Card, etc.
    asset_tag = models.CharField(max_length=50, blank=True, help_text='Asset tag/serial number')
    description = models.TextField(blank=True)

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    # Return details
    returned_at = models.DateTimeField(null=True, blank=True)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='received_assets'
    )
    condition_notes = models.TextField(blank=True)

    # Financial
    original_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    deduction_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text='Amount to deduct for damage/loss'
    )

    class Meta:
        ordering = ['asset_type', 'asset_name']
        verbose_name = 'Asset Return'
        verbose_name_plural = 'Asset Returns'

    def __str__(self):
        return f"{self.asset_name} - {self.exit_request.employee}"


class FinalSettlement(AuditModel):
    """
    Final settlement calculation for departing employee.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        CALCULATED = 'CALCULATED', 'Calculated'
        PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
        APPROVED = 'APPROVED', 'Approved'
        PROCESSING = 'PROCESSING', 'Processing Payment'
        PAID = 'PAID', 'Paid'
        CANCELLED = 'CANCELLED', 'Cancelled'

    exit_request = models.OneToOneField(
        ExitRequest,
        on_delete=models.CASCADE,
        related_name='final_settlement'
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )

    # Earnings
    salary_arrears = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    leave_encashment = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    leave_days_encashed = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    gratuity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bonus = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_earnings = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_earnings_details = models.TextField(blank=True)

    # Deductions
    loan_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    advance_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    asset_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_deductions_details = models.TextField(blank=True)

    # Totals
    gross_settlement = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_settlement = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Notes
    calculation_notes = models.TextField(blank=True)

    # Approval
    calculated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='calculated_settlements'
    )
    calculated_at = models.DateTimeField(null=True, blank=True)

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_settlements'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Payment
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)

    class Meta:
        verbose_name = 'Final Settlement'
        verbose_name_plural = 'Final Settlements'

    def __str__(self):
        return f"Settlement - {self.exit_request.employee}"

    def calculate_totals(self):
        """Calculate and update total fields."""
        self.gross_settlement = (
            self.salary_arrears +
            self.leave_encashment +
            self.gratuity +
            self.bonus +
            self.other_earnings
        )
        self.total_deductions = (
            self.loan_balance +
            self.advance_balance +
            self.asset_deductions +
            self.tax_deductions +
            self.other_deductions
        )
        self.net_settlement = self.gross_settlement - self.total_deductions
        return self.net_settlement
