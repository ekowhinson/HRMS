import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  PaperAirplaneIcon,
  PauseIcon,
  CubeIcon,
  ClipboardDocumentCheckIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { manufacturingService } from '@/services/manufacturing'
import type {
  WorkOrder,
  WorkOrderStatus,
  WorkOrderFilters,
  BillOfMaterials,
} from '@/services/manufacturing'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Textarea from '@/components/ui/Textarea'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'RELEASED', label: 'Released' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'ON_HOLD', label: 'On Hold' },
]

const PRIORITY_FILTER_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: '1', label: 'Low' },
  { value: '2', label: 'Normal' },
  { value: '3', label: 'High' },
  { value: '4', label: 'Urgent' },
]

const PRIORITY_OPTIONS = [
  { value: '1', label: 'Low' },
  { value: '2', label: 'Normal' },
  { value: '3', label: 'High' },
  { value: '4', label: 'Urgent' },
]

const statusColors: Record<WorkOrderStatus, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'default',
  RELEASED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  ON_HOLD: 'warning',
}

const statusLabels: Record<WorkOrderStatus, string> = {
  DRAFT: 'Draft',
  RELEASED: 'Released',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  ON_HOLD: 'On Hold',
}

const initialFormData = {
  bom: '',
  product: '',
  planned_qty: 1,
  planned_start: '',
  planned_end: '',
  priority: 2,
  notes: '',
}

