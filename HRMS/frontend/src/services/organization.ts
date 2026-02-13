import api from '@/lib/api'
import type { License } from '@/types'

// ==================== Types ====================

export interface Organization {
  id: string
  name: string
  code: string
  slug: string
  logo_url: string | null
  primary_color: string
  country: string
  currency: string
  currency_symbol: string
  timezone: string
  date_format: string
  financial_year_start_month: number
  leave_year_start_month: number
  payroll_processing_day: number
  email_domain: string
  website: string
  address: string
  phone: string
  from_email: string
  is_active: boolean
  subscription_plan: string
  max_employees: number
  max_users: number
  trial_expires_at: string | null
  modules_enabled: string[]
  setup_completed: boolean
  active_license?: License | null
  created_at: string
  updated_at: string
}

export interface SetupRequest {
  modules?: string[]
  year?: number
  force?: boolean
  async?: boolean
}

export interface SetupModuleResult {
  created: number
  updated: number
  skipped: number
}

export interface SetupResult {
  status: string
  setup_completed?: boolean
  results?: Record<string, SetupModuleResult>
  total_created?: number
  total_updated?: number
  task_id?: string
  message?: string
}

export interface SetupStatus {
  setup_completed: boolean
  organization: Organization
}

// ==================== Service ====================

export const organizationService = {
  // Get all organizations (tenants)
  getOrganizations: async (params?: { page?: number; page_size?: number }): Promise<{
    results: Organization[]
    count: number
  }> => {
    const response = await api.get('/organization/tenants/', { params })
    return response.data
  },

  // Get single organization
  getOrganization: async (id: string): Promise<Organization> => {
    const response = await api.get(`/organization/tenants/${id}/`)
    return response.data
  },

  // Create organization
  createOrganization: async (data: Partial<Organization>): Promise<Organization> => {
    const response = await api.post('/organization/tenants/', data)
    return response.data
  },

  // Update organization
  updateOrganization: async (id: string, data: Partial<Organization>): Promise<Organization> => {
    const response = await api.patch(`/organization/tenants/${id}/`, data)
    return response.data
  },

  // Activate organization
  activateOrganization: async (id: string): Promise<void> => {
    await api.post(`/organization/tenants/${id}/activate/`)
  },

  // Deactivate organization
  deactivateOrganization: async (id: string): Promise<void> => {
    await api.post(`/organization/tenants/${id}/deactivate/`)
  },

  // Trigger organization setup
  setupOrganization: async (id: string, options?: SetupRequest): Promise<SetupResult> => {
    const response = await api.post(`/organization/tenants/${id}/setup/`, options || {})
    return response.data
  },

  // Get setup status
  getSetupStatus: async (id: string): Promise<SetupStatus> => {
    const response = await api.get(`/organization/tenants/${id}/setup-status/`)
    return response.data
  },

  // Get organization stats
  getOrganizationStats: async (id: string): Promise<{
    organization: Organization
    employee_count: number
    user_count: number
    max_employees: number
    max_users: number
    employee_utilization: number
    user_utilization: number
  }> => {
    const response = await api.get(`/organization/tenants/${id}/stats/`)
    return response.data
  },

  // Update enabled modules
  updateModules: async (id: string, modules: string[]): Promise<{ modules_enabled: string[] }> => {
    const response = await api.post(`/organization/tenants/${id}/modules/`, {
      modules_enabled: modules,
    })
    return response.data
  },

  // ==================== License Methods ====================

  // Get licenses for an organization
  getLicenses: async (orgId: string): Promise<License[]> => {
    const response = await api.get('/organization/licenses/', { params: { organization: orgId } })
    return response.data.results || response.data
  },

  // Create a license
  createLicense: async (data: {
    organization: string
    license_type: string
    max_users: number
    max_employees: number
    modules_allowed: string[]
    valid_from: string
    valid_until?: string | null
    is_active?: boolean
    notes?: string
  }): Promise<License> => {
    const response = await api.post('/organization/licenses/', data)
    return response.data
  },

  // Update a license
  updateLicense: async (id: string, data: Partial<License>): Promise<License> => {
    const response = await api.patch(`/organization/licenses/${id}/`, data)
    return response.data
  },

  // Activate a license
  activateLicense: async (id: string): Promise<License> => {
    const response = await api.post(`/organization/licenses/${id}/activate/`)
    return response.data
  },

  // Deactivate a license
  deactivateLicense: async (id: string): Promise<License> => {
    const response = await api.post(`/organization/licenses/${id}/deactivate/`)
    return response.data
  },
}
