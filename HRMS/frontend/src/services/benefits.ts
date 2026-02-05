import api from '@/lib/api'
import type { LoanAccount, BenefitClaim } from '@/types'

export const benefitsService = {
  // Loans
  getMyLoans: async (): Promise<LoanAccount[]> => {
    const response = await api.get('/benefits/loans/my/')
    return response.data
  },

  getLoanById: async (id: string): Promise<LoanAccount> => {
    const response = await api.get(`/benefits/loans/${id}/`)
    return response.data
  },

  applyLoan: async (data: {
    loan_type: string
    amount_requested: number
    purpose: string
    repayment_months: number
  }) => {
    const response = await api.post('/benefits/loans/apply/', data)
    return response.data
  },

  getLoanTypes: async () => {
    const response = await api.get('/benefits/loan-types/')
    return response.data.results || response.data
  },

  getLoanRepayments: async (loanId: string) => {
    const response = await api.get(`/benefits/loans/${loanId}/repayments/`)
    return response.data
  },

  // Benefit Claims
  getMyClaims: async (): Promise<BenefitClaim[]> => {
    const response = await api.get('/benefits/claims/my/')
    return response.data
  },

  submitClaim: async (data: {
    benefit_type: string
    amount: number
    description: string
  }) => {
    const response = await api.post('/benefits/claims/', data)
    return response.data
  },

  getBenefitTypes: async () => {
    const response = await api.get('/benefits/types/')
    return response.data.results || response.data
  },

  // Admin - Loan Management
  getAllLoans: async (params?: { status?: string; loan_type?: string }) => {
    const response = await api.get('/benefits/loans/', { params })
    return response.data
  },

  approveLoan: async (id: string, data: { interest_rate: number; approved_amount: number }) => {
    const response = await api.post(`/benefits/loans/${id}/approve/`, data)
    return response.data
  },

  rejectLoan: async (id: string, reason: string) => {
    const response = await api.post(`/benefits/loans/${id}/reject/`, { reason })
    return response.data
  },

  disburseLoan: async (id: string) => {
    const response = await api.post(`/benefits/loans/${id}/disburse/`)
    return response.data
  },

  // Admin - Claims Management
  getAllClaims: async (params?: { status?: string; benefit_type?: string }) => {
    const response = await api.get('/benefits/claims/', { params })
    return response.data
  },

  approveClaim: async (id: string, approved_amount: number) => {
    const response = await api.post(`/benefits/claims/${id}/approve/`, { approved_amount })
    return response.data
  },

  rejectClaim: async (id: string, reason: string) => {
    const response = await api.post(`/benefits/claims/${id}/reject/`, { reason })
    return response.data
  },
}
