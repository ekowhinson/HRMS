import api from '@/lib/api'

export interface PayrollSetupSummary {
  employee_count: number
  sheet_counts: Record<string, number>
  bands_found: string[]
  band_allowance_types: Record<string, string[]>
  deduction_counts: {
    provident_fund: number
    unicof: number
    pawu: number
    rent_deduction: number
  }
  vehicle_employees: number
  transport_employees: number
  bank_accounts: number
  components_to_create: number
  tax_brackets_to_create: number
  ssnit_rates_to_create: number
  errors: string[]
  warnings: string[]
}

export interface PayrollUploadResponse {
  task_id: string
  summary: PayrollSetupSummary
  allowances_preview: Record<string, string[]>
  staff_preview: {
    total_employees: number
    sample: any[]
  }
}

export interface PayrollProgress {
  phase: number
  total_phases: number
  phase_name: string
  phase_progress: number
  overall_progress: number
  details: Record<string, any>
  status: 'processing' | 'completed' | 'failed'
  log: string[]
  results: PayrollResults
}

export interface PayrollResults {
  employees_graded: number
  nia_updated: number
  bank_accounts_updated: number
  tax_brackets_created: number
  ssnit_rates_created: number
  overtime_config_created: number
  pay_components_created: number
  employee_salaries_created: number
  transactions_created: number
  errors: string[]
}

export interface PayrollExecuteResponse {
  task_id: string
  status: 'completed' | 'failed'
  results?: PayrollResults
  error?: string
}

export interface PayrollResetResponse {
  status: string
  message: string
  deleted: Record<string, number>
}

export const payrollSetupService = {
  upload: async (allowancesFile: File, staffDataFile: File): Promise<PayrollUploadResponse> => {
    const formData = new FormData()
    formData.append('allowances_file', allowancesFile)
    formData.append('staff_data_file', staffDataFile)
    const response = await api.post('/imports/payroll-setup/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  execute: async (taskId: string): Promise<PayrollExecuteResponse> => {
    const response = await api.post('/imports/payroll-setup/execute/', { task_id: taskId })
    return response.data
  },

  getProgress: async (taskId: string): Promise<PayrollProgress> => {
    const response = await api.get(`/imports/payroll-setup/progress/${taskId}/`)
    return response.data
  },

  reset: async (): Promise<PayrollResetResponse> => {
    const response = await api.post('/imports/payroll-setup/reset/')
    return response.data
  },
}
