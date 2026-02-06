import api from '@/lib/api'

// ==================== Types ====================

export type DatasetStatus =
  | 'DRAFT'
  | 'ANALYZING'
  | 'READY'
  | 'MERGED'
  | 'SAVED'
  | 'FAILED'

export type JoinType = 'inner' | 'left' | 'right' | 'outer'

export type RelationshipType = '1:1' | '1:N' | 'N:1' | 'N:N'

export interface DatasetFile {
  id: string
  file_name: string
  file_type: string
  headers: string[]
  sample_data: any[][]
  row_count: number
  detected_data_types: Record<string, string>
  detected_patterns: Record<string, any>
  alias: string
  order: number
  created_at: string
}

export interface JoinConfiguration {
  id: string
  left_file: string
  left_file_alias: string
  left_file_name: string
  left_column: string
  right_file: string
  right_file_alias: string
  right_file_name: string
  right_column: string
  join_type: JoinType
  is_ai_suggested: boolean
  ai_confidence: number
  ai_reasoning: string
  relationship_type: RelationshipType
  sample_matches: Array<{ left_value: string; right_value: string }>
  order: number
}

export interface Dataset {
  id: string
  name: string
  description?: string
  status: DatasetStatus
  merged_headers: string[]
  merged_row_count: number
  merged_sample_data: any[][]
  ai_analysis: AIAnalysis
  file_count: number
  total_source_rows: number
  error_message?: string
  is_ready_for_merge: boolean
  files: DatasetFile[]
  joins: JoinConfiguration[]
  created_at: string
  created_by: string
  created_by_name: string
}

export interface AIAnalysis {
  files?: Array<{
    filename: string
    likely_role: 'primary' | 'secondary' | 'reference'
    key_columns: string[]
    description: string
  }>
  join_suggestions?: Array<{
    id?: string
    left_file: string
    left_column: string
    right_file: string
    right_column: string
    confidence: number
    join_type: JoinType
    reasoning: string
    relationship_type: RelationshipType
  }>
  relationship_graph?: {
    primary_file: string
    relationships: Array<{
      from: string
      to: string
      type: RelationshipType
    }>
  }
  warnings?: string[]
  recommendations?: string[]
  error?: string
  mode?: 'ai' | 'rule-based'
}

export interface JoinConfigInput {
  left_file_id: string
  left_column: string
  right_file_id: string
  right_column: string
  join_type: JoinType
  order: number
}

export interface MergePreviewResult {
  success: boolean
  headers: string[]
  data: any[][]
  row_count: number
  statistics: {
    total_rows: number
    total_columns: number
    files_merged: number
  }
  warnings: string[]
  errors: string[]
}

export interface DatasetUploadResult {
  dataset: Dataset
  ai_analysis: AIAnalysis
  ai_available: boolean
}

// ==================== Service ====================

export const datasetService = {
  /**
   * Upload files and get AI join suggestions
   */
  async upload(
    files: File[],
    options?: {
      name?: string
      description?: string
    }
  ): Promise<DatasetUploadResult> {
    const formData = new FormData()
    files.forEach((file) => {
      formData.append('files', file)
    })
    if (options?.name) formData.append('name', options.name)
    if (options?.description) formData.append('description', options.description)

    const response = await api.post('/imports/datasets/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  /**
   * Get dataset details
   */
  async get(datasetId: string): Promise<Dataset> {
    const response = await api.get(`/imports/datasets/${datasetId}/`)
    return response.data
  },

  /**
   * List all datasets
   */
  async list(params?: { status?: DatasetStatus }): Promise<Dataset[]> {
    const response = await api.get('/imports/datasets/', { params })
    return response.data.results || response.data
  },

  /**
   * Delete a dataset
   */
  async delete(datasetId: string): Promise<void> {
    await api.delete(`/imports/datasets/${datasetId}/`)
  },

  /**
   * Configure join relationships between files
   */
  async configureJoins(
    datasetId: string,
    joins: JoinConfigInput[]
  ): Promise<{ dataset: Dataset; message: string }> {
    const response = await api.post(`/imports/datasets/${datasetId}/configure_joins/`, {
      joins,
    })
    return response.data
  },

  /**
   * Preview merged data (limited rows)
   */
  async preview(
    datasetId: string,
    limit?: number
  ): Promise<MergePreviewResult> {
    const response = await api.post(`/imports/datasets/${datasetId}/preview/`, {
      limit: limit || 100,
    })
    return response.data
  },

  /**
   * Execute merge and save result
   */
  async merge(
    datasetId: string
  ): Promise<{
    success: boolean
    dataset: Dataset
    statistics: Record<string, number>
    warnings: string[]
  }> {
    const response = await api.post(`/imports/datasets/${datasetId}/merge/`)
    return response.data
  },

  /**
   * Export merged data as file
   */
  async export(
    datasetId: string,
    format: 'csv' | 'xlsx' = 'csv'
  ): Promise<Blob> {
    const response = await api.get(`/imports/datasets/${datasetId}/export/`, {
      params: { format },
      responseType: 'blob',
    })
    return response.data
  },

  /**
   * Create ImportJob from merged dataset
   */
  async useForImport(
    datasetId: string,
    targetModel: string
  ): Promise<{ import_job: any; dataset: Dataset }> {
    const response = await api.post(`/imports/datasets/${datasetId}/use_for_import/`, {
      target_model: targetModel,
    })
    return response.data
  },
}

// ==================== Labels ====================

export const DATASET_STATUS_LABELS: Record<DatasetStatus, string> = {
  DRAFT: 'Draft',
  ANALYZING: 'Analyzing',
  READY: 'Ready',
  MERGED: 'Merged',
  SAVED: 'Saved',
  FAILED: 'Failed',
}

export const JOIN_TYPE_LABELS: Record<JoinType, string> = {
  inner: 'Inner Join',
  left: 'Left Join',
  right: 'Right Join',
  outer: 'Outer Join',
}

export const JOIN_TYPE_DESCRIPTIONS: Record<JoinType, string> = {
  inner: 'Only rows that match in both files',
  left: 'All rows from left file, matching from right',
  right: 'All rows from right file, matching from left',
  outer: 'All rows from both files',
}

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string> = {
  '1:1': 'One-to-One',
  '1:N': 'One-to-Many',
  'N:1': 'Many-to-One',
  'N:N': 'Many-to-Many',
}
