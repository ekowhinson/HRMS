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
} from '@heroicons/react/24/outline'
import { trainingService } from '@/services/training'
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
    </div>
  )
}
