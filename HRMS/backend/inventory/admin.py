"""
Admin configuration for inventory and asset management.
"""

from django.contrib import admin
from .models import (
    ItemCategory, Item, Warehouse, StockEntry, StockLedger,
    Asset, AssetDepreciation, AssetTransfer, MaintenanceSchedule,
)


@admin.register(ItemCategory)
class ItemCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'parent', 'is_asset_category', 'gl_account']
    list_filter = ['is_asset_category']
    search_fields = ['name', 'description']
    ordering = ['name']
    raw_id_fields = ['parent', 'gl_account']


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'category', 'unit_of_measure', 'standard_cost', 'is_stockable', 'is_asset', 'is_active']
    list_filter = ['category', 'is_stockable', 'is_asset', 'is_active']
    search_fields = ['code', 'name', 'description']
    ordering = ['code']
    raw_id_fields = ['category']


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'location', 'manager', 'is_active']
    list_filter = ['is_active']
    search_fields = ['code', 'name', 'address']
    ordering = ['name']
    raw_id_fields = ['location', 'manager']


@admin.register(StockEntry)
class StockEntryAdmin(admin.ModelAdmin):
    list_display = ['entry_type', 'entry_date', 'item', 'warehouse', 'quantity', 'unit_cost', 'total_cost', 'source']
    list_filter = ['entry_type', 'source', 'warehouse']
    search_fields = ['reference_number', 'source_reference', 'item__code', 'item__name']
    ordering = ['-entry_date']
    raw_id_fields = ['item', 'warehouse', 'to_warehouse']
    date_hierarchy = 'entry_date'
    readonly_fields = ['total_cost']


@admin.register(StockLedger)
class StockLedgerAdmin(admin.ModelAdmin):
    list_display = ['item', 'warehouse', 'balance_qty', 'valuation_amount', 'last_movement_date']
    list_filter = ['warehouse']
    search_fields = ['item__code', 'item__name', 'warehouse__code', 'warehouse__name']
    ordering = ['item__code']
    raw_id_fields = ['item', 'warehouse']


class AssetDepreciationInline(admin.TabularInline):
    model = AssetDepreciation
    extra = 0
    fields = ['fiscal_period', 'depreciation_amount', 'accumulated_depreciation', 'book_value', 'journal_entry']
    raw_id_fields = ['fiscal_period', 'journal_entry']
    readonly_fields = ['depreciation_amount', 'accumulated_depreciation', 'book_value']


class MaintenanceScheduleInline(admin.TabularInline):
    model = MaintenanceSchedule
    extra = 0
    fields = ['title', 'frequency', 'next_due_date', 'vendor', 'estimated_cost', 'last_completed', 'is_active']
    raw_id_fields = ['vendor']


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = [
        'asset_number', 'name', 'category', 'status',
        'acquisition_date', 'acquisition_cost', 'current_value',
        'location', 'department', 'custodian',
    ]
    list_filter = ['status', 'depreciation_method', 'category', 'department', 'location']
    search_fields = ['asset_number', 'name', 'serial_number', 'description', 'insurance_policy']
    ordering = ['asset_number']
    raw_id_fields = ['category', 'item', 'location', 'department', 'custodian']
    date_hierarchy = 'acquisition_date'
    inlines = [AssetDepreciationInline, MaintenanceScheduleInline]
    fieldsets = (
        (None, {
            'fields': ('asset_number', 'name', 'description', 'category', 'item', 'serial_number'),
        }),
        ('Financial', {
            'fields': (
                'acquisition_date', 'acquisition_cost', 'current_value',
                'accumulated_depreciation', 'depreciation_method',
                'useful_life_months', 'salvage_value',
            ),
        }),
        ('Assignment', {
            'fields': ('location', 'department', 'custodian', 'status'),
        }),
        ('Insurance & Warranty', {
            'fields': ('warranty_expiry', 'insurance_policy'),
            'classes': ('collapse',),
        }),
        ('Disposal', {
            'fields': ('disposal_date', 'disposal_value'),
            'classes': ('collapse',),
        }),
    )


@admin.register(AssetDepreciation)
class AssetDepreciationAdmin(admin.ModelAdmin):
    list_display = ['asset', 'fiscal_period', 'depreciation_amount', 'accumulated_depreciation', 'book_value']
    list_filter = ['fiscal_period']
    search_fields = ['asset__asset_number', 'asset__name']
    ordering = ['-fiscal_period__start_date']
    raw_id_fields = ['asset', 'fiscal_period', 'journal_entry']


@admin.register(AssetTransfer)
class AssetTransferAdmin(admin.ModelAdmin):
    list_display = ['asset', 'from_location', 'to_location', 'transfer_date', 'status', 'approved_by']
    list_filter = ['status']
    search_fields = ['asset__asset_number', 'asset__name', 'reason']
    ordering = ['-transfer_date']
    raw_id_fields = ['asset', 'from_location', 'to_location', 'from_custodian', 'to_custodian', 'from_department', 'to_department', 'approved_by']
    date_hierarchy = 'transfer_date'
    readonly_fields = ['approved_at']


@admin.register(MaintenanceSchedule)
class MaintenanceScheduleAdmin(admin.ModelAdmin):
    list_display = ['asset', 'title', 'frequency', 'next_due_date', 'estimated_cost', 'last_completed', 'is_active']
    list_filter = ['frequency', 'is_active']
    search_fields = ['title', 'description', 'asset__asset_number', 'asset__name']
    ordering = ['next_due_date']
    raw_id_fields = ['asset', 'vendor']
