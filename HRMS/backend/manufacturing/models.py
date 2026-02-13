"""Manufacturing module models — BOM, Work Orders, Production, Quality."""

from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from decimal import Decimal

from core.models import BaseModel


class BillOfMaterials(BaseModel):
    """Bill of Materials for a finished product."""
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        ACTIVE = 'ACTIVE', 'Active'
        OBSOLETE = 'OBSOLETE', 'Obsolete'

    code = models.CharField(max_length=30, db_index=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    finished_product = models.ForeignKey(
        'inventory.Item', on_delete=models.PROTECT, related_name='boms'
    )
    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    yield_qty = models.DecimalField(
        max_digits=12, decimal_places=2, default=1,
        help_text='How many finished items this BOM produces'
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)

    class Meta:
        db_table = 'manufacturing_bom'
        ordering = ['code']
        unique_together = [('tenant', 'finished_product', 'version')]

    def __str__(self):
        return f"{self.code} v{self.version} - {self.name}"


class BOMLine(BaseModel):
    """Individual raw material/component line in a BOM."""
    bom = models.ForeignKey(BillOfMaterials, on_delete=models.CASCADE, related_name='lines')
    raw_material = models.ForeignKey(
        'inventory.Item', on_delete=models.PROTECT, related_name='bom_usage'
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=4)
    unit_of_measure = models.CharField(max_length=20, default='EA')
    scrap_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'manufacturing_bom_lines'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f"{self.raw_material} × {self.quantity}"

    @property
    def effective_quantity(self):
        """Quantity adjusted for scrap."""
        return self.quantity * (1 + self.scrap_percent / 100)


class WorkCenter(BaseModel):
    """Production work center / station."""
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    department = models.ForeignKey(
        'organization.Department', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='work_centers'
    )
    warehouse = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='work_centers',
        help_text='Raw material staging warehouse'
    )
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    capacity_per_day = models.PositiveIntegerField(default=8)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'manufacturing_work_centers'
        ordering = ['code']
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f"{self.code} - {self.name}"


class ProductionRouting(BaseModel):
    """Routing step / operation template for a BOM."""
    bom = models.ForeignKey(BillOfMaterials, on_delete=models.CASCADE, related_name='routings')
    operation_number = models.PositiveIntegerField()
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    work_center = models.ForeignKey(
        WorkCenter, on_delete=models.PROTECT, related_name='routing_steps'
    )
    setup_time_minutes = models.PositiveIntegerField(default=0)
    run_time_minutes = models.PositiveIntegerField(default=0, help_text='Per unit')
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'manufacturing_production_routings'
        ordering = ['sort_order', 'operation_number']
        unique_together = [('bom', 'operation_number')]

    def __str__(self):
        return f"Op {self.operation_number}: {self.name}"


class WorkOrder(BaseModel):
    """Manufacturing work order."""
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        RELEASED = 'RELEASED', 'Released'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        ON_HOLD = 'ON_HOLD', 'On Hold'

    work_order_number = models.CharField(max_length=30, db_index=True)
    bom = models.ForeignKey(BillOfMaterials, on_delete=models.PROTECT, related_name='work_orders')
    product = models.ForeignKey(
        'inventory.Item', on_delete=models.PROTECT, related_name='work_orders'
    )
    planned_qty = models.DecimalField(max_digits=12, decimal_places=2)
    completed_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    rejected_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    planned_start = models.DateField()
    planned_end = models.DateField()
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.DRAFT)
    priority = models.PositiveSmallIntegerField(default=3, help_text='1=highest, 5=lowest')
    project = models.ForeignKey(
        'projects.Project', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='work_orders'
    )
    cost_center = models.ForeignKey(
        'organization.CostCenter', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='work_orders'
    )
    estimated_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    actual_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'manufacturing_work_orders'
        ordering = ['-created_at']
        unique_together = [('tenant', 'work_order_number')]
        indexes = [
            models.Index(fields=['status', '-planned_start']),
            models.Index(fields=['product', 'status']),
        ]

    def __str__(self):
        return f"{self.work_order_number} - {self.product}"

    @property
    def completion_percent(self):
        if self.planned_qty and self.planned_qty > 0:
            return round(float(self.completed_qty / self.planned_qty * 100), 1)
        return 0


class WorkOrderOperation(BaseModel):
    """Individual operation within a work order."""
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        SKIPPED = 'SKIPPED', 'Skipped'

    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='operations')
    routing = models.ForeignKey(
        ProductionRouting, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='work_order_operations'
    )
    operation_number = models.PositiveIntegerField()
    name = models.CharField(max_length=200)
    work_center = models.ForeignKey(
        WorkCenter, on_delete=models.PROTECT, related_name='operations'
    )
    planned_start = models.DateTimeField(null=True, blank=True)
    planned_end = models.DateTimeField(null=True, blank=True)
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)
    setup_time = models.PositiveIntegerField(default=0, help_text='Minutes')
    run_time = models.PositiveIntegerField(default=0, help_text='Minutes')
    actual_time = models.PositiveIntegerField(default=0, help_text='Actual minutes')
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    completed_by = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='completed_operations'
    )

    class Meta:
        db_table = 'manufacturing_work_order_operations'
        ordering = ['operation_number']

    def __str__(self):
        return f"Op {self.operation_number}: {self.name} ({self.status})"


class MaterialConsumption(BaseModel):
    """Material consumed for a work order."""
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='material_consumptions')
    item = models.ForeignKey('inventory.Item', on_delete=models.PROTECT, related_name='consumptions')
    warehouse = models.ForeignKey(
        'inventory.Warehouse', on_delete=models.PROTECT, related_name='consumptions'
    )
    planned_qty = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    actual_qty = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    stock_entry = models.ForeignKey(
        'inventory.StockEntry', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='material_consumptions'
    )
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'manufacturing_material_consumptions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.item} × {self.actual_qty} for {self.work_order}"


class QualityCheck(BaseModel):
    """Quality inspection record."""
    class CheckType(models.TextChoices):
        IN_PROCESS = 'IN_PROCESS', 'In-Process'
        FINAL = 'FINAL', 'Final'
        INCOMING = 'INCOMING', 'Incoming'

    class Result(models.TextChoices):
        PASS = 'PASS', 'Pass'
        FAIL = 'FAIL', 'Fail'
        CONDITIONAL = 'CONDITIONAL', 'Conditional'

    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='quality_checks')
    check_type = models.CharField(max_length=15, choices=CheckType.choices)
    parameter = models.CharField(max_length=200)
    specification = models.CharField(max_length=200)
    actual_value = models.CharField(max_length=200)
    result = models.CharField(max_length=15, choices=Result.choices)
    checked_by = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='quality_checks'
    )
    checked_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'manufacturing_quality_checks'
        ordering = ['-checked_at']

    def __str__(self):
        return f"QC: {self.parameter} — {self.result}"


class ProductionBatch(BaseModel):
    """Batch of finished goods produced."""
    batch_number = models.CharField(max_length=30, db_index=True)
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='batches')
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    manufacture_date = models.DateField()
    expiry_date = models.DateField(null=True, blank=True)
    stock_entry = models.ForeignKey(
        'inventory.StockEntry', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='production_batches'
    )
    journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='production_batches'
    )

    class Meta:
        db_table = 'manufacturing_production_batches'
        ordering = ['-manufacture_date']
        unique_together = [('tenant', 'batch_number')]

    def __str__(self):
        return f"Batch {self.batch_number} — {self.quantity} units"
