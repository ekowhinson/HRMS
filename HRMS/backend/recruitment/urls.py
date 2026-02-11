"""
Recruitment URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'recruitment'

router = DefaultRouter()
router.register(r'vacancies', views.VacancyViewSet, basename='vacancy')
router.register(r'applicants', views.ApplicantViewSet, basename='applicant')
router.register(r'interviews', views.InterviewViewSet, basename='interview')
router.register(r'interview-panels', views.InterviewPanelViewSet, basename='interview-panel')
router.register(r'interview-feedback', views.InterviewFeedbackViewSet, basename='interview-feedback')
router.register(r'references', views.ReferenceViewSet, basename='reference')
router.register(r'offers', views.JobOfferViewSet, basename='offer')

# Interview Scoring
router.register(r'score-templates', views.InterviewScoreTemplateViewSet, basename='score-template')
router.register(r'score-categories', views.InterviewScoreCategoryViewSet, basename='score-category')
router.register(r'scoring-sheets', views.InterviewScoringSheetViewSet, basename='scoring-sheet')
router.register(r'interview-reports', views.InterviewReportViewSet, basename='interview-report')

# Vacancy URLs
router.register(r'vacancy-urls', views.VacancyURLViewSet, basename='vacancy-url')
router.register(r'status-history', views.ApplicantStatusHistoryViewSet, basename='status-history')

# System-Based Shortlisting
router.register(r'shortlist-criteria', views.ShortlistCriteriaViewSet, basename='shortlist-criteria')
router.register(r'shortlist-templates', views.ShortlistTemplateViewSet, basename='shortlist-template')
router.register(r'shortlist-runs', views.ShortlistRunViewSet, basename='shortlist-run')
router.register(r'shortlist-results', views.ShortlistResultViewSet, basename='shortlist-result')

urlpatterns = [
    path('', include(router.urls)),
    path('summary/', views.RecruitmentSummaryView.as_view(), name='recruitment-summary'),

    # Public vacancy/application endpoints (no authentication)
    path('careers/', views.PublicVacancyListView.as_view(), name='public-vacancies'),
    path('careers/apply/<slug:slug>/', views.PublicVacancyDetailView.as_view(), name='public-vacancy-detail'),
    path('careers/apply/<slug:slug>/submit/', views.PublicApplicationSubmitView.as_view(), name='public-application-submit'),

    # Applicant portal
    path('portal/login/', views.ApplicantPortalLoginView.as_view(), name='portal-login'),
    path('portal/status/', views.ApplicantPortalStatusView.as_view(), name='portal-status'),
    path('portal/dashboard/', views.ApplicantPortalDashboardView.as_view(), name='portal-dashboard'),
    path('portal/offer/', views.ApplicantPortalOfferView.as_view(), name='portal-offer'),
    path('portal/offer/accept/', views.ApplicantPortalOfferAcceptView.as_view(), name='portal-offer-accept'),
    path('portal/offer/decline/', views.ApplicantPortalOfferDeclineView.as_view(), name='portal-offer-decline'),
    path('portal/documents/', views.ApplicantPortalDocumentsView.as_view(), name='portal-documents'),
    path('portal/documents/upload/', views.ApplicantPortalDocumentUploadView.as_view(), name='portal-document-upload'),
    path('portal/interviews/', views.ApplicantPortalInterviewsView.as_view(), name='portal-interviews'),
]
