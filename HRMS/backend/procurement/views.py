"""ViewSets for procurement app."""

from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    PurchaseRequisition, RequisitionItem,
    PurchaseOrder, PurchaseOrderItem,
    GoodsReceiptNote, GRNItem,
    Contract, ContractMilestone,
    RequestForQuotation, RFQVendor, RFQItem,
    VendorScorecard, VendorBlacklist
)
from .serializers import (
    PurchaseRequisitionListSerializer, PurchaseRequisitionDetailSerializer,
    RequisitionItemSerializer,
    PurchaseOrderListSerializer, PurchaseOrderDetailSerializer,
    PurchaseOrderItemSerializer,
    GoodsReceiptNoteListSerializer, GoodsReceiptNoteDetailSerializer,
    GRNItemSerializer,
    ContractListSerializer, ContractDetailSerializer,
    ContractMilestoneSerializer,
    RequestForQuotationListSerializer, RequestForQuotationDetailSerializer,
    RFQVendorSerializer, RFQItemSerializer,
    VendorScorecardSerializer, VendorBlacklistSerializer
)


class PurchaseRequisitionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'department', 'requested_by', 'cost_center']
    search_fields = ['requisition_number', 'justification']
    ordering_fields = ['requisition_date', 'required_date', 'total_estimated', 'created_at']
    ordering = ['-requisition_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return PurchaseRequisitionListSerializer
        return PurchaseRequisitionDetailSerializer

    def get_queryset(self):
        if self.action == 'list':
            return PurchaseRequisition.objects.select_related(
                'requested_by', 'department', 'cost_center'
            )
        return PurchaseRequisition.objects.select_related(
            'requested_by', 'department', 'cost_center', 'approved_by'
        ).prefetch_related('items__item', 'items__budget')

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit a draft requisition for approval."""
        requisition = self.get_object()
        if requisition.status != PurchaseRequisition.Status.DRAFT:
            return Response(
                {'error': 'Only draft requisitions can be submitted.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not requisition.items.exists():
            return Response(
                {'error': 'Requisition must have at least one item.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        requisition.status = PurchaseRequisition.Status.SUBMITTED
        requisition.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(requisition).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a submitted requisition."""
        requisition = self.get_object()
        if requisition.status != PurchaseRequisition.Status.SUBMITTED:
            return Response(
                {'error': 'Only submitted requisitions can be approved.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        requisition.status = PurchaseRequisition.Status.APPROVED
        requisition.approved_by = request.user
        requisition.approved_at = timezone.now()
        requisition.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])
        return Response(self.get_serializer(requisition).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a submitted requisition."""
        requisition = self.get_object()
        if requisition.status != PurchaseRequisition.Status.SUBMITTED:
            return Response(
                {'error': 'Only submitted requisitions can be rejected.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        reason = request.data.get('reason', '')
        requisition.status = PurchaseRequisition.Status.REJECTED
        requisition.rejection_reason = reason
        requisition.save(update_fields=['status', 'rejection_reason', 'updated_at'])
        return Response(self.get_serializer(requisition).data)


class RequisitionItemViewSet(viewsets.ModelViewSet):
    serializer_class = RequisitionItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['requisition', 'item']

    def get_queryset(self):
        return RequisitionItem.objects.select_related(
            'requisition', 'item', 'budget'
        )


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'vendor', 'requisition']
    search_fields = ['po_number', 'notes', 'vendor__name']
    ordering_fields = ['order_date', 'delivery_date', 'total_amount', 'created_at']
    ordering = ['-order_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return PurchaseOrderListSerializer
        return PurchaseOrderDetailSerializer

    def get_queryset(self):
        if self.action == 'list':
            return PurchaseOrder.objects.select_related('vendor', 'requisition')
        return PurchaseOrder.objects.select_related(
            'vendor', 'requisition', 'approved_by'
        ).prefetch_related('items__item', 'items__requisition_item')

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit a draft PO for approval."""
        po = self.get_object()
        if po.status != PurchaseOrder.Status.DRAFT:
            return Response(
                {'error': 'Only draft purchase orders can be submitted.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not po.items.exists():
            return Response(
                {'error': 'Purchase order must have at least one item.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        po.status = PurchaseOrder.Status.SUBMITTED
        po.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(po).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a submitted PO."""
        po = self.get_object()
        if po.status != PurchaseOrder.Status.SUBMITTED:
            return Response(
                {'error': 'Only submitted purchase orders can be approved.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        po.status = PurchaseOrder.Status.APPROVED
        po.approved_by = request.user
        po.approved_at = timezone.now()
        po.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])
        return Response(self.get_serializer(po).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a submitted PO."""
        po = self.get_object()
        if po.status != PurchaseOrder.Status.SUBMITTED:
            return Response(
                {'error': 'Only submitted purchase orders can be rejected.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        po.status = PurchaseOrder.Status.CANCELLED
        po.notes = request.data.get('reason', po.notes)
        po.save(update_fields=['status', 'notes', 'updated_at'])
        return Response(self.get_serializer(po).data)


class PurchaseOrderItemViewSet(viewsets.ModelViewSet):
    serializer_class = PurchaseOrderItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['purchase_order', 'item']

    def get_queryset(self):
        return PurchaseOrderItem.objects.select_related(
            'purchase_order', 'requisition_item', 'item'
        )


class GoodsReceiptNoteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'purchase_order', 'received_by', 'warehouse']
    search_fields = ['grn_number', 'inspection_notes']
    ordering_fields = ['receipt_date', 'created_at']
    ordering = ['-receipt_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return GoodsReceiptNoteListSerializer
        return GoodsReceiptNoteDetailSerializer

    def get_queryset(self):
        if self.action == 'list':
            return GoodsReceiptNote.objects.select_related(
                'purchase_order', 'received_by', 'warehouse'
            )
        return GoodsReceiptNote.objects.select_related(
            'purchase_order__vendor', 'received_by', 'warehouse'
        ).prefetch_related('items__po_item')


class GRNItemViewSet(viewsets.ModelViewSet):
    serializer_class = GRNItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['grn', 'po_item']

    def get_queryset(self):
        return GRNItem.objects.select_related('grn', 'po_item')


class ContractViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'contract_type', 'vendor', 'auto_renew']
    search_fields = ['contract_number', 'title', 'description', 'vendor__name']
    ordering_fields = ['start_date', 'end_date', 'value', 'created_at']
    ordering = ['-start_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return ContractListSerializer
        return ContractDetailSerializer

    def get_queryset(self):
        if self.action == 'list':
            return Contract.objects.select_related('vendor')
        return Contract.objects.select_related(
            'vendor', 'signed_by'
        ).prefetch_related('milestones')


class ContractMilestoneViewSet(viewsets.ModelViewSet):
    serializer_class = ContractMilestoneSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['contract', 'status']
    ordering_fields = ['due_date', 'amount']
    ordering = ['due_date']

    def get_queryset(self):
        return ContractMilestone.objects.select_related('contract__vendor')


# ---- RFQ ViewSets ----

class RequestForQuotationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'requisition']
    search_fields = ['rfq_number', 'notes']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return RequestForQuotationListSerializer
        return RequestForQuotationDetailSerializer

    def get_queryset(self):
        if self.action == 'list':
            return RequestForQuotation.objects.select_related('requisition')
        return RequestForQuotation.objects.select_related(
            'requisition'
        ).prefetch_related('items', 'vendors__vendor')

    def perform_create(self, serializer):
        from .services import _generate_rfq_number
        tenant = getattr(self.request, 'tenant', None)
        number = _generate_rfq_number(tenant=tenant)
        serializer.save(rfq_number=number)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        rfq = self.get_object()
        if rfq.status != RequestForQuotation.Status.DRAFT:
            return Response({'error': 'Only draft RFQs can be sent'}, status=status.HTTP_400_BAD_REQUEST)
        if not rfq.vendors.exists():
            return Response({'error': 'Add at least one vendor before sending'}, status=status.HTTP_400_BAD_REQUEST)
        rfq.status = RequestForQuotation.Status.SENT
        rfq.save(update_fields=['status', 'updated_at'])
        # Mark invited_at for all vendors
        from django.utils import timezone as tz
        rfq.vendors.filter(invited_at__isnull=True).update(invited_at=tz.now())
        return Response(self.get_serializer(rfq).data)

    @action(detail=True, methods=['post'])
    def evaluate(self, request, pk=None):
        rfq = self.get_object()
        if rfq.status not in (RequestForQuotation.Status.SENT, RequestForQuotation.Status.RECEIVED):
            return Response({'error': 'RFQ must be SENT or RECEIVED to evaluate'}, status=status.HTTP_400_BAD_REQUEST)
        rfq.status = RequestForQuotation.Status.EVALUATED
        rfq.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(rfq).data)

    @action(detail=True, methods=['post'])
    def award(self, request, pk=None):
        rfq = self.get_object()
        vendor_id = request.data.get('vendor_id')
        if not vendor_id:
            return Response({'error': 'vendor_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        if rfq.status != RequestForQuotation.Status.EVALUATED:
            return Response({'error': 'RFQ must be evaluated before awarding'}, status=status.HTTP_400_BAD_REQUEST)
        rfq.status = RequestForQuotation.Status.AWARDED
        rfq.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(rfq).data)

    @action(detail=True, methods=['post'], url_path='convert-to-po')
    def convert_to_po(self, request, pk=None):
        """Convert an awarded RFQ to a Purchase Order."""
        rfq = self.get_object()
        vendor_id = request.data.get('vendor_id')
        if rfq.status != RequestForQuotation.Status.AWARDED:
            return Response({'error': 'Only awarded RFQs can be converted to PO'}, status=status.HTTP_400_BAD_REQUEST)
        if not vendor_id:
            return Response({'error': 'vendor_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from .services import convert_rfq_to_po
            po = convert_rfq_to_po(rfq, vendor_id, request.user)
            return Response({'po_number': po.po_number, 'po_id': str(po.pk)}, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class RFQVendorViewSet(viewsets.ModelViewSet):
    serializer_class = RFQVendorSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['rfq', 'vendor', 'response_received']

    def get_queryset(self):
        return RFQVendor.objects.select_related('vendor', 'rfq')


class RFQItemViewSet(viewsets.ModelViewSet):
    serializer_class = RFQItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['rfq']

    def get_queryset(self):
        return RFQItem.objects.select_related('rfq')


# ---- Vendor Scorecard & Blacklist ----

class VendorScorecardViewSet(viewsets.ModelViewSet):
    serializer_class = VendorScorecardSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['vendor']
    ordering = ['-period_end']

    def get_queryset(self):
        return VendorScorecard.objects.select_related('vendor')


class VendorBlacklistViewSet(viewsets.ModelViewSet):
    serializer_class = VendorBlacklistSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['vendor', 'is_active']

    def get_queryset(self):
        return VendorBlacklist.objects.select_related('vendor')
