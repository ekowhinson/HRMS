import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ExclamationTriangleIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline'
import { Card, CardContent, StatCard } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Modal from '@/components/ui/Modal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import api from '@/lib/api'
import {
  disciplineService,
  type DisciplinaryCase,
  type MisconductCategory,
  type DisciplinaryHearing,
} from '@/services/discipline'

// Badge color mappings
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

const severityVariant = (s: string): 'default' | 'info' | 'warning' | 'danger' => {
  const map: Record<string, 'info' | 'warning' | 'danger'> = {
    MINOR: 'info', MODERATE: 'warning', MAJOR: 'danger', GROSS: 'danger',
  }
  return map[s] || 'default'
}

const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'
const formatStatus = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export default function DisciplinaryPage() {
  const [activeTab, setActiveTab] = useState('cases')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Disciplinary Cases</h1>
          <p className="text-sm text-gray-500 mt-1">Manage disciplinary cases, hearings, and misconduct categories</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="hearings">Hearings</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="cases"><CasesTab /></TabsContent>
        <TabsContent value="hearings"><HearingsTab /></TabsContent>
        <TabsContent value="categories"><CategoriesTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// ── Cases Tab ─────────────────────────────────────────────────

function CasesTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionModal, setActionModal] = useState<{ type: string; caseId: string } | null>(null)
  const [actionText, setActionText] = useState('')

  const { data: stats } = useQuery({ queryKey: ['disciplinary-stats'], queryFn: disciplineService.getCaseStats })
  const { data: casesData, isLoading } = useQuery({
    queryKey: ['disciplinary-cases', statusFilter, severityFilter, search],
    queryFn: () => disciplineService.getCases({
      ...(statusFilter && { status: statusFilter }),
      ...(severityFilter && { misconduct_category__severity: severityFilter }),
      ...(search && { search }),
    }),
  })
  const { data: categories } = useQuery({ queryKey: ['misconduct-categories'], queryFn: disciplineService.getMisconductCategories })
  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => {
      const res = await api.get('/employees/', { params: { page_size: 1000 } })
      return res.data.results || res.data || []
    },
  })

  const cases = useMemo(() => {
    if (!casesData) return []
    return Array.isArray(casesData) ? casesData : casesData.results || []
  }, [casesData])

  // Status action mutations
  const statusMutation = useMutation({
    mutationFn: async ({ type, id, data }: { type: string; id: string; data?: any }) => {
      switch (type) {
        case 'submit': return disciplineService.submitCase(id)
        case 'investigate': return disciplineService.investigateCase(id, data)
        case 'issue_show_cause': return disciplineService.issueShowCause(id)
        case 'schedule_hearing': return disciplineService.scheduleHearing(id)
        case 'complete_hearing': return disciplineService.completeHearing(id)
        case 'issue_decision': return disciplineService.issueDecision(id, data)
        case 'close': return disciplineService.closeCase(id, data)
        case 'withdraw': return disciplineService.withdrawCase(id, data)
        default: throw new Error('Unknown action')
      }
    },
    onSuccess: () => {
      toast.success('Case updated successfully')
      queryClient.invalidateQueries({ queryKey: ['disciplinary-cases'] })
      queryClient.invalidateQueries({ queryKey: ['disciplinary-stats'] })
      setActionModal(null)
      setActionText('')
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to update case'),
  })

  const handleStatusAction = (type: string, caseId: string) => {
    if (['issue_decision', 'close', 'withdraw'].includes(type)) {
      setActionModal({ type, caseId })
    } else {
      statusMutation.mutate({ type, id: caseId })
    }
  }

  const confirmAction = () => {
    if (!actionModal) return
    const data: any = {}
    if (actionModal.type === 'issue_decision') data.final_decision = actionText
    if (actionModal.type === 'close') data.closure_notes = actionText
    if (actionModal.type === 'withdraw') data.closure_notes = actionText
    statusMutation.mutate({ type: actionModal.type, id: actionModal.caseId, data })
  }

  const getActions = (c: DisciplinaryCase) => {
    const actions: { label: string; type: string }[] = []
    switch (c.status) {
      case 'DRAFT': actions.push({ label: 'Submit', type: 'submit' }); break
      case 'REPORTED': actions.push({ label: 'Investigate', type: 'investigate' }); break
      case 'UNDER_INVESTIGATION': actions.push({ label: 'Issue Show Cause', type: 'issue_show_cause' }); break
      case 'SHOW_CAUSE_RECEIVED': actions.push({ label: 'Schedule Hearing', type: 'schedule_hearing' }); break
      case 'HEARING_SCHEDULED': actions.push({ label: 'Complete Hearing', type: 'complete_hearing' }); break
      case 'HEARING_COMPLETED': actions.push({ label: 'Issue Decision', type: 'issue_decision' }); break
      case 'DECISION_ISSUED': actions.push({ label: 'Close', type: 'close' }); break
    }
    if (!['CLOSED', 'WITHDRAWN'].includes(c.status)) {
      actions.push({ label: 'Withdraw', type: 'withdraw' })
    }
    return actions
  }

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'DRAFT', label: 'Draft' }, { value: 'REPORTED', label: 'Reported' },
    { value: 'UNDER_INVESTIGATION', label: 'Under Investigation' },
    { value: 'SHOW_CAUSE_ISSUED', label: 'Show Cause Issued' },
    { value: 'HEARING_SCHEDULED', label: 'Hearing Scheduled' },
    { value: 'DECISION_ISSUED', label: 'Decision Issued' },
    { value: 'CLOSED', label: 'Closed' }, { value: 'WITHDRAWN', label: 'Withdrawn' },
  ]

  const severityOptions = [
    { value: '', label: 'All Severities' },
    { value: 'MINOR', label: 'Minor' }, { value: 'MODERATE', label: 'Moderate' },
    { value: 'MAJOR', label: 'Major' }, { value: 'GROSS', label: 'Gross' },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Cases" value={stats?.total ?? 0} variant="primary" icon={<ScaleIcon className="h-6 w-6" />} />
        <StatCard title="Open Cases" value={stats?.open ?? 0} variant="warning" icon={<ExclamationTriangleIcon className="h-6 w-6" />} />
        <StatCard title="Minor/Moderate" value={(stats?.by_severity?.MINOR ?? 0) + (stats?.by_severity?.MODERATE ?? 0)} variant="info" />
        <StatCard title="Major/Gross" value={(stats?.by_severity?.MAJOR ?? 0) + (stats?.by_severity?.GROSS ?? 0)} variant="danger" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by case number or employee..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <Select options={statusOptions} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
            <Select options={severityOptions} value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} />
            <Button onClick={() => setShowCreateModal(true)}>
              <PlusIcon className="h-4 w-4 mr-1" /> New Case
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Case #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reported</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
              ) : cases.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">No cases found</td></tr>
              ) : cases.map((c: DisciplinaryCase) => (
                <CaseRow
                  key={c.id}
                  c={c}
                  expanded={expandedId === c.id}
                  onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  onAction={(type) => handleStatusAction(type, c.id)}
                  getActions={getActions}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Case Modal */}
      <CreateCaseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        categories={categories || []}
        employees={employees || []}
      />

      {/* Action Confirm Modal */}
      <Modal isOpen={!!actionModal} onClose={() => setActionModal(null)} title={actionModal ? formatStatus(actionModal.type) : ''}>
        <div className="space-y-4">
          <Textarea
            label={actionModal?.type === 'issue_decision' ? 'Decision' : 'Notes'}
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setActionModal(null)}>Cancel</Button>
            <Button onClick={confirmAction} disabled={statusMutation.isPending}>Confirm</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function CaseRow({ c, expanded, onToggle, onAction, getActions }: {
  c: DisciplinaryCase
  expanded: boolean
  onToggle: () => void
  onAction: (type: string) => void
  getActions: (c: DisciplinaryCase) => { label: string; type: string }[]
}) {
  const { data: detail } = useQuery({
    queryKey: ['disciplinary-case', c.id],
    queryFn: () => disciplineService.getCase(c.id),
    enabled: expanded,
  })

  const actions = getActions(c)

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600">{c.case_number}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          <div>{c.employee_name}</div>
          <div className="text-xs text-gray-500">{c.employee_number}</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{c.category_name}</td>
        <td className="px-6 py-4 whitespace-nowrap">
          <Badge variant={severityVariant(c.severity)} size="xs">{c.severity}</Badge>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <Badge variant={statusVariant(c.status)} size="xs" dot>{formatStatus(c.status)}</Badge>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(c.reported_date)}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm">
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {actions.slice(0, 2).map((a) => (
              <button
                key={a.type}
                onClick={() => onAction(a.type)}
                className="px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded"
              >
                {a.label}
              </button>
            ))}
            {expanded ? <ChevronUpIcon className="h-4 w-4 text-gray-400" /> : <ChevronDownIcon className="h-4 w-4 text-gray-400" />}
          </div>
        </td>
      </tr>
      {expanded && detail && (
        <tr>
          <td colSpan={7} className="px-6 py-4 bg-gray-50">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Incident Details</h4>
                <div className="text-sm space-y-2">
                  <p><span className="text-gray-500">Date:</span> {formatDate(detail.incident_date)}</p>
                  <p><span className="text-gray-500">Location:</span> {detail.incident_location || '-'}</p>
                  <p><span className="text-gray-500">Description:</span> {detail.incident_description}</p>
                  <p><span className="text-gray-500">Reported by:</span> {detail.reported_by_name || '-'}</p>
                  {detail.assigned_investigator && <p><span className="text-gray-500">Investigator:</span> {detail.investigator_name}</p>}
                </div>

                {detail.show_cause_response && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mt-4">Show Cause Response</h4>
                    <p className="text-sm text-gray-700 mt-1">{detail.show_cause_response}</p>
                  </div>
                )}

                {detail.final_decision && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mt-4">Decision</h4>
                    <p className="text-sm text-gray-700 mt-1">{detail.final_decision}</p>
                    <p className="text-xs text-gray-500 mt-1">By {detail.decision_by_name} on {formatDate(detail.decision_date)}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {detail.actions && detail.actions.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900">Actions Taken</h4>
                    <div className="mt-2 space-y-2">
                      {detail.actions.map((a) => (
                        <div key={a.id} className="flex items-start gap-2 text-sm border-l-2 border-primary-300 pl-3">
                          <div>
                            <span className="font-medium">{a.action_type_display}</span>
                            <span className="text-gray-500 ml-2">{formatDate(a.action_date)}</span>
                            <p className="text-gray-600">{a.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detail.hearings && detail.hearings.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900">Hearings</h4>
                    <div className="mt-2 space-y-2">
                      {detail.hearings.map((h) => (
                        <div key={h.id} className="text-sm border-l-2 border-info-300 pl-3">
                          <span className="font-medium">Hearing #{h.hearing_number}</span>
                          <span className="text-gray-500 ml-2">{formatDate(h.scheduled_date)} at {h.scheduled_time}</span>
                          <Badge variant={h.status === 'COMPLETED' ? 'success' : 'info'} size="xs" className="ml-2">{h.status_display}</Badge>
                          <p className="text-gray-600">{h.location}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detail.evidence && detail.evidence.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900">Evidence</h4>
                    <div className="mt-2 space-y-1">
                      {detail.evidence.map((e) => (
                        <div key={e.id} className="flex items-center gap-2 text-sm">
                          <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                          <span>{e.title}</span>
                          <Badge size="xs">{e.evidence_type_display}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detail.appeals && detail.appeals.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900">Appeals</h4>
                    <div className="mt-2 space-y-2">
                      {detail.appeals.map((a) => (
                        <div key={a.id} className="text-sm border-l-2 border-warning-300 pl-3">
                          <span className="font-medium">Appeal #{a.appeal_number}</span>
                          <Badge variant={a.status === 'UPHELD' ? 'success' : a.status === 'DISMISSED' ? 'danger' : 'warning'} size="xs" className="ml-2">{a.status_display}</Badge>
                          <p className="text-gray-600 mt-1">{a.grounds_for_appeal}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function CreateCaseModal({ isOpen, onClose, categories, employees }: {
  isOpen: boolean
  onClose: () => void
  categories: MisconductCategory[]
  employees: any[]
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    employee: '', misconduct_category: '', incident_date: '', incident_location: '', incident_description: '', reported_date: '',
  })

  const mutation = useMutation({
    mutationFn: (data: any) => disciplineService.createCase(data),
    onSuccess: () => {
      toast.success('Case created successfully')
      queryClient.invalidateQueries({ queryKey: ['disciplinary-cases'] })
      queryClient.invalidateQueries({ queryKey: ['disciplinary-stats'] })
      onClose()
      setForm({ employee: '', misconduct_category: '', incident_date: '', incident_location: '', incident_description: '', reported_date: '' })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to create case'),
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Disciplinary Case" size="lg">
      <div className="space-y-4">
        <Select
          label="Employee"
          options={[{ value: '', label: 'Select employee...' }, ...employees.map((e: any) => ({ value: e.id, label: `${e.first_name} ${e.last_name} (${e.employee_number})` }))]}
          value={form.employee}
          onChange={(e) => setForm({ ...form, employee: e.target.value })}
        />
        <Select
          label="Misconduct Category"
          options={[{ value: '', label: 'Select category...' }, ...categories.filter(c => c.is_active).map(c => ({ value: c.id, label: `${c.name} (${c.severity})` }))]}
          value={form.misconduct_category}
          onChange={(e) => setForm({ ...form, misconduct_category: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Incident Date" type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} />
          <Input label="Reported Date" type="date" value={form.reported_date} onChange={(e) => setForm({ ...form, reported_date: e.target.value })} />
        </div>
        <Input label="Incident Location" value={form.incident_location} onChange={(e) => setForm({ ...form, incident_location: e.target.value })} />
        <Textarea label="Incident Description" value={form.incident_description} onChange={(e) => setForm({ ...form, incident_description: e.target.value })} rows={4} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.employee || !form.misconduct_category || !form.incident_date || !form.incident_description}>
            Create Case
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Hearings Tab ──────────────────────────────────────────────

function HearingsTab() {
  const { data: hearingsData, isLoading } = useQuery({
    queryKey: ['disciplinary-hearings'],
    queryFn: async () => {
      const res = await api.get('/discipline/hearings/')
      return Array.isArray(res.data) ? res.data : res.data.results || []
    },
  })

  const hearings = hearingsData || []

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hearing #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Case</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Members</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
            ) : hearings.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">No hearings found</td></tr>
            ) : hearings.map((h: DisciplinaryHearing) => (
              <tr key={h.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">#{h.hearing_number}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{h.case}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDate(h.scheduled_date)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{h.scheduled_time}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{h.location}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={h.status === 'COMPLETED' ? 'success' : h.status === 'CANCELLED' ? 'danger' : 'info'} size="xs" dot>
                    {h.status_display}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{h.committee_members?.length || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Categories Tab ────────────────────────────────────────────

function CategoriesTab() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<MisconductCategory | null>(null)
  const [form, setForm] = useState({ code: '', name: '', description: '', severity: 'MINOR', recommended_action: '', is_active: true })

  const { data: categories, isLoading } = useQuery({ queryKey: ['misconduct-categories'], queryFn: disciplineService.getMisconductCategories })

  const saveMutation = useMutation({
    mutationFn: (data: any) => editing
      ? disciplineService.updateMisconductCategory(editing.id, data)
      : disciplineService.createMisconductCategory(data),
    onSuccess: () => {
      toast.success(editing ? 'Category updated' : 'Category created')
      queryClient.invalidateQueries({ queryKey: ['misconduct-categories'] })
      closeModal()
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to save'),
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ code: '', name: '', description: '', severity: 'MINOR', recommended_action: '', is_active: true })
    setShowModal(true)
  }

  const openEdit = (cat: MisconductCategory) => {
    setEditing(cat)
    setForm({ code: cat.code, name: cat.name, description: cat.description, severity: cat.severity, recommended_action: cat.recommended_action, is_active: cat.is_active })
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditing(null) }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><PlusIcon className="h-4 w-4 mr-1" /> New Category</Button>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
              ) : (categories || []).map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{cat.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cat.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><Badge variant={severityVariant(cat.severity)} size="xs">{cat.severity}</Badge></td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{cat.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={cat.is_active ? 'success' : 'default'} size="xs">{cat.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button onClick={() => openEdit(cat)} className="text-sm text-primary-600 hover:underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Category' : 'New Misconduct Category'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <Select
              label="Severity"
              options={[{ value: 'MINOR', label: 'Minor' }, { value: 'MODERATE', label: 'Moderate' }, { value: 'MAJOR', label: 'Major' }, { value: 'GROSS', label: 'Gross' }]}
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
            />
          </div>
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          <Textarea label="Recommended Action" value={form.recommended_action} onChange={(e) => setForm({ ...form, recommended_action: e.target.value })} rows={2} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded border-gray-300 text-primary-600" />
            Active
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.code || !form.name}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
