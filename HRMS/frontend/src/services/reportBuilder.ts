import api from '@/lib/api'

// ==================== Types ====================

export interface DataSource {
  key: string
  label: string
  description: string
  field_count: number
}

export interface FieldInfo {
  path: string
  type: 'string' | 'number' | 'date' | 'boolean' | 'choice'
  label: string
  choices: { value: string; label: string }[] | null
  is_relation: boolean
  related_model: string | null
}

export interface ReportColumn {
  field: string
  label: string
  aggregate: string | null
}

export interface ReportFilter {
  field: string
  operator: string
  value: any
}

export interface ReportAggregation {
  field: string
  function: string
  label: string
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie'
  x_axis: string
  y_axis: string
}

export interface ReportDefinition {
  id: string
  name: string
  description: string
  data_source: string
  columns: ReportColumn[]
  filters: ReportFilter[]
  group_by: string[]
  aggregations: ReportAggregation[]
  ordering: string[]
  chart_config: ChartConfig | null
  is_public: boolean
  last_run_at: string | null
  run_count: number
  created_at: string
}

export interface ReportPreviewRequest {
  data_source: string
  columns: ReportColumn[]
  filters: ReportFilter[]
  group_by: string[]
  aggregations: ReportAggregation[]
  ordering: string[]
  page?: number
  page_size?: number
}

export interface ReportPreviewResponse {
  data: Record<string, any>[]
  total: number
  columns: { key: string; label: string }[]
}

export interface ReportExportRequest extends Omit<ReportPreviewRequest, 'page' | 'page_size'> {
  format: 'CSV' | 'EXCEL' | 'PDF'
  report_name?: string
}

export interface SaveReportRequest {
  name: string
  description: string
  data_source: string
  columns: ReportColumn[]
  filters: ReportFilter[]
  group_by: string[]
  aggregations: ReportAggregation[]
  ordering: string[]
  chart_config: ChartConfig | null
  is_public: boolean
}

export interface ScheduledReport {
  id: string
  report: string
  schedule_type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'
  schedule_config: Record<string, any>
  export_format: 'CSV' | 'EXCEL' | 'PDF'
  is_active: boolean
  last_run_at: string | null
  next_run_at: string | null
}

export interface CreateScheduleRequest {
  schedule_type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'
  schedule_config: Record<string, any>
  export_format: 'CSV' | 'EXCEL' | 'PDF'
  is_active: boolean
}

export type ExportFormat = 'CSV' | 'EXCEL' | 'PDF'

// ==================== Operator mappings ====================

export const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  string: [
    { value: '=', label: 'Equals' },
    { value: '!=', label: 'Not equals' },
    { value: 'LIKE', label: 'Contains' },
    { value: 'STARTS_WITH', label: 'Starts with' },
    { value: 'ENDS_WITH', label: 'Ends with' },
    { value: 'IS_NULL', label: 'Is empty' },
    { value: 'IS_NOT_NULL', label: 'Is not empty' },
  ],
  number: [
    { value: '=', label: 'Equals' },
    { value: '!=', label: 'Not equals' },
    { value: '>', label: 'Greater than' },
    { value: '<', label: 'Less than' },
    { value: '>=', label: 'Greater than or equal' },
    { value: '<=', label: 'Less than or equal' },
    { value: 'BETWEEN', label: 'Between' },
    { value: 'IS_NULL', label: 'Is empty' },
  ],
  date: [
    { value: '=', label: 'Equals' },
    { value: '!=', label: 'Not equals' },
    { value: '>', label: 'After' },
    { value: '<', label: 'Before' },
    { value: '>=', label: 'On or after' },
    { value: '<=', label: 'On or before' },
    { value: 'BETWEEN', label: 'Between' },
    { value: 'IS_NULL', label: 'Is empty' },
  ],
  boolean: [
    { value: '=', label: 'Equals' },
  ],
  choice: [
    { value: '=', label: 'Equals' },
    { value: '!=', label: 'Not equals' },
    { value: 'IN', label: 'Is one of' },
  ],
}

export const AGGREGATE_FUNCTIONS = [
  { value: '', label: 'None' },
  { value: 'COUNT', label: 'Count' },
  { value: 'SUM', label: 'Sum' },
  { value: 'AVG', label: 'Average' },
  { value: 'MIN', label: 'Min' },
  { value: 'MAX', label: 'Max' },
]

// ==================== Helper ====================

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

const formatExtension = (format: ExportFormat): string => {
  switch (format) {
    case 'EXCEL': return 'xlsx'
    case 'PDF': return 'pdf'
    default: return 'csv'
  }
}

// ==================== Service ====================

export const reportBuilderService = {
  // Data sources
  async getDataSources(): Promise<DataSource[]> {
    const response = await api.get('/reports/builder/data-sources/')
    return response.data
  },

  // Fields for a data source
  async getFields(dataSource: string): Promise<FieldInfo[]> {
    const response = await api.get(`/reports/builder/fields/${dataSource}/`)
    return response.data
  },

  // Preview report
  async previewReport(request: ReportPreviewRequest): Promise<ReportPreviewResponse> {
    const response = await api.post('/reports/builder/preview/', request)
    return response.data
  },

  // Export report
  async exportReport(request: ReportExportRequest): Promise<void> {
    const response = await api.post('/reports/builder/export/', request, {
      responseType: 'blob',
    })
    const filename = `report_${Date.now()}.${formatExtension(request.format)}`
    downloadBlob(response.data, filename)
  },

  // Saved reports CRUD
  async listSavedReports(): Promise<ReportDefinition[]> {
    const response = await api.get('/reports/builder/saved/')
    return response.data
  },

  async getSavedReport(id: string): Promise<ReportDefinition> {
    const response = await api.get(`/reports/builder/saved/${id}/`)
    return response.data
  },

  async createSavedReport(data: SaveReportRequest): Promise<ReportDefinition> {
    const response = await api.post('/reports/builder/saved/', data)
    return response.data
  },

  async updateSavedReport(id: string, data: SaveReportRequest): Promise<ReportDefinition> {
    const response = await api.put(`/reports/builder/saved/${id}/`, data)
    return response.data
  },

  async deleteSavedReport(id: string): Promise<void> {
    await api.delete(`/reports/builder/saved/${id}/`)
  },

  async executeSavedReport(id: string, page = 1, pageSize = 50): Promise<ReportPreviewResponse> {
    const response = await api.post(`/reports/builder/saved/${id}/execute/`, { page, page_size: pageSize })
    return response.data
  },

  async duplicateSavedReport(id: string): Promise<ReportDefinition> {
    const response = await api.post(`/reports/builder/saved/${id}/duplicate/`)
    return response.data
  },

  // Scheduled reports
  async createSchedule(reportId: string, data: CreateScheduleRequest): Promise<ScheduledReport> {
    const response = await api.post(`/reports/builder/saved/${reportId}/schedule/`, data)
    return response.data
  },

  async listScheduledReports(): Promise<ScheduledReport[]> {
    const response = await api.get('/reports/builder/scheduled/')
    return response.data
  },

  async updateSchedule(id: string, data: Partial<CreateScheduleRequest>): Promise<ScheduledReport> {
    const response = await api.put(`/reports/builder/scheduled/${id}/`, data)
    return response.data
  },

  async deleteSchedule(id: string): Promise<void> {
    await api.delete(`/reports/builder/scheduled/${id}/`)
  },
}

export default reportBuilderService
