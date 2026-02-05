"""
Benefits, Loans, and Reimbursements models for NHIA HRMS.
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal

from core.models import BaseModel


class LoanType(BaseModel):
    """
    Types of loans available to employees.
    """
    code = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)

    # Loan parameters
    max_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    max_salary_multiplier = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    max_tenure_months = models.PositiveSmallIntegerField(default=12)
    min_tenure_months = models.PositiveSmallIntegerField(default=1)

    # Interest
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    interest_type = models.CharField(
        max_length=20,
        choices=[
            ('SIMPLE', 'Simple Interest'),
            ('COMPOUND', 'Compound Interest'),
            ('FLAT', 'Flat Rate'),
            ('REDUCING', 'Reducing Balance'),
        ],
        default='SIMPLE'
    )

    # Eligibility
    min_service_months = models.PositiveSmallIntegerField(default=6)
    max_active_loans = models.PositiveSmallIntegerField(default=1)
    require_guarantor = models.BooleanField(default=False)
    number_of_guarantors = models.PositiveSmallIntegerField(default=0)

    # Processing
    max_deduction_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=33.33)
    approval_levels = models.PositiveSmallIntegerField(default=2)

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'loan_types'
        ordering = ['name']

    def __str__(self):
        return f"{self.code} - {self.name}"


class LoanAccount(BaseModel):
    """
    Employee loan account.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PENDING = 'PENDING', 'Pending Approval'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        DISBURSED = 'DISBURSED', 'Disbursed'
        ACTIVE = 'ACTIVE', 'Active (Repaying)'
        COMPLETED = 'COMPLETED', 'Fully Paid'
        DEFAULTED = 'DEFAULTED', 'Defaulted'
        WRITTEN_OFF = 'WRITTEN_OFF', 'Written Off'
        CANCELLED = 'CANCELLED', 'Cancelled'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='loans'
    )
    loan_type = models.ForeignKey(
        LoanType,
        on_delete=models.PROTECT,
        related_name='accounts'
    )

    # Loan details
    loan_number = models.CharField(max_length=20, unique=True, db_index=True)
    application_date = models.DateField(default=timezone.now)
    principal_amount = models.DecimalField(max_digits=12, decimal_places=2)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2)
    tenure_months = models.PositiveSmallIntegerField()

    # Calculated fields
    total_interest = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    monthly_installment = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Balance tracking
    disbursed_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    principal_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    interest_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    outstanding_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )

    # Dates
    disbursement_date = models.DateField(null=True, blank=True)
    first_deduction_date = models.DateField(null=True, blank=True)
    last_deduction_date = models.DateField(null=True, blank=True)
    expected_completion_date = models.DateField(null=True, blank=True)
    actual_completion_date = models.DateField(null=True, blank=True)

    # Approval
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_loans'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)

    purpose = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'loan_accounts'
        ordering = ['-application_date']
        indexes = [
            models.Index(fields=['employee', 'status']),
        ]

    def __str__(self):
        return f"{self.loan_number} - {self.employee.employee_number}"

    def calculate_emi(self):
        """Calculate Equated Monthly Installment."""
        if self.interest_rate == 0:
            return self.principal_amount / self.tenure_months

        monthly_rate = self.interest_rate / 100 / 12
        n = self.tenure_months

        # EMI formula: P * r * (1+r)^n / ((1+r)^n - 1)
        emi = (
            self.principal_amount * monthly_rate *
            ((1 + monthly_rate) ** n) /
            (((1 + monthly_rate) ** n) - 1)
        )
        return round(emi, 2)


class LoanSchedule(BaseModel):
    """
    Loan repayment schedule.
    """
    loan_account = models.ForeignKey(
        LoanAccount,
        on_delete=models.CASCADE,
        related_name='schedule'
    )
    installment_number = models.PositiveSmallIntegerField()
    due_date = models.DateField(db_index=True)
    principal_amount = models.DecimalField(max_digits=12, decimal_places=2)
    interest_amount = models.DecimalField(max_digits=12, decimal_places=2)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2)
    closing_balance = models.DecimalField(max_digits=12, decimal_places=2)
    is_paid = models.BooleanField(default=False)
    paid_date = models.DateField(null=True, blank=True)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    payroll_period = models.ForeignKey(
        'payroll.PayrollPeriod',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='loan_deductions'
    )

    class Meta:
        db_table = 'loan_schedules'
        ordering = ['loan_account', 'installment_number']
        unique_together = ['loan_account', 'installment_number']

    def __str__(self):
        return f"{self.loan_account.loan_number} - Installment {self.installment_number}"


