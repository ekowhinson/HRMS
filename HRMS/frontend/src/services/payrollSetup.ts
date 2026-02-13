import api from '@/lib/api'

// Types
export interface Bank {
  id: string
  code: string
  name: string
  short_name?: string
  swift_code?: string
  sort_code?: string
  is_active: boolean
  branch_count?: number
}

export interface BankBranch {
  id: string
  bank: string
  bank_name?: string
  code: string
  name: string
  sort_code?: string
  city?: string
  region?: string
  region_name?: string
  is_active: boolean
}

export interface StaffCategory {
  id: string
  code: string
  name: string
  description?: string
  payroll_group?: string
  salary_band?: string
  salary_band_name?: string
  salary_band_code?: string
  sort_order: number
  is_active: boolean
  employee_count?: number
}

export interface SalaryBand {
  id: string
  code: string
  name: string
  description?: string
  min_salary?: number
  max_salary?: number
  sort_order: number
  is_active: boolean
  level_count?: number
}

export interface SalaryLevel {
  id: string
  band: string
  band_name?: string
  band_code?: string
  code: string
  name: string
  description?: string
  min_salary?: number
  max_salary?: number
  sort_order: number
  is_active: boolean
  notch_count?: number
}

export interface SalaryNotch {
  id: string
  level: string
  level_name?: string
  level_code?: string
  band_code?: string
  code: string
  name: string
  full_code?: string
  amount: number
  description?: string
  sort_order: number
  is_active: boolean
  employee_count?: number
}

// Global Salary Increment Types
export interface SalaryIncrementPreviewRequest {
  increment_type: 'PERCENTAGE' | 'AMOUNT'
  value: number
  effective_date: string
  band_id?: string | null
  level_id?: string | null
}

export interface SalaryIncrementPreviewItem {
  notch_id: string
  full_code: string
  notch_name: string
  old_amount: number
  new_amount: number
  difference: number
  employee_count: number
}

export interface SalaryIncrementPreviewResult {
  items: SalaryIncrementPreviewItem[]
  summary: {
    notches_affected: number
    employees_affected: number
    total_old_amount: number
    total_new_amount: number
    total_difference: number
  }
}

export interface SalaryIncrementApplyRequest extends SalaryIncrementPreviewRequest {
  description?: string
}

export type IncrementStatus = 'FORECAST' | 'APPLIED' | 'REVERSED'

export interface SalaryIncrementHistoryItem {
  id: string
  reference_number: string
  increment_type: 'PERCENTAGE' | 'AMOUNT'
  value: number
  effective_date: string
  band?: string | null
  band_name?: string | null
  level?: string | null
  level_name?: string | null
  status: IncrementStatus
  is_forecast: boolean
  notches_affected: number
  employees_affected: number
  total_old_amount: number
  total_new_amount: number
  applied_by?: string | null
  applied_by_name?: string | null
  applied_at: string
  reversed_by?: string | null
  reversed_by_name?: string | null
  reversed_at?: string | null
  description: string
  details: {
    id: string
    notch: string
    notch_code: string
    notch_name: string
    old_amount: number
    new_amount: number
    difference: number
  }[]
}

export interface SalaryIncrementReverseRequest {
  increment_id: string
}

export interface SalaryIncrementPromoteRequest {
  increment_id: string
}

export interface PayrollCalendar {
  id: string
  name: string
  year: number
  month: number
  start_date: string
  end_date: string
  working_days?: number
  is_active: boolean
}

export interface PayrollPeriod {
  id: string
  name: string
  year: number
  month: number
  start_date: string
  end_date: string
  status: 'DRAFT' | 'OPEN' | 'PROCESSING' | 'COMPUTED' | 'APPROVED' | 'PAID' | 'CLOSED'
  is_supplementary: boolean
  calendar?: string
  calendar_name?: string
}

export interface PayrollSettings {
  id: number
  active_calendar?: string
  active_calendar_name?: string
  active_calendar_year?: number
  active_calendar_month?: number
  active_period?: string
  active_period_name?: string
  active_period_status?: string
  auto_advance_period: boolean
  default_transaction_status: string
  updated_at: string
  updated_by_name?: string
}

