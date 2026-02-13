import api from '@/lib/api'

// ─── Interfaces ────────────────────────────────────────────────

export interface Account {
  id: string
  code: string
  name: string
  account_type: string
  parent: string | null
  parent_name?: string
  is_header: boolean
  is_active: boolean
  currency: string
  normal_balance: 'DEBIT' | 'CREDIT'
  children?: Account[]
  depth?: number
  balance?: number
}

export interface FiscalYear {
  id: string
  name: string
  start_date: string
  end_date: string
  is_closed: boolean
}

export interface FiscalPeriod {
  id: string
  fiscal_year: string
  fiscal_year_name?: string
  period_number: number
  name: string
  start_date: string
  end_date: string
  is_closed: boolean
}

export interface JournalLine {
  id?: string
  journal_entry?: string
  account: string
  account_name?: string
  account_code?: string
  description: string
  debit_amount: number | string
  credit_amount: number | string
  cost_center?: string
  cost_center_name?: string
  department?: string
  department_name?: string
}

export interface JournalEntry {
  id: string
  entry_number: string
  journal_date: string
  fiscal_period: string
  fiscal_period_name?: string
  description: string
  source: string
  source_reference: string
  status: 'DRAFT' | 'POSTED' | 'REVERSED'
  total_debit: number | string
  total_credit: number | string
  posted_by?: string
  posted_by_name?: string
  posted_at?: string
  lines?: JournalLine[]
  created_at?: string
  updated_at?: string
}

export interface Budget {
  id: string
  fiscal_year: string
  fiscal_year_name?: string
  account: string
  account_name?: string
  account_code?: string
  cost_center?: string
  cost_center_name?: string
  department?: string
  department_name?: string
  original_amount: number | string
  revised_amount: number | string
  actual_amount?: number | string
  variance?: number | string
  utilization_pct?: number
  status: 'DRAFT' | 'APPROVED' | 'REVISED' | 'CLOSED'
}

export interface BudgetCommitment {
  id: string
  budget: string
  commitment_date: string
  amount: number | string
  source: string
  source_reference: string
  status: string
}

export interface Vendor {
  id: string
  code: string
  name: string
  tax_id: string
  payment_terms_days: number
  default_expense_account?: string
  default_expense_account_name?: string
  contact_person?: string
  contact_email?: string
  contact_phone?: string
  address?: string
  bank_name?: string
  bank_branch?: string
  bank_account_number?: string
  is_active: boolean
}

export interface VendorInvoice {
  id: string
  vendor: string
  vendor_name?: string
  invoice_number: string
  invoice_date: string
  due_date: string
  total_amount: number | string
  paid_amount: number | string
  balance?: number | string
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED'
  description?: string
  lines?: VendorInvoiceLine[]
}

export interface VendorInvoiceLine {
  id?: string
  invoice?: string
  account: string
  account_name?: string
  description: string
  quantity: number
  unit_price: number | string
  amount: number | string
}

export interface Customer {
  id: string
  code: string
  name: string
  payment_terms_days: number
  default_revenue_account?: string
  default_revenue_account_name?: string
  contact_person?: string
  contact_email?: string
  contact_phone?: string
  address?: string
  is_active: boolean
}

export interface CustomerInvoice {
  id: string
  customer: string
  customer_name?: string
  invoice_number: string
  invoice_date: string
  due_date: string
  total_amount: number | string
  paid_amount: number | string
  balance?: number | string
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED'
  description?: string
}

export interface OrganizationBankAccount {
  id: string
  name: string
  account_number: string
  bank_name: string
  branch: string
  gl_account?: string
  gl_account_name?: string
  currency: string
  current_balance: number | string
  is_active: boolean
}

export interface Payment {
  id: string
  payment_number: string
  payment_date: string
  vendor?: string
  vendor_name?: string
  customer?: string
  customer_name?: string
  amount: number | string
  payment_method: 'BANK_TRANSFER' | 'CHECK' | 'CASH' | 'MOBILE_MONEY' | 'OTHER'
  bank_account?: string
  bank_account_name?: string
  reference: string
  description?: string
  journal_entry?: string
}

export interface BankStatement {
  id: string
  bank_account: string
  bank_account_name?: string
  statement_date: string
  opening_balance: number | string
  closing_balance: number | string
  lines?: BankStatementLine[]
  lines_count?: number
  reconciled_count?: number
}

