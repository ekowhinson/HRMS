import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './features/auth/store'
import MainLayout from './components/layout/MainLayout'

// ─── Inline loading fallback ────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )
}

// ─── Lazy-loaded page components ────────────────────────────────
// Public / Auth pages
const LoginPage = React.lazy(() => import('./pages/LoginPage'))
const SignupPage = React.lazy(() => import('./pages/SignupPage'))
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage'))
const OnboardingPage = React.lazy(() => import('./pages/OnboardingPage'))

// AI Assistant
const AIAssistantPage = React.lazy(() => import('./pages/AIAssistantPage'))

// Core pages
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'))
const EmployeesPage = React.lazy(() => import('./pages/EmployeesPage'))
const EmployeeDetailPage = React.lazy(() => import('./pages/EmployeeDetailPage'))
const EmployeeFormPage = React.lazy(() => import('./pages/EmployeeFormPage'))
const LeavePage = React.lazy(() => import('./pages/LeavePage'))
const PayrollPage = React.lazy(() => import('./pages/PayrollPage'))
const BenefitsPage = React.lazy(() => import('./pages/BenefitsPage'))
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'))
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'))
const ApprovalInboxPage = React.lazy(() => import('./pages/ApprovalInboxPage'))

// Portal pages
const MyProfilePage = React.lazy(() => import('./pages/portal/MyProfilePage'))
const MyLeaveDashboard = React.lazy(() => import('./pages/portal/MyLeaveDashboard'))
const MyLeaveCalendarPage = React.lazy(() => import('./pages/portal/MyLeaveCalendarPage'))
const MyLeaveHistoryPage = React.lazy(() => import('./pages/portal/MyLeaveHistoryPage'))
const LeavePlanningPage = React.lazy(() => import('./pages/portal/LeavePlanningPage'))
const DataUpdateRequestsPage = React.lazy(() => import('./pages/portal/DataUpdateRequestsPage'))
const ServiceRequestsPage = React.lazy(() => import('./pages/portal/ServiceRequestsPage'))
const SelfServiceDashboard = React.lazy(() => import('./pages/portal/SelfServiceDashboard'))
const MyPayslipsPage = React.lazy(() => import('./pages/portal/MyPayslipsPage'))
const MyLoansPage = React.lazy(() => import('./pages/portal/MyLoansPage'))
const MyAppraisalPage = React.lazy(() => import('./pages/portal/MyAppraisalPage'))
const MyTrainingPage = React.lazy(() => import('./pages/portal/MyTrainingPage'))
const InternalJobBoardPage = React.lazy(() => import('./pages/portal/InternalJobBoardPage'))
const MyDisciplinaryPage = React.lazy(() => import('./pages/portal/MyDisciplinaryPage'))
const MyGrievancesPage = React.lazy(() => import('./pages/portal/MyGrievancesPage'))

// Admin pages
const PayrollProcessingPage = React.lazy(() => import('./pages/admin/PayrollProcessingPage'))
const PayrollErrorsPage = React.lazy(() => import('./pages/admin/PayrollErrorsPage'))
const LeaveApprovalsPage = React.lazy(() => import('./pages/admin/LeaveApprovalsPage'))
const OrganizationPage = React.lazy(() => import('./pages/admin/OrganizationPage'))
const LoanManagementPage = React.lazy(() => import('./pages/admin/LoanManagementPage'))
const TransactionTypeSetupPage = React.lazy(() => import('./pages/admin/TransactionTypeSetupPage'))
const EmployeeTransactionsPage = React.lazy(() => import('./pages/admin/EmployeeTransactionsPage'))
const TaxConfigurationPage = React.lazy(() => import('./pages/admin/TaxConfigurationPage'))
const LeaveTypeSetupPage = React.lazy(() => import('./pages/admin/LeaveTypeSetupPage'))
const PayrollSetupPage = React.lazy(() => import('./pages/admin/PayrollSetupPage'))
const PayrollImplementationPage = React.lazy(() => import('./pages/admin/PayrollImplementationPage'))
const DataImportPage = React.lazy(() => import('./pages/admin/DataImportPage'))
const PayrollValidationPage = React.lazy(() => import('./pages/admin/PayrollValidationPage'))
const BackpayPage = React.lazy(() => import('./pages/admin/BackpayPage'))
const SalaryUpgradePage = React.lazy(() => import('./pages/admin/SalaryUpgradePage'))

