import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { manufacturingService } from '@/services/manufacturing'
import type {
  QualityCheck,
  QualityCheckType,
  QualityCheckResult,
  QualityCheckFilters,
  WorkOrder,
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

const CHECK_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'IN_PROCESS', label: 'In-Process' },
  { value: 'FINAL', label: 'Final' },
  { value: 'INCOMING', label: 'Incoming' },
]

const CHECK_TYPE_FORM_OPTIONS = [
  { value: 'IN_PROCESS', label: 'In-Process' },
  { value: 'FINAL', label: 'Final' },
  { value: 'INCOMING', label: 'Incoming' },
]

const RESULT_FILTER_OPTIONS = [
  { value: '', label: 'All Results' },
  { value: 'PASS', label: 'Pass' },
  { value: 'FAIL', label: 'Fail' },
  { value: 'CONDITIONAL', label: 'Conditional' },
]

const RESULT_FORM_OPTIONS = [
  { value: 'PASS', label: 'Pass' },
  { value: 'FAIL', label: 'Fail' },
  { value: 'CONDITIONAL', label: 'Conditional' },
]

const resultColors: Record<QualityCheckResult, 'success' | 'danger' | 'warning'> = {
  PASS: 'success',
  FAIL: 'danger',
  CONDITIONAL: 'warning',
}

const checkTypeLabels: Record<QualityCheckType, string> = {
  IN_PROCESS: 'In-Process',
  FINAL: 'Final',
  INCOMING: 'Incoming',
}

const initialFormData = {
  work_order: '',
  check_type: 'IN_PROCESS' as QualityCheckType,
  parameter: '',
  specification: '',
  actual_value: '',
  result: 'PASS' as QualityCheckResult,
  notes: '',
}

