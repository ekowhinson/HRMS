import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ChatBubbleLeftRightIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PaperClipIcon,
  ArrowUpIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline'
import { Card, CardContent, StatCard } from '@/components/ui/Card'
import { TablePagination } from '@/components/ui/Table'
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
  type Grievance,
  type GrievanceCategory,
  type GrievanceNote,
  type MisconductCategory,
} from '@/services/discipline'

const statusVariant = (s: string): 'default' | 'info' | 'warning' | 'danger' | 'success' => {
  const map: Record<string, 'default' | 'info' | 'warning' | 'danger' | 'success'> = {
    DRAFT: 'default', SUBMITTED: 'info', ACKNOWLEDGED: 'info',
    UNDER_INVESTIGATION: 'warning', MEDIATION: 'warning',
    PENDING_RESOLUTION: 'warning', ESCALATED: 'danger',
    RESOLVED: 'success', CLOSED: 'success', WITHDRAWN: 'default',
  }
  return map[s] || 'default'
}

const priorityVariant = (p: string): 'default' | 'info' | 'warning' | 'danger' => {
  const map: Record<string, 'default' | 'info' | 'warning' | 'danger'> = {
    LOW: 'default', MEDIUM: 'info', HIGH: 'warning', URGENT: 'danger',
  }
  return map[p] || 'default'
}

