import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import PortalLayout from '@/components/layout/PortalLayout'
import { applicantPortalService, setPortalToken } from '@/services/applicantPortal'
import { KeyIcon } from '@heroicons/react/24/outline'

interface LoginFormData {
  email: string
  token: string
}

export default function PortalLoginPage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>()

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    try {
      const result = await applicantPortalService.portalLogin(data.email, data.token)
      setPortalToken(data.token)
      toast.success(`Welcome back, ${result.applicant.first_name}!`)
      navigate('/portal/dashboard')
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Invalid credentials'
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <PortalLayout>
      <div className="max-w-md mx-auto py-12">
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <KeyIcon className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Applicant Portal Login</h1>
          <p className="text-gray-600 mt-1">
            Enter the email and access token you received when you submitted your application.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              {...register('email', { required: 'Email is required' })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="your@email.com"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
            <input
              type="text"
              {...register('token', { required: 'Access token is required' })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Paste your access token here"
            />
            {errors.token && <p className="text-xs text-red-500 mt-1">{errors.token.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </PortalLayout>
  )
}
