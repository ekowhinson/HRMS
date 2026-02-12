"""
Finance and accounting models for HRMS.
Implements double-entry bookkeeping, budgets, AP/AR, and bank reconciliation.
"""

from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

from core.models import BaseModel


class Account(BaseModel):
    """Chart of Accounts - hierarchical account structure."""
    class AccountType(models.TextChoices):
        ASSET = 'ASSET', 'Asset'
        LIABILITY = 'LIABILITY', 'Liability'
        EQUITY = 'EQUITY', 'Equity'
        REVENUE = 'REVENUE', 'Revenue'
        EXPENSE = 'EXPENSE', 'Expense'

    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=200)
    account_type = models.CharField(max_length=20, choices=AccountType.choices)
    parent = models.ForeignKey(
        'self', on_delete=models.PROTECT, null=True, blank=True,
        related_name='children'
    )
    description = models.TextField(blank=True)
    is_header = models.BooleanField(default=False, help_text='Header accounts cannot have transactions')
    is_active = models.BooleanField(default=True)
    currency = models.CharField(max_length=3, default='USD')
    normal_balance = models.CharField(
        max_length=6,
        choices=[('DEBIT', 'Debit'), ('CREDIT', 'Credit')],
        blank=True
    )

    class Meta:
        db_table = 'finance_accounts'
        ordering = ['code']
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f"{self.code} - {self.name}"

    def save(self, *args, **kwargs):
        if not self.normal_balance:
            if self.account_type in ('ASSET', 'EXPENSE'):
                self.normal_balance = 'DEBIT'
            else:
                self.normal_balance = 'CREDIT'
        super().save(*args, **kwargs)


class FiscalYear(BaseModel):
    """Financial year periods."""
    name = models.CharField(max_length=50)
    start_date = models.DateField()
    end_date = models.DateField()
    is_closed = models.BooleanField(default=False)

    class Meta:
        db_table = 'finance_fiscal_years'
        ordering = ['-start_date']

    def __str__(self):
        return self.name

    def clean(self):
        if self.start_date and self.end_date and self.start_date >= self.end_date:
            raise ValidationError('Start date must be before end date.')


class FiscalPeriod(BaseModel):
    """Monthly/quarterly periods within a fiscal year."""
    fiscal_year = models.ForeignKey(
        FiscalYear, on_delete=models.CASCADE, related_name='periods'
    )
    period_number = models.PositiveSmallIntegerField()
    name = models.CharField(max_length=50)
    start_date = models.DateField()
    end_date = models.DateField()
    is_closed = models.BooleanField(default=False)

    class Meta:
        db_table = 'finance_fiscal_periods'
        ordering = ['fiscal_year', 'period_number']
        unique_together = [('fiscal_year', 'period_number')]

    def __str__(self):
        return f"{self.fiscal_year.name} - {self.name}"


class JournalEntry(BaseModel):
    """Double-entry journal - header record."""
    class EntryStatus(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        POSTED = 'POSTED', 'Posted'
        REVERSED = 'REVERSED', 'Reversed'

    entry_number = models.CharField(max_length=30, db_index=True)
    journal_date = models.DateField(db_index=True)
    fiscal_period = models.ForeignKey(
        FiscalPeriod, on_delete=models.PROTECT, related_name='journal_entries'
    )
    description = models.TextField()
    source = models.CharField(max_length=50, blank=True, help_text='e.g. PAYROLL, AP, AR, MANUAL')
    source_reference = models.CharField(max_length=100, blank=True)
    status = models.CharField(
        max_length=10, choices=EntryStatus.choices, default=EntryStatus.DRAFT
    )
    total_debit = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_credit = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='posted_journals'
    )
    posted_at = models.DateTimeField(null=True, blank=True)
    reversal_of = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reversals'
    )

    class Meta:
        db_table = 'finance_journal_entries'
        ordering = ['-journal_date', '-created_at']
        unique_together = [('tenant', 'entry_number')]
        indexes = [
            models.Index(fields=['status', '-journal_date']),
            models.Index(fields=['source', 'source_reference']),
        ]

    def __str__(self):
        return f"{self.entry_number} - {self.description[:50]}"