export interface PayrollSettingsResponse {
  settings: PayrollSettings
  available_calendars: PayrollCalendar[]
  available_periods: PayrollPeriod[]
}

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export const payrollSetupService = {
  // Banks
  async getBanks(): Promise<Bank[]> {
    const response = await api.get<PaginatedResponse<Bank> | Bank[]>('/payroll/banks/', { params: { page_size: 100 } })
    return Array.isArray(response.data) ? response.data : response.data.results
  },

  async getBank(id: string): Promise<Bank> {
    const response = await api.get<Bank>(`/payroll/banks/${id}/`)
    return response.data
  },

  async createBank(data: Partial<Bank>): Promise<Bank> {
    const response = await api.post<Bank>('/payroll/banks/', data)
    return response.data
  },

  async updateBank(id: string, data: Partial<Bank>): Promise<Bank> {
    const response = await api.patch<Bank>(`/payroll/banks/${id}/`, data)
    return response.data
  },

  async deleteBank(id: string): Promise<void> {
    await api.delete(`/payroll/banks/${id}/`)
  },

  // Bank Branches
  async getBankBranches(bankId?: string): Promise<BankBranch[]> {
    const params: Record<string, any> = { page_size: 100 }
    if (bankId) params.bank = bankId
    const response = await api.get<PaginatedResponse<BankBranch> | BankBranch[]>('/payroll/bank-branches/', { params })
    return Array.isArray(response.data) ? response.data : response.data.results
  },

  async getBankBranch(id: string): Promise<BankBranch> {
    const response = await api.get<BankBranch>(`/payroll/bank-branches/${id}/`)
    return response.data
  },

  async createBankBranch(data: Partial<BankBranch>): Promise<BankBranch> {
    const response = await api.post<BankBranch>('/payroll/bank-branches/', data)
    return response.data
  },

  async updateBankBranch(id: string, data: Partial<BankBranch>): Promise<BankBranch> {
    const response = await api.patch<BankBranch>(`/payroll/bank-branches/${id}/`, data)
    return response.data
  },

  async deleteBankBranch(id: string): Promise<void> {
    await api.delete(`/payroll/bank-branches/${id}/`)
  },

  // Staff Categories
  async getStaffCategories(): Promise<StaffCategory[]> {
    const response = await api.get<PaginatedResponse<StaffCategory> | StaffCategory[]>('/payroll/staff-categories/', { params: { page_size: 100 } })
    return Array.isArray(response.data) ? response.data : response.data.results
  },

  async getStaffCategory(id: string): Promise<StaffCategory> {
    const response = await api.get<StaffCategory>(`/payroll/staff-categories/${id}/`)
    return response.data
  },

  async createStaffCategory(data: Partial<StaffCategory>): Promise<StaffCategory> {
    const response = await api.post<StaffCategory>('/payroll/staff-categories/', data)
    return response.data
  },

  async updateStaffCategory(id: string, data: Partial<StaffCategory>): Promise<StaffCategory> {
    const response = await api.patch<StaffCategory>(`/payroll/staff-categories/${id}/`, data)
    return response.data
  },

  async deleteStaffCategory(id: string): Promise<void> {
    await api.delete(`/payroll/staff-categories/${id}/`)
  },

  // Salary Bands
  async getSalaryBands(): Promise<SalaryBand[]> {
    const response = await api.get<PaginatedResponse<SalaryBand> | SalaryBand[]>('/payroll/salary-bands/', { params: { page_size: 100 } })
    return Array.isArray(response.data) ? response.data : response.data.results
  },

  async getSalaryBand(id: string): Promise<SalaryBand> {
    const response = await api.get<SalaryBand>(`/payroll/salary-bands/${id}/`)
    return response.data
  },

  async createSalaryBand(data: Partial<SalaryBand>): Promise<SalaryBand> {
    const response = await api.post<SalaryBand>('/payroll/salary-bands/', data)
    return response.data
  },

  async updateSalaryBand(id: string, data: Partial<SalaryBand>): Promise<SalaryBand> {
    const response = await api.patch<SalaryBand>(`/payroll/salary-bands/${id}/`, data)
    return response.data
  },

  async deleteSalaryBand(id: string): Promise<void> {
    await api.delete(`/payroll/salary-bands/${id}/`)
  },

  // Salary Levels
  async getSalaryLevels(bandId?: string): Promise<SalaryLevel[]> {
    const params: Record<string, any> = { page_size: 100 }
    if (bandId) params.band = bandId
    const response = await api.get<PaginatedResponse<SalaryLevel> | SalaryLevel[]>('/payroll/salary-levels/', { params })
    return Array.isArray(response.data) ? response.data : response.data.results
  },

  async getSalaryLevel(id: string): Promise<SalaryLevel> {
    const response = await api.get<SalaryLevel>(`/payroll/salary-levels/${id}/`)
    return response.data
  },

  async createSalaryLevel(data: Partial<SalaryLevel>): Promise<SalaryLevel> {
    const response = await api.post<SalaryLevel>('/payroll/salary-levels/', data)
    return response.data
  },

  async updateSalaryLevel(id: string, data: Partial<SalaryLevel>): Promise<SalaryLevel> {
    const response = await api.patch<SalaryLevel>(`/payroll/salary-levels/${id}/`, data)
    return response.data
  },

  async deleteSalaryLevel(id: string): Promise<void> {
    await api.delete(`/payroll/salary-levels/${id}/`)
  },

  // Salary Notches
  async getSalaryNotches(levelId?: string): Promise<SalaryNotch[]> {
    const params: Record<string, any> = { page_size: 500 }
    if (levelId) params.level = levelId
    const response = await api.get<PaginatedResponse<SalaryNotch> | SalaryNotch[]>('/payroll/salary-notches/', { params })
    return Array.isArray(response.data) ? response.data : response.data.results
  },

  async getSalaryNotch(id: string): Promise<SalaryNotch> {
    const response = await api.get<SalaryNotch>(`/payroll/salary-notches/${id}/`)
    return response.data
  },

  async createSalaryNotch(data: Partial<SalaryNotch>): Promise<SalaryNotch> {
    const response = await api.post<SalaryNotch>('/payroll/salary-notches/', data)
    return response.data
  },

  async updateSalaryNotch(id: string, data: Partial<SalaryNotch>): Promise<SalaryNotch> {
    const response = await api.patch<SalaryNotch>(`/payroll/salary-notches/${id}/`, data)
    return response.data
  },

  async deleteSalaryNotch(id: string): Promise<void> {
    await api.delete(`/payroll/salary-notches/${id}/`)
  },

  // Payroll Settings
  async getPayrollSettings(): Promise<PayrollSettingsResponse> {
    const response = await api.get<PayrollSettingsResponse>('/payroll/settings/')
    return response.data
  },

  async updatePayrollSettings(data: Partial<PayrollSettings>): Promise<PayrollSettings> {
    const response = await api.put<PayrollSettings>('/payroll/settings/', data)
    return response.data
  },

  async setActivePeriod(data: {
    calendar_id?: string
    period_id?: string
    year?: number
    month?: number
  }): Promise<PayrollSettings> {
    const response = await api.post<PayrollSettings>('/payroll/settings/set-active-period/', data)
    return response.data
  },

  async advancePeriod(): Promise<PayrollSettings> {
    const response = await api.post<PayrollSettings>('/payroll/settings/advance-period/')
    return response.data
  },

  // Payroll Calendars
  async getPayrollCalendars(): Promise<PayrollCalendar[]> {
    const response = await api.get<PaginatedResponse<PayrollCalendar> | PayrollCalendar[]>('/payroll/calendar/', { params: { page_size: 100 } })
    return Array.isArray(response.data) ? response.data : response.data.results
  },

  async createYearCalendars(year: number): Promise<{ message: string; created: number }> {
    const response = await api.post<{ message: string; created: number }>('/payroll/calendar/create-year/', { year })
    return response.data
  },

  // Payroll Periods
  async getPayrollPeriods(): Promise<PayrollPeriod[]> {
    const response = await api.get<PaginatedResponse<PayrollPeriod> | PayrollPeriod[]>('/payroll/periods/', { params: { page_size: 100 } })
    return Array.isArray(response.data) ? response.data : response.data.results
  },

  async createYearPeriods(year: number): Promise<{ message: string; created: number }> {
    const response = await api.post<{ message: string; created: number }>('/payroll/periods/create-year/', { year })
    return response.data
  },

  async closePeriod(periodId: string): Promise<any> {
    const response = await api.post(`/payroll/periods/${periodId}/close/`)
    return response.data
  },

  async reopenPeriod(periodId: string, force?: boolean, reason?: string): Promise<any> {
    const response = await api.post(`/payroll/periods/${periodId}/reopen/`, { force, reason })
    return response.data
  },

  // Global Salary Increment
  async previewGlobalIncrement(data: SalaryIncrementPreviewRequest): Promise<SalaryIncrementPreviewResult> {
    const response = await api.post<SalaryIncrementPreviewResult>('/payroll/salary-notches/global-increment/preview/', data)
    return response.data
  },

  async applyGlobalIncrement(data: SalaryIncrementApplyRequest): Promise<SalaryIncrementHistoryItem> {
    const response = await api.post<SalaryIncrementHistoryItem>('/payroll/salary-notches/global-increment/apply/', data)
    return response.data
  },

  async forecastGlobalIncrement(data: SalaryIncrementApplyRequest): Promise<SalaryIncrementHistoryItem> {
    const response = await api.post<SalaryIncrementHistoryItem>('/payroll/salary-notches/global-increment/forecast/', data)
    return response.data
  },

  async reverseGlobalIncrement(data: SalaryIncrementReverseRequest): Promise<SalaryIncrementHistoryItem> {
    const response = await api.post<SalaryIncrementHistoryItem>('/payroll/salary-notches/global-increment/reverse/', data)
    return response.data
  },

  async promoteGlobalIncrement(data: SalaryIncrementPromoteRequest): Promise<SalaryIncrementHistoryItem> {
    const response = await api.post<SalaryIncrementHistoryItem>('/payroll/salary-notches/global-increment/promote/', data)
    return response.data
  },

  async getGlobalIncrementHistory(): Promise<SalaryIncrementHistoryItem[]> {
    const response = await api.get<SalaryIncrementHistoryItem[]>('/payroll/salary-notches/global-increment/history/')
    return response.data
  },
}
