import api from '@/lib/api'
import type {
  User,
  AuthTokens,
  LoginCredentials,
  SignupInitiateData,
  SignupVerifyResponse,
  CompleteSignupData,
} from '@/types'

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await api.post('/auth/login/', credentials)
    // Transform API response to match expected format
    const { access, refresh, user } = response.data
    return {
      user,
      tokens: { access, refresh }
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
}
