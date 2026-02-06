import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  KeyIcon,
  ServerIcon,
  CloudIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/features/auth/store'
import { authService } from '@/services/auth'
import { authProviderService, AuthProvider, AuthProviderType } from '@/services/authProviders'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
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

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useAuthStore((state) => state.login)

  const [providers, setProviders] = useState<AuthProvider[]>([])
  const [selectedMethod, setSelectedMethod] = useState<AuthProviderType>('LOCAL')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProviders, setIsLoadingProviders] = useState(true)

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800">
        <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">HRMS</h1>
            <p className="mt-2 text-sm text-gray-600">
              Human Resource Management System
            </p>
          </div>

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
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
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
            <form onSubmit={handleSubmit(onLocalSubmit)} className="space-y-6">
              <Input
                label="Email Address"
                type="email"
                autoComplete="email"
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
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Remember me
                  </label>
                </div>

                <a href="#" className="text-sm text-primary-600 hover:text-primary-500">
                  Forgot password?
                </a>
              </div>

              <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                Sign in
              </Button>
            </form>
          )}

          {/* LDAP Form */}
          {selectedMethod === 'LDAP' && (
            <form onSubmit={handleLdapSubmit(onLdapSubmit)} className="space-y-6">
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
                {...registerLdap('password', {
                  required: 'Password is required',
                })}
                error={ldapErrors.password?.message}
              />

              <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                <ServerIcon className="h-5 w-5 mr-2" />
                Sign in with Active Directory
              </Button>
            </form>
          )}

          {/* Azure AD Button */}
          {selectedMethod === 'AZURE_AD' && (
            <div className="space-y-4">
              <Button
                onClick={handleAzureLogin}
                className="w-full"
                size="lg"
                isLoading={isLoading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 0H0V10H10V0Z" fill="#F25022"/>
                  <path d="M21 0H11V10H21V0Z" fill="#7FBA00"/>
                  <path d="M10 11H0V21H10V11Z" fill="#00A4EF"/>
                  <path d="M21 11H11V21H21V11Z" fill="#FFB900"/>
                </svg>
                Sign in with Microsoft
              </Button>
              <p className="text-xs text-center text-gray-500">
                You will be redirected to Microsoft to sign in
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              New employee?{' '}
              <Link
                to="/signup"
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                Sign up here
              </Link>
            </p>
          </div>

          <div className="mt-4 text-center text-xs text-gray-500">
            <p>Powered by HRMS</p>
          </div>
        </div>
      </div>
    </div>
  )
}
