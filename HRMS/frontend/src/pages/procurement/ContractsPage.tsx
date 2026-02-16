import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  FlagIcon,
} from '@heroicons/react/24/outline'
import {
  procurementService,
  type Contract,
  type ContractMilestone,
  type ContractStatus,
  type ContractType,
  type MilestoneStatus,
} from '@/services/procurement'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatCurrency, formatDate } from '@/lib/utils'

// ==================== Status Helpers ====================

const statusColors: Record<ContractStatus, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  ACTIVE: 'success',
  EXPIRED: 'danger',
  TERMINATED: 'danger',
  RENEWED: 'info',
}

const milestoneStatusColors: Record<MilestoneStatus, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  PENDING: 'default',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  OVERDUE: 'danger',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'RENEWED', label: 'Renewed' },
]

const CONTRACT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'SUPPLY', label: 'Supply' },
  { value: 'CONSULTING', label: 'Consulting' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'OTHER', label: 'Other' },
]

const CONTRACT_TYPE_FORM_OPTIONS = [
  { value: 'SERVICE', label: 'Service' },
  { value: 'SUPPLY', label: 'Supply' },
  { value: 'CONSULTING', label: 'Consulting' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'OTHER', label: 'Other' },
]

const CONTRACT_STATUS_FORM_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'RENEWED', label: 'Renewed' },
]

const MILESTONE_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'OVERDUE', label: 'Overdue' },
]

// ==================== Blank Milestone ====================

const BLANK_MILESTONE = {
  description: '',
  due_date: '',
  amount: 0,
  status: 'PENDING' as MilestoneStatus,
}

// ==================== Helper Functions ====================

