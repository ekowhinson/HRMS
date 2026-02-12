import api from '@/lib/api'

// Types
export interface LoanType {
  id: string
  code: string
  name: string
  description: string | null
  max_amount: number | null
  max_salary_multiplier: number | null
  salary_component: 'GROSS' | 'BASIC' | 'NET'
  max_tenure_months: number
  min_tenure_months: number
  interest_rate: number
  interest_type: string
  min_service_months: number
  max_active_loans: number
  cooldown_months: number
  require_guarantor: boolean
  number_of_guarantors: number
  max_deduction_percentage: number
  approval_levels: number
  auto_post_to_payroll: boolean
  is_active: boolean
}

export interface LoanAccount {
  id: string
  loan_number: string
  employee: string
  employee_name: string
  employee_number: string
  loan_type: string
  loan_type_name: string
  loan_type_details?: LoanType
  principal_amount: number
  interest_rate: number
  tenure_months: number
  purpose: string
  total_interest: number
  total_amount: number
  monthly_installment: number
  disbursed_amount: number
  principal_paid: number
  interest_paid: number
  outstanding_balance: number
  application_date: string
  disbursement_date: string | null
  first_deduction_date: string | null
  last_deduction_date: string | null
  expected_completion_date: string | null
  actual_completion_date: string | null
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISBURSED' | 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'WRITTEN_OFF' | 'CANCELLED'
  approved_by: string | null
  approved_by_name: string | null
  approved_at: string | null
  rejection_reason: string | null
  notes: string | null
  schedule?: LoanSchedule[]
  transactions?: LoanTransaction[]
  created_at: string
  updated_at: string
}

export interface LoanSchedule {
  id: string
  loan_account: string
  installment_number: number
  due_date: string
  principal_amount: number
  interest_amount: number
  total_amount: number
  opening_balance: number
  closing_balance: number
  is_paid: boolean
  paid_date: string | null
  paid_amount: number | null
}

export interface LoanTransaction {
  id: string
  loan_account: string
  transaction_type: string
  transaction_date: string
  principal_amount: number
  interest_amount: number
  total_amount: number
  balance_after: number
  reference_number: string | null
  notes: string | null
}

export interface LoanEligibility {
  is_eligible: boolean
  errors: string[]
  warnings: string[]
  max_amount: number
  max_tenure_months: number
  interest_rate: number
  salary_component: string
  cooldown_months: number
}

export interface LoanSummary {
  total_loans: number
  pending_approval: number
  active_loans: number
  completed_loans: number
  total_disbursed: number
  total_outstanding: number
  by_type: Array<{
    loan_type__name: string
    count: number
    total: number
  }>
}

export interface BenefitType {
  id: string
  code: string
  name: string
  category: string
  description: string | null
  is_active: boolean
}

export interface BenefitClaim {
  id: string
  claim_number: string
  employee: string
  employee_name: string
  benefit_type: string
  benefit_type_name: string
  claimed_amount: number
  approved_amount: number | null
  status: string
  claim_date: string
}

