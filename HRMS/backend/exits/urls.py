"""
URL configuration for Exit/Offboarding module.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'types', views.ExitTypeViewSet, basename='exit-type')
router.register(r'departments', views.ClearanceDepartmentViewSet, basename='clearance-department')
router.register(r'requests', views.ExitRequestViewSet, basename='exit-request')
router.register(r'interviews', views.ExitInterviewViewSet, basename='exit-interview')
router.register(r'clearances', views.ExitClearanceViewSet, basename='exit-clearance')
router.register(r'assets', views.AssetReturnViewSet, basename='asset-return')
router.register(r'settlements', views.FinalSettlementViewSet, basename='final-settlement')

app_name = 'exits'

urlpatterns = [
    path('', include(router.urls)),
]
