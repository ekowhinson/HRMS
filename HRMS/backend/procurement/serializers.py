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


class PurchaseRequisitionSerializer(serializers.ModelSerializer):
    items = RequisitionItemSerializer(many=True, read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True, default=None)
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)

    class Meta:
        model = PurchaseRequisition
        fields = '__all__'
        read_only_fields = ['id', 'approved_by', 'approved_at', 'created_at', 'updated_at']


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrderItem
        fields = '__all__'
        read_only_fields = ['id', 'total', 'created_at', 'updated_at']


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    vendor_name = serializers.CharField(source='vendor.name', read_only=True, default=None)
    requisition_number = serializers.CharField(source='requisition.requisition_number', read_only=True, default=None)

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
        read_only_fields = ['id', 'approved_by', 'approved_at', 'created_at', 'updated_at']


class GRNItemSerializer(serializers.ModelSerializer):
    po_item_description = serializers.CharField(source='po_item.description', read_only=True, default=None)

    class Meta:
        model = GRNItem
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class GoodsReceiptNoteSerializer(serializers.ModelSerializer):
    items = GRNItemSerializer(many=True, read_only=True)
    po_number = serializers.CharField(source='purchase_order.po_number', read_only=True, default=None)
    received_by_name = serializers.CharField(source='received_by.full_name', read_only=True, default=None)

    class Meta:
        model = GoodsReceiptNote
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class ContractMilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractMilestone
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class ContractSerializer(serializers.ModelSerializer):
    milestones = ContractMilestoneSerializer(many=True, read_only=True)
    vendor_name = serializers.CharField(source='vendor.name', read_only=True, default=None)

    class Meta:
        model = Contract
        fields = '__all__'
        read_only_fields = ['id', 'signed_by', 'signed_at', 'created_at', 'updated_at']


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


class RequestForQuotationSerializer(serializers.ModelSerializer):
    items = RFQItemSerializer(many=True, read_only=True)
    vendors = RFQVendorSerializer(many=True, read_only=True)
    requisition_number = serializers.CharField(
        source='requisition.requisition_number', read_only=True, default=None
    )

    class Meta:
        model = RequestForQuotation
        fields = '__all__'
        read_only_fields = ['id', 'rfq_number', 'created_at', 'updated_at']


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
