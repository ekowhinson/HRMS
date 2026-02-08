import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { authService } from '@/services/auth'

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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Effects */}
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-gradient-to-r from-primary-500/30 to-accent-500/30 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-r from-accent-500/20 to-primary-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />

      <div className="max-w-md w-full relative z-10">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 via-accent-500 to-primary-500 rounded-3xl blur-xl opacity-30 group-hover:opacity-40 transition duration-500 animate-gradient-shift" style={{ backgroundSize: '200% 200%' }} />

          <div className="relative bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg shadow-primary-500/30 mb-4 relative">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 blur-lg opacity-50" />
                <span className="relative text-3xl font-bold text-white">HR</span>
              </div>
              <h1 className="text-2xl font-bold text-white">
                {isSuccess ? 'Password Reset' : 'Reset Password'}
              </h1>
            </div>

            {/* Loading state */}
            {isValidating && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-12 h-12 relative">
                  <div className="absolute inset-0 rounded-full border-4 border-primary-500/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary-500 animate-spin" />
                </div>
                <p className="text-white/60 text-sm">Validating reset link...</p>
              </div>
            )}

            {/* Invalid token */}
            {!isValidating && !isValid && !isSuccess && (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                    <ExclamationTriangleIcon className="h-8 w-8 text-red-400" />
                  </div>
                  <p className="text-center text-sm text-white/60">
                    {tokenError}
                  </p>
                </div>
                <Link
                  to="/forgot-password"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl relative group/btn overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl" />
                  <span className="relative text-white font-semibold">Request New Reset Link</span>
                </Link>
                <div className="text-center">
                  <Link to="/login" className="text-sm text-primary-400 hover:text-primary-300 transition-colors inline-flex items-center gap-1">
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
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircleIcon className="h-8 w-8 text-green-400" />
                  </div>
                  <p className="text-center text-sm text-white/60">
                    Your password has been reset successfully. You can now log in with your new password.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full relative group/btn overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl" />
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-accent-600 rounded-xl opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                  <div className="relative flex items-center justify-center gap-2 py-3 px-4 text-white font-semibold">
                    Go to Login
                  </div>
                </button>
              </div>
            )}

            {/* Reset form */}
            {!isValidating && isValid && !isSuccess && (
              <>
                <p className="text-center text-sm text-white/60 mb-6">
                  Enter a new password for <span className="text-white/80 font-medium">{tokenEmail}</span>
                </p>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-white/70">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        autoFocus
                        {...register('new_password', {
                          required: 'Password is required',
                          minLength: {
                            value: 8,
                            message: 'Password must be at least 8 characters',
                          },
                        })}
                        className={`w-full px-4 py-3 pr-12 bg-white/5 border ${errors.new_password ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-300`}
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                      >
                        {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                      </button>
                    </div>
                    {errors.new_password && (
                      <p className="text-sm text-red-400">{errors.new_password.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-white/70">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        {...register('confirm_password', {
                          required: 'Please confirm your password',
                          validate: (value) =>
                            value === newPassword || 'Passwords do not match',
                        })}
                        className={`w-full px-4 py-3 pr-12 bg-white/5 border ${errors.confirm_password ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-300`}
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                      >
                        {showConfirm ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                      </button>
                    </div>
                    {errors.confirm_password && (
                      <p className="text-sm text-red-400">{errors.confirm_password.message}</p>
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
                          <span>Resetting...</span>
                        </>
                      ) : (
                        <span>Reset Password</span>
                      )}
                    </div>
                  </button>

                  <div className="text-center">
                    <Link
                      to="/login"
                      className="text-sm text-primary-400 hover:text-primary-300 transition-colors inline-flex items-center gap-1"
                    >
                      <ArrowLeftIcon className="h-3 w-3" />
                      Back to Login
                    </Link>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
