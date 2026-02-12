"""URL routing for procurement app."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'requisitions', views.PurchaseRequisitionViewSet, basename='requisition')
router.register(r'requisition-items', views.RequisitionItemViewSet, basename='requisition-item')
router.register(r'purchase-orders', views.PurchaseOrderViewSet, basename='purchase-order')
router.register(r'purchase-order-items', views.PurchaseOrderItemViewSet, basename='purchase-order-item')
router.register(r'goods-receipts', views.GoodsReceiptNoteViewSet, basename='goods-receipt')
router.register(r'grn-items', views.GRNItemViewSet, basename='grn-item')
router.register(r'contracts', views.ContractViewSet, basename='contract')
router.register(r'contract-milestones', views.ContractMilestoneViewSet, basename='contract-milestone')

urlpatterns = [
    path('', include(router.urls)),
]
