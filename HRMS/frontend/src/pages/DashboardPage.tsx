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
  ArrowPathIcon,
  BoltIcon,
} from '@heroicons/react/24/outline'
import { dashboardService } from '@/services/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { PieChartCard, BarChartCard, AreaChartCard, LineChartCard, GaugeChart } from '@/components/charts'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { chartColors } from '@/lib/design-tokens'

// Auto-refresh interval (30 seconds)
const REFRESH_INTERVAL = 30000

// Clean Stats Card Component (SAP-like)
function StunningStatsCard({
  title,
  value,
  icon: Icon,
  gradient,
  trend,
  onClick,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  gradient: 'primary' | 'accent' | 'info' | 'warning'
  trend?: { value: number; label: string; direction: 'up' | 'down' | 'neutral' }
  onClick?: () => void
}) {
  const iconStyles = {
    primary: 'bg-primary-50 text-primary-600',
    accent: 'bg-accent-50 text-accent-600',
    info: 'bg-blue-50 text-blue-600',
    warning: 'bg-amber-50 text-amber-600',
  }

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg border border-gray-200 p-6 shadow-xs hover:border-gray-300 transition-colors ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.direction === 'up' && (
                <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" />
              )}
              <span className="text-sm text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`${iconStyles[gradient]} rounded-lg p-3`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}

