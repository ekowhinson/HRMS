import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ExclamationTriangleIcon,
  ScaleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import { Card, CardContent, StatCard } from '@/components/ui/Card'
import { TablePagination } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import {
  disciplineService,
  type DisciplinaryCase,
  type DisciplinaryAction,
} from '@/services/discipline'

const statusVariant = (s: string): 'default' | 'info' | 'warning' | 'danger' | 'success' => {
  const map: Record<string, 'default' | 'info' | 'warning' | 'danger' | 'success'> = {
    DRAFT: 'default', REPORTED: 'info', UNDER_INVESTIGATION: 'warning',
    SHOW_CAUSE_ISSUED: 'warning', SHOW_CAUSE_RECEIVED: 'info',
    HEARING_SCHEDULED: 'info', HEARING_COMPLETED: 'info',
    PENDING_DECISION: 'warning', DECISION_ISSUED: 'danger',
    APPEAL_FILED: 'warning', CLOSED: 'success', WITHDRAWN: 'default',
  }
  return map[s] || 'default'
}

const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'
const formatStatus = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export default function MyDisciplinaryPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['my-disciplinary-cases'],
    queryFn: disciplineService.getMyCases,
  })

  const openCases = cases.filter((c: DisciplinaryCase) => !['CLOSED', 'WITHDRAWN'].includes(c.status))
  const pendingActions = cases.reduce((count: number, c: DisciplinaryCase) =>
    count + (c.actions?.filter(a => !a.acknowledged_by_employee).length || 0), 0
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Disciplinary Cases</h1>
        <p className="text-sm text-gray-500 mt-1">View your disciplinary cases, respond to show-cause letters, and file appeals</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Cases" value={cases.length} variant="primary" icon={<ScaleIcon className="h-6 w-6" />} />
        <StatCard title="Open Cases" value={openCases.length} variant="warning" icon={<ExclamationTriangleIcon className="h-6 w-6" />} />
        <StatCard title="Actions Pending" value={pendingActions} variant="danger" />
      </div>

      {/* Cases List */}
      {isLoading ? (
        <Card><CardContent><p className="text-center text-sm text-gray-500 py-8">Loading...</p></CardContent></Card>
      ) : cases.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <ScaleIcon className="h-12 w-12 text-gray-300 mx-auto" />
              <p className="mt-4 text-gray-500">No disciplinary cases found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {cases.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((c: DisciplinaryCase) => (
            <CaseCard
              key={c.id}
              c={c}
              expanded={expandedId === c.id}
              onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
            />
          ))}
          {cases.length > pageSize && (
            <TablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(cases.length / pageSize)}
              totalItems={cases.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}
    </div>
  )
}

function CaseCard({ c, expanded, onToggle }: {
  c: DisciplinaryCase
  expanded: boolean
  onToggle: () => void
}) {
  const queryClient = useQueryClient()
  const [showCauseResponse, setShowCauseResponse] = useState('')
  const [appealGrounds, setAppealGrounds] = useState('')
  const [showAppealForm, setShowAppealForm] = useState(false)

  const respondMutation = useMutation({
    mutationFn: (data: { show_cause_response: string }) => disciplineService.respondToShowCause(c.id, data),
    onSuccess: () => {
      toast.success('Response submitted successfully')
      queryClient.invalidateQueries({ queryKey: ['my-disciplinary-cases'] })
      setShowCauseResponse('')
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to submit response'),
  })

  const acknowledgeMutation = useMutation({
    mutationFn: (actionId: string) => disciplineService.acknowledgeAction(c.id, actionId),
    onSuccess: () => {
      toast.success('Action acknowledged')
      queryClient.invalidateQueries({ queryKey: ['my-disciplinary-cases'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to acknowledge'),
  })

  const appealMutation = useMutation({
    mutationFn: (data: FormData) => disciplineService.fileAppeal(c.id, data),
    onSuccess: () => {
      toast.success('Appeal filed successfully')
      queryClient.invalidateQueries({ queryKey: ['my-disciplinary-cases'] })
      setAppealGrounds('')
      setShowAppealForm(false)
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to file appeal'),
  })

  const handleFileAppeal = () => {
    const formData = new FormData()
    formData.append('grounds_for_appeal', appealGrounds)
    appealMutation.mutate(formData)
  }

  return (
    <Card>
      <div className="px-6 py-4 cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-sm font-semibold text-primary-600">{c.case_number}</span>
              <p className="text-sm text-gray-700 mt-0.5">{c.category_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={statusVariant(c.status)} size="sm" dot>{formatStatus(c.status)}</Badge>
            {expanded ? <ChevronUpIcon className="h-5 w-5 text-gray-400" /> : <ChevronDownIcon className="h-5 w-5 text-gray-400" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-6">
          {/* Case Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p><span className="text-gray-500">Incident Date:</span> {formatDate(c.incident_date)}</p>
              <p><span className="text-gray-500">Location:</span> {c.incident_location || '-'}</p>
              <p><span className="text-gray-500">Reported:</span> {formatDate(c.reported_date)}</p>
            </div>
            <div>
              <p className="text-gray-500">Description:</p>
              <p className="text-gray-700 mt-1">{c.incident_description}</p>
            </div>
          </div>

          {/* Show Cause Section */}
          {c.status === 'SHOW_CAUSE_ISSUED' && (
            <div className="bg-warning-50 border border-warning-200 rounded-md p-4 space-y-3">
              <h4 className="font-semibold text-warning-800">Show Cause Letter Issued</h4>
              <p className="text-sm text-warning-700">
                A show cause letter was issued on {formatDate(c.show_cause_issued_date)}.
                Please provide your response below.
              </p>
              <Textarea
                placeholder="Enter your response to the show cause letter..."
                value={showCauseResponse}
                onChange={(e) => setShowCauseResponse(e.target.value)}
                rows={4}
              />
              <Button
                onClick={() => respondMutation.mutate({ show_cause_response: showCauseResponse })}
                disabled={respondMutation.isPending || !showCauseResponse.trim()}
              >
                Submit Response
              </Button>
            </div>
          )}

          {c.show_cause_response && (
            <div className="bg-gray-50 rounded-md p-4">
              <h4 className="font-semibold text-gray-900 text-sm">Your Show Cause Response</h4>
              <p className="text-sm text-gray-700 mt-2">{c.show_cause_response}</p>
              <p className="text-xs text-gray-400 mt-1">Submitted on {formatDate(c.show_cause_response_date)}</p>
            </div>
          )}

          {/* Actions Taken */}
          {c.actions && c.actions.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Actions Taken</h4>
              <div className="space-y-2">
                {c.actions.map((a: DisciplinaryAction) => (
                  <div key={a.id} className="flex items-start justify-between border-l-2 border-primary-300 pl-3 py-2">
                    <div>
                      <span className="text-sm font-medium">{a.action_type_display}</span>
                      <span className="text-sm text-gray-500 ml-2">{formatDate(a.action_date)}</span>
                      <p className="text-sm text-gray-600 mt-0.5">{a.description}</p>
                    </div>
                    {a.acknowledged_by_employee ? (
                      <Badge variant="success" size="xs"><CheckIcon className="h-3 w-3 mr-1" />Acknowledged</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => acknowledgeMutation.mutate(a.id)}
                        disabled={acknowledgeMutation.isPending}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hearings */}
          {c.hearings && c.hearings.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Hearing Schedule</h4>
              <div className="space-y-2">
                {c.hearings.map((h) => (
                  <div key={h.id} className="bg-info-50 rounded-md p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Hearing #{h.hearing_number}</span>
                      <Badge variant={h.status === 'COMPLETED' ? 'success' : 'info'} size="xs">{h.status_display}</Badge>
                    </div>
                    <p className="text-gray-600 mt-1">{formatDate(h.scheduled_date)} at {h.scheduled_time} - {h.location}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decision */}
          {c.final_decision && (
            <div className="bg-danger-50 border border-danger-200 rounded-md p-4">
              <h4 className="font-semibold text-danger-800">Decision</h4>
              <p className="text-sm text-danger-700 mt-2">{c.final_decision}</p>
              <p className="text-xs text-danger-500 mt-1">Issued on {formatDate(c.decision_date)} by {c.decision_by_name}</p>
            </div>
          )}

          {/* Appeal Section */}
          {c.appeals && c.appeals.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Appeals</h4>
              {c.appeals.map((a) => (
                <div key={a.id} className="border border-gray-300 rounded-md p-3 text-sm mb-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Appeal #{a.appeal_number}</span>
                    <Badge variant={a.status === 'UPHELD' ? 'success' : a.status === 'DISMISSED' ? 'danger' : 'warning'} size="xs">{a.status_display}</Badge>
                  </div>
                  <p className="text-gray-600 mt-1">{a.grounds_for_appeal}</p>
                  {a.decision && <p className="text-gray-700 mt-2 font-medium">Decision: {a.decision}</p>}
                </div>
              ))}
            </div>
          )}

          {/* File Appeal */}
          {c.status === 'DECISION_ISSUED' && (
            <div>
              {!showAppealForm ? (
                <Button variant="secondary" onClick={() => setShowAppealForm(true)}>
                  File Appeal
                </Button>
              ) : (
                <div className="bg-gray-50 rounded-md p-4 space-y-3">
                  <h4 className="font-semibold text-gray-900">File an Appeal</h4>
                  <Textarea
                    label="Grounds for Appeal"
                    placeholder="Explain your grounds for appeal..."
                    value={appealGrounds}
                    onChange={(e) => setAppealGrounds(e.target.value)}
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleFileAppeal} disabled={appealMutation.isPending || !appealGrounds.trim()}>
                      Submit Appeal
                    </Button>
                    <Button variant="secondary" onClick={() => setShowAppealForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
