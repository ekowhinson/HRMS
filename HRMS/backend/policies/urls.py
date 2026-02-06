"""
URL configuration for the Company Policy module.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'categories', views.PolicyCategoryViewSet, basename='policy-category')
router.register(r'policies', views.PolicyViewSet, basename='policy')
router.register(r'acknowledgements', views.PolicyAcknowledgementViewSet, basename='policy-acknowledgement')
router.register(r'notifications', views.PolicyNotificationViewSet, basename='policy-notification')

urlpatterns = [
    path('', include(router.urls)),
]
