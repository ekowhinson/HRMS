import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  KeyIcon,
  ServerIcon,
  CloudIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
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

const methodMessages: Record<string, string> = {
  TOTP: 'Enter the 6-digit code from your authenticator app.',
  EMAIL: 'A verification code has been sent to your email.',
  SMS: 'A verification code has been sent to your phone.',
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

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false)
  const [twoFactorMethod, setTwoFactorMethod] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [savedCredentials, setSavedCredentials] = useState<LoginCredentials | null>(null)
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const codeInputRef = useRef<HTMLInputElement>(null)

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

  // Focus code input when 2FA screen appears
  useEffect(() => {
    if (requires2FA && codeInputRef.current) {
      codeInputRef.current.focus()
    }
  }, [requires2FA])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleAzureCallback = async (code: string, state: string | null) => {
    setIsLoading(true)
    try {
      const response = await authProviderService.azureCallback(code, state)
      login(response.user, { access: response.access, refresh: response.refresh })
      toast.success('Welcome!')
      navigate('/dashboard', { replace: true })
    } catch (error: any) {
      const errData = error.response?.data
      const message = errData?.error?.details?.non_field_errors?.[0]
        || errData?.error?.message
        || errData?.detail
        || 'Azure login failed'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  // Local email/password login
  const onLocalSubmit = async (data: LoginCredentials) => {
    setIsLoading(true)
    try {
      const response = await authService.login(data)

      if (response.two_factor_required) {
        setSavedCredentials(data)
        setTwoFactorMethod(response.method || 'EMAIL')
        setRequires2FA(true)
        setResendCooldown(30)
        setIsLoading(false)
        return
      }

      if (response.user && response.tokens) {
        login(response.user, response.tokens)

        if (response.two_factor_setup_required) {
          toast('Your organization requires 2FA. Please set it up in Settings.', { icon: '⚠️', duration: 6000 })
          navigate('/settings?tab=security', { replace: true })
        } else {
          toast.success('Welcome back!')
          navigate('/dashboard', { replace: true })
        }
      }
    } catch (error: any) {
      const errData = error.response?.data
      // Handle 403 setup_required (past grace period)
      if (error.response?.status === 403 && errData?.error === 'setup_required') {
        toast.error(errData.message || 'Two-factor authentication is required. Please contact your administrator.')
        setIsLoading(false)
        return
      }
      const message = errData?.error?.details?.non_field_errors?.[0]
        || errData?.error?.message
        || errData?.detail
        || 'Invalid credentials'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  // Submit 2FA code
  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!savedCredentials || !twoFactorCode.trim()) return

    setIsLoading(true)
    try {
      const response = await authService.login({
        ...savedCredentials,
        two_factor_code: twoFactorCode.trim(),
      })

      if (response.user && response.tokens) {
        login(response.user, response.tokens)

        if (response.two_factor_setup_required) {
          toast('Your organization requires 2FA. Please set it up in Settings.', { icon: '⚠️', duration: 6000 })
          navigate('/settings?tab=security', { replace: true })
        } else {
          toast.success('Welcome back!')
          navigate('/dashboard', { replace: true })
        }
      }
    } catch (error: any) {
      const errData = error.response?.data
      if (error.response?.status === 403 && errData?.error === 'setup_required') {
        toast.error(errData.message || 'Two-factor authentication is required. Please contact your administrator.')
        setIsLoading(false)
        return
      }
      const message = errData?.error?.message || errData?.error || errData?.detail || 'Invalid verification code'
      toast.error(message)
      setTwoFactorCode('')
    } finally {
      setIsLoading(false)
    }
  }

  // Resend 2FA code
  const handleResend2FA = async () => {
    if (!savedCredentials || resendCooldown > 0) return
    try {
      await authService.resend2FACode(savedCredentials.email)
      toast.success('Verification code resent')
      setResendCooldown(30)
    } catch {
      toast.error('Failed to resend code')
    }
  }

  // Go back from 2FA screen
  const handleBack2FA = () => {
    setRequires2FA(false)
    setTwoFactorCode('')
    setSavedCredentials(null)
    setTwoFactorMethod('')
    setUseBackupCode(false)
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
      const errData = error.response?.data
      const message = errData?.error?.details?.non_field_errors?.[0]
        || errData?.error?.message
        || errData?.detail
        || 'Invalid LDAP credentials'
      toast.error(message)
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
      const errData = error.response?.data
      toast.error(errData?.error?.message || errData?.detail || 'Failed to initiate Azure login')
      setIsLoading(false)
    }
  }

  const hasMultipleProviders = providers.length > 1

  // Show loading state while fetching providers
  if (isLoadingProviders) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 relative">
            <div className="absolute inset-0 rounded-full border-4 border-primary-200" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary-600 animate-spin" />
          </div>
          <span className="text-gray-500 text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Card */}
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-8">
          {/* Logo Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-600 shadow-lg mb-4">
              <span className="text-3xl font-bold text-white">HR</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              HRMS
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Human Resource Management System
            </p>
          </div>

          {/* 2FA Challenge Screen */}
          {requires2FA ? (
            <div className="space-y-5">
              <button
                type="button"
                onClick={handleBack2FA}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to login
              </button>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-100 mb-4">
                  <KeyIcon className="h-7 w-7 text-primary-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {useBackupCode ? 'Enter Backup Code' : 'Two-Factor Authentication'}
                </h2>
                <p className="text-sm text-gray-500">
                  {useBackupCode
                    ? 'Enter one of your backup codes.'
                    : methodMessages[twoFactorMethod] || 'Enter your verification code.'}
                </p>
              </div>

              <form onSubmit={handle2FASubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    {useBackupCode ? 'Backup Code' : 'Verification Code'}
                  </label>
                  <input
                    ref={codeInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={useBackupCode ? 8 : 6}
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 text-center text-2xl tracking-[0.5em] placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
                    placeholder={useBackupCode ? '00000000' : '000000'}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || twoFactorCode.length < (useBackupCode ? 8 : 6)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl text-white font-semibold transition-colors duration-200"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Verify</span>
                  )}
                </button>
              </form>

              <div className="flex items-center justify-between text-sm">
                {twoFactorMethod !== 'TOTP' && !useBackupCode && (
                  <button
                    type="button"
                    onClick={handleResend2FA}
                    disabled={resendCooldown > 0}
                    className="text-primary-600 hover:text-primary-700 transition-colors disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setUseBackupCode(!useBackupCode)
                    setTwoFactorCode('')
                  }}
                  className="text-gray-500 hover:text-gray-700 transition-colors ml-auto"
                >
                  {useBackupCode ? 'Use verification code' : 'Use backup code'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Provider Selection */}
              {hasMultipleProviders && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
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
                          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all duration-200 ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
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
                    <label className="block text-sm font-medium text-gray-700">
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
                        className={`w-full px-4 py-3 bg-white border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200`}
                        placeholder="you@company.com"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-red-500">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">
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
                        className={`w-full px-4 py-3 pr-12 bg-white border ${errors.password ? 'border-red-500' : 'border-gray-300'} rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200`}
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-red-500">{errors.password.message}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        className="h-4 w-4 bg-white border-gray-300 rounded text-primary-600 focus:ring-primary-500 focus:ring-offset-0"
                      />
                      <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-500">
                        Remember me
                      </label>
                    </div>

                    <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 transition-colors">
                      Forgot password?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl text-white font-semibold transition-colors duration-200"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <span>Sign in</span>
                    )}
                  </button>
                </form>
              )}

              {/* LDAP Form */}
              {selectedMethod === 'LDAP' && (
                <form onSubmit={handleLdapSubmit(onLdapSubmit)} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Username
                    </label>
                    <input
                      type="text"
                      autoComplete="username"
                      placeholder="Enter your AD username"
                      {...registerLdap('username', {
                        required: 'Username is required',
                      })}
                      className={`w-full px-4 py-3 bg-white border ${ldapErrors.username ? 'border-red-500' : 'border-gray-300'} rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200`}
                    />
                    {ldapErrors.username && (
                      <p className="text-sm text-red-500">{ldapErrors.username.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        {...registerLdap('password', {
                          required: 'Password is required',
                        })}
                        className={`w-full px-4 py-3 pr-12 bg-white border ${ldapErrors.password ? 'border-red-500' : 'border-gray-300'} rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200`}
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {ldapErrors.password && (
                      <p className="text-sm text-red-500">{ldapErrors.password.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl text-white font-semibold transition-colors duration-200"
                  >
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
                  </button>
                </form>
              )}

              {/* Azure AD Button */}
              {selectedMethod === 'AZURE_AD' && (
                <div className="space-y-4">
                  <button
                    onClick={handleAzureLogin}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-white font-semibold transition-colors duration-200"
                  >
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
                  </button>
                  <p className="text-xs text-center text-gray-400">
                    You will be redirected to Microsoft to sign in
                  </p>
                </div>
              )}

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-400">or</span>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-500">
                  New employee?{' '}
                  <Link
                    to="/signup"
                    className="font-medium text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    Sign up here
                  </Link>
                </p>
              </div>

              <div className="mt-6 text-center text-xs text-gray-400">
                <p>Powered by HRMS</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
