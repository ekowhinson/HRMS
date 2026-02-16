import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowDownTrayIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  TableCellsIcon,
  ChartBarIcon,
  ChartPieIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'
import {
  PageHeader,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  EmptyState,
} from '@/components/ui'
import { DropdownButton } from '@/components/ui/Dropdown'
import Table, { TablePagination } from '@/components/ui/Table'
import { SkeletonTable, SkeletonCard } from '@/components/ui/Skeleton'
import { BarChartCard } from '@/components/charts/BarChartCard'
import { PieChartCard } from '@/components/charts/PieChartCard'
import { LineChartCard } from '@/components/charts/LineChartCard'
import reportBuilderService, {
  type ReportDefinition,
  type ReportPreviewResponse,
} from '@/services/reportBuilder'

// Custom line chart icon
function LineChartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 17l4-4 4 4 4-8 6 4"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18" />
    </svg>
  )
}

type ViewMode = 'table' | 'bar' | 'line' | 'pie'

export default function ReportViewerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  // ==================== Load report definition ====================

  const {
    data: report,
    isLoading: loadingReport,
    isError: reportError,
  } = useQuery<ReportDefinition>({
    queryKey: ['report-builder', 'saved', id],
    queryFn: () => reportBuilderService.getSavedReport(id!),
    enabled: !!id,
  })

  // Set initial view mode from chart config
  useEffect(() => {
    if (report?.chart_config?.type) {
      setViewMode(report.chart_config.type as ViewMode)
    }
  }, [report])

  // ==================== Execute report ====================

  const executeMutation = useMutation({
    mutationFn: ({ reportId, pg, ps }: { reportId: string; pg: number; ps: number }) =>
      reportBuilderService.executeSavedReport(reportId, pg, ps),
  })

  // Auto-execute on load
  useEffect(() => {
    if (id && report) {
      executeMutation.mutate({ reportId: id, pg: page, ps: pageSize })
    }
    // Only trigger on initial load and page changes, not on every report change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, page, pageSize])

  const resultData: ReportPreviewResponse | undefined = executeMutation.data

  // ==================== Export ====================

  const exportMutation = useMutation({
    mutationFn: (format: 'CSV' | 'EXCEL' | 'PDF') => {
      if (!report) throw new Error('No report loaded')
      return reportBuilderService.exportReport({
        data_source: report.data_source,
        columns: report.columns,
        filters: report.filters,
        group_by: report.group_by,
        aggregations: report.aggregations,
        ordering: report.ordering,
        format,
        report_name: report.name,
      })
    },
  })

  // ==================== Table columns ====================

  const tableColumns = useMemo(() => {
    if (!resultData?.columns) return []
    return resultData.columns.map((col) => ({
      key: col.key,
      header: col.label,
      sortable: true,
      render: (row: Record<string, any>) => {
        const val = row[col.key]
        if (val === null || val === undefined) return <span className="text-gray-400">--</span>
        if (typeof val === 'boolean') return val ? 'Yes' : 'No'
        if (typeof val === 'number') return val.toLocaleString()
        return String(val)
      },
    }))
  }, [resultData])

  // ==================== Chart data ====================

  const chartConfig = report?.chart_config
  const chartData = useMemo(() => {
    if (!resultData?.data || !chartConfig) return []
    return resultData.data.map((row) => ({
      name: String(row[chartConfig.x_axis] ?? ''),
      value: Number(row[chartConfig.y_axis]) || 0,
    }))
  }, [resultData, chartConfig])

  // ==================== Helpers ====================

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleRefresh = () => {
    if (id) {
      executeMutation.mutate({ reportId: id, pg: page, ps: pageSize })
    }
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const totalPages = resultData ? Math.ceil(resultData.total / pageSize) : 0

  // ==================== Loading state ====================

  if (loadingReport) {
    return (
      <div className="min-h-screen">
        <div className="mb-6 space-y-3">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-96 bg-gray-100 rounded animate-pulse" />
        </div>
        <SkeletonCard />
      </div>
    )
  }

  if (reportError || !report) {
    return (
      <div className="min-h-screen">
        <EmptyState
          type="error"
          title="Report not found"
          description="The report you are looking for does not exist or you do not have permission to view it."
          action={{
            label: 'Back to Reports',
            onClick: () => navigate('/reports/saved'),
          }}
        />
      </div>
    )
  }

  // ==================== Render ====================

  return (
    <div className="min-h-screen">
      <PageHeader
        title={report.name}
        subtitle={report.description || `Data source: ${report.data_source}`}
        breadcrumbs={[
          { label: 'Reports', href: '/reports' },
          { label: 'Saved Reports', href: '/reports/saved' },
          { label: report.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowPathIcon className="w-4 h-4" />}
              onClick={handleRefresh}
              isLoading={executeMutation.isPending}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<PencilSquareIcon className="w-4 h-4" />}
              onClick={() => navigate(`/reports/builder?edit=${report.id}`)}
            >
              Edit in Builder
            </Button>
            <DropdownButton
              buttonText="Export"
              buttonIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
              items={[
                {
                  label: 'Export as CSV',
                  onClick: () => exportMutation.mutate('CSV'),
                },
                {
                  label: 'Export as Excel',
                  onClick: () => exportMutation.mutate('EXCEL'),
                },
                {
                  label: 'Export as PDF',
                  onClick: () => exportMutation.mutate('PDF'),
                },
              ]}
            />
          </div>
        }
      />

      {/* Report metadata */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge variant="info" size="sm">
          {report.columns.length} columns
        </Badge>
        {report.filters.length > 0 && (
          <Badge variant="warning" size="sm">
            {report.filters.length} filter{report.filters.length !== 1 ? 's' : ''}
          </Badge>
        )}
        {report.group_by.length > 0 && (
          <Badge variant="default" size="sm">
            Grouped by {report.group_by.length} field{report.group_by.length !== 1 ? 's' : ''}
          </Badge>
        )}
        {report.is_public && (
          <Badge variant="success" size="sm">
            Public
          </Badge>
        )}
        <span className="text-xs text-gray-500">
          Last run: {formatDate(report.last_run_at)} | Total runs: {report.run_count}
        </span>
      </div>

      {/* View mode toggle */}
      {chartConfig && (
        <div className="mb-4 flex gap-1 bg-gray-100 p-1 rounded-md w-fit">
          {(
            [
              { value: 'table', label: 'Table', icon: <TableCellsIcon className="w-4 h-4" /> },
              { value: 'bar', label: 'Bar', icon: <ChartBarIcon className="w-4 h-4" /> },
              { value: 'line', label: 'Line', icon: <LineChartIcon className="w-4 h-4" /> },
              { value: 'pie', label: 'Pie', icon: <ChartPieIcon className="w-4 h-4" /> },
            ] as { value: ViewMode; label: string; icon: React.ReactNode }[]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setViewMode(opt.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === opt.value
                  ? 'bg-white text-primary-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Results
              {resultData && (
                <span className="ml-2 text-xs font-normal text-gray-500">
                  {resultData.total.toLocaleString()} records
                </span>
              )}
            </CardTitle>
            {exportMutation.isPending && (
              <span className="text-xs text-gray-500">Exporting...</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-2 px-0">
          {executeMutation.isPending && !resultData ? (
            <div className="px-4">
              <SkeletonTable columns={Math.min(report.columns.length, 6)} />
            </div>
          ) : executeMutation.isError ? (
            <div className="px-4">
              <EmptyState
                type="error"
                title="Failed to execute report"
                description="There was an error running this report. Please try again."
                action={{ label: 'Retry', onClick: handleRefresh }}
                compact
              />
            </div>
          ) : !resultData || resultData.data.length === 0 ? (
            <EmptyState
              type="search"
              title="No records found"
              description="This report returned no data. Try adjusting the filters in the builder."
              compact
            />
          ) : viewMode === 'table' ? (
            <>
              <div className="overflow-x-auto">
                <Table
                  data={resultData.data}
                  columns={tableColumns}
                  striped
                  stickyHeader

                />
              </div>
              {totalPages > 1 && (
                <div className="px-4 mt-2">
                  <TablePagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={resultData.total}
                    pageSize={pageSize}
                    onPageChange={handlePageChange}
                    onPageSizeChange={(size) => {
                      setPageSize(size)
                      setPage(1)
                    }}
                    pageSizeOptions={[25, 50, 100, 200]}
                  />
                </div>
              )}
            </>
          ) : viewMode === 'bar' && chartConfig ? (
            <div className="px-4 pb-4">
              <BarChartCard
                title=""
                data={chartData}
                height={400}
              />
            </div>
          ) : viewMode === 'pie' && chartConfig ? (
            <div className="px-4 pb-4">
              <PieChartCard
                title=""
                data={chartData}
                height={400}
              />
            </div>
          ) : viewMode === 'line' && chartConfig ? (
            <div className="px-4 pb-4">
              <LineChartCard
                title=""
                data={chartData.map((d) => ({ name: d.name, value: d.value }))}
                lines={[
                  { dataKey: 'value', name: chartConfig.y_axis, color: '#4f46e5' },
                ]}
                height={400}
              />
            </div>
          ) : (
            // Fallback to table if no chart config but chart view selected
            <>
              <div className="overflow-x-auto">
                <Table
                  data={resultData.data}
                  columns={tableColumns}
                  striped
                  stickyHeader

                />
              </div>
              {totalPages > 1 && (
                <div className="px-4 mt-2">
                  <TablePagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={resultData.total}
                    pageSize={pageSize}
                    onPageChange={handlePageChange}
                    onPageSizeChange={(size) => {
                      setPageSize(size)
                      setPage(1)
                    }}
                    pageSizeOptions={[25, 50, 100, 200]}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
