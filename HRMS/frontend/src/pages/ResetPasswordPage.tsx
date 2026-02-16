import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { authService } from '@/services/auth'
import { Card, CardContent, Button, Input } from '@/components/ui'

interface ResetPasswordForm {
  new_password: string
  confirm_password: string
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [isValidating, setIsValidating] = useState(true)
  const [isValid, setIsValid] = useState(false)
  const [tokenEmail, setTokenEmail] = useState('')
  const [tokenError, setTokenError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordForm>()

  const newPassword = watch('new_password')

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setIsValidating(false)
      setTokenError('No reset token provided.')
      return
    }

    const validateToken = async () => {
      try {
        const result = await authService.validateResetToken(token)
        setIsValid(result.valid)
        setTokenEmail(result.email)
      } catch (error: any) {
        const message = error.response?.data?.error || 'Invalid or expired reset link.'
        setTokenError(message)
      } finally {
        setIsValidating(false)
      }
    }

    validateToken()
  }, [token])

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) return
    setIsLoading(true)
    try {
      await authService.confirmPasswordReset({
        token,
        new_password: data.new_password,
        confirm_password: data.confirm_password,
      })
      setIsSuccess(true)
      toast.success('Password reset successfully!')
    } catch (error: any) {
      const errData = error.response?.data
      const message = errData?.error || errData?.new_password?.[0] || 'Failed to reset password. Please try again.'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card>
          <CardContent className="p-8">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-md bg-primary-600 mb-4">
                <span className="text-2xl font-bold text-white">HR</span>
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {isSuccess ? 'Password Reset' : 'Reset Password'}
              </h1>
            </div>

            {/* Loading state */}
            {isValidating && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-12 h-12 relative">
                  <div className="absolute inset-0 rounded-full border-4 border-primary-100" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary-600 animate-spin" />
                </div>
                <p className="text-gray-500 text-sm">Validating reset link...</p>
              </div>
            )}

            {/* Invalid token */}
            {!isValidating && !isValid && !isSuccess && (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                    <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
                  </div>
                  <p className="text-center text-sm text-gray-500">
                    {tokenError}
                  </p>
                </div>
                <Link to="/forgot-password">
                  <Button fullWidth size="lg">
                    Request New Reset Link
                  </Button>
                </Link>
                <div className="text-center">
                  <Link to="/login" className="text-sm text-primary-600 hover:text-primary-700 transition-colors inline-flex items-center gap-1">
                    <ArrowLeftIcon className="h-3 w-3" />
                    Back to Login
                  </Link>
                </div>
              </div>
            )}

            {/* Success state */}
            {isSuccess && (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                    <CheckCircleIcon className="h-8 w-8 text-green-500" />
                  </div>
                  <p className="text-center text-sm text-gray-500">
                    Your password has been reset successfully. You can now log in with your new password.
                  </p>
                </div>
                <Button
                  fullWidth
                  size="lg"
                  onClick={() => navigate('/login')}
                >
                  Go to Login
                </Button>
              </div>
            )}

            {/* Reset form */}
            {!isValidating && isValid && !isSuccess && (
              <>
                <p className="text-center text-sm text-gray-500 mb-6">
                  Enter a new password for <span className="text-gray-700 font-medium">{tokenEmail}</span>
                </p>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <Input
                    label="New Password"
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    placeholder="Enter new password"
                    showPasswordToggle
                    {...register('new_password', {
                      required: 'Password is required',
                      minLength: {
                        value: 8,
                        message: 'Password must be at least 8 characters',
                      },
                    })}
                    error={errors.new_password?.message}
                  />

                  <Input
                    label="Confirm Password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    showPasswordToggle
                    {...register('confirm_password', {
                      required: 'Please confirm your password',
                      validate: (value) =>
                        value === newPassword || 'Passwords do not match',
                    })}
                    error={errors.confirm_password?.message}
                  />

                  <Button
                    type="submit"
                    isLoading={isLoading}
                    fullWidth
                    size="lg"
                  >
                    Reset Password
                  </Button>

                  <div className="text-center">
                    <Link
                      to="/login"
                      className="text-sm text-primary-600 hover:text-primary-700 transition-colors inline-flex items-center gap-1"
                    >
                      <ArrowLeftIcon className="h-3 w-3" />
                      Back to Login
                    </Link>
                  </div>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