class LoanTransaction(BaseModel):
    """
    Loan transactions (disbursements, payments, adjustments).
    """
    class TransactionType(models.TextChoices):
        DISBURSEMENT = 'DISBURSEMENT', 'Disbursement'
        DEDUCTION = 'DEDUCTION', 'Payroll Deduction'
        PAYMENT = 'PAYMENT', 'Direct Payment'
        ADJUSTMENT = 'ADJUSTMENT', 'Adjustment'
        WAIVER = 'WAIVER', 'Waiver'
        PREPAYMENT = 'PREPAYMENT', 'Prepayment'
        REFUND = 'REFUND', 'Refund'

    loan_account = models.ForeignKey(
        LoanAccount,
        on_delete=models.CASCADE,
        related_name='transactions'
    )
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    transaction_date = models.DateField(db_index=True)
    principal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    interest_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    reference_number = models.CharField(max_length=50, null=True, blank=True)
    payroll_period = models.ForeignKey(
        'payroll.PayrollPeriod',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='loan_transactions'
    )
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'loan_transactions'
        ordering = ['-transaction_date', '-created_at']

    def __str__(self):
        return f"{self.loan_account.loan_number} - {self.transaction_type} - {self.total_amount}"


class LoanGuarantor(BaseModel):
    """
    Loan guarantors.
    """
    loan_account = models.ForeignKey(
        LoanAccount,
        on_delete=models.CASCADE,
        related_name='guarantors'
    )
    guarantor = models.ForeignKey(
        'employees.Employee',
        on_delete=models.PROTECT,
        related_name='guaranteed_loans'
    )
    guarantee_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    guarantee_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    is_accepted = models.BooleanField(default=False)
    accepted_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'loan_guarantors'
        unique_together = ['loan_account', 'guarantor']

    def __str__(self):
        return f"{self.loan_account.loan_number} - {self.guarantor.employee_number}"


class BenefitType(BaseModel):
    """
    Types of benefits available.
    """
    code = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    category = models.CharField(
        max_length=20,
        choices=[
            ('MEDICAL', 'Medical'),
            ('INSURANCE', 'Insurance'),
            ('HOUSING', 'Housing'),
            ('TRANSPORT', 'Transport'),
            ('EDUCATION', 'Education'),
            ('PENSION', 'Pension'),
            ('OTHER', 'Other'),
        ],
        default='OTHER'
    )

    # Limits
    annual_limit = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    per_claim_limit = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Eligibility
    min_service_months = models.PositiveSmallIntegerField(default=0)
    eligible_grades = models.ManyToManyField(
        'organization.JobGrade',
        blank=True,
        related_name='eligible_benefits'
    )
    eligible_employment_types = models.JSONField(null=True, blank=True)

    is_taxable = models.BooleanField(default=False)
    requires_receipt = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'benefit_types'
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.code} - {self.name}"


class BenefitEnrollment(BaseModel):
    """
    Employee benefit enrollment.
    """
    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='benefit_enrollments'
    )
    benefit_type = models.ForeignKey(
        BenefitType,
        on_delete=models.PROTECT,
        related_name='enrollments'
    )
    enrollment_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    coverage_level = models.CharField(
        max_length=20,
        choices=[
            ('EMPLOYEE', 'Employee Only'),
            ('SPOUSE', 'Employee + Spouse'),
            ('FAMILY', 'Family'),
        ],
        default='EMPLOYEE'
    )
    employee_contribution = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    employer_contribution = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'benefit_enrollments'
        ordering = ['-enrollment_date']

    def __str__(self):
        return f"{self.employee.employee_number} - {self.benefit_type.name}"


