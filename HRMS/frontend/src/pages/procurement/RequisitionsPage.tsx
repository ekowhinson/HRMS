import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PaperAirplaneIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
  EyeIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'
import {
  procurementService,
  type PurchaseRequisition,
  type RequisitionItem,
  type RequisitionStatus,
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
import { Skeleton } from '@/components/ui/Skeleton'
import { formatCurrency, formatDate } from '@/lib/utils'

// ==================== Status Helpers ====================

const statusColors: Record<RequisitionStatus, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'danger',
  ORDERED: 'info',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'ORDERED', label: 'Ordered' },
]

const UOM_OPTIONS = [
  { value: 'PCS', label: 'Pieces' },
  { value: 'KG', label: 'Kilograms' },
  { value: 'LTR', label: 'Litres' },
  { value: 'MTR', label: 'Metres' },
  { value: 'BOX', label: 'Boxes' },
  { value: 'SET', label: 'Sets' },
  { value: 'PKT', label: 'Packets' },
  { value: 'ROLL', label: 'Rolls' },
  { value: 'REAM', label: 'Reams' },
  { value: 'LOT', label: 'Lots' },
  { value: 'SVC', label: 'Service' },
]

// ==================== Blank Line Item ====================

const BLANK_ITEM: Omit<RequisitionItem, 'id' | 'requisition' | 'estimated_total'> = {
  description: '',
  item: null,
  quantity: 1,
  unit_of_measure: 'PCS',
  unit_price: 0,
  budget: null,
  notes: '',
}

// ==================== Component ====================