// Performance pages
const CoreValuesPage = React.lazy(() => import('./pages/admin/CoreValuesPage'))
const ProbationAssessmentsPage = React.lazy(() => import('./pages/admin/ProbationAssessmentsPage'))
const TrainingNeedsPage = React.lazy(() => import('./pages/admin/TrainingNeedsPage'))
const PerformanceAppealsPage = React.lazy(() => import('./pages/admin/PerformanceAppealsPage'))
const AppraisalCyclesPage = React.lazy(() => import('./pages/admin/AppraisalCyclesPage'))
const AppraisalsPage = React.lazy(() => import('./pages/admin/AppraisalsPage'))
const AppraisalDetailPage = React.lazy(() => import('./pages/admin/AppraisalDetailPage'))
const CompetenciesPage = React.lazy(() => import('./pages/admin/CompetenciesPage'))

// Report pages
const PayrollMasterReportPage = React.lazy(() => import('./pages/reports/PayrollMasterReportPage'))
const PayrollJournalPage = React.lazy(() => import('./pages/admin/PayrollJournalPage'))
const SalaryReconciliationPage = React.lazy(() => import('./pages/admin/SalaryReconciliationPage'))
const PayrollCostingReportPage = React.lazy(() => import('./pages/reports/PayrollCostingReportPage'))
const StaffPayrollDataReportPage = React.lazy(() => import('./pages/reports/StaffPayrollDataReportPage'))
const ConsolidatedPayrollSummaryPage = React.lazy(() => import('./pages/reports/ConsolidatedPayrollSummaryPage'))
const LabourCostReportPage = React.lazy(() => import('./pages/reports/LabourCostReportPage'))
const SSFContributionStatementPage = React.lazy(() => import('./pages/reports/SSFContributionStatementPage'))
const IncomeTaxStatementPage = React.lazy(() => import('./pages/reports/IncomeTaxStatementPage'))
const AllowanceStatementPage = React.lazy(() => import('./pages/reports/AllowanceStatementPage'))
const PayslipStatementPage = React.lazy(() => import('./pages/reports/PayslipStatementPage'))

// HR Report pages
const HRReportsPage = React.lazy(() => import('./pages/reports/HRReportsPage'))
const EmployeeDirectoryReportPage = React.lazy(() => import('./pages/reports/EmployeeDirectoryReportPage'))
const HeadcountReportPage = React.lazy(() => import('./pages/reports/HeadcountReportPage'))
const TurnoverReportPage = React.lazy(() => import('./pages/reports/TurnoverReportPage'))
const DemographicsReportPage = React.lazy(() => import('./pages/reports/DemographicsReportPage'))
const LeaveBalanceReportPage = React.lazy(() => import('./pages/reports/LeaveBalanceReportPage'))
const LeaveUtilizationReportPage = React.lazy(() => import('./pages/reports/LeaveUtilizationReportPage'))
const EmploymentHistoryReportPage = React.lazy(() => import('./pages/reports/EmploymentHistoryReportPage'))
const KPITrackingReportPage = React.lazy(() => import('./pages/reports/KPITrackingReportPage'))
const PerformanceAppraisalsReportPage = React.lazy(() => import('./pages/reports/PerformanceAppraisalsReportPage'))
const TrainingDevelopmentReportPage = React.lazy(() => import('./pages/reports/TrainingDevelopmentReportPage'))

// Report Builder pages
const ReportBuilderPage = React.lazy(() => import('./pages/reports/ReportBuilderPage'))
const SavedReportsPage = React.lazy(() => import('./pages/reports/SavedReportsPage'))
const ReportViewerPage = React.lazy(() => import('./pages/reports/ReportViewerPage'))

// Policy pages
const PoliciesPage = React.lazy(() => import('./pages/admin/PoliciesPage'))
const PolicyDetailPage = React.lazy(() => import('./pages/admin/PolicyDetailPage'))
const PolicyFormPage = React.lazy(() => import('./pages/admin/PolicyFormPage'))

// Exit/Offboarding pages
const ExitsPage = React.lazy(() => import('./pages/admin/ExitsPage'))
const ExitDetailPage = React.lazy(() => import('./pages/admin/ExitDetailPage'))

// Recruitment pages
const RecruitmentPage = React.lazy(() => import('./pages/admin/RecruitmentPage'))
const VacancyFormPage = React.lazy(() => import('./pages/admin/VacancyFormPage'))
const VacancyDetailPage = React.lazy(() => import('./pages/admin/VacancyDetailPage'))
const ApplicantDetailPage = React.lazy(() => import('./pages/admin/ApplicantDetailPage'))
const InterviewDetailPage = React.lazy(() => import('./pages/admin/InterviewDetailPage'))

