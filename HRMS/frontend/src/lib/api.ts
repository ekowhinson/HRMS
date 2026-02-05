import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/features/auth/store'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().tokens?.access
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshToken = useAuthStore.getState().tokens?.refresh
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
            refresh: refreshToken,
          })

          const { access } = response.data
          useAuthStore.getState().setTokens({ access, refresh: refreshToken })

          originalRequest.headers.Authorization = `Bearer ${access}`
          return api(originalRequest)
        } catch (refreshError) {
          useAuthStore.getState().logout()
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      } else {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api
