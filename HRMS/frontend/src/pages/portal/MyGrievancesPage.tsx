import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ChatBubbleLeftRightIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PaperClipIcon,
  ArrowUpIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { Card, CardContent, StatCard } from '@/components/ui/Card'
import { TablePagination } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Modal from '@/components/ui/Modal'
import api from '@/lib/api'
import {
  disciplineService,
  type Grievance,
  type GrievanceNote,
  type GrievanceCategory,
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

export default function MyGrievancesPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showFileModal, setShowFileModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const { data: grievances = [], isLoading } = useQuery({
    queryKey: ['my-grievances'],
    queryFn: disciplineService.getMyGrievances,
  })

  const { data: categories } = useQuery({ queryKey: ['grievance-categories'], queryFn: disciplineService.getGrievanceCategories })
  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => {
      const res = await api.get('/employees/', { params: { page_size: 1000 } })
      return res.data.results || res.data || []
    },
  })

  const openGrievances = grievances.filter((g: Grievance) => !['RESOLVED', 'CLOSED', 'WITHDRAWN'].includes(g.status))
  const resolvedGrievances = grievances.filter((g: Grievance) => g.status === 'RESOLVED' || g.status === 'CLOSED')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Grievances</h1>
          <p className="text-sm text-gray-500 mt-1">File grievances, track progress, and respond to resolutions</p>
        </div>
        <Button onClick={() => setShowFileModal(true)}>
          <PlusIcon className="h-4 w-4 mr-1" /> File Grievance
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Grievances" value={grievances.length} variant="primary" icon={<ChatBubbleLeftRightIcon className="h-6 w-6" />} />
        <StatCard title="Open" value={openGrievances.length} variant="warning" />
        <StatCard title="Resolved" value={resolvedGrievances.length} variant="success" />
      </div>

      {/* Grievances List */}
      {isLoading ? (
        <Card><CardContent><p className="text-center text-sm text-gray-500 py-8">Loading...</p></CardContent></Card>
      ) : grievances.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-300 mx-auto" />
              <p className="mt-4 text-gray-500">No grievances filed yet</p>
              <Button className="mt-4" onClick={() => setShowFileModal(true)}>
                <PlusIcon className="h-4 w-4 mr-1" /> File Your First Grievance
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {grievances.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((g: Grievance) => (
            <GrievanceCard
              key={g.id}
              g={g}
              expanded={expandedId === g.id}
              onToggle={() => setExpandedId(expandedId === g.id ? null : g.id)}
            />
          ))}
          {grievances.length > pageSize && (
            <TablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(grievances.length / pageSize)}
              totalItems={grievances.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}

      {/* File Grievance Modal */}
      <FileGrievanceModal
        isOpen={showFileModal}
        onClose={() => setShowFileModal(false)}
        categories={categories || []}
        employees={employees || []}
      />
    </div>
  )
}