function getDaysUntilExpiry(endDate: string): number {
  const end = new Date(endDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getExpiryBadge(endDate: string, status: ContractStatus) {
  if (status !== 'ACTIVE') return null
  const daysLeft = getDaysUntilExpiry(endDate)

  if (daysLeft < 0) {
    return (
      <Badge variant="danger" size="xs" dot pulse>
        Expired
      </Badge>
    )
  }
  if (daysLeft <= 30) {
    return (
      <Badge variant="warning" size="xs" dot>
        {daysLeft}d left
      </Badge>
    )
  }
  if (daysLeft <= 90) {
    return (
      <Badge variant="info" size="xs">
        {daysLeft}d left
      </Badge>
    )
  }
  return null
}

// ==================== Component ====================

export default function ContractsPage() {
  const queryClient = useQueryClient()

  // Filter state
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showMilestoneModal, setShowMilestoneModal] = useState(false)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [activeDetailTab, setActiveDetailTab] = useState('details')

  // Form state
  const [formData, setFormData] = useState({
    vendor: '',
    contract_type: 'SERVICE' as ContractType,
    start_date: '',
    end_date: '',
    value: 0,
    status: 'DRAFT' as ContractStatus,
    renewal_date: '',
    description: '',
  })
  const [milestones, setMilestones] = useState<Array<typeof BLANK_MILESTONE>>([])

  // Milestone form
  const [milestoneForm, setMilestoneForm] = useState({ ...BLANK_MILESTONE })
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null)

  // ==================== Queries ====================

  const { data: contractsData, isLoading } = useQuery({
    queryKey: ['procurement-contracts', statusFilter, typeFilter, searchQuery, currentPage],
    queryFn: () =>
      procurementService.getContracts({
        status: statusFilter || undefined,
        contract_type: typeFilter || undefined,
        search: searchQuery || undefined,
        page: currentPage,
      }),
  })

  // Fetch milestones for selected contract
  const { data: contractMilestones, isLoading: milestonesLoading } = useQuery({
    queryKey: ['procurement-milestones', selectedContract?.id],
    queryFn: () => procurementService.getMilestones(selectedContract!.id),
    enabled: !!selectedContract?.id && showDetailModal,
  })

  const contracts = contractsData?.results || []
  const totalCount = contractsData?.count || 0
  const totalPages = Math.ceil(totalCount / pageSize)

  // ==================== Computed Values ====================

  const contractStats = useMemo(() => {
    if (!contracts.length) return null
    const active = contracts.filter((c) => c.status === 'ACTIVE').length
    const nearExpiry = contracts.filter(
      (c) => c.status === 'ACTIVE' && getDaysUntilExpiry(c.end_date) <= 30 && getDaysUntilExpiry(c.end_date) >= 0
    ).length
    const expired = contracts.filter(
      (c) => c.status === 'ACTIVE' && getDaysUntilExpiry(c.end_date) < 0
    ).length
    const totalValue = contracts.reduce((sum, c) => sum + (c.value || 0), 0)
    return { active, nearExpiry, expired, totalValue }
  }, [contracts])

  // ==================== Mutations ====================

  const createMutation = useMutation({
    mutationFn: (data: any) => procurementService.createContract(data),
    onSuccess: () => {
      toast.success('Contract created successfully')
      queryClient.invalidateQueries({ queryKey: ['procurement-contracts'] })
      handleCloseCreateModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create contract')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => procurementService.updateContract(id, data),
    onSuccess: () => {
      toast.success('Contract updated successfully')
      queryClient.invalidateQueries({ queryKey: ['procurement-contracts'] })
      handleCloseCreateModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update contract')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => procurementService.deleteContract(id),
    onSuccess: () => {
      toast.success('Contract deleted')
      queryClient.invalidateQueries({ queryKey: ['procurement-contracts'] })
      setShowDetailModal(false)
      setSelectedContract(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete contract')
    },
  })

  const createMilestoneMutation = useMutation({
    mutationFn: (data: any) => procurementService.createMilestone(data),
    onSuccess: () => {
      toast.success('Milestone added')
      queryClient.invalidateQueries({ queryKey: ['procurement-milestones', selectedContract?.id] })
      setShowMilestoneModal(false)
      setMilestoneForm({ ...BLANK_MILESTONE })
      setEditingMilestoneId(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to add milestone')
    },
  })

  const updateMilestoneMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => procurementService.updateMilestone(id, data),
    onSuccess: () => {
      toast.success('Milestone updated')
      queryClient.invalidateQueries({ queryKey: ['procurement-milestones', selectedContract?.id] })
      setShowMilestoneModal(false)
      setMilestoneForm({ ...BLANK_MILESTONE })
      setEditingMilestoneId(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update milestone')
    },
  })

  const deleteMilestoneMutation = useMutation({
    mutationFn: (id: string) => procurementService.deleteMilestone(id),
    onSuccess: () => {
      toast.success('Milestone deleted')
      queryClient.invalidateQueries({ queryKey: ['procurement-milestones', selectedContract?.id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete milestone')
    },
  })

  // ==================== Handlers ====================

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    setIsEditing(false)
    setFormData({
      vendor: '',
      contract_type: 'SERVICE',
      start_date: '',
      end_date: '',
      value: 0,
      status: 'DRAFT',
      renewal_date: '',
      description: '',
    })
    setMilestones([])
  }

  const handleOpenEdit = (contract: Contract) => {
    setFormData({
      vendor: contract.vendor || '',
      contract_type: contract.contract_type,
      start_date: contract.start_date,
      end_date: contract.end_date,
      value: contract.value,
      status: contract.status,
      renewal_date: contract.renewal_date || '',
      description: contract.description,
    })
    setSelectedContract(contract)
    setIsEditing(true)
    setShowDetailModal(false)
    setShowCreateModal(true)
  }

  const handleViewDetail = (contract: Contract) => {
    setSelectedContract(contract)
    setActiveDetailTab('details')
    setShowDetailModal(true)
  }

  const handleOpenMilestoneForm = (milestone?: ContractMilestone) => {
    if (milestone) {
      setMilestoneForm({
        description: milestone.description,
        due_date: milestone.due_date,
        amount: milestone.amount,
        status: milestone.status,
      })
      setEditingMilestoneId(milestone.id)
    } else {
      setMilestoneForm({ ...BLANK_MILESTONE })
      setEditingMilestoneId(null)
    }
    setShowMilestoneModal(true)
  }

  const addFormMilestone = () => {
    setMilestones([...milestones, { ...BLANK_MILESTONE }])
  }

  const removeFormMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index))
  }

  const updateFormMilestone = (index: number, field: string, value: any) => {
    const updated = [...milestones]
    updated[index] = { ...updated[index], [field]: value }
    setMilestones(updated)
  }

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      ...formData,
      vendor: formData.vendor || null,
      renewal_date: formData.renewal_date || null,
      milestones: milestones.filter((m) => m.description.trim() !== ''),
    }

    if (isEditing && selectedContract) {
      updateMutation.mutate({ id: selectedContract.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleSubmitMilestone = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedContract) return

    const data = {
      ...milestoneForm,
      contract: selectedContract.id,
    }

    if (editingMilestoneId) {
      updateMilestoneMutation.mutate({ id: editingMilestoneId, data })
    } else {
      createMilestoneMutation.mutate(data)
    }
  }

  // ==================== Milestone Timeline ====================

  const MilestoneTimeline = ({ milestones: ms }: { milestones: ContractMilestone[] }) => {
    if (!ms || ms.length === 0) {
      return (
        <div className="text-center py-8 text-sm text-gray-500">
          No milestones defined for this contract.
        </div>
      )
    }

    const sorted = [...ms].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

    return (
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-6">
          {sorted.map((milestone) => {
            const isOverdue =
              milestone.status !== 'COMPLETED' && getDaysUntilExpiry(milestone.due_date) < 0
            const statusToShow = isOverdue ? 'OVERDUE' : milestone.status

            const iconMap: Record<string, React.ReactNode> = {
              PENDING: <ClockIcon className="h-4 w-4 text-gray-400" />,
              IN_PROGRESS: <FlagIcon className="h-4 w-4 text-info-500" />,
              COMPLETED: <CheckCircleIcon className="h-4 w-4 text-success-500" />,
              OVERDUE: <ExclamationTriangleIcon className="h-4 w-4 text-danger-500" />,
            }

            const bgMap: Record<string, string> = {
              PENDING: 'bg-gray-100 border-gray-200',
              IN_PROGRESS: 'bg-info-50 border-info-200',
              COMPLETED: 'bg-success-50 border-success-200',
              OVERDUE: 'bg-danger-50 border-danger-200',
            }

            return (
              <div key={milestone.id} className="relative flex items-start gap-4">
                {/* Timeline dot */}
                <div
                  className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 ${bgMap[statusToShow] || bgMap.PENDING}`}
                >
                  {iconMap[statusToShow] || iconMap.PENDING}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{milestone.description}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Due: {formatDate(milestone.due_date)}
                        {milestone.completion_date && (
                          <span className="text-success-600">
                            {' '}| Completed: {formatDate(milestone.completion_date)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(milestone.amount)}
                      </span>
                      <Badge variant={milestoneStatusColors[statusToShow as MilestoneStatus] || 'default'} size="xs">
                        {milestone.status_display || statusToShow.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </div>
                  {/* Action buttons for milestones */}
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleOpenMilestoneForm(milestone)}
                    >
                      <PencilSquareIcon className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-danger-600 hover:text-danger-700"
                      onClick={() => {
                        if (confirm('Delete this milestone?')) {
                          deleteMilestoneMutation.mutate(milestone.id)
                        }
                      }}
                    >
                      <TrashIcon className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ==================== Table Columns ====================

  const columns = [
    {
      key: 'contract_number',
      header: 'Contract No.',
      render: (c: Contract) => (
        <span className="text-sm font-medium text-primary-600">{c.contract_number}</span>
      ),
    },
    {
      key: 'vendor',
      header: 'Vendor',
      render: (c: Contract) => (
        <span className="text-sm text-gray-700">{c.vendor_name || '-'}</span>
      ),
    },
    {
      key: 'contract_type',
      header: 'Type',
      render: (c: Contract) => (
        <span className="text-sm text-gray-700">{c.contract_type_display || c.contract_type}</span>
      ),
    },
    {
      key: 'dates',
      header: 'Period',
      render: (c: Contract) => (
        <div className="text-sm text-gray-700">
          <p>{formatDate(c.start_date)}</p>
          <p className="text-gray-500">to {formatDate(c.end_date)}</p>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: (c: Contract) => (
        <span className="text-sm font-medium text-gray-900">{formatCurrency(c.value)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c: Contract) => (
        <div className="flex items-center gap-2">
          <Badge variant={statusColors[c.status] || 'default'} dot>
            {c.status_display || c.status}
          </Badge>
          {getExpiryBadge(c.end_date, c.status)}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (c: Contract) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => handleViewDetail(c)}>
            <EyeIcon className="h-4 w-4" />
          </Button>
          {c.status === 'DRAFT' && (
            <Button variant="ghost" size="xs" onClick={() => handleOpenEdit(c)}>
              <PencilSquareIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  // ==================== Render ====================

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracts"
        subtitle="Manage vendor contracts and milestones"
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        }
      />

      {/* Summary Stats */}
      {contractStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Active Contracts</p>
              <p className="text-2xl font-bold text-success-600">{contractStats.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Near Expiry (30d)</p>
              <p className="text-2xl font-bold text-warning-600">{contractStats.nearExpiry}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Overdue / Expired</p>
              <p className="text-2xl font-bold text-danger-600">{contractStats.expired}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(contractStats.totalValue)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Search contracts..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
            />
            <Select
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Filter by status"
            />
            <Select
              options={CONTRACT_TYPE_OPTIONS}
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Filter by type"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contracts List */}
      <Card>
        <Table
          data={contracts}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No contracts found"
          emptyType="data"
          emptyAction={{
            label: 'Create Contract',
            onClick: () => setShowCreateModal(true),
          }}
          onRowClick={handleViewDetail}
        />
        {totalPages > 1 && (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        )}
      </Card>

      {/* Create/Edit Contract Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        title={isEditing ? 'Edit Contract' : 'New Contract'}
        size="xl"
      >
        <form onSubmit={handleSubmitForm} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Vendor"
              placeholder="Enter vendor name or ID"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
            />
            <Select
              label="Contract Type"
              options={CONTRACT_TYPE_FORM_OPTIONS}
              value={formData.contract_type}
              onChange={(e) => setFormData({ ...formData, contract_type: e.target.value as ContractType })}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <Input
              label="Renewal Date (Optional)"
              type="date"
              value={formData.renewal_date}
              onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Contract Value"
              type="number"
              min="0"
              step="0.01"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
              required
            />
            <Select
              label="Status"
              options={CONTRACT_STATUS_FORM_OPTIONS}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as ContractStatus })}
            />
          </div>

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Contract description and key terms..."
            rows={3}
          />

          {/* Milestones for new contracts */}
          {!isEditing && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">Milestones (Optional)</h4>
                <Button type="button" variant="outline" size="sm" onClick={addFormMilestone}>
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Milestone
                </Button>
              </div>

              {milestones.length > 0 && (
                <div className="space-y-3">
                  {milestones.map((ms, index) => (
                    <div
                      key={index}
                      className="border border-gray-300 rounded-md p-4 bg-gray-50/50"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-5">
                          <Input
                            label={index === 0 ? 'Description' : undefined}
                            placeholder="Milestone description"
                            value={ms.description}
                            onChange={(e) => updateFormMilestone(index, 'description', e.target.value)}
                          />
                        </div>
                        <div className="md:col-span-3">
                          <Input
                            label={index === 0 ? 'Due Date' : undefined}
                            type="date"
                            value={ms.due_date}
                            onChange={(e) => updateFormMilestone(index, 'due_date', e.target.value)}
                          />
                        </div>
                        <div className="md:col-span-3">
                          <Input
                            label={index === 0 ? 'Amount' : undefined}
                            type="number"
                            min="0"
                            step="0.01"
                            value={ms.amount}
                            onChange={(e) => updateFormMilestone(index, 'amount', Number(e.target.value))}
                          />
                        </div>
                        <div className="md:col-span-1 flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFormMilestone(index)}
                            className="text-danger-600 hover:text-danger-700"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={handleCloseCreateModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {isEditing ? 'Update Contract' : 'Create Contract'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedContract(null)
        }}
        title={`Contract ${selectedContract?.contract_number || ''}`}
        size="xl"
      >
        {selectedContract && (
          <div className="space-y-5">
            <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab}>
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="milestones">
                  Milestones
                  {contractMilestones && contractMilestones.length > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-primary-100 text-primary-700 rounded-full">
                      {contractMilestones.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="details">
                <div className="space-y-5">
                  {/* Header Info */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={statusColors[selectedContract.status] || 'default'} dot>
                          {selectedContract.status_display || selectedContract.status}
                        </Badge>
                        {getExpiryBadge(selectedContract.end_date, selectedContract.status)}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Vendor</p>
                      <p className="text-sm font-medium text-gray-900">{selectedContract.vendor_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Type</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedContract.contract_type_display || selectedContract.contract_type}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Start Date</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(selectedContract.start_date)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">End Date</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(selectedContract.end_date)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Value</p>
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(selectedContract.value)}</p>
                    </div>
                    {selectedContract.renewal_date && (
                      <div>
                        <p className="text-sm text-gray-500">Renewal Date</p>
                        <p className="text-sm font-medium text-gray-900">{formatDate(selectedContract.renewal_date)}</p>
                      </div>
                    )}
                    {selectedContract.status === 'ACTIVE' && (
                      <div>
                        <p className="text-sm text-gray-500">Days Remaining</p>
                        <p className={`text-sm font-bold ${
                          getDaysUntilExpiry(selectedContract.end_date) < 0
                            ? 'text-danger-600'
                            : getDaysUntilExpiry(selectedContract.end_date) <= 30
                            ? 'text-warning-600'
                            : 'text-success-600'
                        }`}>
                          {getDaysUntilExpiry(selectedContract.end_date)} days
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {selectedContract.description && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Description</p>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md whitespace-pre-wrap">
                        {selectedContract.description}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="milestones">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">Contract Milestones</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenMilestoneForm()}
                    >
                      <PlusIcon className="h-4 w-4 mr-1" />
                      Add Milestone
                    </Button>
                  </div>

                  {milestonesLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-20" />
                      ))}
                    </div>
                  ) : contractMilestones && contractMilestones.length > 0 ? (
                    <div className="overflow-x-auto border border-gray-300 rounded-md">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Due Date</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Completed</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {contractMilestones.map((ms) => {
                            const isOverdue = ms.status !== 'COMPLETED' && getDaysUntilExpiry(ms.due_date) < 0
                            return (
                              <tr key={ms.id} className={isOverdue ? 'bg-danger-50/30' : ''}>
                                <td className="px-4 py-2 text-sm text-gray-900">{ms.description}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">
                                  {formatDate(ms.due_date)}
                                  {isOverdue && (
                                    <span className="ml-2 text-xs text-danger-600 font-medium">Overdue</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                                  {formatCurrency(ms.amount)}
                                </td>
                                <td className="px-4 py-2">
                                  <Badge
                                    variant={milestoneStatusColors[isOverdue ? 'OVERDUE' : ms.status] || 'default'}
                                    size="xs"
                                  >
                                    {isOverdue ? 'Overdue' : (ms.status_display || ms.status.replace(/_/g, ' '))}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500">
                                  {ms.completion_date ? formatDate(ms.completion_date) : '-'}
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      onClick={() => handleOpenMilestoneForm(ms)}
                                    >
                                      <PencilSquareIcon className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      className="text-danger-600"
                                      onClick={() => {
                                        if (confirm('Delete this milestone?')) {
                                          deleteMilestoneMutation.mutate(ms.id)
                                        }
                                      }}
                                    >
                                      <TrashIcon className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={2} className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">
                              Total Milestone Value
                            </td>
                            <td className="px-4 py-2 text-sm font-bold text-gray-900 text-right">
                              {formatCurrency(
                                contractMilestones.reduce((sum, ms) => sum + ms.amount, 0)
                              )}
                            </td>
                            <td colSpan={3} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CalendarDaysIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">No milestones defined yet</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => handleOpenMilestoneForm()}
                      >
                        <PlusIcon className="h-4 w-4 mr-1" />
                        Add First Milestone
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="timeline">
                {milestonesLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : (
                  <MilestoneTimeline milestones={contractMilestones || []} />
                )}
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-gray-200">
              {selectedContract.status === 'DRAFT' && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this contract?')) {
                        deleteMutation.mutate(selectedContract.id)
                      }
                    }}
                    isLoading={deleteMutation.isPending}
                  >
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenEdit(selectedContract)}
                  >
                    <PencilSquareIcon className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </>
              )}
              {selectedContract.status === 'ACTIVE' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleOpenEdit(selectedContract)}
                >
                  <PencilSquareIcon className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedContract(null)
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Milestone Add/Edit Modal */}
      <Modal
        isOpen={showMilestoneModal}
        onClose={() => {
          setShowMilestoneModal(false)
          setMilestoneForm({ ...BLANK_MILESTONE })
          setEditingMilestoneId(null)
        }}
        title={editingMilestoneId ? 'Edit Milestone' : 'Add Milestone'}
        size="md"
      >
        <form onSubmit={handleSubmitMilestone} className="space-y-4">
          <Textarea
            label="Description"
            value={milestoneForm.description}
            onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
            placeholder="Milestone description..."
            rows={2}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Due Date"
              type="date"
              value={milestoneForm.due_date}
              onChange={(e) => setMilestoneForm({ ...milestoneForm, due_date: e.target.value })}
              required
            />
            <Input
              label="Amount"
              type="number"
              min="0"
              step="0.01"
              value={milestoneForm.amount}
              onChange={(e) => setMilestoneForm({ ...milestoneForm, amount: Number(e.target.value) })}
              required
            />
          </div>

          <Select
            label="Status"
            options={MILESTONE_STATUS_OPTIONS}
            value={milestoneForm.status}
            onChange={(e) => setMilestoneForm({ ...milestoneForm, status: e.target.value as MilestoneStatus })}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowMilestoneModal(false)
                setMilestoneForm({ ...BLANK_MILESTONE })
                setEditingMilestoneId(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMilestoneMutation.isPending || updateMilestoneMutation.isPending}
            >
              {editingMilestoneId ? 'Update Milestone' : 'Add Milestone'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
