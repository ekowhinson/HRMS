import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon,
  EnvelopeIcon,
  LockClosedIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { authService } from '@/services/auth'
import { useAuthStore } from '@/features/auth/store'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import type { SignupInitiateData, CompleteSignupData, SignupVerifyResponse } from '@/types'

type Step = 'identify' | 'verify' | 'password'

export default function SignupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const login = useAuthStore((state) => state.login)

  const [step, setStep] = useState<Step>(token ? 'password' : 'identify')
  const [signupEmail, setSignupEmail] = useState('')
  const [employeeName, setEmployeeName] = useState('')

  // Step 1: Identify form
  const identifyForm = useForm<SignupInitiateData>()

  // Step 3: Password form
  const passwordForm = useForm<Omit<CompleteSignupData, 'token'>>()

  // Verify token if present in URL
  const { data: tokenData, isLoading: verifyingToken } = useQuery({
    queryKey: ['verify-token', token],
    queryFn: () => authService.verifyEmail(token!),
    enabled: !!token && step === 'password',
    retry: false,
  })

  // Initiate signup mutation
  const initiateMutation = useMutation({
    mutationFn: authService.initiateSignup,
    onSuccess: (data) => {
      setSignupEmail(data.email)
      setEmployeeName(data.employee_name)
      setStep('verify')
      toast.success('Verification email sent!')
    },
    onError: (error: any) => {
      const errorData = error.response?.data
      if (errorData?.email) {
        identifyForm.setError('email', { message: errorData.email[0] || errorData.email })
      } else if (errorData?.employee_number) {
        identifyForm.setError('employee_number', {
          message: errorData.employee_number[0] || errorData.employee_number,
        })
      } else {
        toast.error(errorData?.detail || 'Failed to initiate signup')
      }
    },
  })

  // Complete signup mutation
  const completeMutation = useMutation({
    mutationFn: (data: Omit<CompleteSignupData, 'token'>) =>
      authService.completeSignup({ ...data, token: token! }),
    onSuccess: (data) => {
      login(data.user, { access: data.access, refresh: data.refresh })
      toast.success('Account created successfully!')
      navigate('/onboarding', { replace: true })
    },
    onError: (error: any) => {
      const errorData = error.response?.data
      if (errorData?.password) {
        passwordForm.setError('password', {
          message: Array.isArray(errorData.password) ? errorData.password[0] : errorData.password,
        })
      } else if (errorData?.token) {
        toast.error('Invalid or expired token. Please start over.')
        setStep('identify')
      } else {
        toast.error(errorData?.detail || 'Failed to create account')
      }
    },
  })

  const handleIdentifySubmit = identifyForm.handleSubmit((data) => {
    initiateMutation.mutate(data)
  })

  const handlePasswordSubmit = passwordForm.handleSubmit((data) => {
    completeMutation.mutate(data)
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">NHIA HRMS</h1>
            <p className="mt-2 text-sm text-gray-600">Employee Account Registration</p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {['identify', 'verify', 'password'].map((s, idx) => (
              <div key={s} className="flex items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${
                      step === s
                        ? 'bg-primary-600 text-white'
                        : ['identify', 'verify', 'password'].indexOf(step) > idx
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }
                  `}
                >
                  {['identify', 'verify', 'password'].indexOf(step) > idx ? (
                    <CheckCircleIcon className="h-5 w-5" />
                  ) : (
                    idx + 1
                  )}
                </div>
                {idx < 2 && <div className="w-12 h-0.5 bg-gray-200 mx-1" />}
              </div>
            ))}
          </div>

          {/* Step 1: Identify */}
          {step === 'identify' && (
            <form onSubmit={handleIdentifySubmit} className="space-y-6">
              <div className="text-center mb-4">
                <UserIcon className="h-12 w-12 mx-auto text-primary-600 mb-2" />
                <h2 className="text-lg font-semibold text-gray-900">Identify Yourself</h2>
                <p className="text-sm text-gray-500">
                  Enter your employee details to get started
                </p>
              </div>

              <Input
                label="Email Address"
                type="email"
                placeholder="your.email@example.com"
                {...identifyForm.register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
                error={identifyForm.formState.errors.email?.message}
              />

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    Identify with one of the following
                  </span>
                </div>
              </div>

              <Input
                label="Employee Number"
                placeholder="e.g., EMP001"
                {...identifyForm.register('employee_number')}
                error={identifyForm.formState.errors.employee_number?.message}
              />

              <p className="text-center text-xs text-gray-500">OR</p>

              <Input
                label="Ghana Card Number"
                placeholder="e.g., GHA-XXXXXXXXX-X"
                {...identifyForm.register('ghana_card_number')}
                error={identifyForm.formState.errors.ghana_card_number?.message}
              />

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={initiateMutation.isPending}
              >
                Continue
              </Button>

              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link to="/login" className="text-primary-600 hover:text-primary-500 font-medium">
                  Sign in
                </Link>
              </p>
            </form>
          )}

          {/* Step 2: Verify */}
          {step === 'verify' && (
            <div className="text-center space-y-6">
              <EnvelopeIcon className="h-16 w-16 mx-auto text-primary-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Check Your Email</h2>
                <p className="mt-2 text-sm text-gray-600">
                  We've sent a verification link to
                </p>
                <p className="font-medium text-gray-900">{signupEmail}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  Hello {employeeName}, please click the link in your email to verify your account
                  and set up your password.
                </p>
              </div>

              <div className="pt-4">
                <p className="text-sm text-gray-500">
                  Didn't receive the email?{' '}
                  <button
                    type="button"
                    onClick={() => setStep('identify')}
                    className="text-primary-600 hover:text-primary-500 font-medium"
                  >
                    Try again
                  </button>
                </p>
              </div>

              <p className="text-xs text-gray-400">
                The link will expire in 24 hours
              </p>
            </div>
          )}

          {/* Step 3: Password */}
          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="text-center mb-4">
                <LockClosedIcon className="h-12 w-12 mx-auto text-primary-600 mb-2" />
                <h2 className="text-lg font-semibold text-gray-900">Set Your Password</h2>
                <p className="text-sm text-gray-500">
                  Create a secure password for your account
                </p>
              </div>

              {verifyingToken ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
              ) : tokenData ? (
                <>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      Setting up account for:
                    </p>
                    <p className="font-medium text-gray-900">{tokenData.employee.full_name}</p>
                    <p className="text-sm text-gray-500">
                      {tokenData.employee.position_title} - {tokenData.employee.department_name}
                    </p>
                  </div>

                  <Input
                    label="Password"
                    type="password"
                    placeholder="Enter a strong password"
                    {...passwordForm.register('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 8,
                        message: 'Password must be at least 8 characters',
                      },
                    })}
                    error={passwordForm.formState.errors.password?.message}
                  />

                  <Input
                    label="Confirm Password"
                    type="password"
                    placeholder="Confirm your password"
                    {...passwordForm.register('confirm_password', {
                      required: 'Please confirm your password',
                      validate: (value) =>
                        value === passwordForm.watch('password') || 'Passwords do not match',
                    })}
                    error={passwordForm.formState.errors.confirm_password?.message}
                  />

                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Password must:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Be at least 8 characters long</li>
                      <li>Include uppercase and lowercase letters</li>
                      <li>Include at least one number</li>
                    </ul>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    isLoading={completeMutation.isPending}
                  >
                    Create Account
                  </Button>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-red-600">Invalid or expired verification link.</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setStep('identify')
                      navigate('/signup', { replace: true })
                    }}
                  >
                    Start Over
                  </Button>
                </div>
              )}
            </form>
          )}

          <div className="mt-6 text-center text-xs text-gray-500">
            <p>Ghana's Premier Health Insurance System</p>
          </div>
        </div>
      </div>
    </div>
  )
}
