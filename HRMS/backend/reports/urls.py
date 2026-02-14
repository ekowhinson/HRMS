"""
Reports and Analytics URL configuration.
"""

from django.urls import path, include

from . import views
from . import consolidated_views

app_name = 'reports'

urlpatterns = [
    # Ad-hoc report builder
    path('builder/', include('reports.builder_urls')),

    # Dashboard
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),
    path('dashboard/hr/', views.HRDashboardView.as_view(), name='hr-dashboard'),
    path('dashboard/payroll/', views.PayrollDashboardView.as_view(), name='payroll-dashboard'),
    path('dashboard/leave/', views.LeaveDashboardView.as_view(), name='leave-dashboard'),
    path('dashboard/performance/', views.PerformanceDashboardView.as_view(), name='performance-dashboard'),

    # Employee reports
    path('employees/master/', views.EmployeeMasterReportView.as_view(), name='employee-master'),
    path('employees/headcount/', views.HeadcountReportView.as_view(), name='headcount'),
    path('employees/turnover/', views.TurnoverReportView.as_view(), name='turnover'),
    path('employees/demographics/', views.DemographicsReportView.as_view(), name='demographics'),

    # Leave reports
    path('leave/balance/', views.LeaveBalanceReportView.as_view(), name='leave-balance'),
    path('leave/utilization/', views.LeaveUtilizationReportView.as_view(), name='leave-utilization'),

    # Loan reports
    path('loans/outstanding/', views.LoanOutstandingReportView.as_view(), name='loan-outstanding'),
    path('loans/disbursement/', views.LoanDisbursementReportView.as_view(), name='loan-disbursement'),

    # Payroll reports
    path('payroll/summary/', views.PayrollSummaryView.as_view(), name='payroll-summary'),
    path('payroll/master/', views.PayrollMasterReportView.as_view(), name='payroll-master'),
    path('payroll/cost-center/', views.CostCenterReportView.as_view(), name='cost-center'),
    path('payroll/variance/', views.PayrollVarianceReportView.as_view(), name='payroll-variance'),
    path('payroll/reconciliation/', views.PayrollReconciliationReportView.as_view(), name='payroll-reconciliation'),
    path('payroll/reconciliation/comprehensive/', views.ComprehensiveReconciliationView.as_view(), name='payroll-reconciliation-comprehensive'),
    path('payroll/salary-reconciliation/', views.SalaryReconciliationView.as_view(), name='salary-reconciliation'),
    path('payroll/loans/by-type/', views.LoanTypeReportView.as_view(), name='loan-type-report'),
    path('payroll/dues/', views.DuesReportView.as_view(), name='dues-report'),
    path('payroll/rent-deductions/', views.RentDeductionsReportView.as_view(), name='rent-deductions'),
    path('payroll/journal/', views.PayrollJournalReportView.as_view(), name='payroll-journal'),
    path('payroll/car-loan-interest/', views.CarLoanInterestReportView.as_view(), name='car-loan-interest'),
    path('payroll/student-loans/', views.StudentLoanReportView.as_view(), name='student-loans'),
    path('payroll/costing-summary/', views.PayrollCostingSummaryView.as_view(), name='payroll-costing-summary'),
    path('payroll/staff-data/', views.StaffPayrollDataView.as_view(), name='payroll-staff-data'),

    # Consolidated payroll reports (period range)
    path('payroll/consolidated-summary/', consolidated_views.ConsolidatedPayrollSummaryView.as_view(), name='consolidated-summary'),
    path('payroll/labour-cost/', consolidated_views.LabourCostReportView.as_view(), name='labour-cost'),
    path('payroll/ssf-statement/', consolidated_views.SSFContributionStatementView.as_view(), name='ssf-statement'),
    path('payroll/tax-statement/', consolidated_views.IncomeTaxStatementView.as_view(), name='tax-statement'),
    path('payroll/allowance-statement/', consolidated_views.AllowanceStatementView.as_view(), name='allowance-statement'),

    # Statutory reports
    path('statutory/paye/', views.PAYEStatutoryReportView.as_view(), name='paye-statutory'),
    path('statutory/ssnit/', views.SSNITStatutoryReportView.as_view(), name='ssnit-statutory'),

    # Custom reports
    path('custom/', views.CustomReportView.as_view(), name='custom-report'),
    path('scheduled/', views.ScheduledReportsView.as_view(), name='scheduled-reports'),

    # Async export (returns task_id for polling)
    path('export/async/', views.AsyncExportView.as_view(), name='export-async'),

    # Export endpoints (synchronous CSV/Excel/PDF downloads)
    path('export/employees/', views.ExportEmployeeMasterView.as_view(), name='export-employees'),
    path('export/headcount/', views.ExportHeadcountView.as_view(), name='export-headcount'),
    path('export/payroll/', views.ExportPayrollSummaryView.as_view(), name='export-payroll'),
    path('export/payroll-master/', views.ExportPayrollMasterView.as_view(), name='export-payroll-master'),
    path('export/paye/', views.ExportPAYEReportView.as_view(), name='export-paye'),
    path('export/paye-gra/', views.ExportPAYEGRAReportView.as_view(), name='export-paye-gra'),
    path('export/ssnit/', views.ExportSSNITReportView.as_view(), name='export-ssnit'),
    path('export/bank-advice/', views.ExportBankAdviceView.as_view(), name='export-bank-advice'),
    path('export/leave-balance/', views.ExportLeaveBalanceView.as_view(), name='export-leave-balance'),
    path('export/loans/', views.ExportLoanOutstandingView.as_view(), name='export-loans'),
    path('export/reconciliation/', views.ExportPayrollReconciliationView.as_view(), name='export-reconciliation'),
    path('export/dues/', views.ExportDuesReportView.as_view(), name='export-dues'),
    path('export/journal/', views.ExportPayrollJournalView.as_view(), name='export-journal'),
    path('export/salary-reconciliation/', views.ExportSalaryReconciliationView.as_view(), name='export-salary-reconciliation'),
    path('export/turnover/', views.ExportTurnoverView.as_view(), name='export-turnover'),
    path('export/demographics/', views.ExportDemographicsView.as_view(), name='export-demographics'),
    path('export/leave-utilization/', views.ExportLeaveUtilizationView.as_view(), name='export-leave-utilization'),
    path('export/employment-history/', views.ExportEmploymentHistoryView.as_view(), name='export-employment-history'),
    path('export/kpi-tracking/', views.ExportKPITrackingView.as_view(), name='export-kpi-tracking'),
    path('export/performance-appraisals/', views.ExportPerformanceAppraisalsView.as_view(), name='export-performance-appraisals'),
    path('export/training/', views.ExportTrainingView.as_view(), name='export-training'),
    path('export/payroll-costing-summary/', views.ExportPayrollCostingSummaryView.as_view(), name='export-payroll-costing-summary'),
    path('export/staff-payroll-data/', views.ExportStaffPayrollDataView.as_view(), name='export-staff-payroll-data'),

    # Analytics KPI endpoints
    path('analytics/master/', views.MasterAnalyticsDashboardView.as_view(), name='analytics-master'),
    path('analytics/recruitment/', views.RecruitmentKPIsView.as_view(), name='analytics-recruitment'),
    path('analytics/demographics/', views.DemographicsKPIsView.as_view(), name='analytics-demographics'),
    path('analytics/training/', views.TrainingKPIsView.as_view(), name='analytics-training'),
    path('analytics/performance/', views.PerformanceKPIsView.as_view(), name='analytics-performance'),
    path('analytics/compensation/', views.CompensationKPIsView.as_view(), name='analytics-compensation'),
    path('analytics/exit/', views.ExitKPIsView.as_view(), name='analytics-exit'),
]