export default function RequisitionsPage() {
  const queryClient = useQueryClient()

  // Filter state
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedRequisition, setSelectedRequisition] = useState<PurchaseRequisition | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    department: '',
    cost_center: '',
    requisition_date: new Date().toISOString().split('T')[0],
    required_date: '',
    justification: '',
  })
  const [lineItems, setLineItems] = useState<Array<Omit<RequisitionItem, 'id' | 'requisition' | 'estimated_total'>>>([{ ...BLANK_ITEM }])

  // ==================== Queries ====================

  const { data: requisitionsData, isLoading } = useQuery({
    queryKey: ['procurement-requisitions', statusFilter, dateFrom, dateTo, searchQuery, currentPage],
    queryFn: () =>
      procurementService.getRequisitions({
        status: statusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: searchQuery || undefined,
        page: currentPage,
      }),
  })

  const requisitions = requisitionsData?.results || []
  const totalCount = requisitionsData?.count || 0
  const totalPages = Math.ceil(totalCount / pageSize)

  // ==================== Mutations ====================

  const createMutation = useMutation({
    mutationFn: (data: any) => procurementService.createRequisition(data),
    onSuccess: () => {
      toast.success('Requisition created successfully')
      queryClient.invalidateQueries({ queryKey: ['procurement-requisitions'] })
      handleCloseCreateModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create requisition')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => procurementService.updateRequisition(id, data),
    onSuccess: () => {
      toast.success('Requisition updated successfully')
      queryClient.invalidateQueries({ queryKey: ['procurement-requisitions'] })
      handleCloseCreateModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update requisition')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => procurementService.deleteRequisition(id),
    onSuccess: () => {
      toast.success('Requisition deleted')
      queryClient.invalidateQueries({ queryKey: ['procurement-requisitions'] })
      setShowDetailModal(false)
      setSelectedRequisition(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete requisition')
    },
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) => procurementService.submitRequisition(id),
    onSuccess: () => {
      toast.success('Requisition submitted for approval')
      queryClient.invalidateQueries({ queryKey: ['procurement-requisitions'] })
      setShowDetailModal(false)
      setSelectedRequisition(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit requisition')
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => procurementService.approveRequisition(id),
    onSuccess: () => {
      toast.success('Requisition approved')
      queryClient.invalidateQueries({ queryKey: ['procurement-requisitions'] })
      setShowDetailModal(false)
      setSelectedRequisition(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to approve requisition')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      procurementService.rejectRequisition(id, { reason }),
    onSuccess: () => {
      toast.success('Requisition rejected')
      queryClient.invalidateQueries({ queryKey: ['procurement-requisitions'] })
      setShowRejectModal(false)
      setShowDetailModal(false)
      setSelectedRequisition(null)
      setRejectReason('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to reject requisition')
    },
  })

  // ==================== Computed Values ====================

  const estimatedTotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  }, [lineItems])

  // ==================== Handlers ====================

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    setIsEditing(false)
    setFormData({
      department: '',
      cost_center: '',
      requisition_date: new Date().toISOString().split('T')[0],
      required_date: '',
      justification: '',
    })
    setLineItems([{ ...BLANK_ITEM }])
  }

  const handleOpenEdit = (req: PurchaseRequisition) => {
    setFormData({
      department: req.department || '',
      cost_center: req.cost_center || '',
      requisition_date: req.requisition_date,
      required_date: req.required_date,
      justification: req.justification,
    })
    setLineItems(
      req.items && req.items.length > 0
        ? req.items.map((item) => ({
            description: item.description,
            item: item.item,
            quantity: item.quantity,
            unit_of_measure: item.unit_of_measure,
            unit_price: item.unit_price,
            budget: item.budget,
            notes: item.notes,
          }))
        : [{ ...BLANK_ITEM }]
    )
    setSelectedRequisition(req)
    setIsEditing(true)
    setShowDetailModal(false)
    setShowCreateModal(true)
  }

  const handleViewDetail = (req: PurchaseRequisition) => {
    setSelectedRequisition(req)
    setShowDetailModal(true)
  }

  const addLineItem = () => {
    setLineItems([...lineItems, { ...BLANK_ITEM }])
  }

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems]
    updated[index] = { ...updated[index], [field]: value }
    setLineItems(updated)
  }

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault()

    const validItems = lineItems.filter((item) => item.description.trim() !== '')
    if (validItems.length === 0) {
      toast.error('Please add at least one line item')
      return
    }

    const payload = {
      ...formData,
      department: formData.department || null,
      cost_center: formData.cost_center || null,
      items: validItems.map((item) => ({
        ...item,
        estimated_total: item.quantity * item.unit_price,
      })),
      total_estimated: validItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
    }

    if (isEditing && selectedRequisition) {
      updateMutation.mutate({ id: selectedRequisition.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  // ==================== Table Columns ====================

  const columns = [
    {
      key: 'requisition_number',
      header: 'Req. Number',
      render: (req: PurchaseRequisition) => (
        <span className="text-sm font-medium text-primary-600">{req.requisition_number}</span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (req: PurchaseRequisition) => (
        <span className="text-sm text-gray-700">{req.department_name || '-'}</span>
      ),
    },
    {
      key: 'requisition_date',
      header: 'Date',
      render: (req: PurchaseRequisition) => (
        <span className="text-sm text-gray-700">{formatDate(req.requisition_date)}</span>
      ),
    },
    {
      key: 'required_date',
      header: 'Required By',
      render: (req: PurchaseRequisition) => (
        <span className="text-sm text-gray-700">{formatDate(req.required_date)}</span>
      ),
    },
    {
      key: 'total_estimated',
      header: 'Estimated Total',
      render: (req: PurchaseRequisition) => (
        <span className="text-sm font-medium text-gray-900">
          {formatCurrency(req.total_estimated)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (req: PurchaseRequisition) => (
        <Badge variant={statusColors[req.status] || 'default'} dot>
          {req.status_display || req.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (req: PurchaseRequisition) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => handleViewDetail(req)}>
            <EyeIcon className="h-4 w-4" />
          </Button>
          {req.status === 'DRAFT' && (
            <Button variant="ghost" size="xs" onClick={() => handleOpenEdit(req)}>
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
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Requisitions"
        subtitle="Create and manage purchase requisitions"
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            New Requisition
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search requisitions..."
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
            <Input
              type="date"
              placeholder="From date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setCurrentPage(1)
              }}
            />
            <Input
              type="date"
              placeholder="To date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Requisitions List */}
      <Card>
        <Table
          data={requisitions}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No requisitions found"
          emptyType="data"
          emptyAction={{
            label: 'Create Requisition',
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

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        title={isEditing ? 'Edit Requisition' : 'New Purchase Requisition'}
        size="xl"
      >
        <form onSubmit={handleSubmitForm} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Requisition Date"
              type="date"
              value={formData.requisition_date}
              onChange={(e) => setFormData({ ...formData, requisition_date: e.target.value })}
              required
            />
            <Input
              label="Required By Date"
              type="date"
              value={formData.required_date}
              onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
              required
            />
          </div>

          <Textarea
            label="Justification"
            value={formData.justification}
            onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
            placeholder="Provide justification for this requisition..."
            rows={3}
            required
          />

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">Line Items</h4>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div
                  key={index}
                  className="border border-gray-300 rounded-md p-4 bg-gray-50/50"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-4">
                      <Input
                        label={index === 0 ? 'Description' : undefined}
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        label={index === 0 ? 'Quantity' : undefined}
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, 'quantity', Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Select
                        label={index === 0 ? 'UOM' : undefined}
                        options={UOM_OPTIONS}
                        value={item.unit_of_measure}
                        onChange={(e) => updateLineItem(index, 'unit_of_measure', e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Input
                        label={index === 0 ? 'Unit Price' : undefined}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateLineItem(index, 'unit_price', Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="md:col-span-1 flex items-end">
                      <span className="text-sm font-medium text-gray-700 py-3">
                        {formatCurrency(item.quantity * item.unit_price)}
                      </span>
                    </div>
                    <div className="md:col-span-1 flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(index)}
                        disabled={lineItems.length <= 1}
                        className="text-danger-600 hover:text-danger-700"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {/* Optional notes per item */}
                  <div className="mt-2">
                    <Input
                      placeholder="Notes (optional)"
                      value={item.notes}
                      onChange={(e) => updateLineItem(index, 'notes', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-200">
              <div className="text-right">
                <span className="text-sm text-gray-500">Estimated Total</span>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(estimatedTotal)}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={handleCloseCreateModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {isEditing ? 'Update Requisition' : 'Create Requisition'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedRequisition(null)
        }}
        title={`Requisition ${selectedRequisition?.requisition_number || ''}`}
        size="xl"
      >
        {selectedRequisition && (
          <div className="space-y-5">
            {/* Header Info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={statusColors[selectedRequisition.status] || 'default'} dot>
                  {selectedRequisition.status_display || selectedRequisition.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Department</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedRequisition.department_name || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Requested By</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedRequisition.requested_by_name || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Requisition Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(selectedRequisition.requisition_date)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Required By</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(selectedRequisition.required_date)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Estimated</p>
                <p className="text-sm font-bold text-gray-900">
                  {formatCurrency(selectedRequisition.total_estimated)}
                </p>
              </div>
            </div>

            {/* Justification */}
            {selectedRequisition.justification && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Justification</p>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                  {selectedRequisition.justification}
                </p>
              </div>
            )}

            {/* Line Items */}
            {selectedRequisition.items && selectedRequisition.items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Line Items</h4>
                <div className="overflow-x-auto border border-gray-300 rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Qty</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">UOM</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Unit Price</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {selectedRequisition.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.description}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 text-right">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{item.unit_of_measure}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 text-right">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(item.estimated_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={4} className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">
                          Total
                        </td>
                        <td className="px-4 py-2 text-sm font-bold text-gray-900 text-right">
                          {formatCurrency(selectedRequisition.total_estimated)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Approved By */}
            {selectedRequisition.approved_by_name && (
              <div>
                <p className="text-sm text-gray-500">Approved By</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedRequisition.approved_by_name}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-gray-200">
              {selectedRequisition.status === 'DRAFT' && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this requisition?')) {
                        deleteMutation.mutate(selectedRequisition.id)
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
                    onClick={() => handleOpenEdit(selectedRequisition)}
                  >
                    <PencilSquareIcon className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => submitMutation.mutate(selectedRequisition.id)}
                    isLoading={submitMutation.isPending}
                  >
                    <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                    Submit for Approval
                  </Button>
                </>
              )}
              {selectedRequisition.status === 'SUBMITTED' && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setShowRejectModal(true)
                    }}
                  >
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => approveMutation.mutate(selectedRequisition.id)}
                    isLoading={approveMutation.isPending}
                  >
                    <CheckIcon className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedRequisition(null)
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false)
          setRejectReason('')
        }}
        title="Reject Requisition"
        size="sm"
      >
        <div className="space-y-4">
          <Textarea
            label="Rejection Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Provide a reason for rejection..."
            rows={3}
            required
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowRejectModal(false)
                setRejectReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!rejectReason.trim()) {
                  toast.error('Please provide a rejection reason')
                  return
                }
                if (selectedRequisition) {
                  rejectMutation.mutate({ id: selectedRequisition.id, reason: rejectReason })
                }
              }}
              isLoading={rejectMutation.isPending}
            >
              Reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