class JournalLine(BaseModel):
    """Journal entry line items - debit or credit."""
    journal_entry = models.ForeignKey(
        JournalEntry, on_delete=models.CASCADE, related_name='lines'
    )
    account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name='journal_lines'
    )
    description = models.CharField(max_length=255, blank=True)
    debit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    credit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    cost_center = models.ForeignKey(
        'organization.CostCenter', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='journal_lines'
    )
    department = models.ForeignKey(
        'organization.Department', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='journal_lines'
    )

    class Meta:
        db_table = 'finance_journal_lines'
        ordering = ['journal_entry', 'id']

    def __str__(self):
        amt = self.debit_amount if self.debit_amount else self.credit_amount
        side = 'DR' if self.debit_amount else 'CR'
        return f"{self.account.code} {side} {amt}"


class Budget(BaseModel):
    """Budget per account per dimension."""
    class BudgetStatus(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        APPROVED = 'APPROVED', 'Approved'
        REVISED = 'REVISED', 'Revised'
        CLOSED = 'CLOSED', 'Closed'

    fiscal_year = models.ForeignKey(
        FiscalYear, on_delete=models.CASCADE, related_name='budgets'
    )
    account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name='budgets'
    )
    cost_center = models.ForeignKey(
        'organization.CostCenter', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='budgets'
    )
    department = models.ForeignKey(
        'organization.Department', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='budgets'
    )
    original_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    revised_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    status = models.CharField(
        max_length=10, choices=BudgetStatus.choices, default=BudgetStatus.DRAFT
    )

    class Meta:
        db_table = 'finance_budgets'
        ordering = ['fiscal_year', 'account__code']

    def __str__(self):
        return f"Budget: {self.account.code} - {self.fiscal_year.name}"

    @property
    def current_amount(self):
        return self.revised_amount if self.revised_amount else self.original_amount


class BudgetCommitment(BaseModel):
    """Encumbrance tracking for budgets."""
    class CommitmentStatus(models.TextChoices):
        COMMITTED = 'COMMITTED', 'Committed'
        RELEASED = 'RELEASED', 'Released'
        CONSUMED = 'CONSUMED', 'Consumed'

    budget = models.ForeignKey(
        Budget, on_delete=models.CASCADE, related_name='commitments'
    )
    commitment_date = models.DateField()
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    source = models.CharField(max_length=50, help_text='e.g. PO, CONTRACT')
    source_reference = models.CharField(max_length=100)
    status = models.CharField(
        max_length=10, choices=CommitmentStatus.choices, default=CommitmentStatus.COMMITTED
    )

    class Meta:
        db_table = 'finance_budget_commitments'
        ordering = ['-commitment_date']

    def __str__(self):
        return f"Commitment: {self.source_reference} - {self.amount}"


class Vendor(BaseModel):
    """Vendor/supplier master."""
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=200)
    tax_id = models.CharField(max_length=50, blank=True)
    payment_terms_days = models.PositiveSmallIntegerField(default=30)
    default_expense_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='default_vendor_account'
    )
    contact_name = models.CharField(max_length=100, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    bank_name = models.CharField(max_length=100, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    bank_branch = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'finance_vendors'
        ordering = ['name']
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f"{self.code} - {self.name}"


class VendorInvoice(BaseModel):
    """Accounts payable invoices."""
    class InvoiceStatus(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PENDING = 'PENDING', 'Pending Approval'
        APPROVED = 'APPROVED', 'Approved'
        PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
        PAID = 'PAID', 'Paid'
        CANCELLED = 'CANCELLED', 'Cancelled'

    vendor = models.ForeignKey(
        Vendor, on_delete=models.PROTECT, related_name='invoices'
    )
    invoice_number = models.CharField(max_length=50)
    invoice_date = models.DateField()
    due_date = models.DateField()
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    status = models.CharField(
        max_length=20, choices=InvoiceStatus.choices, default=InvoiceStatus.DRAFT
    )
    journal_entry = models.ForeignKey(
        JournalEntry, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='vendor_invoices'
    )
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'finance_vendor_invoices'
        ordering = ['-invoice_date']
        indexes = [
            models.Index(fields=['vendor', 'status']),
            models.Index(fields=['status', '-due_date']),
        ]

    def __str__(self):
        return f"{self.vendor.name} - {self.invoice_number}"

    @property
    def balance_due(self):
        return self.total_amount - self.paid_amount


class Customer(BaseModel):
    """Customer master for AR."""
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=200)
    payment_terms_days = models.PositiveSmallIntegerField(default=30)
    default_revenue_account = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='default_customer_account'
    )
    contact_name = models.CharField(max_length=100, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'finance_customers'
        ordering = ['name']
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f"{self.code} - {self.name}"


class CustomerInvoice(BaseModel):
    """Accounts receivable invoices."""
    class InvoiceStatus(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SENT = 'SENT', 'Sent'
        PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
        PAID = 'PAID', 'Paid'
        OVERDUE = 'OVERDUE', 'Overdue'
        CANCELLED = 'CANCELLED', 'Cancelled'

    customer = models.ForeignKey(
        Customer, on_delete=models.PROTECT, related_name='invoices'
    )
    invoice_number = models.CharField(max_length=50)
    invoice_date = models.DateField()
    due_date = models.DateField()
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    status = models.CharField(
        max_length=20, choices=InvoiceStatus.choices, default=InvoiceStatus.DRAFT
    )
    journal_entry = models.ForeignKey(
        JournalEntry, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='customer_invoices'
    )
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'finance_customer_invoices'
        ordering = ['-invoice_date']

    def __str__(self):
        return f"{self.customer.name} - {self.invoice_number}"

    @property
    def balance_due(self):
        return self.total_amount - self.paid_amount


class OrganizationBankAccount(BaseModel):
    """Organization bank accounts for finance operations."""
    name = models.CharField(max_length=100)
    account_number = models.CharField(max_length=50)
    bank_name = models.CharField(max_length=100)
    branch = models.CharField(max_length=100, blank=True)
    gl_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name='bank_accounts'
    )
    currency = models.CharField(max_length=3, default='USD')
    current_balance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'finance_bank_accounts'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.bank_name})"


