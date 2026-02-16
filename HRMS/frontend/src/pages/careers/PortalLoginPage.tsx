import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import PortalLayout from '@/components/layout/PortalLayout'
import { applicantPortalService, setPortalToken } from '@/services/applicantPortal'
import { KeyIcon } from '@heroicons/react/24/outline'
import { Button, Input, Card, CardContent } from '@/components/ui'

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

        <Card>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                {...register('email', { required: 'Email is required' })}
                error={errors.email?.message}
                placeholder="your@email.com"
              />

              <Input
                label="Access Token"
                type="text"
                {...register('token', { required: 'Access token is required' })}
                error={errors.token?.message}
                placeholder="Paste your access token here"
                className="font-mono"
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                fullWidth
                isLoading={isLoading}
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  )
}
