"""
Discipline & Grievance URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'discipline'

router = DefaultRouter()
router.register(r'misconduct-categories', views.MisconductCategoryViewSet, basename='misconduct-category')
router.register(r'grievance-categories', views.GrievanceCategoryViewSet, basename='grievance-category')
router.register(r'cases', views.DisciplinaryCaseViewSet, basename='case')
router.register(r'actions', views.DisciplinaryActionViewSet, basename='action')
router.register(r'hearings', views.DisciplinaryHearingViewSet, basename='hearing')
router.register(r'committee-members', views.HearingCommitteeMemberViewSet, basename='committee-member')
router.register(r'evidence', views.DisciplinaryEvidenceViewSet, basename='evidence')
router.register(r'appeals', views.DisciplinaryAppealViewSet, basename='appeal')
router.register(r'grievances', views.GrievanceViewSet, basename='grievance')
router.register(r'grievance-notes', views.GrievanceNoteViewSet, basename='grievance-note')
router.register(r'grievance-attachments', views.GrievanceAttachmentViewSet, basename='grievance-attachment')

urlpatterns = [
    path('', include(router.urls)),
    # Self-service endpoints
    path('my-cases/', views.MyDisciplinaryCasesView.as_view(), name='my-cases'),
    path('my-cases/<uuid:pk>/respond/', views.RespondToShowCauseView.as_view(), name='respond-show-cause'),
    path('my-cases/<uuid:pk>/acknowledge-action/', views.AcknowledgeActionView.as_view(), name='acknowledge-action'),
    path('my-cases/<uuid:pk>/appeal/', views.FileAppealView.as_view(), name='file-appeal'),
    path('my-grievances/', views.MyGrievancesView.as_view(), name='my-grievances'),
    path('my-grievances/file/', views.FileGrievanceView.as_view(), name='file-grievance'),
]