export const benefitsService = {
  // Loan Types
  getLoanTypes: async (): Promise<LoanType[]> => {
    const response = await api.get('/benefits/loan-types/', { params: { page_size: 100 } })
    return response.data.results || response.data
  },

  getLoanType: async (id: string): Promise<LoanType> => {
    const response = await api.get(`/benefits/loan-types/${id}/`)
    return response.data
  },

  createLoanType: async (data: Partial<LoanType>): Promise<LoanType> => {
    const response = await api.post('/benefits/loan-types/', data)
    return response.data
  },

  updateLoanType: async (id: string, data: Partial<LoanType>): Promise<LoanType> => {
    const response = await api.patch(`/benefits/loan-types/${id}/`, data)
    return response.data
  },

  // Loans
  getAllLoans: async (params?: {
    status?: string
    loan_type?: string
    employee?: string
  }): Promise<LoanAccount[]> => {
    const response = await api.get('/benefits/loans/', { params })
    return response.data.results || response.data
  },

  getMyLoans: async (): Promise<LoanAccount[]> => {
    const response = await api.get('/benefits/loans/my_loans/')
    return response.data
  },

  getPendingLoans: async (): Promise<LoanAccount[]> => {
    const response = await api.get('/benefits/loans/pending_approval/')
    return response.data
  },

  getActiveLoans: async (): Promise<LoanAccount[]> => {
    const response = await api.get('/benefits/loans/active/')
    return response.data
  },

  getLoanById: async (id: string): Promise<LoanAccount> => {
    const response = await api.get(`/benefits/loans/${id}/`)
    return response.data
  },

  createLoan: async (data: {
    employee?: string
    loan_type: string
    principal_amount: number
    tenure_months: number
    purpose: string
  }): Promise<LoanAccount> => {
    const response = await api.post('/benefits/loans/', data)
    return response.data
  },

  submitLoan: async (id: string): Promise<LoanAccount> => {
    const response = await api.post(`/benefits/loans/${id}/submit/`)
    return response.data
  },

  approveLoan: async (id: string): Promise<LoanAccount> => {
    const response = await api.post(`/benefits/loans/${id}/approve/`)
    return response.data
  },

  rejectLoan: async (id: string, reason: string): Promise<LoanAccount> => {
    const response = await api.post(`/benefits/loans/${id}/reject/`, { reason })
    return response.data
  },

  disburseLoan: async (id: string): Promise<LoanAccount> => {
    const response = await api.post(`/benefits/loans/${id}/disburse/`)
    return response.data
  },

  getLoanSchedule: async (id: string): Promise<LoanSchedule[]> => {
    const response = await api.get(`/benefits/loans/${id}/schedule/`)
    return response.data
  },

  getLoanTransactions: async (id: string): Promise<LoanTransaction[]> => {
    const response = await api.get(`/benefits/loans/${id}/transactions/`)
    return response.data
  },

  getLoanStatement: async (id: string) => {
    const response = await api.get(`/benefits/loans/${id}/statement/`)
    return response.data
  },

  // Eligibility Check
  checkLoanEligibility: async (params: {
    employee_id: string
    loan_type_id: string
  }): Promise<LoanEligibility> => {
    const response = await api.get('/benefits/loans/check-eligibility/', { params })
    return response.data
  },

  // Loan Summary
  getLoanSummary: async (): Promise<LoanSummary> => {
    const response = await api.get('/benefits/loans/summary/')
    return response.data
  },

  // Employee Loan Summary
  getEmployeeLoanSummary: async (employeeId: string) => {
    const response = await api.get(`/benefits/employee/${employeeId}/loans/`)
    return response.data
  },

  // Benefit Types
  getBenefitTypes: async (): Promise<BenefitType[]> => {
    const response = await api.get('/benefits/benefit-types/')
    return response.data.results || response.data
  },

  // Benefit Enrollments
  getBenefitEnrollments: async (params?: {
    employee?: string
    benefit_type?: string
    is_active?: boolean
  }) => {
    const response = await api.get('/benefits/benefit-enrollments/', { params })
    return response.data.results || response.data
  },

  // Benefit Claims
  getBenefitClaims: async (params?: {
    status?: string
    benefit_type?: string
    employee?: string
  }): Promise<BenefitClaim[]> => {
    const response = await api.get('/benefits/benefit-claims/', { params })
    return response.data.results || response.data
  },

  createBenefitClaim: async (data: {
    employee: string
    benefit_type: string
    claimed_amount: number
    claim_date: string
    description?: string
  }): Promise<BenefitClaim> => {
    const response = await api.post('/benefits/benefit-claims/', data)
    return response.data
  },

  approveBenefitClaim: async (id: string, approved_amount?: number): Promise<BenefitClaim> => {
    const response = await api.post(`/benefits/benefit-claims/${id}/approve/`, { approved_amount })
    return response.data
  },

  rejectBenefitClaim: async (id: string, reason: string): Promise<BenefitClaim> => {
    const response = await api.post(`/benefits/benefit-claims/${id}/reject/`, { reason })
    return response.data
  },

  getEmployeeBenefitSummary: async (employeeId: string) => {
    const response = await api.get(`/benefits/employee/${employeeId}/benefits/`)
    return response.data
  },

  // Expense Types
  getExpenseTypes: async () => {
    const response = await api.get('/benefits/expense-types/')
    return response.data.results || response.data
  },

  // Expense Claims
  getExpenseClaims: async (params?: {
    status?: string
    employee?: string
  }) => {
    const response = await api.get('/benefits/expense-claims/', { params })
    return response.data.results || response.data
  },

  createExpenseClaim: async (data: Record<string, unknown>) => {
    const response = await api.post('/benefits/expense-claims/', data)
    return response.data
  },

  approveExpenseClaim: async (id: string, approved_amount?: number) => {
    const response = await api.post(`/benefits/expense-claims/${id}/approve/`, { approved_amount })
    return response.data
  },

  // ==================== Organization Benefits ====================

  // Funeral Grant Types
  getFuneralGrantTypes: async () => {
    const response = await api.get('/benefits/funeral-grant-types/')
    return response.data.results || response.data
  },

  getFuneralGrantType: async (id: string) => {
    const response = await api.get(`/benefits/funeral-grant-types/${id}/`)
    return response.data
  },

  // Funeral Grant Claims
  getFuneralGrantClaims: async (params?: { status?: string; grant_type?: string; employee?: string }) => {
    const response = await api.get('/benefits/funeral-grant-claims/', { params })
    return response.data.results || response.data
  },

  getMyFuneralGrantClaims: async () => {
    const response = await api.get('/benefits/funeral-grant-claims/my_claims/')
    return response.data
  },

  getFuneralGrantEligibility: async () => {
    const response = await api.get('/benefits/funeral-grant-claims/eligibility/')
    return response.data
  },

  createFuneralGrantClaim: async (data: {
    grant_type: string
    deceased_name: string
    relationship: string
    date_of_death: string
    child_sequence?: number
    dependent?: string
    grant_amount: number
    death_certificate_attached?: boolean
    burial_permit_attached?: boolean
    other_documents?: string
    notes?: string
  }) => {
    const response = await api.post('/benefits/funeral-grant-claims/', data)
    return response.data
  },

  submitFuneralGrantClaim: async (id: string) => {
    const response = await api.post(`/benefits/funeral-grant-claims/${id}/submit/`)
    return response.data
  },

  approveFuneralGrantClaim: async (id: string, approved_amount?: number) => {
    const response = await api.post(`/benefits/funeral-grant-claims/${id}/approve/`, { approved_amount })
    return response.data
  },

  rejectFuneralGrantClaim: async (id: string, reason: string) => {
    const response = await api.post(`/benefits/funeral-grant-claims/${id}/reject/`, { reason })
    return response.data
  },

  // Medical Lens Benefits
  getMedicalLensBenefits: async () => {
    const response = await api.get('/benefits/medical-lens-benefits/')
    return response.data.results || response.data
  },

  // Medical Lens Claims
  getMedicalLensClaims: async (params?: { status?: string; employee?: string }) => {
    const response = await api.get('/benefits/medical-lens-claims/', { params })
    return response.data.results || response.data
  },

  getMyMedicalLensClaims: async () => {
    const response = await api.get('/benefits/medical-lens-claims/my_claims/')
    return response.data
  },

  getMedicalLensEligibility: async () => {
    const response = await api.get('/benefits/medical-lens-claims/eligibility/')
    return response.data
  },

  createMedicalLensClaim: async (data: {
    benefit: string
    expense_date: string
    claimed_amount: number
    optical_provider?: string
    prescription_number?: string
    description?: string
    notes?: string
  }) => {
    const response = await api.post('/benefits/medical-lens-claims/', data)
    return response.data
  },

  submitMedicalLensClaim: async (id: string) => {
    const response = await api.post(`/benefits/medical-lens-claims/${id}/submit/`)
    return response.data
  },

  approveMedicalLensClaim: async (id: string, approved_amount?: number) => {
    const response = await api.post(`/benefits/medical-lens-claims/${id}/approve/`, { approved_amount })
    return response.data
  },

  rejectMedicalLensClaim: async (id: string, reason: string) => {
    const response = await api.post(`/benefits/medical-lens-claims/${id}/reject/`, { reason })
    return response.data
  },

  // Professional Subscription Types
  getProfessionalSubscriptionTypes: async () => {
    const response = await api.get('/benefits/professional-subscription-types/')
    return response.data.results || response.data
  },

  // Professional Subscriptions
  getProfessionalSubscriptions: async (params?: { status?: string; subscription_type?: string; employee?: string; claim_year?: number }) => {
    const response = await api.get('/benefits/professional-subscriptions/', { params })
    return response.data.results || response.data
  },

  getMyProfessionalSubscriptions: async (year?: number) => {
    const response = await api.get('/benefits/professional-subscriptions/my_subscriptions/', { params: { year } })
    return response.data
  },

  getProfessionalSubscriptionEligibility: async () => {
    const response = await api.get('/benefits/professional-subscriptions/eligibility/')
    return response.data
  },

  createProfessionalSubscription: async (data: {
    subscription_type: string
    professional_body: string
    membership_number?: string
    subscription_period_start: string
    subscription_period_end: string
    claimed_amount: number
    receipt_attached?: boolean
    membership_proof_attached?: boolean
    notes?: string
  }) => {
    const response = await api.post('/benefits/professional-subscriptions/', data)
    return response.data
  },

  submitProfessionalSubscription: async (id: string) => {
    const response = await api.post(`/benefits/professional-subscriptions/${id}/submit/`)
    return response.data
  },

  approveProfessionalSubscription: async (id: string, approved_amount?: number) => {
    const response = await api.post(`/benefits/professional-subscriptions/${id}/approve/`, { approved_amount })
    return response.data
  },

  rejectProfessionalSubscription: async (id: string, reason: string) => {
    const response = await api.post(`/benefits/professional-subscriptions/${id}/reject/`, { reason })
    return response.data
  },

  // Benefit Eligibility Records
  getBenefitEligibilityRecords: async (params?: { employee?: string; benefit_category?: string; is_eligible?: boolean }) => {
    const response = await api.get('/benefits/benefit-eligibility-records/', { params })
    return response.data.results || response.data
  },

  getMyBenefitEligibility: async () => {
    const response = await api.get('/benefits/benefit-eligibility-records/my_eligibility/')
    return response.data
  },

  // ==================== Third-Party Deductions ====================

  // Third-Party Lenders
  getThirdPartyLenders: async (params?: { lender_type?: string; is_active?: boolean }) => {
    const response = await api.get('/benefits/third-party-lenders/', { params })
    return response.data.results || response.data
  },

  getActiveLenders: async () => {
    const response = await api.get('/benefits/third-party-lenders/active/')
    return response.data
  },

  getLendersByType: async (type: string) => {
    const response = await api.get('/benefits/third-party-lenders/by_type/', { params: { type } })
    return response.data
  },

  getLenderSummary: async (id: string) => {
    const response = await api.get(`/benefits/third-party-lenders/${id}/summary/`)
    return response.data
  },

  createThirdPartyLender: async (data: {
    code: string
    name: string
    lender_type: string
    description?: string
    contact_person?: string
    phone?: string
    email?: string
    address?: string
    bank_name?: string
    bank_branch?: string
    account_number?: string
    account_name?: string
    default_deduction_percentage?: number
    max_deduction_percentage?: number
  }) => {
    const response = await api.post('/benefits/third-party-lenders/', data)
    return response.data
  },

  updateThirdPartyLender: async (id: string, data: Partial<ThirdPartyLender>) => {
    const response = await api.patch(`/benefits/third-party-lenders/${id}/`, data)
    return response.data
  },

  // Third-Party Deductions
  getThirdPartyDeductions: async (params?: { employee?: string; lender?: string; status?: string; deduction_type?: string }) => {
    const response = await api.get('/benefits/third-party-deductions/', { params })
    return response.data.results || response.data
  },

  getActiveThirdPartyDeductions: async () => {
    const response = await api.get('/benefits/third-party-deductions/active/')
    return response.data
  },

  getMyThirdPartyDeductions: async () => {
    const response = await api.get('/benefits/third-party-deductions/my_deductions/')
    return response.data
  },

  getThirdPartyDeductionsByEmployee: async (employeeId: string) => {
    const response = await api.get('/benefits/third-party-deductions/by_employee/', { params: { employee_id: employeeId } })
    return response.data
  },

  createThirdPartyDeduction: async (data: {
    employee: string
    lender: string
    external_reference?: string
    deduction_type: 'FIXED' | 'PERCENT' | 'LOAN' | 'SAVINGS'
    deduction_amount?: number
    deduction_percentage?: number
    salary_component?: 'GROSS' | 'BASIC' | 'NET'
    principal_amount?: number
    interest_rate?: number
    total_loan_amount?: number
    outstanding_balance?: number
    start_date: string
    end_date?: string
    tenure_months?: number
    purpose?: string
    notes?: string
  }) => {
    const response = await api.post('/benefits/third-party-deductions/', data)
    return response.data
  },

  activateThirdPartyDeduction: async (id: string) => {
    const response = await api.post(`/benefits/third-party-deductions/${id}/activate/`)
    return response.data
  },

  suspendThirdPartyDeduction: async (id: string) => {
    const response = await api.post(`/benefits/third-party-deductions/${id}/suspend/`)
    return response.data
  },

  resumeThirdPartyDeduction: async (id: string) => {
    const response = await api.post(`/benefits/third-party-deductions/${id}/resume/`)
    return response.data
  },

  completeThirdPartyDeduction: async (id: string) => {
    const response = await api.post(`/benefits/third-party-deductions/${id}/complete/`)
    return response.data
  },

  recordThirdPartyPayment: async (id: string, data: { amount: number; payroll_period_id?: string; reference?: string }) => {
    const response = await api.post(`/benefits/third-party-deductions/${id}/record_payment/`, data)
    return response.data
  },

  getThirdPartyDeductionHistory: async (id: string) => {
    const response = await api.get(`/benefits/third-party-deductions/${id}/history/`)
    return response.data
  },

  // Third-Party Remittances
  getThirdPartyRemittances: async (params?: { lender?: string; payroll_period?: string; status?: string }) => {
    const response = await api.get('/benefits/third-party-remittances/', { params })
    return response.data.results || response.data
  },

  getRemittancesByLender: async (lenderId: string) => {
    const response = await api.get('/benefits/third-party-remittances/by_lender/', { params: { lender_id: lenderId } })
    return response.data
  },

  createThirdPartyRemittance: async (data: {
    lender: string
    payroll_period?: string
    remittance_date: string
    notes?: string
  }) => {
    const response = await api.post('/benefits/third-party-remittances/', data)
    return response.data
  },

  generateRemittanceBreakdown: async (id: string) => {
    const response = await api.post(`/benefits/third-party-remittances/${id}/generate_breakdown/`)
    return response.data
  },

  approveRemittance: async (id: string) => {
    const response = await api.post(`/benefits/third-party-remittances/${id}/approve/`)
    return response.data
  },

  markRemittancePaid: async (id: string, data: { payment_reference?: string; payment_method?: string; bank_reference?: string }) => {
    const response = await api.post(`/benefits/third-party-remittances/${id}/mark_paid/`, data)
    return response.data
  },

  // Credit Union Accounts
  getCreditUnionAccounts: async (params?: { employee?: string; credit_union?: string; is_active?: boolean }) => {
    const response = await api.get('/benefits/credit-union-accounts/', { params })
    return response.data.results || response.data
  },

  getMyCreditUnionAccount: async () => {
    const response = await api.get('/benefits/credit-union-accounts/my_account/')
    return response.data
  },

  createCreditUnionAccount: async (data: {
    employee: string
    credit_union: string
    member_number: string
    account_type: 'SAVINGS' | 'LOAN' | 'BOTH'
    membership_date?: string
    savings_contribution?: number
  }) => {
    const response = await api.post('/benefits/credit-union-accounts/', data)
    return response.data
  },

  updateCreditUnionSavings: async (id: string, savings_contribution: number) => {
    const response = await api.post(`/benefits/credit-union-accounts/${id}/update_savings/`, { savings_contribution })
    return response.data
  },

  // Student Loan Accounts
  getStudentLoanAccounts: async (params?: { employee?: string; repayment_status?: string }) => {
    const response = await api.get('/benefits/student-loan-accounts/', { params })
    return response.data.results || response.data
  },

  getMyStudentLoanAccount: async () => {
    const response = await api.get('/benefits/student-loan-accounts/my_account/')
    return response.data
  },

  createStudentLoanAccount: async (data: {
    employee: string
    sltf_account_number: string
    beneficiary_id?: string
    institution_attended?: string
    program_studied?: string
    graduation_year?: number
    original_loan_amount: number
    total_with_interest: number
    interest_rate?: number
    monthly_deduction: number
    outstanding_balance: number
    repayment_start_date?: string
    expected_completion_date?: string
    notes?: string
  }) => {
    const response = await api.post('/benefits/student-loan-accounts/', data)
    return response.data
  },

  updateStudentLoanBalance: async (id: string, data: { outstanding_balance?: number; total_repaid?: number }) => {
    const response = await api.post(`/benefits/student-loan-accounts/${id}/update_balance/`, data)
    return response.data
  },

  // Rent Deductions
  getRentDeductions: async (params?: { employee?: string; housing_type?: string; is_active?: boolean }) => {
    const response = await api.get('/benefits/rent-deductions/', { params })
    return response.data.results || response.data
  },

  getMyRentDeduction: async () => {
    const response = await api.get('/benefits/rent-deductions/my_rent/')
    return response.data
  },

  createRentDeduction: async (data: {
    employee: string
    housing_type: 'GOVT' | 'OFFICIAL' | 'SUBSIDIZED' | 'OTHER'
    property_address?: string
    property_number?: string
    deduction_percentage?: number
    fixed_amount?: number
    occupancy_start_date: string
    notes?: string
  }) => {
    const response = await api.post('/benefits/rent-deductions/', data)
    return response.data
  },

  endRentOccupancy: async (id: string, end_date?: string) => {
    const response = await api.post(`/benefits/rent-deductions/${id}/end_occupancy/`, { end_date })
    return response.data
  },

  getActiveRentByProperty: async () => {
    const response = await api.get('/benefits/rent-deductions/active_by_property/')
    return response.data
  },

  // Legacy alias for BenefitsPage
  getMyClaims: async (): Promise<BenefitClaim[]> => {
    const response = await api.get('/benefits/benefit-claims/')
    return response.data.results || response.data
  },

  applyLoan: async (data: {
    loan_type: string
    amount_requested: number
    purpose: string
    repayment_months: number
  }): Promise<LoanAccount> => {
    const response = await api.post('/benefits/loans/', {
      loan_type: data.loan_type,
      principal_amount: data.amount_requested,
      tenure_months: data.repayment_months,
      purpose: data.purpose,
    })
    return response.data
  },

  submitClaim: async (data: {
    benefit_type: string
    amount: number
    description: string
  }): Promise<BenefitClaim> => {
    const response = await api.post('/benefits/benefit-claims/', {
      benefit_type: data.benefit_type,
      claimed_amount: data.amount,
      description: data.description,
      claim_date: new Date().toISOString().split('T')[0],
    })
    return response.data
  },
}

