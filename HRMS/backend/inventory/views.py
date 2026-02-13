"""
Views for inventory and asset management.
"""

from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db import transaction

from .models import (
    ItemCategory, Item, Warehouse, StockEntry, StockLedger,
    Asset, AssetDepreciation, AssetTransfer, MaintenanceSchedule,
    AssetDisposal, CycleCount, CycleCountItem,
)
from .serializers import (
    ItemCategorySerializer, ItemSerializer, WarehouseSerializer,
    StockEntrySerializer, StockLedgerSerializer,
    AssetSerializer, AssetListSerializer,
    AssetDepreciationSerializer, AssetTransferSerializer,
    MaintenanceScheduleSerializer,
    AssetDisposalSerializer, CycleCountSerializer, CycleCountItemSerializer,
)


class ItemCategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for item categories."""
    serializer_class = ItemCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_asset_category', 'parent']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        return ItemCategory.objects.select_related('parent', 'gl_account')


class ItemViewSet(viewsets.ModelViewSet):
    """ViewSet for items."""
    serializer_class = ItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_stockable', 'is_asset', 'is_active']
    search_fields = ['code', 'name', 'description']
    ordering_fields = ['code', 'name', 'standard_cost', 'created_at']
    ordering = ['code']

    def get_queryset(self):
        return Item.objects.select_related('category')

    @action(detail=True, methods=['get'])
    def stock_levels(self, request, pk=None):
        """Get stock levels across all warehouses for this item."""
        item = self.get_object()
        ledger_entries = StockLedger.objects.filter(
            item=item
        ).select_related('warehouse')
        serializer = StockLedgerSerializer(ledger_entries, many=True)
        return Response(serializer.data)


class WarehouseViewSet(viewsets.ModelViewSet):
    """ViewSet for warehouses."""
    serializer_class = WarehouseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'location', 'manager']
    search_fields = ['code', 'name', 'address']
    ordering_fields = ['code', 'name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        return Warehouse.objects.select_related('location', 'manager')

    @action(detail=True, methods=['get'])
    def stock(self, request, pk=None):
        """Get all stock levels in this warehouse."""
        warehouse = self.get_object()
        ledger_entries = StockLedger.objects.filter(
            warehouse=warehouse
        ).select_related('item')
        serializer = StockLedgerSerializer(ledger_entries, many=True)
        return Response(serializer.data)


class StockEntryViewSet(viewsets.ModelViewSet):
    """ViewSet for stock entries."""
    serializer_class = StockEntrySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['entry_type', 'item', 'warehouse', 'to_warehouse', 'source']
    search_fields = ['reference_number', 'source_reference', 'notes', 'item__code', 'item__name']
    ordering_fields = ['entry_date', 'created_at', 'total_cost']
    ordering = ['-entry_date']

    def get_queryset(self):
        return StockEntry.objects.select_related(
            'item', 'warehouse', 'to_warehouse'
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a stock entry and update stock ledger."""
        stock_entry = self.get_object()

        with transaction.atomic():
            # Update or create ledger entry for the source warehouse
            ledger, created = StockLedger.objects.get_or_create(
                item=stock_entry.item,
                warehouse=stock_entry.warehouse,
                defaults={'balance_qty': 0, 'valuation_amount': 0},
            )

            if stock_entry.entry_type in [StockEntry.EntryType.RECEIPT, StockEntry.EntryType.RETURN]:
                ledger.balance_qty += stock_entry.quantity
                ledger.valuation_amount += stock_entry.total_cost
            elif stock_entry.entry_type == StockEntry.EntryType.ISSUE:
                ledger.balance_qty -= stock_entry.quantity
                ledger.valuation_amount -= stock_entry.total_cost
            elif stock_entry.entry_type == StockEntry.EntryType.TRANSFER:
                ledger.balance_qty -= stock_entry.quantity
                ledger.valuation_amount -= stock_entry.total_cost

                # Credit the destination warehouse
                if stock_entry.to_warehouse:
                    to_ledger, created = StockLedger.objects.get_or_create(
                        item=stock_entry.item,
                        warehouse=stock_entry.to_warehouse,
                        defaults={'balance_qty': 0, 'valuation_amount': 0},
                    )
                    to_ledger.balance_qty += stock_entry.quantity
                    to_ledger.valuation_amount += stock_entry.total_cost
                    to_ledger.last_movement_date = stock_entry.entry_date
                    to_ledger.save()
            elif stock_entry.entry_type == StockEntry.EntryType.ADJUSTMENT:
                # Adjustment sets the quantity directly as a delta
                ledger.balance_qty += stock_entry.quantity
                ledger.valuation_amount += stock_entry.total_cost

            ledger.last_movement_date = stock_entry.entry_date
            ledger.save()

        serializer = self.get_serializer(stock_entry)
        return Response({'message': 'Stock entry approved and ledger updated', 'data': serializer.data})


