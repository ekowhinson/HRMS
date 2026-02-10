import api from '@/lib/api'

export interface SalaryUpgradeCreateData {
  employee: string
  new_notch: string
  new_grade?: string
  new_position?: string
  reason: string
  effective_from: string
  description?: string
}

export interface SalaryUpgradeBulkData {
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
  new_notch: string
  new_grade?: string
  new_position?: string
  reason: string
  effective_from: string
  description?: string
}

export interface SalaryUpgradePreview {
  employee_id: string
  employee_number: string
  employee_name: string
  current_band: string
  current_level: string
  current_notch: string
  current_amount: number
  current_grade: string
  current_position: string
  new_band: string
  new_level: string
  new_notch: string
  new_amount: number
  new_grade: string
  new_position: string
  salary_diff: number
  processing_period: string | null
}

export interface SalaryUpgradeRequest {
  id: string
  reference_number: string
  employee: string
  employee_number: string
  employee_name: string
  new_notch: string
  new_notch_display: string | null
  new_notch_amount: number
  current_notch_display: string | null
  current_salary: number
  salary_diff: number
  new_grade: string | null
  new_grade_name: string | null
  new_position: string | null
  new_position_title: string | null
  current_grade_name: string | null
  current_position_title: string | null
  reason: string
  reason_display: string
  effective_from: string
  description: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  status_display: string
  is_bulk: boolean
  bulk_reference: string
  approved_by: string | null
  approved_by_name: string | null
  approved_at: string | null
  rejection_reason: string
  processing_period: string | null
  processing_period_name: string | null
  created_at: string
  updated_at: string
}

export interface SalaryUpgradeBulkResult {
  bulk_reference: string
  count: number
  skipped: number
  skipped_employees: { id: string; employee_number: string; name: string; reason: string }[]
  errors: { id: string; employee_number: string; name: string; error: string }[]
}

export interface UpgradeRequestFilters {
  search?: string
  status?: string
  date_from?: string
  date_to?: string
  page?: number
}

export const salaryUpgradeService = {
  getRequests: async (params?: UpgradeRequestFilters): Promise<{
    count: number
    next: string | null
    previous: string | null
    results: SalaryUpgradeRequest[]
  }> => {
    const response = await api.get('/payroll/salary-upgrades/', { params })
    return response.data
  },

  create: async (data: SalaryUpgradeCreateData): Promise<SalaryUpgradeRequest> => {
    const response = await api.post('/payroll/salary-upgrades/', data)
    return response.data
  },

  approve: async (id: string): Promise<SalaryUpgradeRequest> => {
    const response = await api.post(`/payroll/salary-upgrades/${id}/approve/`)
    return response.data
  },

  reject: async (id: string, rejection_reason: string): Promise<SalaryUpgradeRequest> => {
    const response = await api.post(`/payroll/salary-upgrades/${id}/reject/`, { rejection_reason })
    return response.data
  },

  preview: async (data: {
    employee: string
    new_notch: string
    new_grade?: string
    new_position?: string
  }): Promise<SalaryUpgradePreview> => {
    const response = await api.post('/payroll/salary-upgrades/preview/', data)
    return response.data
  },

  bulkCreate: async (data: SalaryUpgradeBulkData): Promise<SalaryUpgradeBulkResult> => {
    const response = await api.post('/payroll/salary-upgrades/bulk-create/', data)
    return response.data
  },
}
