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

urlpatterns = [
    path('', include(router.urls)),

    # Balance endpoints
    path('balances/', views.LeaveBalanceListView.as_view(), name='balance-list'),
    path('balances/<uuid:employee_id>/', views.EmployeeLeaveBalanceView.as_view(), name='employee-balance'),

    # Calendar
    path('calendar/', views.LeaveCalendarView.as_view(), name='leave-calendar'),

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
