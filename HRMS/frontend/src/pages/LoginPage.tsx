import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  KeyIcon,
  ServerIcon,
  CloudIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/features/auth/store'
import { authService } from '@/services/auth'
import { authProviderService, AuthProvider, AuthProviderType } from '@/services/authProviders'
import type { LoginCredentials } from '@/types'

const providerIcons: Record<AuthProviderType, React.ElementType> = {
  LOCAL: KeyIcon,
  LDAP: ServerIcon,
  AZURE_AD: CloudIcon,
}

const providerLabels: Record<AuthProviderType, string> = {
  LOCAL: 'Email',
  LDAP: 'Active Directory',
  AZURE_AD: 'Microsoft',
}

// Animated floating particles
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-20"
          style={{
            width: Math.random() * 10 + 5 + 'px',
            height: Math.random() * 10 + 5 + 'px',
            left: Math.random() * 100 + '%',
            top: Math.random() * 100 + '%',
            background: i % 2 === 0
              ? 'linear-gradient(135deg, #10b981, #34d399)'
              : 'linear-gradient(135deg, #a855f7, #c084fc)',
            animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}
    </div>
  )
}

// Animated gradient orbs
function GradientOrbs() {
  return (
    <>
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-gradient-to-r from-primary-500/30 to-accent-500/30 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-r from-accent-500/20 to-primary-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-primary-500/10 via-transparent to-accent-500/10 rounded-full blur-3xl animate-spin-slow" />
    </>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useAuthStore((state) => state.login)

  const [providers, setProviders] = useState<AuthProvider[]>([])
  const [selectedMethod, setSelectedMethod] = useState<AuthProviderType>('LOCAL')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProviders, setIsLoadingProviders] = useState(true)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>()

  const {
    register: registerLdap,
    handleSubmit: handleLdapSubmit,
    formState: { errors: ldapErrors },
  } = useForm<{ username: string; password: string }>()

  // Fetch available auth providers
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const data = await authProviderService.getProviders()
        setProviders(data)

        // Set default provider
        const defaultProvider = data.find(p => p.is_default)
        if (defaultProvider) {
          setSelectedMethod(defaultProvider.type)
        } else if (data.length > 0) {
          setSelectedMethod(data[0].type)
        }
      } catch (error) {
        console.error('Failed to fetch auth providers:', error)
        // Default to LOCAL if fetch fails
        setProviders([{ id: 'local', name: 'Email', type: 'LOCAL', is_default: true }])
      } finally {
        setIsLoadingProviders(false)
      }
    }
    fetchProviders()
  }, [])

  // Handle Azure AD callback
  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (code) {
      handleAzureCallback(code, state)
    }
  }, [searchParams])

  const handleAzureCallback = async (code: string, state: string | null) => {
    setIsLoading(true)
    try {
      const response = await authProviderService.azureCallback(code, state)
      login(response.user, { access: response.access, refresh: response.refresh })
      toast.success('Welcome!')
      navigate('/dashboard', { replace: true })
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Azure login failed')
    } finally {
      setIsLoading(false)
    }
  }

  // Local email/password login
  const onLocalSubmit = async (data: LoginCredentials) => {
    setIsLoading(true)
    try {
      const response = await authService.login(data)
      login(response.user, response.tokens)
      toast.success('Welcome back!')
      navigate('/dashboard', { replace: true })
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.response?.data?.detail || 'Invalid credentials')
    } finally {
      setIsLoading(false)
    }
  }

  // LDAP login
  const onLdapSubmit = async (data: { username: string; password: string }) => {
    setIsLoading(true)
    try {
      const response = await authProviderService.ldapLogin(data.username, data.password)
      login(response.user, { access: response.access, refresh: response.refresh })
      toast.success('Welcome!')
      navigate('/dashboard', { replace: true })
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Invalid LDAP credentials')
    } finally {
      setIsLoading(false)
    }
  }

  // Azure AD login - redirect to Microsoft
  const handleAzureLogin = async () => {
    setIsLoading(true)
    try {
      const { auth_url } = await authProviderService.getAzureAuthUrl()
      window.location.href = auth_url
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to initiate Azure login')
      setIsLoading(false)
    }
  }

  const hasMultipleProviders = providers.length > 1

  // Show loading state while fetching providers
  if (isLoadingProviders) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <GradientOrbs />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-16 h-16 relative">
            <div className="absolute inset-0 rounded-full border-4 border-primary-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary-500 animate-spin" />
          </div>
          <span className="text-white/70 text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Effects */}
      <GradientOrbs />
      <FloatingParticles />

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      <div className="max-w-md w-full relative z-10">
        {/* Glassmorphic Card */}
        <div className="relative group">
          {/* Glow Effect Behind Card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 via-accent-500 to-primary-500 rounded-3xl blur-xl opacity-30 group-hover:opacity-40 transition duration-500 animate-gradient-shift" style={{ backgroundSize: '200% 200%' }} />

          {/* Card */}
          <div className="relative bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
            {/* Logo Section */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg shadow-primary-500/30 mb-4 relative group/logo">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 blur-lg opacity-50 group-hover/logo:opacity-75 transition-opacity" />
                <span className="relative text-3xl font-bold text-white">HR</span>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
                HRMS
              </h1>
              <p className="mt-2 text-sm text-white/60">
                Human Resource Management System
              </p>
            </div>

            {/* Provider Selection */}
            {hasMultipleProviders && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-white/70 mb-3">
                  Sign in with
                </label>
                <div className="flex gap-2">
                  {providers.map((provider) => {
                    const Icon = providerIcons[provider.type]
                    const isSelected = selectedMethod === provider.type
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => setSelectedMethod(provider.type)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all duration-300 ${
                          isSelected
                            ? 'border-primary-500 bg-primary-500/20 text-white shadow-lg shadow-primary-500/20'
                            : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-sm font-medium">{providerLabels[provider.type]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Local Email/Password Form */}
            {selectedMethod === 'LOCAL' && (
              <form onSubmit={handleSubmit(onLocalSubmit)} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-white/70">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      autoComplete="email"
                      {...register('email', {
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address',
                        },
                      })}
                      className={`w-full px-4 py-3 bg-white/5 border ${errors.email ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-300`}
                      placeholder="you@company.com"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-red-400">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-white/70">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      {...register('password', {
                        required: 'Password is required',
                        minLength: {
                          value: 6,
                          message: 'Password must be at least 6 characters',
                        },
                      })}
                      className={`w-full px-4 py-3 pr-12 bg-white/5 border ${errors.password ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-300`}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-400">{errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 bg-white/5 border-white/20 rounded text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-white/60">
                      Remember me
                    </label>
                  </div>

                  <a href="#" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
                    Forgot password?
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full relative group/btn overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl" />
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-accent-600 rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                  <div className="relative flex items-center justify-center gap-2 py-3 px-4 text-white font-semibold">
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <span>Sign in</span>
                    )}
                  </div>
                </button>
              </form>
            )}

            {/* LDAP Form */}
            {selectedMethod === 'LDAP' && (
              <form onSubmit={handleLdapSubmit(onLdapSubmit)} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-white/70">
                    Username
                  </label>
                  <input
                    type="text"
                    autoComplete="username"
                    placeholder="Enter your AD username"
                    {...registerLdap('username', {
                      required: 'Username is required',
                    })}
                    className={`w-full px-4 py-3 bg-white/5 border ${ldapErrors.username ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-300`}
                  />
                  {ldapErrors.username && (
                    <p className="text-sm text-red-400">{ldapErrors.username.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-white/70">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      {...registerLdap('password', {
                        required: 'Password is required',
                      })}
                      className={`w-full px-4 py-3 pr-12 bg-white/5 border ${ldapErrors.password ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-300`}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {ldapErrors.password && (
                    <p className="text-sm text-red-400">{ldapErrors.password.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full relative group/btn overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl" />
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-accent-600 rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                  <div className="relative flex items-center justify-center gap-2 py-3 px-4 text-white font-semibold">
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <ServerIcon className="h-5 w-5" />
                        <span>Sign in with Active Directory</span>
                      </>
                    )}
                  </div>
                </button>
              </form>
            )}

            {/* Azure AD Button */}
            {selectedMethod === 'AZURE_AD' && (
              <div className="space-y-4">
                <button
                  onClick={handleAzureLogin}
                  disabled={isLoading}
                  className="w-full relative group/btn overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-blue-600 rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                  <div className="relative flex items-center justify-center gap-3 py-3 px-4 text-white font-semibold">
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Redirecting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10 0H0V10H10V0Z" fill="#F25022"/>
                          <path d="M21 0H11V10H21V0Z" fill="#7FBA00"/>
                          <path d="M10 11H0V21H10V11Z" fill="#00A4EF"/>
                          <path d="M21 11H11V21H21V11Z" fill="#FFB900"/>
                        </svg>
                        <span>Sign in with Microsoft</span>
                      </>
                    )}
                  </div>
                </button>
                <p className="text-xs text-center text-white/40">
                  You will be redirected to Microsoft to sign in
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-transparent text-white/40">or</span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-white/60">
                New employee?{' '}
                <Link
                  to="/signup"
                  className="font-medium text-primary-400 hover:text-primary-300 transition-colors"
                >
                  Sign up here
                </Link>
              </p>
            </div>

            <div className="mt-6 text-center text-xs text-white/30">
              <p>Powered by HRMS</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
