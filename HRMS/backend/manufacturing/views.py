"""ViewSets for manufacturing module."""

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    BillOfMaterials, BOMLine, WorkCenter, ProductionRouting,
    WorkOrder, WorkOrderOperation, MaterialConsumption,
    QualityCheck, ProductionBatch
)
from .serializers import (
    BOMSerializer, BOMLineSerializer, WorkCenterSerializer,
    ProductionRoutingSerializer, WorkOrderSerializer,
    WorkOrderOperationSerializer, MaterialConsumptionSerializer,
    QualityCheckSerializer, ProductionBatchSerializer
)
from . import services


class BOMViewSet(viewsets.ModelViewSet):
    serializer_class = BOMSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'is_active', 'finished_product']
    search_fields = ['code', 'name']
    ordering = ['code']

    def get_queryset(self):
        return BillOfMaterials.objects.select_related(
            'finished_product'
        ).prefetch_related('lines__raw_material', 'routings__work_center')

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        bom = self.get_object()
        bom.status = BillOfMaterials.Status.ACTIVE
        bom.is_active = True
        bom.save(update_fields=['status', 'is_active', 'updated_at'])
        return Response(self.get_serializer(bom).data)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        bom = self.get_object()
        bom.status = BillOfMaterials.Status.OBSOLETE
        bom.is_active = False
        bom.save(update_fields=['status', 'is_active', 'updated_at'])
        return Response(self.get_serializer(bom).data)

    @action(detail=True, methods=['post'], url_path='copy-version')
    def copy_version(self, request, pk=None):
        """Create a new version of this BOM."""
        bom = self.get_object()
        new_version = BillOfMaterials.objects.filter(
            finished_product=bom.finished_product, tenant=bom.tenant
        ).count() + 1

        new_bom = BillOfMaterials(
            tenant=bom.tenant,
            code=f"{bom.code}-v{new_version}",
            name=bom.name,
            description=bom.description,
            finished_product=bom.finished_product,
            version=new_version,
            yield_qty=bom.yield_qty,
            status=BillOfMaterials.Status.DRAFT,
        )
        new_bom.save()

        # Copy lines
        for line in bom.lines.all():
            BOMLine.objects.create(
                tenant=bom.tenant, bom=new_bom,
                raw_material=line.raw_material,
                quantity=line.quantity,
                unit_of_measure=line.unit_of_measure,
                scrap_percent=line.scrap_percent,
                sort_order=line.sort_order,
            )

        # Copy routings
        for routing in bom.routings.all():
            ProductionRouting.objects.create(
                tenant=bom.tenant, bom=new_bom,
                operation_number=routing.operation_number,
                name=routing.name,
                description=routing.description,
                work_center=routing.work_center,
                setup_time_minutes=routing.setup_time_minutes,
                run_time_minutes=routing.run_time_minutes,
                sort_order=routing.sort_order,
            )

        return Response(self.get_serializer(new_bom).data, status=status.HTTP_201_CREATED)


class BOMLineViewSet(viewsets.ModelViewSet):
    serializer_class = BOMLineSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['bom']

    def get_queryset(self):
        return BOMLine.objects.select_related('raw_material')


class ProductionRoutingViewSet(viewsets.ModelViewSet):
    serializer_class = ProductionRoutingSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['bom', 'work_center']

    def get_queryset(self):
        return ProductionRouting.objects.select_related('work_center')


class WorkCenterViewSet(viewsets.ModelViewSet):
    serializer_class = WorkCenterSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active', 'department']
    search_fields = ['code', 'name']

    def get_queryset(self):
        return WorkCenter.objects.select_related('department')


class WorkOrderViewSet(viewsets.ModelViewSet):
    serializer_class = WorkOrderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'product', 'bom', 'priority']
    search_fields = ['work_order_number', 'product__name', 'notes']
    ordering = ['-created_at']

    def get_queryset(self):
        return WorkOrder.objects.select_related(
            'bom', 'product', 'project', 'cost_center'
        ).prefetch_related(
            'operations__work_center',
            'material_consumptions__item',
            'quality_checks',
            'batches',
        )

    def perform_create(self, serializer):
        from .services import _generate_wo_number
        tenant = getattr(self.request, 'tenant', None)
        number = _generate_wo_number(tenant=tenant)
        serializer.save(work_order_number=number)

    @action(detail=True, methods=['post'])
    def release(self, request, pk=None):
        try:
            wo = services.release_work_order(pk)
            return Response(self.get_serializer(wo).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        wo = self.get_object()
        if wo.status != WorkOrder.Status.RELEASED:
            return Response({'error': 'Only released orders can be started'}, status=status.HTTP_400_BAD_REQUEST)
        from django.utils import timezone
        wo.status = WorkOrder.Status.IN_PROGRESS
        wo.actual_start = timezone.now()
        wo.save(update_fields=['status', 'actual_start', 'updated_at'])
        return Response(self.get_serializer(wo).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        try:
            result = services.close_work_order(pk)
            return Response(result)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        wo = self.get_object()
        if wo.status in (WorkOrder.Status.COMPLETED,):
            return Response({'error': 'Completed orders cannot be cancelled'}, status=status.HTTP_400_BAD_REQUEST)
        wo.status = WorkOrder.Status.CANCELLED
        wo.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(wo).data)

    @action(detail=True, methods=['post'])
    def hold(self, request, pk=None):
        wo = self.get_object()
        wo.status = WorkOrder.Status.ON_HOLD
        wo.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(wo).data)

    @action(detail=True, methods=['post'], url_path='issue-materials')
    def issue_materials(self, request, pk=None):
        try:
            result = services.issue_materials(pk)
            return Response(result)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='report-production')
    def report_production(self, request, pk=None):
        qty = request.data.get('quantity')
        if not qty:
            return Response({'error': 'quantity is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = services.report_production(pk, qty, request.data)
            return Response(result, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class WorkOrderOperationViewSet(viewsets.ModelViewSet):
    serializer_class = WorkOrderOperationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['work_order', 'status']

    def get_queryset(self):
        return WorkOrderOperation.objects.select_related('work_center', 'work_order')


class MaterialConsumptionViewSet(viewsets.ModelViewSet):
    serializer_class = MaterialConsumptionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['work_order']

    def get_queryset(self):
        return MaterialConsumption.objects.select_related('item', 'warehouse')


class QualityCheckViewSet(viewsets.ModelViewSet):
    serializer_class = QualityCheckSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['work_order', 'check_type', 'result']
    ordering = ['-checked_at']

    def get_queryset(self):
        return QualityCheck.objects.select_related('work_order')


class ProductionBatchViewSet(viewsets.ModelViewSet):
    serializer_class = ProductionBatchSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['work_order']
    ordering = ['-manufacture_date']
    http_method_names = ['get', 'head', 'options']  # Read-only

    def get_queryset(self):
        return ProductionBatch.objects.select_related('work_order')
