import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  CalendarIcon,
  PlusIcon,
  EyeIcon,
  PencilSquareIcon,
  UserPlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentCheckIcon,
  AcademicCapIcon,
  DocumentTextIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { trainingService } from '@/services/training'
import type { PostTrainingReportCreate, TrainingImpactAssessmentCreate, ImpactRating } from '@/services/training'
import { employeeService } from '@/services/employees'
import type { TrainingSession, TrainingEnrollment } from '@/types'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { StatsCard } from '@/components/ui/StatsCard'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  SCHEDULED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
}

const enrollmentStatusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ENROLLED: 'info',
  ATTENDED: 'warning',
  COMPLETED: 'success',
  NO_SHOW: 'danger',
  CANCELLED: 'default',
}

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const initialFormData = {
  program: '',
  title: '',
  facilitator: '',
  venue: '',
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  status: 'SCHEDULED',
  notes: '',
  max_participants: '',
}

export default function TrainingSessionsPage() {
  const queryClient = useQueryClient()
  const [programFilter, setProgramFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [showEvaluateModal, setShowEvaluateModal] = useState(false)
  const [formData, setFormData] = useState(initialFormData)

  // Enroll state
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])

  // Evaluate state
  const [selectedEnrollment, setSelectedEnrollment] = useState<TrainingEnrollment | null>(null)
  const [evalScore, setEvalScore] = useState('')
  const [evalFeedback, setEvalFeedback] = useState('')

  // Post-Training Report state
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportEnrollment, setReportEnrollment] = useState<TrainingEnrollment | null>(null)
  const [reportForm, setReportForm] = useState({
    key_learnings: '',
    skills_acquired: '',
    knowledge_application: '',
    action_plan: '',
    recommendations: '',
    challenges: '',
    overall_rating: '3',
  })

  // Impact Assessment state
  const [showAssessmentModal, setShowAssessmentModal] = useState(false)
  const [assessmentEnrollment, setAssessmentEnrollment] = useState<TrainingEnrollment | null>(null)
  const [assessmentForm, setAssessmentForm] = useState({
    assessment_date: new Date().toISOString().split('T')[0],
    assessment_period_start: '',
    assessment_period_end: '',
    performance_before: '',
    performance_after: '',
    skills_application: '',
    skills_application_rating: '3',
    impact_rating: 'MODERATE' as ImpactRating,
    recommendations: '',
    follow_up_actions: '',
    further_training_needed: false,
    further_training_details: '',
    overall_effectiveness_score: '3',
  })

  // Fetch sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['training-sessions', programFilter, statusFilter, searchQuery, currentPage],
    queryFn: () =>
      trainingService.getSessions({
        program: programFilter || undefined,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
        page: currentPage,
        page_size: pageSize,
      }),
  })

  // Fetch programs for filter/form dropdown
  const { data: programsData } = useQuery({
    queryKey: ['training-programs-all'],
    queryFn: () => trainingService.getPrograms({ page_size: 200, is_active: 'true' }),
  })
  const programOptions = [
    { value: '', label: 'All Programs' },
    ...(programsData?.results || []).map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` })),
  ]

  // Fetch session detail when viewing
  const { data: sessionDetail } = useQuery({
    queryKey: ['training-session-detail', selectedSession?.id],
    queryFn: () => trainingService.getSession(selectedSession!.id),
    enabled: !!selectedSession && showDetailModal,
  })

  // Employee search for enrollment
  const { data: employeeResults } = useQuery({
    queryKey: ['employee-search', employeeSearch],
    queryFn: () => employeeService.getEmployees({ search: employeeSearch, page_size: 20 }),
    enabled: employeeSearch.length >= 2,
  })

  // Stats
  const totalSessions = sessions?.count || 0
  const scheduledCount = (sessions?.results || []).filter((s) => s.status === 'SCHEDULED').length
  const inProgressCount = (sessions?.results || []).filter((s) => s.status === 'IN_PROGRESS').length
  const completedCount = (sessions?.results || []).filter((s) => s.status === 'COMPLETED').length

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => trainingService.createSession(data),
    onSuccess: () => {
      toast.success('Session created successfully')
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] })
      setShowCreateModal(false)
      setFormData(initialFormData)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to create session'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => trainingService.updateSession(id, data),
    onSuccess: () => {
      toast.success('Session updated successfully')
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] })
      setShowEditModal(false)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to update session'),
  })

  const enrollMutation = useMutation({
    mutationFn: ({ sessionId, employeeIds }: { sessionId: string; employeeIds: string[] }) =>
      trainingService.enrollEmployees(sessionId, employeeIds),
    onSuccess: (data) => {
      toast.success(`Enrolled ${data.enrolled} employee(s)${data.skipped > 0 ? `, ${data.skipped} already enrolled` : ''}`)
      queryClient.invalidateQueries({ queryKey: ['training-session-detail'] })
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] })
      setShowEnrollModal(false)
      setSelectedEmployeeIds([])
      setEmployeeSearch('')
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to enroll employees'),
  })

  const completeMutation = useMutation({
    mutationFn: trainingService.completeSession,
    onSuccess: () => {
      toast.success('Session completed')
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['training-session-detail'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to complete session'),
  })

  const cancelMutation = useMutation({
    mutationFn: trainingService.cancelSession,
    onSuccess: () => {
      toast.success('Session cancelled')
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['training-session-detail'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to cancel session'),
  })

  const attendanceMutation = useMutation({
    mutationFn: ({ sessionId, updates }: { sessionId: string; updates: any[] }) =>
      trainingService.markAttendance(sessionId, updates),
    onSuccess: (data) => {
      toast.success(`Updated ${data.updated} enrollment(s)`)
      queryClient.invalidateQueries({ queryKey: ['training-session-detail'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to mark attendance'),
  })

  const evaluateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => trainingService.evaluateEnrollment(id, data),
    onSuccess: () => {
      toast.success('Evaluation saved')
      queryClient.invalidateQueries({ queryKey: ['training-session-detail'] })
      setShowEvaluateModal(false)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to save evaluation'),
  })

  const certificateMutation = useMutation({
    mutationFn: trainingService.issueCertificate,
    onSuccess: () => {
      toast.success('Certificate issued')
      queryClient.invalidateQueries({ queryKey: ['training-session-detail'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to issue certificate'),
  })

  const reportMutation = useMutation({
    mutationFn: (data: PostTrainingReportCreate) => trainingService.createPostTrainingReport(data),
    onSuccess: (report) => {
      trainingService.submitPostTrainingReport(report.id).then(() => {
        toast.success('Post-training report submitted')
        queryClient.invalidateQueries({ queryKey: ['training-session-detail'] })
        setShowReportModal(false)
      }).catch(() => {
        toast.success('Report saved as draft')
        queryClient.invalidateQueries({ queryKey: ['training-session-detail'] })
        setShowReportModal(false)
      })
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || error.response?.data?.enrollment?.[0] || 'Failed to submit report'),
  })

  const assessmentMutation = useMutation({
    mutationFn: (data: TrainingImpactAssessmentCreate) => trainingService.createImpactAssessment(data),
    onSuccess: (assessment) => {
      trainingService.submitImpactAssessment(assessment.id).then(() => {
        toast.success('Impact assessment submitted')
        queryClient.invalidateQueries({ queryKey: ['training-session-detail'] })
        setShowAssessmentModal(false)
      }).catch(() => {
        toast.success('Assessment saved as draft')
        queryClient.invalidateQueries({ queryKey: ['training-session-detail'] })
        setShowAssessmentModal(false)
      })
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || error.response?.data?.enrollment?.[0] || 'Failed to submit assessment'),
  })

  const handleCreate = () => {
    const payload = {
      ...formData,
      max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
      start_time: formData.start_time || null,
      end_time: formData.end_time || null,
    }
    createMutation.mutate(payload)
  }

  const handleUpdate = () => {
    if (!selectedSession) return
    const payload = {
      ...formData,
      max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
      start_time: formData.start_time || null,
      end_time: formData.end_time || null,
    }
    updateMutation.mutate({ id: selectedSession.id, data: payload })
  }

  const openEditModal = (session: TrainingSession) => {
    setSelectedSession(session)
    setFormData({
      program: session.program,
      title: session.title,
      facilitator: session.facilitator || '',
      venue: session.venue || '',
      start_date: session.start_date,
      end_date: session.end_date,
      start_time: session.start_time || '',
      end_time: session.end_time || '',
      status: session.status,
      notes: session.notes || '',
      max_participants: session.max_participants ? String(session.max_participants) : '',
    })
    setShowEditModal(true)
  }

  const columns = [
    {
      key: 'title',
      header: 'Session',
      render: (row: TrainingSession) => (
        <div>
          <p className="font-medium text-gray-900">{row.title}</p>
          <p className="text-xs text-gray-500">{row.program_name}</p>
        </div>
      ),
    },
    {
      key: 'facilitator',
      header: 'Facilitator',
      render: (row: TrainingSession) => row.facilitator || '-',
    },
    {
      key: 'venue',
      header: 'Venue',
      render: (row: TrainingSession) => row.venue || '-',
    },
    {
      key: 'start_date',
      header: 'Date',
      render: (row: TrainingSession) => (
        <span className="text-sm">
          {new Date(row.start_date).toLocaleDateString()}
          {row.end_date !== row.start_date && (
            <> - {new Date(row.end_date).toLocaleDateString()}</>
          )}
        </span>
      ),
    },
    {
      key: 'enrollment_count',
      header: 'Enrolled',
      render: (row: TrainingSession) => (
        <span>
          {row.enrollment_count}
          {row.capacity ? `/${row.capacity}` : ''}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: TrainingSession) => (
        <Badge variant={statusColors[row.status] || 'default'}>
          {row.status_display}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: TrainingSession) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSelectedSession(row); setShowDetailModal(true) }}
            title="View Details"
          >
            <EyeIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEditModal(row)} title="Edit">
            <PencilSquareIcon className="h-4 w-4" />
          </Button>
          {row.status === 'SCHEDULED' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectedSession(row); setShowEnrollModal(true) }}
              title="Enroll Employees"
            >
              <UserPlusIcon className="h-4 w-4 text-blue-500" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const enrollmentColumns = [
    {
      key: 'employee_name',
      header: 'Employee',
      render: (row: TrainingEnrollment) => (
        <div>
          <p className="font-medium text-gray-900">{row.employee_name}</p>
          <p className="text-xs text-gray-500">{row.employee_number} - {row.department_name}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: TrainingEnrollment) => (
        <Badge variant={enrollmentStatusColors[row.status] || 'default'}>
          {row.status_display}
        </Badge>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      render: (row: TrainingEnrollment) => row.score != null ? `${row.score}%` : '-',
    },
    {
      key: 'report_status',
      header: 'Report / Assessment',
      render: (row: TrainingEnrollment) => {
        const report = (row as any).post_training_report
        const assessment = (row as any).impact_assessment
        return (
          <div className="flex flex-col gap-1">
            {report ? (
              <Badge variant={report.status === 'SUBMITTED' || report.status === 'REVIEWED' ? 'success' : 'warning'}>
                Report: {report.status}
              </Badge>
            ) : row.status === 'COMPLETED' ? (
              <span className="text-xs text-gray-400">No report</span>
            ) : null}
            {assessment ? (
              <Badge variant={assessment.status === 'SUBMITTED' ? 'success' : 'warning'}>
                Assessment: {assessment.status}
              </Badge>
            ) : row.status === 'COMPLETED' ? (
              <span className="text-xs text-gray-400">No assessment</span>
            ) : null}
          </div>
        )
      },
    },
    {
      key: 'certificate',
      header: 'Certificate',
      render: (row: TrainingEnrollment) => row.certificate_issued ? (
        <Badge variant="success">Issued</Badge>
      ) : (
        <span className="text-xs text-gray-400">-</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: TrainingEnrollment) => (
        <div className="flex items-center gap-1">
          {(row.status === 'ENROLLED' || row.status === 'ATTENDED') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                attendanceMutation.mutate({
                  sessionId: selectedSession!.id,
                  updates: [{ enrollment_id: row.id, status: row.status === 'ENROLLED' ? 'ATTENDED' : 'ENROLLED' }],
                })
              }}
              title={row.status === 'ENROLLED' ? 'Mark Attended' : 'Undo Attendance'}
            >
              <ClipboardDocumentCheckIcon className="h-4 w-4" />
            </Button>
          )}
          {(row.status === 'ATTENDED' || row.status === 'COMPLETED') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedEnrollment(row)
                setEvalScore(row.score != null ? String(row.score) : '')
                setEvalFeedback(row.feedback || '')
                setShowEvaluateModal(true)
              }}
              title="Evaluate"
            >
              <AcademicCapIcon className="h-4 w-4" />
            </Button>
          )}
          {row.status === 'COMPLETED' && !(row as any).post_training_report && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setReportEnrollment(row)
                setReportForm({
                  key_learnings: '',
                  skills_acquired: '',
                  knowledge_application: '',
                  action_plan: '',
                  recommendations: '',
                  challenges: '',
                  overall_rating: '3',
                })
                setShowReportModal(true)
              }}
              title="Submit Post-Training Report"
            >
              <DocumentTextIcon className="h-4 w-4 text-blue-500" />
            </Button>
          )}
          {row.status === 'COMPLETED' && !(row as any).impact_assessment && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAssessmentEnrollment(row)
                setAssessmentForm({
                  assessment_date: new Date().toISOString().split('T')[0],
                  assessment_period_start: selectedSession?.start_date || '',
                  assessment_period_end: new Date().toISOString().split('T')[0],
                  performance_before: '',
                  performance_after: '',
                  skills_application: '',
                  skills_application_rating: '3',
                  impact_rating: 'MODERATE',
                  recommendations: '',
                  follow_up_actions: '',
                  further_training_needed: false,
                  further_training_details: '',
                  overall_effectiveness_score: '3',
                })
                setShowAssessmentModal(true)
              }}
              title="Assess Impact"
            >
              <ChartBarIcon className="h-4 w-4 text-purple-500" />
            </Button>
          )}
          {row.status === 'COMPLETED' && !row.certificate_issued && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => certificateMutation.mutate(row.id)}
              title="Issue Certificate"
            >
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const renderForm = () => (
    <div className="space-y-4">
      <Select
        label="Program"
        value={formData.program}
        onChange={(e) => setFormData({ ...formData, program: e.target.value })}
        options={programOptions.filter((o) => o.value)}
        required
      />
      <Input
        label="Session Title"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        required
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Facilitator"
          value={formData.facilitator}
          onChange={(e) => setFormData({ ...formData, facilitator: e.target.value })}
        />
        <Input
          label="Venue"
          value={formData.venue}
          onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Start Date"
          type="date"
          value={formData.start_date}
          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
          required
        />
        <Input
          label="End Date"
          type="date"
          value={formData.end_date}
          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
          required
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Start Time"
          type="time"
          value={formData.start_time}
          onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
        />
        <Input
          label="End Time"
          type="time"
          value={formData.end_time}
          onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
        />
      </div>
      <Input
        label="Max Participants (override)"
        type="number"
        value={formData.max_participants}
        onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
        placeholder="Use program default"
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          rows={3}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Sessions</h1>
          <p className="text-sm text-gray-500 mt-1">Schedule and manage training sessions</p>
        </div>
        <Button onClick={() => { setFormData(initialFormData); setShowCreateModal(true) }}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Session
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Sessions" value={totalSessions} icon={<CalendarIcon className="h-6 w-6" />} variant="primary" />
        <StatsCard title="Scheduled" value={scheduledCount} icon={<CalendarIcon className="h-6 w-6" />} variant="info" />
        <StatsCard title="In Progress" value={inProgressCount} icon={<CalendarIcon className="h-6 w-6" />} variant="warning" />
        <StatsCard title="Completed" value={completedCount} icon={<CheckCircleIcon className="h-6 w-6" />} variant="success" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
            />
            <Select
              value={programFilter}
              onChange={(e) => { setProgramFilter(e.target.value); setCurrentPage(1) }}
              options={programOptions}
            />
            <Select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
              options={statusOptions}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent>
          <Table
            columns={columns}
            data={sessions?.results || []}
            isLoading={isLoading}
            emptyMessage="No training sessions found"
          />
          {sessions && sessions.count > pageSize && (
            <TablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(sessions.count / pageSize)}
              onPageChange={setCurrentPage}
              totalItems={sessions.count}
              pageSize={pageSize}
            />
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Training Session" size="lg">
        {renderForm()}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Session'}
          </Button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Training Session" size="lg">
        {renderForm()}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
          <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </Modal>

      {/* Detail / Manage Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Session Details" size="xl">
        {selectedSession && (
          <div className="space-y-6">
            {/* Session Info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Program</p>
                <p className="font-medium">{selectedSession.program_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Title</p>
                <p className="font-medium">{selectedSession.title}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <Badge variant={statusColors[selectedSession.status] || 'default'}>
                  {selectedSession.status_display}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500">Facilitator</p>
                <p>{selectedSession.facilitator || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Venue</p>
                <p>{selectedSession.venue || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p>
                  {new Date(selectedSession.start_date).toLocaleDateString()}
                  {selectedSession.end_date !== selectedSession.start_date &&
                    ` - ${new Date(selectedSession.end_date).toLocaleDateString()}`
                  }
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Enrolled / Capacity</p>
                <p>{selectedSession.enrollment_count}{selectedSession.capacity ? ` / ${selectedSession.capacity}` : ''}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 border-t border-b py-3">
              {(selectedSession.status === 'SCHEDULED' || selectedSession.status === 'IN_PROGRESS') && (
                <Button
                  size="sm"
                  onClick={() => setShowEnrollModal(true)}
                >
                  <UserPlusIcon className="h-4 w-4 mr-1" />
                  Enroll Employees
                </Button>
              )}
              {selectedSession.status === 'SCHEDULED' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (sessionDetail?.enrollments?.length) {
                      attendanceMutation.mutate({
                        sessionId: selectedSession.id,
                        updates: sessionDetail.enrollments
                          .filter((e: TrainingEnrollment) => e.status === 'ENROLLED')
                          .map((e: TrainingEnrollment) => ({ enrollment_id: e.id, status: 'ATTENDED' })),
                      })
                    }
                  }}
                >
                  <ClipboardDocumentCheckIcon className="h-4 w-4 mr-1" />
                  Mark All Attended
                </Button>
              )}
              {(selectedSession.status === 'SCHEDULED' || selectedSession.status === 'IN_PROGRESS') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm('Complete this session? ATTENDED enrollments will be marked COMPLETED, and ENROLLED will be marked NO_SHOW.')) {
                      completeMutation.mutate(selectedSession.id)
                    }
                  }}
                >
                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                  Complete Session
                </Button>
              )}
              {selectedSession.status === 'SCHEDULED' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm('Cancel this session? All enrollments will be cancelled.')) {
                      cancelMutation.mutate(selectedSession.id)
                    }
                  }}
                >
                  <XCircleIcon className="h-4 w-4 mr-1 text-red-500" />
                  Cancel Session
                </Button>
              )}
            </div>

            {/* Enrollments Table */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Enrollments</h3>
              <Table
                columns={enrollmentColumns}
                data={sessionDetail?.enrollments || []}
                emptyMessage="No employees enrolled yet"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Enroll Modal */}
      <Modal isOpen={showEnrollModal} onClose={() => { setShowEnrollModal(false); setSelectedEmployeeIds([]); setEmployeeSearch('') }} title="Enroll Employees" size="lg">
        <div className="space-y-4">
          <Input
            placeholder="Search employees by name or number..."
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
          />
          {employeeResults?.results && employeeResults.results.length > 0 && (
            <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
              {employeeResults.results.map((emp: any) => {
                const isSelected = selectedEmployeeIds.includes(emp.id)
                return (
                  <label
                    key={emp.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedEmployeeIds((prev) =>
                          isSelected ? prev.filter((id) => id !== emp.id) : [...prev, emp.id]
                        )
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {emp.first_name} {emp.last_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {emp.employee_number} - {emp.department_name || ''}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
          {selectedEmployeeIds.length > 0 && (
            <p className="text-sm text-gray-600">{selectedEmployeeIds.length} employee(s) selected</p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setShowEnrollModal(false); setSelectedEmployeeIds([]); setEmployeeSearch('') }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedSession && selectedEmployeeIds.length > 0) {
                  enrollMutation.mutate({ sessionId: selectedSession.id, employeeIds: selectedEmployeeIds })
                }
              }}
              disabled={selectedEmployeeIds.length === 0 || enrollMutation.isPending}
            >
              {enrollMutation.isPending ? 'Enrolling...' : `Enroll ${selectedEmployeeIds.length} Employee(s)`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Evaluate Modal */}
      <Modal isOpen={showEvaluateModal} onClose={() => setShowEvaluateModal(false)} title="Evaluate Enrollment">
        {selectedEnrollment && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Evaluating: <span className="font-medium">{selectedEnrollment.employee_name}</span>
            </p>
            <Input
              label="Score (%)"
              type="number"
              min="0"
              max="100"
              value={evalScore}
              onChange={(e) => setEvalScore(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Feedback</label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                rows={4}
                value={evalFeedback}
                onChange={(e) => setEvalFeedback(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowEvaluateModal(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  evaluateMutation.mutate({
                    id: selectedEnrollment.id,
                    data: {
                      score: evalScore ? parseFloat(evalScore) : undefined,
                      feedback: evalFeedback || undefined,
                    },
                  })
                }}
                disabled={evaluateMutation.isPending}
              >
                {evaluateMutation.isPending ? 'Saving...' : 'Save Evaluation'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Post-Training Report Modal */}
      <Modal isOpen={showReportModal} onClose={() => setShowReportModal(false)} title="Submit Post-Training Report" size="lg">
        {reportEnrollment && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Employee: <span className="font-medium">{reportEnrollment.employee_name}</span>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key Learnings *</label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                value={reportForm.key_learnings}
                onChange={(e) => setReportForm({ ...reportForm, key_learnings: e.target.value })}
                placeholder="What were the key learnings from this training?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Skills Acquired *</label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                value={reportForm.skills_acquired}
                onChange={(e) => setReportForm({ ...reportForm, skills_acquired: e.target.value })}
                placeholder="What skills were acquired during the training?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Knowledge Application *</label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                value={reportForm.knowledge_application}
                onChange={(e) => setReportForm({ ...reportForm, knowledge_application: e.target.value })}
                placeholder="How will the knowledge be applied to the job?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action Plan *</label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                value={reportForm.action_plan}
                onChange={(e) => setReportForm({ ...reportForm, action_plan: e.target.value })}
                placeholder="What actions will be taken to implement learnings?"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recommendations</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                  value={reportForm.recommendations}
                  onChange={(e) => setReportForm({ ...reportForm, recommendations: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Challenges</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                  value={reportForm.challenges}
                  onChange={(e) => setReportForm({ ...reportForm, challenges: e.target.value })}
                />
              </div>
            </div>
            <Select
              label="Overall Training Rating *"
              value={reportForm.overall_rating}
              onChange={(e) => setReportForm({ ...reportForm, overall_rating: e.target.value })}
              options={[
                { value: '1', label: '1 - Poor' },
                { value: '2', label: '2 - Below Average' },
                { value: '3', label: '3 - Average' },
                { value: '4', label: '4 - Good' },
                { value: '5', label: '5 - Excellent' },
              ]}
            />
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowReportModal(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!reportForm.key_learnings || !reportForm.skills_acquired || !reportForm.knowledge_application || !reportForm.action_plan) {
                    toast.error('Please fill in all required fields')
                    return
                  }
                  reportMutation.mutate({
                    enrollment: reportEnrollment.id,
                    key_learnings: reportForm.key_learnings,
                    skills_acquired: reportForm.skills_acquired,
                    knowledge_application: reportForm.knowledge_application,
                    action_plan: reportForm.action_plan,
                    recommendations: reportForm.recommendations || undefined,
                    challenges: reportForm.challenges || undefined,
                    overall_rating: parseInt(reportForm.overall_rating),
                  })
                }}
                disabled={reportMutation.isPending}
              >
                {reportMutation.isPending ? 'Submitting...' : 'Submit Report'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Impact Assessment Modal */}
      <Modal isOpen={showAssessmentModal} onClose={() => setShowAssessmentModal(false)} title="Training Impact Assessment" size="lg">
        {assessmentEnrollment && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Employee: <span className="font-medium">{assessmentEnrollment.employee_name}</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Assessment Date *"
                type="date"
                value={assessmentForm.assessment_date}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, assessment_date: e.target.value })}
              />
              <Input
                label="Period Start *"
                type="date"
                value={assessmentForm.assessment_period_start}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, assessment_period_start: e.target.value })}
              />
              <Input
                label="Period End *"
                type="date"
                value={assessmentForm.assessment_period_end}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, assessment_period_end: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Performance Before Training *</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                  value={assessmentForm.performance_before}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, performance_before: e.target.value })}
                  placeholder="Describe performance before training"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Performance After Training *</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                  value={assessmentForm.performance_after}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, performance_after: e.target.value })}
                  placeholder="Describe performance after training"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Skills Application *</label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                value={assessmentForm.skills_application}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, skills_application: e.target.value })}
                placeholder="How has the employee applied the skills learned?"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Skills Application Rating *"
                value={assessmentForm.skills_application_rating}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, skills_application_rating: e.target.value })}
                options={[
                  { value: '1', label: '1 - Poor' },
                  { value: '2', label: '2 - Below Average' },
                  { value: '3', label: '3 - Average' },
                  { value: '4', label: '4 - Good' },
                  { value: '5', label: '5 - Excellent' },
                ]}
              />
              <Select
                label="Impact Rating *"
                value={assessmentForm.impact_rating}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, impact_rating: e.target.value as ImpactRating })}
                options={[
                  { value: 'SIGNIFICANT', label: 'Significant Improvement' },
                  { value: 'MODERATE', label: 'Moderate Improvement' },
                  { value: 'MINIMAL', label: 'Minimal Improvement' },
                  { value: 'NO_CHANGE', label: 'No Change' },
                  { value: 'DECLINED', label: 'Performance Declined' },
                ]}
              />
              <Select
                label="Overall Effectiveness *"
                value={assessmentForm.overall_effectiveness_score}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, overall_effectiveness_score: e.target.value })}
                options={[
                  { value: '1', label: '1 - Poor' },
                  { value: '2', label: '2 - Below Average' },
                  { value: '3', label: '3 - Average' },
                  { value: '4', label: '4 - Good' },
                  { value: '5', label: '5 - Excellent' },
                ]}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recommendations</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                  value={assessmentForm.recommendations}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, recommendations: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Actions</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                  value={assessmentForm.follow_up_actions}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, follow_up_actions: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={assessmentForm.further_training_needed}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, further_training_needed: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Further training needed
              </label>
            </div>
            {assessmentForm.further_training_needed && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Further Training Details</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                  value={assessmentForm.further_training_details}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, further_training_details: e.target.value })}
                  placeholder="Describe what further training is needed"
                />
              </div>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowAssessmentModal(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!assessmentForm.assessment_date || !assessmentForm.assessment_period_start || !assessmentForm.assessment_period_end ||
                      !assessmentForm.performance_before || !assessmentForm.performance_after || !assessmentForm.skills_application) {
                    toast.error('Please fill in all required fields')
                    return
                  }
                  assessmentMutation.mutate({
                    enrollment: assessmentEnrollment.id,
                    assessment_date: assessmentForm.assessment_date,
                    assessment_period_start: assessmentForm.assessment_period_start,
                    assessment_period_end: assessmentForm.assessment_period_end,
                    performance_before: assessmentForm.performance_before,
                    performance_after: assessmentForm.performance_after,
                    skills_application: assessmentForm.skills_application,
                    skills_application_rating: parseInt(assessmentForm.skills_application_rating),
                    impact_rating: assessmentForm.impact_rating,
                    recommendations: assessmentForm.recommendations || undefined,
                    follow_up_actions: assessmentForm.follow_up_actions || undefined,
                    further_training_needed: assessmentForm.further_training_needed,
                    further_training_details: assessmentForm.further_training_details || undefined,
                    overall_effectiveness_score: parseInt(assessmentForm.overall_effectiveness_score),
                  })
                }}
                disabled={assessmentMutation.isPending}
              >
                {assessmentMutation.isPending ? 'Submitting...' : 'Submit Assessment'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
