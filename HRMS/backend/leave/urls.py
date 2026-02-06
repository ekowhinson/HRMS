"""
Leave management URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'leave'

router = DefaultRouter()
router.register(r'types', views.LeaveTypeViewSet, basename='leave-type')
router.register(r'policies', views.LeavePolicyViewSet, basename='leave-policy')
router.register(r'requests', views.LeaveRequestViewSet, basename='leave-request')

# Leave Planning routes
router.register(r'plans', views.LeavePlanViewSet, basename='leave-plan')
router.register(r'plan-entries', views.LeavePlanEntryViewSet, basename='leave-plan-entry')
router.register(r'carry-forward', views.LeaveCarryForwardRequestViewSet, basename='carry-forward')
router.register(r'reminders', views.LeaveReminderViewSet, basename='leave-reminder')

# Location-Based Approval Workflow routes
router.register(r'workflow-templates', views.LeaveApprovalWorkflowTemplateViewSet, basename='workflow-template')
router.register(r'workflow-levels', views.LeaveApprovalWorkflowLevelViewSet, basename='workflow-level')
router.register(r'location-mappings', views.LocationWorkflowMappingViewSet, basename='location-mapping')
router.register(r'workflow-status', views.LeaveRequestWorkflowStatusViewSet, basename='workflow-status')
router.register(r'reliever-validations', views.LeaveRelieverValidationViewSet, basename='reliever-validation')

urlpatterns = [
    path('', include(router.urls)),

    # Balance endpoints
    path('balances/', views.LeaveBalanceListView.as_view(), name='balance-list'),
    path('balances/<uuid:employee_id>/', views.EmployeeLeaveBalanceView.as_view(), name='employee-balance'),

    # Calendar
    path('calendar/', views.LeaveCalendarView.as_view(), name='leave-calendar'),
    path('calendar/plans/', views.LeavePlanCalendarView.as_view(), name='plan-calendar'),

    # Team leave view (for managers)
    path('team/', views.TeamLeaveView.as_view(), name='team-leave'),

    # Approvals
    path('pending-approvals/', views.PendingApprovalsView.as_view(), name='pending-approvals'),
    path('requests/<uuid:pk>/submit/', views.SubmitLeaveView.as_view(), name='submit-leave'),
    path('requests/<uuid:pk>/approve/', views.ApproveLeaveView.as_view(), name='approve-leave'),
    path('requests/<uuid:pk>/reject/', views.RejectLeaveView.as_view(), name='reject-leave'),
    path('requests/<uuid:pk>/cancel/', views.CancelLeaveView.as_view(), name='cancel-leave'),

    # Year-end processing
    path('year-end/process/', views.YearEndProcessView.as_view(), name='year-end-process'),
]
