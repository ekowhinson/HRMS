import api from '@/lib/api'

export interface ImportJob {
  id: string
  original_filename: string
  file_type: string
  target_model: string
  instructions?: string
  column_mapping: Record<string, string>
  mapping_confidence: Record<string, {
    target_field: string
    confidence: number
    reason: string
  }>
  headers: string[]
  sample_data: string[][]
  status: ImportStatus
  total_rows: number
  processed_rows: number
  success_count: number
  error_count: number
  skip_count: number
  errors: ImportError[]
  validation_errors: string[]
  progress: number
  started_at?: string
  completed_at?: string
  template?: string
  created_at: string
  created_by_name?: string
}

export interface ImportError {
  row?: number
  type?: string
  message: string
  data?: string
}

export type ImportStatus =
  | 'PENDING'
  | 'PARSING'
  | 'MAPPING'
  | 'VALIDATING'
  | 'PREVIEW'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export type TargetModel =
  | 'employees'
  | 'leave_balances'
  | 'transactions'
  | 'departments'
  | 'positions'
  | 'grades'
  | 'job_categories'
  // Organization hierarchy
  | 'divisions'
  | 'directorates'
  | 'work_locations'
  // Payroll setup
  | 'banks'
  | 'bank_branches'
  | 'staff_categories'
  | 'salary_bands'
  | 'salary_levels'
  | 'salary_notches'
  | 'pay_components'
  // Leave setup
  | 'leave_types'
  | 'holidays'
  // Employee related
  | 'bank_accounts'

export interface ImportTemplate {
  id: string
  name: string
  description?: string
  target_model: TargetModel
  column_mapping: Record<string, string>
  default_values: Record<string, string>
  transformation_rules: Record<string, string>
  is_public: boolean
  created_at: string
  created_by_name?: string
}

export interface FieldDefinition {
  name: string
  type: string
  required: boolean
  aliases: string[]
  lookup_model?: string
}

export interface ValidationResult {
  is_valid: boolean
  errors: string[]
  warnings: string[]
  sample_transformations: Record<string, {
    original: string
    transformed: string
    error?: string
  }>[]
}

export interface ImportProgress {
  processed: number
  total: number
  percentage: number
  success_count: number
  error_count: number
  status: ImportStatus
  errors: ImportError[]
}

export const importService = {
  // Upload file and create import job
  async upload(
    file: File,
    targetModel: TargetModel,
    instructions?: string,
    templateId?: string
  ): Promise<ImportJob> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('target_model', targetModel)
    if (instructions) formData.append('instructions', instructions)
    if (templateId) formData.append('template_id', templateId)

    const response = await api.post('/imports/jobs/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  // Confirm column mapping and validate
  async confirmMapping(
    jobId: string,
    columnMapping: Record<string, string>
  ): Promise<{ job: ImportJob; validation: ValidationResult }> {
    const response = await api.post(`/imports/jobs/${jobId}/confirm_mapping/`, {
      column_mapping: columnMapping,
    })
    return response.data
  },

  // Execute import
  async execute(
    jobId: string
  ): Promise<{
    job: ImportJob
    result: {
      success_count: number
      error_count: number
      skip_count: number
      errors: ImportError[]
    }
  }> {
    const response = await api.post(`/imports/jobs/${jobId}/execute/`)
    return response.data
  },

  // Get progress
  async getProgress(jobId: string): Promise<ImportProgress> {
    const response = await api.get(`/imports/jobs/${jobId}/progress/`)
    return response.data
  },

  // Get job details
  async getJob(jobId: string): Promise<ImportJob> {
    const response = await api.get(`/imports/jobs/${jobId}/`)
    return response.data
  },

  // List jobs
  async listJobs(params?: {
    status?: ImportStatus
    target_model?: TargetModel
  }): Promise<ImportJob[]> {
    const response = await api.get('/imports/jobs/', { params })
    return response.data.results || response.data
  },

  // Cancel job
  async cancel(jobId: string): Promise<void> {
    await api.post(`/imports/jobs/${jobId}/cancel/`)
  },

  // Download error report
  async downloadErrors(jobId: string): Promise<Blob> {
    const response = await api.get(`/imports/jobs/${jobId}/download_errors/`, {
      responseType: 'blob',
    })
    return response.data
  },

  // Templates
  async getTemplates(targetModel?: TargetModel): Promise<ImportTemplate[]> {
    const params = targetModel ? { target_model: targetModel } : {}
    const response = await api.get('/imports/templates/', { params })
    return response.data.results || response.data
  },

  async createTemplate(data: {
    name: string
    target_model: TargetModel
    column_mapping: Record<string, string>
    description?: string
    is_public?: boolean
  }): Promise<ImportTemplate> {
    const response = await api.post('/imports/templates/', data)
    return response.data
  },

  async deleteTemplate(templateId: string): Promise<void> {
    await api.delete(`/imports/templates/${templateId}/`)
  },

  // Field definitions
  async getFieldDefinitions(
    targetModel: TargetModel
  ): Promise<Record<string, FieldDefinition>> {
    const response = await api.get(`/imports/fields/${targetModel}/`)
    return response.data
  },
}

export const TARGET_MODEL_LABELS: Record<TargetModel, string> = {
  employees: 'Employees',
  leave_balances: 'Leave Balances',
  transactions: 'Payroll Transactions',
  departments: 'Departments',
  positions: 'Job Positions',
  grades: 'Job Grades',
  job_categories: 'Job Categories',
  // Organization hierarchy
  divisions: 'Divisions',
  directorates: 'Directorates',
  work_locations: 'Work Locations',
  // Payroll setup
  banks: 'Banks',
  bank_branches: 'Bank Branches',
  staff_categories: 'Staff Categories',
  salary_bands: 'Salary Bands',
  salary_levels: 'Salary Levels',
  salary_notches: 'Salary Notches',
  pay_components: 'Pay Components',
  // Leave setup
  leave_types: 'Leave Types',
  holidays: 'Holidays',
  // Employee related
  bank_accounts: 'Bank Accounts',
}

export const STATUS_LABELS: Record<ImportStatus, string> = {
  PENDING: 'Pending',
  PARSING: 'Parsing File',
  MAPPING: 'Column Mapping',
  VALIDATING: 'Validating',
  PREVIEW: 'Ready for Import',
  IMPORTING: 'Importing...',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
}
