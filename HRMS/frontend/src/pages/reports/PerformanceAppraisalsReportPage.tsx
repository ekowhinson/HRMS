import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { performanceService } from '@/services/performance'
import { reportsService } from '@/services/reports'
import type { ExportFormat } from '@/services/reports'
import type { Appraisal, AppraisalCycle } from '@/services/performance'
import { Card, CardContent } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { StatsCard } from '@/components/ui/StatsCard'
import ExportMenu from '@/components/ui/ExportMenu'
import { useGroupBy } from '@/hooks/useGroupBy'
import GroupableTable from '@/components/reports/GroupableTable'

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  GOAL_SETTING: 'bg-blue-50 text-blue-700',
  GOALS_SUBMITTED: 'bg-blue-100 text-blue-700',
  GOALS_APPROVED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-50 text-yellow-700',
  SELF_ASSESSMENT: 'bg-orange-50 text-orange-700',
  MANAGER_REVIEW: 'bg-purple-50 text-purple-700',
  MEETING: 'bg-indigo-50 text-indigo-700',
  CALIBRATION: 'bg-pink-50 text-pink-700',
  COMPLETED: 'bg-green-50 text-green-700',
  ACKNOWLEDGED: 'bg-green-100 text-green-800',
}

const GROUP_BY_OPTIONS = [
  { value: '', label: 'No Grouping' },
  { value: 'department_name', label: 'Department' },
  { value: 'cycle_name', label: 'Cycle' },
  { value: 'status_display', label: 'Status' },
]

const NUMERIC_KEYS = ['overall_self_rating', 'overall_manager_rating', 'overall_final_rating']

