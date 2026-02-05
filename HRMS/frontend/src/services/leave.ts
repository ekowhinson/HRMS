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
    return response.data.results || response.data
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
    return response.data.results || response.data
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
    return response.data.results || response.data
  },

  // Get employee leave balances
  getEmployeeBalances: async (employeeId: string): Promise<LeaveBalance[]> => {
    const response = await api.get(`/leave/employees/${employeeId}/balances/`)
    return response.data
  },

  // Get pending approvals (for managers)
  getPendingApprovals: async (): Promise<LeaveRequest[]> => {
    const response = await api.get('/leave/pending-approvals/')
    return response.data.results || response.data
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
    return response.data
  },
}