// Discipline & Grievance pages
const DisciplinaryPage = React.lazy(() => import('./pages/admin/DisciplinaryPage'))
const GrievancePage = React.lazy(() => import('./pages/admin/GrievancePage'))

// Training & Development pages
const TrainingDashboardPage = React.lazy(() => import('./pages/admin/TrainingDashboardPage'))
const TrainingProgramsPage = React.lazy(() => import('./pages/admin/TrainingProgramsPage'))
const TrainingSessionsPage = React.lazy(() => import('./pages/admin/TrainingSessionsPage'))
const DevelopmentPlansPage = React.lazy(() => import('./pages/admin/DevelopmentPlansPage'))

// Announcements pages
const AnnouncementsPage = React.lazy(() => import('./pages/admin/AnnouncementsPage'))

// User & Role Management pages
const UserManagementPage = React.lazy(() => import('./pages/admin/UserManagementPage'))
const RoleManagementPage = React.lazy(() => import('./pages/admin/RoleManagementPage'))
const AuthProvidersPage = React.lazy(() => import('./pages/admin/AuthProvidersPage'))
const AuditLogsPage = React.lazy(() => import('./pages/admin/AuditLogsPage'))
const TenantManagementPage = React.lazy(() => import('./pages/admin/TenantManagementPage'))

// Backup & Restore
const BackupManagementPage = React.lazy(() => import('./pages/admin/BackupManagementPage'))
const RestoreProgressPage = React.lazy(() => import('./pages/admin/RestoreProgressPage'))

// Finance pages
const ChartOfAccountsPage = React.lazy(() => import('./pages/finance/ChartOfAccountsPage'))
const JournalEntryPage = React.lazy(() => import('./pages/finance/JournalEntryPage'))
const BudgetPage = React.lazy(() => import('./pages/finance/BudgetPage'))
const VendorPage = React.lazy(() => import('./pages/finance/VendorPage'))
const CustomerPage = React.lazy(() => import('./pages/finance/CustomerPage'))
const FinancePaymentsPage = React.lazy(() => import('./pages/finance/PaymentsPage'))
const BankReconciliationPage = React.lazy(() => import('./pages/finance/BankReconciliationPage'))
const FinancialReportsPage = React.lazy(() => import('./pages/finance/FinancialReportsPage'))

// Procurement pages
const RequisitionsPage = React.lazy(() => import('./pages/procurement/RequisitionsPage'))
const PurchaseOrdersPage = React.lazy(() => import('./pages/procurement/PurchaseOrdersPage'))
const GoodsReceiptPage = React.lazy(() => import('./pages/procurement/GoodsReceiptPage'))
const ContractsPage = React.lazy(() => import('./pages/procurement/ContractsPage'))

// Inventory & Asset pages
const ItemsPage = React.lazy(() => import('./pages/inventory/ItemsPage'))
const StockPage = React.lazy(() => import('./pages/inventory/StockPage'))
const WarehousesPage = React.lazy(() => import('./pages/inventory/WarehousesPage'))
const AssetRegisterPage = React.lazy(() => import('./pages/inventory/AssetRegisterPage'))
const AssetDepreciationPage = React.lazy(() => import('./pages/inventory/AssetDepreciationPage'))

// Project pages
const ProjectsPage = React.lazy(() => import('./pages/projects/ProjectsPage'))
const ProjectDetailPage = React.lazy(() => import('./pages/projects/ProjectDetailPage'))
const TimesheetsPage = React.lazy(() => import('./pages/projects/TimesheetsPage'))
const ResourceAllocationPage = React.lazy(() => import('./pages/projects/ResourceAllocationPage'))

// Finance enhancement pages
const TaxManagementPage = React.lazy(() => import('./pages/finance/TaxManagementPage'))
const CreditDebitNotesPage = React.lazy(() => import('./pages/finance/CreditDebitNotesPage'))

// Procurement enhancement pages
const RFQPage = React.lazy(() => import('./pages/procurement/RFQPage'))

// Inventory enhancement pages
const AssetDisposalPage = React.lazy(() => import('./pages/inventory/AssetDisposalPage'))

