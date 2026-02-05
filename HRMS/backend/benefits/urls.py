"""
Benefits and Loans URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'benefits'

router = DefaultRouter()
router.register(r'loan-types', views.LoanTypeViewSet, basename='loan-type')
router.register(r'loans', views.LoanAccountViewSet, basename='loan')
router.register(r'benefit-types', views.BenefitTypeViewSet, basename='benefit-type')
router.register(r'benefit-claims', views.BenefitClaimViewSet, basename='benefit-claim')
router.register(r'expense-types', views.ExpenseTypeViewSet, basename='expense-type')
router.register(r'expense-claims', views.ExpenseClaimViewSet, basename='expense-claim')

urlpatterns = [
    path('', include(router.urls)),

    # Loan endpoints
    path('loans/<uuid:pk>/schedule/', views.LoanScheduleView.as_view(), name='loan-schedule'),
    path('loans/<uuid:pk>/transactions/', views.LoanTransactionListView.as_view(), name='loan-transactions'),
    path('loans/<uuid:pk>/approve/', views.ApproveLoanView.as_view(), name='approve-loan'),
    path('loans/<uuid:pk>/disburse/', views.DisburseLoanView.as_view(), name='disburse-loan'),
    path('loans/<uuid:pk>/statement/', views.LoanStatementView.as_view(), name='loan-statement'),

    # Benefit enrollments
    path('enrollments/', views.BenefitEnrollmentListView.as_view(), name='enrollment-list'),
    path('enrollments/<uuid:pk>/', views.BenefitEnrollmentDetailView.as_view(), name='enrollment-detail'),

    # Employee loan summary
    path('employee/<uuid:employee_id>/loans/', views.EmployeeLoanSummaryView.as_view(), name='employee-loans'),
    path('employee/<uuid:employee_id>/benefits/', views.EmployeeBenefitSummaryView.as_view(), name='employee-benefits'),
]
