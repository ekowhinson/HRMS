import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import {
  recruitmentService,
  type Interview,
  type InterviewScoringSheet,
} from '@/services/recruitment'

const statusColors: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  SCHEDULED: 'info',
  CONFIRMED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'warning',
  RESCHEDULED: 'warning',
}

const resultColors: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  PASSED: 'success',
  FAILED: 'danger',
  ON_HOLD: 'warning',
  PENDING: 'default',
}

export default function InterviewDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [interview, setInterview] = useState<Interview | null>(null)
  const [scoringSheets, setScoringSheets] = useState<InterviewScoringSheet[]>([])
  const [scoringSummary, setScoringSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (id) loadData()
  }, [id])

  async function loadData() {
    setLoading(true)
    try {
      const [interviewData, summaryData] = await Promise.allSettled([
        recruitmentService.getInterview(id!),
        recruitmentService.getInterviewScoringSummary(id!),
      ])

      if (interviewData.status === 'fulfilled') {
        setInterview(interviewData.value)
      }
      if (summaryData.status === 'fulfilled') {
        setScoringSummary(summaryData.value)
      }

      // Load scoring sheets for this interview
      try {
        const sheets = await recruitmentService.getInterviewScoringSheets({ interview: id })
        setScoringSheets(Array.isArray(sheets) ? sheets : sheets.results || [])
      } catch {
        // scoring sheets may not exist
      }
    } catch (err) {
      toast.error('Failed to load interview details')
    } finally {
      setLoading(false)
    }
  }

  async function handleComplete() {
    if (!interview) return
    setActionLoading(true)
    try {
      const updated = await recruitmentService.completeInterview(interview.id)
      setInterview(updated)
      toast.success('Interview marked as completed')
    } catch {
      toast.error('Failed to complete interview')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSetResult(result: string) {
    if (!interview) return
    setActionLoading(true)
    try {
      const updated = await recruitmentService.setInterviewResult(interview.id, result)
      setInterview(updated)
      toast.success(`Result set to ${result}`)
    } catch {
      toast.error('Failed to set result')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!interview) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Interview not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {interview.interview_type_display || interview.interview_type} - Round {interview.round_number}
            </h1>
            <Badge variant={statusColors[interview.status] || 'default'}>
              {interview.status_display || interview.status}
            </Badge>
            {interview.result && (
              <Badge variant={resultColors[interview.result] || 'default'}>
                {interview.result}
              </Badge>
            )}
          </div>
          <p className="text-gray-500 mt-1">
            Applicant:{' '}
            <Link to={`/admin/recruitment/applicants/${interview.applicant}`} className="text-primary-600 hover:underline">
              {interview.applicant_name}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {interview.status === 'SCHEDULED' && (
            <Button onClick={handleComplete} disabled={actionLoading}>
              Mark Completed
            </Button>
          )}
          {interview.status === 'COMPLETED' && !interview.result && (
            <>
              <Button variant="success" onClick={() => handleSetResult('PASSED')} disabled={actionLoading}>
                Pass
              </Button>
              <Button variant="danger" onClick={() => handleSetResult('FAILED')} disabled={actionLoading}>
                Fail
              </Button>
              <Button variant="outline" onClick={() => handleSetResult('ON_HOLD')} disabled={actionLoading}>
                On Hold
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="panel">Panel ({interview.panel_members?.length || 0})</TabsTrigger>
          <TabsTrigger value="feedback">Feedback ({interview.feedback?.length || 0})</TabsTrigger>
          <TabsTrigger value="scoring">Scoring ({scoringSheets.length})</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Date</dt>
                    <dd className="text-sm font-medium">{new Date(interview.scheduled_date).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Time</dt>
                    <dd className="text-sm font-medium">{interview.scheduled_time}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Duration</dt>
                    <dd className="text-sm font-medium">{interview.duration_minutes} minutes</dd>
                  </div>
                  {interview.location && (
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">Location</dt>
                      <dd className="text-sm font-medium">{interview.location}</dd>
                    </div>
                  )}
                  {interview.meeting_link && (
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">Meeting Link</dt>
                      <dd className="text-sm font-medium">
                        <a href={interview.meeting_link} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                          Join Meeting
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Interview Info</CardTitle></CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Type</dt>
                    <dd className="text-sm font-medium">{interview.interview_type_display || interview.interview_type}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Round</dt>
                    <dd className="text-sm font-medium">{interview.round_number}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Status</dt>
                    <dd>
                      <Badge variant={statusColors[interview.status] || 'default'} size="sm">
                        {interview.status_display || interview.status}
                      </Badge>
                    </dd>
                  </div>
                  {interview.result && (
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">Result</dt>
                      <dd>
                        <Badge variant={resultColors[interview.result] || 'default'} size="sm">
                          {interview.result}
                        </Badge>
                      </dd>
                    </div>
                  )}
                  {interview.average_score != null && (
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">Average Score</dt>
                      <dd className="text-sm font-medium">{Number(interview.average_score).toFixed(1)}</dd>
                    </div>
                  )}
                  {interview.overall_recommendation && (
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">Recommendation</dt>
                      <dd className="text-sm font-medium">{interview.overall_recommendation}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {interview.notes && (
              <Card className="md:col-span-2">
                <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{interview.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Panel Tab */}
        <TabsContent value="panel">
          <Card>
            <CardContent className="p-0">
              {interview.panel_members?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No panel members assigned</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interviewer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confirmed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {interview.panel_members?.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{(member as any).interviewer_name || member.employee_name}</td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant={member.role === 'LEAD' || member.is_lead ? 'info' : 'default'} size="sm">
                            {member.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant={member.confirmed ? 'success' : 'warning'} size="sm">
                            {member.confirmed ? 'Confirmed' : 'Pending'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback">
          <div className="space-y-4">
            {interview.feedback?.length === 0 ? (
              <Card>
                <CardContent>
                  <div className="text-center py-8 text-gray-500">No feedback submitted yet</div>
                </CardContent>
              </Card>
            ) : (
              interview.feedback?.map((fb) => (
                <Card key={fb.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{fb.panelist_name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {fb.overall_score != null && (
                      <div className="mb-4">
                        <span className="text-xs text-gray-500">Overall Score</span>
                        <p className="text-lg font-semibold">{fb.overall_score}/5</p>
                      </div>
                    )}
                    {fb.strengths && (
                      <div className="mb-2">
                        <span className="text-xs text-gray-500">Strengths</span>
                        <p className="text-sm">{fb.strengths}</p>
                      </div>
                    )}
                    {fb.weaknesses && (
                      <div className="mb-2">
                        <span className="text-xs text-gray-500">Weaknesses</span>
                        <p className="text-sm">{fb.weaknesses}</p>
                      </div>
                    )}
                    {fb.recommendation && (
                      <div className="mb-2">
                        <span className="text-xs text-gray-500">Recommendation</span>
                        <p className="text-sm font-medium">{fb.recommendation}</p>
                      </div>
                    )}
                    {fb.comments && (
                      <div>
                        <span className="text-xs text-gray-500">Comments</span>
                        <p className="text-sm">{fb.comments}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Scoring Tab */}
        <TabsContent value="scoring">
          <div className="space-y-4">
            {scoringSummary && (
              <Card>
                <CardHeader><CardTitle>Scoring Summary</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-xs text-gray-500">Sheets Submitted</span>
                      <p className="text-lg font-semibold">{scoringSummary.submitted_count || 0}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Average Total</span>
                      <p className="text-lg font-semibold">{scoringSummary.average_total?.toFixed(1) || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Highest</span>
                      <p className="text-lg font-semibold">{scoringSummary.highest_total?.toFixed(1) || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Lowest</span>
                      <p className="text-lg font-semibold">{scoringSummary.lowest_total?.toFixed(1) || '-'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {scoringSheets.length === 0 ? (
              <Card>
                <CardContent>
                  <div className="text-center py-8 text-gray-500">No scoring sheets created yet</div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interviewer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Score</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommendation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {scoringSheets.map((sheet) => (
                        <tr key={sheet.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium">{sheet.interviewer_name}</td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant={sheet.status === 'SUBMITTED' ? 'success' : 'warning'} size="sm">
                              {sheet.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">{sheet.total_score ?? '-'}</td>
                          <td className="px-4 py-3 text-sm">{sheet.recommendation || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
