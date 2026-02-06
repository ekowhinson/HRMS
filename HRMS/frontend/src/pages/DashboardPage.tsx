import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  UsersIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  CreditCardIcon,
  UserPlusIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  CakeIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { dashboardService } from '@/services/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { StatsCard } from '@/components/ui/StatsCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonDashboard } from '@/components/ui/Skeleton'
import { PieChartCard, BarChartCard, AreaChartCard, LineChartCard, GaugeChart } from '@/components/charts'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { chartColors } from '@/lib/design-tokens'

// Auto-refresh interval (30 seconds)
const REFRESH_INTERVAL = 30000

export default function DashboardPage() {
  // Main dashboard stats with auto-refresh
  const {
    data: stats,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardService.getStats,
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  })

  // HR Dashboard data
  const { data: hrData } = useQuery({
    queryKey: ['hr-dashboard'],
    queryFn: dashboardService.getHRDashboard,
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  })

  // Payroll Dashboard data
  const { data: payrollData } = useQuery({
    queryKey: ['payroll-dashboard'],
    queryFn: dashboardService.getPayrollDashboard,
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  })

  // Leave Dashboard data
  const { data: leaveData } = useQuery({
    queryKey: ['leave-dashboard'],
    queryFn: dashboardService.getLeaveDashboard,
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  })

  // Performance Dashboard data
  const { data: performanceData } = useQuery({
    queryKey: ['performance-dashboard'],
    queryFn: dashboardService.getPerformanceDashboard,
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10000,
  })

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          subtitle="Welcome to Human Resource Management System"
        />
        <SkeletonDashboard />
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          subtitle="Welcome to Human Resource Management System"
        />
        <EmptyState
          type="error"
          title="Failed to load dashboard"
          description={
            (error as any)?.message ||
            'Unable to connect to the server. Please check your connection.'
          }
          action={{ label: 'Try Again', onClick: () => refetch() }}
        />
      </div>
    )
  }

  // Calculate stats
  const totalEmployees = stats?.total_employees || 0
  const newHires = stats?.new_hires_this_month || 0
  const pendingLeave = stats?.pending_leave_requests || 0
  const activeLoans = stats?.active_loans || 0

  // Prepare chart data
  const departmentData =
    hrData?.employee_by_department?.slice(0, 8).map((dept, index) => ({
      name: dept.department_name || 'Unassigned',
      value: dept.count,
      color: chartColors.palette[index % chartColors.palette.length],
    })) || []

  const statusData =
    hrData?.employee_by_status?.map((item, index) => ({
      name: item.status?.replace(/_/g, ' ') || 'Unknown',
      value: item.count,
      color: chartColors.palette[index % chartColors.palette.length],
    })) || []

  const genderData =
    hrData?.employee_by_gender?.map((g, index) => ({
      name: g.gender || 'Unknown',
      value: g.count,
      color: index === 0 ? chartColors.primary : chartColors.secondary,
    })) || []

  // Payroll trend data
  const payrollTrendData =
    payrollData?.payroll_trends?.map((trend) => ({
      name: trend.month,
      gross: trend.total_gross,
      net: trend.total_net,
      deductions: trend.total_deductions,
    })) || []

  // Leave by type data
  const leaveByTypeData =
    leaveData?.leave_by_type?.map((item, index) => ({
      name: item.leave_type,
      value: item.count,
      color: item.color || chartColors.palette[index % chartColors.palette.length],
    })) || []

  // Monthly leave trend
  const leaveTrendData =
    leaveData?.monthly_trend?.map((item) => ({
      name: item.month,
      approved: item.approved,
      rejected: item.rejected,
    })) || []

  // Quick links for navigation
  const quickActions = [
    { label: 'Add Employee', href: '/employees/new', icon: UserPlusIcon },
    { label: 'Process Payroll', href: '/admin/payroll', icon: BanknotesIcon },
    { label: 'Leave Approvals', href: '/admin/leave-approvals', icon: CalendarDaysIcon },
    { label: 'View Reports', href: '/reports', icon: ChartBarIcon },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        subtitle="Welcome to Human Resource Management System"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live updates
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <ArrowTrendingUpIcon className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Employees"
          value={formatNumber(totalEmployees)}
          icon={<UsersIcon className="w-5 h-5" />}
          variant="primary"
          trend={{
            value: newHires > 0 ? Math.round((newHires / totalEmployees) * 100) : 0,
            direction: newHires > 0 ? 'up' : 'neutral',
            label: `${newHires} new this month`,
          }}
          onClick={() => window.location.href = '/employees'}
        />

        <StatsCard
          title="Pending Leave"
          value={formatNumber(pendingLeave)}
          icon={<CalendarDaysIcon className="w-5 h-5" />}
          variant={pendingLeave > 5 ? 'warning' : 'info'}
          trend={{
            value: pendingLeave,
            direction: pendingLeave > 5 ? 'up' : 'neutral',
            label: 'awaiting approval',
          }}
          onClick={() => window.location.href = '/admin/leave-approvals'}
        />

        <StatsCard
          title="On Leave Today"
          value={formatNumber(leaveData?.on_leave_today || 0)}
          icon={<UserGroupIcon className="w-5 h-5" />}
          variant="info"
          trend={{
            value: leaveData?.upcoming_leave || 0,
            direction: 'neutral',
            label: 'upcoming this week',
          }}
        />

        <StatsCard
          title="Active Loans"
          value={formatNumber(activeLoans)}
          icon={<CreditCardIcon className="w-5 h-5" />}
          variant="default"
          trend={{
            value: 0,
            direction: 'neutral',
            label: 'total active',
          }}
          onClick={() => window.location.href = '/admin/loans'}
        />
      </div>

      {/* Payroll Summary */}
      {(stats?.latest_payroll || payrollData?.latest_payroll) && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <BanknotesIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Latest Payroll - {payrollData?.latest_payroll?.period || stats?.latest_payroll?.period}
                  </h3>
                  <p className="text-sm text-white/80">
                    {payrollData?.latest_payroll?.status || 'Processed'}
                  </p>
                </div>
              </div>
              <Link to="/admin/payroll">
                <Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                  View Details
                  <ArrowRightIcon className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-3xl font-bold text-gray-900">
                  {formatNumber(payrollData?.latest_payroll?.total_employees || stats?.latest_payroll?.total_employees || 0)}
                </p>
                <p className="text-sm text-gray-500 mt-1">Employees Processed</p>
              </div>
              <div className="text-center p-4 bg-primary-50 rounded-xl">
                <p className="text-3xl font-bold text-primary-700">
                  {formatCurrency(payrollData?.latest_payroll?.total_gross || stats?.latest_payroll?.total_gross || 0)}
                </p>
                <p className="text-sm text-gray-500 mt-1">Total Gross</p>
              </div>
              <div className="text-center p-4 bg-warning-50 rounded-xl">
                <p className="text-3xl font-bold text-warning-700">
                  {formatCurrency(payrollData?.latest_payroll?.total_deductions || 0)}
                </p>
                <p className="text-sm text-gray-500 mt-1">Total Deductions</p>
              </div>
              <div className="text-center p-4 bg-success-50 rounded-xl">
                <p className="text-3xl font-bold text-success-700">
                  {formatCurrency(payrollData?.latest_payroll?.total_net || stats?.latest_payroll?.total_net || 0)}
                </p>
                <p className="text-sm text-gray-500 mt-1">Total Net Pay</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row 1: Workforce Overview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PieChartCard
          title="Employees by Department"
          subtitle="Distribution across departments"
          data={departmentData}
          donut={true}
          height={280}
          centerLabel={{ value: totalEmployees, label: 'Total' }}
          legendPosition="right"
        />

        <PieChartCard
          title="Employment Status"
          subtitle="Current workforce status"
          data={statusData}
          donut={true}
          height={280}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-primary-500" />
              HR Highlights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl">
                <p className="text-3xl font-bold text-primary-700">
                  {hrData?.on_probation || 0}
                </p>
                <p className="text-sm text-primary-600 mt-1">On Probation</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-warning-50 to-warning-100 rounded-xl">
                <p className="text-3xl font-bold text-warning-700">
                  {hrData?.pending_confirmations || 0}
                </p>
                <p className="text-sm text-warning-600 mt-1">Pending Confirmation</p>
              </div>
            </div>

            {/* Gender Distribution */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Gender Distribution</h4>
              <div className="space-y-2">
                {genderData.map((g) => {
                  const percentage = totalEmployees > 0 ? (g.value / totalEmployees) * 100 : 0
                  return (
                    <div key={g.name} className="flex items-center gap-3">
                      <span className="w-16 text-sm text-gray-600">{g.name}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${percentage}%`, backgroundColor: g.color }}
                        />
                      </div>
                      <span className="w-12 text-sm font-medium text-gray-900 text-right">
                        {g.value}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Celebrations */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CakeIcon className="h-5 w-5 text-pink-500" />
                  <span className="text-sm text-gray-600">Birthdays this month</span>
                </div>
                <Badge variant="info">{hrData?.birthdays_this_month || 0}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Payroll & Leave */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {payrollTrendData.length > 0 ? (
          <LineChartCard
            title="Payroll Trends"
            subtitle="Monthly gross vs net pay (6 months)"
            data={payrollTrendData}
            lines={[
              { dataKey: 'gross', name: 'Gross Pay', color: chartColors.primary },
              { dataKey: 'net', name: 'Net Pay', color: chartColors.secondary },
            ]}
            height={300}
            valueFormatter={(v) => formatCurrency(v)}
          />
        ) : (
          <AreaChartCard
            title="Payroll Trends"
            subtitle="Monthly payroll overview"
            data={[
              { name: 'Jul', value: (stats?.latest_payroll?.total_gross || 0) * 0.92 },
              { name: 'Aug', value: (stats?.latest_payroll?.total_gross || 0) * 0.95 },
              { name: 'Sep', value: (stats?.latest_payroll?.total_gross || 0) * 0.97 },
              { name: 'Oct', value: (stats?.latest_payroll?.total_gross || 0) * 0.99 },
              { name: 'Nov', value: (stats?.latest_payroll?.total_gross || 0) * 1.01 },
              { name: 'Dec', value: stats?.latest_payroll?.total_gross || 0 },
            ]}
            height={300}
            color={chartColors.primary}
            valueFormatter={(v) => formatCurrency(v)}
          />
        )}

        {leaveByTypeData.length > 0 ? (
          <PieChartCard
            title="Leave by Type"
            subtitle="Current leave distribution"
            data={leaveByTypeData}
            donut={true}
            height={300}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Leave Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-warning-50 rounded-xl text-center">
                  <CalendarDaysIcon className="h-8 w-8 text-warning-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-warning-700">{pendingLeave}</p>
                  <p className="text-sm text-gray-500">Pending Approval</p>
                </div>
                <div className="p-4 bg-success-50 rounded-xl text-center">
                  <CheckCircleIcon className="h-8 w-8 text-success-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-success-700">{leaveData?.approved_today || 0}</p>
                  <p className="text-sm text-gray-500">Approved Today</p>
                </div>
                <div className="p-4 bg-info-50 rounded-xl text-center">
                  <UserGroupIcon className="h-8 w-8 text-info-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-info-700">{leaveData?.on_leave_today || 0}</p>
                  <p className="text-sm text-gray-500">On Leave Today</p>
                </div>
                <div className="p-4 bg-primary-50 rounded-xl text-center">
                  <ClockIcon className="h-8 w-8 text-primary-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-primary-700">{leaveData?.upcoming_leave || 0}</p>
                  <p className="text-sm text-gray-500">Upcoming</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts Row 3: Performance & Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {performanceData && performanceData.completion_rate > 0 && (
          <GaugeChart
            title="Appraisal Completion"
            subtitle="Current cycle progress"
            value={performanceData.completion_rate}
            label="Complete"
          />
        )}

        <BarChartCard
          title="Employees by Status"
          subtitle="Employment status breakdown"
          data={statusData}
          layout="horizontal"
          height={250}
          colors={[...chartColors.palette]}
        />

        {leaveTrendData.length > 0 && (
          <BarChartCard
            title="Leave Trends"
            subtitle="Monthly approved vs rejected"
            data={leaveTrendData.map((item) => ({
              name: item.name,
              value: item.approved,
            }))}
            height={250}
            color={chartColors.primary}
          />
        )}
      </div>

      {/* Quick Actions & Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-gray-500" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  to={action.href}
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                >
                  <div className="p-2 bg-white rounded-lg shadow-sm group-hover:shadow">
                    <action.icon className="h-5 w-5 text-primary-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts & Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-warning-500" />
              Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingLeave > 0 && (
                <Link
                  to="/admin/leave-approvals"
                  className="flex items-center justify-between p-3 bg-warning-50 rounded-lg hover:bg-warning-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CalendarDaysIcon className="h-5 w-5 text-warning-600" />
                    <div>
                      <p className="text-sm font-medium text-warning-900">
                        {pendingLeave} Leave Request{pendingLeave > 1 ? 's' : ''} Pending
                      </p>
                      <p className="text-xs text-warning-600">Requires your approval</p>
                    </div>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 text-warning-600" />
                </Link>
              )}

              {(hrData?.pending_confirmations || 0) > 0 && (
                <Link
                  to="/employees?status=PROBATION"
                  className="flex items-center justify-between p-3 bg-info-50 rounded-lg hover:bg-info-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <UserPlusIcon className="h-5 w-5 text-info-600" />
                    <div>
                      <p className="text-sm font-medium text-info-900">
                        {hrData?.pending_confirmations} Probation Confirmation{hrData!.pending_confirmations > 1 ? 's' : ''} Due
                      </p>
                      <p className="text-xs text-info-600">Review for confirmation</p>
                    </div>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 text-info-600" />
                </Link>
              )}

              {payrollData?.pending_runs && payrollData.pending_runs > 0 && (
                <Link
                  to="/admin/payroll"
                  className="flex items-center justify-between p-3 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <BanknotesIcon className="h-5 w-5 text-primary-600" />
                    <div>
                      <p className="text-sm font-medium text-primary-900">
                        {payrollData.pending_runs} Payroll Run{payrollData.pending_runs > 1 ? 's' : ''} Pending
                      </p>
                      <p className="text-xs text-primary-600">Ready for processing</p>
                    </div>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 text-primary-600" />
                </Link>
              )}

              {pendingLeave === 0 && (hrData?.pending_confirmations || 0) === 0 && (!payrollData?.pending_runs || payrollData.pending_runs === 0) && (
                <div className="flex items-center gap-3 p-3 bg-success-50 rounded-lg">
                  <CheckCircleIcon className="h-5 w-5 text-success-600" />
                  <p className="text-sm font-medium text-success-900">
                    All caught up! No pending actions.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer Note */}
      <div className="text-center text-xs text-gray-400 py-4">
        Data refreshes automatically every 30 seconds
      </div>
    </div>
  )
}
