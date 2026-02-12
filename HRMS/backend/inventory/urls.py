"""
Inventory and asset management URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'inventory'

router = DefaultRouter()
router.register(r'categories', views.ItemCategoryViewSet, basename='item-category')
router.register(r'items', views.ItemViewSet, basename='item')
router.register(r'warehouses', views.WarehouseViewSet, basename='warehouse')
router.register(r'stock-entries', views.StockEntryViewSet, basename='stock-entry')
router.register(r'stock-ledger', views.StockLedgerViewSet, basename='stock-ledger')
router.register(r'assets', views.AssetViewSet, basename='asset')
router.register(r'asset-depreciations', views.AssetDepreciationViewSet, basename='asset-depreciation')
router.register(r'asset-transfers', views.AssetTransferViewSet, basename='asset-transfer')
router.register(r'maintenance-schedules', views.MaintenanceScheduleViewSet, basename='maintenance-schedule')

urlpatterns = [
    path('', include(router.urls)),
]
