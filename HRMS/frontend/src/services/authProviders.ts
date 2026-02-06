import api from '@/lib/api'
import type { User } from '@/types'

export type AuthProviderType = 'LOCAL' | 'LDAP' | 'AZURE_AD'

export interface AuthProvider {
  id: string
  name: string
  type: AuthProviderType
  is_default: boolean
}

export interface AuthProviderConfig {
  id: string
  name: string
  provider_type: AuthProviderType
  is_enabled: boolean
  is_default: boolean
  priority: number
  config: Record<string, any>
  auto_provision_users: boolean
  auto_link_by_email: boolean
  default_role?: string
  default_role_name?: string
  allowed_domains: string[]
  last_connection_test?: string
  last_connection_status?: boolean
  last_connection_error?: string
  last_sync_at?: string
  last_sync_count?: number
  users_count: number
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  access: string
  refresh: string
  user: User
}

export const authProviderService = {
  /**
   * Get list of enabled authentication providers (public endpoint)
   */
  async getProviders(): Promise<AuthProvider[]> {
    const response = await api.get('/auth/providers/')
    return response.data
  },

  /**
   * LDAP Login
   */
  async ldapLogin(username: string, password: string): Promise<AuthResponse> {
    const response = await api.post('/auth/ldap/login/', { username, password })
    return response.data
  },

  /**
   * Get Azure AD authorization URL
   */
  async getAzureAuthUrl(): Promise<{ auth_url: string; state: string }> {
    const response = await api.get('/auth/azure/authorize/')
    return response.data
  },

  /**
   * Complete Azure AD authentication with callback code
   */
  async azureCallback(code: string, state?: string | null): Promise<AuthResponse> {
    const response = await api.post('/auth/azure/callback/', { code, state })
    return response.data
  },

  /**
   * Get providers linked to current user
   */
  async getMyLinkedProviders(): Promise<any[]> {
    const response = await api.get('/auth/me/providers/')
    return response.data
  },

  // ============================================
  // Admin endpoints
  // ============================================

  /**
   * Get all auth providers (admin only)
   */
  async getAdminProviders(): Promise<AuthProviderConfig[]> {
    const response = await api.get('/auth/admin/providers/')
    return response.data
  },

  /**
   * Get single provider configuration (admin only)
   */
  async getAdminProvider(id: string): Promise<AuthProviderConfig> {
    const response = await api.get(`/auth/admin/providers/${id}/`)
    return response.data
  },

  /**
   * Update provider configuration (admin only)
   */
  async updateProvider(id: string, data: Partial<AuthProviderConfig>): Promise<AuthProviderConfig> {
    const response = await api.put(`/auth/admin/providers/${id}/`, data)
    return response.data
  },

  /**
   * Test provider connection (admin only)
   */
  async testProvider(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/auth/admin/providers/${id}/test/`)
    return response.data
  },
}

export default authProviderService