class Payment(BaseModel):
    """Payment records for AP and AR."""
    class PaymentMethod(models.TextChoices):
        BANK_TRANSFER = 'BANK_TRANSFER', 'Bank Transfer'
        CHECK = 'CHECK', 'Check'
        CASH = 'CASH', 'Cash'
        MOBILE_MONEY = 'MOBILE_MONEY', 'Mobile Money'
        OTHER = 'OTHER', 'Other'

    payment_number = models.CharField(max_length=30, db_index=True)
    payment_date = models.DateField()
    vendor = models.ForeignKey(
        Vendor, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payments'
    )
    customer = models.ForeignKey(
        Customer, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payments'
    )
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    payment_method = models.CharField(
        max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.BANK_TRANSFER
    )
    bank_account = models.ForeignKey(
        OrganizationBankAccount, on_delete=models.PROTECT, related_name='payments'
    )
    journal_entry = models.ForeignKey(
        JournalEntry, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payments'
    )
    reference = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'finance_payments'
        ordering = ['-payment_date']
        unique_together = [('tenant', 'payment_number')]

    def __str__(self):
        return f"{self.payment_number} - {self.amount}"


class BankStatement(BaseModel):
    """Imported bank statements for reconciliation."""
    bank_account = models.ForeignKey(
        OrganizationBankAccount, on_delete=models.CASCADE, related_name='statements'
    )
    statement_date = models.DateField()
    opening_balance = models.DecimalField(max_digits=15, decimal_places=2)
    closing_balance = models.DecimalField(max_digits=15, decimal_places=2)
    import_file_name = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'finance_bank_statements'
        ordering = ['-statement_date']

    def __str__(self):
        return f"{self.bank_account.name} - {self.statement_date}"


class BankStatementLine(BaseModel):
    """Individual transactions on a bank statement."""
    statement = models.ForeignKey(
        BankStatement, on_delete=models.CASCADE, related_name='lines'
    )
    transaction_date = models.DateField()
    description = models.CharField(max_length=255)
    debit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    credit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    is_reconciled = models.BooleanField(default=False)
    matched_payment = models.ForeignKey(
        Payment, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='statement_lines'
    )
    reference = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'finance_bank_statement_lines'
        ordering = ['transaction_date']

    def __str__(self):
        return f"{self.transaction_date} - {self.description}"


class ExchangeRate(BaseModel):
    """Currency exchange rates."""
    from_currency = models.CharField(max_length=3)
    to_currency = models.CharField(max_length=3)
    rate = models.DecimalField(max_digits=12, decimal_places=6)
    effective_date = models.DateField()

    class Meta:
        db_table = 'finance_exchange_rates'
        ordering = ['-effective_date']
        unique_together = [('from_currency', 'to_currency', 'effective_date')]

    def __str__(self):
        return f"{self.from_currency}/{self.to_currency} = {self.rate} ({self.effective_date})"
