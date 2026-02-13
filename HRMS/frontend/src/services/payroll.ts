import api from '@/lib/api'
import type { PayrollRun, PayrollItem, PayrollPeriod, Payslip, PaginatedResponse } from '@/types'

export const payrollService = {
  // Get payroll periods
  getPeriods: async (): Promise<PayrollPeriod[]> => {
    const response = await api.get('/payroll/periods/')
    return response.data.results || response.data
  },

  // Alias for getPeriods
  getPayrollPeriods: async (): Promise<PayrollPeriod[]> => {
    const response = await api.get('/payroll/periods/')
    return response.data.results || response.data
  },

  // Reopen a payroll period (for COMPUTED or APPROVED periods)
  async reopenPeriod(periodId: string, force?: boolean): Promise<any> {
    const response = await api.post(`/payroll/periods/${periodId}/reopen/`, { force })
    return response.data
  },

  // Get payroll runs
  getRuns: async (periodId?: string): Promise<PayrollRun[]> => {
    const params = periodId ? { payroll_period: periodId } : {}
    const response = await api.get('/payroll/runs/', { params })
    return response.data.results || response.data
  },

  // Alias for getRuns
  getPayrollRuns: async (periodId?: string): Promise<PaginatedResponse<PayrollRun>> => {
    const params = periodId ? { payroll_period: periodId } : {}
    const response = await api.get('/payroll/runs/', { params })
    return response.data
  },

  async getPayrollRun(id: string): Promise<PayrollRun> {
    const response = await api.get(`/payroll/runs/${id}/`)
    return response.data
  },

  async createPayrollRun(periodId: string): Promise<PayrollRun> {
    const response = await api.post('/payroll/runs/', { payroll_period: periodId })
    return response.data
  },

  async computePayroll(runId: string): Promise<any> {
    const response = await api.post(`/payroll/runs/${runId}/compute/`)
    return response.data
  },

  // Get payroll computation progress
  async getComputeProgress(runId: string): Promise<any> {
    const response = await api.get(`/payroll/runs/${runId}/progress/`)
    return response.data
  },

  // Recompute payroll (for DRAFT, COMPUTED, or REJECTED runs)
  async recomputePayroll(runId: string): Promise<any> {
    const response = await api.post(`/payroll/runs/${runId}/recompute/`)
    return response.data
  },

  // Reset payroll run to DRAFT status
  async resetToDraft(runId: string): Promise<any> {
    const response = await api.post(`/payroll/runs/${runId}/reset_to_draft/`)
    return response.data
  },

  // Delete a payroll run (only DRAFT status)
  async deletePayrollRun(runId: string): Promise<any> {
    const response = await api.delete(`/payroll/runs/${runId}/`)
    return response.data
  },

  async approvePayroll(runId: string, comments?: string): Promise<any> {
    const response = await api.post(`/payroll/runs/${runId}/approve/`, {
      action: 'approve',
      comments
    })
    return response.data
  },

  async rejectPayroll(runId: string, comments: string): Promise<any> {
    const response = await api.post(`/payroll/runs/${runId}/approve/`, {
      action: 'reject',
      comments
    })
    return response.data
  },

  async processPayment(runId: string, paymentReference?: string): Promise<any> {
    const response = await api.post(`/payroll/runs/${runId}/process-payment/`, {
      payment_reference: paymentReference
    })
    return response.data
  },

  async getPayrollItems(runId: string): Promise<PayrollItem[]> {
    const response = await api.get(`/payroll/runs/${runId}/items/`)
    return response.data.results || response.data
  },

  async getPayrollErrorItems(runId: string): Promise<PayrollItem[]> {
    const response = await api.get(`/payroll/runs/${runId}/items/`, { params: { status: 'ERROR' } })
    return response.data.results || response.data
  },

  // Get payslips for a specific employee (admin view with full breakdown)
  getEmployeePayslips: async (employeeId: string): Promise<any[]> => {
    const response = await api.get(`/payroll/employee/${employeeId}/payslips/`)
    return response.data.results || response.data || []
  },

  // Get my payslips
  getMyPayslips: async (): Promise<Payslip[]> => {
    const response = await api.get('/payroll/my-payslips/')
    return response.data.results || response.data || []
  },

  // Download a payslip as PDF (admin - uses Payslip model ID)
  downloadPayslip: async (payslipId: string): Promise<void> => {
    const response = await api.get(`/payroll/payslips/${payslipId}/download/`, {
      responseType: 'blob',
    })
    const blob = new Blob([response.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `payslip-${payslipId}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  },

  // Download own payslip as PDF (self-service - uses PayrollItem ID)
  downloadMyPayslip: async (itemId: string): Promise<void> => {
    const response = await api.get(`/payroll/my-payslips/${itemId}/download/`, {
      responseType: 'blob',
    })
    const blob = new Blob([response.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `payslip-${itemId}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  },

  // Generate bank files
  async generateBankFiles(runId: string): Promise<any> {
    const response = await api.post(`/payroll/runs/${runId}/generate-bank-file/`)
    return response.data
  },

  // Download bank file
  async downloadBankFile(runId: string, _bankName?: string): Promise<void> {
    const response = await api.post(
      `/payroll/runs/${runId}/generate-bank-file/`,
      { format: 'CSV' }
    )

    // If files are generated, download them
    if (response.data.data?.files) {
      for (const file of response.data.data.files) {
        if (file.file_url) {
          window.open(file.file_url, '_blank')
        }
      }
    }
  },

  // Generate payslips
  async generatePayslips(runId: string): Promise<any> {
    const response = await api.post(`/payroll/runs/${runId}/generate-payslips/`)
    return response.data
  },

  // Close a payroll period (PAID -> CLOSED)
  async closePeriod(periodId: string): Promise<any> {
    const response = await api.post(`/payroll/periods/${periodId}/close/`)
    return response.data
  },

  async getPayrollSummary(runId?: string): Promise<{
    total_employees: number
    total_gross: number
    total_deductions: number
    total_net: number
    total_paye: number
    total_ssnit_employee: number
    total_ssnit_employer: number
  }> {
    const params = runId ? `?payroll_run=${runId}` : ''
    const response = await api.get(`/reports/payroll/summary/${params}`)
    return response.data.summary
  },

  // ============================================
  // Payroll Validation
  // ============================================

  getValidations: async (periodId?: string): Promise<any[]> => {
    const params = periodId ? { payroll_period: periodId } : {}
    const response = await api.get('/payroll/validations/', { params })
    return response.data.results || response.data
  },

  getValidation: async (id: string): Promise<any> => {
    const response = await api.get(`/payroll/validations/${id}/`)
    return response.data
  },

  openValidationWindow: async (periodId: string, deadline?: string): Promise<any> => {
    const response = await api.post('/payroll/validations/open-window/', { period_id: periodId, deadline })
    return response.data
  },

  submitValidation: async (id: string, notes?: string): Promise<any> => {
    const response = await api.post(`/payroll/validations/${id}/submit/`, { notes })
    return response.data
  },

  flagEmployee: async (validationId: string, data: { employee: string; removal_reason: string; reason_detail?: string }): Promise<any> => {
    const response = await api.post(`/payroll/validations/${validationId}/flag-employee/`, data)
    return response.data
  },

  reinstateEmployee: async (validationId: string, employeeId: string): Promise<any> => {
    const response = await api.post(`/payroll/validations/${validationId}/reinstate-employee/`, { employee_id: employeeId })
    return response.data
  },

  getValidationDashboard: async (periodId: string): Promise<any> => {
    const response = await api.get('/payroll/validations/dashboard/', { params: { period_id: periodId } })
    return response.data
  },

  getMyValidations: async (periodId?: string): Promise<any[]> => {
    const params = periodId ? { period_id: periodId } : {}
    const response = await api.get('/payroll/validations/my-validations/', { params })
    return response.data
  },

  // Regional Director: get validations for their region
  getRegionalValidations: async (periodId?: string, filterStatus?: string): Promise<any[]> => {
    const params: any = {}
    if (periodId) params.period_id = periodId
    if (filterStatus) params.status = filterStatus
    const response = await api.get('/payroll/validations/regional-validations/', { params })
    return response.data
  },

  // Regional Director: approve a submitted validation
  approveValidation: async (id: string, notes?: string): Promise<any> => {
    const response = await api.post(`/payroll/validations/${id}/approve/`, { notes })
    return response.data
  },

  // Regional Director: reject a submitted validation
  rejectValidation: async (id: string, reason: string): Promise<any> => {
    const response = await api.post(`/payroll/validations/${id}/reject/`, { reason })
    return response.data
  },

  // Removal Reasons
  getRemovalReasons: async (): Promise<any[]> => {
    const response = await api.get('/payroll/removal-reasons/')
    return response.data.results || response.data
  },

  createRemovalReason: async (data: { code: string; name: string; description?: string; is_active?: boolean; sort_order?: number }): Promise<any> => {
    const response = await api.post('/payroll/removal-reasons/', data)
    return response.data
  },

  updateRemovalReason: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/payroll/removal-reasons/${id}/`, data)
    return response.data
  },

  deleteRemovalReason: async (id: string): Promise<void> => {
    await api.delete(`/payroll/removal-reasons/${id}/`)
  },
}