// Manufacturing pages
const ProductionDashboardPage = React.lazy(() => import('./pages/manufacturing/ProductionDashboardPage'))
const BOMPage = React.lazy(() => import('./pages/manufacturing/BOMPage'))
const WorkCentersPage = React.lazy(() => import('./pages/manufacturing/WorkCentersPage'))
const WorkOrdersPage = React.lazy(() => import('./pages/manufacturing/WorkOrdersPage'))
const QualityPage = React.lazy(() => import('./pages/manufacturing/QualityPage'))

// Approval Workflow
const ApprovalWorkflowPage = React.lazy(() => import('./pages/admin/ApprovalWorkflowPage'))

// Payroll Employee Views
const PayrollEmployeesPage = React.lazy(() => import('./pages/payroll/PayrollEmployeesPage'))
const PayrollEmployeeDetailPage = React.lazy(() => import('./pages/payroll/PayrollEmployeeDetailPage'))

// Careers & Applicant Portal
const CareersPage = React.lazy(() => import('./pages/careers/CareersPage'))
const ApplicationFormPage = React.lazy(() => import('./pages/careers/ApplicationFormPage'))
const PortalLoginPage = React.lazy(() => import('./pages/careers/PortalLoginPage'))
const PortalDashboardPage = React.lazy(() => import('./pages/careers/PortalDashboardPage'))
const PortalOfferPage = React.lazy(() => import('./pages/careers/PortalOfferPage'))
const PortalDocumentsPage = React.lazy(() => import('./pages/careers/PortalDocumentsPage'))

import { HR_ROLES, PAYROLL_ROLES, SYSTEM_ADMIN_ROLES, hasRole } from '@/lib/roles'

function useUserRoles() {
  const user = useAuthStore((state) => state.user)
  const roles: string[] = []
  if (user && Array.isArray(user.roles)) {
    user.roles.forEach((r: any) => {
      const roleStr = typeof r === 'string' ? r : (r?.code || r?.name || '')
      if (typeof roleStr === 'string' && roleStr) {
        roles.push(roleStr.toUpperCase())
      }
    })
  }
  return roles
}

function useIsHROrAdmin() {
  const user = useAuthStore((state) => state.user)
  const userRoles = useUserRoles()
  if (!user) return false
  if (user.is_staff || user.is_superuser) return true
  return hasRole(userRoles, HR_ROLES)
}

function useIsPayrollAdmin() {
  const user = useAuthStore((state) => state.user)
  const userRoles = useUserRoles()
  if (!user) return false
  if (user.is_staff || user.is_superuser) return true
  return hasRole(userRoles, PAYROLL_ROLES)
}

function useIsSystemAdmin() {
  const user = useAuthStore((state) => state.user)
  const userRoles = useUserRoles()
  if (!user) return false
  if (user.is_staff || user.is_superuser) return true
  return hasRole(userRoles, SYSTEM_ADMIN_ROLES)
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isHROrAdmin = useIsHROrAdmin()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isHROrAdmin) {
    return <Navigate to="/self-service" replace />
  }

  return <>{children}</>
}

function PayrollRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isPayrollAdmin = useIsPayrollAdmin()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isPayrollAdmin) {
    return <Navigate to="/self-service" replace />
  }

  return <>{children}</>
}

function SystemAdminRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isSystemAdmin = useIsSystemAdmin()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isSystemAdmin) {
    return <Navigate to="/self-service" replace />
  }

  return <>{children}</>
}

function SuperuserRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!user?.is_superuser) {
    return <Navigate to="/self-service" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isHROrAdmin = useIsHROrAdmin()
  // Redirect to appropriate page based on role
  const redirectTo = isHROrAdmin ? '/dashboard' : '/self-service'
  return isAuthenticated ? <Navigate to={redirectTo} replace /> : <>{children}</>
}

