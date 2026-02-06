"""
Employee management URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'employees'

router = DefaultRouter()
router.register(r'', views.EmployeeViewSet, basename='employee')

# Data Update router (separate to avoid collision with employee ID routes)
data_update_router = DefaultRouter()
data_update_router.register(r'data-updates', views.DataUpdateRequestViewSet, basename='data-update')
data_update_router.register(r'data-update-documents', views.DataUpdateDocumentViewSet, basename='data-update-document')

# Service Request router
service_request_router = DefaultRouter()
service_request_router.register(r'service-request-types', views.ServiceRequestTypeViewSet, basename='service-request-type')
service_request_router.register(r'service-requests', views.ServiceRequestViewSet, basename='service-request')
service_request_router.register(r'service-request-comments', views.ServiceRequestCommentViewSet, basename='service-request-comment')
service_request_router.register(r'service-request-documents', views.ServiceRequestDocumentViewSet, basename='service-request-document')

urlpatterns = [
    # Self-service endpoints (must be before router to take precedence over /employees/<id>/)
    path('me/', views.MyProfileView.as_view(), name='my-profile'),
    path('me/leave-balances/', views.MyLeaveBalancesView.as_view(), name='my-leave-balances'),
    path('me/leave-history/', views.MyLeaveHistoryView.as_view(), name='my-leave-history'),
    path('me/emergency-contacts/', views.MyEmergencyContactsView.as_view(), name='my-emergency-contacts'),
    path('me/emergency-contacts/<uuid:pk>/', views.MyEmergencyContactDetailView.as_view(), name='my-emergency-contact-detail'),
    path('me/dependents/', views.MyDependentsView.as_view(), name='my-dependents'),
    path('me/dependents/<uuid:pk>/', views.MyDependentDetailView.as_view(), name='my-dependent-detail'),
    path('me/bank-accounts/', views.MyBankAccountsView.as_view(), name='my-bank-accounts'),
    path('me/team/', views.MyTeamView.as_view(), name='my-team'),
    path('me/team/leave-overview/', views.TeamLeaveOverviewView.as_view(), name='team-leave-overview'),
    path('me/data-updates/', views.MyDataUpdateRequestsView.as_view(), name='my-data-updates'),
    path('me/service-requests/', views.MyServiceRequestsView.as_view(), name='my-service-requests'),

    # Data Update requests (admin/HR endpoints)
    path('', include(data_update_router.urls)),

    # Service Request endpoints (admin/HR)
    path('', include(service_request_router.urls)),

    # Employee endpoints
    path('', include(router.urls)),

    # Bulk operations
    path('bulk/import/', views.BulkImportView.as_view(), name='bulk-import'),
    path('bulk/export/', views.BulkExportView.as_view(), name='bulk-export'),

    # Employee sub-resources
    path('<uuid:employee_id>/dependents/', views.DependentListView.as_view(), name='dependent-list'),
    path('<uuid:employee_id>/education/', views.EducationListView.as_view(), name='education-list'),
    path('<uuid:employee_id>/experience/', views.WorkExperienceListView.as_view(), name='experience-list'),
    path('<uuid:employee_id>/certifications/', views.CertificationListView.as_view(), name='certification-list'),
    path('<uuid:employee_id>/skills/', views.SkillListView.as_view(), name='skill-list'),
    path('<uuid:employee_id>/bank-accounts/', views.BankAccountListView.as_view(), name='bank-account-list'),
    path('<uuid:employee_id>/emergency-contacts/', views.EmergencyContactListView.as_view(), name='emergency-contact-list'),
    path('<uuid:employee_id>/history/', views.EmploymentHistoryView.as_view(), name='employment-history'),
]