const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'
const formatStatus = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export default function GrievancePage() {
  const [activeTab, setActiveTab] = useState('active')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Grievances</h1>
        <p className="text-sm text-gray-500 mt-1">Manage employee grievances, resolutions, and categories</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">Active Grievances</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="active"><GrievanceListTab statusFilter="active" /></TabsContent>
        <TabsContent value="resolved"><GrievanceListTab statusFilter="resolved" /></TabsContent>
        <TabsContent value="categories"><GrievanceCategoriesTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// ── Grievance List Tab ────────────────────────────────────────

function GrievanceListTab({ statusFilter }: { statusFilter: 'active' | 'resolved' }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionModal, setActionModal] = useState<{ type: string; grievanceId: string } | null>(null)
  const [actionText, setActionText] = useState('')
  const [convertModal, setConvertModal] = useState<Grievance | null>(null)

  const closedStatuses = ['RESOLVED', 'CLOSED', 'WITHDRAWN']

  const { data: stats } = useQuery({ queryKey: ['grievance-stats'], queryFn: disciplineService.getGrievanceStats })

  const { data: grievancesData, isLoading } = useQuery({
    queryKey: ['grievances', priorityFilter, categoryFilter, search],
    queryFn: () => disciplineService.getGrievances({
      ...(priorityFilter && { priority: priorityFilter }),
      ...(categoryFilter && { category: categoryFilter }),
      ...(search && { search }),
    }),
  })

  const { data: categories } = useQuery({ queryKey: ['grievance-categories'], queryFn: disciplineService.getGrievanceCategories })
  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => {
      const res = await api.get('/employees/', { params: { page_size: 1000 } })
      return res.data.results || res.data || []
    },
  })

  const allGrievances = useMemo(() => {
    if (!grievancesData) return []
    return Array.isArray(grievancesData) ? grievancesData : grievancesData.results || []
  }, [grievancesData])

  const grievances = useMemo(() => {
    return allGrievances.filter((g: Grievance) =>
      statusFilter === 'resolved' ? closedStatuses.includes(g.status) : !closedStatuses.includes(g.status)
    )
  }, [allGrievances, statusFilter])

  const statusMutation = useMutation({
    mutationFn: async ({ type, id, data }: { type: string; id: string; data?: any }) => {
      switch (type) {
        case 'submit': return disciplineService.submitGrievance(id)
        case 'acknowledge': return disciplineService.acknowledgeGrievance(id)
        case 'investigate': return disciplineService.investigateGrievance(id, data)
        case 'escalate': return disciplineService.escalateGrievance(id, data || {})
        case 'resolve': return disciplineService.resolveGrievance(id, data)
        case 'close': return disciplineService.closeGrievance(id)
        default: throw new Error('Unknown action')
      }
    },
    onSuccess: () => {
      toast.success('Grievance updated successfully')
      queryClient.invalidateQueries({ queryKey: ['grievances'] })
      queryClient.invalidateQueries({ queryKey: ['grievance-stats'] })
      setActionModal(null)
      setActionText('')
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to update'),
  })

  const noteMutation = useMutation({
    mutationFn: ({ id, note, is_internal }: { id: string; note: string; is_internal: boolean }) =>
      disciplineService.addGrievanceNote(id, { note, is_internal }),
    onSuccess: () => {
      toast.success('Note added')
      queryClient.invalidateQueries({ queryKey: ['grievance-detail'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to add note'),
  })

  const handleAction = (type: string, id: string) => {
    if (['resolve', 'escalate'].includes(type)) {
      setActionModal({ type, grievanceId: id })
    } else {
      statusMutation.mutate({ type, id })
    }
  }

  const confirmAction = () => {
    if (!actionModal) return
    const data: any = {}
    if (actionModal.type === 'resolve') data.resolution = actionText
    if (actionModal.type === 'escalate') data.escalation_reason = actionText
    statusMutation.mutate({ type: actionModal.type, id: actionModal.grievanceId, data })
  }

  const getActions = (g: Grievance) => {
    const actions: { label: string; type: string }[] = []
    switch (g.status) {
      case 'DRAFT': actions.push({ label: 'Submit', type: 'submit' }); break
      case 'SUBMITTED': actions.push({ label: 'Acknowledge', type: 'acknowledge' }); break
      case 'ACKNOWLEDGED': actions.push({ label: 'Investigate', type: 'investigate' }); break
      case 'UNDER_INVESTIGATION':
        actions.push({ label: 'Resolve', type: 'resolve' })
        actions.push({ label: 'Escalate', type: 'escalate' })
        break
      case 'ESCALATED':
        actions.push({ label: 'Resolve', type: 'resolve' })
        break
    }
    if (!closedStatuses.includes(g.status) && g.status !== 'DRAFT') {
      actions.push({ label: 'Close', type: 'close' })
    }
    return actions
  }

  const priorityOptions = [
    { value: '', label: 'All Priorities' },
    { value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' }, { value: 'URGENT', label: 'Urgent' },
  ]

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...(categories || []).map(c => ({ value: c.id, label: c.name })),
  ]

  return (
    <div className="space-y-6">
      {statusFilter === 'active' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Grievances" value={stats?.total ?? 0} variant="primary" icon={<ChatBubbleLeftRightIcon className="h-6 w-6" />} />
          <StatCard title="Open" value={stats?.open ?? 0} variant="warning" />
          <StatCard title="High/Urgent" value={(stats?.by_priority?.HIGH ?? 0) + (stats?.by_priority?.URGENT ?? 0)} variant="danger" />
          <StatCard title="Low/Medium" value={(stats?.by_priority?.LOW ?? 0) + (stats?.by_priority?.MEDIUM ?? 0)} variant="info" />
        </div>
      )}

      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by number, subject, or employee..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <Select options={priorityOptions} value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1) }} />
            <Select options={categoryOptions} value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1) }} />
            {statusFilter === 'active' && (
              <Button onClick={() => setShowCreateModal(true)}>
                <PlusIcon className="h-4 w-4 mr-1" /> New Grievance
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grievance #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
              ) : grievances.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">No grievances found</td></tr>
              ) : grievances.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((g: Grievance) => (
                <GrievanceRow
                  key={g.id}
                  g={g}
                  expanded={expandedId === g.id}
                  onToggle={() => setExpandedId(expandedId === g.id ? null : g.id)}
                  onAction={(type) => handleAction(type, g.id)}
                  getActions={getActions}
                  onAddNote={(note, internal) => noteMutation.mutate({ id: g.id, note, is_internal: internal })}
                  onConvert={() => setConvertModal(g)}
                />
              ))}
            </tbody>
          </table>
        </div>
        {grievances.length > pageSize && (
          <TablePagination
            currentPage={currentPage}
            totalPages={Math.ceil(grievances.length / pageSize)}
            totalItems={grievances.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        )}
      </Card>

      <CreateGrievanceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        categories={categories || []}
        employees={employees || []}
      />

      <Modal isOpen={!!actionModal} onClose={() => setActionModal(null)} title={actionModal ? formatStatus(actionModal.type) : ''}>
        <div className="space-y-4">
          <Textarea
            label={actionModal?.type === 'resolve' ? 'Resolution' : 'Reason'}
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

      {convertModal && (
        <ConvertToDisciplinaryModal
          grievance={convertModal}
          isOpen={!!convertModal}
          onClose={() => setConvertModal(null)}
        />
      )}
    </div>
  )
}