function DefaultRedirect() {
  const isHROrAdmin = useIsHROrAdmin()
  return <Navigate to={isHROrAdmin ? '/dashboard' : '/self-service'} replace />
}

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
        <Route path="/signup/verify" element={<PublicRoute><SignupPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

        {/* Careers & Applicant Portal — independent of HRMS auth */}
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/careers/apply/:slug" element={<ApplicationFormPage />} />
        <Route path="/portal/login" element={<PortalLoginPage />} />
        <Route path="/portal/dashboard" element={<PortalDashboardPage />} />
        <Route path="/portal/offer" element={<PortalOfferPage />} />
        <Route path="/portal/documents" element={<PortalDocumentsPage />} />

        {/* Onboarding (authenticated but no layout) */}
        <Route path="/onboarding" element={<PrivateRoute><OnboardingPage /></PrivateRoute>} />

        {/* Protected routes with layout */}
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <MainLayout>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Default redirect based on role - handled by DefaultRedirect component */}
                    <Route path="/" element={<DefaultRedirect />} />

                    {/* HR Dashboard - Admin only */}
                    <Route path="/dashboard" element={<AdminRoute><DashboardPage /></AdminRoute>} />

                    {/* Employee Management - Admin only */}
                    <Route path="/employees" element={<AdminRoute><EmployeesPage /></AdminRoute>} />
                    <Route path="/employees/new" element={<AdminRoute><EmployeeFormPage /></AdminRoute>} />
                    <Route path="/employees/:id" element={<AdminRoute><EmployeeDetailPage /></AdminRoute>} />
                    <Route path="/employees/:id/edit" element={<AdminRoute><EmployeeFormPage /></AdminRoute>} />

                    {/* AI Assistant - Available to all authenticated users */}
                    <Route path="/ai-assistant" element={<AIAssistantPage />} />

                    {/* Self-Service Portal - Available to all authenticated users */}
                    <Route path="/self-service" element={<SelfServiceDashboard />} />
                    <Route path="/my-profile" element={<MyProfilePage />} />
                    <Route path="/my-leave" element={<MyLeaveDashboard />} />
                    <Route path="/my-leave/calendar" element={<MyLeaveCalendarPage />} />
                    <Route path="/my-leave/history" element={<MyLeaveHistoryPage />} />
                    <Route path="/my-leave/planning" element={<LeavePlanningPage />} />
                    <Route path="/my-data-updates" element={<DataUpdateRequestsPage />} />
                    <Route path="/my-service-requests" element={<ServiceRequestsPage />} />
                    <Route path="/my-appraisal" element={<MyAppraisalPage />} />
                    <Route path="/my-training" element={<MyTrainingPage />} />
                    <Route path="/internal-jobs" element={<InternalJobBoardPage />} />
                    <Route path="/my-payslips" element={<MyPayslipsPage />} />
                    <Route path="/my-loans" element={<MyLoansPage />} />
                    <Route path="/my-disciplinary" element={<MyDisciplinaryPage />} />
                    <Route path="/my-grievances" element={<MyGrievancesPage />} />
                    <Route path="/my-approvals" element={<ApprovalInboxPage />} />

                    {/* Leave Management - Admin only */}
                    <Route path="/leave" element={<AdminRoute><LeavePage /></AdminRoute>} />

                    {/* Payroll & Benefits - Payroll Admin */}
                    <Route path="/payroll" element={<PayrollRoute><PayrollPage /></PayrollRoute>} />
                    <Route path="/benefits" element={<PayrollRoute><BenefitsPage /></PayrollRoute>} />

                    {/* Reports - Payroll Admin */}
                    <Route path="/reports" element={<PayrollRoute><ReportsPage /></PayrollRoute>} />
                    <Route path="/reports/payroll-master" element={<PayrollRoute><PayrollMasterReportPage /></PayrollRoute>} />
                    <Route path="/reports/journal" element={<PayrollRoute><PayrollJournalPage /></PayrollRoute>} />
                    <Route path="/reports/salary-reconciliation" element={<PayrollRoute><SalaryReconciliationPage /></PayrollRoute>} />
                    <Route path="/reports/payroll-costing" element={<PayrollRoute><PayrollCostingReportPage /></PayrollRoute>} />
                    <Route path="/reports/staff-payroll-data" element={<PayrollRoute><StaffPayrollDataReportPage /></PayrollRoute>} />
                    <Route path="/reports/consolidated-summary" element={<PayrollRoute><ConsolidatedPayrollSummaryPage /></PayrollRoute>} />
                    <Route path="/reports/labour-cost" element={<PayrollRoute><LabourCostReportPage /></PayrollRoute>} />
                    <Route path="/reports/ssf-statement" element={<PayrollRoute><SSFContributionStatementPage /></PayrollRoute>} />
                    <Route path="/reports/tax-statement" element={<PayrollRoute><IncomeTaxStatementPage /></PayrollRoute>} />
                    <Route path="/reports/allowance-statement" element={<PayrollRoute><AllowanceStatementPage /></PayrollRoute>} />
                    <Route path="/reports/payslip-statement" element={<PayrollRoute><PayslipStatementPage /></PayrollRoute>} />
                    <Route path="/reports/builder" element={<AdminRoute><ReportBuilderPage /></AdminRoute>} />
                    <Route path="/reports/saved" element={<AdminRoute><SavedReportsPage /></AdminRoute>} />
                    <Route path="/reports/view/:id" element={<AdminRoute><ReportViewerPage /></AdminRoute>} />

                    {/* HR Reports */}
                    <Route path="/hr-reports" element={<AdminRoute><HRReportsPage /></AdminRoute>} />
                    <Route path="/hr-reports/employee-directory" element={<AdminRoute><EmployeeDirectoryReportPage /></AdminRoute>} />
                    <Route path="/hr-reports/headcount" element={<AdminRoute><HeadcountReportPage /></AdminRoute>} />
                    <Route path="/hr-reports/turnover" element={<AdminRoute><TurnoverReportPage /></AdminRoute>} />
                    <Route path="/hr-reports/demographics" element={<AdminRoute><DemographicsReportPage /></AdminRoute>} />
                    <Route path="/hr-reports/leave-balance" element={<AdminRoute><LeaveBalanceReportPage /></AdminRoute>} />
                    <Route path="/hr-reports/leave-utilization" element={<AdminRoute><LeaveUtilizationReportPage /></AdminRoute>} />
                    <Route path="/hr-reports/employment-history" element={<AdminRoute><EmploymentHistoryReportPage /></AdminRoute>} />
                    <Route path="/hr-reports/kpi-tracking" element={<AdminRoute><KPITrackingReportPage /></AdminRoute>} />
                    <Route path="/hr-reports/performance-appraisals" element={<AdminRoute><PerformanceAppraisalsReportPage /></AdminRoute>} />
                    <Route path="/hr-reports/training-development" element={<AdminRoute><TrainingDevelopmentReportPage /></AdminRoute>} />

                    {/* Settings - Available to all authenticated users */}
                    <Route path="/settings" element={<SettingsPage />} />

                    {/* HR Admin Routes */}
                    <Route path="/admin/leave-approvals" element={<AdminRoute><LeaveApprovalsPage /></AdminRoute>} />
                    <Route path="/admin/organization" element={<AdminRoute><OrganizationPage /></AdminRoute>} />
                    <Route path="/admin/leave-types" element={<AdminRoute><LeaveTypeSetupPage /></AdminRoute>} />
                    <Route path="/admin/leave-calendar" element={<AdminRoute><MyLeaveCalendarPage /></AdminRoute>} />

                    {/* Payroll Admin Routes */}
                    <Route path="/admin/payroll" element={<PayrollRoute><PayrollProcessingPage /></PayrollRoute>} />
                    <Route path="/admin/payroll/runs/:runId/errors" element={<PayrollRoute><PayrollErrorsPage /></PayrollRoute>} />
                    <Route path="/admin/loans" element={<PayrollRoute><LoanManagementPage /></PayrollRoute>} />
                    <Route path="/admin/transaction-types" element={<PayrollRoute><TransactionTypeSetupPage /></PayrollRoute>} />
                    <Route path="/admin/employee-transactions" element={<PayrollRoute><EmployeeTransactionsPage /></PayrollRoute>} />
                    <Route path="/admin/tax-configuration" element={<PayrollRoute><TaxConfigurationPage /></PayrollRoute>} />
                    <Route path="/admin/payroll-setup" element={<PayrollRoute><PayrollSetupPage /></PayrollRoute>} />
                    <Route path="/admin/payroll-implementation" element={<PayrollRoute><PayrollImplementationPage /></PayrollRoute>} />
                    <Route path="/admin/data-import" element={<PayrollRoute><DataImportPage /></PayrollRoute>} />
                    <Route path="/admin/backpay" element={<PayrollRoute><BackpayPage /></PayrollRoute>} />
                    <Route path="/admin/salary-upgrades" element={<PayrollRoute><SalaryUpgradePage /></PayrollRoute>} />
                    <Route path="/admin/payroll-validation" element={<PayrollRoute><PayrollValidationPage /></PayrollRoute>} />
                    <Route path="/payroll/employees" element={<PayrollRoute><PayrollEmployeesPage /></PayrollRoute>} />
                    <Route path="/payroll/employees/:id" element={<PayrollRoute><PayrollEmployeeDetailPage /></PayrollRoute>} />

                    {/* Performance Management Routes */}
                    <Route path="/admin/appraisal-cycles" element={<AdminRoute><AppraisalCyclesPage /></AdminRoute>} />
                    <Route path="/admin/appraisals" element={<AdminRoute><AppraisalsPage /></AdminRoute>} />
                    <Route path="/admin/appraisals/:id" element={<AdminRoute><AppraisalDetailPage /></AdminRoute>} />
                    <Route path="/admin/competencies" element={<AdminRoute><CompetenciesPage /></AdminRoute>} />
                    <Route path="/admin/core-values" element={<AdminRoute><CoreValuesPage /></AdminRoute>} />
                    <Route path="/admin/probation-assessments" element={<AdminRoute><ProbationAssessmentsPage /></AdminRoute>} />
                    <Route path="/admin/training-needs" element={<AdminRoute><TrainingNeedsPage /></AdminRoute>} />
                    <Route path="/admin/performance-appeals" element={<AdminRoute><PerformanceAppealsPage /></AdminRoute>} />

                    {/* Training & Development Routes */}
                    <Route path="/admin/training-dashboard" element={<AdminRoute><TrainingDashboardPage /></AdminRoute>} />
                    <Route path="/admin/training-programs" element={<AdminRoute><TrainingProgramsPage /></AdminRoute>} />
                    <Route path="/admin/training-sessions" element={<AdminRoute><TrainingSessionsPage /></AdminRoute>} />
                    <Route path="/admin/development-plans" element={<AdminRoute><DevelopmentPlansPage /></AdminRoute>} />

                    {/* Company Policies Routes */}
                    <Route path="/admin/policies" element={<AdminRoute><PoliciesPage /></AdminRoute>} />
                    <Route path="/admin/policies/new" element={<AdminRoute><PolicyFormPage /></AdminRoute>} />
                    <Route path="/admin/policies/:id" element={<AdminRoute><PolicyDetailPage /></AdminRoute>} />
                    <Route path="/admin/policies/:id/edit" element={<AdminRoute><PolicyFormPage /></AdminRoute>} />

                    {/* Exit/Offboarding Routes */}
                    <Route path="/admin/exits" element={<AdminRoute><ExitsPage /></AdminRoute>} />
                    <Route path="/admin/exits/:id" element={<AdminRoute><ExitDetailPage /></AdminRoute>} />

                    {/* Recruitment Routes */}
                    <Route path="/admin/recruitment" element={<AdminRoute><RecruitmentPage /></AdminRoute>} />
                    <Route path="/admin/recruitment/vacancies/new" element={<AdminRoute><VacancyFormPage /></AdminRoute>} />
                    <Route path="/admin/recruitment/vacancies/:id" element={<AdminRoute><VacancyDetailPage /></AdminRoute>} />
                    <Route path="/admin/recruitment/vacancies/:id/edit" element={<AdminRoute><VacancyFormPage /></AdminRoute>} />
                    <Route path="/admin/recruitment/applicants/:id" element={<AdminRoute><ApplicantDetailPage /></AdminRoute>} />
                    <Route path="/admin/recruitment/interviews/:id" element={<AdminRoute><InterviewDetailPage /></AdminRoute>} />

                    {/* Discipline & Grievance Routes */}
                    <Route path="/admin/disciplinary" element={<AdminRoute><DisciplinaryPage /></AdminRoute>} />
                    <Route path="/admin/grievances" element={<AdminRoute><GrievancePage /></AdminRoute>} />

                    {/* Approval Workflow Routes */}
                    <Route path="/admin/approval-workflows" element={<AdminRoute><ApprovalWorkflowPage /></AdminRoute>} />

                    {/* Announcements Routes */}
                    <Route path="/admin/announcements" element={<AdminRoute><AnnouncementsPage /></AdminRoute>} />

                    {/* User & Role Management Routes - System Admin only */}
                    <Route path="/admin/users" element={<SystemAdminRoute><UserManagementPage /></SystemAdminRoute>} />
                    <Route path="/admin/roles" element={<SystemAdminRoute><RoleManagementPage /></SystemAdminRoute>} />
                    <Route path="/admin/auth-providers" element={<SystemAdminRoute><AuthProvidersPage /></SystemAdminRoute>} />
                    <Route path="/admin/audit-logs" element={<SystemAdminRoute><AuditLogsPage /></SystemAdminRoute>} />
                    <Route path="/admin/tenants" element={<SuperuserRoute><TenantManagementPage /></SuperuserRoute>} />

                    {/* Finance Routes - Admin only */}
                    <Route path="/finance/accounts" element={<AdminRoute><ChartOfAccountsPage /></AdminRoute>} />
                    <Route path="/finance/journal-entries" element={<AdminRoute><JournalEntryPage /></AdminRoute>} />
                    <Route path="/finance/budgets" element={<AdminRoute><BudgetPage /></AdminRoute>} />
                    <Route path="/finance/vendors" element={<AdminRoute><VendorPage /></AdminRoute>} />
                    <Route path="/finance/vendor-invoices" element={<AdminRoute><VendorPage /></AdminRoute>} />
                    <Route path="/finance/customers" element={<AdminRoute><CustomerPage /></AdminRoute>} />
                    <Route path="/finance/customer-invoices" element={<AdminRoute><CustomerPage /></AdminRoute>} />
                    <Route path="/finance/payments" element={<AdminRoute><FinancePaymentsPage /></AdminRoute>} />
                    <Route path="/finance/bank-accounts" element={<AdminRoute><BankReconciliationPage /></AdminRoute>} />
                    <Route path="/finance/reconciliation" element={<AdminRoute><BankReconciliationPage /></AdminRoute>} />
                    <Route path="/finance/reports" element={<AdminRoute><FinancialReportsPage /></AdminRoute>} />
                    <Route path="/finance/tax-management" element={<AdminRoute><TaxManagementPage /></AdminRoute>} />
                    <Route path="/finance/credit-debit-notes" element={<AdminRoute><CreditDebitNotesPage /></AdminRoute>} />

                    {/* Procurement Routes - Admin only */}
                    <Route path="/procurement/requisitions" element={<AdminRoute><RequisitionsPage /></AdminRoute>} />
                    <Route path="/procurement/purchase-orders" element={<AdminRoute><PurchaseOrdersPage /></AdminRoute>} />
                    <Route path="/procurement/goods-receipt" element={<AdminRoute><GoodsReceiptPage /></AdminRoute>} />
                    <Route path="/procurement/contracts" element={<AdminRoute><ContractsPage /></AdminRoute>} />
                    <Route path="/procurement/rfq" element={<AdminRoute><RFQPage /></AdminRoute>} />

                    {/* Inventory & Asset Routes - Admin only */}
                    <Route path="/inventory/items" element={<AdminRoute><ItemsPage /></AdminRoute>} />
                    <Route path="/inventory/stock" element={<AdminRoute><StockPage /></AdminRoute>} />
                    <Route path="/inventory/warehouses" element={<AdminRoute><WarehousesPage /></AdminRoute>} />
                    <Route path="/inventory/assets" element={<AdminRoute><AssetRegisterPage /></AdminRoute>} />
                    <Route path="/inventory/depreciation" element={<AdminRoute><AssetDepreciationPage /></AdminRoute>} />
                    <Route path="/inventory/asset-disposals" element={<AdminRoute><AssetDisposalPage /></AdminRoute>} />

                    {/* Project Routes - Admin only */}
                    <Route path="/projects" element={<AdminRoute><ProjectsPage /></AdminRoute>} />
                    <Route path="/projects/timesheets" element={<AdminRoute><TimesheetsPage /></AdminRoute>} />
                    <Route path="/projects/resources" element={<AdminRoute><ResourceAllocationPage /></AdminRoute>} />
                    <Route path="/projects/:id" element={<AdminRoute><ProjectDetailPage /></AdminRoute>} />

                    {/* Manufacturing Routes - Admin only */}
                    <Route path="/manufacturing/dashboard" element={<AdminRoute><ProductionDashboardPage /></AdminRoute>} />
                    <Route path="/manufacturing/bom" element={<AdminRoute><BOMPage /></AdminRoute>} />
                    <Route path="/manufacturing/work-centers" element={<AdminRoute><WorkCentersPage /></AdminRoute>} />
                    <Route path="/manufacturing/work-orders" element={<AdminRoute><WorkOrdersPage /></AdminRoute>} />
                    <Route path="/manufacturing/quality" element={<AdminRoute><QualityPage /></AdminRoute>} />

                    {/* Backup & Restore Routes - System Admin only */}
                    <Route path="/admin/backup" element={<SystemAdminRoute><BackupManagementPage /></SystemAdminRoute>} />
                    <Route path="/admin/backup/restore/:id" element={<SystemAdminRoute><RestoreProgressPage /></SystemAdminRoute>} />

                    {/* Catch-all redirect */}
                    <Route path="*" element={<DefaultRedirect />} />
                  </Routes>
                </Suspense>
              </MainLayout>
            </PrivateRoute>
          }
        />
      </Routes>
    </Suspense>
  )
}

export default App
