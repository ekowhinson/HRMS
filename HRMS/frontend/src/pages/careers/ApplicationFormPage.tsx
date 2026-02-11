import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import PortalLayout from '@/components/layout/PortalLayout'
import {
  applicantPortalService,
  setPortalToken,
} from '@/services/applicantPortal'
import {
  CheckCircleIcon,
  DocumentArrowUpIcon,
} from '@heroicons/react/24/outline'

interface ApplicationFormData {
  first_name: string
  middle_name: string
  last_name: string
  email: string
  phone: string
  date_of_birth: string
  gender: string
  nationality: string
  address: string
  city: string
  region: string
  highest_education: string
  institution: string
  graduation_year: string
  current_employer: string
  current_position: string
  years_of_experience: string
  current_salary: string
  expected_salary: string
  notice_period: string
  previous_employer_email: string
  previous_employer_phone: string
  cover_letter: string
}

export default function ApplicationFormPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const urlToken = searchParams.get('token')

  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{ applicant_number: string } | null>(null)

  const { data: vacancyData, isLoading, error } = useQuery({
    queryKey: ['public-vacancy', slug],
    queryFn: () => applicantPortalService.getPublicVacancyDetail(slug!),
    enabled: !!slug,
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApplicationFormData>({
    defaultValues: {
      nationality: 'Ghanaian',
    },
  })

  const onSubmit = async (data: ApplicationFormData) => {
    if (!slug) return

    setIsSubmitting(true)
    try {
      const formData = new FormData()

      // Add all form fields
      Object.entries(data).forEach(([key, value]) => {
        if (value) formData.append(key, value)
      })

      // Add resume if provided
      if (resumeFile) {
        formData.append('resume', resumeFile)
      }

      // Add URL token if present
      if (urlToken) {
        formData.append('token', urlToken)
      }

      const result = await applicantPortalService.submitApplication(slug, formData)

      // Store portal token
      if (result.portal_token) {
        setPortalToken(result.portal_token)
      }

      setSubmitted({ applicant_number: result.applicant_number })
      toast.success('Application submitted successfully!')
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to submit application'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <PortalLayout>
        <div className="max-w-lg mx-auto text-center py-16 space-y-4">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">Application Submitted!</h2>
          <p className="text-gray-600">
            Your application number is{' '}
            <span className="font-semibold text-blue-600">{submitted.applicant_number}</span>
          </p>
          <p className="text-sm text-gray-500">
            You can track your application status from the portal dashboard.
          </p>
          <div className="flex gap-3 justify-center pt-4">
            <button
              onClick={() => navigate('/portal/dashboard')}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => navigate('/careers')}
              className="px-6 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
            >
              Back to Careers
            </button>
          </div>
        </div>
      </PortalLayout>
    )
  }

  const vacancy = vacancyData?.vacancy

  return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : error || !vacancy ? (
          <div className="text-center py-12 text-red-500">
            {(error as any)?.response?.status === 410
              ? 'This application link has expired.'
              : 'Vacancy not found or no longer available.'}
          </div>
        ) : (
          <>
            {/* Vacancy info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{vacancy.job_title}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                {vacancy.department_name && <span>{vacancy.department_name}</span>}
                {vacancy.location_name && <span>{vacancy.location_name}</span>}
                {vacancy.employment_type && <span>{vacancy.employment_type}</span>}
              </div>
              {vacancy.closing_date && (
                <p className="text-sm text-orange-600">
                  Application deadline: {new Date(vacancy.closing_date).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Application Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Personal Information */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      {...register('first_name', { required: 'Required' })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                    <input
                      {...register('middle_name')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      {...register('last_name', { required: 'Required' })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.last_name && <p className="text-xs text-red-500 mt-1">{errors.last_name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      {...register('email', { required: 'Required' })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                    <input
                      {...register('phone', { required: 'Required' })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      {...register('date_of_birth')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select
                      {...register('gender')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                    <input
                      {...register('nationality')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Address</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea
                      {...register('address')}
                      rows={2}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      {...register('city')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                    <input
                      {...register('region')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Education & Experience */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Education & Experience</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Highest Education</label>
                    <select
                      {...register('highest_education')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select</option>
                      <option value="PhD">PhD</option>
                      <option value="Masters">Master's Degree</option>
                      <option value="Bachelors">Bachelor's Degree</option>
                      <option value="HND">HND</option>
                      <option value="Diploma">Diploma</option>
                      <option value="Certificate">Certificate</option>
                      <option value="SSCE">SSCE/WASSCE</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
                    <input
                      {...register('institution')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Graduation Year</label>
                    <input
                      type="number"
                      {...register('graduation_year')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Employer</label>
                    <input
                      {...register('current_employer')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Position</label>
                    <input
                      {...register('current_position')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
                    <input
                      type="number"
                      {...register('years_of_experience')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Salary (GHS)</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('current_salary')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Salary (GHS)</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('expected_salary')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notice Period</label>
                    <input
                      {...register('notice_period')}
                      placeholder="e.g. 1 month"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Previous Employer Contacts */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Previous Employer Contact</h2>
                <p className="text-sm text-gray-500 mb-4">These fields are mandatory per policy.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Previous Employer Email *</label>
                    <input
                      type="email"
                      {...register('previous_employer_email', { required: 'Previous employer email is required' })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.previous_employer_email && (
                      <p className="text-xs text-red-500 mt-1">{errors.previous_employer_email.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Previous Employer Phone *</label>
                    <input
                      {...register('previous_employer_phone', { required: 'Previous employer phone is required' })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.previous_employer_phone && (
                      <p className="text-xs text-red-500 mt-1">{errors.previous_employer_phone.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Cover Letter & Resume */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Cover Letter & Resume</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cover Letter</label>
                    <textarea
                      {...register('cover_letter')}
                      rows={5}
                      placeholder="Tell us why you're a great fit for this role..."
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resume/CV</label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md cursor-pointer hover:bg-gray-200">
                        <DocumentArrowUpIcon className="h-4 w-4" />
                        {resumeFile ? resumeFile.name : 'Choose File'}
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                        />
                      </label>
                      {resumeFile && (
                        <button
                          type="button"
                          onClick={() => setResumeFile(null)}
                          className="text-sm text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">PDF, DOC, or DOCX (max 10MB)</p>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </PortalLayout>
  )
}
