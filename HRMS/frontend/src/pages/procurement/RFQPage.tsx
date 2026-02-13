import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PaperAirplaneIcon,
  CheckIcon,
  TrophyIcon,
  DocumentDuplicateIcon,
  MagnifyingGlassIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import {
  procurementService,
  type PurchaseRequisition,
} from '@/services/procurement'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import Textarea from '@/components/ui/Textarea'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { formatDate } from '@/lib/utils'

// ==================== Types ====================

type RFQStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'EVALUATED' | 'AWARDED'

interface RFQ {
  id: string
  rfq_number: string
  requisition: string | null
  requisition_number?: string
  status: RFQStatus
  status_display?: string
  submission_deadline: string
  evaluation_criteria: string
  notes: string
  vendor_count?: number
  vendors?: any[]
  awarded_vendor?: string
  awarded_vendor_name?: string
  created_at: string
  updated_at?: string
}

// ==================== Form ====================

interface RFQFormData {
  requisition: string
  submission_deadline: string
  evaluation_criteria: string
  notes: string
}

const defaultFormData: RFQFormData = {
  requisition: '',
  submission_deadline: '',
  evaluation_criteria: '',
  notes: '',
}

// ==================== Helpers ====================

const statusColors: Record<RFQStatus, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'default',
  SENT: 'info',
  RECEIVED: 'warning',
  EVALUATED: 'success',
  AWARDED: 'success',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'EVALUATED', label: 'Evaluated' },
  { value: 'AWARDED', label: 'Awarded' },
]

// ==================== Component ====================

