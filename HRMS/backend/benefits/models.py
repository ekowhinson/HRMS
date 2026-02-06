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
    class SalaryComponent(models.TextChoices):
        GROSS = 'GROSS', 'Gross Salary'
        BASIC = 'BASIC', 'Basic Salary'
        NET = 'NET', 'Net Salary'

    code = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)

    # Loan parameters
    max_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    max_salary_multiplier = models.DecimalField(
        max_digits=4, decimal_places=2, null=True, blank=True,
        help_text='Maximum loan amount as multiple of salary component'
    )
    salary_component = models.CharField(
        max_length=10,
        choices=SalaryComponent.choices,
        default=SalaryComponent.GROSS,
        help_text='Salary component to use for calculating max amount'
    )
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
    cooldown_months = models.PositiveSmallIntegerField(
        default=0,
        help_text='Months to wait after last deduction before applying again'
    )
    require_guarantor = models.BooleanField(default=False)
    number_of_guarantors = models.PositiveSmallIntegerField(default=0)

    # Processing
    max_deduction_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=33.33)
    approval_levels = models.PositiveSmallIntegerField(default=2)
    auto_post_to_payroll = models.BooleanField(
        default=True,
        help_text='Automatically create payroll deduction on approval'
    )

    # Link to payroll pay component for loan deduction
    deduction_pay_component = models.ForeignKey(
        'payroll.PayComponent',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='loan_types',
        help_text='Payroll component for loan deduction'
    )

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


# ========================================
# NHIA Specific Benefits
# ========================================

