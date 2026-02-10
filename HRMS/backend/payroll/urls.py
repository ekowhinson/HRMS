"""
Payroll management URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'payroll'

router = DefaultRouter()
router.register(r'components', views.PayComponentViewSet, basename='pay-component')
router.register(r'structures', views.SalaryStructureViewSet, basename='salary-structure')
router.register(r'calendar', views.PayrollCalendarViewSet, basename='payroll-calendar')
router.register(r'periods', views.PayrollPeriodViewSet, basename='payroll-period')
router.register(r'runs', views.PayrollRunViewSet, basename='payroll-run')
router.register(r'adhoc-payments', views.AdHocPaymentViewSet, basename='adhoc-payment')
router.register(r'transactions', views.EmployeeTransactionViewSet, basename='employee-transaction')
router.register(r'tax-config', views.OvertimeBonusTaxConfigViewSet, basename='overtime-bonus-tax-config')
router.register(r'paye-brackets', views.TaxBracketViewSet, basename='paye-bracket')
# Payroll Setup
router.register(r'banks', views.BankViewSet, basename='bank')
router.register(r'bank-branches', views.BankBranchViewSet, basename='bank-branch')
router.register(r'staff-categories', views.StaffCategoryViewSet, basename='staff-category')
router.register(r'salary-bands', views.SalaryBandViewSet, basename='salary-band')
router.register(r'salary-levels', views.SalaryLevelViewSet, basename='salary-level')
router.register(r'salary-notches', views.SalaryNotchViewSet, basename='salary-notch')
router.register(r'backpay', views.BackpayRequestViewSet, basename='backpay')
router.register(r'salary-upgrades', views.SalaryUpgradeRequestViewSet, basename='salary-upgrade')

urlpatterns = [
    path('', include(router.urls)),

    # Global payroll settings
    path('settings/', views.PayrollSettingsView.as_view(), name='payroll-settings'),
    path('settings/set-active-period/', views.SetActivePeriodView.as_view(), name='set-active-period'),
    path('settings/advance-period/', views.AdvancePeriodView.as_view(), name='advance-period'),

    # Self-service payslips
    path('my-payslips/', views.MyPayslipsView.as_view(), name='my-payslips'),
    path('my-payslips/<uuid:item_id>/download/', views.MyPayslipDownloadView.as_view(), name='my-payslip-download'),

    # Employee salary
    path('employee/<uuid:employee_id>/salary/', views.EmployeeSalaryView.as_view(), name='employee-salary'),
    path('employee/<uuid:employee_id>/salary/history/', views.EmployeeSalaryHistoryView.as_view(), name='salary-history'),
    path('employee/<uuid:employee_id>/payslips/', views.EmployeePayslipsView.as_view(), name='employee-payslips'),

    # Payroll processing
    path('runs/<uuid:pk>/compute/', views.ComputePayrollView.as_view(), name='compute-payroll'),
    path('runs/<uuid:pk>/progress/', views.PayrollProgressView.as_view(), name='payroll-progress'),
    path('runs/<uuid:pk>/approve/', views.ApprovePayrollView.as_view(), name='approve-payroll'),
    path('runs/<uuid:pk>/process-payment/', views.ProcessPaymentView.as_view(), name='process-payment'),
    path('runs/<uuid:pk>/generate-bank-file/', views.GenerateBankFileView.as_view(), name='generate-bank-file'),
    path('runs/<uuid:pk>/generate-payslips/', views.GeneratePayslipsView.as_view(), name='generate-payslips'),

    # Payroll items
    path('runs/<uuid:run_id>/items/', views.PayrollItemListView.as_view(), name='payroll-items'),
    path('items/<uuid:pk>/', views.PayrollItemDetailView.as_view(), name='payroll-item-detail'),

    # Tax configuration
    path('tax-brackets/', views.TaxBracketListView.as_view(), name='tax-brackets'),
    path('ssnit-rates/', views.SSNITRateListView.as_view(), name='ssnit-rates'),
    path('tax-reliefs/', views.TaxReliefListView.as_view(), name='tax-reliefs'),

    # Reports
    path('reports/payroll-summary/', views.PayrollSummaryReportView.as_view(), name='payroll-summary'),
    path('reports/paye/', views.PAYEReportView.as_view(), name='paye-report'),
    path('reports/ssnit/', views.SSNITReportView.as_view(), name='ssnit-report'),
    path('reports/bank-advice/', views.BankAdviceReportView.as_view(), name='bank-advice-report'),

    # Payslip downloads
    path('payslips/<uuid:pk>/download/', views.PayslipDownloadView.as_view(), name='payslip-download'),
    path('runs/<uuid:run_id>/payslips/', views.PayrollRunPayslipsListView.as_view(), name='payroll-run-payslips'),
    path('runs/<uuid:run_id>/payslips/download/', views.PayrollRunPayslipsDownloadView.as_view(), name='payroll-run-payslips-download'),

    # Bank file downloads
    path('bank-files/<uuid:pk>/download/', views.BankFileDownloadView.as_view(), name='bank-file-download'),
    path('runs/<uuid:run_id>/bank-files/', views.PayrollRunBankFilesListView.as_view(), name='payroll-run-bank-files'),
    path('runs/<uuid:run_id>/bank-file/download/', views.PayrollRunBankFileDownloadView.as_view(), name='payroll-run-bank-file-download'),

]
