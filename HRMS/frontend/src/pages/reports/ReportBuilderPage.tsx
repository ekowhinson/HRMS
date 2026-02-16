import { useState, useCallback, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowDownTrayIcon,
  BookmarkIcon,
  ClockIcon,
  PlayIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowsUpDownIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'
import {
  PageHeader,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Modal,
  Badge,
  Input,
  EmptyState,
  Skeleton,
  SkeletonTable,
} from '@/components/ui'
import { DropdownButton } from '@/components/ui/Dropdown'
import Table, { TablePagination } from '@/components/ui/Table'
import { BarChartCard } from '@/components/charts/BarChartCard'
import { PieChartCard } from '@/components/charts/PieChartCard'
import { LineChartCard } from '@/components/charts/LineChartCard'
import FilterBuilder from '@/components/reports/FilterBuilder'
import ChartConfigPanel from '@/components/reports/ChartConfigPanel'
import reportBuilderService, {
  type FieldInfo,
  type ReportColumn,
  type ReportFilter,
  type ChartConfig,
  type ReportPreviewResponse,
  type SaveReportRequest,
  type CreateScheduleRequest,
  AGGREGATE_FUNCTIONS,
} from '@/services/reportBuilder'

type ViewMode = 'table' | 'bar' | 'line' | 'pie'

export default function ReportBuilderPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')

  // ==================== Builder state ====================
  const [dataSource, setDataSource] = useState('')
  const [selectedColumns, setSelectedColumns] = useState<ReportColumn[]>([])
  const [filters, setFilters] = useState<ReportFilter[]>([])
  const [groupBy, setGroupBy] = useState<string[]>([])
  const [ordering, setOrdering] = useState<string[]>([])
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Dialogs
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [saveIsPublic, setSaveIsPublic] = useState(false)

  // Schedule state
  const [scheduleType, setScheduleType] = useState<CreateScheduleRequest['schedule_type']>('WEEKLY')
  const [scheduleFormat, setScheduleFormat] = useState<CreateScheduleRequest['export_format']>('EXCEL')

  // Track the saved report id for updates
  const [savedReportId, setSavedReportId] = useState<string | null>(editId)

  // ==================== Queries ====================

  const { data: dataSources = [], isLoading: loadingDataSources } = useQuery({
    queryKey: ['report-builder', 'data-sources'],
    queryFn: () => reportBuilderService.getDataSources(),
  })

  const { data: fields = [], isLoading: loadingFields } = useQuery({
    queryKey: ['report-builder', 'fields', dataSource],
    queryFn: () => reportBuilderService.getFields(dataSource),
    enabled: !!dataSource,
  })

  // Load existing report for editing
  const { data: existingReport } = useQuery({
    queryKey: ['report-builder', 'saved', editId],
    queryFn: () => reportBuilderService.getSavedReport(editId!),
    enabled: !!editId,
  })

  // Populate builder state when an existing report is loaded
  useEffect(() => {
    if (existingReport) {
      setDataSource(existingReport.data_source)
      setSelectedColumns(existingReport.columns)
      setFilters(existingReport.filters)
      setGroupBy(existingReport.group_by)
      setOrdering(existingReport.ordering)
      setChartConfig(existingReport.chart_config)
      setSaveName(existingReport.name)
      setSaveDescription(existingReport.description)
      setSaveIsPublic(existingReport.is_public)
      setSavedReportId(existingReport.id)
      if (existingReport.chart_config) {
        setViewMode(existingReport.chart_config.type as ViewMode)
      }
    }
  }, [existingReport])

  // Preview data
  const canPreview = dataSource && selectedColumns.length > 0
  const previewMutation = useMutation({
    mutationFn: () =>
      reportBuilderService.previewReport({
        data_source: dataSource,
        columns: selectedColumns,
        filters: filters.filter((f) => f.field),
        group_by: groupBy,
        aggregations: [],
        ordering,
        page,
        page_size: pageSize,
      }),
  })

  const previewData: ReportPreviewResponse | undefined = previewMutation.data

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (data: SaveReportRequest) => {
      if (savedReportId) {
        return reportBuilderService.updateSavedReport(savedReportId, data)
      }
      return reportBuilderService.createSavedReport(data)
    },
    onSuccess: (report) => {
      setSavedReportId(report.id)
      setShowSaveDialog(false)
      queryClient.invalidateQueries({ queryKey: ['report-builder', 'saved'] })
    },
  })

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: (format: 'CSV' | 'EXCEL' | 'PDF') =>
      reportBuilderService.exportReport({
        data_source: dataSource,
        columns: selectedColumns,
        filters: filters.filter((f) => f.field),
        group_by: groupBy,
        aggregations: [],
        ordering,
        format,
        report_name: saveName || 'ad_hoc_report',
      }),
  })

  // Schedule mutation
  const scheduleMutation = useMutation({
    mutationFn: (data: CreateScheduleRequest) =>
      reportBuilderService.createSchedule(savedReportId!, data),
    onSuccess: () => {
      setShowScheduleDialog(false)
    },
  })

  // ==================== Handlers ====================

  const handleDataSourceChange = useCallback(
    (newSource: string) => {
      setDataSource(newSource)
      setSelectedColumns([])
      setFilters([])
      setGroupBy([])
      setOrdering([])
      setPage(1)
    },
    []
  )

  const toggleColumn = useCallback(
    (field: FieldInfo) => {
      setSelectedColumns((prev) => {
        const exists = prev.find((c) => c.field === field.path)
        if (exists) {
          return prev.filter((c) => c.field !== field.path)
        }
        return [...prev, { field: field.path, label: field.label, aggregate: null }]
      })
    },
    []
  )

  const removeColumn = useCallback((fieldPath: string) => {
    setSelectedColumns((prev) => prev.filter((c) => c.field !== fieldPath))
  }, [])

  const updateColumnAggregate = useCallback((fieldPath: string, aggregate: string | null) => {
    setSelectedColumns((prev) =>
      prev.map((c) =>
        c.field === fieldPath ? { ...c, aggregate: aggregate || null } : c
      )
    )
  }, [])

  const moveColumn = useCallback((index: number, direction: 'up' | 'down') => {
    setSelectedColumns((prev) => {
      const updated = [...prev]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= updated.length) return prev
      ;[updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]]
      return updated
    })
  }, [])

  const toggleGroupBy = useCallback((fieldPath: string) => {
    setGroupBy((prev) =>
      prev.includes(fieldPath)
        ? prev.filter((f) => f !== fieldPath)
        : [...prev, fieldPath]
    )
  }, [])

  const toggleOrdering = useCallback((fieldPath: string) => {
    setOrdering((prev) => {
      const ascending = fieldPath
      const descending = `-${fieldPath}`
      if (prev.includes(ascending)) {
        return prev.map((o) => (o === ascending ? descending : o))
      }
      if (prev.includes(descending)) {
        return prev.filter((o) => o !== descending)
      }
      return [...prev, ascending]
    })
  }, [])

  const getOrderDirection = useCallback(
    (fieldPath: string): 'asc' | 'desc' | null => {
      if (ordering.includes(fieldPath)) return 'asc'
      if (ordering.includes(`-${fieldPath}`)) return 'desc'
      return null
    },
    [ordering]
  )

  const handlePreview = useCallback(() => {
    setPage(1)
    previewMutation.mutate()
  }, [previewMutation])

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage)
      // Re-run with new page
      previewMutation.mutate()
    },
    [previewMutation]
  )

  const handleSave = useCallback(() => {
    saveMutation.mutate({
      name: saveName,
      description: saveDescription,
      data_source: dataSource,
      columns: selectedColumns,
      filters: filters.filter((f) => f.field),
      group_by: groupBy,
      aggregations: [],
      ordering,
      chart_config: chartConfig,
      is_public: saveIsPublic,
    })
  }, [
    saveMutation, saveName, saveDescription, dataSource,
    selectedColumns, filters, groupBy, ordering, chartConfig, saveIsPublic,
  ])

  const handleSchedule = useCallback(() => {
    scheduleMutation.mutate({
      schedule_type: scheduleType,
      schedule_config: {},
      export_format: scheduleFormat,
      is_active: true,
    })
  }, [scheduleMutation, scheduleType, scheduleFormat])

  // ==================== Grouped fields for sidebar ====================

  const groupedFields = useMemo(() => {
    const groups: Record<string, FieldInfo[]> = {}
    fields.forEach((field) => {
      const parts = field.label.split(' > ')
      const groupLabel = parts.length > 1 ? parts[0] : 'General'
      if (!groups[groupLabel]) groups[groupLabel] = []
      groups[groupLabel].push(field)
    })
    return groups
  }, [fields])

  const selectedFieldPaths = useMemo(
    () => new Set(selectedColumns.map((c) => c.field)),
    [selectedColumns]
  )

  // ==================== Table columns for preview ====================

  const tableColumns = useMemo(() => {
    if (!previewData?.columns) return []
    return previewData.columns.map((col) => ({
      key: col.key,
      header: col.label,
      render: (row: Record<string, any>) => {
        const val = row[col.key]
        if (val === null || val === undefined) return <span className="text-gray-400">--</span>
        if (typeof val === 'boolean') return val ? 'Yes' : 'No'
        return String(val)
      },
    }))
  }, [previewData])

  // ==================== Chart data transformation ====================

  const chartData = useMemo(() => {
    if (!previewData?.data || !chartConfig) return []
    return previewData.data.map((row) => ({
      name: String(row[chartConfig.x_axis] ?? ''),
      value: Number(row[chartConfig.y_axis]) || 0,
    }))
  }, [previewData, chartConfig])

  // ==================== Render ====================

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Report Builder"
        subtitle="Create custom ad-hoc reports from your HRMS data"
        breadcrumbs={[
          { label: 'Reports', href: '/reports' },
          { label: 'Builder' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/reports/saved')}
            >
              Saved Reports
            </Button>
            {savedReportId && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<ClockIcon className="w-4 h-4" />}
                onClick={() => setShowScheduleDialog(true)}
              >
                Schedule
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<BookmarkIcon className="w-4 h-4" />}
              onClick={() => setShowSaveDialog(true)}
              disabled={!canPreview}
            >
              Save
            </Button>
            <DropdownButton
              buttonText="Export"
              buttonIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
              items={[
                {
                  label: 'Export as CSV',
                  onClick: () => exportMutation.mutate('CSV'),
                  disabled: !canPreview,
                },
                {
                  label: 'Export as Excel',
                  onClick: () => exportMutation.mutate('EXCEL'),
                  disabled: !canPreview,
                },
                {
                  label: 'Export as PDF',
                  onClick: () => exportMutation.mutate('PDF'),
                  disabled: !canPreview,
                },
              ]}
            />
          </div>
        }
      />

      {/* Data source selector */}
      <div className="mb-6">
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 flex-shrink-0">
                Data Source
              </label>
              {loadingDataSources ? (
                <Skeleton width={300} height={38} />
              ) : (
                <select
                  value={dataSource}
                  onChange={(e) => handleDataSourceChange(e.target.value)}
                  className="block w-full max-w-md rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:border-[#0969da] focus:outline-none focus:ring-1 focus:ring-[#0969da] hover:border-gray-400"
                >
                  <option value="">Select a data source...</option>
                  {dataSources.map((ds) => (
                    <option key={ds.key} value={ds.key}>
                      {ds.label} ({ds.field_count} fields)
                    </option>
                  ))}
                </select>
              )}
              {dataSource && (
                <p className="text-xs text-gray-500 flex-shrink-0">
                  {dataSources.find((ds) => ds.key === dataSource)?.description}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {!dataSource ? (
        <EmptyState
          type="data"
          title="Select a data source"
          description="Choose a data source above to start building your report. You can select fields, add filters, and configure charts."
        />
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* Left sidebar: fields & chart config */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            {/* Available fields */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Available Fields</CardTitle>
              </CardHeader>
              <div className="max-h-[400px] overflow-y-auto px-4 pb-4">
                {loadingFields ? (
                  <div className="space-y-2 py-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} height={20} />
                    ))}
                  </div>
                ) : (
                  Object.entries(groupedFields).map(([group, groupFields]) => (
                    <div key={group} className="mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        {group}
                      </p>
                      <div className="space-y-0.5">
                        {groupFields.map((field) => (
                          <label
                            key={field.path}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={selectedFieldPaths.has(field.path)}
                              onChange={() => toggleColumn(field)}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                            />
                            <span className="text-gray-700 truncate">{field.label}</span>
                            <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">
                              {field.type}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Chart config */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Chart Config</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4 px-4">
                <ChartConfigPanel
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  chartConfig={chartConfig}
                  onChartConfigChange={setChartConfig}
                  columns={selectedColumns}
                />
              </CardContent>
            </Card>
          </div>

          {/* Main content area */}
          <div className="col-span-12 lg:col-span-9 space-y-4">
            {/* Selected columns */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    Selected Columns
                    {selectedColumns.length > 0 && (
                      <Badge variant="info" size="xs" className="ml-2">
                        {selectedColumns.length}
                      </Badge>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-4 px-4">
                {selectedColumns.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">
                    Check fields from the left panel to add them as columns.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {selectedColumns.map((col, index) => (
                      <div
                        key={col.field}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md group"
                      >
                        {/* Reorder buttons */}
                        <div className="flex flex-col -space-y-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => moveColumn(index, 'up')}
                            disabled={index === 0}
                            className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <ChevronUpIcon className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveColumn(index, 'down')}
                            disabled={index === selectedColumns.length - 1}
                            className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <ChevronDownIcon className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="text-sm text-gray-700 flex-1 truncate">
                          {col.label}
                        </span>

                        {/* Aggregate selector */}
                        <select
                          value={col.aggregate || ''}
                          onChange={(e) => updateColumnAggregate(col.field, e.target.value)}
                          className="text-xs rounded border border-gray-300 bg-gray-50 px-2 py-1 focus:bg-white focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] hover:border-gray-400"
                        >
                          {AGGREGATE_FUNCTIONS.map((fn) => (
                            <option key={fn.value} value={fn.value}>
                              {fn.label}
                            </option>
                          ))}
                        </select>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeColumn(col.field)}
                          className="flex-shrink-0 p-1 text-gray-400 hover:text-danger-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Filters */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">
                  Filters
                  {filters.length > 0 && (
                    <Badge variant="warning" size="xs" className="ml-2">
                      {filters.filter((f) => f.field).length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4 px-4">
                <FilterBuilder
                  filters={filters}
                  fields={fields}
                  onChange={setFilters}
                />
              </CardContent>
            </Card>

            {/* Group By & Sort By */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Group By */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Group By</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4 px-4">
                  {selectedColumns.length === 0 ? (
                    <p className="text-xs text-gray-400">Select columns first.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedColumns.map((col) => {
                        const isGrouped = groupBy.includes(col.field)
                        return (
                          <button
                            key={col.field}
                            type="button"
                            onClick={() => toggleGroupBy(col.field)}
                            className={cn(
                              'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                              isGrouped
                                ? 'bg-primary-50 text-primary-700 border-primary-200'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            )}
                          >
                            {col.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sort By */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Sort By</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4 px-4">
                  {selectedColumns.length === 0 ? (
                    <p className="text-xs text-gray-400">Select columns first.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedColumns.map((col) => {
                        const direction = getOrderDirection(col.field)
                        return (
                          <button
                            key={col.field}
                            type="button"
                            onClick={() => toggleOrdering(col.field)}
                            className={cn(
                              'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                              direction
                                ? 'bg-primary-50 text-primary-700 border-primary-200'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            )}
                          >
                            {col.label}
                            {direction === 'asc' && <ChevronUpIcon className="w-3 h-3" />}
                            {direction === 'desc' && <ChevronDownIcon className="w-3 h-3" />}
                            {!direction && <ArrowsUpDownIcon className="w-3 h-3 opacity-40" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Run Preview button */}
            <div className="flex justify-end">
              <Button
                variant="primary"
                leftIcon={<PlayIcon className="w-4 h-4" />}
                onClick={handlePreview}
                disabled={!canPreview}
                isLoading={previewMutation.isPending}
              >
                Run Preview
              </Button>
            </div>

            {/* Results Preview */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    Results
                    {previewData && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        {previewData.total.toLocaleString()} records
                      </span>
                    )}
                  </CardTitle>
                  {exportMutation.isPending && (
                    <span className="text-xs text-gray-500">Exporting...</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-2 px-0">
                {previewMutation.isPending ? (
                  <div className="px-4">
                    <SkeletonTable columns={4} />
                  </div>
                ) : previewMutation.isError ? (
                  <div className="px-4">
                    <EmptyState
                      type="error"
                      title="Failed to load preview"
                      description="There was an error running this report. Please check your configuration and try again."
                      action={{ label: 'Retry', onClick: handlePreview }}
                      compact
                    />
                  </div>
                ) : !previewData ? (
                  <EmptyState
                    type="data"
                    title="No preview yet"
                    description="Configure your report above and click 'Run Preview' to see results."
                    compact
                  />
                ) : previewData.data.length === 0 ? (
                  <EmptyState
                    type="search"
                    title="No matching records"
                    description="Try adjusting your filters or selecting different columns."
                    compact
                  />
                ) : viewMode === 'table' ? (
                  <>
                    <div className="overflow-x-auto">
                      <Table
                        data={previewData.data}
                        columns={tableColumns}
                        striped
      
                      />
                    </div>
                    <div className="px-4 mt-2">
                      <TablePagination
                        currentPage={page}
                        totalPages={Math.ceil(previewData.total / pageSize)}
                        totalItems={previewData.total}
                        pageSize={pageSize}
                        onPageChange={handlePageChange}
                        onPageSizeChange={(size) => {
                          setPageSize(size)
                          setPage(1)
                          previewMutation.mutate()
                        }}
                      />
                    </div>
                  </>
                ) : viewMode === 'bar' && chartConfig ? (
                  <div className="px-4">
                    <BarChartCard
                      title=""
                      data={chartData}
                      height={350}
                    />
                  </div>
                ) : viewMode === 'pie' && chartConfig ? (
                  <div className="px-4">
                    <PieChartCard
                      title=""
                      data={chartData}
                      height={350}
                    />
                  </div>
                ) : viewMode === 'line' && chartConfig ? (
                  <div className="px-4">
                    <LineChartCard
                      title=""
                      data={chartData.map((d) => ({ name: d.name, value: d.value }))}
                      lines={[{ dataKey: 'value', name: chartConfig.y_axis, color: '#4f46e5' }]}
                      height={350}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Save Dialog */}
      <Modal
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        title={savedReportId ? 'Update Report' : 'Save Report'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Report Name"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="e.g. Monthly Headcount by Department"
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={saveDescription}
              onChange={(e) => setSaveDescription(e.target.value)}
              placeholder="Describe what this report shows..."
              rows={3}
              className="block w-full rounded-md border border-gray-300 bg-gray-50 px-4 py-3 text-sm placeholder-gray-400 focus:bg-white focus:border-[#0969da] focus:outline-none focus:ring-1 focus:ring-[#0969da] hover:border-gray-400"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveIsPublic}
              onChange={(e) => setSaveIsPublic(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
            />
            <span className="text-sm text-gray-700">Make this report visible to all users</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={saveMutation.isPending}
              disabled={!saveName.trim()}
            >
              {savedReportId ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Schedule Dialog */}
      <Modal
        isOpen={showScheduleDialog}
        onClose={() => setShowScheduleDialog(false)}
        title="Schedule Report"
        description="Set up automated report delivery"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value as CreateScheduleRequest['schedule_type'])}
              className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:border-[#0969da] focus:outline-none focus:ring-1 focus:ring-[#0969da] hover:border-gray-400"
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Export Format</label>
            <select
              value={scheduleFormat}
              onChange={(e) => setScheduleFormat(e.target.value as CreateScheduleRequest['export_format'])}
              className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:border-[#0969da] focus:outline-none focus:ring-1 focus:ring-[#0969da] hover:border-gray-400"
            >
              <option value="CSV">CSV</option>
              <option value="EXCEL">Excel</option>
              <option value="PDF">PDF</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowScheduleDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSchedule}
              isLoading={scheduleMutation.isPending}
            >
              Create Schedule
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
