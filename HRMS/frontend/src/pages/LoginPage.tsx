import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  KeyIcon,
  ServerIcon,
  CloudIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/features/auth/store'
import { authService } from '@/services/auth'
import { authProviderService, AuthProvider, AuthProviderType } from '@/services/authProviders'
import { Card, CardContent, Button, Input } from '@/components/ui'
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
        <Card>
          <CardContent className="p-8">
            {/* Logo Section */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-md bg-primary-600 mb-4">
                <span className="text-2xl font-bold text-white">HR</span>
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                HRMS
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Human Resource Management System
              </p>
            </div>

            {/* 2FA Challenge Screen */}
            {requires2FA ? (
              <div className="space-y-5">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ArrowLeftIcon className="h-4 w-4" />}
                  onClick={handleBack2FA}
                >
                  Back to login
                </Button>

                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-primary-100 mb-4">
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
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md text-gray-900 text-center text-2xl tracking-[0.5em] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] transition-colors duration-150"
                      placeholder={useBackupCode ? '00000000' : '000000'}
                    />
                  </div>

                  <Button
                    type="submit"
                    isLoading={isLoading}
                    disabled={twoFactorCode.length < (useBackupCode ? 8 : 6)}
                    fullWidth
                    size="lg"
                  >
                    Verify
                  </Button>
                </form>

                <div className="flex items-center justify-between text-sm">
                  {twoFactorMethod !== 'TOTP' && !useBackupCode && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResend2FA}
                      disabled={resendCooldown > 0}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUseBackupCode(!useBackupCode)
                      setTwoFactorCode('')
                    }}
                    className="ml-auto"
                  >
                    {useBackupCode ? 'Use verification code' : 'Use backup code'}
                  </Button>
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
                          <Button
                            key={provider.id}
                            variant={isSelected ? 'outline' : 'secondary'}
                            size="md"
                            leftIcon={<Icon className="h-5 w-5" />}
                            onClick={() => setSelectedMethod(provider.type)}
                            className={`flex-1 ${isSelected ? 'border-primary-500 bg-primary-50 text-primary-700' : ''}`}
                          >
                            {providerLabels[provider.type]}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Local Email/Password Form */}
                {selectedMethod === 'LOCAL' && (
                  <form onSubmit={handleSubmit(onLocalSubmit)} className="space-y-5">
                    <Input
                      label="Email Address"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      {...register('email', {
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address',
                        },
                      })}
                      error={errors.email?.message}
                    />

                    <Input
                      label="Password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      showPasswordToggle
                      {...register('password', {
                        required: 'Password is required',
                        minLength: {
                          value: 6,
                          message: 'Password must be at least 6 characters',
                        },
                      })}
                      error={errors.password?.message}
                    />

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

                    <Button
                      type="submit"
                      isLoading={isLoading}
                      fullWidth
                      size="lg"
                    >
                      Sign in
                    </Button>
                  </form>
                )}

                {/* LDAP Form */}
                {selectedMethod === 'LDAP' && (
                  <form onSubmit={handleLdapSubmit(onLdapSubmit)} className="space-y-5">
                    <Input
                      label="Username"
                      type="text"
                      autoComplete="username"
                      placeholder="Enter your AD username"
                      {...registerLdap('username', {
                        required: 'Username is required',
                      })}
                      error={ldapErrors.username?.message}
                    />

                    <Input
                      label="Password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      showPasswordToggle
                      {...registerLdap('password', {
                        required: 'Password is required',
                      })}
                      error={ldapErrors.password?.message}
                    />

                    <Button
                      type="submit"
                      isLoading={isLoading}
                      fullWidth
                      size="lg"
                      leftIcon={!isLoading ? <ServerIcon className="h-5 w-5" /> : undefined}
                    >
                      Sign in with Active Directory
                    </Button>
                  </form>
                )}

                {/* Azure AD Button */}
                {selectedMethod === 'AZURE_AD' && (
                  <div className="space-y-4">
                    <Button
                      isLoading={isLoading}
                      fullWidth
                      size="lg"
                      onClick={handleAzureLogin}
                      leftIcon={
                        !isLoading ? (
                          <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 0H0V10H10V0Z" fill="#F25022"/>
                            <path d="M21 0H11V10H21V0Z" fill="#7FBA00"/>
                            <path d="M10 11H0V21H10V11Z" fill="#00A4EF"/>
                            <path d="M21 11H11V21H21V11Z" fill="#FFB900"/>
                          </svg>
                        ) : undefined
                      }
                      className="bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
                    >
                      Sign in with Microsoft
                    </Button>
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
