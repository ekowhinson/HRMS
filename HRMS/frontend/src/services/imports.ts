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

// ==================== Multi-File Batch Import ====================

export type BatchStatus =
  | 'PENDING'
  | 'ANALYZING'
  | 'READY'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED'

export interface BatchJob {
  id: string
  filename: string
  detected_model: string
  detection_confidence: number
  target_model: string
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
  success_count: number
  error_count: number
  processing_order: number
}

export interface ImportBatch {
  id: string
  name: string
  instructions?: string
  status: BatchStatus
  analysis_results: Record<string, {
    detected_model: string
    confidence: number
    matched_fields: Record<string, string>
    file_category: string
    dependencies: string[]
    total_rows: number
    reason: string
  }>
  processing_order: string[]
  file_count: number
  total_rows: number
  processed_rows: number
  success_count: number
  error_count: number
  files_completed: number
  files_failed: number
  progress: number
  auto_create_dependencies: boolean
  update_existing: boolean
  started_at?: string
  completed_at?: string
  created_at: string
  created_by_name?: string
  jobs: BatchJob[]
}

export interface FileAnalysis {
  detected_model: string
  confidence: number
  matched_fields: Record<string, string>
  file_category: string
  dependencies: string[]
  total_rows: number
  headers: string[]
  sample_data: string[][]
  reason: string
  model_scores: Record<string, number>
}

export interface AIAnalysisInfo {
  used: boolean
  mode: 'ai' | 'rule-based'
  agents_used: string[]
  description?: string
}

export interface AIStatusResponse {
  ai_available: boolean
  analysis_mode: 'ai' | 'rule-based'
  agents: Array<{
    name: string
    description: string
  }>
  message: string
}

export interface BatchAnalysisResult {
  files: Record<string, FileAnalysis>
  processing_order: string[]
  detected_models: Record<string, string>
  confidence_scores: Record<string, number>
  warnings: string[]
  errors: string[]
  ai_analysis?: AIAnalysisInfo
}

export interface BatchUploadResult {
  batch: ImportBatch
  analysis: BatchAnalysisResult
  ai_analysis?: AIAnalysisInfo
}

export interface BatchExecuteResult {
  batch: ImportBatch
  result: {
    total_files: number
    completed_files: number
    failed_files: number
    total_rows: number
    success_count: number
    error_count: number
    skip_count: number
    errors: ImportError[]
  }
}

export const batchImportService = {
  // Check AI analysis status
  async getAIStatus(): Promise<AIStatusResponse> {
    const response = await api.get('/imports/batches/ai_status/')
    return response.data
  },

  // Upload multiple files for AI-powered analysis
  async upload(
    files: File[],
    options?: {
      name?: string
      instructions?: string
      auto_create_dependencies?: boolean
      update_existing?: boolean
    }
  ): Promise<BatchUploadResult> {
    const formData = new FormData()
    files.forEach((file) => {
      formData.append('files', file)
    })
    if (options?.name) formData.append('name', options.name)
    if (options?.instructions) formData.append('instructions', options.instructions)
    if (options?.auto_create_dependencies !== undefined) {
      formData.append('auto_create_dependencies', String(options.auto_create_dependencies))
    }
    if (options?.update_existing !== undefined) {
      formData.append('update_existing', String(options.update_existing))
    }

    const response = await api.post('/imports/batches/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  // Analyze files without creating a batch (preview only)
  async analyze(files: File[], instructions?: string): Promise<BatchAnalysisResult & { files: Record<string, FileAnalysis> }> {
    const formData = new FormData()
    files.forEach((file) => {
      formData.append('files', file)
    })
    if (instructions) formData.append('instructions', instructions)

    const response = await api.post('/imports/batches/analyze/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  // Get batch details
  async getBatch(batchId: string): Promise<ImportBatch> {
    const response = await api.get(`/imports/batches/${batchId}/`)
    return response.data
  },

  // List batches
  async listBatches(params?: { status?: BatchStatus }): Promise<ImportBatch[]> {
    const response = await api.get('/imports/batches/', { params })
    return response.data.results || response.data
  },

  // Execute batch import
  async execute(
    batchId: string,
    overrides?: Array<{
      job_id: string
      target_model?: TargetModel
      column_mapping?: Record<string, string>
    }>
  ): Promise<BatchExecuteResult> {
    const response = await api.post(`/imports/batches/${batchId}/execute/`, {
      overrides: overrides || [],
    })
    return response.data
  },

  // Get batch progress
  async getProgress(batchId: string): Promise<{
    id: string
    name: string
    status: BatchStatus
    file_count: number
    files_completed: number
    files_failed: number
    total_rows: number
    processed_rows: number
    success_count: number
    error_count: number
    progress_percentage: number
    processing_order: string[]
    files: Array<{
      filename: string
      detected_model: string
      target_model: string
      status: ImportStatus
      total_rows: number
      success_count: number
      error_count: number
      processing_order: number
    }>
    started_at?: string
    completed_at?: string
  }> {
    const response = await api.get(`/imports/batches/${batchId}/progress/`)
    return response.data
  },

  // Update a job's mapping within a batch
  async updateJob(
    batchId: string,
    jobId: string,
    updates: {
      target_model?: TargetModel
      column_mapping?: Record<string, string>
    }
  ): Promise<{ message: string; job: BatchJob }> {
    const response = await api.patch(`/imports/batches/${batchId}/update_job/`, {
      job_id: jobId,
      ...updates,
    })
    return response.data
  },

  // Cancel batch
  async cancel(batchId: string): Promise<void> {
    await api.post(`/imports/batches/${batchId}/cancel/`)
  },
}

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  PENDING: 'Pending',
  ANALYZING: 'Analyzing Files',
  READY: 'Ready for Import',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  PARTIAL: 'Partially Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
}

export const FILE_CATEGORY_LABELS: Record<string, string> = {
  setup: 'Setup Data',
  main: 'Main Data',
  transaction: 'Transaction Data',
  unknown: 'Unknown',
}
