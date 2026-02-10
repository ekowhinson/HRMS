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
    </div>
  )
}
