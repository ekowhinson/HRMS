"""Serializers for manufacturing module."""

from rest_framework import serializers
from .models import (
    BillOfMaterials, BOMLine, WorkCenter, ProductionRouting,
    WorkOrder, WorkOrderOperation, MaterialConsumption,
    QualityCheck, ProductionBatch
)


class BOMLineSerializer(serializers.ModelSerializer):
    raw_material_code = serializers.CharField(source='raw_material.code', read_only=True)
    raw_material_name = serializers.CharField(source='raw_material.name', read_only=True)
    effective_quantity = serializers.DecimalField(max_digits=12, decimal_places=4, read_only=True)

    class Meta:
        model = BOMLine
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProductionRoutingSerializer(serializers.ModelSerializer):
    work_center_name = serializers.CharField(source='work_center.name', read_only=True)

    class Meta:
        model = ProductionRouting
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class BOMListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for BOM list views."""
    finished_product_name = serializers.CharField(source='finished_product.name', read_only=True)
    finished_product_code = serializers.CharField(source='finished_product.code', read_only=True)
    lines_count = serializers.SerializerMethodField()

    class Meta:
        model = BillOfMaterials
        fields = [
            'id', 'code', 'name', 'finished_product', 'finished_product_name',
            'finished_product_code', 'version', 'is_active', 'yield_qty',
            'status', 'lines_count', 'created_at', 'updated_at',
        ]

    def get_lines_count(self, obj):
        return obj.lines.count()


class BOMDetailSerializer(serializers.ModelSerializer):
    """Full serializer for BOM detail views with nested lines and routings."""
    lines = BOMLineSerializer(many=True, read_only=True)
    routings = ProductionRoutingSerializer(many=True, read_only=True)
    finished_product_name = serializers.CharField(source='finished_product.name', read_only=True)
    finished_product_code = serializers.CharField(source='finished_product.code', read_only=True)
    lines_count = serializers.SerializerMethodField()

    class Meta:
        model = BillOfMaterials
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_lines_count(self, obj):
        return obj.lines.count()


class WorkCenterSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)

    class Meta:
        model = WorkCenter
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class WorkOrderOperationSerializer(serializers.ModelSerializer):
    work_center_name = serializers.CharField(source='work_center.name', read_only=True)

    class Meta:
        model = WorkOrderOperation
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class MaterialConsumptionSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source='item.code', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = MaterialConsumption
        fields = '__all__'
        read_only_fields = ['id', 'stock_entry', 'consumed_at', 'created_at', 'updated_at']


class QualityCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = QualityCheck
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProductionBatchSerializer(serializers.ModelSerializer):
    work_order_number = serializers.CharField(source='work_order.work_order_number', read_only=True)

    class Meta:
        model = ProductionBatch
        fields = '__all__'
        read_only_fields = ['id', 'batch_number', 'stock_entry', 'journal_entry', 'created_at', 'updated_at']


class WorkOrderListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for work order list views."""
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)
    bom_code = serializers.CharField(source='bom.code', read_only=True)
    completion_percent = serializers.FloatField(read_only=True)

    class Meta:
        model = WorkOrder
        fields = [
            'id', 'work_order_number', 'bom', 'bom_code',
            'product', 'product_name', 'product_code',
            'planned_qty', 'completed_qty', 'rejected_qty',
            'planned_start', 'planned_end', 'actual_start', 'actual_end',
            'status', 'priority', 'completion_percent',
            'estimated_cost', 'actual_cost',
            'created_at', 'updated_at',
        ]


class WorkOrderDetailSerializer(serializers.ModelSerializer):
    """Full serializer for work order detail with nested operations, materials, quality, batches."""
    operations = WorkOrderOperationSerializer(many=True, read_only=True)
    material_consumptions = MaterialConsumptionSerializer(many=True, read_only=True)
    quality_checks = QualityCheckSerializer(many=True, read_only=True)
    batches = ProductionBatchSerializer(many=True, read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)
    bom_code = serializers.CharField(source='bom.code', read_only=True)
    completion_percent = serializers.FloatField(read_only=True)

    class Meta:
        model = WorkOrder
        fields = '__all__'
        read_only_fields = [
            'id', 'work_order_number', 'completed_qty', 'rejected_qty',
            'actual_start', 'actual_end', 'actual_cost', 'created_at', 'updated_at'
        ]
