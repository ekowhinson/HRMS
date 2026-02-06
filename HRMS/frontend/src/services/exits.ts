/**
 * Exit/Offboarding API service
 */

import api from '@/lib/api'

// Types
export interface ExitType {
  id: string
  code: string
  name: string
  description: string
  requires_notice: boolean
  notice_period_days: number
  requires_exit_interview: boolean
  requires_clearance: boolean
  is_active: boolean
  sort_order: number
}

export interface ClearanceDepartment {
  id: string
  code: string
  name: string
  description: string
  checklist_items: string
  responsible_role: string
  is_required: boolean
  is_active: boolean
  sort_order: number
}

export interface ExitChecklistItem {
  id: string
  clearance: string
  item_name: string
  description: string
  is_completed: boolean
  completed_by: string | null
  completed_by_name: string
  completed_at: string | null
  notes: string
}

export interface ExitClearance {
  id: string
  exit_request: string
  department: string
  department_name: string
  department_code: string
  is_cleared: boolean
  cleared_by: string | null
  cleared_by_name: string
  cleared_at: string | null
  comments: string
  outstanding_items: string
  conditions: string
  amount_owed: number
  amount_due: number
  checklist_items: ExitChecklistItem[]
}

export interface AssetReturn {
  id: string
  exit_request: string
  asset_name: string
  asset_type: string
  asset_tag: string
  description: string
  status: 'PENDING' | 'RETURNED' | 'DAMAGED' | 'LOST' | 'WRITTEN_OFF' | 'PURCHASED'
  status_display: string
  returned_at: string | null
  received_by: string | null
  received_by_name: string
  condition_notes: string
  original_value: number | null
  deduction_amount: number
}

export interface ExitInterview {
  id: string
  exit_request: string
  scheduled_date: string | null
  conducted_date: string | null
  interviewer: string | null
  interviewer_name: string
  status: 'SCHEDULED' | 'COMPLETED' | 'DECLINED' | 'NO_SHOW' | 'CANCELLED'
  status_display: string
  reason_for_leaving: string
  would_recommend_employer: boolean | null
  would_return: boolean | null
  job_satisfaction: number | null
  management_satisfaction: number | null
  work_environment: number | null
  compensation_satisfaction: number | null
  growth_opportunities: number | null
  work_life_balance: number | null
  liked_most: string
  liked_least: string
  suggestions: string
  reason_detailed: string
  future_plans: string
  confidential_notes: string
  has_attachment: boolean
  attachment_name: string
}

export interface FinalSettlement {
  id: string
  exit_request: string
  status: 'DRAFT' | 'CALCULATED' | 'PENDING_APPROVAL' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'CANCELLED'
  status_display: string
  salary_arrears: number
  leave_encashment: number
  leave_days_encashed: number
  gratuity: number
  bonus: number
  other_earnings: number
  other_earnings_details: string
  loan_balance: number
  advance_balance: number
  asset_deductions: number
  tax_deductions: number
  other_deductions: number
  other_deductions_details: string
  gross_settlement: number
  total_deductions: number
  net_settlement: number
  calculation_notes: string
  calculated_by: string | null
  calculated_by_name: string
  calculated_at: string | null
  approved_by: string | null
  approved_by_name: string
  approved_at: string | null
  paid_at: string | null
  payment_reference: string
}

export interface ExitRequest {
  id: string
  request_number: string
  employee: string
  employee_name: string
  employee_number: string
  department_name: string
  position_name?: string
  exit_type: string
  exit_type_name: string
  exit_type_data?: ExitType
  reason: string
  additional_comments: string
  request_date: string
  notice_start_date: string | null
  proposed_last_day: string
  actual_last_day: string | null
  status: 'DRAFT' | 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS' | 'CLEARANCE' | 'COMPLETED' | 'CANCELLED' | 'WITHDRAWN'
  status_display: string
  submitted_at: string | null
  reviewed_by: string | null
  reviewed_by_name?: string
  reviewed_at: string | null
  review_comments: string
  approved_by: string | null
  approved_by_name?: string
  approved_at: string | null
  approval_comments: string
  completed_by: string | null
  completed_by_name?: string
  completed_at: string | null
  // Related data (detail view)
  clearances?: ExitClearance[]
  asset_returns?: AssetReturn[]
  exit_interview?: ExitInterview
  final_settlement?: FinalSettlement
  is_clearance_complete?: boolean
  pending_clearances_count?: number
  pending_clearances?: number
  total_clearances?: number
  created_at?: string
  updated_at?: string
}