class FuneralGrantType(BaseModel):
    """
    Configuration for funeral grant amounts by beneficiary type.
    """
    class BeneficiaryType(models.TextChoices):
        SELF = 'SELF', 'Self (Employee)'
        SPOUSE = 'SPOUSE', 'Spouse'
        CHILD = 'CHILD', 'Child'
        PARENT = 'PARENT', 'Parent'
        DEPENDENT = 'DEPENDENT', 'Registered Dependent'

    beneficiary_type = models.CharField(
        max_length=20,
        choices=BeneficiaryType.choices,
        unique=True
    )
    grant_amount = models.DecimalField(max_digits=12, decimal_places=2)
    max_occurrences = models.PositiveSmallIntegerField(
        default=1,
        help_text='Maximum times this can be claimed (e.g., 3 for children)'
    )
    requires_documentation = models.BooleanField(default=True)
    documentation_required = models.TextField(
        blank=True,
        help_text='List of required documents (e.g., Death certificate, Burial permit)'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'funeral_grant_types'
        ordering = ['beneficiary_type']

    def __str__(self):
        return f"{self.get_beneficiary_type_display()} - GHS {self.grant_amount}"


class FuneralGrantClaim(BaseModel):
    """
    Employee funeral grant claims.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        PAID = 'PAID', 'Paid'
        CANCELLED = 'CANCELLED', 'Cancelled'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='funeral_grants'
    )
    claim_number = models.CharField(max_length=20, unique=True, db_index=True)
    claim_date = models.DateField(default=timezone.now)

    # Beneficiary details
    grant_type = models.ForeignKey(
        FuneralGrantType,
        on_delete=models.PROTECT,
        related_name='claims'
    )
    deceased_name = models.CharField(max_length=200)
    relationship = models.CharField(max_length=50)
    date_of_death = models.DateField()

    # For child beneficiaries - track which child number
    child_sequence = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text='For child claims, which child number (1, 2, or 3)'
    )

    # Linked dependent if applicable
    dependent = models.ForeignKey(
        'employees.Dependent',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='funeral_grants'
    )

    # Amounts
    grant_amount = models.DecimalField(max_digits=12, decimal_places=2)
    approved_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )

    # Documentation
    death_certificate_attached = models.BooleanField(default=False)
    burial_permit_attached = models.BooleanField(default=False)
    other_documents = models.TextField(blank=True)

    # Approval
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_funeral_grants'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    # Payment
    paid_date = models.DateField(null=True, blank=True)
    payment_reference = models.CharField(max_length=50, blank=True)

    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'funeral_grant_claims'
        ordering = ['-claim_date']
        indexes = [
            models.Index(fields=['employee', 'grant_type']),
            models.Index(fields=['status', '-claim_date']),
        ]

    def __str__(self):
        return f"{self.claim_number} - {self.employee.full_name} - {self.deceased_name}"

    def save(self, *args, **kwargs):
        if not self.claim_number:
            import uuid
            self.claim_number = f"FG-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)


class MedicalLensBenefit(BaseModel):
    """
    Configuration for medical lens benefit (once every 2 years).
    """
    code = models.CharField(max_length=20, default='MED_LENS', unique=True)
    name = models.CharField(max_length=100, default='Medical Lens Benefit')
    max_amount = models.DecimalField(max_digits=12, decimal_places=2)
    eligibility_period_months = models.PositiveSmallIntegerField(
        default=24,
        help_text='Months between eligible claims (e.g., 24 = once every 2 years)'
    )
    min_service_months = models.PositiveSmallIntegerField(default=6)
    requires_prescription = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'medical_lens_benefits'

    def __str__(self):
        return f"{self.name} - GHS {self.max_amount}"


class MedicalLensClaim(BaseModel):
    """
    Employee medical lens claims with eligibility tracking.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        PAID = 'PAID', 'Paid'
        CANCELLED = 'CANCELLED', 'Cancelled'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='medical_lens_claims'
    )
    benefit = models.ForeignKey(
        MedicalLensBenefit,
        on_delete=models.PROTECT,
        related_name='claims'
    )
    claim_number = models.CharField(max_length=20, unique=True, db_index=True)
    claim_date = models.DateField(default=timezone.now)
    expense_date = models.DateField()

    # Claim details
    claimed_amount = models.DecimalField(max_digits=12, decimal_places=2)
    approved_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    optical_provider = models.CharField(max_length=200, blank=True)
    prescription_number = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )

    # Eligibility tracking
    last_claim_date = models.DateField(
        null=True,
        blank=True,
        help_text='Date of previous claim (for eligibility check)'
    )
    next_eligible_date = models.DateField(
        null=True,
        blank=True,
        help_text='Date when employee becomes eligible again'
    )

    # Approval
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_lens_claims'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    # Payment
    paid_date = models.DateField(null=True, blank=True)
    payment_reference = models.CharField(max_length=50, blank=True)

    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'medical_lens_claims'
        ordering = ['-claim_date']
        indexes = [
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['next_eligible_date']),
        ]

    def __str__(self):
        return f"{self.claim_number} - {self.employee.full_name}"

    def save(self, *args, **kwargs):
        if not self.claim_number:
            import uuid
            self.claim_number = f"ML-{uuid.uuid4().hex[:8].upper()}"

        # Calculate next eligible date when approved
        if self.status == self.Status.APPROVED and not self.next_eligible_date:
            from dateutil.relativedelta import relativedelta
            self.next_eligible_date = self.claim_date + relativedelta(
                months=self.benefit.eligibility_period_months
            )

        super().save(*args, **kwargs)

    @classmethod
    def is_employee_eligible(cls, employee, benefit):
        """Check if employee is eligible for a new claim."""
        from django.db.models import Max

        # Check last approved claim
        last_claim = cls.objects.filter(
            employee=employee,
            benefit=benefit,
            status__in=[cls.Status.APPROVED, cls.Status.PAID]
        ).order_by('-claim_date').first()

        if not last_claim:
            return True, None

        if last_claim.next_eligible_date:
            if timezone.now().date() >= last_claim.next_eligible_date:
                return True, last_claim.next_eligible_date
            else:
                return False, last_claim.next_eligible_date

        return True, None