export default function WorkOrdersPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState(initialFormData)
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState<WorkOrderFilters>({
    search: '',
    status: undefined,
    priority: undefined,
    page: 1,
    page_size: 10,
  })

  // Queries
  const { data: workOrdersData, isLoading } = useQuery({
    queryKey: ['manufacturing-work-orders', filters],
    queryFn: () => manufacturingService.getWorkOrders(filters),
  })

  const { data: bomsData } = useQuery({
    queryKey: ['manufacturing-boms-lookup'],
    queryFn: () => manufacturingService.getBOMs({ status: 'ACTIVE', page_size: 200 }),
  })

  const workOrders = workOrdersData?.results || []
  const totalItems = workOrdersData?.count || 0
  const totalPages = Math.ceil(totalItems / (filters.page_size || 10))
  const allBOMs = bomsData?.results || []

  const bomOptions = allBOMs.map((b: BillOfMaterials) => ({
    value: b.id,
    label: `${b.code} - ${b.name}`,
  }))

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<WorkOrder>) => manufacturingService.createWorkOrder(data),
    onSuccess: () => {
      toast.success('Work order created successfully')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-work-orders'] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create work order')
    },
  })

  const releaseMutation = useMutation({
    mutationFn: (id: string) => manufacturingService.releaseWorkOrder(id),
    onSuccess: () => {
      toast.success('Work order released')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-work-orders'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to release work order')
    },
  })

  const startMutation = useMutation({
    mutationFn: (id: string) => manufacturingService.startWorkOrder(id),
    onSuccess: () => {
      toast.success('Work order started')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-work-orders'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to start work order')
    },
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => manufacturingService.completeWorkOrder(id),
    onSuccess: () => {
      toast.success('Work order completed')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-work-orders'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to complete work order')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => manufacturingService.cancelWorkOrder(id),
    onSuccess: () => {
      toast.success('Work order cancelled')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-work-orders'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to cancel work order')
    },
  })

  const holdMutation = useMutation({
    mutationFn: (id: string) => manufacturingService.holdWorkOrder(id),
    onSuccess: () => {
      toast.success('Work order put on hold')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-work-orders'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to hold work order')
    },
  })

  const issueMaterialsMutation = useMutation({
    mutationFn: (id: string) => manufacturingService.issueMaterials(id),
    onSuccess: () => {
      toast.success('Materials issued successfully')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-work-orders'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to issue materials')
    },
  })

  const reportProductionMutation = useMutation({
    mutationFn: (id: string) => manufacturingService.reportProduction(id),
    onSuccess: () => {
      toast.success('Production reported successfully')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-work-orders'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to report production')
    },
  })

  // Handlers
  const openCreateModal = () => {
    setFormData(initialFormData)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setFormData(initialFormData)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      ...formData,
      priority: Number(formData.priority),
    })
  }

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  // Columns
  const columns = [
    {
      key: 'work_order_number',
      header: 'WO #',
      render: (wo: WorkOrder) => (
        <span className="text-sm font-mono font-medium text-gray-900">
          {wo.work_order_number}
        </span>
      ),
    },
    {
      key: 'product',
      header: 'Product',
      render: (wo: WorkOrder) => (
        <span className="text-sm font-medium text-gray-900">{wo.product_name || wo.product}</span>
      ),
    },
    {
      key: 'planned_qty',
      header: 'Planned Qty',
      render: (wo: WorkOrder) => (
        <span className="text-sm text-gray-700">{wo.planned_qty}</span>
      ),
    },
    {
      key: 'completed_qty',
      header: 'Completed',
      render: (wo: WorkOrder) => (
        <span className="text-sm text-gray-700">{wo.completed_qty}</span>
      ),
    },
    {
      key: 'planned_start',
      header: 'Planned Start',
      render: (wo: WorkOrder) => (
        <span className="text-sm text-gray-500">
          {wo.planned_start ? new Date(wo.planned_start).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      key: 'planned_end',
      header: 'Planned End',
      render: (wo: WorkOrder) => (
        <span className="text-sm text-gray-500">
          {wo.planned_end ? new Date(wo.planned_end).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (wo: WorkOrder) => (
        <Badge variant={statusColors[wo.status]} size="xs">
          {statusLabels[wo.status]}
        </Badge>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (wo: WorkOrder) => {
        const percent = wo.completion_percent ?? (wo.planned_qty > 0 ? Math.round((wo.completed_qty / wo.planned_qty) * 100) : 0)
        return (
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  percent >= 100
                    ? 'bg-green-500'
                    : percent >= 50
                    ? 'bg-blue-500'
                    : 'bg-yellow-500'
                }`}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 whitespace-nowrap">{percent}%</span>
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      render: (wo: WorkOrder) => (
        <div className="flex items-center gap-1">
          {wo.status === 'DRAFT' && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => releaseMutation.mutate(wo.id)}
              disabled={releaseMutation.isPending}
              title="Release"
            >
              <PaperAirplaneIcon className="h-4 w-4 text-blue-600" />
            </Button>
          )}
          {wo.status === 'RELEASED' && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => startMutation.mutate(wo.id)}
              disabled={startMutation.isPending}
              title="Start"
            >
              <PlayIcon className="h-4 w-4 text-green-600" />
            </Button>
          )}
          {wo.status === 'IN_PROGRESS' && (
            <>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => completeMutation.mutate(wo.id)}
                disabled={completeMutation.isPending}
                title="Complete"
              >
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => holdMutation.mutate(wo.id)}
                disabled={holdMutation.isPending}
                title="Hold"
              >
                <PauseIcon className="h-4 w-4 text-orange-500" />
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => issueMaterialsMutation.mutate(wo.id)}
                disabled={issueMaterialsMutation.isPending}
                title="Issue Materials"
              >
                <CubeIcon className="h-4 w-4 text-purple-600" />
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => reportProductionMutation.mutate(wo.id)}
                disabled={reportProductionMutation.isPending}
                title="Report Production"
              >
                <ClipboardDocumentCheckIcon className="h-4 w-4 text-indigo-600" />
              </Button>
            </>
          )}
          {wo.status === 'ON_HOLD' && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => startMutation.mutate(wo.id)}
              disabled={startMutation.isPending}
              title="Resume"
            >
              <PlayIcon className="h-4 w-4 text-green-600" />
            </Button>
          )}
          {(wo.status === 'DRAFT' || wo.status === 'RELEASED' || wo.status === 'ON_HOLD') && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                if (confirm(`Cancel work order ${wo.work_order_number}?`)) {
                  cancelMutation.mutate(wo.id)
                }
              }}
              disabled={cancelMutation.isPending}
              title="Cancel"
            >
              <XCircleIcon className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Orders"
        subtitle="Manage production work orders and track progress"
        actions={
          <Button onClick={openCreateModal}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Work Order
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search work orders..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                leftIcon={<MagnifyingGlassIcon className="h-5 w-5" />}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                options={STATUS_FILTER_OPTIONS}
                value={filters.status || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: (e.target.value || undefined) as WorkOrderStatus | undefined,
                    page: 1,
                  }))
                }
                placeholder="Status"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                options={PRIORITY_FILTER_OPTIONS}
                value={filters.priority?.toString() || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    priority: e.target.value ? parseInt(e.target.value) : undefined,
                    page: 1,
                  }))
                }
                placeholder="Priority"
              />
            </div>
            <Button variant="secondary" onClick={handleSearch}>
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Work Orders Table */}
      <Card>
        {isLoading ? (
          <SkeletonTable />
        ) : workOrders.length === 0 ? (
          <EmptyState
            type="data"
            title="No work orders found"
            description="Create your first work order to start production tracking."
            action={{ label: 'Create Work Order', onClick: openCreateModal }}
          />
        ) : (
          <>
            <Table data={workOrders} columns={columns} />
            {totalPages > 1 && (
              <TablePagination
                currentPage={filters.page || 1}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={filters.page_size || 10}
                onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
              />
            )}
          </>
        )}
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title="Create Work Order"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Bill of Materials"
            options={bomOptions}
            value={formData.bom}
            onChange={(e) => setFormData({ ...formData, bom: e.target.value })}
            placeholder="Select BOM"
            required
          />

          <Input
            label="Product"
            value={formData.product}
            onChange={(e) => setFormData({ ...formData, product: e.target.value })}
            placeholder="Product name or ID"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Planned Quantity"
              type="number"
              min="1"
              value={formData.planned_qty}
              onChange={(e) =>
                setFormData({ ...formData, planned_qty: parseInt(e.target.value) || 1 })
              }
              required
            />
            <Select
              label="Priority"
              options={PRIORITY_OPTIONS}
              value={formData.priority.toString()}
              onChange={(e) =>
                setFormData({ ...formData, priority: parseInt(e.target.value) || 2 })
              }
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Planned Start"
              type="date"
              value={formData.planned_start}
              onChange={(e) => setFormData({ ...formData, planned_start: e.target.value })}
              required
            />
            <Input
              label="Planned End"
              type="date"
              value={formData.planned_end}
              onChange={(e) => setFormData({ ...formData, planned_end: e.target.value })}
              required
            />
          </div>

          <Textarea
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes..."
            rows={2}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Work Order
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