function GrievanceCard({ g, expanded, onToggle }: {
  g: Grievance
  expanded: boolean
  onToggle: () => void
}) {
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState('')

  const acceptMutation = useMutation({
    mutationFn: (data: { feedback?: string }) => disciplineService.acceptResolution(g.id, data),
    onSuccess: () => {
      toast.success('Resolution accepted')
      queryClient.invalidateQueries({ queryKey: ['my-grievances'] })
      setFeedback('')
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed'),
  })

  const rejectMutation = useMutation({
    mutationFn: (data: { feedback?: string }) => disciplineService.rejectResolution(g.id, data),
    onSuccess: () => {
      toast.success('Resolution rejected - grievance re-opened')
      queryClient.invalidateQueries({ queryKey: ['my-grievances'] })
      setFeedback('')
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed'),
  })

  // Filter out internal notes
  const visibleNotes = (g.notes || []).filter((n: GrievanceNote) => !n.is_internal)

  return (
    <Card>
      <div className="px-6 py-4 cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-primary-600">{g.grievance_number}</span>
              <Badge variant={priorityVariant(g.priority)} size="xs">{g.priority}</Badge>
            </div>
            <p className="text-sm text-gray-900 mt-1 font-medium">{g.subject}</p>
            <p className="text-xs text-gray-500 mt-0.5">{g.category_name} - {formatDate(g.submitted_date)}</p>
          </div>
          <div className="flex items-center gap-3">
            {g.escalation_level > 0 && (
              <div className="flex items-center gap-1 text-danger-600">
                <ArrowUpIcon className="h-4 w-4" />
                <span className="text-xs font-medium">Level {g.escalation_level}</span>
              </div>
            )}
            <Badge variant={statusVariant(g.status)} size="sm" dot>{formatStatus(g.status)}</Badge>
            {expanded ? <ChevronUpIcon className="h-5 w-5 text-gray-400" /> : <ChevronDownIcon className="h-5 w-5 text-gray-400" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-6">
          {/* Details */}
          <div className="text-sm space-y-2">
            <p className="text-gray-700">{g.description}</p>
            {g.incident_date && <p><span className="text-gray-500">Incident Date:</span> {formatDate(g.incident_date)}</p>}
            {g.against_employee_name && <p><span className="text-gray-500">Against:</span> {g.against_employee_name}</p>}
            {g.desired_outcome && <p><span className="text-gray-500">Desired Outcome:</span> {g.desired_outcome}</p>}
            {g.assigned_to_name && <p><span className="text-gray-500">Assigned To:</span> {g.assigned_to_name}</p>}
          </div>

          {/* Escalation Info */}
          {g.escalation_level > 0 && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 text-danger-700 font-medium">
                <ArrowUpIcon className="h-4 w-4" />
                Escalated to Level {g.escalation_level}
              </div>
              {g.escalated_to_name && <p className="text-danger-600 mt-1">Escalated to: {g.escalated_to_name}</p>}
              {g.escalation_reason && <p className="text-danger-600 mt-1">Reason: {g.escalation_reason}</p>}
            </div>
          )}

          {/* Notes Timeline */}
          {visibleNotes.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Updates</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {visibleNotes.map((n: GrievanceNote) => (
                  <div key={n.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{n.added_by_name}</span>
                      <span className="text-xs text-gray-400">{formatDate(n.created_at)}</span>
                    </div>
                    <p className="text-gray-600 mt-1">{n.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {g.attachments && g.attachments.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Attachments</h4>
              <div className="space-y-1">
                {g.attachments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm">
                    <PaperClipIcon className="h-4 w-4 text-gray-400" />
                    <span>{a.title}</span>
                    {a.file_name && <span className="text-xs text-gray-400">({a.file_name})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolution Section */}
          {g.status === 'RESOLVED' && g.resolution && (
            <div className="bg-success-50 border border-success-200 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-success-800">Resolution Proposed</h4>
              <p className="text-sm text-success-700">{g.resolution}</p>
              {g.resolution_accepted === null && (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Your feedback (optional)..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => acceptMutation.mutate({ feedback })}
                      disabled={acceptMutation.isPending}
                      className="bg-success-600 hover:bg-success-700"
                    >
                      <CheckIcon className="h-4 w-4 mr-1" /> Accept Resolution
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => rejectMutation.mutate({ feedback })}
                      disabled={rejectMutation.isPending}
                    >
                      <XMarkIcon className="h-4 w-4 mr-1" /> Reject Resolution
                    </Button>
                  </div>
                </div>
              )}
              {g.resolution_accepted !== null && (
                <div className="mt-2">
                  <Badge variant={g.resolution_accepted ? 'success' : 'danger'}>
                    {g.resolution_accepted ? 'You accepted this resolution' : 'You rejected this resolution'}
                  </Badge>
                  {g.resolution_feedback && (
                    <p className="text-sm text-gray-600 mt-2">Your feedback: {g.resolution_feedback}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function FileGrievanceModal({ isOpen, onClose, categories, employees }: {
  isOpen: boolean
  onClose: () => void
  categories: GrievanceCategory[]
  employees: any[]
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    category: '', subject: '', description: '',
    incident_date: '', desired_outcome: '', against_employee: '', priority: 'MEDIUM',
  })

  const mutation = useMutation({
    mutationFn: (data: any) => disciplineService.fileGrievance(data),
    onSuccess: () => {
      toast.success('Grievance filed successfully')
      queryClient.invalidateQueries({ queryKey: ['my-grievances'] })
      onClose()
      setForm({ category: '', subject: '', description: '', incident_date: '', desired_outcome: '', against_employee: '', priority: 'MEDIUM' })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to file grievance'),
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="File a Grievance" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Category"
            options={[{ value: '', label: 'Select category...' }, ...categories.filter(c => c.is_active).map(c => ({ value: c.id, label: c.name }))]}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <Select
            label="Priority"
            options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'URGENT', label: 'Urgent' }]}
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          />
        </div>
        <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Brief description of your grievance" />
        <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Provide full details of your grievance..." />
        <Input label="Incident Date" type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} />
        <Select
          label="Against Employee (optional)"
          options={[{ value: '', label: 'None' }, ...employees.map((e: any) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))]}
          value={form.against_employee}
          onChange={(e) => setForm({ ...form, against_employee: e.target.value })}
        />
        <Textarea label="Desired Outcome" value={form.desired_outcome} onChange={(e) => setForm({ ...form, desired_outcome: e.target.value })} rows={2} placeholder="What outcome would you like to see?" />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.category || !form.subject || !form.description}>
            File Grievance
          </Button>
        </div>
      </div>
    </Modal>
  )
}
