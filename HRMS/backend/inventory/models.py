"""Models for inventory and asset management."""

from django.db import models
from django.conf import settings
from core.models import BaseModel


class ItemCategory(BaseModel):
    """Item classification hierarchy."""
    name = models.CharField(max_length=200)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    gl_account = models.ForeignKey('finance.Account', on_delete=models.SET_NULL, null=True, blank=True, related_name='item_categories')
    is_asset_category = models.BooleanField(default=False)
    description = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = 'Item categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Item(BaseModel):
    """Item master."""
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    category = models.ForeignKey(ItemCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='items')
    unit_of_measure = models.CharField(max_length=20, default='EA')
    reorder_level = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reorder_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    standard_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    is_stockable = models.BooleanField(default=True)
    is_asset = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f"{self.code} - {self.name}"


class Warehouse(BaseModel):
    """Storage location."""
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True)
    location = models.ForeignKey('organization.WorkLocation', on_delete=models.SET_NULL, null=True, blank=True, related_name='warehouses')
    manager = models.ForeignKey('employees.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_warehouses')
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.code} - {self.name}"


class StockEntry(BaseModel):
    """Stock movement record."""

    class EntryType(models.TextChoices):
        RECEIPT = 'RECEIPT', 'Receipt'
        ISSUE = 'ISSUE', 'Issue'
        TRANSFER = 'TRANSFER', 'Transfer'
        ADJUSTMENT = 'ADJUSTMENT', 'Adjustment'
        RETURN = 'RETURN', 'Return'

    entry_type = models.CharField(max_length=20, choices=EntryType.choices)
    entry_date = models.DateField()
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name='stock_entries')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='stock_entries')
    to_warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True, related_name='incoming_transfers')
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    source = models.CharField(max_length=50, blank=True)  # e.g., 'GRN', 'MANUAL', 'PO'
    source_reference = models.CharField(max_length=100, blank=True)  # e.g., GRN number
    reference_number = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = 'Stock entries'
        ordering = ['-entry_date']

    def __str__(self):
        return f"{self.entry_type} - {self.item.code} ({self.quantity})"

    def save(self, *args, **kwargs):
        self.total_cost = self.quantity * self.unit_cost
        super().save(*args, **kwargs)


class StockLedger(BaseModel):
    """Running stock balance per item per warehouse."""
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name='ledger_entries')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='ledger_entries')
    balance_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    valuation_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    last_movement_date = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ['item', 'warehouse']
        ordering = ['item__code']

    def __str__(self):
        return f"{self.item.code} @ {self.warehouse.code}: {self.balance_qty}"


class Asset(BaseModel):
    """Fixed asset register."""

    class DepreciationMethod(models.TextChoices):
        STRAIGHT_LINE = 'STRAIGHT_LINE', 'Straight Line'
        DECLINING_BALANCE = 'DECLINING_BALANCE', 'Declining Balance'
        SUM_OF_YEARS = 'SUM_OF_YEARS', 'Sum of Years Digits'
        UNITS_OF_PRODUCTION = 'UNITS_OF_PRODUCTION', 'Units of Production'

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        UNDER_MAINTENANCE = 'UNDER_MAINTENANCE', 'Under Maintenance'
        DISPOSED = 'DISPOSED', 'Disposed'
        RETIRED = 'RETIRED', 'Retired'
        LOST = 'LOST', 'Lost'

    asset_number = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    category = models.ForeignKey(ItemCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='assets')
    item = models.ForeignKey(Item, on_delete=models.SET_NULL, null=True, blank=True, related_name='assets')
    serial_number = models.CharField(max_length=100, blank=True)
    acquisition_date = models.DateField()
    acquisition_cost = models.DecimalField(max_digits=15, decimal_places=2)
    current_value = models.DecimalField(max_digits=15, decimal_places=2)
    accumulated_depreciation = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    depreciation_method = models.CharField(max_length=30, choices=DepreciationMethod.choices, default=DepreciationMethod.STRAIGHT_LINE)
    useful_life_months = models.PositiveIntegerField(default=60)
    salvage_value = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    location = models.ForeignKey('organization.WorkLocation', on_delete=models.SET_NULL, null=True, blank=True, related_name='assets')
    department = models.ForeignKey('organization.Department', on_delete=models.SET_NULL, null=True, blank=True, related_name='assets')
    custodian = models.ForeignKey('employees.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='custodied_assets')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    warranty_expiry = models.DateField(null=True, blank=True)
    insurance_policy = models.CharField(max_length=100, blank=True)
    disposal_date = models.DateField(null=True, blank=True)
    disposal_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ['asset_number']

    def __str__(self):
        return f"{self.asset_number} - {self.name}"

    @property
    def monthly_depreciation(self):
        """Compute monthly depreciation (straight-line)."""
        from decimal import Decimal
        if self.useful_life_months and self.useful_life_months > 0:
            depreciable = self.acquisition_cost - self.salvage_value
            return (depreciable / Decimal(self.useful_life_months)).quantize(Decimal('0.01'))
        return Decimal('0.00')


class AssetDepreciation(BaseModel):
    """Monthly depreciation record."""
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name='depreciations')
    fiscal_period = models.ForeignKey('finance.FiscalPeriod', on_delete=models.PROTECT, related_name='asset_depreciations')
    depreciation_amount = models.DecimalField(max_digits=15, decimal_places=2)
    accumulated_depreciation = models.DecimalField(max_digits=15, decimal_places=2)
    book_value = models.DecimalField(max_digits=15, decimal_places=2)
    journal_entry = models.ForeignKey('finance.JournalEntry', on_delete=models.SET_NULL, null=True, blank=True, related_name='asset_depreciations')

    class Meta:
        ordering = ['-fiscal_period__start_date']
        unique_together = ['asset', 'fiscal_period']

    def __str__(self):
        return f"{self.asset.asset_number} - {self.fiscal_period}"


