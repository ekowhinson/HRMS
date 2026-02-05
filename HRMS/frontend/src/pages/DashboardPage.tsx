import { useQuery } from '@tanstack/react-query'
import {
  UsersIcon,
  CalendarIcon,
  BanknotesIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { dashboardService } from '@/services/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { formatCurrency, formatNumber } from '@/lib/utils'

export default function DashboardPage() {
  const { data: stats, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardService.getStats,
  })

  const { data: hrData } = useQuery({
    queryKey: ['hr-dashboard'],
    queryFn: dashboardService.getHRDashboard,
  })

  const statCards = [
    {
      name: 'Total Employees',
      value: stats?.total_employees || 0,
      icon: UsersIcon,
      color: 'bg-blue-500',
      format: formatNumber,
    },
    {
      name: 'New Hires (This Month)',
      value: stats?.new_hires_this_month || 0,
      icon: UsersIcon,
      color: 'bg-green-500',
      format: formatNumber,
    },
    {
      name: 'Pending Leave Requests',
      value: stats?.pending_leave_requests || 0,
      icon: CalendarIcon,
      color: 'bg-yellow-500',
      format: formatNumber,
    },
    {
      name: 'Active Loans',
      value: stats?.active_loans || 0,
      icon: CreditCardIcon,
      color: 'bg-purple-500',
      format: formatNumber,
    },
  ]

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-32" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load dashboard</h2>
        <p className="text-sm text-gray-500 mb-4">
          {(error as any)?.message || 'Unable to connect to the server. Please make sure the backend is running.'}
        </p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome to NHIA Human Resource Management System
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.format(stat.value)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payroll Summary */}
      {stats?.latest_payroll && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BanknotesIcon className="h-5 w-5 mr-2 text-gray-500" />
              Latest Payroll - {stats.latest_payroll.period}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-gray-500">Employees</p>
                <p className="text-xl font-semibold">{formatNumber(stats.latest_payroll.total_employees)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Gross</p>
                <p className="text-xl font-semibold">{formatCurrency(stats.latest_payroll.total_gross)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Net</p>
                <p className="text-xl font-semibold">{formatCurrency(stats.latest_payroll.total_net)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Employees by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {hrData?.employee_by_department?.slice(0, 5).map((dept) => (
                <div key={dept.department_name} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{dept.department_name || 'Unassigned'}</span>
                  <span className="text-sm font-medium text-gray-900">{dept.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employees by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {hrData?.employee_by_status?.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{item.status?.replace(/_/g, ' ') || 'Unknown'}</span>
                  <span className="text-sm font-medium text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>HR Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-primary-600">{hrData?.on_probation || 0}</p>
                <p className="text-sm text-gray-500">On Probation</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">{hrData?.pending_confirmations || 0}</p>
                <p className="text-sm text-gray-500">Pending Confirmation</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gender Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {hrData?.employee_by_gender?.map((g) => (
                <div key={g.gender} className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{g.count}</p>
                  <p className="text-sm text-gray-500">{g.gender}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