export default function RFQPage() {
  const queryClient = useQueryClient()

  // List state
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const pageSize = 20

  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState<RFQFormData>(defaultFormData)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null)

  // ==================== Queries ====================

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['procurement-rfqs', page, search, statusFilter],
    queryFn: () =>
      (procurementService as any).getRFQs({
        page,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  })

  const { data: requisitionsData } = useQuery({
    queryKey: ['procurement-requisitions-for-rfq'],
    queryFn: () => procurementService.getRequisitions({ status: 'APPROVED' }),
  })

  const rfqs: RFQ[] = data?.results || []
  const totalItems = data?.count || 0
  const totalPages = Math.ceil(totalItems / pageSize)
  const approvedRequisitions: PurchaseRequisition[] = requisitionsData?.results || []

  const requisitionOptions = [
    { value: '', label: 'None' },
    ...approvedRequisitions.map((r) => ({
      value: r.id,
      label: `${r.requisition_number} - ${r.department_name || 'No dept'}`,
    })),
  ]

  // ==================== Mutations ====================

  const createMutation = useMutation({
    mutationFn: (data: Partial<RFQ>) => (procurementService as any).createRFQ(data),
    onSuccess: () => {
      toast.success('RFQ created successfully')
      queryClient.invalidateQueries({ queryKey: ['procurement-rfqs'] })
      closeForm()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to create RFQ')
    },
  })

  const sendMutation = useMutation({
    mutationFn: (id: string) => (procurementService as any).sendRFQ(id),
    onSuccess: () => {
      toast.success('RFQ sent to vendors')
      queryClient.invalidateQueries({ queryKey: ['procurement-rfqs'] })
      setShowDetailModal(false)
      setSelectedRFQ(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to send RFQ')
    },
  })

  const evaluateMutation = useMutation({
    mutationFn: (id: string) => (procurementService as any).evaluateRFQ(id),
    onSuccess: () => {
      toast.success('RFQ evaluation completed')
      queryClient.invalidateQueries({ queryKey: ['procurement-rfqs'] })
      setShowDetailModal(false)
      setSelectedRFQ(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to evaluate RFQ')
    },
  })

  const awardMutation = useMutation({
    mutationFn: (id: string) => (procurementService as any).awardRFQ(id),
    onSuccess: () => {
      toast.success('RFQ awarded')
      queryClient.invalidateQueries({ queryKey: ['procurement-rfqs'] })
      setShowDetailModal(false)
      setSelectedRFQ(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to award RFQ')
    },
  })

  const convertToPOMutation = useMutation({
    mutationFn: (id: string) => (procurementService as any).convertRFQToPO(id),
    onSuccess: () => {
      toast.success('RFQ converted to Purchase Order')
      queryClient.invalidateQueries({ queryKey: ['procurement-rfqs'] })
      queryClient.invalidateQueries({ queryKey: ['procurement-purchase-orders'] })
      setShowDetailModal(false)
      setSelectedRFQ(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to convert RFQ to PO')
    },
  })

  // ==================== Handlers ====================

  const openForm = () => {
    setFormData(defaultFormData)
    setFormErrors({})
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setFormData(defaultFormData)
    setFormErrors({})
  }

  const handleViewDetail = (rfq: RFQ) => {
    setSelectedRFQ(rfq)
    setShowDetailModal(true)
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.submission_deadline) errors.submission_deadline = 'Submission deadline is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: Partial<RFQ> = {
      requisition: formData.requisition || null,
      submission_deadline: formData.submission_deadline,
      evaluation_criteria: formData.evaluation_criteria.trim(),
      notes: formData.notes.trim(),
    }

    createMutation.mutate(payload)
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setPage(1)
  }

  // ==================== Table Columns ====================

  const columns = [
    {
      key: 'rfq_number',
      header: 'RFQ #',
      render: (rfq: RFQ) => (
        <span className="text-sm font-medium text-primary-600">{rfq.rfq_number}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (rfq: RFQ) => (
        <Badge variant={statusColors[rfq.status] || 'default'} size="xs" dot>
          {rfq.status_display || rfq.status}
        </Badge>
      ),
    },
    {
      key: 'submission_deadline',
      header: 'Deadline',
      render: (rfq: RFQ) => (
        <span className="text-sm text-gray-700">{formatDate(rfq.submission_deadline)}</span>
      ),
    },
    {
      key: 'vendor_count',
      header: 'Vendors',
      render: (rfq: RFQ) => (
        <span className="text-sm text-gray-700">
          {rfq.vendor_count ?? rfq.vendors?.length ?? 0}
        </span>
      ),
    },
    {
      key: 'requisition',
      header: 'Requisition',
      render: (rfq: RFQ) => (
        <span className="text-sm text-gray-500">{rfq.requisition_number || '-'}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (rfq: RFQ) => (
        <span className="text-sm text-gray-500">{formatDate(rfq.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (rfq: RFQ) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => handleViewDetail(rfq)}>
            <EyeIcon className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  // ==================== Render ====================

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Requests for Quotation"
        subtitle="Create and manage RFQs for procurement"
        breadcrumbs={[
          { label: 'Procurement', href: '/procurement' },
          { label: 'RFQs' },
        ]}
        actions={
          <Button
            size="sm"
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={openForm}
          >
            New RFQ
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search RFQs..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full lg:w-48">
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                options={STATUS_OPTIONS}
                placeholder="All Statuses"
              />
            </div>
            {(search || statusFilter) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* RFQ Table */}
      <Card>
        {isError ? (
          <EmptyState
            type="error"
            title="Failed to load RFQs"
            description={(error as any)?.message || 'An error occurred.'}
            action={{ label: 'Try Again', onClick: () => refetch() }}
          />
        ) : isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} columns={7} showHeader />
          </div>
        ) : rfqs.length === 0 ? (
          <EmptyState
            type="data"
            title="No RFQs found"
            description={
              search || statusFilter
                ? 'Try adjusting your filters.'
                : 'Create your first Request for Quotation to get started.'
            }
            action={
              search || statusFilter
                ? { label: 'Clear Filters', onClick: clearFilters }
                : { label: 'New RFQ', onClick: openForm }
            }
          />
        ) : (
          <>
            <Table data={rfqs} columns={columns} striped onRowClick={handleViewDetail} />
            {totalPages > 1 && (
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </Card>

      {/* Create RFQ Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title="New Request for Quotation"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {createMutation.error && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
              {(createMutation.error as any)?.response?.data?.detail ||
                'An error occurred while creating the RFQ.'}
            </div>
          )}

          <Select
            label="Linked Requisition (Optional)"
            value={formData.requisition}
            onChange={(e) => setFormData((prev) => ({ ...prev, requisition: e.target.value }))}
            options={requisitionOptions}
            placeholder="Select requisition"
          />

          <Input
            label="Submission Deadline"
            type="date"
            value={formData.submission_deadline}
            onChange={(e) => setFormData((prev) => ({ ...prev, submission_deadline: e.target.value }))}
            error={formErrors.submission_deadline}
            required
          />

          <Textarea
            label="Evaluation Criteria"
            value={formData.evaluation_criteria}
            onChange={(e) => setFormData((prev) => ({ ...prev, evaluation_criteria: e.target.value }))}
            placeholder="Describe the evaluation criteria for vendor responses..."
            rows={3}
          />

          <Textarea
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Additional notes..."
            rows={2}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="outline" type="button" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create RFQ
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedRFQ(null) }}
        title={`RFQ ${selectedRFQ?.rfq_number || ''}`}
        size="lg"
      >
        {selectedRFQ && (
          <div className="space-y-5">
            {/* Header Info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={statusColors[selectedRFQ.status] || 'default'} dot>
                  {selectedRFQ.status_display || selectedRFQ.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Submission Deadline</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(selectedRFQ.submission_deadline)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Vendors Invited</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedRFQ.vendor_count ?? selectedRFQ.vendors?.length ?? 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Requisition</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedRFQ.requisition_number || '-'}
                </p>
              </div>
              {selectedRFQ.awarded_vendor_name && (
                <div>
                  <p className="text-sm text-gray-500">Awarded Vendor</p>
                  <p className="text-sm font-medium text-gray-900">{selectedRFQ.awarded_vendor_name}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(selectedRFQ.created_at)}</p>
              </div>
            </div>

            {/* Evaluation Criteria */}
            {selectedRFQ.evaluation_criteria && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Evaluation Criteria</p>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {selectedRFQ.evaluation_criteria}
                </p>
              </div>
            )}

            {/* Notes */}
            {selectedRFQ.notes && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedRFQ.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-gray-200">
              {selectedRFQ.status === 'DRAFT' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => sendMutation.mutate(selectedRFQ.id)}
                  isLoading={sendMutation.isPending}
                >
                  <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                  Send to Vendors
                </Button>
              )}
              {selectedRFQ.status === 'RECEIVED' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => evaluateMutation.mutate(selectedRFQ.id)}
                  isLoading={evaluateMutation.isPending}
                >
                  <CheckIcon className="h-4 w-4 mr-1" />
                  Evaluate
                </Button>
              )}
              {selectedRFQ.status === 'EVALUATED' && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => awardMutation.mutate(selectedRFQ.id)}
                  isLoading={awardMutation.isPending}
                >
                  <TrophyIcon className="h-4 w-4 mr-1" />
                  Award
                </Button>
              )}
              {selectedRFQ.status === 'AWARDED' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => convertToPOMutation.mutate(selectedRFQ.id)}
                  isLoading={convertToPOMutation.isPending}
                >
                  <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
                  Convert to PO
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setShowDetailModal(false); setSelectedRFQ(null) }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
