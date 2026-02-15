/**
 * Import pipeline API service.
 *
 * Single Responsibility: only handles HTTP calls for the import pipeline.
 * Each function maps 1:1 to a backend endpoint.
 */

import { api } from '@/lib/api'

// ── Types ───────────────────────────────────────────────────────────────────

export type ImportEntityType =
  | 'EMPLOYEE_TRANSACTION'
  | 'EMPLOYEE'
  | 'BANK_ACCOUNT'
  | 'PAY_COMPONENT'
  | 'BANK'

export type ImportSessionStatus =
  | 'UPLOADED'
  | 'MAPPING'
  | 'MAPPED'
  | 'PREVIEWED'
  | 'CONFIRMED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'

export type PreviewAction = 'CREATE' | 'UPDATE' | 'SKIP' | 'ERROR'

export interface ColumnMapping {
  [sourceColumn: string]: string | null
}

export interface TargetSchema {
  [fieldName: string]: string // field → description
}

export interface AnalyzeResponse {
  session_id: string
  entity_type: ImportEntityType
  column_mapping: ColumnMapping
  target_schema: TargetSchema
  source_columns: string[]
  sample_data: Record<string, any>[]
  total_rows: number
}

export interface PreviewRow {
  id: string
  row_number: number
  action: PreviewAction
  parsed_data: Record<string, any>
  raw_data: Record<string, any>
  existing_record_id: string | null
  changes: Record<string, { old: string; new: string }> | null
  errors: string[] | null
  warnings: string[] | null
}

export interface PreviewSummary {
  total: number
  to_create: number
  to_update: number
  to_skip: number
  errors: number
  warnings: number
}

export interface PreviewResponse {
  session_id: string
  status: ImportSessionStatus
  summary: PreviewSummary
}

export interface ConfirmResponse {
  session_id: string
  status: ImportSessionStatus
  task_id: string
  progress_key: string
}

export interface ImportProgress {
  processed: number
  total: number
  percentage: number
  status: string
  rows_created?: number
  rows_updated?: number
  rows_errored?: number
  error?: string
}

export interface ProgressResponse {
  session_id: string
  status: ImportSessionStatus
  progress: ImportProgress | null
  rows_created: number
  rows_updated: number
  rows_errored: number
}

export interface ImportSession {
  id: string
  entity_type: ImportEntityType
  status: ImportSessionStatus
  column_mapping: ColumnMapping | null
  confirmed_mapping: ColumnMapping | null
  import_params: Record<string, any> | null
  total_rows: number
  rows_created: number
  rows_updated: number
  rows_skipped: number
  rows_errored: number
  error_details: Record<string, any>[] | null
  celery_task_id: string | null
  progress_key: string | null
  created_at: string
  updated_at: string
  preview_rows: PreviewRow[]
  results: ImportResult[]
}

export interface ImportResult {
  id: string
  row_number: number
  action_taken: string
  record_id: string | null
  record_type: string | null
  error_message: string | null
  created_at: string
}

export interface EntityTypeInfo {
  type: ImportEntityType
  label: string
  schema: TargetSchema
}

// ── API functions ───────────────────────────────────────────────────────────

export async function analyzeImport(
  attachmentId: string,
  entityType?: ImportEntityType,
): Promise<AnalyzeResponse> {
  const { data } = await api.post('/assistant/import/analyze/', {
    attachment_id: attachmentId,
    entity_type: entityType || null,
  })
  return data
}

export async function generatePreview(
  sessionId: string,
  confirmedMapping?: ColumnMapping,
  importParams?: Record<string, any>,
): Promise<PreviewResponse> {
  const { data } = await api.post('/assistant/import/preview/', {
    session_id: sessionId,
    confirmed_mapping: confirmedMapping,
    import_params: importParams,
  })
  return data
}

export async function confirmImport(sessionId: string): Promise<ConfirmResponse> {
  const { data } = await api.post('/assistant/import/confirm/', {
    session_id: sessionId,
  })
  return data
}

export async function getImportProgress(sessionId: string): Promise<ProgressResponse> {
  const { data } = await api.get(`/assistant/import/${sessionId}/progress/`)
  return data
}

export async function getImportSession(sessionId: string): Promise<ImportSession> {
  const { data } = await api.get(`/assistant/import/${sessionId}/`)
  return data
}

export async function getEntityTypes(): Promise<EntityTypeInfo[]> {
  const { data } = await api.get('/assistant/import/entity-types/')
  return data.entity_types
}
