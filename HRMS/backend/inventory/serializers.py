"""
Serializers for inventory and asset management.
"""

from rest_framework import serializers

from .models import (
    ItemCategory, Item, Warehouse, StockEntry, StockLedger,
    Asset, AssetDepreciation, AssetTransfer, MaintenanceSchedule,
)


class ItemCategorySerializer(serializers.ModelSerializer):
    """Serializer for ItemCategory model."""
    parent_name = serializers.CharField(source='parent.name', read_only=True, allow_null=True)
    gl_account_name = serializers.CharField(source='gl_account.name', read_only=True, allow_null=True)
    children_count = serializers.SerializerMethodField()

    class Meta:
        model = ItemCategory
        fields = [
            'id', 'name', 'parent', 'parent_name', 'gl_account', 'gl_account_name',
            'is_asset_category', 'description', 'children_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_children_count(self, obj):
        return obj.children.count()


class ItemSerializer(serializers.ModelSerializer):
    """Serializer for Item model."""
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)

    class Meta:
        model = Item
        fields = [
            'id', 'code', 'name', 'description', 'category', 'category_name',
            'unit_of_measure', 'reorder_level', 'reorder_qty', 'standard_cost',
            'is_stockable', 'is_asset', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class WarehouseSerializer(serializers.ModelSerializer):
    """Serializer for Warehouse model."""
    location_name = serializers.CharField(source='location.name', read_only=True, allow_null=True)
    manager_name = serializers.CharField(source='manager.full_name', read_only=True, allow_null=True)

    class Meta:
        model = Warehouse
        fields = [
            'id', 'name', 'code', 'location', 'location_name',
            'manager', 'manager_name', 'address', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class StockEntrySerializer(serializers.ModelSerializer):
    """Serializer for StockEntry model."""
    item_code = serializers.CharField(source='item.code', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    to_warehouse_name = serializers.CharField(source='to_warehouse.name', read_only=True, allow_null=True)
    entry_type_display = serializers.CharField(source='get_entry_type_display', read_only=True)

    class Meta:
        model = StockEntry
        fields = [
            'id', 'entry_type', 'entry_type_display', 'entry_date',
            'item', 'item_code', 'item_name',
            'warehouse', 'warehouse_name',
            'to_warehouse', 'to_warehouse_name',
            'quantity', 'unit_cost', 'total_cost',
            'source', 'source_reference', 'reference_number', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'total_cost', 'created_at', 'updated_at']


class StockLedgerSerializer(serializers.ModelSerializer):
    """Serializer for StockLedger model."""
    item_code = serializers.CharField(source='item.code', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    warehouse_code = serializers.CharField(source='warehouse.code', read_only=True)

    class Meta:
        model = StockLedger
        fields = [
            'id', 'item', 'item_code', 'item_name',
            'warehouse', 'warehouse_name', 'warehouse_code',
            'balance_qty', 'valuation_amount', 'last_movement_date',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AssetListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for Asset lists."""
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    location_name = serializers.CharField(source='location.name', read_only=True, allow_null=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    custodian_name = serializers.CharField(source='custodian.full_name', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Asset
        fields = [
            'id', 'asset_number', 'name', 'category', 'category_name',
            'serial_number', 'acquisition_date', 'acquisition_cost', 'current_value',
            'location', 'location_name', 'department', 'department_name',
            'custodian', 'custodian_name', 'status', 'status_display',
        ]


class AssetSerializer(serializers.ModelSerializer):
    """Full serializer for Asset detail."""
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    item_code = serializers.CharField(source='item.code', read_only=True, allow_null=True)
    item_name = serializers.CharField(source='item.name', read_only=True, allow_null=True)
    location_name = serializers.CharField(source='location.name', read_only=True, allow_null=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    custodian_name = serializers.CharField(source='custodian.full_name', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    depreciation_method_display = serializers.CharField(source='get_depreciation_method_display', read_only=True)

    class Meta:
        model = Asset
        fields = [
            'id', 'asset_number', 'name', 'description',
            'category', 'category_name', 'item', 'item_code', 'item_name',
            'serial_number', 'acquisition_date', 'acquisition_cost',
            'current_value', 'accumulated_depreciation',
            'depreciation_method', 'depreciation_method_display',
            'useful_life_months', 'salvage_value',
            'location', 'location_name', 'department', 'department_name',
            'custodian', 'custodian_name',
            'status', 'status_display',
            'warranty_expiry', 'insurance_policy',
            'disposal_date', 'disposal_value',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AssetDepreciationSerializer(serializers.ModelSerializer):
    """Serializer for AssetDepreciation model."""
    asset_number = serializers.CharField(source='asset.asset_number', read_only=True)
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    fiscal_period_name = serializers.CharField(source='fiscal_period.name', read_only=True)

    class Meta:
        model = AssetDepreciation
        fields = [
            'id', 'asset', 'asset_number', 'asset_name',
            'fiscal_period', 'fiscal_period_name',
            'depreciation_amount', 'accumulated_depreciation', 'book_value',
            'journal_entry',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AssetTransferSerializer(serializers.ModelSerializer):
    """Serializer for AssetTransfer model."""
    asset_number = serializers.CharField(source='asset.asset_number', read_only=True)
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    from_location_name = serializers.CharField(source='from_location.name', read_only=True, allow_null=True)
    to_location_name = serializers.CharField(source='to_location.name', read_only=True, allow_null=True)
    from_custodian_name = serializers.CharField(source='from_custodian.full_name', read_only=True, allow_null=True)
    to_custodian_name = serializers.CharField(source='to_custodian.full_name', read_only=True, allow_null=True)
    from_department_name = serializers.CharField(source='from_department.name', read_only=True, allow_null=True)
    to_department_name = serializers.CharField(source='to_department.name', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = AssetTransfer
        fields = [
            'id', 'asset', 'asset_number', 'asset_name',
            'from_location', 'from_location_name', 'to_location', 'to_location_name',
            'from_custodian', 'from_custodian_name', 'to_custodian', 'to_custodian_name',
            'from_department', 'from_department_name', 'to_department', 'to_department_name',
            'transfer_date', 'reason',
            'status', 'status_display',
            'approved_by', 'approved_by_name', 'approved_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'approved_by', 'approved_at', 'created_at', 'updated_at']


class MaintenanceScheduleSerializer(serializers.ModelSerializer):
    """Serializer for MaintenanceSchedule model."""
    asset_number = serializers.CharField(source='asset.asset_number', read_only=True)
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    vendor_name = serializers.CharField(source='vendor.name', read_only=True, allow_null=True)
    frequency_display = serializers.CharField(source='get_frequency_display', read_only=True)

    class Meta:
        model = MaintenanceSchedule
        fields = [
            'id', 'asset', 'asset_number', 'asset_name',
            'title', 'description',
            'frequency', 'frequency_display',
            'next_due_date', 'vendor', 'vendor_name',
            'estimated_cost', 'last_completed', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