// ==================== Types for Third-Party Features ====================

export interface ThirdPartyLender {
  id: string
  code: string
  name: string
  lender_type: 'CREDIT_UNION' | 'STUDENT_LOAN' | 'RENT' | 'INSURANCE' | 'WELFARE' | 'COOP' | 'BANK' | 'OTHER'
  lender_type_display: string
  description: string
  contact_person: string
  phone: string
  email: string
  address: string
  bank_name: string
  bank_branch: string
  account_number: string
  account_name: string
  default_deduction_percentage: number | null
  max_deduction_percentage: number
  remittance_frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY'
  is_active: boolean
}

export interface ThirdPartyDeduction {
  id: string
  deduction_number: string
  employee: string
  employee_name: string
  employee_number: string
  lender: string
  lender_name: string
  external_reference: string
  deduction_type: 'FIXED' | 'PERCENT' | 'LOAN' | 'SAVINGS'
  deduction_type_display: string
  deduction_amount: number | null
  deduction_percentage: number | null
  salary_component: 'GROSS' | 'BASIC' | 'NET'
  principal_amount: number | null
  interest_rate: number | null
  total_loan_amount: number | null
  total_repaid: number
  outstanding_balance: number | null
  start_date: string
  end_date: string | null
  tenure_months: number | null
  status: 'DRAFT' | 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'COMPLETED' | 'CANCELLED'
  status_display: string
  total_deductions: number
  total_deducted_amount: number
  last_deduction_date: string | null
  purpose: string
  notes: string
}

