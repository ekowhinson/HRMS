import api from '@/lib/api'

// ==================== Types ====================

export type BackupType = 'FULL' | 'SELECTIVE' | 'INCREMENTAL'
export type BackupStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'RESTORING'
export type RestoreType = 'FULL' | 'SELECTIVE' | 'MERGE' | 'REPLACE'
export type RestoreMode = 'OVERWRITE' | 'SKIP_EXISTING' | 'MERGE'
export type RestoreStatus = 'PENDING' | 'PRE_BACKUP' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK'
export type ScheduleType = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export interface TenantBackup {
  id: string
  backup_number: string
  name: string
  description: string
  backup_type: BackupType
  modules_included: string[]
  status: BackupStatus
  progress_percent: number
  progress_detail: string
  file_size_bytes: number | null
  file_format: string
  record_counts: Record<string, number>
  total_records: number
  started_at: string | null
  completed_at: string | null
  duration_seconds: number | null
  error_message: string
  retention_days: number
  expires_at: string | null
  is_locked: boolean
  created_at: string
}

export interface TenantRestore {
  id: string
  restore_number: string
  backup: string
  backup_detail: TenantBackup
  restore_type: RestoreType
  modules_restored: string[]
  restore_mode: RestoreMode
  status: RestoreStatus
  progress_percent: number
  progress_detail: string
  records_restored: Record<string, number>
  records_skipped: Record<string, number>
  total_restored: number
  total_skipped: number
  total_failed: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface BackupSchedule {
  id: string
  name: string
  is_active: boolean
  schedule_type: ScheduleType
  schedule_config: Record<string, any>
  backup_type: 'FULL' | 'SELECTIVE'
  modules_included: string[]
  retention_days: number
  max_backups: number
  last_run_at: string | null
  next_run_at: string | null
  last_status: string | null
}

export interface CreateBackupRequest {
  name: string
  description?: string
  backup_type: BackupType
  modules_included?: string[]
  retention_days?: number
}

export interface InitiateRestoreRequest {
  restore_type: RestoreType
  modules_restored?: string[]
  restore_mode: RestoreMode
}

export interface CreateScheduleRequest {
  name: string
  schedule_type: ScheduleType
  schedule_config: Record<string, any>
  backup_type: 'FULL' | 'SELECTIVE'
  modules_included?: string[]
  retention_days?: number
  max_backups?: number
  is_active?: boolean
}

export interface VerifyResult {
  is_valid: boolean
  checks: {
    name: string
    passed: boolean
    message: string
  }[]
  verified_at: string
}

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ==================== Service ====================

export const backupService = {
  // Backups
  async listBackups(params?: { status?: BackupStatus; page?: number }): Promise<PaginatedResponse<TenantBackup>> {
    const response = await api.get<PaginatedResponse<TenantBackup>>('/core/backups/', { params })
    return response.data
  },

  async getBackup(id: string): Promise<TenantBackup> {
    const response = await api.get<TenantBackup>(`/core/backups/${id}/`)
    return response.data
  },

  async createBackup(data: CreateBackupRequest): Promise<TenantBackup> {
    const response = await api.post<TenantBackup>('/core/backups/', data)
    return response.data
  },

  async deleteBackup(id: string): Promise<void> {
    await api.delete(`/core/backups/${id}/`)
  },

  async downloadBackup(id: string): Promise<Blob> {
    const response = await api.get(`/core/backups/${id}/download/`, {
      responseType: 'blob',
    })
    return response.data
  },

  async verifyBackup(id: string): Promise<VerifyResult> {
    const response = await api.post<VerifyResult>(`/core/backups/${id}/verify/`)
    return response.data
  },

  async lockBackup(id: string): Promise<TenantBackup> {
    const response = await api.post<TenantBackup>(`/core/backups/${id}/lock/`)
    return response.data
  },

  async unlockBackup(id: string): Promise<TenantBackup> {
    const response = await api.post<TenantBackup>(`/core/backups/${id}/unlock/`)
    return response.data
  },

  async initiateRestore(backupId: string, data: InitiateRestoreRequest): Promise<TenantRestore> {
    const response = await api.post<TenantRestore>(`/core/backups/${backupId}/restore/`, data)
    return response.data
  },

  // Restores
  async listRestores(params?: { status?: RestoreStatus; page?: number }): Promise<PaginatedResponse<TenantRestore>> {
    const response = await api.get<PaginatedResponse<TenantRestore>>('/core/restores/', { params })
    return response.data
  },

  async getRestore(id: string): Promise<TenantRestore> {
    const response = await api.get<TenantRestore>(`/core/restores/${id}/`)
    return response.data
  },

  async approveRestore(id: string): Promise<TenantRestore> {
    const response = await api.post<TenantRestore>(`/core/restores/${id}/approve/`)
    return response.data
  },

  // Schedules
  async listSchedules(): Promise<BackupSchedule[]> {
    const response = await api.get<PaginatedResponse<BackupSchedule> | BackupSchedule[]>('/core/backup-schedules/')
    return Array.isArray(response.data) ? response.data : response.data.results
  },

  async createSchedule(data: CreateScheduleRequest): Promise<BackupSchedule> {
    const response = await api.post<BackupSchedule>('/core/backup-schedules/', data)
    return response.data
  },

  async updateSchedule(id: string, data: Partial<CreateScheduleRequest>): Promise<BackupSchedule> {
    const response = await api.put<BackupSchedule>(`/core/backup-schedules/${id}/`, data)
    return response.data
  },

  async deleteSchedule(id: string): Promise<void> {
    await api.delete(`/core/backup-schedules/${id}/`)
  },

  async runScheduleNow(id: string): Promise<TenantBackup> {
    const response = await api.post<TenantBackup>(`/core/backup-schedules/${id}/run_now/`)
    return response.data
  },
}

// ==================== Constants ====================

export const BACKUP_MODULES = [
  { value: 'organization', label: 'Organization' },
  { value: 'accounts', label: 'Accounts & Users' },
  { value: 'employees', label: 'Employees' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'leave', label: 'Leave Management' },
  { value: 'benefits', label: 'Benefits' },
  { value: 'performance', label: 'Performance' },
  { value: 'recruitment', label: 'Recruitment' },
  { value: 'training', label: 'Training' },
  { value: 'discipline', label: 'Discipline' },
  { value: 'finance', label: 'Finance' },
  { value: 'documents', label: 'Documents' },
] as const

export const BACKUP_STATUS_CONFIG: Record<BackupStatus, { label: string; variant: 'default' | 'info' | 'success' | 'danger' | 'warning' }> = {
  PENDING: { label: 'Pending', variant: 'default' },
  IN_PROGRESS: { label: 'In Progress', variant: 'info' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'danger' },
  EXPIRED: { label: 'Expired', variant: 'default' },
  RESTORING: { label: 'Restoring', variant: 'warning' },
}

export const RESTORE_STATUS_CONFIG: Record<RestoreStatus, { label: string; variant: 'default' | 'info' | 'success' | 'danger' | 'warning' }> = {
  PENDING: { label: 'Pending', variant: 'default' },
  PRE_BACKUP: { label: 'Creating Safety Backup', variant: 'info' },
  IN_PROGRESS: { label: 'In Progress', variant: 'info' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'danger' },
  ROLLED_BACK: { label: 'Rolled Back', variant: 'warning' },
}

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
}
