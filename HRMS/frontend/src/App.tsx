import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './features/auth/store'
import MainLayout from './components/layout/MainLayout'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import EmployeesPage from './pages/EmployeesPage'
import EmployeeDetailPage from './pages/EmployeeDetailPage'
import EmployeeFormPage from './pages/EmployeeFormPage'
import LeavePage from './pages/LeavePage'
import PayrollPage from './pages/PayrollPage'
import BenefitsPage from './pages/BenefitsPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
// Portal pages
import MyProfilePage from './pages/portal/MyProfilePage'
import MyLeaveDashboard from './pages/portal/MyLeaveDashboard'
import MyLeaveCalendarPage from './pages/portal/MyLeaveCalendarPage'
import MyLeaveHistoryPage from './pages/portal/MyLeaveHistoryPage'
import LeavePlanningPage from './pages/portal/LeavePlanningPage'
import DataUpdateRequestsPage from './pages/portal/DataUpdateRequestsPage'
import ServiceRequestsPage from './pages/portal/ServiceRequestsPage'
import SelfServiceDashboard from './pages/portal/SelfServiceDashboard'
import MyPayslipsPage from './pages/portal/MyPayslipsPage'
import MyLoansPage from './pages/portal/MyLoansPage'
// Admin pages
import PayrollProcessingPage from './pages/admin/PayrollProcessingPage'
import LeaveApprovalsPage from './pages/admin/LeaveApprovalsPage'
import OrganizationPage from './pages/admin/OrganizationPage'
import LoanManagementPage from './pages/admin/LoanManagementPage'
import TransactionTypeSetupPage from './pages/admin/TransactionTypeSetupPage'
import EmployeeTransactionsPage from './pages/admin/EmployeeTransactionsPage'
import TaxConfigurationPage from './pages/admin/TaxConfigurationPage'
import LeaveTypeSetupPage from './pages/admin/LeaveTypeSetupPage'
import DataImportPage from './pages/admin/DataImportPage'
import DataAnalyzerPage from './pages/admin/DataAnalyzerPage'
import PayrollSetupPage from './pages/admin/PayrollSetupPage'
import PayrollImplementationPage from './pages/admin/PayrollImplementationPage'
import BackpayPage from './pages/admin/BackpayPage'
// Performance pages
import CoreValuesPage from './pages/admin/CoreValuesPage'
import ProbationAssessmentsPage from './pages/admin/ProbationAssessmentsPage'
import TrainingNeedsPage from './pages/admin/TrainingNeedsPage'
import PerformanceAppealsPage from './pages/admin/PerformanceAppealsPage'
import AppraisalCyclesPage from './pages/admin/AppraisalCyclesPage'
import AppraisalsPage from './pages/admin/AppraisalsPage'
import AppraisalDetailPage from './pages/admin/AppraisalDetailPage'
import CompetenciesPage from './pages/admin/CompetenciesPage'
// Portal - Performance
import MyAppraisalPage from './pages/portal/MyAppraisalPage'
// Report pages
import PayrollMasterReportPage from './pages/reports/PayrollMasterReportPage'
import PayrollReconciliationPage from './pages/admin/PayrollReconciliationPage'
import PayrollJournalPage from './pages/admin/PayrollJournalPage'
import SalaryReconciliationPage from './pages/admin/SalaryReconciliationPage'
// Policy pages
import PoliciesPage from './pages/admin/PoliciesPage'
import PolicyDetailPage from './pages/admin/PolicyDetailPage'
import PolicyFormPage from './pages/admin/PolicyFormPage'
// Exit/Offboarding pages
import ExitsPage from './pages/admin/ExitsPage'
import ExitDetailPage from './pages/admin/ExitDetailPage'
// Recruitment pages
import RecruitmentPage from './pages/admin/RecruitmentPage'
import VacancyFormPage from './pages/admin/VacancyFormPage'
import VacancyDetailPage from './pages/admin/VacancyDetailPage'
// Discipline & Grievance pages
import DisciplinaryPage from './pages/admin/DisciplinaryPage'
import GrievancePage from './pages/admin/GrievancePage'
// Portal - Discipline & Grievance
import MyDisciplinaryPage from './pages/portal/MyDisciplinaryPage'
import MyGrievancesPage from './pages/portal/MyGrievancesPage'
// Announcements pages
import AnnouncementsPage from './pages/admin/AnnouncementsPage'
// User & Role Management pages
import UserManagementPage from './pages/admin/UserManagementPage'
import RoleManagementPage from './pages/admin/RoleManagementPage'
import AuthProvidersPage from './pages/admin/AuthProvidersPage'
// Audit Logs
import AuditLogsPage from './pages/admin/AuditLogsPage'
// Approval Workflow
import ApprovalInboxPage from './pages/ApprovalInboxPage'
import ApprovalWorkflowPage from './pages/admin/ApprovalWorkflowPage'

// Roles that grant access to HR/Admin features
const HR_ADMIN_ROLES = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN', 'SUPERUSER']

