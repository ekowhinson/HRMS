import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { EnvelopeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { authService } from '@/services/auth'
import { Card, CardContent, Button, Input } from '@/components/ui'

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
        <Card>
          <CardContent className="p-8">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-md bg-primary-600 mb-4">
                <span className="text-2xl font-bold text-white">HR</span>
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
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
                <Link to="/login">
                  <Button
                    variant="secondary"
                    fullWidth
                    size="lg"
                    leftIcon={<ArrowLeftIcon className="h-4 w-4" />}
                  >
                    Back to Login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <Input
                  label="Email Address"
                  type="email"
                  autoComplete="email"
                  autoFocus
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

                <Button
                  type="submit"
                  isLoading={isLoading}
                  fullWidth
                  size="lg"
                >
                  Send Reset Link
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
