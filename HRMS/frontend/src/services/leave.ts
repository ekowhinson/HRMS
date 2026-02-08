import api from '@/lib/api'
import type { LeaveRequest, LeaveBalance, LeaveType, PaginatedResponse } from '@/types'

export interface LeaveFilters {
  status?: string
  leave_type?: string
  employee?: string
  page?: number
}

export interface LeaveTypeFilters {
  is_active?: boolean
  is_paid?: boolean
  search?: string
}

export const leaveService = {
  // ==================== Leave Types ====================

  // Get all leave types with optional filters
  getLeaveTypes: async (filters?: LeaveTypeFilters): Promise<LeaveType[]> => {
    const response = await api.get('/leave/types/', { params: filters })
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load leave types')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  // Get single leave type
  getLeaveType: async (id: string): Promise<LeaveType> => {
    const response = await api.get(`/leave/types/${id}/`)
    return response.data
  },

  // Create new leave type
  createLeaveType: async (data: Partial<LeaveType>): Promise<LeaveType> => {
    const response = await api.post('/leave/types/', data)
    return response.data
  },

  // Update leave type
  updateLeaveType: async (id: string, data: Partial<LeaveType>): Promise<LeaveType> => {
    const response = await api.patch(`/leave/types/${id}/`, data)
    return response.data
  },

  // Delete leave type
  deleteLeaveType: async (id: string): Promise<void> => {
    await api.delete(`/leave/types/${id}/`)
  },

  // ==================== Leave Requests ====================

  // Get all leave requests with filters
  getLeaveRequests: async (filters: LeaveFilters = {}): Promise<PaginatedResponse<LeaveRequest>> => {
    const response = await api.get('/leave/requests/', { params: filters })
    return response.data
  },

  // Get my leave requests
  getMyRequests: async (): Promise<LeaveRequest[]> => {
    const response = await api.get('/leave/requests/')
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load leave requests')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  // Get single leave request
  getLeaveRequest: async (id: string): Promise<LeaveRequest> => {
    const response = await api.get(`/leave/requests/${id}/`)
    return response.data
  },

  // Create/Apply for leave
  apply: async (data: {
    leave_type: string
    start_date: string
    end_date: string
    reason?: string
  }): Promise<LeaveRequest> => {
    const response = await api.post('/leave/requests/', data)
    return response.data
  },

  // Alias for apply
  createLeaveRequest: async (data: {
    leave_type: string
    start_date: string
    end_date: string
    reason: string
  }): Promise<LeaveRequest> => {
    const response = await api.post('/leave/requests/', data)
    return response.data
  },

  // Submit draft leave request for approval
  submit: async (id: string): Promise<void> => {
    await api.post(`/leave/requests/${id}/submit/`)
  },

  // Approve leave request
  approve: async (id: string): Promise<void> => {
    await api.post(`/leave/requests/${id}/approve/`)
  },

  // Reject leave request
  reject: async (id: string, reason?: string): Promise<void> => {
    await api.post(`/leave/requests/${id}/reject/`, { reason })
  },

  // Cancel leave request
  cancel: async (id: string, reason: string): Promise<void> => {
    await api.post(`/leave/requests/${id}/cancel/`, { reason })
  },

  // Get my leave balances
  getMyBalances: async (): Promise<LeaveBalance[]> => {
    const response = await api.get('/leave/balances/')
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load leave balances')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  // Get employee leave balances
  getEmployeeBalances: async (employeeId: string): Promise<LeaveBalance[]> => {
    const response = await api.get(`/leave/employees/${employeeId}/balances/`)
    return response.data
  },

  // Get pending approvals (for managers)
  getPendingApprovals: async (): Promise<LeaveRequest[]> => {
    const response = await api.get('/leave/pending-approvals/')
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load pending approvals')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  // Get leave calendar (team leave overview)
  getLeaveCalendar: async (params: {
    start_date: string
    end_date: string
    department?: string
    include_plans?: boolean
    status?: string
  }) => {
    const response = await api.get('/leave/calendar/', { params })
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load leave calendar')
    return data
  },

  // ==================== Leave Plans ====================

  getLeavePlans: async (params?: { year?: number; status?: string; employee?: string }) => {
    const response = await api.get('/leave/plans/', { params })
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load leave plans')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  getMyLeavePlans: async () => {
    const response = await api.get('/leave/plans/my_plan/')
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load my leave plans')
    // my_plan returns a single object or message, not array
    if (data?.message) return [] // No plan found
    return Array.isArray(data) ? data : (data ? [data] : [])
  },

  getLeavePlan: async (id: string) => {
    const response = await api.get(`/leave/plans/${id}/`)
    return response.data
  },

  createLeavePlan: async (data: {
    year: number
    leave_entitlement?: number
    brought_forward?: number
    employee_notes?: string
  }) => {
    const response = await api.post('/leave/plans/', data)
    return response.data
  },

  updateLeavePlan: async (id: string, data: Partial<LeavePlan>) => {
    const response = await api.patch(`/leave/plans/${id}/`, data)
    return response.data
  },

  submitLeavePlan: async (id: string) => {
    const response = await api.post(`/leave/plans/${id}/submit/`)
    return response.data
  },

  approveLeavePlan: async (id: string, comments?: string) => {
    const response = await api.post(`/leave/plans/${id}/approve/`, { comments })
    return response.data
  },

  rejectLeavePlan: async (id: string, reason: string) => {
    const response = await api.post(`/leave/plans/${id}/reject/`, { reason })
    return response.data
  },

  requestRevision: async (id: string, reason: string) => {
    const response = await api.post(`/leave/plans/${id}/request_revision/`, { reason })
    return response.data
  },

  getPendingLeavePlans: async () => {
    const response = await api.get('/leave/plans/pending_approval/')
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load pending leave plans')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  getLeavePlanCalendar: async (params: { year?: number; start_date?: string; end_date?: string; department?: string }) => {
    const response = await api.get('/leave/calendar/plans/', { params })
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load leave plan calendar')
    return data
  },

  // ==================== Leave Plan Entries ====================

  getLeavePlanEntries: async (params?: { leave_plan?: string; quarter?: number; status?: string }) => {
    const response = await api.get('/leave/plan-entries/', { params })
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load leave plan entries')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  createLeavePlanEntry: async (data: {
    leave_plan: string
    leave_type: string
    start_date: string
    end_date: string
    number_of_days: number
    description?: string
    quarter?: number
  }) => {
    const response = await api.post('/leave/plan-entries/', data)
    return response.data
  },

  updateLeavePlanEntry: async (id: string, data: Partial<LeavePlanEntry>) => {
    const response = await api.patch(`/leave/plan-entries/${id}/`, data)
    return response.data
  },

  deleteLeavePlanEntry: async (id: string) => {
    await api.delete(`/leave/plan-entries/${id}/`)
  },

  convertEntryToRequest: async (id: string) => {
    const response = await api.post(`/leave/plan-entries/${id}/convert_to_request/`)
    return response.data
  },

  // ==================== Carry Forward ====================

  getCarryForwardRequests: async (params?: { from_year?: number; to_year?: number; status?: string; employee?: string }) => {
    const response = await api.get('/leave/carry-forward/', { params })
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load carry forward requests')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  getMyCarryForwardRequests: async () => {
    const response = await api.get('/leave/carry-forward/my_requests/')
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load my carry forward requests')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  createCarryForwardRequest: async (data: {
    from_year: number
    to_year: number
    available_balance: number
    requested_carry_forward: number
    reason: string
  }) => {
    const response = await api.post('/leave/carry-forward/', data)
    return response.data
  },

  getCarryForwardRequest: async (id: string) => {
    const response = await api.get(`/leave/carry-forward/${id}/`)
    return response.data
  },

  hrReviewCarryForward: async (id: string, action: 'approve' | 'reject', comments?: string) => {
    const response = await api.post(`/leave/carry-forward/${id}/hr_review/`, { action, comments })
    return response.data
  },

  ceoApproveCarryForward: async (id: string, action: 'approve' | 'reject', approved_days?: number, comments?: string) => {
    const response = await api.post(`/leave/carry-forward/${id}/ceo_approve/`, { action, approved_days, comments })
    return response.data
  },

  processCarryForward: async (id: string) => {
    const response = await api.post(`/leave/carry-forward/${id}/process/`)
    return response.data
  },

  getPendingHRReview: async () => {
    const response = await api.get('/leave/carry-forward/pending_hr_review/')
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load pending HR review')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  getPendingCEOApproval: async () => {
    const response = await api.get('/leave/carry-forward/pending_ceo_approval/')
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load pending CEO approval')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  // ==================== Leave Reminders ====================

  getLeaveReminders: async (params?: { year?: number; reminder_type?: string; acknowledged?: boolean }) => {
    const response = await api.get('/leave/reminders/', { params })
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load leave reminders')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  getMyReminders: async () => {
    const response = await api.get('/leave/reminders/my_reminders/')
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load my reminders')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  acknowledgeReminder: async (id: string) => {
    const response = await api.post(`/leave/reminders/${id}/acknowledge/`)
    return response.data
  },

  generateQ4Reminders: async (year?: number, threshold?: number) => {
    const response = await api.post('/leave/reminders/generate_q4_reminders/', { year, threshold })
    return response.data
  },

  // ==================== Workflow Templates ====================

  getWorkflowTemplates: async (params?: Record<string, any>) => {
    const response = await api.get('/leave/workflow-templates/', { params })
    return Array.isArray(response.data) ? response.data : (response.data?.results || [])
  },

  getWorkflowTemplate: async (id: string) => {
    const response = await api.get(`/leave/workflow-templates/${id}/`)
    return response.data
  },

  createWorkflowTemplate: async (data: any) => {
    const response = await api.post('/leave/workflow-templates/', data)
    return response.data
  },

  updateWorkflowTemplate: async (id: string, data: any) => {
    const response = await api.patch(`/leave/workflow-templates/${id}/`, data)
    return response.data
  },

  deleteWorkflowTemplate: async (id: string) => {
    await api.delete(`/leave/workflow-templates/${id}/`)
  },

  // ==================== Workflow Levels ====================

  getWorkflowLevels: async (params?: Record<string, any>) => {
    const response = await api.get('/leave/workflow-levels/', { params })
    return Array.isArray(response.data) ? response.data : (response.data?.results || [])
  },

  getWorkflowLevel: async (id: string) => {
    const response = await api.get(`/leave/workflow-levels/${id}/`)
    return response.data
  },

  createWorkflowLevel: async (data: any) => {
    const response = await api.post('/leave/workflow-levels/', data)
    return response.data
  },

  updateWorkflowLevel: async (id: string, data: any) => {
    const response = await api.patch(`/leave/workflow-levels/${id}/`, data)
    return response.data
  },

  deleteWorkflowLevel: async (id: string) => {
    await api.delete(`/leave/workflow-levels/${id}/`)
  },

  // ==================== Location Mappings ====================

  getLocationMappings: async (params?: Record<string, any>) => {
    const response = await api.get('/leave/location-mappings/', { params })
    return Array.isArray(response.data) ? response.data : (response.data?.results || [])
  },

  getLocationMapping: async (id: string) => {
    const response = await api.get(`/leave/location-mappings/${id}/`)
    return response.data
  },

  createLocationMapping: async (data: any) => {
    const response = await api.post('/leave/location-mappings/', data)
    return response.data
  },

  updateLocationMapping: async (id: string, data: any) => {
    const response = await api.patch(`/leave/location-mappings/${id}/`, data)
    return response.data
  },

  deleteLocationMapping: async (id: string) => {
    await api.delete(`/leave/location-mappings/${id}/`)
  },

  // ==================== Workflow Status ====================

  getWorkflowStatuses: async (params?: Record<string, any>) => {
    const response = await api.get('/leave/workflow-status/', { params })
    return Array.isArray(response.data) ? response.data : (response.data?.results || [])
  },

  getWorkflowStatus: async (id: string) => {
    const response = await api.get(`/leave/workflow-status/${id}/`)
    return response.data
  },

  createWorkflowStatus: async (data: any) => {
    const response = await api.post('/leave/workflow-status/', data)
    return response.data
  },

  updateWorkflowStatus: async (id: string, data: any) => {
    const response = await api.patch(`/leave/workflow-status/${id}/`, data)
    return response.data
  },

  deleteWorkflowStatus: async (id: string) => {
    await api.delete(`/leave/workflow-status/${id}/`)
  },

  // ==================== Reliever Validations ====================

  getRelieverValidations: async (params?: Record<string, any>) => {
    const response = await api.get('/leave/reliever-validations/', { params })
    return Array.isArray(response.data) ? response.data : (response.data?.results || [])
  },

  getRelieverValidation: async (id: string) => {
    const response = await api.get(`/leave/reliever-validations/${id}/`)
    return response.data
  },

  createRelieverValidation: async (data: any) => {
    const response = await api.post('/leave/reliever-validations/', data)
    return response.data
  },

  updateRelieverValidation: async (id: string, data: any) => {
    const response = await api.patch(`/leave/reliever-validations/${id}/`, data)
    return response.data
  },

  deleteRelieverValidation: async (id: string) => {
    await api.delete(`/leave/reliever-validations/${id}/`)
  },

  // ==================== Year-End Processing ====================

  processYearEnd: async (year: number) => {
    const response = await api.post('/leave/year-end/process/', { year })
    return response.data
  },
}

// ==================== Types ====================

export interface LeavePlan {
  id: string
  employee: string
  employee_name: string
  employee_number: string
  year: number
  total_planned_days: number
  leave_entitlement: number
  brought_forward: number
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REVISION'
  status_display: string
  submitted_at: string | null
  approved_at: string | null
  approved_by: string | null
  approved_by_name: string | null
  revision_reason: string
  rejection_reason: string
  employee_notes: string
  manager_comments: string
  entries: LeavePlanEntry[]
  created_at: string
  updated_at: string
}

export interface LeavePlanEntry {
  id: string
  leave_plan: string
  leave_type: string
  leave_type_name: string
  start_date: string
  end_date: string
  number_of_days: number
  status: 'PLANNED' | 'REQUESTED' | 'TAKEN' | 'CANCELLED' | 'RESCHEDULED'
  status_display: string
  leave_request: string | null
  description: string
  quarter: number | null
}

export interface LeaveCarryForwardRequest {
  id: string
  employee: string
  employee_name: string
  employee_number: string
  from_year: number
  to_year: number
  available_balance: number
  standard_carry_forward: number
  requested_carry_forward: number
  additional_days_requested: number
  approved_carry_forward: number | null
  days_to_lapse: number | null
  reason: string
  status: 'PENDING' | 'HR_APPROVED' | 'AWAITING_CEO' | 'CEO_APPROVED' | 'REJECTED' | 'PROCESSED'
  status_display: string
  hr_reviewer: string | null
  hr_reviewer_name: string | null
  hr_reviewed_at: string | null
  hr_comments: string
  ceo_approver: string | null
  ceo_approver_name: string | null
  ceo_approved_at: string | null
  ceo_comments: string
  rejection_reason: string
  created_at: string
}

export interface LeaveReminder {
  id: string
  employee: string
  employee_name: string
  employee_number: string
  year: number
  reminder_type: 'Q4' | 'PLAN_DUE' | 'CF_DEADLINE' | 'BALANCE'
  reminder_type_display: string
  outstanding_balance: number | null
  message: string
  sent_at: string | null
  read_at: string | null
  acknowledged: boolean
  acknowledged_at: string | null
  created_at: string
}
