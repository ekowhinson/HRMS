"""
URL configuration for training app.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    TrainingProgramViewSet, TrainingSessionViewSet,
    TrainingEnrollmentViewSet, TrainingDashboardView,
)

router = DefaultRouter()
router.register(r'programs', TrainingProgramViewSet, basename='training-program')
router.register(r'sessions', TrainingSessionViewSet, basename='training-session')
router.register(r'enrollments', TrainingEnrollmentViewSet, basename='training-enrollment')

urlpatterns = [
    path('dashboard/', TrainingDashboardView.as_view(), name='training-dashboard'),
    path('', include(router.urls)),
]
