import api from '@/lib/api'

export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'text'

// Common filter type for all reports
export interface ReportFilters {
  employee_code?: string
  division?: string
  directorate?: string
  department?: string
  position?: string
  grade?: string
  salary_band?: string
  salary_level?: string
  staff_category?: string
  status?: string
  period?: string
  payroll_run?: string
  bank?: string
  year?: string
  month?: string
  date_from?: string
  date_to?: string
  [key: string]: string | undefined
}

const getFileExtension = (format: ExportFormat): string => {
  switch (format) {
    case 'excel':
      return 'xlsx'
    case 'pdf':
      return 'pdf'
    case 'text':
      return 'txt'
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

// Helper to build query params from filters
const buildParams = (filters: ReportFilters | undefined, format: ExportFormat): URLSearchParams => {
  const params = new URLSearchParams()

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value.trim() !== '') {
        params.append(key, value)
      }
    })
  }

  params.append('file_format', format)
  return params
}

export const reportsService = {
  // Employee reports
  async exportEmployeeMaster(
    filters?: ReportFilters,
    format: ExportFormat = 'csv'
  ): Promise<void> {
    const params = buildParams(filters, format)

    const response = await api.get(`/reports/export/employees/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `employee_master_${Date.now()}.${getFileExtension(format)}`)
  },

  async exportHeadcount(
    format: ExportFormat = 'csv',
    filters?: ReportFilters
  ): Promise<void> {
    const params = buildParams(filters, format)

    const response = await api.get(`/reports/export/headcount/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `headcount_${Date.now()}.${getFileExtension(format)}`)
  },

  // Payroll reports
  async exportPayrollSummary(
    payrollRunId?: string,
    format: ExportFormat = 'csv',
    filters?: ReportFilters
  ): Promise<void> {
    const params = buildParams(filters, format)
    if (payrollRunId) params.set('payroll_run', payrollRunId)

    const response = await api.get(`/reports/export/payroll/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `payroll_summary_${Date.now()}.${getFileExtension(format)}`)
  },

  async exportPAYEReport(
    payrollRunId?: string,
    format: ExportFormat = 'csv',
    filters?: ReportFilters
  ): Promise<void> {
    const params = buildParams(filters, format)
    if (payrollRunId) params.set('payroll_run', payrollRunId)

    const response = await api.get(`/reports/export/paye/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `paye_report_${Date.now()}.${getFileExtension(format)}`)
  },

  async exportPAYEGRAReport(
    payrollRunId?: string,
    format: ExportFormat = 'excel',
    filters?: ReportFilters
  ): Promise<void> {
    const params = buildParams(filters, format)
    if (payrollRunId) params.set('payroll_run', payrollRunId)

    const response = await api.get(`/reports/export/paye-gra/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `paye_gra_${Date.now()}.${getFileExtension(format)}`)
  },

  async exportSSNITReport(
    payrollRunId?: string,
    format: ExportFormat = 'csv',
    filters?: ReportFilters
  ): Promise<void> {
    const params = buildParams(filters, format)
    if (payrollRunId) params.set('payroll_run', payrollRunId)

    const response = await api.get(`/reports/export/ssnit/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `ssnit_report_${Date.now()}.${getFileExtension(format)}`)
  },

  async exportBankAdvice(
    payrollRunId?: string,
    format: ExportFormat = 'csv',
    filters?: ReportFilters
  ): Promise<void> {
    const params = buildParams(filters, format)
    if (payrollRunId) params.set('payroll_run', payrollRunId)

    const response = await api.get(`/reports/export/bank-advice/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `bank_advice_${Date.now()}.${getFileExtension(format)}`)
  },

  async exportPayrollMaster(
    filters?: ReportFilters,
    format: ExportFormat = 'csv'
  ): Promise<void> {
    const params = buildParams(filters, format)

    const response = await api.get(`/reports/export/payroll-master/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `payroll_master_${Date.now()}.${getFileExtension(format)}`)
  },

  // Leave reports
  async exportLeaveBalance(
    filters?: ReportFilters,
    format: ExportFormat = 'csv'
  ): Promise<void> {
    const params = buildParams(filters, format)

    const response = await api.get(`/reports/export/leave-balance/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `leave_balance_${Date.now()}.${getFileExtension(format)}`)
  },

  // Loan reports
  async exportLoanOutstanding(
    filters?: ReportFilters,
    format: ExportFormat = 'csv'
  ): Promise<void> {
    const params = buildParams(filters, format)

    const response = await api.get(`/reports/export/loans/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `outstanding_loans_${Date.now()}.${getFileExtension(format)}`)
  },

  // Generic report data fetchers (for viewing in browser)
  async getEmployeeMaster(filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          params.append(key, value)
        }
      })
    }
    const response = await api.get(`/reports/employees/master/?${params.toString()}`)
    return response.data
  },

  async getHeadcount(filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          params.append(key, value)
        }
      })
    }
    const response = await api.get(`/reports/employees/headcount/?${params.toString()}`)
    return response.data
  },

  async getPayrollSummary(payrollRunId?: string, filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (payrollRunId) params.append('payroll_run', payrollRunId)
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          params.append(key, value)
        }
      })
    }
    const response = await api.get(`/reports/payroll/summary/?${params.toString()}`)
    return response.data
  },

  async getPayrollMaster(filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          params.append(key, value)
        }
      })
    }
    const response = await api.get(`/reports/payroll/master/?${params.toString()}`)
    return response.data
  },

  async getPAYEReport(payrollRunId?: string, filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (payrollRunId) params.append('payroll_run', payrollRunId)
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          params.append(key, value)
        }
      })
    }
    const response = await api.get(`/reports/statutory/paye/?${params.toString()}`)
    return response.data
  },

  async getSSNITReport(payrollRunId?: string, filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (payrollRunId) params.append('payroll_run', payrollRunId)
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          params.append(key, value)
        }
      })
    }
    const response = await api.get(`/reports/statutory/ssnit/?${params.toString()}`)
    return response.data
  },

  async getTurnover(filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          params.append(key, value)
        }
      })
    }
    const response = await api.get(`/reports/employees/turnover/?${params.toString()}`)
    return response.data
  },

  async getDemographics(filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          params.append(key, value)
        }
      })
    }
    const response = await api.get(`/reports/employees/demographics/?${params.toString()}`)
    return response.data
  },

  async getLeaveBalance(filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          params.append(key, value)
        }
      })
    }
    const response = await api.get(`/reports/leave/balance/?${params.toString()}`)
    return response.data
  },

  async getLeaveUtilization(filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          params.append(key, value)
        }
      })
    }
    const response = await api.get(`/reports/leave/utilization/?${params.toString()}`)
    return response.data
  },

  async getLoanOutstanding(filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          params.append(key, value)
        }
      })
    }
    const response = await api.get(`/reports/loans/outstanding/?${params.toString()}`)
    return response.data
  },

  // ==================== Analytics KPI Endpoints ====================

  async getMasterAnalytics(filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') params.append(key, value)
      })
    }
    const response = await api.get(`/reports/analytics/master/?${params.toString()}`)
    return response.data
  },

  async getRecruitmentKPIs(filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') params.append(key, value)
      })
    }
    const response = await api.get(`/reports/analytics/recruitment/?${params.toString()}`)
    return response.data
  },

  async getDemographicsKPIs(filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') params.append(key, value)
      })
    }
    const response = await api.get(`/reports/analytics/demographics/?${params.toString()}`)
    return response.data
  },

  async getTrainingKPIs(filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') params.append(key, value)
      })
    }
    const response = await api.get(`/reports/analytics/training/?${params.toString()}`)
    return response.data
  },

  async getPerformanceKPIs(filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') params.append(key, value)
      })
    }
    const response = await api.get(`/reports/analytics/performance/?${params.toString()}`)
    return response.data
  },

  async getCompensationKPIs(filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') params.append(key, value)
      })
    }
    const response = await api.get(`/reports/analytics/compensation/?${params.toString()}`)
    return response.data
  },

  async getExitKPIs(filters?: ReportFilters) {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') params.append(key, value)
      })
    }
    const response = await api.get(`/reports/analytics/exit/?${params.toString()}`)
    return response.data
  },

  // Payroll Reconciliation - supports both run IDs and period IDs
  async getPayrollReconciliation(currentRunId?: string, previousRunId?: string) {
    const params = new URLSearchParams()
    if (currentRunId) params.append('current_run', currentRunId)
    if (previousRunId) params.append('previous_run', previousRunId)
    const response = await api.get(`/reports/payroll/reconciliation/?${params.toString()}`)
    return response.data
  },

  // Payroll Reconciliation by Period IDs
  async getPayrollReconciliationByPeriod(currentPeriodId?: string, previousPeriodId?: string) {
    const params = new URLSearchParams()
    if (currentPeriodId) params.append('current_period', currentPeriodId)
    if (previousPeriodId) params.append('previous_period', previousPeriodId)
    const response = await api.get(`/reports/payroll/reconciliation/?${params.toString()}`)
    return response.data
  },

  async exportPayrollReconciliation(
    currentRunId?: string,
    previousRunId?: string,
    format: ExportFormat = 'excel'
  ): Promise<void> {
    const params = new URLSearchParams()
    if (currentRunId) params.append('current_run', currentRunId)
    if (previousRunId) params.append('previous_run', previousRunId)
    params.append('format', format)

    const response = await api.get(`/reports/export/reconciliation/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `payroll_reconciliation_${Date.now()}.${getFileExtension(format)}`)
  },

  async exportPayrollReconciliationByPeriod(
    currentPeriodId?: string,
    previousPeriodId?: string,
    format: ExportFormat = 'excel'
  ): Promise<void> {
    const params = new URLSearchParams()
    if (currentPeriodId) params.append('current_period', currentPeriodId)
    if (previousPeriodId) params.append('previous_period', previousPeriodId)
    params.append('format', format)

    const response = await api.get(`/reports/export/reconciliation/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `payroll_reconciliation_${Date.now()}.${getFileExtension(format)}`)
  },

  // Payroll Journal
  async getPayrollJournal(runId?: string, filters?: Record<string, string>) {
    const params = new URLSearchParams()
    if (runId) params.append('run_id', runId)
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
    }
    const response = await api.get(`/reports/payroll/journal/?${params.toString()}`)
    return response.data
  },

  async exportPayrollJournal(
    runId?: string,
    format: ExportFormat = 'csv',
    filters?: Record<string, string>
  ): Promise<void> {
    const params = new URLSearchParams()
    if (runId) params.append('run_id', runId)
    params.append('file_format', format)
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
    }

    const response = await api.get(`/reports/export/journal/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `payroll_journal_${Date.now()}.${getFileExtension(format)}`)
  },

  // Salary Reconciliation
  async getSalaryReconciliation(currentPeriodId?: string, previousPeriodId?: string) {
    const params = new URLSearchParams()
    if (currentPeriodId) params.append('current_period', currentPeriodId)
    if (previousPeriodId) params.append('previous_period', previousPeriodId)
    const response = await api.get(`/reports/payroll/salary-reconciliation/?${params.toString()}`)
    return response.data
  },

  async exportSalaryReconciliation(
    currentPeriodId?: string,
    previousPeriodId?: string,
    format: ExportFormat = 'csv'
  ): Promise<void> {
    const params = new URLSearchParams()
    if (currentPeriodId) params.append('current_period', currentPeriodId)
    if (previousPeriodId) params.append('previous_period', previousPeriodId)
    params.append('file_format', format)

    const response = await api.get(`/reports/export/salary-reconciliation/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `salary_reconciliation_${Date.now()}.${getFileExtension(format)}`)
  },

  // Dues Report
  async exportDuesReport(
    runId?: string,
    componentCode?: string,
    format: ExportFormat = 'csv'
  ): Promise<void> {
    const params = new URLSearchParams()
    if (runId) params.append('run_id', runId)
    if (componentCode) params.append('component_code', componentCode)
    params.append('file_format', format)

    const response = await api.get(`/reports/export/dues/?${params.toString()}`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `dues_report_${Date.now()}.${getFileExtension(format)}`)
  },

  // Payslip downloads
  async getPayslipsForRun(payrollRunId: string) {
    const response = await api.get(`/payroll/runs/${payrollRunId}/payslips/`)
    return response.data
  },

  async downloadPayslip(payslipId: string): Promise<void> {
    const response = await api.get(`/payroll/payslips/${payslipId}/download/`, {
      responseType: 'blob',
    })
    // Get filename from content-disposition header or use default
    const contentDisposition = response.headers['content-disposition']
    let filename = `payslip_${payslipId}.pdf`
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/)
      if (match) filename = match[1]
    }
    downloadFile(response.data, filename)
  },

  async downloadAllPayslips(payrollRunId: string): Promise<void> {
    const response = await api.get(`/payroll/runs/${payrollRunId}/payslips/download/`, {
      responseType: 'blob',
    })
    downloadFile(response.data, `payslips_${Date.now()}.zip`)
  },

  async downloadFilteredPayslips(
    payrollRunId: string,
    filters?: ReportFilters,
    format: ExportFormat = 'pdf'
  ): Promise<void> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '' && key !== 'period') {
          params.append(key, value)
        }
      })
    }
    // Map 'csv' to 'text' for payslips since backend uses 'text' for plain text format
    // Using 'file_format' to avoid conflict with DRF's format suffix
    const backendFormat = format === 'csv' ? 'text' : format
    params.append('file_format', backendFormat)
    const queryString = params.toString()
    const url = `/payroll/runs/${payrollRunId}/payslips/download/${queryString ? `?${queryString}` : ''}`
    const response = await api.get(url, {
      responseType: 'blob',
    })
    // Payslips are always downloaded as a ZIP containing individual files in the selected format
    downloadFile(response.data, `payslips_${Date.now()}.zip`)
  },

  // Bank file downloads
  async getBankFilesForRun(payrollRunId: string) {
    const response = await api.get(`/payroll/runs/${payrollRunId}/bank-files/`)
    return response.data
  },

  async downloadBankFile(bankFileId: string): Promise<void> {
    const response = await api.get(`/payroll/bank-files/${bankFileId}/download/`, {
      responseType: 'blob',
    })
    // Get filename from content-disposition header or use default
    const contentDisposition = response.headers['content-disposition']
    let filename = `bank_file_${bankFileId}.csv`
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/)
      if (match) filename = match[1]
    }
    downloadFile(response.data, filename)
  },

  async downloadFilteredBankFile(
    payrollRunId: string,
    filters?: ReportFilters,
    format: ExportFormat = 'csv'
  ): Promise<void> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '' && key !== 'period') {
          params.append(key, value)
        }
      })
    }
    // Using 'file_format' to avoid conflict with DRF's format suffix
    params.append('file_format', format)
    const queryString = params.toString()
    const url = `/payroll/runs/${payrollRunId}/bank-file/download/${queryString ? `?${queryString}` : ''}`
    const response = await api.get(url, {
      responseType: 'blob',
    })
    // Get filename from content-disposition header or use default
    const contentDisposition = response.headers['content-disposition']
    let filename = `bank_file_${Date.now()}.${getFileExtension(format)}`
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/)
      if (match) filename = match[1]
    }
    downloadFile(response.data, filename)
  },
}
