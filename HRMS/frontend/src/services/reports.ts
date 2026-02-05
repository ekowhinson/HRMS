import api from '@/lib/api'

export type ExportFormat = 'csv' | 'excel' | 'pdf'

const getFileExtension = (format: ExportFormat): string => {
  switch (format) {
    case 'excel':
      return 'xlsx'
    case 'pdf':
      return 'pdf'
    default:
      return 'csv'
  }
}

const downloadFile = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export const reportsService = {
  // Employee reports
  async exportEmployeeMaster(
    filters?: {
      department?: string
      grade?: string
      status?: string
    },
    format: ExportFormat = 'csv'
  ): Promise<void> {
    const params = new URLSearchParams()
    if (filters?.department) params.append('department', filters.department)
    if (filters?.grade) params.append('grade', filters.grade)
    if (filters?.status) params.append('status', filters.status)
    params.append('file_format', format)

    const response = await api.get(`/reports/export/employees/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `employee_master_${Date.now()}.${getFileExtension(format)}`)
  },

  async exportHeadcount(format: ExportFormat = 'csv'): Promise<void> {
    const response = await api.get(`/reports/export/headcount/?file_format=${format}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `headcount_${Date.now()}.${getFileExtension(format)}`)
  },

  // Payroll reports
  async exportPayrollSummary(payrollRunId?: string, format: ExportFormat = 'csv'): Promise<void> {
    const params = new URLSearchParams()
    if (payrollRunId) params.append('payroll_run', payrollRunId)
    params.append('file_format', format)

    const response = await api.get(`/reports/export/payroll/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `payroll_summary_${Date.now()}.${getFileExtension(format)}`)
  },

  async exportPAYEReport(payrollRunId?: string, format: ExportFormat = 'csv'): Promise<void> {
    const params = new URLSearchParams()
    if (payrollRunId) params.append('payroll_run', payrollRunId)
    params.append('file_format', format)

    const response = await api.get(`/reports/export/paye/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `paye_report_${Date.now()}.${getFileExtension(format)}`)
  },

  async exportSSNITReport(payrollRunId?: string, format: ExportFormat = 'csv'): Promise<void> {
    const params = new URLSearchParams()
    if (payrollRunId) params.append('payroll_run', payrollRunId)
    params.append('file_format', format)

    const response = await api.get(`/reports/export/ssnit/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `ssnit_report_${Date.now()}.${getFileExtension(format)}`)
  },

  async exportBankAdvice(payrollRunId?: string, format: ExportFormat = 'csv'): Promise<void> {
    const params = new URLSearchParams()
    if (payrollRunId) params.append('payroll_run', payrollRunId)
    params.append('file_format', format)

    const response = await api.get(`/reports/export/bank-advice/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `bank_advice_${Date.now()}.${getFileExtension(format)}`)
  },

  async exportPayrollMaster(
    filters?: {
      payroll_run?: string
      department?: string
    },
    format: ExportFormat = 'csv'
  ): Promise<void> {
    const params = new URLSearchParams()
    if (filters?.payroll_run) params.append('payroll_run', filters.payroll_run)
    if (filters?.department) params.append('department', filters.department)
    params.append('file_format', format)

    const response = await api.get(`/reports/export/payroll-master/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `payroll_master_${Date.now()}.${getFileExtension(format)}`)
  },

  // Leave reports
  async exportLeaveBalance(
    filters?: {
      year?: string
      department?: string
    },
    format: ExportFormat = 'csv'
  ): Promise<void> {
    const params = new URLSearchParams()
    if (filters?.year) params.append('year', filters.year)
    if (filters?.department) params.append('department', filters.department)
    params.append('file_format', format)

    const response = await api.get(`/reports/export/leave-balance/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `leave_balance_${Date.now()}.${getFileExtension(format)}`)
  },

  // Loan reports
  async exportLoanOutstanding(
    filters?: {
      department?: string
    },
    format: ExportFormat = 'csv'
  ): Promise<void> {
    const params = new URLSearchParams()
    if (filters?.department) params.append('department', filters.department)
    params.append('file_format', format)

    const response = await api.get(`/reports/export/loans/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `outstanding_loans_${Date.now()}.${getFileExtension(format)}`)
  },

  // Generic report data fetchers (for viewing in browser)
  async getEmployeeMaster(filters?: Record<string, string>) {
    const params = new URLSearchParams(filters)
    const response = await api.get(`/reports/employees/master/?${params.toString()}`)
    return response.data
  },

  async getHeadcount() {
    const response = await api.get('/reports/employees/headcount/')
    return response.data
  },

  async getPayrollSummary(payrollRunId?: string) {
    const params = payrollRunId ? `?payroll_run=${payrollRunId}` : ''
    const response = await api.get(`/reports/payroll/summary/${params}`)
    return response.data
  },

  async getPayrollMaster(filters?: {
    payroll_run?: string
    department?: string
    employee?: string
  }) {
    const params = new URLSearchParams()
    if (filters?.payroll_run) params.append('payroll_run', filters.payroll_run)
    if (filters?.department) params.append('department', filters.department)
    if (filters?.employee) params.append('employee', filters.employee)
    const response = await api.get(`/reports/payroll/master/?${params.toString()}`)
    return response.data
  },

  async getPAYEReport(payrollRunId?: string) {
    const params = payrollRunId ? `?payroll_run=${payrollRunId}` : ''
    const response = await api.get(`/reports/statutory/paye/${params}`)
    return response.data
  },

  async getSSNITReport(payrollRunId?: string) {
    const params = payrollRunId ? `?payroll_run=${payrollRunId}` : ''
    const response = await api.get(`/reports/statutory/ssnit/${params}`)
    return response.data
  },

  async getLeaveBalance(filters?: Record<string, string>) {
    const params = new URLSearchParams(filters)
    const response = await api.get(`/reports/leave/balance/?${params.toString()}`)
    return response.data
  },

  async getLoanOutstanding(filters?: Record<string, string>) {
    const params = new URLSearchParams(filters)
    const response = await api.get(`/reports/loans/outstanding/?${params.toString()}`)
    return response.data
  },
}