export default function QualityPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState(initialFormData)
  const [filters, setFilters] = useState<QualityCheckFilters & { work_order_filter?: string }>({
    check_type: undefined,
    result: undefined,
    work_order_filter: '',
    page: 1,
    page_size: 10,
  })

  // Queries - fetch work orders for the select dropdowns
  const { data: workOrdersData } = useQuery({
    queryKey: ['manufacturing-work-orders-lookup'],
    queryFn: () => manufacturingService.getWorkOrders({ page_size: 200 }),
  })

  const allWorkOrders = workOrdersData?.results || []

  const workOrderOptions = allWorkOrders.map((wo: WorkOrder) => ({
    value: wo.id,
    label: `${wo.work_order_number} - ${wo.product_name || wo.product}`,
  }))

  // Quality checks query - the service requires a work_order ID
  // We fetch all checks by using the selected work order filter
  const activeWorkOrderId = filters.work_order_filter || ''

  const { data: qualityChecksData, isLoading } = useQuery({
    queryKey: ['manufacturing-quality-checks', activeWorkOrderId, filters],
    queryFn: () =>
      manufacturingService.getQualityChecks(activeWorkOrderId, {
        check_type: filters.check_type,
        result: filters.result,
        page: filters.page,
        page_size: filters.page_size,
      }),
    enabled: !!activeWorkOrderId,
  })

  const qualityChecks = qualityChecksData?.results || []
  const totalItems = qualityChecksData?.count || 0
  const totalPages = Math.ceil(totalItems / (filters.page_size || 10))

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<QualityCheck>) => manufacturingService.createQualityCheck(data),
    onSuccess: () => {
      toast.success('Quality check recorded successfully')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-quality-checks'] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to record quality check')
    },
  })

  // Handlers
  const openCreateModal = () => {
    setFormData({
      ...initialFormData,
      work_order: activeWorkOrderId || '',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setFormData(initialFormData)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  const getWorkOrderNumber = (workOrderId: string) => {
    const wo = allWorkOrders.find((w: WorkOrder) => w.id === workOrderId)
    return wo ? wo.work_order_number : '-'
  }

  // Columns
  const columns = [
    {
      key: 'work_order',
      header: 'Work Order',
      render: (qc: QualityCheck) => (
        <span className="text-sm font-mono font-medium text-gray-900">
          {getWorkOrderNumber(qc.work_order)}
        </span>
      ),
    },
    {
      key: 'check_type',
      header: 'Check Type',
      render: (qc: QualityCheck) => (
        <Badge variant="info" size="xs">
          {checkTypeLabels[qc.check_type]}
        </Badge>
      ),
    },
    {
      key: 'parameter',
      header: 'Parameter',
      render: (qc: QualityCheck) => (
        <span className="text-sm font-medium text-gray-900">{qc.parameter}</span>
      ),
    },
    {
      key: 'specification',
      header: 'Specification',
      render: (qc: QualityCheck) => (
        <span className="text-sm text-gray-700">{qc.specification}</span>
      ),
    },
    {
      key: 'actual_value',
      header: 'Actual Value',
      render: (qc: QualityCheck) => (
        <span className="text-sm text-gray-700">{qc.actual_value}</span>
      ),
    },
    {
      key: 'result',
      header: 'Result',
      render: (qc: QualityCheck) => (
        <Badge variant={resultColors[qc.result]} size="xs">
          {qc.result}
        </Badge>
      ),
    },
    {
      key: 'checked_by',
      header: 'Checked By',
      render: (qc: QualityCheck) => (
        <span className="text-sm text-gray-700">{qc.checked_by_name || '-'}</span>
      ),
    },
    {
      key: 'checked_at',
      header: 'Checked At',
      render: (qc: QualityCheck) => (
        <span className="text-sm text-gray-500">
          {qc.checked_at ? new Date(qc.checked_at).toLocaleString() : '-'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quality Control"
        subtitle="Record and track quality checks for production work orders"
        actions={
          <Button onClick={openCreateModal} disabled={!activeWorkOrderId}>
            <PlusIcon className="h-4 w-4 mr-2" />
            New Quality Check
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-64">
              <Select
                options={[{ value: '', label: 'Select Work Order' }, ...workOrderOptions]}
                value={filters.work_order_filter || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    work_order_filter: e.target.value || '',
                    page: 1,
                  }))
                }
                placeholder="Work Order"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                options={CHECK_TYPE_OPTIONS}
                value={filters.check_type || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    check_type: (e.target.value || undefined) as QualityCheckType | undefined,
                    page: 1,
                  }))
                }
                placeholder="Check Type"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                options={RESULT_FILTER_OPTIONS}
                value={filters.result || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    result: (e.target.value || undefined) as QualityCheckResult | undefined,
                    page: 1,
                  }))
                }
                placeholder="Result"
              />
            </div>
            <Button
              variant="ghost"
              onClick={() =>
                setFilters({
                  work_order_filter: '',
                  page: 1,
                  page_size: 10,
                })
              }
            >
              <ArrowPathIcon className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quality Checks Table */}
      <Card>
        {!activeWorkOrderId ? (
          <EmptyState
            type="data"
            title="Select a Work Order"
            description="Choose a work order from the filter above to view its quality checks."
          />
        ) : isLoading ? (
          <SkeletonTable />
        ) : qualityChecks.length === 0 ? (
          <EmptyState
            type="data"
            title="No quality checks found"
            description="Record a quality check for this work order."
            action={{ label: 'New Quality Check', onClick: openCreateModal }}
          />
        ) : (
          <>
            <Table data={qualityChecks} columns={columns} />
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

      {/* Create Quality Check Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title="New Quality Check"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Work Order"
            options={workOrderOptions}
            value={formData.work_order}
            onChange={(e) => setFormData({ ...formData, work_order: e.target.value })}
            placeholder="Select work order"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Check Type"
              options={CHECK_TYPE_FORM_OPTIONS}
              value={formData.check_type}
              onChange={(e) =>
                setFormData({ ...formData, check_type: e.target.value as QualityCheckType })
              }
              required
            />
            <Select
              label="Result"
              options={RESULT_FORM_OPTIONS}
              value={formData.result}
              onChange={(e) =>
                setFormData({ ...formData, result: e.target.value as QualityCheckResult })
              }
              required
            />
          </div>

          <Input
            label="Parameter"
            value={formData.parameter}
            onChange={(e) => setFormData({ ...formData, parameter: e.target.value })}
            placeholder="e.g., Tensile Strength, Dimension, Weight"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Specification"
              value={formData.specification}
              onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
              placeholder="e.g., 50-60 MPa, 10mm +/- 0.5"
              required
            />
            <Input
              label="Actual Value"
              value={formData.actual_value}
              onChange={(e) => setFormData({ ...formData, actual_value: e.target.value })}
              placeholder="e.g., 55 MPa, 10.2mm"
              required
            />
          </div>

          <Textarea
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional observations or notes..."
            rows={2}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Record Quality Check
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
