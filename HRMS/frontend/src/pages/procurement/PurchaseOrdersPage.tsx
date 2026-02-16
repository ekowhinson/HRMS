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
  DocumentCheckIcon,
} from '@heroicons/react/24/outline'
import {
  procurementService,
  type PurchaseOrder,
  type POStatus,
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

const statusColors: Record<POStatus, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  ISSUED: 'info',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  CLOSED: 'default',
  CANCELLED: 'danger',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ISSUED', label: 'Issued' },
  { value: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const PAYMENT_TERMS_OPTIONS = [
  { value: 'NET_30', label: 'Net 30 Days' },
  { value: 'NET_60', label: 'Net 60 Days' },
  { value: 'NET_90', label: 'Net 90 Days' },
  { value: 'COD', label: 'Cash on Delivery' },
  { value: 'ADVANCE', label: 'Advance Payment' },
  { value: 'INSTALLMENT', label: 'Installments' },
]

// ==================== Blank Line Item ====================

const BLANK_ITEM = {
  description: '',
  item: null as string | null,
  quantity: 1,
  unit_price: 0,
  tax_rate: 0,
  requisition_item: null as string | null,
}

// ==================== Component ====================

export default function PurchaseOrdersPage() {
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
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    vendor: '',
    requisition: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    payment_terms: 'NET_30',
    notes: '',
  })
  const [lineItems, setLineItems] = useState<Array<typeof BLANK_ITEM>>([{ ...BLANK_ITEM }])

  // ==================== Queries ====================

  const { data: posData, isLoading } = useQuery({
    queryKey: ['procurement-purchase-orders', statusFilter, dateFrom, dateTo, searchQuery, currentPage],
    queryFn: () =>
      procurementService.getPurchaseOrders({
        status: statusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: searchQuery || undefined,
        page: currentPage,
      }),
  })

  // Fetch approved requisitions for linking
  const { data: requisitionsData } = useQuery({
    queryKey: ['procurement-requisitions-approved'],
    queryFn: () => procurementService.getRequisitions({ status: 'APPROVED' }),
  })

  const purchaseOrders = posData?.results || []
  const totalCount = posData?.count || 0
  const totalPages = Math.ceil(totalCount / pageSize)
  const approvedRequisitions = requisitionsData?.results || []

  // ==================== Mutations ====================

  const createMutation = useMutation({
    mutationFn: (data: any) => procurementService.createPurchaseOrder(data),
    onSuccess: () => {
      toast.success('Purchase order created successfully')
      queryClient.invalidateQueries({ queryKey: ['procurement-purchase-orders'] })
      handleCloseCreateModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create purchase order')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => procurementService.updatePurchaseOrder(id, data),
    onSuccess: () => {
      toast.success('Purchase order updated successfully')
      queryClient.invalidateQueries({ queryKey: ['procurement-purchase-orders'] })
      handleCloseCreateModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update purchase order')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => procurementService.deletePurchaseOrder(id),
    onSuccess: () => {
      toast.success('Purchase order deleted')
      queryClient.invalidateQueries({ queryKey: ['procurement-purchase-orders'] })
      setShowDetailModal(false)
      setSelectedPO(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete purchase order')
    },
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) => procurementService.submitPurchaseOrder(id),
    onSuccess: () => {
      toast.success('Purchase order submitted for approval')
      queryClient.invalidateQueries({ queryKey: ['procurement-purchase-orders'] })
      setShowDetailModal(false)
      setSelectedPO(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit purchase order')
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => procurementService.approvePurchaseOrder(id),
    onSuccess: () => {
      toast.success('Purchase order approved')
      queryClient.invalidateQueries({ queryKey: ['procurement-purchase-orders'] })
      setShowDetailModal(false)
      setSelectedPO(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to approve purchase order')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      procurementService.rejectPurchaseOrder(id, { reason }),
    onSuccess: () => {
      toast.success('Purchase order rejected')
      queryClient.invalidateQueries({ queryKey: ['procurement-purchase-orders'] })
      setShowRejectModal(false)
      setShowDetailModal(false)
      setSelectedPO(null)
      setRejectReason('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to reject purchase order')
    },
  })

  const issueMutation = useMutation({
    mutationFn: (id: string) => procurementService.issuePurchaseOrder(id),
    onSuccess: () => {
      toast.success('Purchase order issued to vendor')
      queryClient.invalidateQueries({ queryKey: ['procurement-purchase-orders'] })
      setShowDetailModal(false)
      setSelectedPO(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to issue purchase order')
    },
  })

  // ==================== Computed Values ====================

  const computeLineTotal = (item: typeof BLANK_ITEM) => {
    const subtotal = item.quantity * item.unit_price
    const tax = subtotal * (item.tax_rate / 100)
    return subtotal + tax
  }

  const totalAmount = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + computeLineTotal(item), 0)
  }, [lineItems])

  // ==================== Handlers ====================

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    setIsEditing(false)
    setFormData({
      vendor: '',
      requisition: '',
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: '',
      payment_terms: 'NET_30',
      notes: '',
    })
    setLineItems([{ ...BLANK_ITEM }])
  }

  const handleOpenEdit = (po: PurchaseOrder) => {
    setFormData({
      vendor: po.vendor || '',
      requisition: po.requisition || '',
      order_date: po.order_date,
      delivery_date: po.delivery_date,
      payment_terms: po.payment_terms,
      notes: po.notes,
    })
    setLineItems(
      po.items && po.items.length > 0
        ? po.items.map((item) => ({
            description: item.description,
            item: item.item,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            requisition_item: item.requisition_item,
          }))
        : [{ ...BLANK_ITEM }]
    )
    setSelectedPO(po)
    setIsEditing(true)
    setShowDetailModal(false)
    setShowCreateModal(true)
  }

  const handleViewDetail = (po: PurchaseOrder) => {
    setSelectedPO(po)
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
      vendor: formData.vendor || null,
      requisition: formData.requisition || null,
      items: validItems.map((item) => ({
        ...item,
        total: computeLineTotal(item),
      })),
      total_amount: validItems.reduce((sum, item) => sum + computeLineTotal(item), 0),
    }

    if (isEditing && selectedPO) {
      updateMutation.mutate({ id: selectedPO.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  // ==================== Status Workflow Display ====================

  const getStatusSteps = (status: POStatus) => {
    const steps = ['DRAFT', 'SUBMITTED', 'APPROVED', 'ISSUED', 'RECEIVED', 'CLOSED']
    const currentIndex = steps.indexOf(status)
    if (status === 'REJECTED' || status === 'CANCELLED') {
      return null // do not show workflow for terminal states
    }
    return steps.map((step, index) => ({
      label: step.replace('_', ' '),
      completed: index <= currentIndex,
      current: index === currentIndex,
    }))
  }

  // ==================== Table Columns ====================

  const columns = [
    {
      key: 'po_number',
      header: 'PO Number',
      render: (po: PurchaseOrder) => (
        <span className="text-sm font-medium text-primary-600">{po.po_number}</span>
      ),
    },
    {
      key: 'vendor',
      header: 'Vendor',
      render: (po: PurchaseOrder) => (
        <span className="text-sm text-gray-700">{po.vendor_name || '-'}</span>
      ),
    },
    {
      key: 'order_date',
      header: 'Order Date',
      render: (po: PurchaseOrder) => (
        <span className="text-sm text-gray-700">{formatDate(po.order_date)}</span>
      ),
    },
    {
      key: 'delivery_date',
      header: 'Delivery Date',
      render: (po: PurchaseOrder) => (
        <span className="text-sm text-gray-700">{formatDate(po.delivery_date)}</span>
      ),
    },
    {
      key: 'total_amount',
      header: 'Total',
      render: (po: PurchaseOrder) => (
        <span className="text-sm font-medium text-gray-900">
          {formatCurrency(po.total_amount)}
        </span>
      ),
    },
    {
      key: 'requisition',
      header: 'Requisition',
      render: (po: PurchaseOrder) => (
        <span className="text-sm text-gray-500">
          {po.requisition_number || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (po: PurchaseOrder) => (
        <Badge variant={statusColors[po.status] || 'default'} dot>
          {po.status_display || po.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (po: PurchaseOrder) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => handleViewDetail(po)}>
            <EyeIcon className="h-4 w-4" />
          </Button>
          {po.status === 'DRAFT' && (
            <Button variant="ghost" size="xs" onClick={() => handleOpenEdit(po)}>
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
        title="Purchase Orders"
        subtitle="Manage purchase orders and track deliveries"
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            New Purchase Order
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search POs..."
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

      {/* Purchase Orders List */}
      <Card>
        <Table
          data={purchaseOrders}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No purchase orders found"
          emptyType="data"
          emptyAction={{
            label: 'Create Purchase Order',
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
        title={isEditing ? 'Edit Purchase Order' : 'New Purchase Order'}
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
              label="From Requisition (Optional)"
              options={[
                { value: '', label: 'None' },
                ...approvedRequisitions.map((r) => ({
                  value: r.id,
                  label: `${r.requisition_number} - ${formatCurrency(r.total_estimated)}`,
                })),
              ]}
              value={formData.requisition}
              onChange={(e) => setFormData({ ...formData, requisition: e.target.value })}
              placeholder="Link to requisition"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Order Date"
              type="date"
              value={formData.order_date}
              onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
              required
            />
            <Input
              label="Delivery Date"
              type="date"
              value={formData.delivery_date}
              onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
              required
            />
            <Select
              label="Payment Terms"
              options={PAYMENT_TERMS_OPTIONS}
              value={formData.payment_terms}
              onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
            />
          </div>

          <Textarea
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes..."
            rows={2}
          />

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">Order Items</h4>
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
                    <div className="md:col-span-1">
                      <Input
                        label={index === 0 ? 'Tax %' : undefined}
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={item.tax_rate}
                        onChange={(e) => updateLineItem(index, 'tax_rate', Number(e.target.value))}
                      />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <div className="py-3">
                        <span className="text-sm font-medium text-gray-700">
                          {formatCurrency(computeLineTotal(item))}
                        </span>
                      </div>
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
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-200">
              <div className="text-right">
                <span className="text-sm text-gray-500">Total Amount</span>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
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
              {isEditing ? 'Update Purchase Order' : 'Create Purchase Order'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedPO(null)
        }}
        title={`Purchase Order ${selectedPO?.po_number || ''}`}
        size="xl"
      >
        {selectedPO && (
          <div className="space-y-5">
            {/* Status Workflow */}
            {(() => {
              const steps = getStatusSteps(selectedPO.status)
              if (!steps) return null
              return (
                <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-md overflow-x-auto">
                  {steps.map((step, index) => (
                    <div key={step.label} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                            step.completed
                              ? step.current
                                ? 'bg-primary-600 text-white'
                                : 'bg-success-100 text-success-700'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {step.completed && !step.current ? (
                            <CheckIcon className="h-4 w-4" />
                          ) : (
                            index + 1
                          )}
                        </div>
                        <span
                          className={`mt-1 text-[10px] font-medium ${
                            step.current ? 'text-primary-600' : step.completed ? 'text-success-600' : 'text-gray-400'
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                      {index < steps.length - 1 && (
                        <div
                          className={`w-8 md:w-12 h-0.5 mx-1 ${
                            steps[index + 1].completed ? 'bg-success-400' : 'bg-gray-200'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Header Info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={statusColors[selectedPO.status] || 'default'} dot>
                  {selectedPO.status_display || selectedPO.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Vendor</p>
                <p className="text-sm font-medium text-gray-900">{selectedPO.vendor_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Requisition</p>
                <p className="text-sm font-medium text-gray-900">{selectedPO.requisition_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Order Date</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(selectedPO.order_date)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Delivery Date</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(selectedPO.delivery_date)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment Terms</p>
                <p className="text-sm font-medium text-gray-900">{selectedPO.payment_terms}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="text-sm font-bold text-gray-900">{formatCurrency(selectedPO.total_amount)}</p>
              </div>
              {selectedPO.approved_by_name && (
                <div>
                  <p className="text-sm text-gray-500">Approved By</p>
                  <p className="text-sm font-medium text-gray-900">{selectedPO.approved_by_name}</p>
                </div>
              )}
            </div>

            {/* Notes */}
            {selectedPO.notes && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">{selectedPO.notes}</p>
              </div>
            )}

            {/* Line Items */}
            {selectedPO.items && selectedPO.items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Order Items</h4>
                <div className="overflow-x-auto border border-gray-300 rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Qty</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Unit Price</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Tax %</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Received</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {selectedPO.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.description}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 text-right">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 text-right">{formatCurrency(item.unit_price)}</td>
                          <td className="px-4 py-2 text-sm text-gray-700 text-right">{item.tax_rate}%</td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(item.total)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right">
                            <span
                              className={`font-medium ${
                                item.received_qty >= item.quantity
                                  ? 'text-success-600'
                                  : item.received_qty > 0
                                  ? 'text-warning-600'
                                  : 'text-gray-500'
                              }`}
                            >
                              {item.received_qty} / {item.quantity}
                            </span>
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
                          {formatCurrency(selectedPO.total_amount)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-gray-200">
              {selectedPO.status === 'DRAFT' && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this purchase order?')) {
                        deleteMutation.mutate(selectedPO.id)
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
                    onClick={() => handleOpenEdit(selectedPO)}
                  >
                    <PencilSquareIcon className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => submitMutation.mutate(selectedPO.id)}
                    isLoading={submitMutation.isPending}
                  >
                    <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                    Submit for Approval
                  </Button>
                </>
              )}
              {selectedPO.status === 'SUBMITTED' && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowRejectModal(true)}
                  >
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => approveMutation.mutate(selectedPO.id)}
                    isLoading={approveMutation.isPending}
                  >
                    <CheckIcon className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </>
              )}
              {selectedPO.status === 'APPROVED' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => issueMutation.mutate(selectedPO.id)}
                  isLoading={issueMutation.isPending}
                >
                  <DocumentCheckIcon className="h-4 w-4 mr-1" />
                  Issue to Vendor
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedPO(null)
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
        title="Reject Purchase Order"
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
                if (selectedPO) {
                  rejectMutation.mutate({ id: selectedPO.id, reason: rejectReason })
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
