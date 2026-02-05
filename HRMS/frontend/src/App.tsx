import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './features/auth/store'
import MainLayout from './components/layout/MainLayout'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
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
import PayrollSetupPage from './pages/admin/PayrollSetupPage'
// Report pages
import PayrollMasterReportPage from './pages/reports/PayrollMasterReportPage'

// Roles that grant access to HR/Admin features
const HR_ADMIN_ROLES = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN', 'SUPERUSER']

function useIsHROrAdmin() {
  const user = useAuthStore((state) => state.user)
  const userRoles = user?.roles?.map((r: any) => r.code || r.name || r) || []
  return user?.is_staff || user?.is_superuser ||
    userRoles.some((role: string) => HR_ADMIN_ROLES.includes(role.toUpperCase()))
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
    return <Navigate to="/my-leave" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isHROrAdmin = useIsHROrAdmin()
  // Redirect to appropriate page based on role
  const redirectTo = isHROrAdmin ? '/dashboard' : '/my-leave'
  return isAuthenticated ? <Navigate to={redirectTo} replace /> : <>{children}</>
}

function DefaultRedirect() {
  const isHROrAdmin = useIsHROrAdmin()
  return <Navigate to={isHROrAdmin ? '/dashboard' : '/my-leave'} replace />
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
      <Route path="/signup/verify" element={<PublicRoute><SignupPage /></PublicRoute>} />

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
                <Route path="/my-profile" element={<MyProfilePage />} />
                <Route path="/my-leave" element={<MyLeaveDashboard />} />
                <Route path="/my-leave/calendar" element={<MyLeaveCalendarPage />} />
                <Route path="/my-leave/history" element={<MyLeaveHistoryPage />} />

                {/* Leave Management - Admin only */}
                <Route path="/leave" element={<AdminRoute><LeavePage /></AdminRoute>} />

                {/* Payroll & Benefits - Admin only */}
                <Route path="/payroll" element={<AdminRoute><PayrollPage /></AdminRoute>} />
                <Route path="/benefits" element={<AdminRoute><BenefitsPage /></AdminRoute>} />

                {/* Reports - Admin only */}
                <Route path="/reports" element={<AdminRoute><ReportsPage /></AdminRoute>} />
                <Route path="/reports/payroll-master" element={<AdminRoute><PayrollMasterReportPage /></AdminRoute>} />

                {/* Settings - Admin only */}
                <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />

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
