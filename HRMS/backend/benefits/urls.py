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
router.register(r'benefit-enrollments', views.BenefitEnrollmentViewSet, basename='benefit-enrollment')
router.register(r'benefit-claims', views.BenefitClaimViewSet, basename='benefit-claim')
router.register(r'expense-types', views.ExpenseTypeViewSet, basename='expense-type')
router.register(r'expense-claims', views.ExpenseClaimViewSet, basename='expense-claim')

# Organization Benefits
router.register(r'funeral-grant-types', views.FuneralGrantTypeViewSet, basename='funeral-grant-type')
router.register(r'funeral-grants', views.FuneralGrantClaimViewSet, basename='funeral-grant')
router.register(r'medical-lens-benefits', views.MedicalLensBenefitViewSet, basename='medical-lens-benefit')
router.register(r'medical-lens-claims', views.MedicalLensClaimViewSet, basename='medical-lens-claim')
router.register(r'professional-subscription-types', views.ProfessionalSubscriptionTypeViewSet, basename='professional-subscription-type')
router.register(r'professional-subscriptions', views.ProfessionalSubscriptionViewSet, basename='professional-subscription')
router.register(r'eligibility-records', views.BenefitEligibilityRecordViewSet, basename='eligibility-record')

# Generic Configurable Benefits
router.register(r'custom-types', views.CustomBenefitTypeViewSet, basename='custom-benefit-type')
router.register(r'custom-claims', views.CustomBenefitClaimViewSet, basename='custom-benefit-claim')

# Third-Party Loans/Deductions
router.register(r'third-party-lenders', views.ThirdPartyLenderViewSet, basename='third-party-lender')
router.register(r'third-party-deductions', views.ThirdPartyDeductionViewSet, basename='third-party-deduction')
router.register(r'third-party-history', views.ThirdPartyDeductionHistoryViewSet, basename='third-party-history')
router.register(r'third-party-remittances', views.ThirdPartyRemittanceViewSet, basename='third-party-remittance')
router.register(r'credit-union-accounts', views.CreditUnionAccountViewSet, basename='credit-union-account')
router.register(r'student-loan-accounts', views.StudentLoanAccountViewSet, basename='student-loan-account')
router.register(r'rent-deductions', views.RentDeductionViewSet, basename='rent-deduction')

urlpatterns = [
    path('', include(router.urls)),

    # Loan utility endpoints
    path('loans/check-eligibility/', views.CheckLoanEligibilityView.as_view(), name='check-loan-eligibility'),
    path('loans/summary/', views.LoanSummaryView.as_view(), name='loan-summary'),

    # Legacy endpoints (still supported via generic views)
    path('loan-schedule/<uuid:pk>/', views.LoanScheduleView.as_view(), name='loan-schedule'),
    path('loan-transactions/<uuid:pk>/', views.LoanTransactionListView.as_view(), name='loan-transactions'),

    # Employee summary endpoints
    path('employee/<uuid:employee_id>/loans/', views.EmployeeLoanSummaryView.as_view(), name='employee-loans'),
    path('employee/<uuid:employee_id>/benefits/', views.EmployeeBenefitSummaryView.as_view(), name='employee-benefits'),
]
