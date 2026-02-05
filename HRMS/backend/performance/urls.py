"""
URL configuration for performance app.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    AppraisalCycleViewSet, RatingScaleViewSet, CompetencyViewSet,
    GoalCategoryViewSet, AppraisalViewSet, GoalViewSet,
    PIPViewSet, DevelopmentPlanViewSet, DevelopmentActivityViewSet
)

router = DefaultRouter()
router.register(r'cycles', AppraisalCycleViewSet, basename='appraisal-cycle')
router.register(r'rating-scales', RatingScaleViewSet, basename='rating-scale')
router.register(r'competencies', CompetencyViewSet, basename='competency')
router.register(r'goal-categories', GoalCategoryViewSet, basename='goal-category')
router.register(r'appraisals', AppraisalViewSet, basename='appraisal')
router.register(r'goals', GoalViewSet, basename='goal')
router.register(r'pips', PIPViewSet, basename='pip')
router.register(r'development-plans', DevelopmentPlanViewSet, basename='development-plan')
router.register(r'development-activities', DevelopmentActivityViewSet, basename='development-activity')

urlpatterns = [
    path('', include(router.urls)),
]
