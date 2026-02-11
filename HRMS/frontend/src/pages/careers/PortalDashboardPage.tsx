import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import PortalLayout from '@/components/layout/PortalLayout'
import { applicantPortalService, getPortalToken } from '@/services/applicantPortal'
import type { PortalDashboardData } from '@/services/applicantPortal'
import {
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  GiftIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  SCREENING: 'bg-yellow-100 text-yellow-800',
  SHORTLISTED: 'bg-green-100 text-green-800',
  INTERVIEW: 'bg-purple-100 text-purple-800',
  ASSESSMENT: 'bg-indigo-100 text-indigo-800',
  REFERENCE_CHECK: 'bg-orange-100 text-orange-800',
  OFFER: 'bg-teal-100 text-teal-800',
  HIRED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  WITHDRAWN: 'bg-gray-100 text-gray-800',
}

export default function PortalDashboardPage() {
  const navigate = useNavigate()
  const token = getPortalToken()

  const { data, isLoading, error } = useQuery<PortalDashboardData>({
    queryKey: ['portal-dashboard'],
    queryFn: applicantPortalService.getDashboard,
    enabled: !!token,
  })

  if (!token) {
    navigate('/portal/login')
    return null
  }

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="text-center py-16 text-gray-500">Loading your dashboard...</div>
      </PortalLayout>
    )
  }

  if (error || !data) {
    return (
      <PortalLayout>
        <div className="text-center py-16 text-red-500">
          Failed to load dashboard. Your session may have expired.
          <button
            onClick={() => navigate('/portal/login')}
            className="block mx-auto mt-4 px-4 py-2 bg-blue-600 text-white rounded-md text-sm"
          >
            Login Again
          </button>
        </div>
      </PortalLayout>
    )
  }

  const { applicant, offer, documents, interviews, timeline } = data

  const showOfferTab = ['OFFER', 'HIRED'].includes(applicant.status)
  const showDocumentsTab = applicant.status === 'HIRED'

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome, {applicant.first_name}!
              </h1>
              <p className="text-gray-600">
                Application: <span className="font-medium">{applicant.applicant_number}</span>
                {' | '}
                {applicant.vacancy_title}
              </p>
            </div>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${statusColors[applicant.status] || 'bg-gray-100 text-gray-800'}`}>
              {applicant.status_display}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Interviews */}
            {interviews.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CalendarDaysIcon className="h-5 w-5 text-purple-600" />
                  Upcoming Interviews
                </h2>
                <div className="space-y-3">
                  {interviews.map((iv) => (
                    <div key={iv.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{iv.interview_type_display}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(iv.scheduled_date).toLocaleDateString()} at {iv.scheduled_time}
                          {iv.duration_minutes && ` (${iv.duration_minutes} mins)`}
                        </p>
                        {iv.location && <p className="text-sm text-gray-500">{iv.location}</p>}
                        {iv.meeting_link && (
                          <a
                            href={iv.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Join Meeting
                          </a>
                        )}
                      </div>
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                        {iv.status_display}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offer Section */}
            {showOfferTab && offer && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <GiftIcon className="h-5 w-5 text-teal-600" />
                  Job Offer
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Position</p>
                    <p className="font-medium">{offer.position}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Department</p>
                    <p className="font-medium">{offer.department}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Compensation</p>
                    <p className="font-medium">GHS {Number(offer.total_compensation).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Start Date</p>
                    <p className="font-medium">{new Date(offer.proposed_start_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Status</p>
                    <p className="font-medium">{offer.status_display}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Response By</p>
                    <p className="font-medium">{new Date(offer.response_deadline).toLocaleDateString()}</p>
                  </div>
                </div>
                {['SENT', 'APPROVED'].includes(offer.status) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => navigate('/portal/offer')}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                    >
                      View & Respond to Offer
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Documents Section */}
            {showDocumentsTab && documents.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                    Onboarding Documents
                  </h2>
                  <button
                    onClick={() => navigate('/portal/documents')}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Manage Documents
                  </button>
                </div>
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50">
                      <span className="text-sm text-gray-900">{doc.document_type_display}</span>
                      <DocumentStatusBadge status={doc.status} statusDisplay={doc.status_display} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar — Timeline */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-gray-600" />
                Status Timeline
              </h2>
              {timeline.length === 0 ? (
                <p className="text-sm text-gray-500">No status updates yet.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />
                  <div className="space-y-4">
                    {timeline.map((entry) => (
                      <div key={entry.id} className="relative pl-8">
                        <div className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                        <p className="text-sm font-medium text-gray-900">{entry.status_display}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(entry.changed_at).toLocaleDateString()} {new Date(entry.changed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {entry.display_message && (
                          <p className="text-xs text-gray-600 mt-0.5">{entry.display_message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PortalLayout>
  )
}

function DocumentStatusBadge({ status, statusDisplay }: { status: string; statusDisplay: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    UPLOADED: 'bg-blue-100 text-blue-800',
    VERIFIED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  }

  const icons: Record<string, React.ReactNode> = {
    PENDING: <ClockIcon className="h-3.5 w-3.5" />,
    UPLOADED: <DocumentTextIcon className="h-3.5 w-3.5" />,
    VERIFIED: <CheckCircleIcon className="h-3.5 w-3.5" />,
    REJECTED: <ExclamationCircleIcon className="h-3.5 w-3.5" />,
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {icons[status]}
      {statusDisplay}
    </span>
  )
}