class ProfessionalSubscriptionType(BaseModel):
    """
    Types of professional subscriptions/memberships.
    """
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    max_annual_amount = models.DecimalField(max_digits=12, decimal_places=2)
    requires_proof_of_membership = models.BooleanField(default=True)
    requires_annual_renewal = models.BooleanField(default=True)
    eligible_grades = models.ManyToManyField(
        'organization.JobGrade',
        blank=True,
        related_name='eligible_professional_subs'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'professional_subscription_types'
        ordering = ['name']

    def __str__(self):
        return f"{self.code} - {self.name}"


class ProfessionalSubscription(BaseModel):
    """
    Employee professional subscription/membership claims.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        PAID = 'PAID', 'Paid'
        EXPIRED = 'EXPIRED', 'Expired'
        CANCELLED = 'CANCELLED', 'Cancelled'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='professional_subscriptions'
    )
    subscription_type = models.ForeignKey(
        ProfessionalSubscriptionType,
        on_delete=models.PROTECT,
        related_name='subscriptions'
    )

    claim_number = models.CharField(max_length=20, unique=True, db_index=True)
    claim_year = models.PositiveIntegerField()

    # Subscription details
    professional_body = models.CharField(max_length=200)
    membership_number = models.CharField(max_length=50, blank=True)
    subscription_period_start = models.DateField()
    subscription_period_end = models.DateField()
    claimed_amount = models.DecimalField(max_digits=12, decimal_places=2)
    approved_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )

    # Documentation
    receipt_attached = models.BooleanField(default=False)
    membership_proof_attached = models.BooleanField(default=False)

    # Approval
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_subscriptions'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    # Payment
    paid_date = models.DateField(null=True, blank=True)
    payment_reference = models.CharField(max_length=50, blank=True)

    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'professional_subscriptions'
        ordering = ['-claim_year', '-created_at']
        unique_together = ['employee', 'subscription_type', 'claim_year']
        indexes = [
            models.Index(fields=['employee', 'claim_year']),
            models.Index(fields=['status', 'claim_year']),
        ]

    def __str__(self):
        return f"{self.claim_number} - {self.employee.full_name} - {self.professional_body}"

    def save(self, *args, **kwargs):
        if not self.claim_number:
            import uuid
            self.claim_number = f"PS-{uuid.uuid4().hex[:8].upper()}"
        if not self.claim_year:
            self.claim_year = timezone.now().year
        super().save(*args, **kwargs)


class BenefitEligibilityRecord(BaseModel):
    """
    Track benefit eligibility and usage history.
    """
    class BenefitCategory(models.TextChoices):
        FUNERAL_GRANT = 'FUNERAL', 'Funeral Grant'
        MEDICAL_LENS = 'LENS', 'Medical Lens'
        PROFESSIONAL_SUB = 'PROF_SUB', 'Professional Subscription'
        OTHER = 'OTHER', 'Other Benefit'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='benefit_eligibility_records'
    )
    benefit_category = models.CharField(
        max_length=20,
        choices=BenefitCategory.choices
    )
    benefit_code = models.CharField(max_length=50)

    # Usage tracking
    last_claim_date = models.DateField(null=True, blank=True)
    last_claim_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    total_claims = models.PositiveIntegerField(default=0)
    total_amount_claimed = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    year_to_date_claims = models.PositiveIntegerField(default=0)
    year_to_date_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    # Eligibility
    next_eligible_date = models.DateField(null=True, blank=True)
    remaining_occurrences = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text='For benefits with max occurrences (e.g., funeral grant for children)'
    )
    is_eligible = models.BooleanField(default=True)
    eligibility_notes = models.TextField(blank=True)

    class Meta:
        db_table = 'benefit_eligibility_records'
        unique_together = ['employee', 'benefit_category', 'benefit_code']
        indexes = [
            models.Index(fields=['employee', 'benefit_category']),
            models.Index(fields=['next_eligible_date']),
        ]

    def __str__(self):
        return f"{self.employee.employee_number} - {self.benefit_category} - {self.benefit_code}"

    def update_on_claim(self, claim_date, amount, eligibility_period_months=None, max_occurrences=None):
        """Update eligibility record when a claim is approved."""
        from dateutil.relativedelta import relativedelta

        self.last_claim_date = claim_date
        self.last_claim_amount = amount
        self.total_claims += 1
        self.total_amount_claimed += amount

        # Update year-to-date
        current_year = timezone.now().year
        if claim_date.year == current_year:
            self.year_to_date_claims += 1
            self.year_to_date_amount += amount

        # Update eligibility
        if eligibility_period_months:
            self.next_eligible_date = claim_date + relativedelta(months=eligibility_period_months)
            self.is_eligible = False

        if max_occurrences and self.remaining_occurrences is not None:
            self.remaining_occurrences = max(0, self.remaining_occurrences - 1)
            if self.remaining_occurrences == 0:
                self.is_eligible = False

        self.save()


# ========================================
# Third-Party Loan/Deduction Management
# ========================================

class ThirdPartyLender(BaseModel):
    """
    Third-party organizations that receive deductions through payroll.
    E.g., Credit Unions, Student Loan Trust Fund, Ministry of Works (rent), etc.
    """
    class LenderType(models.TextChoices):
        CREDIT_UNION = 'CREDIT_UNION', 'Credit Union'
        STUDENT_LOAN = 'STUDENT_LOAN', 'Student Loan Trust Fund'
        RENT = 'RENT', 'Rent/Housing (Ministry of Works)'
        INSURANCE = 'INSURANCE', 'Insurance Company'
        WELFARE = 'WELFARE', 'Staff Welfare'
        COOPERATIVE = 'COOP', 'Cooperative Society'
        BANK = 'BANK', 'Bank/Financial Institution'
        OTHER = 'OTHER', 'Other'

    code = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    lender_type = models.CharField(
        max_length=20,
        choices=LenderType.choices,
        default=LenderType.OTHER
    )
    description = models.TextField(blank=True)

    # Contact Information
    contact_person = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)

    # Bank details for remittances
    bank_name = models.CharField(max_length=100, blank=True)
    bank_branch = models.CharField(max_length=100, blank=True)
    account_number = models.CharField(max_length=50, blank=True)
    account_name = models.CharField(max_length=200, blank=True)

    # Settings
    default_deduction_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text='Default percentage to deduct if applicable (e.g., 10% for rent)'
    )
    max_deduction_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=33.33,
        help_text='Maximum percentage of salary that can be deducted'
    )
    remittance_frequency = models.CharField(
        max_length=20,
        choices=[
            ('MONTHLY', 'Monthly'),
            ('QUARTERLY', 'Quarterly'),
            ('ANNUALLY', 'Annually'),
        ],
        default='MONTHLY'
    )

    # Payroll integration
    deduction_pay_component = models.ForeignKey(
        'payroll.PayComponent',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='third_party_lenders',
        help_text='Payroll component for this deduction'
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'third_party_lenders'
        ordering = ['name']

    def __str__(self):
        return f"{self.code} - {self.name}"


class ThirdPartyDeduction(BaseModel):
    """
    Employee enrollment in third-party deduction schemes.
    """
    class DeductionType(models.TextChoices):
        FIXED_AMOUNT = 'FIXED', 'Fixed Amount'
        PERCENTAGE = 'PERCENT', 'Percentage of Salary'
        LOAN_REPAYMENT = 'LOAN', 'Loan Repayment'
        SAVINGS = 'SAVINGS', 'Savings Contribution'

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PENDING = 'PENDING', 'Pending Approval'
        ACTIVE = 'ACTIVE', 'Active'
        SUSPENDED = 'SUSPENDED', 'Suspended'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='third_party_deductions'
    )
    lender = models.ForeignKey(
        ThirdPartyLender,
        on_delete=models.PROTECT,
        related_name='deductions'
    )

    deduction_number = models.CharField(max_length=20, unique=True, db_index=True)
    external_reference = models.CharField(
        max_length=50, blank=True,
        help_text='Reference number from the lender (e.g., loan account number)'
    )

    deduction_type = models.CharField(
        max_length=20,
        choices=DeductionType.choices,
        default=DeductionType.FIXED_AMOUNT
    )

    # Deduction configuration
    deduction_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text='Fixed amount to deduct (if type is FIXED)'
    )
    deduction_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text='Percentage to deduct (if type is PERCENT)'
    )
    salary_component = models.CharField(
        max_length=20,
        choices=[
            ('GROSS', 'Gross Salary'),
            ('BASIC', 'Basic Salary'),
            ('NET', 'Net Salary'),
        ],
        default='GROSS',
        help_text='Salary component to calculate percentage from'
    )

    # Loan-specific fields (if deduction is for loan repayment)
    principal_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    interest_rate = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    total_loan_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    total_repaid = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )
    outstanding_balance = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )

    # Timeline
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    tenure_months = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text='Expected duration in months'
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )
    total_deductions = models.PositiveIntegerField(default=0)
    total_deducted_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    last_deduction_date = models.DateField(null=True, blank=True)

    # Approval
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_third_party_deductions'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Purpose and notes
    purpose = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'third_party_deductions'
        ordering = ['-start_date']
        indexes = [
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['lender', 'status']),
        ]

    def __str__(self):
        return f"{self.deduction_number} - {self.employee.full_name} - {self.lender.name}"

    def save(self, *args, **kwargs):
        if not self.deduction_number:
            import uuid
            prefix = self.lender.code[:3].upper() if self.lender else 'TPD'
            self.deduction_number = f"{prefix}-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def calculate_deduction(self, gross_salary, basic_salary=None, net_salary=None):
        """Calculate the deduction amount for a payroll period."""
        if self.deduction_type == self.DeductionType.FIXED_AMOUNT:
            return self.deduction_amount or 0

        elif self.deduction_type == self.DeductionType.PERCENTAGE:
            if self.salary_component == 'GROSS':
                base = gross_salary
            elif self.salary_component == 'BASIC':
                base = basic_salary or gross_salary
            else:
                base = net_salary or gross_salary

            percentage = self.deduction_percentage or 0
            return (base * percentage / 100).quantize(Decimal('0.01'))

        elif self.deduction_type == self.DeductionType.LOAN_REPAYMENT:
            return self.deduction_amount or 0

        return Decimal('0')

    def record_deduction(self, amount, payroll_period, deduction_date=None):
        """Record a deduction was made."""
        self.total_deductions += 1
        self.total_deducted_amount += amount
        self.last_deduction_date = deduction_date or timezone.now().date()

        if self.outstanding_balance is not None:
            self.outstanding_balance = max(0, self.outstanding_balance - amount)
            if self.outstanding_balance == 0:
                self.status = self.Status.COMPLETED

        self.save()


class ThirdPartyDeductionHistory(BaseModel):
    """
    Track individual deductions for third-party schemes.
    """
    deduction = models.ForeignKey(
        ThirdPartyDeduction,
        on_delete=models.CASCADE,
        related_name='history'
    )
    payroll_period = models.ForeignKey(
        'payroll.PayrollPeriod',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='third_party_deductions'
    )
    deduction_date = models.DateField(db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    reference = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'third_party_deduction_history'
        ordering = ['-deduction_date']
        indexes = [
            models.Index(fields=['deduction', 'payroll_period']),
        ]

    def __str__(self):
        return f"{self.deduction.deduction_number} - {self.deduction_date} - {self.amount}"


class ThirdPartyRemittance(BaseModel):
    """
    Track remittances to third-party organizations.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        PAID = 'PAID', 'Paid'
        CANCELLED = 'CANCELLED', 'Cancelled'

    lender = models.ForeignKey(
        ThirdPartyLender,
        on_delete=models.PROTECT,
        related_name='remittances'
    )
    payroll_period = models.ForeignKey(
        'payroll.PayrollPeriod',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='third_party_remittances'
    )

    remittance_number = models.CharField(max_length=20, unique=True, db_index=True)
    remittance_date = models.DateField()

    # Amounts
    total_employees = models.PositiveIntegerField(default=0)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2)

    # Breakdown (stored as JSON for flexibility)
    breakdown = models.JSONField(
        default=list,
        help_text='List of employee deductions: [{employee_id, employee_number, name, amount, reference}]'
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )

    # Payment details
    payment_date = models.DateField(null=True, blank=True)
    payment_reference = models.CharField(max_length=50, blank=True)
    payment_method = models.CharField(max_length=50, blank=True)
    bank_reference = models.CharField(max_length=100, blank=True)

    # Approval
    prepared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='prepared_remittances'
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_remittances'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'third_party_remittances'
        ordering = ['-remittance_date']
        indexes = [
            models.Index(fields=['lender', 'payroll_period']),
            models.Index(fields=['status', 'remittance_date']),
        ]

    def __str__(self):
        return f"{self.remittance_number} - {self.lender.name} - {self.total_amount}"

    def save(self, *args, **kwargs):
        if not self.remittance_number:
            import uuid
            self.remittance_number = f"REM-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def generate_breakdown(self, payroll_period):
        """Generate remittance breakdown from payroll deductions."""
        deductions = ThirdPartyDeductionHistory.objects.filter(
            deduction__lender=self.lender,
            payroll_period=payroll_period
        ).select_related('deduction__employee')

        breakdown = []
        total = Decimal('0')

        for hist in deductions:
            employee = hist.deduction.employee
            breakdown.append({
                'employee_id': employee.id,
                'employee_number': employee.employee_number,
                'name': employee.full_name,
                'amount': float(hist.amount),
                'reference': hist.deduction.external_reference,
                'deduction_number': hist.deduction.deduction_number,
            })
            total += hist.amount

        self.breakdown = breakdown
        self.total_employees = len(breakdown)
        self.total_amount = total
        self.save()

        return len(breakdown)


