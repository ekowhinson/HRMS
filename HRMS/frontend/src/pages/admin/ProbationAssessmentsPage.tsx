import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  FunnelIcon,
  EyeIcon,
  UserIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { performanceService, type ProbationAssessment, type DueProbationAssessment } from '@/services/performance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import { StatsCard } from '@/components/ui/StatsCard'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  SUBMITTED: 'info',
  REVIEWED: 'warning',
  CONFIRMED: 'success',
  EXTENDED: 'warning',
  TERMINATED: 'danger',
}

const periodOptions = [
  { value: '', label: 'All Periods' },
  { value: '3M', label: '3 Months' },
  { value: '6M', label: '6 Months' },
  { value: '12M', label: '12 Months' },
]

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'REVIEWED', label: 'Under Review' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'EXTENDED', label: 'Extended' },
  { value: 'TERMINATED', label: 'Terminated' },
]

export default function ProbationAssessmentsPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [selectedAssessment, setSelectedAssessment] = useState<ProbationAssessment | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showActionModal, setShowActionModal] = useState(false)
  const [actionType, setActionType] = useState<'confirm' | 'extend' | 'terminate' | null>(null)
  const [extensionMonths, setExtensionMonths] = useState('3')
  const [actionReason, setActionReason] = useState('')

  // Fetch assessments
  const { data: assessments, isLoading } = useQuery({
    queryKey: ['probation-assessments', statusFilter, periodFilter, searchQuery, currentPage],
    queryFn: () =>
      performanceService.getProbationAssessments({
        status: statusFilter || undefined,
        period: periodFilter || undefined,
        search: searchQuery || undefined,
        page: currentPage,
      }),
  })

  // Fetch due assessments
  const { data: dueAssessments } = useQuery({
    queryKey: ['probation-due'],
    queryFn: () => performanceService.getDueProbationAssessments(30),
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['probation-stats'],
    queryFn: performanceService.getProbationStats,
  })

  // Mutations
  const confirmMutation = useMutation({
    mutationFn: performanceService.confirmProbation,
    onSuccess: () => {
      toast.success('Employee confirmed successfully')
      queryClient.invalidateQueries({ queryKey: ['probation-assessments'] })
      queryClient.invalidateQueries({ queryKey: ['probation-stats'] })
      handleCloseActionModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to confirm employee')
    },
  })

  const extendMutation = useMutation({
    mutationFn: ({ id, months, reason }: { id: string; months: number; reason: string }) =>
      performanceService.extendProbation(id, months, reason),
    onSuccess: () => {
      toast.success('Probation extended')
      queryClient.invalidateQueries({ queryKey: ['probation-assessments'] })
      queryClient.invalidateQueries({ queryKey: ['probation-stats'] })
      handleCloseActionModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to extend probation')
    },
  })

  const terminateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      performanceService.terminateProbation(id, reason),
    onSuccess: () => {
      toast.success('Employment terminated')
      queryClient.invalidateQueries({ queryKey: ['probation-assessments'] })
      queryClient.invalidateQueries({ queryKey: ['probation-stats'] })
      handleCloseActionModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to terminate employment')
    },
  })

  const handleOpenAction = (assessment: ProbationAssessment, type: 'confirm' | 'extend' | 'terminate') => {
    setSelectedAssessment(assessment)
    setActionType(type)
    setActionReason('')
    setExtensionMonths('3')
    setShowDetailModal(false)
    setShowActionModal(true)
  }

  const handleCloseActionModal = () => {
    setShowActionModal(false)
    setActionType(null)
    setSelectedAssessment(null)
    setActionReason('')
  }

  const handleConfirmAction = () => {
    if (!selectedAssessment) return

    switch (actionType) {
      case 'confirm':
        confirmMutation.mutate(selectedAssessment.id)
        break
      case 'extend':
        if (!actionReason) {
          toast.error('Please provide a reason for extension')
          return
        }
        extendMutation.mutate({
          id: selectedAssessment.id,
          months: parseInt(extensionMonths),
          reason: actionReason,
        })
        break
      case 'terminate':
        if (!actionReason) {
          toast.error('Please provide a reason for termination')
          return
        }
        terminateMutation.mutate({
          id: selectedAssessment.id,
          reason: actionReason,
        })
        break
    }
  }

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (assessment: ProbationAssessment) => (
        <div className="flex items-center gap-3">
          <Avatar
            firstName={assessment.employee_name?.split(' ')[0]}
            lastName={assessment.employee_name?.split(' ')[1]}
            size="sm"
          />
          <div>
            <p className="font-medium text-gray-900">{assessment.employee_name}</p>
            <p className="text-sm text-gray-500">{assessment.employee_number}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (assessment: ProbationAssessment) => (
        <span className="text-sm text-gray-700">{assessment.department_name}</span>
      ),
    },
    {
      key: 'period',
      header: 'Period',
      render: (assessment: ProbationAssessment) => (
        <Badge variant="info">{assessment.period_display}</Badge>
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      render: (assessment: ProbationAssessment) => {
        const isOverdue = new Date(assessment.due_date) < new Date() &&
          !['CONFIRMED', 'TERMINATED'].includes(assessment.status)
        return (
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
              {new Date(assessment.due_date).toLocaleDateString()}
            </span>
            {isOverdue && (
              <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
            )}
          </div>
        )
      },
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (assessment: ProbationAssessment) => (
        <span className="text-sm font-medium">
          {assessment.overall_rating ? `${assessment.overall_rating.toFixed(1)}%` : '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (assessment: ProbationAssessment) => (
        <Badge variant={statusColors[assessment.status] || 'default'}>
          {assessment.status_display}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (assessment: ProbationAssessment) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedAssessment(assessment)
              setShowDetailModal(true)
            }}
          >
            <EyeIcon className="h-4 w-4" />
          </Button>
          {assessment.status === 'SUBMITTED' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenAction(assessment, 'confirm')}
                title="Confirm"
              >
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenAction(assessment, 'extend')}
                title="Extend"
              >
                <ArrowPathIcon className="h-4 w-4 text-yellow-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenAction(assessment, 'terminate')}
                title="Terminate"
              >
                <XCircleIcon className="h-4 w-4 text-red-600" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]

  const pendingCount = stats?.by_status?.find(s => s.status === 'SUBMITTED')?.count || 0
  const overdueCount = stats?.overdue || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Probation Assessments</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage employee probation evaluations
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Assessments"
          value={stats?.total || 0}
          icon={<ClockIcon className="h-6 w-6" />}
        />
        <StatsCard
          title="Pending Review"
          value={pendingCount}
          icon={<UserIcon className="h-6 w-6" />}
          variant={pendingCount > 0 ? 'warning' : 'default'}
        />
        <StatsCard
          title="Overdue"
          value={overdueCount}
          icon={<ExclamationTriangleIcon className="h-6 w-6" />}
          variant={overdueCount > 0 ? 'danger' : 'default'}
        />
        <StatsCard
          title="Due This Month"
          value={dueAssessments?.length || 0}
          icon={<CalendarIcon className="h-6 w-6" />}
        />
      </div>

      {/* Due Assessments Alert */}
      {dueAssessments && dueAssessments.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-800">
                  {dueAssessments.length} Probation Assessment{dueAssessments.length !== 1 ? 's' : ''} Due
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  The following employees are due for probation assessment within 30 days:
                </p>
                <ul className="mt-2 space-y-1">
                  {dueAssessments.slice(0, 5).map((due: DueProbationAssessment) => (
                    <li key={`${due.employee_id}-${due.period}`} className="text-sm text-yellow-800">
                      {due.employee_name} ({due.employee_number}) - {due.period === '3M' ? '3 Months' : due.period === '6M' ? '6 Months' : '12 Months'} due {new Date(due.due_date).toLocaleDateString()}
                    </li>
                  ))}
                  {dueAssessments.length > 5 && (
                    <li className="text-sm text-yellow-600 font-medium">
                      ... and {dueAssessments.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              options={statusOptions}
            />
            <Select
              value={periodFilter}
              onChange={(e) => {
                setPeriodFilter(e.target.value)
                setCurrentPage(1)
              }}
              options={periodOptions}
            />
            <Input
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-64"
            />
          </div>
        </CardContent>
      </Card>

      {/* Assessments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ClockIcon className="h-5 w-5 mr-2 text-gray-500" />
            Probation Assessments
          </CardTitle>
        </CardHeader>
        <Table
          data={assessments?.results || []}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No probation assessments found"
        />
        {assessments && assessments.count > pageSize && (
          <TablePagination
            currentPage={currentPage}
            totalPages={Math.ceil(assessments.count / pageSize)}
            totalItems={assessments.count}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Probation Assessment Details"
        size="lg"
      >
        {selectedAssessment && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar
                firstName={selectedAssessment.employee_name?.split(' ')[0]}
                lastName={selectedAssessment.employee_name?.split(' ')[1]}
                size="lg"
              />
              <div>
                <h3 className="font-medium text-gray-900 text-lg">
                  {selectedAssessment.employee_name}
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedAssessment.position_title} • {selectedAssessment.department_name}
                </p>
                <Badge variant={statusColors[selectedAssessment.status]} className="mt-1">
                  {selectedAssessment.status_display}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Assessment Period</p>
                <p className="font-medium">{selectedAssessment.period_display}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Due Date</p>
                <p className="font-medium">
                  {new Date(selectedAssessment.due_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Overall Rating</p>
                <p className="font-medium text-lg">
                  {selectedAssessment.overall_rating
                    ? `${selectedAssessment.overall_rating.toFixed(1)}%`
                    : 'Not rated'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Assessment Date</p>
                <p className="font-medium">
                  {new Date(selectedAssessment.assessment_date).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Assessment Areas */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Assessment Areas (1-5 Scale)</h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Job Knowledge', value: selectedAssessment.job_knowledge },
                  { label: 'Work Quality', value: selectedAssessment.work_quality },
                  { label: 'Attendance & Punctuality', value: selectedAssessment.attendance_punctuality },
                  { label: 'Teamwork', value: selectedAssessment.teamwork },
                  { label: 'Communication', value: selectedAssessment.communication },
                  { label: 'Initiative', value: selectedAssessment.initiative },
                ].map((area) => (
                  <div key={area.label} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">{area.label}</span>
                    <span className="font-medium">{area.value || '-'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Comments */}
            {selectedAssessment.supervisor_comments && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Supervisor Comments</h4>
                <p className="text-sm text-gray-700 p-3 bg-gray-50 rounded">
                  {selectedAssessment.supervisor_comments}
                </p>
              </div>
            )}

            {selectedAssessment.recommendation && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Recommendation</h4>
                <p className="text-sm text-gray-700 p-3 bg-gray-50 rounded">
                  {selectedAssessment.recommendation}
                </p>
              </div>
            )}

            {/* Actions */}
            {selectedAssessment.status === 'SUBMITTED' && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => handleOpenAction(selectedAssessment, 'extend')}
                >
                  <ArrowPathIcon className="h-4 w-4 mr-2" />
                  Extend Probation
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleOpenAction(selectedAssessment, 'terminate')}
                >
                  <XCircleIcon className="h-4 w-4 mr-2" />
                  Terminate
                </Button>
                <Button
                  onClick={() => handleOpenAction(selectedAssessment, 'confirm')}
                >
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  Confirm Employee
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Action Modal */}
      <Modal
        isOpen={showActionModal}
        onClose={handleCloseActionModal}
        title={
          actionType === 'confirm'
            ? 'Confirm Employee'
            : actionType === 'extend'
            ? 'Extend Probation'
            : 'Terminate Employment'
        }
        size="md"
      >
        <div className="space-y-4">
          {actionType === 'confirm' && (
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-green-500" />
              <p className="text-sm text-green-700">
                Are you sure you want to confirm{' '}
                <strong>{selectedAssessment?.employee_name}</strong> as a permanent employee?
              </p>
            </div>
          )}

          {actionType === 'extend' && (
            <>
              <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                <ArrowPathIcon className="h-6 w-6 text-yellow-500" />
                <p className="text-sm text-yellow-700">
                  Extend probation period for{' '}
                  <strong>{selectedAssessment?.employee_name}</strong>
                </p>
              </div>
              <Select
                label="Extension Duration"
                value={extensionMonths}
                onChange={(e) => setExtensionMonths(e.target.value)}
                options={[
                  { value: '1', label: '1 Month' },
                  { value: '2', label: '2 Months' },
                  { value: '3', label: '3 Months' },
                  { value: '6', label: '6 Months' },
                ]}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Extension <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Explain why probation is being extended..."
                />
              </div>
            </>
          )}

          {actionType === 'terminate' && (
            <>
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <XCircleIcon className="h-6 w-6 text-red-500" />
                <p className="text-sm text-red-700">
                  Are you sure you want to terminate{' '}
                  <strong>{selectedAssessment?.employee_name}</strong>'s employment?
                  This action is final.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Termination <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Explain why employment is being terminated..."
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={handleCloseActionModal}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'terminate' ? 'danger' : 'primary'}
              onClick={handleConfirmAction}
              isLoading={
                confirmMutation.isPending ||
                extendMutation.isPending ||
                terminateMutation.isPending
              }
            >
              {actionType === 'confirm'
                ? 'Confirm Employee'
                : actionType === 'extend'
                ? 'Extend Probation'
                : 'Terminate Employment'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
