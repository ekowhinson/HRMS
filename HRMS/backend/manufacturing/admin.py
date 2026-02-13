"""Admin configuration for manufacturing module."""

from django.contrib import admin
from .models import (
    BillOfMaterials, BOMLine, WorkCenter, ProductionRouting,
    WorkOrder, WorkOrderOperation, MaterialConsumption,
    QualityCheck, ProductionBatch
)


class BOMLineInline(admin.TabularInline):
    model = BOMLine
    extra = 1


@admin.register(BillOfMaterials)
class BOMAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'finished_product', 'version', 'status']
    list_filter = ['status', 'is_active']
    search_fields = ['code', 'name']
    inlines = [BOMLineInline]


@admin.register(WorkCenter)
class WorkCenterAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'hourly_rate', 'capacity_per_day', 'is_active']
    list_filter = ['is_active']


@admin.register(WorkOrder)
class WorkOrderAdmin(admin.ModelAdmin):
    list_display = ['work_order_number', 'product', 'planned_qty', 'completed_qty', 'status']
    list_filter = ['status', 'priority']
    search_fields = ['work_order_number']


@admin.register(QualityCheck)
class QualityCheckAdmin(admin.ModelAdmin):
    list_display = ['work_order', 'check_type', 'parameter', 'result', 'checked_at']
    list_filter = ['check_type', 'result']


@admin.register(ProductionBatch)
class ProductionBatchAdmin(admin.ModelAdmin):
    list_display = ['batch_number', 'work_order', 'quantity', 'manufacture_date']