class AssetTransfer(BaseModel):
    """Asset movement/transfer record."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        COMPLETED = 'COMPLETED', 'Completed'
        REJECTED = 'REJECTED', 'Rejected'

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name='transfers')
    from_location = models.ForeignKey('organization.WorkLocation', on_delete=models.SET_NULL, null=True, related_name='asset_transfers_from')
    to_location = models.ForeignKey('organization.WorkLocation', on_delete=models.SET_NULL, null=True, related_name='asset_transfers_to')
    from_custodian = models.ForeignKey('employees.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='asset_transfers_from')
    to_custodian = models.ForeignKey('employees.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='asset_transfers_to')
    from_department = models.ForeignKey('organization.Department', on_delete=models.SET_NULL, null=True, blank=True, related_name='asset_transfers_from')
    to_department = models.ForeignKey('organization.Department', on_delete=models.SET_NULL, null=True, blank=True, related_name='asset_transfers_to')
    transfer_date = models.DateField()
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_asset_transfers')
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-transfer_date']

    def __str__(self):
        return f"Transfer: {self.asset.asset_number} ({self.from_location} -> {self.to_location})"


class MaintenanceSchedule(BaseModel):
    """Preventive maintenance schedule."""

    class Frequency(models.TextChoices):
        DAILY = 'DAILY', 'Daily'
        WEEKLY = 'WEEKLY', 'Weekly'
        MONTHLY = 'MONTHLY', 'Monthly'
        QUARTERLY = 'QUARTERLY', 'Quarterly'
        SEMI_ANNUAL = 'SEMI_ANNUAL', 'Semi-Annual'
        ANNUAL = 'ANNUAL', 'Annual'

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name='maintenance_schedules')
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    frequency = models.CharField(max_length=20, choices=Frequency.choices)
    next_due_date = models.DateField()
    vendor = models.ForeignKey('finance.Vendor', on_delete=models.SET_NULL, null=True, blank=True, related_name='maintenance_schedules')
    estimated_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    last_completed = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['next_due_date']

    def __str__(self):
        return f"{self.asset.asset_number} - {self.title} (Next: {self.next_due_date})"


# =========================================================================
# Asset Disposal
# =========================================================================

class AssetDisposal(BaseModel):
    """Asset disposal / retirement record with GL integration."""
    class DisposalType(models.TextChoices):
        SALE = 'SALE', 'Sale'
        SCRAP = 'SCRAP', 'Scrap'
        DONATION = 'DONATION', 'Donation'
        TRANSFER = 'TRANSFER', 'Transfer'

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PENDING = 'PENDING', 'Pending Approval'
        APPROVED = 'APPROVED', 'Approved'
        COMPLETED = 'COMPLETED', 'Completed'
        REJECTED = 'REJECTED', 'Rejected'

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name='disposals')
    disposal_type = models.CharField(max_length=20, choices=DisposalType.choices)
    disposal_date = models.DateField()
    proceeds = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    book_value_at_disposal = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    gain_loss = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    journal_entry = models.ForeignKey(
        'finance.JournalEntry', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='asset_disposals'
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='approved_disposals'
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    reason = models.TextField(blank=True)

    class Meta:
        ordering = ['-disposal_date']

    def __str__(self):
        return f"Disposal: {self.asset.asset_number} ({self.disposal_type})"

    def save(self, *args, **kwargs):
        if not self.book_value_at_disposal:
            self.book_value_at_disposal = self.asset.current_value
        self.gain_loss = (self.proceeds or 0) - self.book_value_at_disposal
        super().save(*args, **kwargs)


# =========================================================================
# Cycle Count
# =========================================================================

class CycleCount(BaseModel):
    """Inventory cycle count session."""
    class Status(models.TextChoices):
        PLANNED = 'PLANNED', 'Planned'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        APPROVED = 'APPROVED', 'Approved'

    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='cycle_counts')
    count_date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    counted_by = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='cycle_counts'
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='approved_cycle_counts'
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-count_date']

    def __str__(self):
        return f"Cycle Count: {self.warehouse.code} - {self.count_date}"


class CycleCountItem(BaseModel):
    """Individual item line in a cycle count."""
    cycle_count = models.ForeignKey(CycleCount, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name='cycle_count_items')
    system_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    counted_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    variance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    adjustment_entry = models.ForeignKey(
        StockEntry, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='cycle_count_adjustments'
    )

    class Meta:
        ordering = ['item__code']

    def __str__(self):
        return f"{self.item.code}: system={self.system_qty}, counted={self.counted_qty}"

    def save(self, *args, **kwargs):
        self.variance = self.counted_qty - self.system_qty
        super().save(*args, **kwargs)
