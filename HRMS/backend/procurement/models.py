"""Models for procurement module."""

from django.db import models
from django.conf import settings
from core.models import BaseModel


class PurchaseRequisition(BaseModel):
    """Department purchase request."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        CANCELLED = 'CANCELLED', 'Cancelled'
        ORDERED = 'ORDERED', 'Ordered'

    requisition_number = models.CharField(max_length=50, unique=True)
    requested_by = models.ForeignKey('employees.Employee', on_delete=models.PROTECT, related_name='purchase_requisitions')
    department = models.ForeignKey('organization.Department', on_delete=models.PROTECT, related_name='purchase_requisitions')
    cost_center = models.ForeignKey('organization.CostCenter', on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_requisitions')
    requisition_date = models.DateField()
    required_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    justification = models.TextField(blank=True)
    total_estimated = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_requisitions')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    class Meta:
        ordering = ['-requisition_date']

    def __str__(self):
        return f"{self.requisition_number} - {self.department}"


class RequisitionItem(BaseModel):
    """Line item on a purchase requisition."""
    requisition = models.ForeignKey(PurchaseRequisition, on_delete=models.CASCADE, related_name='items')
    description = models.CharField(max_length=500)
    item = models.ForeignKey('inventory.Item', on_delete=models.SET_NULL, null=True, blank=True, related_name='requisition_items')
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_of_measure = models.CharField(max_length=20, default='EA')
    unit_price = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    estimated_total = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    budget = models.ForeignKey('finance.Budget', on_delete=models.SET_NULL, null=True, blank=True, related_name='requisition_items')
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.description} (Qty: {self.quantity})"

    def save(self, *args, **kwargs):
        self.estimated_total = self.quantity * self.unit_price
        super().save(*args, **kwargs)


class PurchaseOrder(BaseModel):
    """Purchase order to vendor."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        APPROVED = 'APPROVED', 'Approved'
        SENT = 'SENT', 'Sent to Vendor'
        PARTIAL = 'PARTIAL', 'Partially Received'
        RECEIVED = 'RECEIVED', 'Fully Received'
        INVOICED = 'INVOICED', 'Invoiced'
        CLOSED = 'CLOSED', 'Closed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    po_number = models.CharField(max_length=50, unique=True)
    vendor = models.ForeignKey('finance.Vendor', on_delete=models.PROTECT, related_name='purchase_orders')
    requisition = models.ForeignKey(PurchaseRequisition, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_orders')
    order_date = models.DateField()
    delivery_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    shipping_address = models.TextField(blank=True)
    payment_terms = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_pos')
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-order_date']

    def __str__(self):
        return f"{self.po_number} - {self.vendor}"


class PurchaseOrderItem(BaseModel):
    """Line item on a purchase order."""
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    requisition_item = models.ForeignKey(RequisitionItem, on_delete=models.SET_NULL, null=True, blank=True, related_name='po_items')
    description = models.CharField(max_length=500)
    item = models.ForeignKey('inventory.Item', on_delete=models.SET_NULL, null=True, blank=True, related_name='po_items')
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_of_measure = models.CharField(max_length=20, default='EA')
    unit_price = models.DecimalField(max_digits=15, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    received_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.description} (Qty: {self.quantity})"

    def save(self, *args, **kwargs):
        self.total = self.quantity * self.unit_price
        super().save(*args, **kwargs)


class GoodsReceiptNote(BaseModel):
    """Goods receipt against a purchase order."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        INSPECTING = 'INSPECTING', 'Under Inspection'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        PARTIAL = 'PARTIAL', 'Partially Accepted'
        REJECTED = 'REJECTED', 'Rejected'

    grn_number = models.CharField(max_length=50, unique=True)
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, related_name='grns')
    received_by = models.ForeignKey('employees.Employee', on_delete=models.PROTECT, related_name='goods_receipts')
    receipt_date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    inspection_notes = models.TextField(blank=True)
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True, related_name='goods_receipts')

    class Meta:
        ordering = ['-receipt_date']

    def __str__(self):
        return f"{self.grn_number} - PO: {self.purchase_order.po_number}"


class GRNItem(BaseModel):
    """Line item on a goods receipt note."""
    grn = models.ForeignKey(GoodsReceiptNote, on_delete=models.CASCADE, related_name='items')
    po_item = models.ForeignKey(PurchaseOrderItem, on_delete=models.PROTECT, related_name='grn_items')
    received_qty = models.DecimalField(max_digits=12, decimal_places=2)
    accepted_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    rejected_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    rejection_reason = models.TextField(blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"GRN Item: {self.po_item.description} (Received: {self.received_qty})"


class Contract(BaseModel):
    """Vendor contract."""

    class ContractType(models.TextChoices):
        SERVICE = 'SERVICE', 'Service'
        SUPPLY = 'SUPPLY', 'Supply'
        FRAMEWORK = 'FRAMEWORK', 'Framework'
        MAINTENANCE = 'MAINTENANCE', 'Maintenance'

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        ACTIVE = 'ACTIVE', 'Active'
        EXPIRED = 'EXPIRED', 'Expired'
        TERMINATED = 'TERMINATED', 'Terminated'
        RENEWED = 'RENEWED', 'Renewed'

    contract_number = models.CharField(max_length=50, unique=True)
    vendor = models.ForeignKey('finance.Vendor', on_delete=models.PROTECT, related_name='contracts')
    contract_type = models.CharField(max_length=20, choices=ContractType.choices)
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    value = models.DecimalField(max_digits=15, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    renewal_date = models.DateField(null=True, blank=True)
    auto_renew = models.BooleanField(default=False)
    terms_and_conditions = models.TextField(blank=True)
    signed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='signed_contracts')
    signed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.contract_number} - {self.vendor}"


class ContractMilestone(BaseModel):
    """Milestone on a contract."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        OVERDUE = 'OVERDUE', 'Overdue'

    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='milestones')
    description = models.CharField(max_length=500)
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    completion_date = models.DateField(null=True, blank=True)
    deliverables = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['due_date']

    def __str__(self):
        return f"{self.contract.contract_number} - {self.description}"


