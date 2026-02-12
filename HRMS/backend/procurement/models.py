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
