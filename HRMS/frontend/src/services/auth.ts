import api from '@/lib/api'
import type {
  User,
  AuthTokens,
  LoginCredentials,
  SignupInitiateData,
  SignupVerifyResponse,
  CompleteSignupData,
} from '@/types'

export interface LoginResponse {
  user?: User
  tokens?: AuthTokens
  two_factor_required?: boolean
  two_factor_setup_required?: boolean
  method?: string
}

export interface TwoFactorSetupResponse {
  method: string
  secret?: string
  qr_code?: string
  provisioning_uri?: string
  message?: string
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await api.post('/auth/login/', credentials)
    const data = response.data

    // If 2FA is required, return the challenge
    if (data.two_factor_required) {
      return {
        two_factor_required: true,
        method: data.method,
      }
    }

    // Normal login response
    const { access, refresh, user, two_factor_setup_required } = data
    return {
      user,
      tokens: { access, refresh },
      two_factor_setup_required: two_factor_setup_required || false,
    }
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout/')
    } catch (error) {
      // Ignore logout errors
    }
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get('/auth/me/')
    return response.data
  },

  // Change password
  changePassword: async (data: { current_password: string; new_password: string }): Promise<void> => {
    await api.post('/auth/password/change/', {
      old_password: data.current_password,
      new_password: data.new_password,
    })
  },

  // Update profile
  updateProfile: async (data: {
    first_name: string
    last_name: string
    email: string
    phone?: string
  }): Promise<User> => {
    const response = await api.patch('/auth/me/update/', data)
    return response.data
  },

  // Refresh token
  refreshToken: async (refresh: string): Promise<{ access: string }> => {
    const response = await api.post('/auth/token/refresh/', { refresh })
    return response.data
  },

  // Employee signup - initiate
  async initiateSignup(data: SignupInitiateData): Promise<{ message: string; email: string; employee_name: string }> {
    const response = await api.post('/auth/signup/', data)
    return response.data
  },

  // Verify email token
  async verifyEmail(token: string): Promise<SignupVerifyResponse> {
    const response = await api.get('/auth/signup/verify/', { params: { token } })
    return response.data
  },

  // Complete signup with password
  async completeSignup(data: CompleteSignupData): Promise<{ message: string; access: string; refresh: string; user: User }> {
    const response = await api.post('/auth/signup/verify/', data)
    return response.data
  },

  // Request password reset
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const response = await api.post('/auth/password/reset/', { email })
    return response.data
  },

  // Validate password reset token
  async validateResetToken(token: string): Promise<{ valid: boolean; email: string }> {
    const response = await api.get('/auth/password/reset/confirm/', { params: { token } })
    return response.data
  },

  // Confirm password reset
  async confirmPasswordReset(data: { token: string; new_password: string; confirm_password: string }): Promise<{ message: string }> {
    const response = await api.post('/auth/password/reset/confirm/', data)
    return response.data
  },

  // ==================== Two-Factor Authentication ====================

  // Get 2FA setup info (secret + QR for TOTP, or sends code for EMAIL/SMS)
  async setup2FA(method: string = 'EMAIL'): Promise<TwoFactorSetupResponse> {
    const response = await api.get('/auth/2fa/setup/', { params: { method } })
    return response.data
  },

  // Verify 2FA setup code and enable
  async verify2FASetup(code: string, method: string = 'EMAIL'): Promise<{ message: string; backup_codes: string[] }> {
    const response = await api.post('/auth/2fa/setup/', { code, method })
    return response.data
  },

  // Disable 2FA
  async disable2FA(password: string): Promise<{ message: string }> {
    const response = await api.post('/auth/2fa/disable/', { password })
    return response.data
  },

  // Regenerate backup codes
  async regenerateBackupCodes(): Promise<{ backup_codes: string[] }> {
    const response = await api.post('/auth/2fa/backup-codes/')
    return response.data
  },

  // Resend 2FA code (for EMAIL/SMS during login)
  async resend2FACode(email: string): Promise<{ message: string }> {
    const response = await api.post('/auth/2fa/send-code/', { email })
    return response.data
  },

  // ==================== 2FA Policy ====================

  // Get 2FA policy status for current user
  async get2FAPolicy(): Promise<{
    enforcement: string
    allowed_methods: string[]
    is_required: boolean
    grace_deadline: string | null
  }> {
    const response = await api.get('/auth/2fa/policy/')
    return response.data
  },

  // Admin: Get org-wide 2FA policy
  async getAdmin2FAPolicy(): Promise<{
    tfa_enforcement: string
    tfa_allowed_methods: string[]
    tfa_grace_period_days: number
  }> {
    const response = await api.get('/core/2fa-policy/')
    return response.data
  },

  // Admin: Update org-wide 2FA policy
  async updateAdmin2FAPolicy(data: {
    tfa_enforcement: string
    tfa_allowed_methods: string[]
    tfa_grace_period_days: number
  }): Promise<void> {
    await api.put('/core/2fa-policy/', data)
  },
}