export interface FuneralGrantType {
  id: string
  beneficiary_type: 'SELF' | 'SPOUSE' | 'CHILD' | 'PARENT' | 'DEPENDENT'
  beneficiary_type_display: string
  grant_amount: number
  max_occurrences: number
  requires_documentation: boolean
  documentation_required: string
  is_active: boolean
}

export interface FuneralGrantClaim {
  id: string
  claim_number: string
  employee: string
  employee_name: string
  grant_type: string
  grant_type_display: string
  deceased_name: string
  relationship: string
  date_of_death: string
  child_sequence: number | null
  grant_amount: number
  approved_amount: number | null
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED'
  status_display: string
  death_certificate_attached: boolean
  burial_permit_attached: boolean
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string
  paid_date: string | null
  payment_reference: string
  claim_date: string
}

export interface MedicalLensBenefit {
  id: string
  code: string
  name: string
  max_amount: number
  eligibility_period_months: number
  min_service_months: number
  requires_prescription: boolean
  is_active: boolean
}

export interface MedicalLensClaim {
  id: string
  claim_number: string
  employee: string
  employee_name: string
  benefit: string
  expense_date: string
  claimed_amount: number
  approved_amount: number | null
  optical_provider: string
  prescription_number: string
  description: string
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED'
  status_display: string
  next_eligible_date: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string
  paid_date: string | null
  claim_date: string
}

export interface ProfessionalSubscriptionType {
  id: string
  code: string
  name: string
  description: string
  max_annual_amount: number
  requires_proof_of_membership: boolean
  requires_annual_renewal: boolean
  is_active: boolean
}

export interface ProfessionalSubscription {
  id: string
  claim_number: string
  employee: string
  employee_name: string
  subscription_type: string
  subscription_type_name: string
  claim_year: number
  professional_body: string
  membership_number: string
  subscription_period_start: string
  subscription_period_end: string
  claimed_amount: number
  approved_amount: number | null
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID' | 'EXPIRED' | 'CANCELLED'
  status_display: string
  receipt_attached: boolean
  membership_proof_attached: boolean
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string
  paid_date: string | null
}
