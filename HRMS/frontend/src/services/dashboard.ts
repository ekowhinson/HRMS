import api from '@/lib/api'
import type { DashboardStats } from '@/types'

export interface PayrollTrend {
  month: string
  total_gross: number
  total_net: number
  total_deductions: number
  total_paye: number
  total_ssnit: number
  total_employer_cost: number
  employee_count: number
}

export interface LeaveDashboard {
  pending_requests: number
  approved_today: number
  on_leave_today: number
  upcoming_leave: number
  leave_by_type: { leave_type: string; count: number; color?: string }[]
  monthly_trend: { month: string; approved: number; rejected: number }[]
}

export interface PerformanceDashboard {
  active_appraisals: number
  pending_reviews: number
  completed_this_cycle: number
  average_rating: number
  rating_distribution: { rating: string; count: number }[]
  completion_rate: number
}

export interface RecentActivity {
  id: string
  type: 'leave' | 'payroll' | 'employee' | 'performance'
  title: string
  description: string
  timestamp: string
  user?: string
  status?: string
}

export interface Alert {
  id: string
  type: 'warning' | 'info' | 'danger' | 'success'
  title: string
  message: string
  action_url?: string
  action_label?: string
}

export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/reports/dashboard/')
    return response.data
  },

  getHRDashboard: async (): Promise<{
    employee_by_status: { status: string; count: number }[]
    employee_by_department: { department_name: string; count: number }[]
    employee_by_gender: { gender: string; count: number }[]
    employee_by_grade: { grade_name: string; count: number }[]
    age_distribution: { range: string; count: number }[]
    tenure_distribution: { range: string; count: number }[]
    on_probation: number
    pending_confirmations: number
    birthdays_this_month: number
    anniversaries_this_month: number
  }> => {
    const response = await api.get('/reports/dashboard/hr/')
    return response.data
  },

  getPayrollDashboard: async (): Promise<{
    payroll_trends: PayrollTrend[]
    latest_payroll: {
      run_number: string
      period: string
      status: string
      run_date: string
      total_employees: number
      total_gross: number
      total_net: number
      total_deductions: number
      total_paye: number
      total_ssnit_employee: number
      total_ssnit_employer: number
      total_tier2_employer: number
      total_overtime_tax: number
      total_bonus_tax: number
      total_employer_cost: number
    }
    pending_runs: number
    year_to_date: {
      total_gross: number
      total_net: number
      total_deductions: number
      total_paye: number
      total_employer_cost: number
    }
    deduction_breakdown: { name: string; amount: number }[]
  }> => {
    const response = await api.get('/reports/dashboard/payroll/')
    return response.data
  },

  getLeaveDashboard: async (): Promise<LeaveDashboard> => {
    try {
      const response = await api.get('/reports/dashboard/leave/')
      return response.data
    } catch {
      return {
        pending_requests: 0,
        approved_today: 0,
        on_leave_today: 0,
        upcoming_leave: 0,
        leave_by_type: [],
        monthly_trend: [],
      }
    }
  },

  getPerformanceDashboard: async (): Promise<PerformanceDashboard> => {
    try {
      const response = await api.get('/reports/dashboard/performance/')
      return response.data
    } catch {
      // Return mock data if endpoint doesn't exist
      return {
        active_appraisals: 0,
        pending_reviews: 0,
        completed_this_cycle: 0,
        average_rating: 0,
        rating_distribution: [],
        completion_rate: 0,
      }
    }
  },

  getRecentActivities: async (limit = 10): Promise<RecentActivity[]> => {
    try {
      const response = await api.get('/reports/dashboard/activities/', { params: { limit } })
      return response.data
    } catch {
      return []
    }
  },

  getAlerts: async (): Promise<Alert[]> => {
    try {
      const response = await api.get('/reports/dashboard/alerts/')
      return response.data
    } catch {
      return []
    }
  },

  // Get departments for filtering
  getDepartments: async () => {
    const response = await api.get('/organization/departments/')
    return response.data.results || response.data
  },

  // Get payroll periods for filtering
  getPayrollPeriods: async () => {
    const response = await api.get('/payroll/periods/')
    return response.data.results || response.data
  },
}

export default dashboardService