class CreditUnionAccount(BaseModel):
    """
    Specific tracking for Credit Union memberships.
    Includes both loan and savings components.
    """
    class AccountType(models.TextChoices):
        SAVINGS = 'SAVINGS', 'Savings Account'
        LOAN = 'LOAN', 'Loan Account'
        BOTH = 'BOTH', 'Savings + Loan'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='credit_union_accounts'
    )
    credit_union = models.ForeignKey(
        ThirdPartyLender,
        on_delete=models.PROTECT,
        related_name='cu_accounts',
        limit_choices_to={'lender_type': ThirdPartyLender.LenderType.CREDIT_UNION}
    )

    member_number = models.CharField(max_length=50)
    account_type = models.CharField(
        max_length=20,
        choices=AccountType.choices,
        default=AccountType.BOTH
    )
    membership_date = models.DateField(null=True, blank=True)

    # Savings component
    savings_contribution = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_savings = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    # Loan component (linked to ThirdPartyDeduction for actual tracking)
    active_loan_deduction = models.ForeignKey(
        ThirdPartyDeduction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cu_account'
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'credit_union_accounts'
        unique_together = ['employee', 'credit_union']

    def __str__(self):
        return f"{self.member_number} - {self.employee.full_name}"


class StudentLoanAccount(BaseModel):
    """
    Track Student Loan Trust Fund (SLTF) deductions.
    """
    class RepaymentStatus(models.TextChoices):
        NOT_STARTED = 'NOT_STARTED', 'Not Started'
        ACTIVE = 'ACTIVE', 'Active Repayment'
        DEFERRED = 'DEFERRED', 'Deferred'
        COMPLETED = 'COMPLETED', 'Fully Repaid'
        DEFAULTED = 'DEFAULTED', 'Defaulted'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='student_loan_accounts'
    )

    # SLTF details
    sltf_account_number = models.CharField(max_length=50, unique=True)
    beneficiary_id = models.CharField(max_length=50, blank=True)
    institution_attended = models.CharField(max_length=200, blank=True)
    program_studied = models.CharField(max_length=200, blank=True)
    graduation_year = models.PositiveIntegerField(null=True, blank=True)

    # Loan details
    original_loan_amount = models.DecimalField(max_digits=12, decimal_places=2)
    total_with_interest = models.DecimalField(max_digits=12, decimal_places=2)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    monthly_deduction = models.DecimalField(max_digits=12, decimal_places=2)

    # Balance tracking
    total_repaid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    outstanding_balance = models.DecimalField(max_digits=12, decimal_places=2)

    # Status
    repayment_status = models.CharField(
        max_length=20,
        choices=RepaymentStatus.choices,
        default=RepaymentStatus.ACTIVE
    )
    repayment_start_date = models.DateField(null=True, blank=True)
    expected_completion_date = models.DateField(null=True, blank=True)
    actual_completion_date = models.DateField(null=True, blank=True)

    # Linked deduction
    active_deduction = models.ForeignKey(
        ThirdPartyDeduction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='student_loan'
    )

    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'student_loan_accounts'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.sltf_account_number} - {self.employee.full_name}"


