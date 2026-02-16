import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  AcademicCapIcon,
  PlusIcon,
  FunnelIcon,
  EyeIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'
import { performanceService, type TrainingNeed, type TrainingStatus } from '@/services/performance'
import { employeeService } from '@/services/employees'
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
  IDENTIFIED: 'info',
  SCHEDULED: 'warning',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
}

const priorityColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'info',
}

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'IDENTIFIED', label: 'Identified' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const priorityOptions = [
  { value: '', label: 'All Priorities' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
]

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'TRAINING', label: 'Training Course' },
  { value: 'CERTIFICATION', label: 'Certification' },
  { value: 'WORKSHOP', label: 'Workshop' },
  { value: 'CONFERENCE', label: 'Conference' },
  { value: 'MENTORING', label: 'Mentoring' },
  { value: 'ONLINE', label: 'Online Course' },
  { value: 'ON_THE_JOB', label: 'On-the-Job Training' },
  { value: 'OTHER', label: 'Other' },
]

const initialFormData = {
  employee: '',
  title: '',
  description: '',
  training_type: 'TRAINING',
  priority: 'MEDIUM',
  target_date: '',
  estimated_cost: '',
  training_provider: '',
}

export default function TrainingNeedsPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [selectedNeed, setSelectedNeed] = useState<TrainingNeed | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [formData, setFormData] = useState(initialFormData)
  const [newStatus, setNewStatus] = useState<TrainingStatus>('SCHEDULED')
  const [completionOutcome, setCompletionOutcome] = useState('')
  const [actualCost, setActualCost] = useState('')

  // Fetch training needs
  const { data: trainingNeeds, isLoading } = useQuery({
    queryKey: ['training-needs', statusFilter, priorityFilter, typeFilter, searchQuery, currentPage],
    queryFn: () =>
      performanceService.getTrainingNeeds({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        type: typeFilter || undefined,
        search: searchQuery || undefined,
        page: currentPage,
      }),
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['training-stats'],
    queryFn: performanceService.getTrainingStats,
  })

  // Fetch employees for create form
  const { data: employees } = useQuery({
    queryKey: ['employees-lookup'],
    queryFn: () => employeeService.getAll({ page: 1 }),
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: performanceService.createTrainingNeed,
    onSuccess: () => {
      toast.success('Training need created successfully')
      queryClient.invalidateQueries({ queryKey: ['training-needs'] })
      queryClient.invalidateQueries({ queryKey: ['training-stats'] })
      setShowCreateModal(false)
      setFormData(initialFormData)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create training need')
    },
  })

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, outcome, cost }: { id: string; status: TrainingStatus; outcome?: string; cost?: number }) =>
      performanceService.updateTrainingStatus(id, status, outcome, cost),
    onSuccess: () => {
      toast.success('Status updated successfully')
      queryClient.invalidateQueries({ queryKey: ['training-needs'] })
      queryClient.invalidateQueries({ queryKey: ['training-stats'] })
      handleCloseStatusModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update status')
    },
  })

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleCreate = () => {
    if (!formData.employee || !formData.title || !formData.description) {
      toast.error('Please fill in all required fields')
      return
    }

    createMutation.mutate({
      ...formData,
      estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : undefined,
    } as any)
  }

  const handleOpenStatusModal = (need: TrainingNeed) => {
    setSelectedNeed(need)
    setNewStatus(need.status === 'IDENTIFIED' ? 'SCHEDULED' : 'IN_PROGRESS')
    setCompletionOutcome('')
    setActualCost('')
    setShowDetailModal(false)
    setShowStatusModal(true)
  }

  const handleCloseStatusModal = () => {
    setShowStatusModal(false)
    setSelectedNeed(null)
    setNewStatus('SCHEDULED')
    setCompletionOutcome('')
    setActualCost('')
  }

  const handleUpdateStatus = () => {
    if (!selectedNeed) return

    updateStatusMutation.mutate({
      id: selectedNeed.id,
      status: newStatus,
      outcome: newStatus === 'COMPLETED' ? completionOutcome : undefined,
      cost: newStatus === 'COMPLETED' && actualCost ? parseFloat(actualCost) : undefined,
    })
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
    }).format(amount)
  }

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (need: TrainingNeed) => (
        <div className="flex items-center gap-3">
          <Avatar
            firstName={need.employee_name?.split(' ')[0]}
            lastName={need.employee_name?.split(' ')[1]}
            size="sm"
          />
          <div>
            <p className="font-medium text-gray-900">{need.employee_name}</p>
            <p className="text-sm text-gray-500">{need.employee_number}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Training',
      render: (need: TrainingNeed) => (
        <div>
          <p className="font-medium text-gray-900">{need.title}</p>
          <p className="text-sm text-gray-500">{need.type_display}</p>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (need: TrainingNeed) => (
        <Badge variant={priorityColors[need.priority] || 'default'}>
          {need.priority_display}
        </Badge>
      ),
    },
    {
      key: 'target_date',
      header: 'Target Date',
      render: (need: TrainingNeed) => (
        <span className="text-sm text-gray-700">
          {need.target_date
            ? new Date(need.target_date).toLocaleDateString()
            : '-'}
        </span>
      ),
    },
    {
      key: 'cost',
      header: 'Est. Cost',
      render: (need: TrainingNeed) => (
        <span className="text-sm font-medium">
          {formatCurrency(need.estimated_cost)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (need: TrainingNeed) => (
        <Badge variant={statusColors[need.status] || 'default'}>
          {need.status_display}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (need: TrainingNeed) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedNeed(need)
              setShowDetailModal(true)
            }}
          >
            <EyeIcon className="h-4 w-4" />
          </Button>
          {need.status !== 'COMPLETED' && need.status !== 'CANCELLED' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenStatusModal(need)}
              title="Update Status"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const highPriorityCount = stats?.by_priority?.find(p => p.priority === 'HIGH')?.count || 0
  const inProgressCount = stats?.by_status?.find(s => s.status === 'IN_PROGRESS')?.count || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Needs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage employee training and development needs
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Training Need
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Training Needs"
          value={stats?.total || 0}
          icon={<AcademicCapIcon className="h-6 w-6" />}
        />
        <StatsCard
          title="High Priority"
          value={highPriorityCount}
          icon={<AcademicCapIcon className="h-6 w-6" />}
          variant={highPriorityCount > 5 ? 'warning' : 'default'}
        />
        <StatsCard
          title="In Progress"
          value={inProgressCount}
          icon={<CalendarIcon className="h-6 w-6" />}
        />
        <StatsCard
          title="Estimated Cost"
          value={formatCurrency(stats?.estimated_cost || 0)}
          icon={<CurrencyDollarIcon className="h-6 w-6" />}
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
            <Select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value)
                setCurrentPage(1)
              }}
              options={priorityOptions}
            />
            <Select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value)
                setCurrentPage(1)
              }}
              options={typeOptions}
            />
            <Input
              placeholder="Search..."
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

      {/* Training Needs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AcademicCapIcon className="h-5 w-5 mr-2 text-gray-500" />
            Training Needs
          </CardTitle>
        </CardHeader>
        <Table
          data={trainingNeeds?.results || []}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No training needs found"
        />
        {trainingNeeds && trainingNeeds.count > pageSize && (
          <TablePagination
            currentPage={currentPage}
            totalPages={Math.ceil(trainingNeeds.count / pageSize)}
            totalItems={trainingNeeds.count}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Training Need Details"
        size="lg"
      >
        {selectedNeed && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar
                firstName={selectedNeed.employee_name?.split(' ')[0]}
                lastName={selectedNeed.employee_name?.split(' ')[1]}
                size="lg"
              />
              <div>
                <h3 className="font-medium text-gray-900 text-lg">
                  {selectedNeed.employee_name}
                </h3>
                <p className="text-sm text-gray-500">{selectedNeed.employee_number}</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-md">
              <h4 className="font-medium text-gray-900 text-lg mb-2">
                {selectedNeed.title}
              </h4>
              <p className="text-sm text-gray-700">{selectedNeed.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Training Type</p>
                <p className="font-medium">{selectedNeed.type_display}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Priority</p>
                <Badge variant={priorityColors[selectedNeed.priority]}>
                  {selectedNeed.priority_display}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={statusColors[selectedNeed.status]}>
                  {selectedNeed.status_display}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Target Date</p>
                <p className="font-medium">
                  {selectedNeed.target_date
                    ? new Date(selectedNeed.target_date).toLocaleDateString()
                    : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Estimated Cost</p>
                <p className="font-medium">{formatCurrency(selectedNeed.estimated_cost)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Actual Cost</p>
                <p className="font-medium">{formatCurrency(selectedNeed.actual_cost)}</p>
              </div>
              {selectedNeed.training_provider && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Training Provider</p>
                  <p className="font-medium">{selectedNeed.training_provider}</p>
                </div>
              )}
              {selectedNeed.competency_name && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Related Competency</p>
                  <p className="font-medium">{selectedNeed.competency_name}</p>
                </div>
              )}
            </div>

            {selectedNeed.outcome && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Outcome</h4>
                <p className="text-sm text-gray-700 p-3 bg-green-50 rounded">
                  {selectedNeed.outcome}
                </p>
              </div>
            )}

            {selectedNeed.status !== 'COMPLETED' && selectedNeed.status !== 'CANCELLED' && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  onClick={() => handleOpenStatusModal(selectedNeed)}
                >
                  <PencilSquareIcon className="h-4 w-4 mr-2" />
                  Update Status
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setFormData(initialFormData)
        }}
        title="Add Training Need"
        size="lg"
      >
        <div className="space-y-4">
          <Select
            label="Employee"
            value={formData.employee}
            onChange={(e) => handleChange('employee', e.target.value)}
            options={[
              { value: '', label: 'Select Employee' },
              ...(employees?.results?.map((emp: any) => ({
                value: emp.id,
                label: `${emp.full_name} (${emp.employee_number})`,
              })) || []),
            ]}
            required
          />

          <Input
            label="Training Title"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="e.g., Advanced Excel Training"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:bg-white hover:border-gray-400 transition-colors duration-150 sm:text-sm"
              rows={3}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe the training need and objectives..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Training Type"
              value={formData.training_type}
              onChange={(e) => handleChange('training_type', e.target.value)}
              options={typeOptions.filter((o) => o.value)}
            />

            <Select
              label="Priority"
              value={formData.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
              options={[
                { value: 'HIGH', label: 'High' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'LOW', label: 'Low' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Target Date"
              type="date"
              value={formData.target_date}
              onChange={(e) => handleChange('target_date', e.target.value)}
            />

            <Input
              label="Estimated Cost (GHS)"
              type="number"
              value={formData.estimated_cost}
              onChange={(e) => handleChange('estimated_cost', e.target.value)}
              placeholder="0.00"
            />
          </div>

          <Input
            label="Training Provider"
            value={formData.training_provider}
            onChange={(e) => handleChange('training_provider', e.target.value)}
            placeholder="e.g., Ghana Institute of Management"
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false)
                setFormData(initialFormData)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} isLoading={createMutation.isPending}>
              Create Training Need
            </Button>
          </div>
        </div>
      </Modal>

      {/* Status Update Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={handleCloseStatusModal}
        title="Update Training Status"
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="New Status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as TrainingStatus)}
            options={[
              { value: 'SCHEDULED', label: 'Scheduled' },
              { value: 'IN_PROGRESS', label: 'In Progress' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ]}
          />

          {newStatus === 'COMPLETED' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Outcome / Notes
                </label>
                <textarea
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:bg-white hover:border-gray-400 transition-colors duration-150 sm:text-sm"
                  rows={3}
                  value={completionOutcome}
                  onChange={(e) => setCompletionOutcome(e.target.value)}
                  placeholder="Describe the training outcome..."
                />
              </div>

              <Input
                label="Actual Cost (GHS)"
                type="number"
                value={actualCost}
                onChange={(e) => setActualCost(e.target.value)}
                placeholder="0.00"
              />
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={handleCloseStatusModal}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateStatus}
              isLoading={updateStatusMutation.isPending}
            >
              <CheckCircleIcon className="h-4 w-4 mr-2" />
              Update Status
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