// Loading Skeleton
function StunningLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-gray-200 rounded-lg" />
          <div className="h-4 w-64 bg-gray-100 rounded" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-lg border border-gray-200" />
        ))}
      </div>

      <div className="h-48 bg-gray-100 rounded-lg border border-gray-200" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-64 bg-gray-100 rounded-lg border border-gray-200" />
        ))}
      </div>
    </div>
  )
}

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500">Loading your workspace...</p>
          </div>
        </div>
        <StunningLoadingSkeleton />
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg border border-gray-200 shadow-xs max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Failed to load dashboard</h2>
          <p className="text-gray-500 mb-6">
            {(error as any)?.message || 'Unable to connect to the server'}
          </p>
          <Button onClick={() => refetch()} className="bg-primary-600 text-white hover:bg-primary-700">
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
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
    { label: 'Add Employee', href: '/employees/new', icon: UserPlusIcon, color: 'primary' as const },
    { label: 'Process Payroll', href: '/admin/payroll', icon: BanknotesIcon, color: 'accent' as const },
    { label: 'Leave Approvals', href: '/admin/leave-approvals', icon: CalendarDaysIcon, color: 'blue' as const },
    { label: 'View Reports', href: '/reports', icon: ChartBarIcon, color: 'amber' as const },
  ]

  const quickActionIconColors = {
    primary: 'bg-primary-100 text-primary-600',
    accent: 'bg-accent-100 text-accent-600',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SparklesIcon className="w-7 h-7 text-primary-500" />
            Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Welcome to Human Resource Management System</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-200">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-green-700">Live</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-gray-200 hover:border-primary-300 hover:bg-primary-50"
          >
            <ArrowPathIcon className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StunningStatsCard
          title="Total Employees"
          value={formatNumber(totalEmployees)}
          icon={UsersIcon}
          gradient="primary"
          trend={{
            value: newHires,
            direction: newHires > 0 ? 'up' : 'neutral',
            label: `${newHires} new this month`,
          }}
          onClick={() => window.location.href = '/employees'}
        />

        <StunningStatsCard
          title="Pending Leave"
          value={formatNumber(pendingLeave)}
          icon={CalendarDaysIcon}
          gradient={pendingLeave > 5 ? 'warning' : 'info'}
          trend={{
            value: pendingLeave,
            direction: pendingLeave > 5 ? 'up' : 'neutral',
            label: 'awaiting approval',
          }}
          onClick={() => window.location.href = '/admin/leave-approvals'}
        />

        <StunningStatsCard
          title="On Leave Today"
          value={formatNumber(leaveData?.on_leave_today || 0)}
          icon={UserGroupIcon}
          gradient="accent"
          trend={{
            value: leaveData?.upcoming_leave || 0,
            direction: 'neutral',
            label: 'upcoming this week',
          }}
        />

        <StunningStatsCard
          title="Active Loans"
          value={formatNumber(activeLoans)}
          icon={CreditCardIcon}
          gradient="info"
          trend={{
            value: 0,
            direction: 'neutral',
            label: 'total active',
          }}
          onClick={() => window.location.href = '/admin/loans'}
        />
      </div>

      {/* Payroll Summary - Clean Card with Header Strip */}
      {(stats?.latest_payroll || payrollData?.latest_payroll) && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
          {/* Primary header strip */}
          <div className="bg-primary-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/20 rounded-lg">
                  <BanknotesIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Latest Payroll - {payrollData?.latest_payroll?.period || stats?.latest_payroll?.period}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/20 text-white">
                      {payrollData?.latest_payroll?.status || 'Processed'}
                    </span>
                  </div>
                </div>
              </div>
              <Link to="/admin/payroll">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  View Details
                  <ArrowRightIcon className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6">
            <div className="border-l-4 border-l-gray-500 bg-gray-50 p-4 rounded-r-lg">
              <p className="text-3xl font-bold text-gray-900">
                {formatNumber(payrollData?.latest_payroll?.total_employees || stats?.latest_payroll?.total_employees || 0)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Employees Processed</p>
            </div>
            <div className="border-l-4 border-l-primary-500 bg-gray-50 p-4 rounded-r-lg">
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(payrollData?.latest_payroll?.total_gross || stats?.latest_payroll?.total_gross || 0)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Total Gross</p>
            </div>
            <div className="border-l-4 border-l-amber-500 bg-gray-50 p-4 rounded-r-lg">
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(payrollData?.latest_payroll?.total_deductions || 0)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Total Deductions</p>
            </div>
            <div className="border-l-4 border-l-green-500 bg-gray-50 p-4 rounded-r-lg">
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(payrollData?.latest_payroll?.total_net || stats?.latest_payroll?.total_net || 0)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Total Net Pay</p>
            </div>
          </div>
        </div>
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

        <Card className="overflow-hidden border border-gray-200 shadow-xs">
          <div className="h-full bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-primary-50 rounded-lg">
                <SparklesIcon className="h-5 w-5 text-primary-600" />
              </div>
              <h3 className="font-semibold text-gray-900">HR Highlights</h3>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-4 bg-white border border-gray-200 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{hrData?.on_probation || 0}</p>
                <p className="text-sm text-gray-500 mt-1">On Probation</p>
              </div>
              <div className="p-4 bg-white border border-gray-200 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{hrData?.pending_confirmations || 0}</p>
                <p className="text-sm text-gray-500 mt-1">Pending Confirmation</p>
              </div>
            </div>

            {/* Gender Distribution */}
            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Gender Distribution</h4>
              <div className="space-y-2">
                {genderData.map((g) => {
                  const percentage = totalEmployees > 0 ? (g.value / totalEmployees) * 100 : 0
                  return (
                    <div key={g.name} className="flex items-center gap-3">
                      <span className="w-16 text-sm text-gray-600">{g.name}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%`, backgroundColor: g.color }}
                        />
                      </div>
                      <span className="w-12 text-sm font-semibold text-gray-900 text-right">
                        {g.value}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Celebrations */}
            <div className="pt-4 mt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CakeIcon className="h-5 w-5 text-pink-500" />
                  <span className="text-sm text-gray-600">Birthdays this month</span>
                </div>
                <span className="px-3 py-1 bg-pink-50 text-pink-700 text-sm font-semibold rounded-full border border-pink-200">
                  {hrData?.birthdays_this_month || 0}
                </span>
              </div>
            </div>
          </div>
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
          <Card className="overflow-hidden border border-gray-200 shadow-xs">
            <CardHeader>
              <CardTitle>Leave Overview</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
                  <CalendarDaysIcon className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-amber-700">{pendingLeave}</p>
                  <p className="text-sm text-gray-500">Pending Approval</p>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                  <CheckCircleIcon className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-700">{leaveData?.approved_today || 0}</p>
                  <p className="text-sm text-gray-500">Approved Today</p>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <UserGroupIcon className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-700">{leaveData?.on_leave_today || 0}</p>
                  <p className="text-sm text-gray-500">On Leave Today</p>
                </div>
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-center">
                  <ClockIcon className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-700">{leaveData?.upcoming_leave || 0}</p>
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
        <Card className="overflow-hidden border border-gray-200 shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BoltIcon className="w-5 h-5 text-amber-500" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  to={action.href}
                  className="flex items-center gap-3 p-4 rounded-lg bg-white border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors group"
                >
                  <div className={`p-2 ${quickActionIconColors[action.color]} rounded-lg`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts & Notifications */}
        <Card className="overflow-hidden border border-gray-200 shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
              Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {pendingLeave > 0 && (
                <Link
                  to="/admin/leave-approvals"
                  className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500 rounded-lg text-white">
                      <CalendarDaysIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {pendingLeave} Leave Request{pendingLeave > 1 ? 's' : ''} Pending
                      </p>
                      <p className="text-xs text-gray-500">Requires your approval</p>
                    </div>
                  </div>
                  <ArrowRightIcon className="h-5 w-5 text-amber-600 group-hover:translate-x-1 transition-transform" />
                </Link>
              )}

              {(hrData?.pending_confirmations || 0) > 0 && (
                <Link
                  to="/employees?status=PROBATION"
                  className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500 rounded-lg text-white">
                      <UserPlusIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {hrData?.pending_confirmations} Probation Confirmation{hrData!.pending_confirmations > 1 ? 's' : ''} Due
                      </p>
                      <p className="text-xs text-gray-500">Review for confirmation</p>
                    </div>
                  </div>
                  <ArrowRightIcon className="h-5 w-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
                </Link>
              )}

              {payrollData?.pending_runs && payrollData.pending_runs > 0 && (
                <Link
                  to="/admin/payroll"
                  className="flex items-center justify-between p-4 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-500 rounded-lg text-white">
                      <BanknotesIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {payrollData.pending_runs} Payroll Run{payrollData.pending_runs > 1 ? 's' : ''} Pending
                      </p>
                      <p className="text-xs text-gray-500">Ready for processing</p>
                    </div>
                  </div>
                  <ArrowRightIcon className="h-5 w-5 text-primary-600 group-hover:translate-x-1 transition-transform" />
                </Link>
              )}

              {pendingLeave === 0 && (hrData?.pending_confirmations || 0) === 0 && (!payrollData?.pending_runs || payrollData.pending_runs === 0) && (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="p-2 bg-green-500 rounded-lg text-white">
                    <CheckCircleIcon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    All caught up! No pending actions.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer Note */}
      <div className="text-center py-4">
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full text-xs text-gray-500">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Data refreshes automatically every 30 seconds
        </span>
      </div>
    </div>
  )
}
