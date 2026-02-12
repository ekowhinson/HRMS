"""
URL configuration for performance app.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    AppraisalCycleViewSet, RatingScaleViewSet, CompetencyViewSet,
    GoalCategoryViewSet, AppraisalViewSet, GoalViewSet,
    PIPViewSet, DevelopmentPlanViewSet, DevelopmentActivityViewSet,
    CoreValueViewSet, CoreValueAssessmentViewSet,
    ProbationAssessmentViewSet, TrainingNeedViewSet, PerformanceAppealViewSet,
    TrainingDocumentViewSet, AppraisalDocumentViewSet,
    AppraisalScheduleViewSet, AppraisalDeadlineExtensionViewSet,
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

# Additional endpoints
router.register(r'core-values', CoreValueViewSet, basename='core-value')
router.register(r'value-assessments', CoreValueAssessmentViewSet, basename='value-assessment')
router.register(r'probation-assessments', ProbationAssessmentViewSet, basename='probation-assessment')
router.register(r'training-needs', TrainingNeedViewSet, basename='training-need')
router.register(r'appeals', PerformanceAppealViewSet, basename='performance-appeal')

# Document endpoints
router.register(r'training-documents', TrainingDocumentViewSet, basename='training-document')
router.register(r'appraisal-documents', AppraisalDocumentViewSet, basename='appraisal-document')

# Appraisal scheduling
router.register(r'schedules', AppraisalScheduleViewSet, basename='appraisal-schedule')
router.register(r'deadline-extensions', AppraisalDeadlineExtensionViewSet, basename='deadline-extension')

urlpatterns = [
    path('', include(router.urls)),
]
