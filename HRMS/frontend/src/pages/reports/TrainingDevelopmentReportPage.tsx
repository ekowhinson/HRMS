import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { trainingService } from '@/services/training'
import { reportsService } from '@/services/reports'
import type { ExportFormat } from '@/services/reports'
import {
  Card,
  StatsCard,
  PageHeader,
  EmptyState,
  SkeletonStatsCard,
  SkeletonTable,
} from '@/components/ui'
import ExportMenu from '@/components/ui/ExportMenu'
import type { TrainingProgram, TrainingSession, TrainingDashboardData } from '@/types'

export default function TrainingDevelopmentReportPage() {
  const [exporting, setExporting] = useState(false)

  const handleExport = async (format: ExportFormat) => {
    setExporting(true)
    try {
      await reportsService.exportTraining(undefined, format)
    } finally {
      setExporting(false)
    }
  }

  const { data: dashboard, isLoading: loadingDashboard } = useQuery({
    queryKey: ['training-dashboard-report'],
    queryFn: () => trainingService.getDashboard(),
  })

  const { data: programsData, isLoading: loadingPrograms } = useQuery({
    queryKey: ['training-programs-report'],
    queryFn: () => trainingService.getPrograms({ page_size: 50 }),
  })

  const { data: sessionsData, isLoading: loadingSessions } = useQuery({
    queryKey: ['training-sessions-report'],
    queryFn: () => trainingService.getSessions({ page_size: 50 }),
  })

  const isLoading = loadingDashboard || loadingPrograms || loadingSessions

  const dash: TrainingDashboardData | undefined = dashboard
  const programs: TrainingProgram[] = programsData?.results || []
  const sessions: TrainingSession[] = sessionsData?.results || []

  const statusColors: Record<string, string> = {
    SCHEDULED: 'bg-blue-50 text-blue-700',
    IN_PROGRESS: 'bg-yellow-50 text-yellow-700',
    COMPLETED: 'bg-green-50 text-green-700',
    CANCELLED: 'bg-red-50 text-red-700',
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training & Development Report"
        subtitle="Overview of training programs, sessions, and completion metrics"
        breadcrumbs={[
          { label: 'HR Reports', href: '/hr-reports' },
          { label: 'Training & Development Report' },
        ]}
        actions={<ExportMenu onExport={handleExport} loading={exporting} />}
      />

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonStatsCard key={i} />
            ))}
          </div>
          <SkeletonTable rows={5} columns={8} />
          <SkeletonTable rows={5} columns={9} />
          <SkeletonTable rows={5} columns={5} />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="Total Programs" value={dash?.total_programs ?? programs.length} variant="primary" />
            <StatsCard title="Active Sessions" value={dash?.active_sessions ?? 0} variant="info" />
            <StatsCard title="Total Enrolled" value={dash?.total_enrolled ?? 0} variant="default" />
            <StatsCard
              title="Completion Rate"
              value={dash?.completion_rate != null ? `${Number(dash.completion_rate).toFixed(0)}%` : 'N/A'}
              variant="success"
            />
          </div>

          {/* Programs Table */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Training Programs</h2>
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration (hrs)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mandatory</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sessions</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enrolled</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {programs.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.code}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{p.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{p.category_display || p.category || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{p.type_display || p.training_type || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{p.duration_hours || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{p.is_mandatory ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{p.session_count ?? 0}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{p.enrolled_count ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {programs.length === 0 && (
                <EmptyState
                  type="data"
                  title="No training programs"
                  description="No training programs found."
                  compact
                />
              )}
            </Card>
          </div>

          {/* Sessions Table */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Training Sessions</h2>
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facilitator</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Venue</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enrolled</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.title}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{s.program_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{s.facilitator || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{s.venue || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{s.start_date || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{s.end_date || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[s.status] || 'bg-gray-100 text-gray-700'}`}>
                            {s.status_display || s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{s.max_participants ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{s.enrollment_count ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sessions.length === 0 && (
                <EmptyState
                  type="data"
                  title="No training sessions"
                  description="No training sessions found."
                  compact
                />
              )}
            </Card>
          </div>

          {/* Department Training Summary */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Department Training Summary</h2>
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Staff</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trained</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completion %</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Cost/Employee</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(dash?.staff_trained_by_department || []).map((dept: any) => (
                      <tr key={dept.department} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{dept.department}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{dept.total_staff}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{dept.trained_count}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            dept.percentage >= 75 ? 'bg-green-50 text-green-700' :
                            dept.percentage >= 50 ? 'bg-yellow-50 text-yellow-700' :
                            'bg-red-50 text-red-700'
                          }`}>
                            {dept.percentage}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          GHS {(dept.avg_cost || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(dash?.staff_trained_by_department || []).length === 0 && (
                <EmptyState
                  type="data"
                  title="No department training data"
                  description="No department training data available."
                  compact
                />
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
