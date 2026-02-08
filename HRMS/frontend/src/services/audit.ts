import api from '@/lib/api'
import type { PaginatedResponse } from '@/types'

// ==================== Types ====================

export interface AuditLogEntry {
  id: string
  user: string | null
  user_name: string | null
  user_email: string | null
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT' | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED'
  model_name: string
  object_id: string | null
  object_repr: string | null
  changes: Record<string, { old: unknown; new: unknown }> | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  timestamp: string
  extra_data: Record<string, unknown> | null
}

export interface AuditLogParams {
  action?: string
  model_name?: string
  search?: string
  timestamp__gte?: string
  timestamp__lte?: string
  page?: number
}

// ==================== Service ====================

export const auditService = {
  getAuditLogs(params?: AuditLogParams): Promise<PaginatedResponse<AuditLogEntry>> {
    return api.get('/core/audit-logs/', { params }).then((r) => r.data)
  },

  getModelNames(): Promise<string[]> {
    return api.get('/core/audit-logs/model_names/').then((r) => r.data)
  },
}