export default function PerformanceAppraisalsReportPage() {
  const [search, setSearch] = useState('')
  const [cycleFilter, setCycleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [groupByField, setGroupByField] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const handleExport = async (format: ExportFormat) => {
    setExporting(true)
    try {
      await reportsService.exportPerformanceAppraisals(
        { cycle: cycleFilter || undefined, status: statusFilter || undefined, search: search || undefined },
        format
      )
    } finally {
      setExporting(false)
    }
  }

  const { data: cyclesData } = useQuery({
    queryKey: ['appraisal-cycles'],
    queryFn: () => performanceService.getAppraisalCycles(),
  })

  const cycles: AppraisalCycle[] = cyclesData || []

  const isGrouped = !!groupByField

  // When grouped, fetch all results
  const { data: appraisalsData, isLoading } = useQuery({
    queryKey: ['appraisals-report', cycleFilter, statusFilter, search, page, isGrouped],
    queryFn: () =>
      performanceService.getAppraisals({
        cycle: cycleFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
        page: isGrouped ? 1 : page,
        page_size: isGrouped ? 1000 : 50,
      }),
  })

  const appraisals: Appraisal[] = appraisalsData?.results || []
  const totalCount: number = appraisalsData?.count || 0

  const completedCount = appraisals.filter((a) => a.status === 'COMPLETED' || a.status === 'ACKNOWLEDGED').length
  const avgRating = appraisals.filter((a) => a.overall_final_rating != null).reduce((sum, a) => sum + (a.overall_final_rating || 0), 0)
  const ratedCount = appraisals.filter((a) => a.overall_final_rating != null).length

  const { groups, grandTotals } = useGroupBy(appraisals as any[], groupByField || null, NUMERIC_KEYS)

  const groupByLabel = GROUP_BY_OPTIONS.find((o) => o.value === groupByField)?.label || ''

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'GOAL_SETTING', label: 'Goal Setting' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'SELF_ASSESSMENT', label: 'Self Assessment' },
    { value: 'MANAGER_REVIEW', label: 'Manager Review' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  ]

  const renderAppraisalRow = (a: any, _idx: number) => (
    <tr key={a.id} className="hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.employee_name}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{a.employee_number}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{a.department_name || '-'}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{a.cycle_name}</td>
      <td className="px-4 py-3 text-sm">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[a.status] || 'bg-gray-100 text-gray-700'}`}>
          {a.status_display}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{a.overall_self_rating != null ? Number(a.overall_self_rating).toFixed(1) : '-'}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{a.overall_manager_rating != null ? Number(a.overall_manager_rating).toFixed(1) : '-'}</td>
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.overall_final_rating != null ? Number(a.overall_final_rating).toFixed(1) : '-'}</td>
    </tr>
  )

  const renderTotalCells = (totals: Record<string, number>) => {
    const count = groups.find(g => g.totals === totals)?.items.length || appraisals.length
    const rCount = groups.find(g => g.totals === totals)?.items.filter((a: any) => a.overall_final_rating != null).length
      || ratedCount
    return (
      <>
        <td className="px-4 py-3 text-sm"></td>
        <td className="px-4 py-3 text-sm"></td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {count > 0 ? `Avg: ${(totals.overall_self_rating / (rCount || 1)).toFixed(1)}` : '-'}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {count > 0 ? `Avg: ${(totals.overall_manager_rating / (rCount || 1)).toFixed(1)}` : '-'}
        </td>
        <td className="px-4 py-3 text-sm font-medium">
          {count > 0 ? `Avg: ${(totals.overall_final_rating / (rCount || 1)).toFixed(1)}` : '-'}
        </td>
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/hr-reports" className="p-2 rounded-md hover:bg-gray-100 transition-colors">
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Performance Appraisals Report</h1>
            <p className="mt-1 text-sm text-gray-500">
              View and filter appraisals by cycle, status, and employee
            </p>
          </div>
        </div>
        <ExportMenu onExport={handleExport} loading={exporting} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Total Appraisals" value={totalCount} variant="primary" />
        <StatsCard title={isGrouped ? 'Completed' : 'Completed (this page)'} value={completedCount} variant="success" />
        <StatsCard
          title="Avg Final Rating"
          value={ratedCount > 0 ? (avgRating / ratedCount).toFixed(1) : 'N/A'}
          variant="info"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by employee name or number..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
              />
            </div>
            <div className="w-56">
              <Select
                label="Appraisal Cycle"
                value={cycleFilter}
                onChange={(e) => {
                  setCycleFilter(e.target.value)
                  setPage(1)
                }}
                options={[
                  { value: '', label: 'All Cycles' },
                  ...cycles.map((c) => ({ value: c.id, label: `${c.name} (${c.year})` })),
                ]}
              />
            </div>
            <div className="w-48">
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
                options={statusOptions}
              />
            </div>
            <div className="w-48">
              <Select
                label="Group By"
                value={groupByField}
                onChange={(e) => {
                  setGroupByField(e.target.value)
                  setPage(1)
                }}
                options={GROUP_BY_OPTIONS}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          {isGrouped ? (
            <GroupableTable<any>
              groups={groups}
              isGrouped={true}
              groupByLabel={groupByLabel}
              totalColumns={8}
              labelColumns={3}
              grandTotals={grandTotals}
              renderHeaderRow={() => (
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cycle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Self Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manager Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Final Rating</th>
                </tr>
              )}
              renderRow={renderAppraisalRow}
              renderTotalCells={renderTotalCells}
              emptyMessage="No appraisals match your filters."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cycle</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Self Rating</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manager Rating</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Final Rating</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {appraisals.map((a, idx) => renderAppraisalRow(a, idx))}
                  </tbody>
                </table>
              </div>
              {appraisals.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  No appraisals match your filters.
                </div>
              )}
              {/* Pagination */}
              {totalCount > 50 && (
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
                  <span className="text-sm text-gray-500">
                    Page {page} of {Math.ceil(totalCount / 50)} ({totalCount} total)
                  </span>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </button>
                    <button
                      className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                      disabled={page >= Math.ceil(totalCount / 50)}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  )
}
