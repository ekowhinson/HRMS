import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, AuthTokens, Organization } from '@/types'

interface AuthState {
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
  activeOrganization: Organization | null
  setUser: (user: User | null) => void
  setTokens: (tokens: AuthTokens | null) => void
  login: (user: User, tokens: AuthTokens) => void
  logout: () => void
  setLoading: (loading: boolean) => void
  updateUser: (user: Partial<User>) => void
  setActiveOrganization: (org: Organization | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      activeOrganization: null,
      setUser: (user) => set({ user }),
      setTokens: (tokens) => set({ tokens }),
      login: (user, tokens) =>
        set({
          user,
          tokens,
          isAuthenticated: true,
          activeOrganization: user.active_organization || null,
        }),
      logout: () =>
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          activeOrganization: null,
        }),
      setLoading: (isLoading) => set({ isLoading }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      setActiveOrganization: (activeOrganization) => set({ activeOrganization }),
    }),
    {
      name: 'hrms-auth-storage',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
        activeOrganization: state.activeOrganization,
      }),
    }
  )
)
