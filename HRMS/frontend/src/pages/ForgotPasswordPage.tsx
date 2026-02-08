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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-600 shadow-lg mb-4">
              <span className="text-3xl font-bold text-white">HR</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isSubmitted ? 'Check Your Email' : 'Forgot Password'}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {isSubmitted
                ? 'If the email is registered, a reset link has been sent.'
                : 'Enter your email to receive a password reset link.'}
            </p>
          </div>

          {isSubmitted ? (
            <div className="space-y-6">
              <div className="flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center">
                  <EnvelopeIcon className="h-8 w-8 text-primary-600" />
                </div>
              </div>
              <p className="text-center text-sm text-gray-500">
                Please check your inbox and follow the instructions in the email to reset your password.
                The link will expire in 1 hour.
              </p>
              <Link
                to="/login"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-all duration-200"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
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
                  className={`w-full px-4 py-3 bg-white border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200`}
                  placeholder="you@company.com"
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </button>

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
          )}
        </div>
      </div>
    </div>
  )
}
