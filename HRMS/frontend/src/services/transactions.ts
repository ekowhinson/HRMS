import api from '@/lib/api'
import type {
  PayComponent,
  EmployeeTransaction,
  EmployeeTransactionCreate,
  BulkTransactionCreate,
  FormulaValidationResult,
  PaginatedResponse,
  OvertimeBonusTaxConfig,
  TaxCalculationPreview,
  TaxBracket,
} from '@/types'

export interface PayComponentFilters {
  component_type?: string
  calculation_type?: string
  category?: string
  is_active?: boolean
  is_statutory?: boolean
  is_recurring?: boolean
  search?: string
}

export interface TransactionFilters {
  status?: string
  is_recurring?: boolean
  pay_component?: string
  employee?: string
  department?: string
  effective_from?: string
  effective_to?: string
  search?: string
}

export const transactionsService = {
  // ==================== Pay Components ====================

  // Get all pay components with optional filters
  getPayComponents: async (filters?: PayComponentFilters): Promise<PaginatedResponse<PayComponent>> => {
    const response = await api.get('/payroll/components/', { params: filters })
    return response.data
  },

  // Get single pay component
  getPayComponent: async (id: string): Promise<PayComponent> => {
    const response = await api.get(`/payroll/components/${id}/`)
    return response.data
  },

  // Create new pay component
  createPayComponent: async (data: Partial<PayComponent>): Promise<PayComponent> => {
    const response = await api.post('/payroll/components/', data)
    return response.data
  },

  // Update pay component
  updatePayComponent: async (id: string, data: Partial<PayComponent>): Promise<PayComponent> => {
    const response = await api.patch(`/payroll/components/${id}/`, data)
    return response.data
  },

  // Delete pay component
  deletePayComponent: async (id: string): Promise<void> => {
    await api.delete(`/payroll/components/${id}/`)
  },

  // Validate formula with test values
  validateFormula: async (
    formula: string,
    testBasic: number = 5000,
    testGross: number = 7000
  ): Promise<FormulaValidationResult> => {
    const response = await api.post('/payroll/components/validate_formula/', {
      formula,
      test_basic: testBasic,
      test_gross: testGross,
    })
    return response.data
  },

  // Get usage stats for a component
  getComponentUsageStats: async (id: string): Promise<{
    component_id: string
    component_code: string
    active_transactions: number
    total_transactions: number
  }> => {
    const response = await api.get(`/payroll/components/${id}/usage_stats/`)
    return response.data
  },

  // ==================== Employee Transactions ====================

  // Get all transactions with optional filters
  getTransactions: async (filters?: TransactionFilters): Promise<PaginatedResponse<EmployeeTransaction>> => {
    const response = await api.get('/payroll/transactions/', { params: filters })
    return response.data
  },

  // Get single transaction
  getTransaction: async (id: string): Promise<EmployeeTransaction> => {
    const response = await api.get(`/payroll/transactions/${id}/`)
    return response.data
  },

  // Create new transaction
  createTransaction: async (data: EmployeeTransactionCreate): Promise<EmployeeTransaction> => {
    // Handle file upload if present
    if (data.supporting_document instanceof File) {
      const formData = new FormData()
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === 'employee_ids' && Array.isArray(value)) {
            value.forEach((id) => formData.append('employee_ids', id))
          } else if (value instanceof File) {
            formData.append(key, value)
          } else {
            formData.append(key, String(value))
          }
        }
      })
      const response = await api.post('/payroll/transactions/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data
    }

    const response = await api.post('/payroll/transactions/', data)
    return response.data
  },

  // Update transaction
  updateTransaction: async (id: string, data: Partial<EmployeeTransactionCreate>): Promise<EmployeeTransaction> => {
    // Handle file upload if present
    if (data.supporting_document instanceof File) {
      const formData = new FormData()
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (value instanceof File) {
            formData.append(key, value)
          } else {
            formData.append(key, String(value))
          }
        }
      })
      const response = await api.patch(`/payroll/transactions/${id}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data
    }

    const response = await api.patch(`/payroll/transactions/${id}/`, data)
    return response.data
  },

  // Delete transaction
  deleteTransaction: async (id: string): Promise<void> => {
    await api.delete(`/payroll/transactions/${id}/`)
  },

  // Bulk create transactions for multiple employees
  bulkCreateTransactions: async (data: BulkTransactionCreate): Promise<{
    message: string
    count: number
    transactions: EmployeeTransaction[]
  }> => {
    const response = await api.post('/payroll/transactions/bulk_create/', data)
    return response.data
  },

  // Approve a pending transaction
  approveTransaction: async (id: string, notes?: string): Promise<EmployeeTransaction> => {
    const response = await api.post(`/payroll/transactions/${id}/approve/`, { notes })
    return response.data
  },

  // Reject a pending transaction
  rejectTransaction: async (id: string, reason: string): Promise<EmployeeTransaction> => {
    const response = await api.post(`/payroll/transactions/${id}/reject/`, { reason })
    return response.data
  },

  // Suspend an active transaction
  suspendTransaction: async (id: string): Promise<EmployeeTransaction> => {
    const response = await api.post(`/payroll/transactions/${id}/suspend/`)
    return response.data
  },

  // Reactivate a suspended transaction
  reactivateTransaction: async (id: string, notes?: string): Promise<EmployeeTransaction> => {
    const response = await api.post(`/payroll/transactions/${id}/reactivate/`, { notes })
    return response.data
  },

  // Get pending approval transactions
  getPendingApprovals: async (): Promise<PaginatedResponse<EmployeeTransaction>> => {
    const response = await api.get('/payroll/transactions/pending_approval/')
    return response.data
  },

  // ==================== Overtime & Bonus Tax Configuration ====================

  // Get all tax configurations
  getTaxConfigs: async (): Promise<PaginatedResponse<OvertimeBonusTaxConfig>> => {
    const response = await api.get('/payroll/tax-config/')
    return response.data
  },

  // Get single tax configuration
  getTaxConfig: async (id: string): Promise<OvertimeBonusTaxConfig> => {
    const response = await api.get(`/payroll/tax-config/${id}/`)
    return response.data
  },

  // Get active tax configuration
  getActiveTaxConfig: async (): Promise<OvertimeBonusTaxConfig> => {
    const response = await api.get('/payroll/tax-config/active/')
    return response.data
  },

  // Create new tax configuration
  createTaxConfig: async (data: Partial<OvertimeBonusTaxConfig>): Promise<OvertimeBonusTaxConfig> => {
    const response = await api.post('/payroll/tax-config/', data)
    return response.data
  },

  // Update tax configuration
  updateTaxConfig: async (id: string, data: Partial<OvertimeBonusTaxConfig>): Promise<OvertimeBonusTaxConfig> => {
    const response = await api.patch(`/payroll/tax-config/${id}/`, data)
    return response.data
  },

  // Delete tax configuration
  deleteTaxConfig: async (id: string): Promise<void> => {
    await api.delete(`/payroll/tax-config/${id}/`)
  },

  // Activate a tax configuration
  activateTaxConfig: async (id: string): Promise<OvertimeBonusTaxConfig> => {
    const response = await api.post(`/payroll/tax-config/${id}/activate/`)
    return response.data
  },

  // Preview tax calculation
  previewTaxCalculation: async (
    overtimeAmount: number,
    bonusAmount: number,
    basicSalary: number,
    annualSalary: number,
    isResident: boolean = true
  ): Promise<TaxCalculationPreview> => {
    const response = await api.get('/payroll/tax-config/calculate_preview/', {
      params: {
        overtime_amount: overtimeAmount,
        bonus_amount: bonusAmount,
        basic_salary: basicSalary,
        annual_salary: annualSalary,
        is_resident: isResident,
      },
    })
    return response.data
  },

  // ==================== PAYE Tax Brackets ====================

  // Get all tax brackets
  getTaxBrackets: async (): Promise<PaginatedResponse<TaxBracket>> => {
    const response = await api.get('/payroll/paye-brackets/')
    return response.data
  },

  // Get active tax brackets
  getActiveTaxBrackets: async (): Promise<TaxBracket[]> => {
    const response = await api.get('/payroll/paye-brackets/active/')
    return response.data
  },

  // Get single tax bracket
  getTaxBracket: async (id: string): Promise<TaxBracket> => {
    const response = await api.get(`/payroll/paye-brackets/${id}/`)
    return response.data
  },

  // Create tax bracket
  createTaxBracket: async (data: Partial<TaxBracket>): Promise<TaxBracket> => {
    const response = await api.post('/payroll/paye-brackets/', data)
    return response.data
  },

  // Update tax bracket
  updateTaxBracket: async (id: string, data: Partial<TaxBracket>): Promise<TaxBracket> => {
    const response = await api.patch(`/payroll/paye-brackets/${id}/`, data)
    return response.data
  },

  // Delete tax bracket
  deleteTaxBracket: async (id: string): Promise<void> => {
    await api.delete(`/payroll/paye-brackets/${id}/`)
  },

  // Bulk update tax brackets
  bulkUpdateTaxBrackets: async (brackets: Partial<TaxBracket>[]): Promise<{
    message: string
    brackets: TaxBracket[]
  }> => {
    const response = await api.post('/payroll/paye-brackets/bulk_update/', { brackets })
    return response.data
  },

  // Recalculate cumulative tax
  recalculateCumulativeTax: async (): Promise<{
    message: string
    brackets: TaxBracket[]
  }> => {
    const response = await api.post('/payroll/paye-brackets/calculate_cumulative/')
    return response.data
  },
}