function useIsHROrAdmin() {
  const user = useAuthStore((state) => state.user)
  if (!user) return false

  // Check staff/superuser first
  if (user.is_staff || user.is_superuser) return true

  // Safely extract role strings
  const userRoles: string[] = []
  if (Array.isArray(user.roles)) {
    user.roles.forEach((r: any) => {
      const roleStr = typeof r === 'string' ? r : (r?.code || r?.name || '')
      if (typeof roleStr === 'string' && roleStr) {
        userRoles.push(roleStr.toUpperCase())
      }
    })
  }

  return userRoles.some((role) => HR_ADMIN_ROLES.includes(role))
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
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
      <Route path="/signup/verify" element={<PublicRoute><SignupPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

      {/* Onboarding (authenticated but no layout) */}
      <Route path="/onboarding" element={<PrivateRoute><OnboardingPage /></PrivateRoute>} />

      {/* Protected routes with layout */}
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <MainLayout>
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
                <Route path="/my-payslips" element={<MyPayslipsPage />} />
                <Route path="/my-loans" element={<MyLoansPage />} />
                <Route path="/my-disciplinary" element={<MyDisciplinaryPage />} />
                <Route path="/my-grievances" element={<MyGrievancesPage />} />
                <Route path="/my-approvals" element={<ApprovalInboxPage />} />

                {/* Leave Management - Admin only */}
                <Route path="/leave" element={<AdminRoute><LeavePage /></AdminRoute>} />

                {/* Payroll & Benefits - Admin only */}
                <Route path="/payroll" element={<AdminRoute><PayrollPage /></AdminRoute>} />
                <Route path="/benefits" element={<AdminRoute><BenefitsPage /></AdminRoute>} />

                {/* Reports - Admin only */}
                <Route path="/reports" element={<AdminRoute><ReportsPage /></AdminRoute>} />
                <Route path="/reports/payroll-master" element={<AdminRoute><PayrollMasterReportPage /></AdminRoute>} />
                <Route path="/reports/reconciliation" element={<AdminRoute><PayrollReconciliationPage /></AdminRoute>} />
                <Route path="/reports/journal" element={<AdminRoute><PayrollJournalPage /></AdminRoute>} />
                <Route path="/reports/salary-reconciliation" element={<AdminRoute><SalaryReconciliationPage /></AdminRoute>} />

                {/* Settings - Available to all authenticated users */}
                <Route path="/settings" element={<SettingsPage />} />

                {/* Admin Routes - Admin only */}
                <Route path="/admin/payroll" element={<AdminRoute><PayrollProcessingPage /></AdminRoute>} />
                <Route path="/admin/leave-approvals" element={<AdminRoute><LeaveApprovalsPage /></AdminRoute>} />
                <Route path="/admin/organization" element={<AdminRoute><OrganizationPage /></AdminRoute>} />
                <Route path="/admin/loans" element={<AdminRoute><LoanManagementPage /></AdminRoute>} />
                <Route path="/admin/transaction-types" element={<AdminRoute><TransactionTypeSetupPage /></AdminRoute>} />
                <Route path="/admin/employee-transactions" element={<AdminRoute><EmployeeTransactionsPage /></AdminRoute>} />
                <Route path="/admin/tax-configuration" element={<AdminRoute><TaxConfigurationPage /></AdminRoute>} />
                <Route path="/admin/payroll-setup" element={<AdminRoute><PayrollSetupPage /></AdminRoute>} />
                <Route path="/admin/leave-types" element={<AdminRoute><LeaveTypeSetupPage /></AdminRoute>} />
                <Route path="/admin/leave-calendar" element={<AdminRoute><MyLeaveCalendarPage /></AdminRoute>} />
                <Route path="/admin/data-import" element={<AdminRoute><DataImportPage /></AdminRoute>} />
                <Route path="/admin/data-analyzer" element={<AdminRoute><DataAnalyzerPage /></AdminRoute>} />
                <Route path="/admin/payroll-implementation" element={<AdminRoute><PayrollImplementationPage /></AdminRoute>} />
                <Route path="/admin/backpay" element={<AdminRoute><BackpayPage /></AdminRoute>} />

                {/* Performance Management Routes */}
                <Route path="/admin/appraisal-cycles" element={<AdminRoute><AppraisalCyclesPage /></AdminRoute>} />
                <Route path="/admin/appraisals" element={<AdminRoute><AppraisalsPage /></AdminRoute>} />
                <Route path="/admin/appraisals/:id" element={<AdminRoute><AppraisalDetailPage /></AdminRoute>} />
                <Route path="/admin/competencies" element={<AdminRoute><CompetenciesPage /></AdminRoute>} />
                <Route path="/admin/core-values" element={<AdminRoute><CoreValuesPage /></AdminRoute>} />
                <Route path="/admin/probation-assessments" element={<AdminRoute><ProbationAssessmentsPage /></AdminRoute>} />
                <Route path="/admin/training-needs" element={<AdminRoute><TrainingNeedsPage /></AdminRoute>} />
                <Route path="/admin/performance-appeals" element={<AdminRoute><PerformanceAppealsPage /></AdminRoute>} />

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

                {/* Discipline & Grievance Routes */}
                <Route path="/admin/disciplinary" element={<AdminRoute><DisciplinaryPage /></AdminRoute>} />
                <Route path="/admin/grievances" element={<AdminRoute><GrievancePage /></AdminRoute>} />

                {/* Approval Workflow Routes */}
                <Route path="/admin/approval-workflows" element={<AdminRoute><ApprovalWorkflowPage /></AdminRoute>} />

                {/* Announcements Routes */}
                <Route path="/admin/announcements" element={<AdminRoute><AnnouncementsPage /></AdminRoute>} />

                {/* User & Role Management Routes */}
                <Route path="/admin/users" element={<AdminRoute><UserManagementPage /></AdminRoute>} />
                <Route path="/admin/roles" element={<AdminRoute><RoleManagementPage /></AdminRoute>} />
                <Route path="/admin/auth-providers" element={<AdminRoute><AuthProvidersPage /></AdminRoute>} />
                <Route path="/admin/audit-logs" element={<AdminRoute><AuditLogsPage /></AdminRoute>} />

                {/* Catch-all redirect */}
                <Route path="*" element={<DefaultRedirect />} />
              </Routes>
            </MainLayout>
          </PrivateRoute>
        }
      />
    </Routes>
  )
}

export default App