export interface ExitStats {
  total: number
  pending_approval: number
  in_clearance: number
  completed_this_month: number
  by_type: { exit_type__name: string; count: number }[]
  by_status: { status: string; count: number }[]
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// API Service
export const exitService = {
  // Exit Types
  getExitTypes: async (): Promise<ExitType[]> => {
    const response = await api.get('/exits/types/')
    return response.data
  },

  createExitType: async (data: Partial<ExitType>): Promise<ExitType> => {
    const response = await api.post('/exits/types/', data)
    return response.data
  },

  updateExitType: async (id: string, data: Partial<ExitType>): Promise<ExitType> => {
    const response = await api.patch(`/exits/types/${id}/`, data)
    return response.data
  },

  deleteExitType: async (id: string): Promise<void> => {
    await api.delete(`/exits/types/${id}/`)
  },

  // Clearance Departments
  getClearanceDepartments: async (): Promise<ClearanceDepartment[]> => {
    const response = await api.get('/exits/departments/')
    return response.data
  },

  createClearanceDepartment: async (data: Partial<ClearanceDepartment>): Promise<ClearanceDepartment> => {
    const response = await api.post('/exits/departments/', data)
    return response.data
  },

  updateClearanceDepartment: async (id: string, data: Partial<ClearanceDepartment>): Promise<ClearanceDepartment> => {
    const response = await api.patch(`/exits/departments/${id}/`, data)
    return response.data
  },

  deleteClearanceDepartment: async (id: string): Promise<void> => {
    await api.delete(`/exits/departments/${id}/`)
  },

  // Exit Requests
  getExitRequests: async (params?: Record<string, any>): Promise<PaginatedResponse<ExitRequest>> => {
    const response = await api.get('/exits/requests/', { params })
    return response.data
  },

  getExitRequest: async (id: string): Promise<ExitRequest> => {
    const response = await api.get(`/exits/requests/${id}/`)
    return response.data
  },

  createExitRequest: async (data: Partial<ExitRequest>): Promise<ExitRequest> => {
    const response = await api.post('/exits/requests/', data)
    return response.data
  },

  updateExitRequest: async (id: string, data: Partial<ExitRequest>): Promise<ExitRequest> => {
    const response = await api.patch(`/exits/requests/${id}/`, data)
    return response.data
  },

  deleteExitRequest: async (id: string): Promise<void> => {
    await api.delete(`/exits/requests/${id}/`)
  },

  getExitStats: async (): Promise<ExitStats> => {
    const response = await api.get('/exits/requests/stats/')
    return response.data
  },

  getMyExitRequests: async (): Promise<ExitRequest[]> => {
    const response = await api.get('/exits/requests/my_requests/')
    return response.data
  },

  getPendingApproval: async (): Promise<ExitRequest[]> => {
    const response = await api.get('/exits/requests/pending_approval/')
    return response.data
  },

  getPendingClearance: async (): Promise<ExitRequest[]> => {
    const response = await api.get('/exits/requests/pending_clearance/')
    return response.data
  },

  submitExitRequest: async (id: string): Promise<ExitRequest> => {
    const response = await api.post(`/exits/requests/${id}/submit/`)
    return response.data
  },

  approveExitRequest: async (id: string, action: 'approve' | 'reject', comments?: string, actualLastDay?: string): Promise<ExitRequest> => {
    const response = await api.post(`/exits/requests/${id}/approve/`, {
      action,
      comments,
      actual_last_day: actualLastDay,
    })
    return response.data
  },

  completeExitRequest: async (id: string): Promise<ExitRequest> => {
    const response = await api.post(`/exits/requests/${id}/complete/`)
    return response.data
  },

  withdrawExitRequest: async (id: string): Promise<ExitRequest> => {
    const response = await api.post(`/exits/requests/${id}/withdraw/`)
    return response.data
  },

  // Exit Interviews
  getExitInterviews: async (params?: Record<string, any>): Promise<ExitInterview[]> => {
    const response = await api.get('/exits/interviews/', { params })
    return response.data
  },

  getExitInterview: async (id: string): Promise<ExitInterview> => {
    const response = await api.get(`/exits/interviews/${id}/`)
    return response.data
  },

  updateExitInterview: async (id: string, data: Partial<ExitInterview>): Promise<ExitInterview> => {
    const response = await api.patch(`/exits/interviews/${id}/`, data)
    return response.data
  },

  getPendingInterviews: async (): Promise<ExitInterview[]> => {
    const response = await api.get('/exits/interviews/pending/')
    return response.data
  },

  completeInterview: async (id: string, data: Partial<ExitInterview>): Promise<ExitInterview> => {
    const response = await api.post(`/exits/interviews/${id}/complete/`, data)
    return response.data
  },

  // Clearances
  getExitClearances: async (params?: Record<string, any>): Promise<ExitClearance[]> => {
    const response = await api.get('/exits/clearances/', { params })
    return response.data
  },

  getClearance: async (id: string): Promise<ExitClearance> => {
    const response = await api.get(`/exits/clearances/${id}/`)
    return response.data
  },

  getMyPendingClearances: async (): Promise<ExitClearance[]> => {
    const response = await api.get('/exits/clearances/my_pending/')
    return response.data
  },

  clearClearance: async (id: string, data: {
    comments?: string
    outstanding_items?: string
    conditions?: string
    amount_owed?: number
    amount_due?: number
  }): Promise<ExitClearance> => {
    const response = await api.post(`/exits/clearances/${id}/clear/`, data)
    return response.data
  },

  updateChecklistItem: async (clearanceId: string, itemId: string, isCompleted: boolean, notes?: string): Promise<ExitChecklistItem> => {
    const response = await api.post(`/exits/clearances/${clearanceId}/update_checklist/`, {
      item_id: itemId,
      is_completed: isCompleted,
      notes,
    })
    return response.data
  },

  // Asset Returns
  getAssetReturns: async (params?: Record<string, any>): Promise<AssetReturn[]> => {
    const response = await api.get('/exits/assets/', { params })
    return response.data
  },

  createAssetReturn: async (data: Partial<AssetReturn>): Promise<AssetReturn> => {
    const response = await api.post('/exits/assets/', data)
    return response.data
  },

  updateAssetReturn: async (id: string, data: Partial<AssetReturn>): Promise<AssetReturn> => {
    const response = await api.patch(`/exits/assets/${id}/`, data)
    return response.data
  },

  deleteAssetReturn: async (id: string): Promise<void> => {
    await api.delete(`/exits/assets/${id}/`)
  },

  getPendingAssets: async (): Promise<AssetReturn[]> => {
    const response = await api.get('/exits/assets/pending/')
    return response.data
  },

  processAssetReturn: async (id: string, status: AssetReturn['status'], conditionNotes?: string, deductionAmount?: number): Promise<AssetReturn> => {
    const response = await api.post(`/exits/assets/${id}/process_return/`, {
      status,
      condition_notes: conditionNotes,
      deduction_amount: deductionAmount,
    })
    return response.data
  },

  // Final Settlements
  getSettlements: async (params?: Record<string, any>): Promise<FinalSettlement[]> => {
    const response = await api.get('/exits/settlements/', { params })
    return response.data
  },

  getSettlement: async (id: string): Promise<FinalSettlement> => {
    const response = await api.get(`/exits/settlements/${id}/`)
    return response.data
  },

  calculateSettlement: async (id: string, data: Partial<FinalSettlement>): Promise<FinalSettlement> => {
    const response = await api.post(`/exits/settlements/${id}/calculate/`, data)
    return response.data
  },

  approveSettlement: async (id: string): Promise<FinalSettlement> => {
    const response = await api.post(`/exits/settlements/${id}/approve/`)
    return response.data
  },

  markSettlementPaid: async (id: string, paymentReference: string): Promise<FinalSettlement> => {
    const response = await api.post(`/exits/settlements/${id}/mark_paid/`, {
      payment_reference: paymentReference,
    })
    return response.data
  },
}
