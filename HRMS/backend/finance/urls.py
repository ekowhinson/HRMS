"""URL routing for finance app."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'accounts', views.AccountViewSet, basename='account')
router.register(r'fiscal-years', views.FiscalYearViewSet, basename='fiscal-year')
router.register(r'fiscal-periods', views.FiscalPeriodViewSet, basename='fiscal-period')
router.register(r'journal-entries', views.JournalEntryViewSet, basename='journal-entry')
router.register(r'budgets', views.BudgetViewSet, basename='budget')
router.register(r'budget-commitments', views.BudgetCommitmentViewSet, basename='budget-commitment')
router.register(r'vendors', views.VendorViewSet, basename='vendor')
router.register(r'vendor-invoices', views.VendorInvoiceViewSet, basename='vendor-invoice')
router.register(r'customers', views.CustomerViewSet, basename='customer')
router.register(r'customer-invoices', views.CustomerInvoiceViewSet, basename='customer-invoice')
router.register(r'bank-accounts', views.BankAccountViewSet, basename='bank-account')
router.register(r'payments', views.PaymentViewSet, basename='payment')
router.register(r'bank-statements', views.BankStatementViewSet, basename='bank-statement')
router.register(r'bank-statement-lines', views.BankStatementLineViewSet, basename='bank-statement-line')
router.register(r'exchange-rates', views.ExchangeRateViewSet, basename='exchange-rate')

urlpatterns = [
    path('', include(router.urls)),
    # Financial report endpoints
    path('reports/trial-balance/', views.TrialBalanceView.as_view(), name='trial-balance'),
    path('reports/income-statement/', views.IncomeStatementView.as_view(), name='income-statement'),
    path('reports/balance-sheet/', views.BalanceSheetView.as_view(), name='balance-sheet'),
    path('reports/cash-flow/', views.CashFlowView.as_view(), name='cash-flow'),
    path('reports/ap-aging/', views.APAgingView.as_view(), name='ap-aging'),
    path('reports/ar-aging/', views.ARAgingView.as_view(), name='ar-aging'),
    path('reports/budget-vs-actual/', views.BudgetVsActualView.as_view(), name='budget-vs-actual'),
]
