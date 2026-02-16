import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import PortalLayout from '@/components/layout/PortalLayout'
import { applicantPortalService, getPortalToken, setPortalToken } from '@/services/applicantPortal'
import type { PortalDashboardData } from '@/services/applicantPortal'
import {
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  GiftIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  SkeletonCard,
  SkeletonDashboard,
} from '@/components/ui'
import type { StatusVariant } from '@/lib/status'

const statusBadgeVariant: Record<string, StatusVariant> = {
  NEW: 'info',
  SCREENING: 'warning',
  SHORTLISTED: 'success',
  INTERVIEW: 'info',
  ASSESSMENT: 'info',
  REFERENCE_CHECK: 'warning',
  OFFER: 'success',
  HIRED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'default',
}

export default function PortalDashboardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tokenReady, setTokenReady] = useState(!!getPortalToken())

  // Pick up token from email link (?token=...), persist it, then strip from URL
  useEffect(() => {
    const urlToken = searchParams.get('token')
    if (urlToken) {
      setPortalToken(urlToken)
      setTokenReady(true)
      // Remove token from address bar so it's not visible in browser history or referrer headers
      setSearchParams({}, { replace: true })
    } else if (!getPortalToken()) {
      navigate('/portal/login', { replace: true })
    }
  }, [searchParams, setSearchParams, navigate])

  const token = tokenReady ? getPortalToken() : null

  const { data, isLoading, error } = useQuery<PortalDashboardData>({
    queryKey: ['portal-dashboard'],
    queryFn: applicantPortalService.getDashboard,
    enabled: !!token,
  })

  if (!token) {
    return (
      <PortalLayout>
        <div className="text-center py-16 text-gray-500">Redirecting...</div>
      </PortalLayout>
    )
  }

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <SkeletonCard />
          <SkeletonDashboard />
        </div>
      </PortalLayout>
    )
  }

  if (error || !data) {
    return (
      <PortalLayout>
        <EmptyState
          type="error"
          title="Failed to load dashboard"
          description="Your session may have expired."
          action={{
            label: 'Login Again',
            onClick: () => navigate('/portal/login'),
          }}
        />
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
        <Card>
          <CardContent>
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
              <Badge
                variant={statusBadgeVariant[applicant.status] || 'default'}
                size="md"
              >
                {applicant.status_display}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Interviews */}
            {interviews.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDaysIcon className="h-5 w-5 text-purple-600" />
                    Upcoming Interviews
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {interviews.map((iv) => (
                      <div key={iv.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-md">
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
                        <Badge variant="info" size="xs">
                          {iv.status_display}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Offer Section */}
            {showOfferTab && offer && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GiftIcon className="h-5 w-5 text-teal-600" />
                    Job Offer
                  </CardTitle>
                </CardHeader>
                <CardContent>
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
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate('/portal/offer')}
                      >
                        View & Respond to Offer
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Documents Section */}
            {showDocumentsTab && documents.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                      Onboarding Documents
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/portal/documents')}
                    >
                      Manage Documents
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50">
                        <span className="text-sm text-gray-900">{doc.document_type_display}</span>
                        <DocumentStatusBadge status={doc.status} statusDisplay={doc.status_display} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar -- Timeline */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClockIcon className="h-5 w-5 text-gray-600" />
                  Status Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PortalLayout>
  )
}

const docStatusVariant: Record<string, StatusVariant> = {
  PENDING: 'warning',
  UPLOADED: 'info',
  VERIFIED: 'success',
  REJECTED: 'danger',
}

const docStatusIcons: Record<string, React.ReactNode> = {
  PENDING: <ClockIcon className="h-3.5 w-3.5" />,
  UPLOADED: <DocumentTextIcon className="h-3.5 w-3.5" />,
  VERIFIED: <CheckCircleIcon className="h-3.5 w-3.5" />,
  REJECTED: <ExclamationCircleIcon className="h-3.5 w-3.5" />,
}

function DocumentStatusBadge({ status, statusDisplay }: { status: string; statusDisplay: string }) {
  return (
    <Badge variant={docStatusVariant[status] || 'default'} size="xs">
      <span className="inline-flex items-center gap-1">
        {docStatusIcons[status]}
        {statusDisplay}
      </span>
    </Badge>
  )
}