class BenefitClaim(BaseModel):
    """
    Employee benefit claims.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        APPROVED = 'APPROVED', 'Approved'
        PARTIALLY_APPROVED = 'PARTIAL', 'Partially Approved'
        REJECTED = 'REJECTED', 'Rejected'
        PAID = 'PAID', 'Paid'
        CANCELLED = 'CANCELLED', 'Cancelled'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='benefit_claims'
    )
    benefit_type = models.ForeignKey(
        BenefitType,
        on_delete=models.PROTECT,
        related_name='claims'
    )

    claim_number = models.CharField(max_length=20, unique=True, db_index=True)
    claim_date = models.DateField(default=timezone.now)
    expense_date = models.DateField()
    claimed_amount = models.DecimalField(max_digits=12, decimal_places=2)
    approved_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    description = models.TextField()
    receipt_number = models.CharField(max_length=100, null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )

    # Approval
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_benefit_claims'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)

    # Payment
    paid_date = models.DateField(null=True, blank=True)
    payment_reference = models.CharField(max_length=50, null=True, blank=True)
    payroll_period = models.ForeignKey(
        'payroll.PayrollPeriod',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='benefit_claims'
    )

    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'benefit_claims'
        ordering = ['-claim_date']

    def __str__(self):
        return f"{self.claim_number} - {self.employee.employee_number}"


class ExpenseType(BaseModel):
    """
    Types of reimbursable expenses.
    """
    code = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    category = models.CharField(
        max_length=20,
        choices=[
            ('TRAVEL', 'Travel'),
            ('MEALS', 'Meals'),
            ('ACCOMMODATION', 'Accommodation'),
            ('FUEL', 'Fuel'),
            ('COMMUNICATION', 'Communication'),
            ('OFFICE', 'Office Supplies'),
            ('TRAINING', 'Training'),
            ('OTHER', 'Other'),
        ],
        default='OTHER'
    )
    per_diem_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    mileage_rate = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    max_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    requires_receipt = models.BooleanField(default=True)
    requires_approval = models.BooleanField(default=True)
    is_taxable = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'expense_types'
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.code} - {self.name}"


class ExpenseClaim(BaseModel):
    """
    Employee expense reimbursement claims.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        APPROVED = 'APPROVED', 'Approved'
        PARTIALLY_APPROVED = 'PARTIAL', 'Partially Approved'
        REJECTED = 'REJECTED', 'Rejected'
        PAID = 'PAID', 'Paid'
        CANCELLED = 'CANCELLED', 'Cancelled'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='expense_claims'
    )

    claim_number = models.CharField(max_length=20, unique=True, db_index=True)
    claim_date = models.DateField(default=timezone.now)
    trip_reference = models.CharField(max_length=50, null=True, blank=True)
    purpose = models.TextField()
    total_claimed = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_approved = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )

    # Approval
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_expense_claims'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)

    # Payment
    paid_date = models.DateField(null=True, blank=True)
    payment_reference = models.CharField(max_length=50, null=True, blank=True)
    payroll_period = models.ForeignKey(
        'payroll.PayrollPeriod',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='expense_claims'
    )

    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'expense_claims'
        ordering = ['-claim_date']

    def __str__(self):
        return f"{self.claim_number} - {self.employee.employee_number}"


class ExpenseClaimItem(BaseModel):
    """
    Individual expense items within a claim.
    """
    expense_claim = models.ForeignKey(
        ExpenseClaim,
        on_delete=models.CASCADE,
        related_name='items'
    )
    expense_type = models.ForeignKey(
        ExpenseType,
        on_delete=models.PROTECT,
        related_name='claim_items'
    )
    expense_date = models.DateField()
    description = models.TextField()
    quantity = models.DecimalField(max_digits=8, decimal_places=2, default=1)
    unit_amount = models.DecimalField(max_digits=10, decimal_places=2)
    claimed_amount = models.DecimalField(max_digits=12, decimal_places=2)
    approved_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    receipt_number = models.CharField(max_length=100, null=True, blank=True)
    is_approved = models.BooleanField(default=False)
    rejection_reason = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'expense_claim_items'
        ordering = ['expense_date']

    def __str__(self):
        return f"{self.expense_claim.claim_number} - {self.expense_type.name}"
