"""URL routing for manufacturing module."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'boms', views.BOMViewSet, basename='bom')
router.register(r'bom-lines', views.BOMLineViewSet, basename='bom-line')
router.register(r'routings', views.ProductionRoutingViewSet, basename='routing')
router.register(r'work-centers', views.WorkCenterViewSet, basename='work-center')
router.register(r'work-orders', views.WorkOrderViewSet, basename='work-order')
router.register(r'work-order-operations', views.WorkOrderOperationViewSet, basename='work-order-operation')
router.register(r'material-consumptions', views.MaterialConsumptionViewSet, basename='material-consumption')
router.register(r'quality-checks', views.QualityCheckViewSet, basename='quality-check')
router.register(r'production-batches', views.ProductionBatchViewSet, basename='production-batch')

urlpatterns = [
    path('', include(router.urls)),
]