function GrievanceRow({ g, expanded, onToggle, onAction, getActions, onAddNote, onConvert }: {
  g: Grievance
  expanded: boolean
  onToggle: () => void
  onAction: (type: string) => void
  getActions: (g: Grievance) => { label: string; type: string }[]
  onAddNote: (note: string, internal: boolean) => void
  onConvert: () => void
}) {
  const { data: detail } = useQuery({
    queryKey: ['grievance-detail', g.id],
    queryFn: () => disciplineService.getGrievance(g.id),
    enabled: expanded,
  })
  const [noteText, setNoteText] = useState('')
  const [noteInternal, setNoteInternal] = useState(false)

  const actions = getActions(g)

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600">{g.grievance_number}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{g.employee_name}</td>
        <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{g.subject}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{g.category_name}</td>
        <td className="px-6 py-4 whitespace-nowrap">
          <Badge variant={priorityVariant(g.priority)} size="xs">{g.priority}</Badge>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <Badge variant={statusVariant(g.status)} size="xs" dot>{formatStatus(g.status)}</Badge>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(g.submitted_date)}</td>
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
          <td colSpan={8} className="px-6 py-4 bg-gray-50">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Grievance Details</h4>
                <div className="text-sm space-y-2">
                  <p><span className="text-gray-500">Description:</span> {detail.description}</p>
                  {detail.incident_date && <p><span className="text-gray-500">Incident Date:</span> {formatDate(detail.incident_date)}</p>}
                  {detail.against_employee_name && <p><span className="text-gray-500">Against:</span> {detail.against_employee_name}</p>}
                  {detail.against_department_name && <p><span className="text-gray-500">Department:</span> {detail.against_department_name}</p>}
                  {detail.desired_outcome && <p><span className="text-gray-500">Desired Outcome:</span> {detail.desired_outcome}</p>}
                  {detail.assigned_to_name && <p><span className="text-gray-500">Assigned To:</span> {detail.assigned_to_name}</p>}
                  {detail.escalation_level > 0 && (
                    <div className="flex items-center gap-2">
                      <ArrowUpIcon className="h-4 w-4 text-danger-500" />
                      <span className="text-danger-600 font-medium">Escalation Level {detail.escalation_level}</span>
                      {detail.escalated_to_name && <span className="text-gray-500">to {detail.escalated_to_name}</span>}
                    </div>
                  )}
                </div>

                {detail.resolution && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mt-4">Resolution</h4>
                    <p className="text-sm text-gray-700 mt-1">{detail.resolution}</p>
                    {detail.resolution_accepted !== null && (
                      <Badge variant={detail.resolution_accepted ? 'success' : 'danger'} size="xs" className="mt-2">
                        {detail.resolution_accepted ? 'Accepted by Employee' : 'Rejected by Employee'}
                      </Badge>
                    )}
                    {detail.resolution_feedback && (
                      <p className="text-sm text-gray-500 mt-1">Feedback: {detail.resolution_feedback}</p>
                    )}
                  </div>
                )}

                {/* Resulting Cases */}
                {detail.resulting_cases && detail.resulting_cases.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold text-gray-900">Resulting Disciplinary Cases</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {detail.resulting_cases.map((rc) => (
                        <Badge key={rc.id} variant="danger" size="xs">
                          {rc.case_number}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Convert to Disciplinary */}
                {!['CLOSED', 'WITHDRAWN', 'RESOLVED'].includes(detail.status) &&
                  (detail.against_employee || detail.against_manager) && (
                  <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                    <Button variant="danger" size="sm" onClick={onConvert}>
                      <ScaleIcon className="h-4 w-4 mr-1" /> Convert to Disciplinary
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {/* Notes */}
                <h4 className="font-semibold text-gray-900">Notes</h4>
                {detail.notes && detail.notes.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {detail.notes.map((n: GrievanceNote) => (
                      <div key={n.id} className={`text-sm p-2 rounded ${n.is_internal ? 'bg-warning-50 border border-warning-200' : 'bg-white border border-gray-200'}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{n.added_by_name}</span>
                          <span className="text-xs text-gray-400">{formatDate(n.created_at)}</span>
                        </div>
                        <p className="text-gray-600 mt-1">{n.note}</p>
                        {n.is_internal && <Badge size="xs" variant="warning" className="mt-1">Internal</Badge>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No notes yet</p>
                )}

                {/* Add Note */}
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    placeholder="Add a note..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                    rows={2}
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-gray-500">
                      <input type="checkbox" checked={noteInternal} onChange={(e) => setNoteInternal(e.target.checked)} className="rounded border-gray-300 text-primary-600" />
                      Internal note
                    </label>
                    <Button
                      size="sm"
                      onClick={() => { onAddNote(noteText, noteInternal); setNoteText(''); setNoteInternal(false) }}
                      disabled={!noteText.trim()}
                    >
                      Add Note
                    </Button>
                  </div>
                </div>

                {/* Attachments */}
                {detail.attachments && detail.attachments.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900">Attachments</h4>
                    <div className="mt-2 space-y-1">
                      {detail.attachments.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 text-sm">
                          <PaperClipIcon className="h-4 w-4 text-gray-400" />
                          <span>{a.title}</span>
                          {a.file_name && <span className="text-xs text-gray-400">({a.file_name})</span>}
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

function ConvertToDisciplinaryModal({ grievance, isOpen, onClose }: {
  grievance: Grievance
  isOpen: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [selectedCategory, setSelectedCategory] = useState('')

  const { data: misconductCategories } = useQuery({
    queryKey: ['misconduct-categories'],
    queryFn: disciplineService.getMisconductCategories,
  })

  const involvedEmployees: string[] = []
  if (grievance.against_employee_name) involvedEmployees.push(grievance.against_employee_name)
  if (grievance.against_manager_name &&
      grievance.against_manager_name !== grievance.against_employee_name) {
    involvedEmployees.push(grievance.against_manager_name)
  }

  const mutation = useMutation({
    mutationFn: () => disciplineService.convertToDisciplinary(grievance.id, { misconduct_category: selectedCategory }),
    onSuccess: (data) => {
      const caseNumbers = data.cases.map(c => c.case_number).join(', ')
      toast.success(`Created disciplinary case(s): ${caseNumbers}`)
      queryClient.invalidateQueries({ queryKey: ['grievances'] })
      queryClient.invalidateQueries({ queryKey: ['grievance-stats'] })
      queryClient.invalidateQueries({ queryKey: ['grievance-detail'] })
      queryClient.invalidateQueries({ queryKey: ['discipline-cases'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to convert'),
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Convert to Disciplinary Case">
      <div className="space-y-4">
        <div className="bg-warning-50 border border-warning-200 rounded-md p-3">
          <p className="text-sm text-warning-800 font-medium">
            This will create a separate disciplinary case for each involved employee and close this grievance.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Employees involved:</h4>
          <div className="flex flex-wrap gap-2">
            {involvedEmployees.map((name) => (
              <Badge key={name} variant="info" size="xs">{name}</Badge>
            ))}
          </div>
        </div>

        <Select
          label="Misconduct Category"
          options={[
            { value: '', label: 'Select misconduct category...' },
            ...(misconductCategories || []).filter((c: MisconductCategory) => c.is_active).map((c: MisconductCategory) => ({
              value: c.id,
              label: `${c.name} (${c.severity})`,
            })),
          ]}
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !selectedCategory}
          >
            {mutation.isPending ? 'Converting...' : 'Convert'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function CreateGrievanceModal({ isOpen, onClose, categories, employees }: {
  isOpen: boolean
  onClose: () => void
  categories: GrievanceCategory[]
  employees: any[]
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    employee: '', category: '', subject: '', description: '',
    incident_date: '', desired_outcome: '', against_employee: '', priority: 'MEDIUM',
  })

  const mutation = useMutation({
    mutationFn: (data: any) => disciplineService.createGrievance(data),
    onSuccess: () => {
      toast.success('Grievance created successfully')
      queryClient.invalidateQueries({ queryKey: ['grievances'] })
      queryClient.invalidateQueries({ queryKey: ['grievance-stats'] })
      onClose()
      setForm({ employee: '', category: '', subject: '', description: '', incident_date: '', desired_outcome: '', against_employee: '', priority: 'MEDIUM' })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to create grievance'),
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Grievance" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Employee"
            options={[{ value: '', label: 'Select employee...' }, ...employees.map((e: any) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))]}
            value={form.employee}
            onChange={(e) => setForm({ ...form, employee: e.target.value })}
          />
          <Select
            label="Category"
            options={[{ value: '', label: 'Select category...' }, ...categories.filter(c => c.is_active).map(c => ({ value: c.id, label: c.name }))]}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </div>
        <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Incident Date" type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} />
          <Select
            label="Priority"
            options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'URGENT', label: 'Urgent' }]}
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          />
        </div>
        <Select
          label="Against Employee (optional)"
          options={[{ value: '', label: 'None' }, ...employees.map((e: any) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))]}
          value={form.against_employee}
          onChange={(e) => setForm({ ...form, against_employee: e.target.value })}
        />
        <Textarea label="Desired Outcome" value={form.desired_outcome} onChange={(e) => setForm({ ...form, desired_outcome: e.target.value })} rows={2} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.employee || !form.category || !form.subject || !form.description}>
            Create Grievance
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Categories Tab ────────────────────────────────────────────

function GrievanceCategoriesTab() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<GrievanceCategory | null>(null)
  const [form, setForm] = useState({ code: '', name: '', description: '', is_active: true })
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const { data: categories, isLoading } = useQuery({ queryKey: ['grievance-categories'], queryFn: disciplineService.getGrievanceCategories })

  const saveMutation = useMutation({
    mutationFn: (data: any) => editing
      ? disciplineService.updateGrievanceCategory(editing.id, data)
      : disciplineService.createGrievanceCategory(data),
    onSuccess: () => {
      toast.success(editing ? 'Category updated' : 'Category created')
      queryClient.invalidateQueries({ queryKey: ['grievance-categories'] })
      closeModal()
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to save'),
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ code: '', name: '', description: '', is_active: true })
    setShowModal(true)
  }

  const openEdit = (cat: GrievanceCategory) => {
    setEditing(cat)
    setForm({ code: cat.code, name: cat.name, description: cat.description, is_active: cat.is_active })
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
              ) : (categories || []).slice((currentPage - 1) * pageSize, currentPage * pageSize).map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{cat.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cat.name}</td>
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
        {(categories || []).length > pageSize && (
          <TablePagination
            currentPage={currentPage}
            totalPages={Math.ceil((categories || []).length / pageSize)}
            totalItems={(categories || []).length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        )}
      </Card>

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Category' : 'New Grievance Category'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
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
