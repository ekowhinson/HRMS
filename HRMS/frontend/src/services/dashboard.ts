import api from '@/lib/api'
import type { DashboardStats } from '@/types'

export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/reports/dashboard/')
    return response.data
  },

  getHRDashboard: async (): Promise<{
    employee_by_status: { status: string; count: number }[]
    employee_by_department: { department_name: string; count: number }[]
    employee_by_gender: { gender: string; count: number }[]
    on_probation: number
    pending_confirmations: number
  }> => {
    const response = await api.get('/reports/dashboard/hr/')
    return response.data
  },

  getPayrollDashboard: async (): Promise<{
    payroll_trends: { month: string; total_gross: number; total_net: number }[]
    latest_payroll: {
      run_number: string
      total_employees: number
      total_gross: number
      total_net: number
    }
    pending_runs: number
  }> => {
    const response = await api.get('/reports/dashboard/payroll/')
    return response.data
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

  // Get leave statistics
  getLeaveDashboard: async () => {
    const response = await api.get('/reports/dashboard/leave/')
    return response.data
  },
}