class RentDeduction(BaseModel):
    """
    Track Ministry of Works rent deductions (typically 10% of basic salary).
    """
    class HousingType(models.TextChoices):
        GOVERNMENT = 'GOVT', 'Government Bungalow'
        OFFICIAL = 'OFFICIAL', 'Official Quarters'
        SUBSIDIZED = 'SUBSIDIZED', 'Subsidized Housing'
        OTHER = 'OTHER', 'Other'

    employee = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='rent_deductions'
    )

    # Housing details
    housing_type = models.CharField(
        max_length=20,
        choices=HousingType.choices,
        default=HousingType.GOVERNMENT
    )
    property_address = models.TextField(blank=True)
    property_number = models.CharField(max_length=50, blank=True)

    # Deduction details
    deduction_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=10.00,
        help_text='Percentage of basic salary'
    )
    fixed_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text='Fixed rent amount if not percentage-based'
    )

    # Timeline
    occupancy_start_date = models.DateField()
    occupancy_end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    # Linked deduction
    active_deduction = models.ForeignKey(
        ThirdPartyDeduction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rent_account'
    )

    # Totals
    total_deducted = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'rent_deductions'
        ordering = ['-occupancy_start_date']

    def __str__(self):
        return f"{self.employee.full_name} - {self.housing_type} - {self.property_address[:30] if self.property_address else 'N/A'}"
