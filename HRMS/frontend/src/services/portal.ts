import api from '@/lib/api'
import type {
  Employee,
  LeaveBalance,
  LeaveRequest,
  EmergencyContact,
  Dependent,
  BankAccount,
  TeamMember,
  TeamLeaveOverview,
} from '@/types'

export const portalService = {
  // Profile
  async getMyProfile(): Promise<Employee> {
    const response = await api.get('/employees/me/')
    return response.data
  },

  async updateMyProfile(data: Partial<Employee>): Promise<Employee> {
    const response = await api.patch('/employees/me/', data)
    return response.data
  },

  async uploadProfilePhoto(file: File): Promise<Employee> {
    const formData = new FormData()
    formData.append('photo', file)
    const response = await api.patch('/employees/me/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  // Leave Balances
  async getMyLeaveBalances(year?: number): Promise<LeaveBalance[]> {
    const params = year ? { year } : {}
    const response = await api.get('/employees/me/leave-balances/', { params })
    // Handle wrapped responses and paginated responses
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load leave balances')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  // Leave History
  async getMyLeaveHistory(params?: {
    status?: string
    year?: number
  }): Promise<LeaveRequest[]> {
    const response = await api.get('/employees/me/leave-history/', { params })
    // Handle wrapped responses and paginated responses
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load leave history')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  // Emergency Contacts
  async getMyEmergencyContacts(): Promise<EmergencyContact[]> {
    const response = await api.get('/employees/me/emergency-contacts/')
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load emergency contacts')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  async createEmergencyContact(
    data: Omit<EmergencyContact, 'id'>
  ): Promise<EmergencyContact> {
    const response = await api.post('/employees/me/emergency-contacts/', data)
    return response.data
  },

  async updateEmergencyContact(
    id: string,
    data: Partial<EmergencyContact>
  ): Promise<EmergencyContact> {
    const response = await api.patch(
      `/employees/me/emergency-contacts/${id}/`,
      data
    )
    return response.data
  },

  async deleteEmergencyContact(id: string): Promise<void> {
    await api.delete(`/employees/me/emergency-contacts/${id}/`)
  },

  // Dependents
  async getMyDependents(): Promise<Dependent[]> {
    const response = await api.get('/employees/me/dependents/')
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load dependents')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  async createDependent(data: Omit<Dependent, 'id' | 'age'>): Promise<Dependent> {
    const response = await api.post('/employees/me/dependents/', data)
    return response.data
  },

  async updateDependent(id: string, data: Partial<Dependent>): Promise<Dependent> {
    const response = await api.patch(`/employees/me/dependents/${id}/`, data)
    return response.data
  },

  async deleteDependent(id: string): Promise<void> {
    await api.delete(`/employees/me/dependents/${id}/`)
  },

  // Bank Accounts (read-only)
  async getMyBankAccounts(): Promise<BankAccount[]> {
    const response = await api.get('/employees/me/bank-accounts/')
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load bank accounts')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  // Team (for managers)
  async getMyTeam(): Promise<TeamMember[]> {
    const response = await api.get('/employees/me/team/')
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load team')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  async getTeamLeaveOverview(): Promise<TeamLeaveOverview> {
    const response = await api.get('/employees/me/team/leave-overview/')
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load team leave overview')
    return data
  },
}
