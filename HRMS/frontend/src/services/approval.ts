/**
 * Approval Workflow API service
 */

import api from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────

export type ApproverType =
  | 'ROLE'
  | 'USER'
  | 'SUPERVISOR'
  | 'DEPARTMENT_HEAD'
  | 'DISTRICT_HEAD'
  | 'REGIONAL_DIRECTOR'
  | 'DIRECTORATE_HEAD'
  | 'DIVISION_HEAD'
  | 'DCE'
  | 'CEO'
  | 'DYNAMIC'

export interface ApprovalLevel {
  id: string
  level: number
  name: string
  description: string
  approver_type: ApproverType
  approver_type_display: string
  approver_role: string | null
  approver_role_name: string | null
  approver_user: string | null
  approver_user_name: string | null
  approver_field: string
  amount_threshold_min: string | null
  amount_threshold_max: string | null
  amount_field: string
  required_approvals: number
  allow_self_approval: boolean
  can_skip: boolean
  skip_if_same_as_previous: boolean
}

export interface ApprovalLevelInput {
  level: number
  name: string
  description?: string
  approver_type: ApproverType
  approver_role?: string | null
  approver_user?: string | null
  approver_field?: string
  amount_threshold_min?: string | null
  amount_threshold_max?: string | null
  amount_field?: string
  required_approvals?: number
  allow_self_approval?: boolean
  can_skip?: boolean
  skip_if_same_as_previous?: boolean
}

export interface ApprovalWorkflow {
  id: string
  code: string
  name: string
  description: string
  workflow_type: string
  content_type: number
  content_type_display: string
  is_active: boolean
  is_default: boolean
  version: number
  level_count: number
}

export interface ApprovalWorkflowDetail extends ApprovalWorkflow {
  require_all_approvers: boolean
  allow_parallel_approval: boolean
  auto_approve_timeout_days: number | null
  notify_on_status_change: boolean
  approval_levels: ApprovalLevel[]
  created_at: string
  updated_at: string
}

export interface WorkflowCreateInput {
  code: string
  name: string
  description?: string
  workflow_type?: string
  content_type_key: string
  is_active?: boolean
  is_default?: boolean
  require_all_approvers?: boolean
  allow_parallel_approval?: boolean
  auto_approve_timeout_days?: number | null
  notify_on_status_change?: boolean
  approval_levels?: ApprovalLevelInput[]
}

export interface PendingApproval {
  id: string
  instance_id: string
  workflow_name: string
  level_number: number
  level_name: string
  total_levels: number
  assigned_to: string | null
  assigned_to_name: string
  status: string
  requested_at: string
  due_date: string | null
  responded_at: string | null
  responded_by: string | null
  responded_by_name: string | null
  comments: string
  delegated_to: string | null
  delegated_by: string | null
  delegation_reason: string
  module_name: string
  object_display: string
}

export interface ApprovalInstance {
  id: string
  workflow: string
  workflow_name: string
  workflow_code: string
  content_type: number
  content_type_display: string
  object_id: string
  object_display: string
  current_state: string
  current_state_name: string
  current_approval_level: number | null
  total_levels: number
  status: 'ACTIVE' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | 'SUSPENDED'
  started_at: string
  completed_at: string | null
  started_by: string
  started_by_name: string
  approval_requests: PendingApproval[]
}

export interface ApprovalAction {
  action: 'APPROVE' | 'REJECT' | 'DELEGATE' | 'RETURN'
  comments?: string
  delegated_to?: string | null
}

export interface ApprovalStats {
  pending_count: number
  approved_today: number
  rejected_today: number
  overdue_count: number
  by_module: Record<string, number>
}

export interface ApproverTypeOption {
  value: ApproverType
  label: string
}

export interface ContentTypeOption {
  id: number
  key: string
  label: string
}

// ── API Service ────────────────────────────────────────────────

const BASE = '/workflow'

// Helper to unwrap paginated or flat responses
function unwrapResults<T>(data: any): T[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.results)) return data.results
  return []
}

// Workflow Definitions
export const getWorkflows = async (params?: Record<string, string>) => {
  const { data } = await api.get(`${BASE}/definitions/`, { params })
  return unwrapResults<ApprovalWorkflow>(data)
}

export const getWorkflow = async (id: string) => {
  const { data } = await api.get(`${BASE}/definitions/${id}/`)
  return data as ApprovalWorkflowDetail
}

export const createWorkflow = async (input: WorkflowCreateInput) => {
  const { data } = await api.post(`${BASE}/definitions/`, input)
  return data as ApprovalWorkflowDetail
}

export const updateWorkflow = async (id: string, input: Partial<WorkflowCreateInput>) => {
  const { data } = await api.patch(`${BASE}/definitions/${id}/`, input)
  return data as ApprovalWorkflowDetail
}

export const deleteWorkflow = async (id: string) => {
  await api.delete(`${BASE}/definitions/${id}/`)
}

export const setWorkflowLevels = async (id: string, levels: ApprovalLevelInput[]) => {
  const { data } = await api.post(`${BASE}/definitions/${id}/set-levels/`, { levels })
  return data as ApprovalWorkflowDetail
}

export const getWorkflowsForModule = async (contentType: string) => {
  const { data } = await api.get(`${BASE}/definitions/for-module/`, {
    params: { content_type: contentType },
  })
  return data as ApprovalWorkflow[]
}

export const getApproverTypes = async () => {
  const { data } = await api.get(`${BASE}/definitions/approver-types/`)
  return data as ApproverTypeOption[]
}

export const getContentTypes = async () => {
  const { data } = await api.get(`${BASE}/definitions/content-types/`)
  return data as ContentTypeOption[]
}

// Pending Approvals (Inbox)
export const getMyPendingApprovals = async (params?: Record<string, string>) => {
  const { data } = await api.get(`${BASE}/my-approvals/`, { params })
  return unwrapResults<PendingApproval>(data)
}

// Approval Actions
export const processApproval = async (requestId: string, action: ApprovalAction) => {
  const { data } = await api.post(`${BASE}/approvals/${requestId}/action/`, action)
  return data as PendingApproval
}

// Object Status
export const getObjectApprovalStatus = async (contentType: string, objectId: string) => {
  const { data } = await api.get(`${BASE}/status/`, {
    params: { content_type: contentType, object_id: objectId },
  })
  return data as ApprovalInstance
}

// Dashboard Stats
export const getApprovalStats = async () => {
  const { data } = await api.get(`${BASE}/stats/`)
  return data as ApprovalStats
}
