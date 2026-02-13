import { useQuery } from '@tanstack/react-query'
import {
  AcademicCapIcon,
  CalendarIcon,
  UsersIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { trainingService } from '@/services/training'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import { StatsCard } from '@/components/ui/StatsCard'

const categoryLabels: Record<string, string> = {
  TECHNICAL: 'Technical',
  LEADERSHIP: 'Leadership',
  COMPLIANCE: 'Compliance',
  SOFT_SKILLS: 'Soft Skills',
  ONBOARDING: 'Onboarding',
  OTHER: 'Other',
}

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  SCHEDULED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
}

export default function TrainingDashboardPage() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['training-dashboard'],
    queryFn: trainingService.getDashboard,
  })

  const upcomingColumns = [
    {
      key: 'title',
      header: 'Session',
      render: (row: any) => (
        <div>
          <p className="font-medium text-gray-900">{row.title}</p>
          <p className="text-xs text-gray-500">{row.program_name}</p>
        </div>
      ),
    },
    {
      key: 'facilitator',
      header: 'Facilitator',
      render: (row: any) => row.facilitator || '-',
    },
    {
      key: 'venue',
      header: 'Venue',
      render: (row: any) => row.venue || '-',
    },
    {
      key: 'start_date',
      header: 'Date',
      render: (row: any) => (
        <span className="text-sm">
          {new Date(row.start_date).toLocaleDateString()}
          {row.end_date !== row.start_date && ` - ${new Date(row.end_date).toLocaleDateString()}`}
        </span>
      ),
    },
    {
      key: 'enrollment_count',
      header: 'Enrolled',
      render: (row: any) => (
        <span className="text-sm">
          {row.enrollment_count}{row.capacity ? `/${row.capacity}` : ''}
        </span>
      ),
    },
  ]

  const recentColumns = [
    {
      key: 'title',
      header: 'Session',
      render: (row: any) => (
        <div>
          <p className="font-medium text-gray-900">{row.title}</p>
          <p className="text-xs text-gray-500">{row.program_name}</p>
        </div>
      ),
    },
    {
      key: 'end_date',
      header: 'Completed',
      render: (row: any) => new Date(row.end_date).toLocaleDateString(),
    },
    {
      key: 'enrollment_count',
      header: 'Participants',
      render: (row: any) => row.enrollment_count,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: any) => (
        <Badge variant={statusColors[row.status] || 'default'}>
          {row.status_display}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Training Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of training & development activities</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Active Programs"
          value={dashboard?.total_programs ?? 0}
          icon={<AcademicCapIcon className="h-6 w-6" />}
          variant="primary"
        />
        <StatsCard
          title="Active Sessions"
          value={dashboard?.active_sessions ?? 0}
          icon={<CalendarIcon className="h-6 w-6" />}
          variant="info"
        />
        <StatsCard
          title="Total Enrolled"
          value={dashboard?.total_enrolled ?? 0}
          icon={<UsersIcon className="h-6 w-6" />}
          variant="warning"
        />
        <StatsCard
          title="Completion Rate"
          value={`${dashboard?.completion_rate ?? 0}%`}
          icon={<CheckCircleIcon className="h-6 w-6" />}
          variant="success"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Programs by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Programs by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(dashboard?.by_category || []).map((item) => (
                  <div key={item.category} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {categoryLabels[item.category] || item.category}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{item.count}</span>
                  </div>
                ))}
                {(dashboard?.by_category || []).length === 0 && (
                  <p className="text-sm text-gray-400">No programs yet</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Training Programs */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top Training Programs</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(dashboard?.top_programs || []).map((prog, idx) => (
                  <div key={prog.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{prog.name}</p>
                        <p className="text-xs text-gray-500">{prog.code} - {categoryLabels[prog.category] || prog.category}</p>
                      </div>
                    </div>
                    <Badge variant="info">{prog.total_enrolled} enrolled</Badge>
                  </div>
                ))}
                {(dashboard?.top_programs || []).length === 0 && (
                  <p className="text-sm text-gray-400">No enrollment data yet</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Sessions (Next 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table
            columns={upcomingColumns}
            data={dashboard?.upcoming_sessions || []}
            isLoading={isLoading}
            emptyMessage="No upcoming sessions"
          />
        </CardContent>
      </Card>

      {/* Recent Completions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Completions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table
            columns={recentColumns}
            data={dashboard?.recent_completions || []}
            isLoading={isLoading}
            emptyMessage="No recent completions"
          />
        </CardContent>
      </Card>

      {/* Staff Trained by Department */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Trained by Department</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trained</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completion %</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(dashboard?.staff_trained_by_department || []).map((dept: any) => (
                  <tr key={dept.department} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{dept.department}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{dept.total_staff}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{dept.trained_count}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[120px]">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${dept.percentage}%` }}
                          />
                        </div>
                        <span className="text-gray-700 font-medium">{dept.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(dashboard?.staff_trained_by_department || []).length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-500">No department training data available</div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Total Estimated Cost</span>
                <span className="text-sm font-semibold text-gray-900">
                  GHS {(dashboard?.cost_analysis?.total_estimated_cost || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Avg. Cost per Employee</span>
                <span className="text-sm font-semibold text-gray-900">
                  GHS {(dashboard?.cost_analysis?.avg_cost_per_employee || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">Total Actual Cost</span>
                <span className="text-sm font-semibold text-gray-900">
                  GHS {(dashboard?.cost_analysis?.total_actual_cost || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Training Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Training Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(dashboard?.training_type_distribution || []).map((item: any) => {
                const total = (dashboard?.training_type_distribution || []).reduce((s: number, i: any) => s + i.count, 0)
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
                const colors: Record<string, string> = {
                  INTERNAL: 'bg-blue-500',
                  EXTERNAL: 'bg-purple-500',
                  ONLINE: 'bg-green-500',
                  BLENDED: 'bg-yellow-500',
                }
                return (
                  <div key={item.training_type} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${colors[item.training_type] || 'bg-gray-400'}`} />
                    <span className="text-sm text-gray-600 flex-1">{item.training_type_display || item.training_type}</span>
                    <span className="text-sm font-medium text-gray-900">{item.count}</span>
                    <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                  </div>
                )
              })}
              {(dashboard?.training_type_distribution || []).length === 0 && (
                <p className="text-sm text-gray-400">No training type data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Completion Rate by Department */}
      <Card>
        <CardHeader>
          <CardTitle>Completion Rate by Department</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(dashboard?.completion_rate_by_department || []).map((dept: any) => (
              <div key={dept.department} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-40 truncate" title={dept.department}>{dept.department}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-blue-500 h-4 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(dept.completion_rate, 5)}%` }}
                  >
                    {dept.completion_rate >= 15 && (
                      <span className="text-[10px] font-medium text-white">{dept.completion_rate}%</span>
                    )}
                  </div>
                </div>
                {dept.completion_rate < 15 && (
                  <span className="text-xs text-gray-500">{dept.completion_rate}%</span>
                )}
              </div>
            ))}
            {(dashboard?.completion_rate_by_department || []).length === 0 && (
              <p className="text-sm text-gray-400">No department completion data available</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