class StockLedgerViewSet(viewsets.ModelViewSet):
    """ViewSet for stock ledger (read-heavy)."""
    serializer_class = StockLedgerSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['item', 'warehouse']
    search_fields = ['item__code', 'item__name', 'warehouse__code', 'warehouse__name']
    ordering_fields = ['balance_qty', 'valuation_amount', 'last_movement_date']
    ordering = ['item__code']

    def get_queryset(self):
        return StockLedger.objects.select_related('item', 'warehouse')


class AssetViewSet(viewsets.ModelViewSet):
    """ViewSet for assets."""
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'category', 'location', 'department', 'custodian', 'depreciation_method']
    search_fields = ['asset_number', 'name', 'serial_number', 'description', 'insurance_policy']
    ordering_fields = ['asset_number', 'name', 'acquisition_date', 'acquisition_cost', 'current_value']
    ordering = ['asset_number']

    def get_serializer_class(self):
        if self.action == 'list':
            return AssetListSerializer
        return AssetSerializer

    def get_queryset(self):
        qs = Asset.objects.select_related(
            'category', 'item', 'location', 'department', 'custodian'
        )
        if self.action in ('retrieve', 'update', 'partial_update'):
            qs = qs.prefetch_related('depreciations', 'transfers', 'maintenance_schedules')
        return qs

    @action(detail=True, methods=['post'])
    def dispose(self, request, pk=None):
        """Dispose of an asset."""
        asset = self.get_object()

        if asset.status == Asset.Status.DISPOSED:
            return Response(
                {'error': 'Asset is already disposed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        disposal_date = request.data.get('disposal_date')
        disposal_value = request.data.get('disposal_value')

        if not disposal_date:
            return Response(
                {'error': 'Disposal date is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        asset.status = Asset.Status.DISPOSED
        asset.disposal_date = disposal_date
        asset.disposal_value = disposal_value
        asset.save()

        serializer = self.get_serializer(asset)
        return Response({'message': 'Asset disposed successfully', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def transfer(self, request, pk=None):
        """Create a transfer request for an asset."""
        asset = self.get_object()

        if asset.status in [Asset.Status.DISPOSED, Asset.Status.RETIRED, Asset.Status.LOST]:
            return Response(
                {'error': f'Cannot transfer an asset with status {asset.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        to_location = request.data.get('to_location')
        to_custodian = request.data.get('to_custodian')
        to_department = request.data.get('to_department')
        transfer_date = request.data.get('transfer_date')
        reason = request.data.get('reason', '')

        if not transfer_date:
            return Response(
                {'error': 'Transfer date is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not to_location and not to_custodian and not to_department:
            return Response(
                {'error': 'At least one destination field (location, custodian, or department) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        transfer = AssetTransfer.objects.create(
            asset=asset,
            from_location=asset.location,
            to_location_id=to_location,
            from_custodian=asset.custodian,
            to_custodian_id=to_custodian,
            from_department=asset.department,
            to_department_id=to_department,
            transfer_date=transfer_date,
            reason=reason,
            status=AssetTransfer.Status.PENDING,
        )

        serializer = AssetTransferSerializer(transfer)
        return Response({'message': 'Transfer request created', 'data': serializer.data}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def depreciation_history(self, request, pk=None):
        """Get depreciation history for an asset."""
        asset = self.get_object()
        depreciations = AssetDepreciation.objects.filter(
            asset=asset
        ).select_related('fiscal_period', 'journal_entry').order_by('-fiscal_period__start_date')
        serializer = AssetDepreciationSerializer(depreciations, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def transfer_history(self, request, pk=None):
        """Get transfer history for an asset."""
        asset = self.get_object()
        transfers = AssetTransfer.objects.filter(
            asset=asset
        ).select_related(
            'from_location', 'to_location', 'from_custodian', 'to_custodian',
            'from_department', 'to_department', 'approved_by'
        ).order_by('-transfer_date')
        serializer = AssetTransferSerializer(transfers, many=True)
        return Response(serializer.data)


class AssetDepreciationViewSet(viewsets.ModelViewSet):
    """ViewSet for asset depreciation records."""
    serializer_class = AssetDepreciationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['asset', 'fiscal_period']
    search_fields = ['asset__asset_number', 'asset__name']
    ordering_fields = ['depreciation_amount', 'book_value']
    ordering = ['-fiscal_period__start_date']

    def get_queryset(self):
        return AssetDepreciation.objects.select_related(
            'asset', 'fiscal_period', 'journal_entry'
        )


class AssetTransferViewSet(viewsets.ModelViewSet):
    """ViewSet for asset transfers."""
    serializer_class = AssetTransferSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'asset', 'from_location', 'to_location', 'from_custodian', 'to_custodian']
    search_fields = ['asset__asset_number', 'asset__name', 'reason']
    ordering_fields = ['transfer_date', 'created_at']
    ordering = ['-transfer_date']

    def get_queryset(self):
        return AssetTransfer.objects.select_related(
            'asset', 'from_location', 'to_location',
            'from_custodian', 'to_custodian',
            'from_department', 'to_department', 'approved_by'
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve and complete an asset transfer."""
        transfer = self.get_object()

        if transfer.status != AssetTransfer.Status.PENDING:
            return Response(
                {'error': 'Only pending transfers can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            transfer.status = AssetTransfer.Status.COMPLETED
            transfer.approved_by = request.user
            transfer.approved_at = timezone.now()
            transfer.save()

            # Update the asset's location, custodian, and department
            asset = transfer.asset
            if transfer.to_location:
                asset.location = transfer.to_location
            if transfer.to_custodian:
                asset.custodian = transfer.to_custodian
            if transfer.to_department:
                asset.department = transfer.to_department
            asset.save()

        serializer = self.get_serializer(transfer)
        return Response({'message': 'Transfer approved and completed', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject an asset transfer."""
        transfer = self.get_object()

        if transfer.status != AssetTransfer.Status.PENDING:
            return Response(
                {'error': 'Only pending transfers can be rejected'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get('reason', '')
        if not reason:
            return Response(
                {'error': 'Rejection reason is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        transfer.status = AssetTransfer.Status.REJECTED
        transfer.approved_by = request.user
        transfer.approved_at = timezone.now()
        transfer.reason = f"{transfer.reason}\nRejected: {reason}" if transfer.reason else f"Rejected: {reason}"
        transfer.save()

        serializer = self.get_serializer(transfer)
        return Response({'message': 'Transfer rejected', 'data': serializer.data})


class MaintenanceScheduleViewSet(viewsets.ModelViewSet):
    """ViewSet for maintenance schedules."""
    serializer_class = MaintenanceScheduleSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['asset', 'frequency', 'vendor', 'is_active']
    search_fields = ['title', 'description', 'asset__asset_number', 'asset__name']
    ordering_fields = ['next_due_date', 'estimated_cost', 'created_at']
    ordering = ['next_due_date']

    def get_queryset(self):
        return MaintenanceSchedule.objects.select_related('asset', 'vendor')

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark a maintenance schedule as completed and set next due date."""
        schedule = self.get_object()
        from datetime import timedelta
        from django.utils import timezone as tz

        completed_date = request.data.get('completed_date', tz.now().date())
        schedule.last_completed = completed_date

        # Calculate next due date based on frequency
        frequency_days = {
            MaintenanceSchedule.Frequency.DAILY: 1,
            MaintenanceSchedule.Frequency.WEEKLY: 7,
            MaintenanceSchedule.Frequency.MONTHLY: 30,
            MaintenanceSchedule.Frequency.QUARTERLY: 90,
            MaintenanceSchedule.Frequency.SEMI_ANNUAL: 182,
            MaintenanceSchedule.Frequency.ANNUAL: 365,
        }

        days = frequency_days.get(schedule.frequency, 30)
        if isinstance(completed_date, str):
            from datetime import date as dt_date
            completed_date = dt_date.fromisoformat(completed_date)
        schedule.next_due_date = completed_date + timedelta(days=days)
        schedule.save()

        serializer = self.get_serializer(schedule)
        return Response({'message': 'Maintenance completed', 'data': serializer.data})


class AssetDisposalViewSet(viewsets.ModelViewSet):
    """ViewSet for asset disposals."""
    serializer_class = AssetDisposalSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'disposal_type', 'asset']
    search_fields = ['asset__asset_number', 'asset__name', 'reason']
    ordering_fields = ['disposal_date', 'proceeds', 'gain_loss', 'created_at']
    ordering = ['-disposal_date']

    def get_queryset(self):
        return AssetDisposal.objects.select_related(
            'asset', 'journal_entry', 'approved_by'
        )

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit a draft disposal for approval."""
        disposal = self.get_object()
        if disposal.status != AssetDisposal.Status.DRAFT:
            return Response(
                {'error': 'Only draft disposals can be submitted.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        disposal.status = AssetDisposal.Status.PENDING
        disposal.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(disposal).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve an asset disposal and trigger GL posting."""
        disposal = self.get_object()
        if disposal.status != AssetDisposal.Status.PENDING:
            return Response(
                {'error': 'Only pending disposals can be approved.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            disposal.status = AssetDisposal.Status.APPROVED
            disposal.approved_by = request.user
            disposal.save(update_fields=['status', 'approved_by', 'updated_at'])

            # Update the asset status
            asset = disposal.asset
            asset.status = Asset.Status.DISPOSED
            asset.disposal_date = disposal.disposal_date
            asset.disposal_value = disposal.proceeds
            asset.save(update_fields=['status', 'disposal_date', 'disposal_value', 'updated_at'])

            # Trigger GL posting
            try:
                from finance.tasks import post_asset_disposal_to_gl
                post_asset_disposal_to_gl.delay(str(disposal.pk))
            except Exception:
                pass  # GL posting is async; failure doesn't block approval

        return Response(self.get_serializer(disposal).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject an asset disposal."""
        disposal = self.get_object()
        if disposal.status != AssetDisposal.Status.PENDING:
            return Response(
                {'error': 'Only pending disposals can be rejected.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        reason = request.data.get('reason', '')
        disposal.status = AssetDisposal.Status.REJECTED
        disposal.reason = f"{disposal.reason}\nRejected: {reason}" if disposal.reason else f"Rejected: {reason}"
        disposal.save(update_fields=['status', 'reason', 'updated_at'])
        return Response(self.get_serializer(disposal).data)


class CycleCountViewSet(viewsets.ModelViewSet):
    """ViewSet for inventory cycle counts."""
    serializer_class = CycleCountSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'warehouse', 'counted_by']
    search_fields = ['warehouse__code', 'warehouse__name', 'notes']
    ordering_fields = ['count_date', 'created_at']
    ordering = ['-count_date']

    def get_queryset(self):
        return CycleCount.objects.select_related(
            'warehouse', 'counted_by', 'approved_by'
        ).prefetch_related('items__item')

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Start a planned cycle count and populate system quantities."""
        cycle_count = self.get_object()
        if cycle_count.status != CycleCount.Status.PLANNED:
            return Response(
                {'error': 'Only planned cycle counts can be started.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            cycle_count.status = CycleCount.Status.IN_PROGRESS
            cycle_count.save(update_fields=['status', 'updated_at'])

            # Auto-populate system quantities from StockLedger
            ledger_entries = StockLedger.objects.filter(
                warehouse=cycle_count.warehouse
            ).select_related('item')

            for ledger in ledger_entries:
                CycleCountItem.objects.get_or_create(
                    cycle_count=cycle_count,
                    item=ledger.item,
                    defaults={'system_qty': ledger.balance_qty, 'counted_qty': 0},
                )

        return Response(self.get_serializer(cycle_count).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete a cycle count."""
        cycle_count = self.get_object()
        if cycle_count.status != CycleCount.Status.IN_PROGRESS:
            return Response(
                {'error': 'Only in-progress cycle counts can be completed.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        cycle_count.status = CycleCount.Status.COMPLETED
        cycle_count.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(cycle_count).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a completed cycle count and create adjustment entries."""
        cycle_count = self.get_object()
        if cycle_count.status != CycleCount.Status.COMPLETED:
            return Response(
                {'error': 'Only completed cycle counts can be approved.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            cycle_count.status = CycleCount.Status.APPROVED
            cycle_count.approved_by = request.user
            cycle_count.save(update_fields=['status', 'approved_by', 'updated_at'])

            # Create stock adjustment entries for items with variance
            for count_item in cycle_count.items.filter(adjustment_entry__isnull=True).exclude(variance=0):
                adjustment = StockEntry.objects.create(
                    entry_type=StockEntry.EntryType.ADJUSTMENT,
                    entry_date=cycle_count.count_date,
                    item=count_item.item,
                    warehouse=cycle_count.warehouse,
                    quantity=count_item.variance,
                    unit_cost=count_item.item.standard_cost,
                    source='CYCLE_COUNT',
                    source_reference=str(cycle_count.pk),
                    notes=f"Cycle count adjustment: system={count_item.system_qty}, counted={count_item.counted_qty}",
                )
                count_item.adjustment_entry = adjustment
                count_item.save(update_fields=['adjustment_entry', 'updated_at'])

                # Update stock ledger
                ledger, _ = StockLedger.objects.get_or_create(
                    item=count_item.item,
                    warehouse=cycle_count.warehouse,
                    defaults={'balance_qty': 0, 'valuation_amount': 0},
                )
                ledger.balance_qty += count_item.variance
                ledger.valuation_amount += count_item.variance * count_item.item.standard_cost
                ledger.last_movement_date = cycle_count.count_date
                ledger.save()

        return Response(self.get_serializer(cycle_count).data)

    @action(detail=True, methods=['get'])
    def items(self, request, pk=None):
        """Get all items in this cycle count."""
        cycle_count = self.get_object()
        items = cycle_count.items.select_related('item', 'adjustment_entry')
        serializer = CycleCountItemSerializer(items, many=True)
        return Response(serializer.data)


class CycleCountItemViewSet(viewsets.ModelViewSet):
    """ViewSet for cycle count items."""
    serializer_class = CycleCountItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['cycle_count', 'item']

    def get_queryset(self):
        return CycleCountItem.objects.select_related(
            'cycle_count', 'item', 'adjustment_entry'
        )
