import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ScaleIcon,
  FunnelIcon,
  EyeIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { performanceService, type PerformanceAppeal } from '@/services/performance'
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
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  HEARING: 'warning',
  UPHELD: 'success',
  PARTIAL: 'success',
  DISMISSED: 'danger',
  WITHDRAWN: 'default',
}

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'HEARING', label: 'Hearing Scheduled' },
  { value: 'UPHELD', label: 'Upheld' },
  { value: 'PARTIAL', label: 'Partially Upheld' },
  { value: 'DISMISSED', label: 'Dismissed' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
]

const decisionOptions = [
  { value: 'UPHELD', label: 'Appeal Upheld' },
  { value: 'PARTIAL', label: 'Partially Upheld' },
  { value: 'DISMISSED', label: 'Dismissed' },
]

export default function PerformanceAppealsPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [selectedAppeal, setSelectedAppeal] = useState<PerformanceAppeal | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showHearingModal, setShowHearingModal] = useState(false)
  const [showDecisionModal, setShowDecisionModal] = useState(false)
  const [hearingDate, setHearingDate] = useState('')
  const [hearingTime, setHearingTime] = useState('')
  const [decisionStatus, setDecisionStatus] = useState<'UPHELD' | 'PARTIAL' | 'DISMISSED'>('DISMISSED')
  const [decisionText, setDecisionText] = useState('')

  // Fetch appeals
  const { data: appeals, isLoading } = useQuery({
    queryKey: ['performance-appeals', statusFilter, searchQuery, currentPage],
    queryFn: () =>
      performanceService.getAppeals({
        status: statusFilter || undefined,
        search: searchQuery || undefined,
        page: currentPage,
      }),
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['appeal-stats'],
    queryFn: performanceService.getAppealStats,
  })

  // Schedule hearing mutation
  const scheduleHearingMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      performanceService.scheduleHearing(id, date),
    onSuccess: () => {
      toast.success('Hearing scheduled successfully')
      queryClient.invalidateQueries({ queryKey: ['performance-appeals'] })
      queryClient.invalidateQueries({ queryKey: ['appeal-stats'] })
      handleCloseHearingModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to schedule hearing')
    },
  })

  // Decide appeal mutation
  const decideAppealMutation = useMutation({
    mutationFn: ({ id, decision, status }: { id: string; decision: string; status: 'UPHELD' | 'PARTIAL' | 'DISMISSED' }) =>
      performanceService.decideAppeal(id, decision, status),
    onSuccess: () => {
      toast.success('Decision recorded successfully')
      queryClient.invalidateQueries({ queryKey: ['performance-appeals'] })
      queryClient.invalidateQueries({ queryKey: ['appeal-stats'] })
      handleCloseDecisionModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to record decision')
    },
  })

  const handleOpenHearingModal = (appeal: PerformanceAppeal) => {
    setSelectedAppeal(appeal)
    setHearingDate('')
    setHearingTime('10:00')
    setShowDetailModal(false)
    setShowHearingModal(true)
  }

  const handleCloseHearingModal = () => {
    setShowHearingModal(false)
    setSelectedAppeal(null)
    setHearingDate('')
    setHearingTime('')
  }

  const handleScheduleHearing = () => {
    if (!selectedAppeal || !hearingDate || !hearingTime) {
      toast.error('Please select date and time')
      return
    }

    const dateTime = `${hearingDate}T${hearingTime}:00`
    scheduleHearingMutation.mutate({
      id: selectedAppeal.id,
      date: dateTime,
    })
  }

  const handleOpenDecisionModal = (appeal: PerformanceAppeal) => {
    setSelectedAppeal(appeal)
    setDecisionStatus('DISMISSED')
    setDecisionText('')
    setShowDetailModal(false)
    setShowDecisionModal(true)
  }

  const handleCloseDecisionModal = () => {
    setShowDecisionModal(false)
    setSelectedAppeal(null)
    setDecisionStatus('DISMISSED')
    setDecisionText('')
  }

  const handleRecordDecision = () => {
    if (!selectedAppeal || !decisionText) {
      toast.error('Please provide a decision')
      return
    }

    decideAppealMutation.mutate({
      id: selectedAppeal.id,
      decision: decisionText,
      status: decisionStatus,
    })
  }

  const columns = [
    {
      key: 'appeal_number',
      header: 'Appeal #',
      render: (appeal: PerformanceAppeal) => (
        <span className="font-mono text-sm font-semibold text-primary-600">
          {appeal.appeal_number}
        </span>
      ),
    },
    {
      key: 'employee',
      header: 'Employee',
      render: (appeal: PerformanceAppeal) => (
        <div className="flex items-center gap-3">
          <Avatar
            firstName={appeal.employee_name?.split(' ')[0]}
            lastName={appeal.employee_name?.split(' ')[1]}
            size="sm"
          />
          <div>
            <p className="font-medium text-gray-900">{appeal.employee_name}</p>
            <p className="text-sm text-gray-500">{appeal.employee_number}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'cycle',
      header: 'Appraisal Cycle',
      render: (appeal: PerformanceAppeal) => (
        <span className="text-sm text-gray-700">{appeal.appraisal_cycle}</span>
      ),
    },
    {
      key: 'submitted_at',
      header: 'Submitted',
      render: (appeal: PerformanceAppeal) => (
        <span className="text-sm text-gray-700">
          {new Date(appeal.submitted_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'hearing_date',
      header: 'Hearing Date',
      render: (appeal: PerformanceAppeal) => (
        <span className="text-sm text-gray-700">
          {appeal.hearing_date
            ? new Date(appeal.hearing_date).toLocaleDateString()
            : '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (appeal: PerformanceAppeal) => (
        <Badge variant={statusColors[appeal.status] || 'default'}>
          {appeal.status_display}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (appeal: PerformanceAppeal) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedAppeal(appeal)
              setShowDetailModal(true)
            }}
          >
            <EyeIcon className="h-4 w-4" />
          </Button>
          {appeal.status === 'SUBMITTED' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenHearingModal(appeal)}
              title="Schedule Hearing"
            >
              <CalendarDaysIcon className="h-4 w-4 text-blue-600" />
            </Button>
          )}
          {(appeal.status === 'UNDER_REVIEW' || appeal.status === 'HEARING') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenDecisionModal(appeal)}
              title="Record Decision"
            >
              <CheckCircleIcon className="h-4 w-4 text-green-600" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const pendingCount = stats?.pending || 0
  const submittedCount = stats?.by_status?.find(s => s.status === 'SUBMITTED')?.count || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance Appeals</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage appraisal appeals and grievances
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Appeals"
          value={stats?.total || 0}
          icon={<ScaleIcon className="h-6 w-6" />}
        />
        <StatsCard
          title="New Submissions"
          value={submittedCount}
          icon={<ClockIcon className="h-6 w-6" />}
          variant={submittedCount > 0 ? 'warning' : 'default'}
        />
        <StatsCard
          title="Pending Decision"
          value={pendingCount}
          icon={<ScaleIcon className="h-6 w-6" />}
          variant={pendingCount > 5 ? 'warning' : 'default'}
        />
        <StatsCard
          title="Resolved"
          value={(stats?.by_status?.filter(s =>
            ['UPHELD', 'PARTIAL', 'DISMISSED', 'WITHDRAWN'].includes(s.status)
          ).reduce((acc, s) => acc + s.count, 0)) || 0}
          icon={<CheckCircleIcon className="h-6 w-6" />}
        />
      </div>

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
            <Input
              placeholder="Search by appeal # or name..."
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

      {/* Appeals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ScaleIcon className="h-5 w-5 mr-2 text-gray-500" />
            Performance Appeals
          </CardTitle>
        </CardHeader>
        <Table
          data={appeals?.results || []}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No performance appeals found"
        />
        {appeals && appeals.count > pageSize && (
          <TablePagination
            currentPage={currentPage}
            totalPages={Math.ceil(appeals.count / pageSize)}
            totalItems={appeals.count}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Appeal Details"
        size="lg"
      >
        {selectedAppeal && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar
                  firstName={selectedAppeal.employee_name?.split(' ')[0]}
                  lastName={selectedAppeal.employee_name?.split(' ')[1]}
                  size="lg"
                />
                <div>
                  <h3 className="font-medium text-gray-900 text-lg">
                    {selectedAppeal.employee_name}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedAppeal.employee_number}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm text-primary-600 font-semibold">
                  {selectedAppeal.appeal_number}
                </p>
                <Badge variant={statusColors[selectedAppeal.status]} className="mt-1">
                  {selectedAppeal.status_display}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md">
              <div>
                <p className="text-sm text-gray-500">Appraisal Cycle</p>
                <p className="font-medium">{selectedAppeal.appraisal_cycle}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Submitted</p>
                <p className="font-medium">
                  {new Date(selectedAppeal.submitted_at).toLocaleDateString()}
                </p>
              </div>
              {selectedAppeal.hearing_date && (
                <div>
                  <p className="text-sm text-gray-500">Hearing Date</p>
                  <p className="font-medium">
                    {new Date(selectedAppeal.hearing_date).toLocaleString()}
                  </p>
                </div>
              )}
              {selectedAppeal.decision_date && (
                <div>
                  <p className="text-sm text-gray-500">Decision Date</p>
                  <p className="font-medium">
                    {new Date(selectedAppeal.decision_date).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Grounds for Appeal</h4>
              <p className="text-sm text-gray-700 p-3 bg-gray-50 rounded">
                {selectedAppeal.grounds}
              </p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Requested Remedy</h4>
              <p className="text-sm text-gray-700 p-3 bg-gray-50 rounded">
                {selectedAppeal.requested_remedy}
              </p>
            </div>

            {selectedAppeal.disputed_ratings && Object.keys(selectedAppeal.disputed_ratings).length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Disputed Ratings</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedAppeal.disputed_ratings)
                    .filter(([, v]) => v)
                    .map(([key]) => (
                      <Badge key={key} variant="warning">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            {selectedAppeal.supporting_evidence && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Supporting Evidence</h4>
                <p className="text-sm text-gray-700 p-3 bg-gray-50 rounded">
                  {selectedAppeal.supporting_evidence}
                </p>
              </div>
            )}

            {selectedAppeal.decision && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Decision</h4>
                <p className="text-sm text-gray-700 p-3 bg-green-50 rounded">
                  {selectedAppeal.decision}
                </p>
              </div>
            )}

            {/* Actions */}
            {(selectedAppeal.status === 'SUBMITTED' || selectedAppeal.status === 'UNDER_REVIEW' || selectedAppeal.status === 'HEARING') && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                {selectedAppeal.status === 'SUBMITTED' && (
                  <Button
                    variant="outline"
                    onClick={() => handleOpenHearingModal(selectedAppeal)}
                  >
                    <CalendarDaysIcon className="h-4 w-4 mr-2" />
                    Schedule Hearing
                  </Button>
                )}
                {(selectedAppeal.status === 'UNDER_REVIEW' || selectedAppeal.status === 'HEARING') && (
                  <Button
                    onClick={() => handleOpenDecisionModal(selectedAppeal)}
                  >
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                    Record Decision
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Schedule Hearing Modal */}
      <Modal
        isOpen={showHearingModal}
        onClose={handleCloseHearingModal}
        title="Schedule Hearing"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-md">
            <CalendarDaysIcon className="h-6 w-6 text-blue-500" />
            <p className="text-sm text-blue-700">
              Schedule a hearing for appeal{' '}
              <strong>{selectedAppeal?.appeal_number}</strong>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Hearing Date"
              type="date"
              value={hearingDate}
              onChange={(e) => setHearingDate(e.target.value)}
              required
            />
            <Input
              label="Hearing Time"
              type="time"
              value={hearingTime}
              onChange={(e) => setHearingTime(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={handleCloseHearingModal}>
              Cancel
            </Button>
            <Button
              onClick={handleScheduleHearing}
              isLoading={scheduleHearingMutation.isPending}
            >
              <CalendarDaysIcon className="h-4 w-4 mr-2" />
              Schedule Hearing
            </Button>
          </div>
        </div>
      </Modal>

      {/* Decision Modal */}
      <Modal
        isOpen={showDecisionModal}
        onClose={handleCloseDecisionModal}
        title="Record Decision"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
            <ScaleIcon className="h-6 w-6 text-gray-500" />
            <div>
              <p className="text-sm text-gray-700">
                Record decision for appeal{' '}
                <strong>{selectedAppeal?.appeal_number}</strong>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {selectedAppeal?.employee_name} • {selectedAppeal?.appraisal_cycle}
              </p>
            </div>
          </div>

          <Select
            label="Decision"
            value={decisionStatus}
            onChange={(e) => setDecisionStatus(e.target.value as 'UPHELD' | 'PARTIAL' | 'DISMISSED')}
            options={decisionOptions}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Decision Details <span className="text-red-500">*</span>
            </label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:bg-white hover:border-gray-400 transition-colors duration-150 sm:text-sm"
              rows={4}
              value={decisionText}
              onChange={(e) => setDecisionText(e.target.value)}
              placeholder="Provide detailed reasoning for the decision..."
            />
          </div>

          {decisionStatus === 'UPHELD' && (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-md">
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
              <p className="text-sm text-green-700">
                Upholding this appeal will update the employee's appraisal ratings.
              </p>
            </div>
          )}

          {decisionStatus === 'DISMISSED' && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-md">
              <XCircleIcon className="h-5 w-5 text-yellow-500" />
              <p className="text-sm text-yellow-700">
                Dismissing this appeal will maintain the original appraisal ratings.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={handleCloseDecisionModal}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordDecision}
              isLoading={decideAppealMutation.isPending}
            >
              <CheckCircleIcon className="h-4 w-4 mr-2" />
              Record Decision
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
