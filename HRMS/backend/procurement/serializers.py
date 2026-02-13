"""Serializers for procurement app."""

from rest_framework import serializers
from .models import (
    PurchaseRequisition, RequisitionItem,
    PurchaseOrder, PurchaseOrderItem,
    GoodsReceiptNote, GRNItem,
    Contract, ContractMilestone,
    RequestForQuotation, RFQVendor, RFQItem,
    VendorScorecard, VendorBlacklist
)


class RequisitionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = RequisitionItem
        fields = '__all__'
        read_only_fields = ['id', 'estimated_total', 'created_at', 'updated_at']


class PurchaseRequisitionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for requisition list views."""
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True, default=None)
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseRequisition
        fields = [
            'id', 'requisition_number', 'requested_by', 'requested_by_name',
            'department', 'department_name', 'cost_center',
            'requisition_date', 'required_date', 'status',
            'total_estimated', 'items_count',
            'created_at', 'updated_at',
        ]

    def get_items_count(self, obj):
        return obj.items.count()


class PurchaseRequisitionDetailSerializer(serializers.ModelSerializer):
    """Full serializer for requisition detail with nested items."""
    items = RequisitionItemSerializer(many=True, read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True, default=None)
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)

    class Meta:
        model = PurchaseRequisition
        fields = '__all__'
        read_only_fields = ['id', 'approved_by', 'approved_at', 'created_at', 'updated_at']


class PurchaseRequisitionSerializer(PurchaseRequisitionDetailSerializer):
    """Alias — prefer PurchaseRequisitionDetailSerializer for new code."""
    pass


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrderItem
        fields = '__all__'
        read_only_fields = ['id', 'total', 'created_at', 'updated_at']


class PurchaseOrderListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for PO list views."""
    vendor_name = serializers.CharField(source='vendor.name', read_only=True, default=None)
    requisition_number = serializers.CharField(source='requisition.requisition_number', read_only=True, default=None)
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'po_number', 'vendor', 'vendor_name',
            'requisition', 'requisition_number',
            'order_date', 'delivery_date', 'status',
            'total_amount', 'payment_terms', 'items_count',
            'created_at', 'updated_at',
        ]

    def get_items_count(self, obj):
        return obj.items.count()


class PurchaseOrderDetailSerializer(serializers.ModelSerializer):
    """Full serializer for PO detail with nested items."""
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    vendor_name = serializers.CharField(source='vendor.name', read_only=True, default=None)
    requisition_number = serializers.CharField(source='requisition.requisition_number', read_only=True, default=None)

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
        read_only_fields = ['id', 'approved_by', 'approved_at', 'created_at', 'updated_at']


class PurchaseOrderSerializer(PurchaseOrderDetailSerializer):
    """Alias — prefer PurchaseOrderDetailSerializer for new code."""
    pass


class GRNItemSerializer(serializers.ModelSerializer):
    po_item_description = serializers.CharField(source='po_item.description', read_only=True, default=None)

    class Meta:
        model = GRNItem
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class GoodsReceiptNoteListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for GRN list views."""
    po_number = serializers.CharField(source='purchase_order.po_number', read_only=True, default=None)
    received_by_name = serializers.CharField(source='received_by.full_name', read_only=True, default=None)
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = GoodsReceiptNote
        fields = [
            'id', 'grn_number', 'purchase_order', 'po_number',
            'received_by', 'received_by_name', 'receipt_date',
            'status', 'warehouse',
            'items_count', 'created_at', 'updated_at',
        ]

    def get_items_count(self, obj):
        return obj.items.count()


class GoodsReceiptNoteDetailSerializer(serializers.ModelSerializer):
    """Full serializer for GRN detail with nested items."""
    items = GRNItemSerializer(many=True, read_only=True)
    po_number = serializers.CharField(source='purchase_order.po_number', read_only=True, default=None)
    received_by_name = serializers.CharField(source='received_by.full_name', read_only=True, default=None)

    class Meta:
        model = GoodsReceiptNote
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class GoodsReceiptNoteSerializer(GoodsReceiptNoteDetailSerializer):
    """Alias — prefer GoodsReceiptNoteDetailSerializer for new code."""
    pass


class ContractMilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractMilestone
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class ContractListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for contract list views."""
    vendor_name = serializers.CharField(source='vendor.name', read_only=True, default=None)
    milestones_count = serializers.SerializerMethodField()

    class Meta:
        model = Contract
        fields = [
            'id', 'contract_number', 'title', 'vendor', 'vendor_name',
            'contract_type', 'start_date', 'end_date', 'value',
            'status', 'auto_renew', 'milestones_count',
            'created_at', 'updated_at',
        ]

    def get_milestones_count(self, obj):
        return obj.milestones.count()


class ContractDetailSerializer(serializers.ModelSerializer):
    """Full serializer for contract detail with nested milestones."""
    milestones = ContractMilestoneSerializer(many=True, read_only=True)
    vendor_name = serializers.CharField(source='vendor.name', read_only=True, default=None)

    class Meta:
        model = Contract
        fields = '__all__'
        read_only_fields = ['id', 'signed_by', 'signed_at', 'created_at', 'updated_at']


class ContractSerializer(ContractDetailSerializer):
    """Alias — prefer ContractDetailSerializer for new code."""
    pass


# ---- RFQ ----

class RFQItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = RFQItem
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class RFQVendorSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.name', read_only=True, default=None)
    vendor_code = serializers.CharField(source='vendor.code', read_only=True, default=None)

    class Meta:
        model = RFQVendor
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class RequestForQuotationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for RFQ list views."""
    requisition_number = serializers.CharField(
        source='requisition.requisition_number', read_only=True, default=None
    )
    vendors_count = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = RequestForQuotation
        fields = [
            'id', 'rfq_number', 'requisition', 'requisition_number',
            'status', 'submission_deadline', 'notes',
            'vendors_count', 'items_count',
            'created_at', 'updated_at',
        ]

    def get_vendors_count(self, obj):
        return obj.vendors.count()

    def get_items_count(self, obj):
        return obj.items.count()


class RequestForQuotationDetailSerializer(serializers.ModelSerializer):
    """Full serializer for RFQ detail with nested items and vendors."""
    items = RFQItemSerializer(many=True, read_only=True)
    vendors = RFQVendorSerializer(many=True, read_only=True)
    requisition_number = serializers.CharField(
        source='requisition.requisition_number', read_only=True, default=None
    )

    class Meta:
        model = RequestForQuotation
        fields = '__all__'
        read_only_fields = ['id', 'rfq_number', 'created_at', 'updated_at']


class RequestForQuotationSerializer(RequestForQuotationDetailSerializer):
    """Alias — prefer RequestForQuotationDetailSerializer for new code."""
    pass


# ---- Vendor Scorecard & Blacklist ----

class VendorScorecardSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.name', read_only=True, default=None)
    vendor_code = serializers.CharField(source='vendor.code', read_only=True, default=None)

    class Meta:
        model = VendorScorecard
        fields = '__all__'
        read_only_fields = ['id', 'overall_score', 'created_at', 'updated_at']


class VendorBlacklistSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.name', read_only=True, default=None)

    class Meta:
        model = VendorBlacklist
        fields = '__all__'
        read_only_fields = ['id', 'blacklisted_at', 'created_at', 'updated_at']