# =========================================================================
# RFQ (Request for Quotation)
# =========================================================================

class RequestForQuotation(BaseModel):
    """Request for quotation sent to vendors."""
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SENT = 'SENT', 'Sent'
        RECEIVED = 'RECEIVED', 'Responses Received'
        EVALUATED = 'EVALUATED', 'Evaluated'
        AWARDED = 'AWARDED', 'Awarded'
        CANCELLED = 'CANCELLED', 'Cancelled'

    rfq_number = models.CharField(max_length=50, unique=True)
    requisition = models.ForeignKey(
        PurchaseRequisition, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='rfqs'
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    submission_deadline = models.DateTimeField(null=True, blank=True)
    evaluation_criteria = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"RFQ {self.rfq_number}"


class RFQVendor(BaseModel):
    """Vendor invited to / responding to an RFQ."""
    rfq = models.ForeignKey(RequestForQuotation, on_delete=models.CASCADE, related_name='vendors')
    vendor = models.ForeignKey('finance.Vendor', on_delete=models.PROTECT, related_name='rfq_responses')
    invited_at = models.DateTimeField(null=True, blank=True)
    response_received = models.BooleanField(default=False)
    quoted_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    delivery_days = models.PositiveIntegerField(null=True, blank=True)
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-score']
        unique_together = [('rfq', 'vendor')]

    def __str__(self):
        return f"{self.rfq.rfq_number} - {self.vendor}"


class RFQItem(BaseModel):
    """Item line on an RFQ."""
    rfq = models.ForeignKey(RequestForQuotation, on_delete=models.CASCADE, related_name='items')
    requisition_item = models.ForeignKey(
        RequisitionItem, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='rfq_items'
    )
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    specifications = models.TextField(blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.description} (Qty: {self.quantity})"


# =========================================================================
# Vendor Scorecard & Blacklist
# =========================================================================

class VendorScorecard(BaseModel):
    """Periodic vendor performance evaluation."""
    vendor = models.ForeignKey('finance.Vendor', on_delete=models.PROTECT, related_name='scorecards')
    period_start = models.DateField()
    period_end = models.DateField()
    delivery_score = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text='0-100')
    quality_score = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text='0-100')
    price_score = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text='0-100')
    compliance_score = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text='0-100')
    overall_score = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text='0-100')
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-period_end']

    def __str__(self):
        return f"{self.vendor} — {self.period_start} to {self.period_end}: {self.overall_score}"

    def save(self, *args, **kwargs):
        # Auto-calculate overall score as average
        scores = [self.delivery_score, self.quality_score, self.price_score, self.compliance_score]
        non_zero = [s for s in scores if s > 0]
        if non_zero:
            self.overall_score = sum(non_zero) / len(non_zero)
        super().save(*args, **kwargs)


class VendorBlacklist(BaseModel):
    """Vendor blacklist / suspension record."""
    vendor = models.ForeignKey('finance.Vendor', on_delete=models.PROTECT, related_name='blacklist_records')
    reason = models.TextField()
    blacklisted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='vendor_blacklists'
    )
    blacklisted_at = models.DateTimeField(auto_now_add=True)
    review_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-blacklisted_at']

    def __str__(self):
        return f"{self.vendor} — blacklisted {'(active)' if self.is_active else '(inactive)'}"