export interface BankStatementLine {
  id: string
  statement: string
  transaction_date: string
  description: string
  debit_amount: number | string
  credit_amount: number | string
  is_reconciled: boolean
  matched_payment?: string
  matched_payment_number?: string
  reference: string
}

export interface ExchangeRate {
  id: string
  from_currency: string
  to_currency: string
  rate: number | string
  effective_date: string
}

export interface TrialBalanceRow {
  account_code: string
  account_name: string
  debit_balance: number
  credit_balance: number
}

export interface IncomeStatementSection {
  category: string
  accounts: { account_code: string; account_name: string; amount: number }[]
  total: number
}

export interface BalanceSheetSection {
  category: string
  accounts: { account_code: string; account_name: string; amount: number }[]
  total: number
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ─── Service ───────────────────────────────────────────────────

export const financeService = {
  // ─── Accounts ─────────────────────────────────────────
  getAccounts: async (params?: Record<string, any>): Promise<PaginatedResponse<Account>> => {
    const response = await api.get('/finance/accounts/', { params })
    return response.data
  },
  getAccount: async (id: string): Promise<Account> => {
    const response = await api.get(`/finance/accounts/${id}/`)
    return response.data
  },
  createAccount: async (data: Partial<Account>): Promise<Account> => {
    const response = await api.post('/finance/accounts/', data)
    return response.data
  },
  updateAccount: async (id: string, data: Partial<Account>): Promise<Account> => {
    const response = await api.patch(`/finance/accounts/${id}/`, data)
    return response.data
  },
  deleteAccount: async (id: string): Promise<void> => {
    await api.delete(`/finance/accounts/${id}/`)
  },

  // ─── Fiscal Years ─────────────────────────────────────
  getFiscalYears: async (params?: Record<string, any>): Promise<PaginatedResponse<FiscalYear>> => {
    const response = await api.get('/finance/fiscal-years/', { params })
    return response.data
  },
  getFiscalYear: async (id: string): Promise<FiscalYear> => {
    const response = await api.get(`/finance/fiscal-years/${id}/`)
    return response.data
  },
  createFiscalYear: async (data: Partial<FiscalYear>): Promise<FiscalYear> => {
    const response = await api.post('/finance/fiscal-years/', data)
    return response.data
  },
  updateFiscalYear: async (id: string, data: Partial<FiscalYear>): Promise<FiscalYear> => {
    const response = await api.patch(`/finance/fiscal-years/${id}/`, data)
    return response.data
  },
  deleteFiscalYear: async (id: string): Promise<void> => {
    await api.delete(`/finance/fiscal-years/${id}/`)
  },

  // ─── Fiscal Periods ───────────────────────────────────
  getFiscalPeriods: async (params?: Record<string, any>): Promise<PaginatedResponse<FiscalPeriod>> => {
    const response = await api.get('/finance/fiscal-periods/', { params })
    return response.data
  },
  getFiscalPeriod: async (id: string): Promise<FiscalPeriod> => {
    const response = await api.get(`/finance/fiscal-periods/${id}/`)
    return response.data
  },
  createFiscalPeriod: async (data: Partial<FiscalPeriod>): Promise<FiscalPeriod> => {
    const response = await api.post('/finance/fiscal-periods/', data)
    return response.data
  },
  updateFiscalPeriod: async (id: string, data: Partial<FiscalPeriod>): Promise<FiscalPeriod> => {
    const response = await api.patch(`/finance/fiscal-periods/${id}/`, data)
    return response.data
  },
  deleteFiscalPeriod: async (id: string): Promise<void> => {
    await api.delete(`/finance/fiscal-periods/${id}/`)
  },

  // ─── Journal Entries ──────────────────────────────────
  getJournalEntries: async (params?: Record<string, any>): Promise<PaginatedResponse<JournalEntry>> => {
    const response = await api.get('/finance/journal-entries/', { params })
    return response.data
  },
  getJournalEntry: async (id: string): Promise<JournalEntry> => {
    const response = await api.get(`/finance/journal-entries/${id}/`)
    return response.data
  },
  createJournalEntry: async (data: Partial<JournalEntry>): Promise<JournalEntry> => {
    const response = await api.post('/finance/journal-entries/', data)
    return response.data
  },
  updateJournalEntry: async (id: string, data: Partial<JournalEntry>): Promise<JournalEntry> => {
    const response = await api.patch(`/finance/journal-entries/${id}/`, data)
    return response.data
  },
  deleteJournalEntry: async (id: string): Promise<void> => {
    await api.delete(`/finance/journal-entries/${id}/`)
  },
  postJournalEntry: async (id: string): Promise<JournalEntry> => {
    const response = await api.post(`/finance/journal-entries/${id}/post_entry/`)
    return response.data
  },
  reverseJournalEntry: async (id: string): Promise<JournalEntry> => {
    const response = await api.post(`/finance/journal-entries/${id}/reverse_entry/`)
    return response.data
  },

  // ─── Budgets ──────────────────────────────────────────
  getBudgets: async (params?: Record<string, any>): Promise<PaginatedResponse<Budget>> => {
    const response = await api.get('/finance/budgets/', { params })
    return response.data
  },
  getBudget: async (id: string): Promise<Budget> => {
    const response = await api.get(`/finance/budgets/${id}/`)
    return response.data
  },
  createBudget: async (data: Partial<Budget>): Promise<Budget> => {
    const response = await api.post('/finance/budgets/', data)
    return response.data
  },
  updateBudget: async (id: string, data: Partial<Budget>): Promise<Budget> => {
    const response = await api.patch(`/finance/budgets/${id}/`, data)
    return response.data
  },
  deleteBudget: async (id: string): Promise<void> => {
    await api.delete(`/finance/budgets/${id}/`)
  },

  // ─── Budget Commitments ───────────────────────────────
  getBudgetCommitments: async (params?: Record<string, any>): Promise<PaginatedResponse<BudgetCommitment>> => {
    const response = await api.get('/finance/budget-commitments/', { params })
    return response.data
  },
  createBudgetCommitment: async (data: Partial<BudgetCommitment>): Promise<BudgetCommitment> => {
    const response = await api.post('/finance/budget-commitments/', data)
    return response.data
  },
  updateBudgetCommitment: async (id: string, data: Partial<BudgetCommitment>): Promise<BudgetCommitment> => {
    const response = await api.patch(`/finance/budget-commitments/${id}/`, data)
    return response.data
  },
  deleteBudgetCommitment: async (id: string): Promise<void> => {
    await api.delete(`/finance/budget-commitments/${id}/`)
  },

  // ─── Vendors ──────────────────────────────────────────
  getVendors: async (params?: Record<string, any>): Promise<PaginatedResponse<Vendor>> => {
    const response = await api.get('/finance/vendors/', { params })
    return response.data
  },
  getVendor: async (id: string): Promise<Vendor> => {
    const response = await api.get(`/finance/vendors/${id}/`)
    return response.data
  },
  createVendor: async (data: Partial<Vendor>): Promise<Vendor> => {
    const response = await api.post('/finance/vendors/', data)
    return response.data
  },
  updateVendor: async (id: string, data: Partial<Vendor>): Promise<Vendor> => {
    const response = await api.patch(`/finance/vendors/${id}/`, data)
    return response.data
  },
  deleteVendor: async (id: string): Promise<void> => {
    await api.delete(`/finance/vendors/${id}/`)
  },

  // ─── Vendor Invoices ──────────────────────────────────
  getVendorInvoices: async (params?: Record<string, any>): Promise<PaginatedResponse<VendorInvoice>> => {
    const response = await api.get('/finance/vendor-invoices/', { params })
    return response.data
  },
  getVendorInvoice: async (id: string): Promise<VendorInvoice> => {
    const response = await api.get(`/finance/vendor-invoices/${id}/`)
    return response.data
  },
  createVendorInvoice: async (data: Partial<VendorInvoice>): Promise<VendorInvoice> => {
    const response = await api.post('/finance/vendor-invoices/', data)
    return response.data
  },
  updateVendorInvoice: async (id: string, data: Partial<VendorInvoice>): Promise<VendorInvoice> => {
    const response = await api.patch(`/finance/vendor-invoices/${id}/`, data)
    return response.data
  },
  deleteVendorInvoice: async (id: string): Promise<void> => {
    await api.delete(`/finance/vendor-invoices/${id}/`)
  },

  // ─── Customers ────────────────────────────────────────
  getCustomers: async (params?: Record<string, any>): Promise<PaginatedResponse<Customer>> => {
    const response = await api.get('/finance/customers/', { params })
    return response.data
  },
  getCustomer: async (id: string): Promise<Customer> => {
    const response = await api.get(`/finance/customers/${id}/`)
    return response.data
  },
  createCustomer: async (data: Partial<Customer>): Promise<Customer> => {
    const response = await api.post('/finance/customers/', data)
    return response.data
  },
  updateCustomer: async (id: string, data: Partial<Customer>): Promise<Customer> => {
    const response = await api.patch(`/finance/customers/${id}/`, data)
    return response.data
  },
  deleteCustomer: async (id: string): Promise<void> => {
    await api.delete(`/finance/customers/${id}/`)
  },

  // ─── Customer Invoices ────────────────────────────────
  getCustomerInvoices: async (params?: Record<string, any>): Promise<PaginatedResponse<CustomerInvoice>> => {
    const response = await api.get('/finance/customer-invoices/', { params })
    return response.data
  },
  getCustomerInvoice: async (id: string): Promise<CustomerInvoice> => {
    const response = await api.get(`/finance/customer-invoices/${id}/`)
    return response.data
  },
  createCustomerInvoice: async (data: Partial<CustomerInvoice>): Promise<CustomerInvoice> => {
    const response = await api.post('/finance/customer-invoices/', data)
    return response.data
  },
  updateCustomerInvoice: async (id: string, data: Partial<CustomerInvoice>): Promise<CustomerInvoice> => {
    const response = await api.patch(`/finance/customer-invoices/${id}/`, data)
    return response.data
  },
  deleteCustomerInvoice: async (id: string): Promise<void> => {
    await api.delete(`/finance/customer-invoices/${id}/`)
  },

  // ─── Organization Bank Accounts ───────────────────────
  getBankAccounts: async (params?: Record<string, any>): Promise<PaginatedResponse<OrganizationBankAccount>> => {
    const response = await api.get('/finance/bank-accounts/', { params })
    return response.data
  },
  getBankAccount: async (id: string): Promise<OrganizationBankAccount> => {
    const response = await api.get(`/finance/bank-accounts/${id}/`)
    return response.data
  },
  createBankAccount: async (data: Partial<OrganizationBankAccount>): Promise<OrganizationBankAccount> => {
    const response = await api.post('/finance/bank-accounts/', data)
    return response.data
  },
  updateBankAccount: async (id: string, data: Partial<OrganizationBankAccount>): Promise<OrganizationBankAccount> => {
    const response = await api.patch(`/finance/bank-accounts/${id}/`, data)
    return response.data
  },
  deleteBankAccount: async (id: string): Promise<void> => {
    await api.delete(`/finance/bank-accounts/${id}/`)
  },

  // ─── Payments ─────────────────────────────────────────
  getPayments: async (params?: Record<string, any>): Promise<PaginatedResponse<Payment>> => {
    const response = await api.get('/finance/payments/', { params })
    return response.data
  },
  getPayment: async (id: string): Promise<Payment> => {
    const response = await api.get(`/finance/payments/${id}/`)
    return response.data
  },
  createPayment: async (data: Partial<Payment>): Promise<Payment> => {
    const response = await api.post('/finance/payments/', data)
    return response.data
  },
  updatePayment: async (id: string, data: Partial<Payment>): Promise<Payment> => {
    const response = await api.patch(`/finance/payments/${id}/`, data)
    return response.data
  },
  deletePayment: async (id: string): Promise<void> => {
    await api.delete(`/finance/payments/${id}/`)
  },

  // ─── Bank Statements ──────────────────────────────────
  getBankStatements: async (params?: Record<string, any>): Promise<PaginatedResponse<BankStatement>> => {
    const response = await api.get('/finance/bank-statements/', { params })
    return response.data
  },
  getBankStatement: async (id: string): Promise<BankStatement> => {
    const response = await api.get(`/finance/bank-statements/${id}/`)
    return response.data
  },
  createBankStatement: async (data: Partial<BankStatement>): Promise<BankStatement> => {
    const response = await api.post('/finance/bank-statements/', data)
    return response.data
  },
  updateBankStatement: async (id: string, data: Partial<BankStatement>): Promise<BankStatement> => {
    const response = await api.patch(`/finance/bank-statements/${id}/`, data)
    return response.data
  },
  deleteBankStatement: async (id: string): Promise<void> => {
    await api.delete(`/finance/bank-statements/${id}/`)
  },

  // ─── Bank Statement Lines ─────────────────────────────
  getBankStatementLines: async (params?: Record<string, any>): Promise<PaginatedResponse<BankStatementLine>> => {
    const response = await api.get('/finance/bank-statement-lines/', { params })
    return response.data
  },
  updateBankStatementLine: async (id: string, data: Partial<BankStatementLine>): Promise<BankStatementLine> => {
    const response = await api.patch(`/finance/bank-statement-lines/${id}/`, data)
    return response.data
  },

  // ─── Exchange Rates ───────────────────────────────────
  getExchangeRates: async (params?: Record<string, any>): Promise<PaginatedResponse<ExchangeRate>> => {
    const response = await api.get('/finance/exchange-rates/', { params })
    return response.data
  },
  createExchangeRate: async (data: Partial<ExchangeRate>): Promise<ExchangeRate> => {
    const response = await api.post('/finance/exchange-rates/', data)
    return response.data
  },
  updateExchangeRate: async (id: string, data: Partial<ExchangeRate>): Promise<ExchangeRate> => {
    const response = await api.patch(`/finance/exchange-rates/${id}/`, data)
    return response.data
  },
  deleteExchangeRate: async (id: string): Promise<void> => {
    await api.delete(`/finance/exchange-rates/${id}/`)
  },

  // ─── Financial Statements ─────────────────────────────
  getTrialBalance: async (params?: Record<string, any>): Promise<{ rows: TrialBalanceRow[]; total_debit: number; total_credit: number }> => {
    const response = await api.get('/finance/financial-statements/trial_balance/', { params })
    return response.data
  },
  getIncomeStatement: async (params?: Record<string, any>): Promise<{ sections: IncomeStatementSection[]; net_income: number }> => {
    const response = await api.get('/finance/financial-statements/income_statement/', { params })
    return response.data
  },
  getBalanceSheet: async (params?: Record<string, any>): Promise<{ sections: BalanceSheetSection[]; total_assets: number; total_liabilities_equity: number }> => {
    const response = await api.get('/finance/financial-statements/balance_sheet/', { params })
    return response.data
  },

  // ==================== Tax Types ====================
  getTaxTypes: async (params?: Record<string, any>): Promise<PaginatedResponse<any>> => {
    const response = await api.get('/finance/tax-types/', { params })
    return response.data
  },
  createTaxType: async (data: any): Promise<any> => {
    const response = await api.post('/finance/tax-types/', data)
    return response.data
  },
  updateTaxType: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/finance/tax-types/${id}/`, data)
    return response.data
  },
  deleteTaxType: async (id: string): Promise<void> => {
    await api.delete(`/finance/tax-types/${id}/`)
  },

  // ==================== Credit Notes ====================
  getCreditNotes: async (params?: Record<string, any>): Promise<PaginatedResponse<any>> => {
    const response = await api.get('/finance/credit-notes/', { params })
    return response.data
  },
  createCreditNote: async (data: any): Promise<any> => {
    const response = await api.post('/finance/credit-notes/', data)
    return response.data
  },
  updateCreditNote: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/finance/credit-notes/${id}/`, data)
    return response.data
  },
  approveCreditNote: async (id: string): Promise<any> => {
    const response = await api.post(`/finance/credit-notes/${id}/approve/`)
    return response.data
  },

  // ==================== Debit Notes ====================
  getDebitNotes: async (params?: Record<string, any>): Promise<PaginatedResponse<any>> => {
    const response = await api.get('/finance/debit-notes/', { params })
    return response.data
  },
  createDebitNote: async (data: any): Promise<any> => {
    const response = await api.post('/finance/debit-notes/', data)
    return response.data
  },
  updateDebitNote: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/finance/debit-notes/${id}/`, data)
    return response.data
  },
  approveDebitNote: async (id: string): Promise<any> => {
    const response = await api.post(`/finance/debit-notes/${id}/approve/`)
    return response.data
  },

  // ==================== Recurring Journals ====================
  getRecurringJournals: async (params?: Record<string, any>): Promise<PaginatedResponse<any>> => {
    const response = await api.get('/finance/recurring-journals/', { params })
    return response.data
  },
  createRecurringJournal: async (data: any): Promise<any> => {
    const response = await api.post('/finance/recurring-journals/', data)
    return response.data
  },
  updateRecurringJournal: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/finance/recurring-journals/${id}/`, data)
    return response.data
  },
  deleteRecurringJournal: async (id: string): Promise<void> => {
    await api.delete(`/finance/recurring-journals/${id}/`)
  },
  generateRecurringJournal: async (id: string): Promise<any> => {
    const response = await api.post(`/finance/recurring-journals/${id}/generate_now/`)
    return response.data
  },

  // ==================== Year-End Close ====================
  yearEndClose: async (fiscalYearId: string): Promise<any> => {
    const response = await api.post('/finance/year-end-close/', { fiscal_year_id: fiscalYearId })
    return response.data
  },
}
