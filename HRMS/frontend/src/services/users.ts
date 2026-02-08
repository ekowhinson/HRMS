import api from '@/lib/api'

// ==================== Types ====================

export interface Permission {
  id: string
  name: string
  code: string
  description: string
  module: string
  is_active: boolean
}

export interface Role {
  id: string
  name: string
  code: string
  description: string
  is_system_role: boolean
  is_active: boolean
  level: number
  district?: string | null
  district_name?: string | null
  region_name?: string | null
  permissions: Permission[]
  permissions_count?: number
  users_count?: number
  created_at: string
  updated_at: string
}

export interface UserRole {
  id: string
  role: string
  role_name: string
  role_code: string
  scope_type: 'global' | 'region' | 'department' | 'team'
  scope_id: string | null
  scope_name?: string
  effective_from: string
  effective_to: string | null
  is_primary: boolean
  is_active: boolean
  is_effective: boolean
}

export interface User {
  id: string
  email: string
  username: string | null
  first_name: string
  middle_name: string | null
  last_name: string
  full_name: string
  phone_number: string | null
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  is_verified: boolean
  must_change_password: boolean
  two_factor_enabled: boolean
  two_factor_method?: string
  failed_login_attempts: number
  lockout_until: string | null
  last_login_at: string | null
  last_login_ip: string | null
  employee?: {
    id: string
    employee_number: string
    department_name: string
    position_title: string
  }
  roles: UserRole[]
  profile_photo_url?: string
  created_at: string
  updated_at: string
}

export interface UserSession {
  id: string
  session_key: string
  ip_address: string
  user_agent: string
  device_info: Record<string, any>
  is_active: boolean
  last_activity: string
  expires_at: string
  is_expired: boolean
  created_at: string
}

export interface AuthenticationLog {
  id: string
  user: string | null
  email: string
  event_type: string
  event_type_display: string
  ip_address: string
  user_agent: string
  location: string | null
  extra_data: Record<string, any>
  timestamp: string
}

// ==================== User Service ====================

export const userService = {
  // Get all users with filters
  getUsers: async (params?: {
    search?: string
    is_active?: boolean
    is_staff?: boolean
    role?: string
    page?: number
  }) => {
    const response = await api.get('/auth/users/', { params })
    return response.data
  },

  // Get single user
  getUser: async (id: string): Promise<User> => {
    const response = await api.get(`/auth/users/${id}/`)
    return response.data
  },

  // Create user
  createUser: async (data: {
    email: string
    first_name: string
    last_name: string
    middle_name?: string
    phone_number?: string
    password: string
    password_confirm: string
    is_active?: boolean
    is_staff?: boolean
    roles?: string[]
  }): Promise<User> => {
    const response = await api.post('/auth/users/', data)
    return response.data
  },

  // Update user
  updateUser: async (id: string, data: Partial<{
    email: string
    first_name: string
    last_name: string
    middle_name: string
    phone_number: string
    is_active: boolean
    is_staff: boolean
    must_change_password: boolean
  }>): Promise<User> => {
    const response = await api.patch(`/auth/users/${id}/`, data)
    return response.data
  },

  // Delete user
  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/auth/users/${id}/`)
  },

  // Assign role to user
  assignRole: async (userId: string, data: {
    role: string
    scope_type?: 'global' | 'region' | 'department' | 'team'
    scope_id?: string
    effective_from?: string
    effective_to?: string
    is_primary?: boolean
  }): Promise<UserRole> => {
    const response = await api.post(`/auth/users/${userId}/roles/`, data)
    return response.data
  },

  // Remove role from user
  removeRole: async (userId: string, roleId: string): Promise<void> => {
    await api.delete(`/auth/users/${userId}/roles/${roleId}/`)
  },

  // Reset user password (admin)
  resetPassword: async (id: string): Promise<void> => {
    await api.post(`/auth/users/${id}/reset-password/`)
  },

  // Unlock user account
  unlockAccount: async (id: string): Promise<void> => {
    await api.post(`/auth/users/${id}/unlock/`)
  },

  // Get user sessions
  getUserSessions: async (userId: string): Promise<UserSession[]> => {
    const response = await api.get(`/auth/users/${userId}/sessions/`)
    return response.data
  },

  // Revoke user session
  revokeSession: async (sessionId: string): Promise<void> => {
    await api.post(`/auth/sessions/${sessionId}/revoke/`)
  },

  // Get authentication logs
  getAuthLogs: async (params?: {
    user?: string
    event_type?: string
    start_date?: string
    end_date?: string
    page?: number
  }): Promise<AuthenticationLog[]> => {
    const response = await api.get('/auth/auth-logs/', { params })
    return response.data.results || response.data
  },
}

// ==================== Role Service ====================

export const roleService = {
  // Get all roles
  getRoles: async (params?: {
    is_active?: boolean
    is_system_role?: boolean
    search?: string
  }): Promise<Role[]> => {
    const response = await api.get('/auth/roles/', { params })
    return response.data.results || response.data
  },

  // Get single role
  getRole: async (id: string): Promise<Role> => {
    const response = await api.get(`/auth/roles/${id}/`)
    return response.data
  },

  // Create role
  createRole: async (data: {
    name: string
    code: string
    description?: string
    level?: number
    district?: string | null
    permissions?: string[]
  }): Promise<Role> => {
    const response = await api.post('/auth/roles/', data)
    return response.data
  },

  // Update role
  updateRole: async (id: string, data: Partial<{
    name: string
    description: string
    level: number
    district: string | null
    is_active: boolean
    permissions: string[]
  }>): Promise<Role> => {
    const response = await api.patch(`/auth/roles/${id}/`, data)
    return response.data
  },

  // Delete role
  deleteRole: async (id: string): Promise<void> => {
    await api.delete(`/auth/roles/${id}/`)
  },

  // Get users with role
  getRoleUsers: async (roleId: string): Promise<User[]> => {
    const response = await api.get(`/auth/roles/${roleId}/users/`)
    return response.data
  },
}

// ==================== Permission Service ====================

export const permissionService = {
  // Get all permissions
  getPermissions: async (params?: {
    module?: string
    is_active?: boolean
  }): Promise<Permission[]> => {
    const response = await api.get('/auth/permissions/', { params })
    return response.data.results || response.data
  },

  // Get permissions grouped by module
  getPermissionsByModule: async (): Promise<Record<string, Permission[]>> => {
    const response = await api.get('/auth/permissions/')
    const permissions = response.data.results || response.data

    // Group by module
    const grouped: Record<string, Permission[]> = {}
    permissions.forEach((perm: Permission) => {
      if (!grouped[perm.module]) {
        grouped[perm.module] = []
      }
      grouped[perm.module].push(perm)
    })
    return grouped
  },
}
