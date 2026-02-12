"""Django admin for procurement app."""

from django.contrib import admin
from .models import (
    PurchaseRequisition, RequisitionItem,
    PurchaseOrder, PurchaseOrderItem,
    GoodsReceiptNote, GRNItem,
    Contract, ContractMilestone
)


class RequisitionItemInline(admin.TabularInline):
    model = RequisitionItem
    extra = 1
    fields = ['description', 'item', 'quantity', 'unit_of_measure', 'unit_price', 'estimated_total', 'budget', 'notes']
    readonly_fields = ['estimated_total']


class PurchaseOrderItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 1
    fields = ['description', 'item', 'quantity', 'unit_of_measure', 'unit_price', 'tax_rate', 'total', 'received_qty']
    readonly_fields = ['total']


class GRNItemInline(admin.TabularInline):
    model = GRNItem
    extra = 1
    fields = ['po_item', 'received_qty', 'accepted_qty', 'rejected_qty', 'rejection_reason']


class ContractMilestoneInline(admin.TabularInline):
    model = ContractMilestone
    extra = 1
    fields = ['description', 'due_date', 'amount', 'status', 'completion_date', 'deliverables']


@admin.register(PurchaseRequisition)
class PurchaseRequisitionAdmin(admin.ModelAdmin):
    list_display = ['requisition_number', 'requested_by', 'department', 'requisition_date', 'status', 'total_estimated']
    list_filter = ['status', 'department', 'requisition_date']
    search_fields = ['requisition_number', 'justification']
    inlines = [RequisitionItemInline]
    readonly_fields = ['approved_by', 'approved_at']


@admin.register(RequisitionItem)
class RequisitionItemAdmin(admin.ModelAdmin):
    list_display = ['requisition', 'description', 'quantity', 'unit_of_measure', 'unit_price', 'estimated_total']
    list_filter = ['unit_of_measure']
    search_fields = ['description', 'requisition__requisition_number']


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ['po_number', 'vendor', 'order_date', 'delivery_date', 'status', 'total_amount']
    list_filter = ['status', 'vendor', 'order_date']
    search_fields = ['po_number', 'vendor__name', 'notes']
    inlines = [PurchaseOrderItemInline]
    readonly_fields = ['approved_by', 'approved_at']


@admin.register(PurchaseOrderItem)
class PurchaseOrderItemAdmin(admin.ModelAdmin):
    list_display = ['purchase_order', 'description', 'quantity', 'unit_price', 'total', 'received_qty']
    list_filter = ['unit_of_measure']
    search_fields = ['description', 'purchase_order__po_number']


@admin.register(GoodsReceiptNote)
class GoodsReceiptNoteAdmin(admin.ModelAdmin):
    list_display = ['grn_number', 'purchase_order', 'received_by', 'receipt_date', 'status']
    list_filter = ['status', 'receipt_date']
    search_fields = ['grn_number', 'purchase_order__po_number', 'inspection_notes']
    inlines = [GRNItemInline]


@admin.register(GRNItem)
class GRNItemAdmin(admin.ModelAdmin):
    list_display = ['grn', 'po_item', 'received_qty', 'accepted_qty', 'rejected_qty']
    list_filter = ['grn__status']
    search_fields = ['grn__grn_number', 'po_item__description']


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ['contract_number', 'vendor', 'contract_type', 'title', 'start_date', 'end_date', 'value', 'status']
    list_filter = ['status', 'contract_type', 'auto_renew']
    search_fields = ['contract_number', 'title', 'vendor__name', 'description']
    inlines = [ContractMilestoneInline]
    readonly_fields = ['signed_by', 'signed_at']


@admin.register(ContractMilestone)
class ContractMilestoneAdmin(admin.ModelAdmin):
    list_display = ['contract', 'description', 'due_date', 'amount', 'status', 'completion_date']
    list_filter = ['status']
    search_fields = ['description', 'contract__contract_number']
