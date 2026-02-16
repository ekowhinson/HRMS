import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import {
  recruitmentService,
  type Applicant,
  type Interview,
  type JobOffer,
  type InterviewScoringSheet,
} from '@/services/recruitment'

interface Reference {
  id: string
  name: string
  relationship: string
  company: string
  position: string
  email: string
  phone: string
  status: string
  verified_employment: boolean | null
  verified_position: boolean | null
  verified_dates: boolean | null
  would_rehire: boolean | null
  overall_feedback: string
  checked_at: string | null
}

const statusColors: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  // Applicant
  NEW: 'info',
  SCREENING: 'warning',
  SHORTLISTED: 'success',
  INTERVIEW: 'info',
  OFFER: 'success',
  HIRED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'default',
  // Interview
  SCHEDULED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'warning',
  RESCHEDULED: 'warning',
  // Offer
  DRAFT: 'default',
  PENDING: 'warning',
  ACCEPTED: 'success',
  NEGOTIATING: 'info',
  EXPIRED: 'default',
  // Reference
  IN_PROGRESS: 'info',
  UNABLE_TO_REACH: 'warning',
  // Interview result
  PASSED: 'success',
  FAILED: 'danger',
}

export default function ApplicantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(true)
  const [applicant, setApplicant] = useState<Applicant | null>(null)
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [scoringSheets, setScoringSheets] = useState<Record<string, InterviewScoringSheet[]>>({})
  const [references, setReferences] = useState<Reference[]>([])
  const [offers, setOffers] = useState<JobOffer[]>([])
  const [timeline, setTimeline] = useState<any[]>([])

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [applicantData, interviewData, offerData, timelineData] = await Promise.all([
        recruitmentService.getApplicant(id),
        recruitmentService.getInterviews({ applicant: id }).then(r => r.results || []).catch(() => []),
        recruitmentService.getOffers({ applicant: id }).then(r => r.results || []).catch(() => []),
        recruitmentService.getApplicantTimeline(id).catch(() => []),
      ])
      setApplicant(applicantData)
      setInterviews(interviewData as Interview[])
      setOffers(offerData as JobOffer[])
      setTimeline(timelineData)

      // Load references
      try {
        const { default: api } = await import('@/lib/api')
        const refRes = await api.get('/recruitment/references/', { params: { applicant: id } })
        setReferences(refRes.data.results || refRes.data || [])
      } catch { /* no references */ }

      // Load scoring sheets per interview
      const sheets: Record<string, InterviewScoringSheet[]> = {}
      for (const intv of interviewData as Interview[]) {
        try {
          const s = await recruitmentService.getScoringSheets(intv.id)
          if (s.length > 0) sheets[intv.id] = s
        } catch { /* no sheets */ }
      }
      setScoringSheets(sheets)
    } catch (error) {
      console.error('Error loading applicant:', error)
      toast.error('Failed to load applicant details')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (newStatus: Applicant['status']) => {
    if (!id || !applicant) return
    try {
      const updated = await recruitmentService.updateApplicantStatus(id, newStatus)
      setApplicant(updated)
      toast.success(`Status updated to ${newStatus}`)
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!applicant) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Applicant not found</p>
        <Button variant="outline" onClick={() => navigate('/admin/recruitment?tab=applicants')} className="mt-4">
          Back to Recruitment
        </Button>
      </div>
    )
  }

  const statusActions: Partial<Record<string, { label: string; status: Applicant['status']; variant: 'primary' | 'success' | 'danger' | 'outline' }[]>> = {
    NEW: [
      { label: 'Start Screening', status: 'SCREENING', variant: 'primary' },
      { label: 'Reject', status: 'REJECTED', variant: 'danger' },
    ],
    SCREENING: [
      { label: 'Shortlist', status: 'SHORTLISTED', variant: 'success' },
      { label: 'Reject', status: 'REJECTED', variant: 'danger' },
    ],
    SHORTLISTED: [
      { label: 'Move to Interview', status: 'INTERVIEW', variant: 'primary' },
      { label: 'Reject', status: 'REJECTED', variant: 'danger' },
    ],
    INTERVIEW: [
      { label: 'Make Offer', status: 'OFFER', variant: 'success' },
      { label: 'Reject', status: 'REJECTED', variant: 'danger' },
    ],
    OFFER: [
      { label: 'Mark Hired', status: 'HIRED', variant: 'success' },
    ],
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{applicant.full_name}</h1>
            <Badge variant={statusColors[applicant.status] || 'default'}>{applicant.status}</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {applicant.applicant_number || applicant.application_number} &middot; Applied for{' '}
            <Link to={`/admin/recruitment/vacancies/${applicant.vacancy}`} className="text-primary-600 hover:underline">
              {applicant.vacancy_title}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {statusActions[applicant.status]?.map((action) => (
            <Button
              key={action.status}
              variant={action.variant}
              size="sm"
              onClick={() => handleStatusUpdate(action.status)}
            >
              {action.label}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/recruitment?tab=applicants')}>
            Back
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="interviews">Interviews ({interviews.length})</TabsTrigger>
          <TabsTrigger value="references">References ({references.length})</TabsTrigger>
          <TabsTrigger value="offers">Offers ({offers.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Full Name" value={applicant.full_name} />
                <InfoRow label="Email" value={applicant.email} />
                <InfoRow label="Phone" value={applicant.phone} />
                {applicant.alternate_phone && <InfoRow label="Alt. Phone" value={applicant.alternate_phone} />}
                <InfoRow label="Date of Birth" value={applicant.date_of_birth ? new Date(applicant.date_of_birth).toLocaleDateString() : 'N/A'} />
                <InfoRow label="Gender" value={applicant.gender} />
                <InfoRow label="Nationality" value={applicant.nationality} />
                <InfoRow label="Address" value={`${applicant.address}, ${applicant.city}, ${applicant.region}`} />
              </CardContent>
            </Card>

            {/* Education & Experience */}
            <Card>
              <CardHeader>
                <CardTitle>Education & Experience</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Highest Education" value={applicant.highest_education} />
                {applicant.field_of_study && <InfoRow label="Field of Study" value={applicant.field_of_study} />}
                <InfoRow label="Institution" value={applicant.institution} />
                <InfoRow label="Graduation Year" value={applicant.graduation_year?.toString() || 'N/A'} />
                <InfoRow label="Years of Experience" value={applicant.years_of_experience?.toString() || 'N/A'} />
                <InfoRow label="Current Employer" value={applicant.current_employer || 'N/A'} />
                <InfoRow label="Current Position" value={applicant.current_position || 'N/A'} />
                {applicant.current_salary && <InfoRow label="Current Salary" value={`GHS ${Number(applicant.current_salary).toLocaleString()}`} />}
                {applicant.expected_salary && <InfoRow label="Expected Salary" value={`GHS ${Number(applicant.expected_salary).toLocaleString()}`} />}
              </CardContent>
            </Card>

            {/* Application Details */}
            <Card>
              <CardHeader>
                <CardTitle>Application Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Application Date" value={new Date(applicant.application_date || applicant.created_at).toLocaleDateString()} />
                <InfoRow label="Source" value={applicant.source} />
                {applicant.referral_source && <InfoRow label="Referral Source" value={applicant.referral_source} />}
                {applicant.notice_period && <InfoRow label="Notice Period" value={applicant.notice_period} />}
                {applicant.overall_score && <InfoRow label="Overall Score" value={String(applicant.overall_score)} />}
                {applicant.screening_score != null && <InfoRow label="Screening Score" value={String(applicant.screening_score)} />}
                {applicant.shortlist_score != null && <InfoRow label="Shortlist Score" value={String(applicant.shortlist_score)} />}
                {applicant.shortlist_rank != null && <InfoRow label="Shortlist Rank" value={`#${applicant.shortlist_rank}`} />}
              </CardContent>
            </Card>

            {/* Skills & Qualifications */}
            <Card>
              <CardHeader>
                <CardTitle>Skills & Qualifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {applicant.skills && applicant.skills.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Skills</p>
                    <div className="flex flex-wrap gap-1">
                      {applicant.skills.map((skill, i) => (
                        <Badge key={i} variant="default">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {applicant.languages && applicant.languages.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Languages</p>
                    <div className="flex flex-wrap gap-1">
                      {applicant.languages.map((lang, i) => (
                        <Badge key={i} variant="info">{lang}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {applicant.certifications && applicant.certifications.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Certifications</p>
                    <div className="flex flex-wrap gap-1">
                      {applicant.certifications.map((cert, i) => (
                        <Badge key={i} variant="success">{cert}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {applicant.cover_letter && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Cover Letter</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{applicant.cover_letter}</p>
                  </div>
                )}
                {applicant.notes && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Notes</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{applicant.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Interviews Tab */}
        <TabsContent value="interviews">
          {interviews.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No interviews scheduled for this applicant.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {interviews.map((interview) => (
                <Card key={interview.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        Round {interview.round_number} — {interview.interview_type}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {(interview as any).result && (
                          <Badge variant={statusColors[(interview as any).result] || 'default'}>
                            {(interview as any).result}
                          </Badge>
                        )}
                        <Badge variant={statusColors[interview.status] || 'default'}>
                          {interview.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Date</p>
                        <p className="font-medium">{new Date(interview.scheduled_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Time</p>
                        <p className="font-medium">{interview.scheduled_time?.slice(0, 5)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Duration</p>
                        <p className="font-medium">{interview.duration_minutes} min</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Location</p>
                        <p className="font-medium">{interview.location || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Panel Members */}
                    {interview.panel_members && interview.panel_members.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-2">Panel Members</p>
                        <div className="flex flex-wrap gap-2">
                          {interview.panel_members.map((pm: any) => (
                            <span key={pm.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {pm.interviewer_name || pm.employee_name}
                              {(pm.role === 'LEAD' || pm.is_lead) && (
                                <span className="ml-1 text-primary-600">(Lead)</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Scoring Sheets */}
                    {scoringSheets[interview.id] && scoringSheets[interview.id].length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-2">Scoring Sheets</p>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Panelist</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Score</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Recommendation</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {scoringSheets[interview.id].map((sheet) => (
                                <tr key={sheet.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-sm">{sheet.panelist_name}</td>
                                  <td className="px-4 py-2 text-sm font-medium">
                                    {sheet.total_score != null ? `${sheet.total_score}/${sheet.max_possible_score}` : 'N/A'}
                                    {sheet.percentage_score != null && (
                                      <span className="text-gray-400 ml-1">({sheet.percentage_score}%)</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-sm">{sheet.recommendation || 'N/A'}</td>
                                  <td className="px-4 py-2 text-sm">
                                    <Badge variant={sheet.is_submitted ? 'success' : 'warning'}>
                                      {sheet.is_submitted ? 'Submitted' : 'Pending'}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Feedback */}
                    {interview.feedback && interview.feedback.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-2">Feedback</p>
                        <div className="space-y-2">
                          {interview.feedback.map((fb) => (
                            <div key={fb.id} className="bg-gray-50 rounded-md p-3 text-sm">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{fb.panelist_name}</span>
                                <span className="text-gray-500">Score: {fb.overall_score}/10</span>
                              </div>
                              {fb.recommendation && <p className="text-gray-600">Recommendation: {fb.recommendation}</p>}
                              {fb.strengths && <p className="text-green-700 mt-1">Strengths: {fb.strengths}</p>}
                              {fb.weaknesses && <p className="text-red-700 mt-1">Weaknesses: {fb.weaknesses}</p>}
                              {fb.comments && <p className="text-gray-600 mt-1">{fb.comments}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {interview.notes && (
                      <div>
                        <p className="text-sm font-medium text-gray-500">Notes</p>
                        <p className="text-sm text-gray-700">{interview.notes}</p>
                      </div>
                    )}

                    {interview.meeting_link && (
                      <a href={interview.meeting_link} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-primary-600 hover:underline">
                        Join Meeting
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* References Tab */}
        <TabsContent value="references">
          {references.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No references recorded for this applicant.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {references.map((ref) => (
                <Card key={ref.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{ref.name}</CardTitle>
                      <Badge variant={statusColors[ref.status] || 'default'}>{ref.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                      <InfoRow label="Relationship" value={ref.relationship} />
                      <InfoRow label="Company" value={ref.company} />
                      <InfoRow label="Position" value={ref.position} />
                      <InfoRow label="Email" value={ref.email || 'N/A'} />
                      <InfoRow label="Phone" value={ref.phone} />
                      {ref.checked_at && <InfoRow label="Checked At" value={new Date(ref.checked_at).toLocaleDateString()} />}
                    </div>
                    {ref.status === 'COMPLETED' && (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <VerifyItem label="Employment" value={ref.verified_employment} />
                        <VerifyItem label="Position" value={ref.verified_position} />
                        <VerifyItem label="Dates" value={ref.verified_dates} />
                        <VerifyItem label="Would Rehire" value={ref.would_rehire} />
                      </div>
                    )}
                    {ref.overall_feedback && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-500">Feedback</p>
                        <p className="text-sm text-gray-700">{ref.overall_feedback}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Offers Tab */}
        <TabsContent value="offers">
          {offers.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No job offers for this applicant.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {offers.map((offer) => (
                <Card key={offer.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{offer.offer_number}</CardTitle>
                      <Badge variant={statusColors[offer.status] || 'default'}>{offer.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                      <InfoRow label="Position" value={offer.position_title || 'N/A'} />
                      <InfoRow label="Department" value={offer.department_name || 'N/A'} />
                      <InfoRow label="Grade" value={offer.grade_name || 'N/A'} />
                      <InfoRow label="Employment Type" value={offer.employment_type} />
                      <InfoRow label="Salary" value={`${offer.salary_currency || 'GHS'} ${Number(offer.offered_salary).toLocaleString()}`} />
                      <InfoRow label="Start Date" value={offer.start_date ? new Date(offer.start_date).toLocaleDateString() : 'N/A'} />
                      <InfoRow label="Probation" value={`${offer.probation_months} months`} />
                      {offer.valid_until && <InfoRow label="Valid Until" value={new Date(offer.valid_until).toLocaleDateString()} />}
                      {offer.offered_by_name && <InfoRow label="Offered By" value={offer.offered_by_name} />}
                    </div>
                    {offer.benefits_summary && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-500">Benefits</p>
                        <p className="text-sm text-gray-700">{offer.benefits_summary}</p>
                      </div>
                    )}
                    {offer.response_comments && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-500">Response Comments</p>
                        <p className="text-sm text-gray-700">{offer.response_comments}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          {timeline.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No timeline events recorded.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-4">
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                  <div className="space-y-6">
                    {timeline.map((event: any, i: number) => (
                      <div key={i} className="relative pl-10">
                        <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-primary-500 border-2 border-white" />
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{event.title || event.action || event.event_type}</p>
                          {event.description && <p className="text-gray-600 mt-0.5">{event.description}</p>}
                          <p className="text-gray-400 text-xs mt-1">
                            {new Date(event.timestamp || event.created_at).toLocaleString()}
                            {event.performed_by && ` — ${event.performed_by}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  )
}

function VerifyItem({ label, value }: { label: string; value: boolean | null }) {
  return (
    <div className="flex items-center gap-1.5">
      {value === true && <span className="text-green-500">&#10003;</span>}
      {value === false && <span className="text-red-500">&#10007;</span>}
      {value === null && <span className="text-gray-400">—</span>}
      <span className="text-sm text-gray-700">{label}</span>
    </div>
  )
}
