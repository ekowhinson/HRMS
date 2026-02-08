import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { EnvelopeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { authService } from '@/services/auth'

interface ForgotPasswordForm {
  email: string
}

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>()

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true)
    try {
      await authService.requestPasswordReset(data.email)
      setIsSubmitted(true)
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to send reset email. Please try again.'
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
                {isSubmitted ? 'Check Your Email' : 'Forgot Password'}
              </h1>
              <p className="mt-2 text-sm text-white/60">
                {isSubmitted
                  ? 'If the email is registered, a reset link has been sent.'
                  : 'Enter your email to receive a password reset link.'}
              </p>
            </div>

            {isSubmitted ? (
              <div className="space-y-6">
                <div className="flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-primary-500/20 flex items-center justify-center">
                    <EnvelopeIcon className="h-8 w-8 text-primary-400" />
                  </div>
                </div>
                <p className="text-center text-sm text-white/60">
                  Please check your inbox and follow the instructions in the email to reset your password.
                  The link will expire in 1 hour.
                </p>
                <Link
                  to="/login"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all duration-300"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Back to Login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-white/70">
                    Email Address
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    autoFocus
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
                  {errors.email && (
                    <p className="text-sm text-red-400">{errors.email.message}</p>
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
                        <span>Sending...</span>
                      </>
                    ) : (
                      <span>Send Reset Link</span>
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
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
