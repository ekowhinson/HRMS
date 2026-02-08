import api from '@/lib/api'
import type { BackpayRequest, PaginatedResponse } from '@/types'

export interface BackpayFilters {
  status?: string
  reason?: string
  employee?: string
  payroll_period?: string
  search?: string
  page?: number
}

export interface BackpayCreateData {
  employee: string
  reason: string
  description?: string
  effective_from: string
  effective_to: string
  reference_period?: string
}

export interface BackpayPreviewData {
  employee: string
  reason: string
  effective_from: string
  effective_to: string
}

export interface BackpayBulkCreateData {
  all_active?: boolean
  employee_ids?: string[]
  division?: string
  directorate?: string
  department?: string
  grade?: string
  region?: string
  district?: string
  work_location?: string
  staff_category?: string
  reason: string
  description?: string
  effective_from: string
  effective_to: string
}

export interface BackpayBulkCreateResult {
  count: number
  skipped: number
  skipped_employees: { id: string; employee_number: string; name: string }[]
}

export interface BackpayBulkProcessResult {
  processed: number
  total: number
  percentage: number
  calculated: number
  approved: number
  zero_arrears: number
  errors: { request_id: string; employee: string; step: string; error: string }[]
  status: 'processing' | 'completed' | 'failed'
  current_employee: string
}

export interface RetropayChange {
  type: string
  description: string
  affected_period: string
  created_at: string
}

export interface RetropayDetection {
  employee_id: string
  employee_number: string
  employee_name: string
  changes: RetropayChange[]
  affected_periods: { id: string; name: string }[]
  earliest_from: string
  latest_to: string
}

export interface RetropayDetectionResult {
  count: number
  detections: RetropayDetection[]
}

export interface AutoCreateRetropayResult {
  count: number
  skipped: number
  skipped_employees: { employee_id: string; employee_number: string; name: string; reason: string }[]
  message?: string
}

export const backpayService = {
  getRequests: async (params?: BackpayFilters): Promise<PaginatedResponse<BackpayRequest>> => {
    const response = await api.get('/payroll/backpay/', { params })
    return response.data
  },

  getRequest: async (id: string): Promise<BackpayRequest> => {
    const response = await api.get(`/payroll/backpay/${id}/`)
    return response.data
  },

  createRequest: async (data: BackpayCreateData): Promise<BackpayRequest> => {
    const response = await api.post('/payroll/backpay/', data)
    return response.data
  },

  deleteRequest: async (id: string): Promise<void> => {
    await api.delete(`/payroll/backpay/${id}/`)
  },

  calculateRequest: async (id: string): Promise<BackpayRequest> => {
    const response = await api.post(`/payroll/backpay/${id}/calculate/`)
    return response.data
  },

  approveRequest: async (id: string): Promise<BackpayRequest> => {
    const response = await api.post(`/payroll/backpay/${id}/approve/`)
    return response.data
  },

  cancelRequest: async (id: string): Promise<BackpayRequest> => {
    const response = await api.post(`/payroll/backpay/${id}/cancel/`)
    return response.data
  },

  previewCalculation: async (data: BackpayPreviewData): Promise<any> => {
    const response = await api.post('/payroll/backpay/preview/', data)
    return response.data
  },

  bulkCreateRequests: async (data: BackpayBulkCreateData): Promise<BackpayBulkCreateResult> => {
    const response = await api.post('/payroll/backpay/bulk-create/', data)
    return response.data
  },

  bulkProcess: async (): Promise<{ batch_id: string; total: number }> => {
    const response = await api.post('/payroll/backpay/bulk-process/')
    return response.data
  },

  getBulkProcessProgress: async (batchId: string): Promise<BackpayBulkProcessResult> => {
    const response = await api.get('/payroll/backpay/bulk-process-progress/', {
      params: { batch_id: batchId },
    })
    return response.data
  },

  bulkDeleteByPeriod: async (payrollPeriod: string): Promise<{ deleted: number }> => {
    const response = await api.post('/payroll/backpay/bulk-delete/', {
      payroll_period: payrollPeriod,
    })
    return response.data
  },

  bulkApprove: async (): Promise<{ approved: number }> => {
    const response = await api.post('/payroll/backpay/bulk-approve/')
    return response.data
  },

  detectRetropay: async (): Promise<RetropayDetectionResult> => {
    const response = await api.get('/payroll/backpay/detect-retropay/')
    return response.data
  },

  autoCreateRetropay: async (): Promise<AutoCreateRetropayResult> => {
    const response = await api.post('/payroll/backpay/auto-create-retropay/')
    return response.data
  },
}
