import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PaperAirplaneIcon,
  CheckIcon,
  EyeIcon,
  TruckIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import {
  procurementService,
  type GoodsReceiptNote,
  type GRNStatus,
  type InspectionStatus,
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
import { formatDate } from '@/lib/utils'

// ==================== Status Helpers ====================

const statusColors: Record<GRNStatus, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

const poStatusColors: Record<POStatus, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
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

const inspectionColors: Record<InspectionStatus, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  PENDING: 'warning',
  PASSED: 'success',
  FAILED: 'danger',
  PARTIAL: 'info',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

const INSPECTION_STATUS_OPTIONS = [
  { value: '', label: 'All Inspections' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PASSED', label: 'Passed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'PARTIAL', label: 'Partial' },
]

// ==================== GRN Line Item Type ====================

interface GRNLineItem {
  po_item: string
  po_item_description: string
  ordered_qty: number
  previously_received: number
  received_qty: number
  accepted_qty: number
  rejected_qty: number
  rejection_reason: string
}

// ==================== Component ====================

export default function GoodsReceiptPage() {
  const queryClient = useQueryClient()

  // Filter state
  const [statusFilter, setStatusFilter] = useState('')
  const [inspectionFilter, setInspectionFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedGRN, setSelectedGRN] = useState<GoodsReceiptNote | null>(null)

  // Form state
  const [selectedPOId, setSelectedPOId] = useState('')
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<GRNLineItem[]>([])

  // ==================== Queries ====================

  const { data: grnsData, isLoading } = useQuery({
    queryKey: ['procurement-goods-receipts', statusFilter, inspectionFilter, searchQuery, currentPage],
    queryFn: () =>
      procurementService.getGoodsReceipts({
        status: statusFilter || undefined,
        inspection_status: inspectionFilter || undefined,
        search: searchQuery || undefined,
        page: currentPage,
      }),
  })

  // Fetch POs that can receive goods (ISSUED or PARTIALLY_RECEIVED)
  const { data: receivablePOs } = useQuery({
    queryKey: ['procurement-receivable-pos'],
    queryFn: async () => {
      const issued = await procurementService.getPurchaseOrders({ status: 'ISSUED' })
      const partial = await procurementService.getPurchaseOrders({ status: 'PARTIALLY_RECEIVED' })
      return [...(issued.results || []), ...(partial.results || [])]
    },
    enabled: showCreateModal,
  })

  // Fetch selected PO details
  const { data: poDetails } = useQuery({
    queryKey: ['procurement-po-detail', selectedPOId],
    queryFn: () => procurementService.getPurchaseOrder(selectedPOId),
    enabled: !!selectedPOId,
  })

  const grns = grnsData?.results || []
  const totalCount = grnsData?.count || 0
  const totalPages = Math.ceil(totalCount / pageSize)

  // ==================== Populate line items from PO ====================

  useEffect(() => {
    if (poDetails?.items) {
      setSelectedPO(poDetails)
      setLineItems(
        poDetails.items.map((item) => ({
          po_item: item.id,
          po_item_description: item.description,
          ordered_qty: item.quantity,
          previously_received: item.received_qty,
          received_qty: 0,
          accepted_qty: 0,
          rejected_qty: 0,
          rejection_reason: '',
        }))
      )
    }
  }, [poDetails])

  // ==================== Mutations ====================

  const createMutation = useMutation({
    mutationFn: (data: any) => procurementService.createGoodsReceipt(data),
    onSuccess: () => {
      toast.success('Goods receipt note created successfully')
      queryClient.invalidateQueries({ queryKey: ['procurement-goods-receipts'] })
      queryClient.invalidateQueries({ queryKey: ['procurement-purchase-orders'] })
      handleCloseCreateModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create goods receipt note')
    },
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) => procurementService.submitGoodsReceipt(id),
    onSuccess: () => {
      toast.success('Goods receipt note submitted for approval')
      queryClient.invalidateQueries({ queryKey: ['procurement-goods-receipts'] })
      setShowDetailModal(false)
      setSelectedGRN(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit goods receipt note')
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => procurementService.approveGoodsReceipt(id),
    onSuccess: () => {
      toast.success('Goods receipt note approved')
      queryClient.invalidateQueries({ queryKey: ['procurement-goods-receipts'] })
      queryClient.invalidateQueries({ queryKey: ['procurement-purchase-orders'] })
      setShowDetailModal(false)
      setSelectedGRN(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to approve goods receipt note')
    },
  })

  // ==================== Handlers ====================

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    setSelectedPOId('')
    setSelectedPO(null)
    setReceiptDate(new Date().toISOString().split('T')[0])
    setNotes('')
    setLineItems([])
  }

  const handleViewDetail = (grn: GoodsReceiptNote) => {
    setSelectedGRN(grn)
    setShowDetailModal(true)
  }

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems]
    const item = { ...updated[index], [field]: value }

    // Auto-calculate accepted/rejected when received changes
    if (field === 'received_qty') {
      item.accepted_qty = Number(value) - item.rejected_qty
      if (item.accepted_qty < 0) item.accepted_qty = 0
    }
    if (field === 'rejected_qty') {
      item.accepted_qty = item.received_qty - Number(value)
      if (item.accepted_qty < 0) item.accepted_qty = 0
    }

    updated[index] = item
    setLineItems(updated)
  }

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedPOId) {
      toast.error('Please select a purchase order')
      return
    }

    const itemsWithReceivedQty = lineItems.filter((item) => item.received_qty > 0)
    if (itemsWithReceivedQty.length === 0) {
      toast.error('Please enter received quantities for at least one item')
      return
    }

    const payload = {
      purchase_order: selectedPOId,
      receipt_date: receiptDate,
      notes,
      items: itemsWithReceivedQty.map((item) => ({
        po_item: item.po_item,
        received_qty: item.received_qty,
        accepted_qty: item.accepted_qty,
        rejected_qty: item.rejected_qty,
        rejection_reason: item.rejection_reason,
      })),
    }

    createMutation.mutate(payload)
  }

  // ==================== Summary Stats ====================

  const getReceiptSummary = (grn: GoodsReceiptNote) => {
    if (!grn.items || grn.items.length === 0) return null
    const totalReceived = grn.items.reduce((sum, item) => sum + item.received_qty, 0)
    const totalAccepted = grn.items.reduce((sum, item) => sum + item.accepted_qty, 0)
    const totalRejected = grn.items.reduce((sum, item) => sum + item.rejected_qty, 0)
    return { totalReceived, totalAccepted, totalRejected }
  }

  // ==================== Table Columns ====================

  const columns = [
    {
      key: 'grn_number',
      header: 'GRN Number',
      render: (grn: GoodsReceiptNote) => (
        <span className="text-sm font-medium text-primary-600">{grn.grn_number}</span>
      ),
    },
    {
      key: 'purchase_order',
      header: 'PO Number',
      render: (grn: GoodsReceiptNote) => (
        <span className="text-sm text-gray-700">{grn.po_number || grn.purchase_order}</span>
      ),
    },
    {
      key: 'receipt_date',
      header: 'Receipt Date',
      render: (grn: GoodsReceiptNote) => (
        <span className="text-sm text-gray-700">{formatDate(grn.receipt_date)}</span>
      ),
    },
    {
      key: 'received_by',
      header: 'Received By',
      render: (grn: GoodsReceiptNote) => (
        <span className="text-sm text-gray-700">{grn.received_by_name || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (grn: GoodsReceiptNote) => (
        <Badge variant={statusColors[grn.status] || 'default'} dot>
          {grn.status_display || grn.status}
        </Badge>
      ),
    },
    {
      key: 'inspection_status',
      header: 'Inspection',
      render: (grn: GoodsReceiptNote) => (
        <Badge variant={inspectionColors[grn.inspection_status] || 'default'} size="xs">
          {grn.inspection_status_display || grn.inspection_status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (grn: GoodsReceiptNote) => (
        <Button variant="ghost" size="xs" onClick={() => handleViewDetail(grn)}>
          <EyeIcon className="h-4 w-4" />
        </Button>
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
        title="Goods Receipt Notes"
        subtitle="Record and manage goods received from purchase orders"
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            New Goods Receipt
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Search GRNs..."
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
              options={INSPECTION_STATUS_OPTIONS}
              value={inspectionFilter}
              onChange={(e) => {
                setInspectionFilter(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Filter by inspection"
            />
          </div>
        </CardContent>
      </Card>

      {/* GRN List */}
      <Card>
        <Table
          data={grns}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No goods receipt notes found"
          emptyType="data"
          emptyAction={{
            label: 'Create Goods Receipt',
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

      {/* Create GRN Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        title="New Goods Receipt Note"
        size="xl"
      >
        <form onSubmit={handleSubmitForm} className="space-y-5">
          {/* PO Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Purchase Order"
              options={[
                { value: '', label: 'Select Purchase Order' },
                ...(receivablePOs || []).map((po) => ({
                  value: po.id,
                  label: `${po.po_number} - ${po.vendor_name || 'Unknown Vendor'}`,
                })),
              ]}
              value={selectedPOId}
              onChange={(e) => setSelectedPOId(e.target.value)}
              required
            />
            <Input
              label="Receipt Date"
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
              required
            />
          </div>

          {/* Selected PO Info */}
          {selectedPO && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <TruckIcon className="h-5 w-5 text-blue-600" />
                <h4 className="text-sm font-semibold text-blue-900">
                  PO: {selectedPO.po_number}
                </h4>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-600">Vendor:</span>{' '}
                  <span className="font-medium text-blue-900">{selectedPO.vendor_name || '-'}</span>
                </div>
                <div>
                  <span className="text-blue-600">Delivery Date:</span>{' '}
                  <span className="font-medium text-blue-900">{formatDate(selectedPO.delivery_date)}</span>
                </div>
                <div>
                  <span className="text-blue-600">Status:</span>{' '}
                  <Badge variant={poStatusColors[selectedPO.status] || 'default'} size="xs">
                    {selectedPO.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Line Items - Auto-populated from PO */}
          {lineItems.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Receive Items</h4>
              <div className="overflow-x-auto border border-gray-300 rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Item</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Ordered</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Prev. Received</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Remaining</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Received Qty</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Accepted</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Rejected</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Rejection Reason</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {lineItems.map((item, index) => {
                      const remaining = item.ordered_qty - item.previously_received
                      return (
                        <tr key={item.po_item} className={item.received_qty > 0 ? 'bg-green-50/30' : ''}>
                          <td className="px-3 py-2 text-sm text-gray-900 max-w-[200px]">
                            {item.po_item_description}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-700 text-right">{item.ordered_qty}</td>
                          <td className="px-3 py-2 text-sm text-gray-500 text-right">{item.previously_received}</td>
                          <td className="px-3 py-2 text-sm font-medium text-right">
                            <span className={remaining > 0 ? 'text-warning-600' : 'text-success-600'}>
                              {remaining}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max={remaining}
                              value={item.received_qty}
                              onChange={(e) => updateLineItem(index, 'received_qty', Number(e.target.value))}
                              className="w-20 mx-auto block text-center border border-gray-300 hover:border-gray-400 rounded-md px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] transition-colors duration-150"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max={item.received_qty}
                              value={item.accepted_qty}
                              onChange={(e) => updateLineItem(index, 'accepted_qty', Number(e.target.value))}
                              className="w-20 mx-auto block text-center border border-gray-300 hover:border-gray-400 rounded-md px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] transition-colors duration-150"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max={item.received_qty}
                              value={item.rejected_qty}
                              onChange={(e) => updateLineItem(index, 'rejected_qty', Number(e.target.value))}
                              className="w-20 mx-auto block text-center border border-gray-300 hover:border-gray-400 rounded-md px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] transition-colors duration-150"
                            />
                          </td>
                          <td className="px-3 py-2">
                            {item.rejected_qty > 0 && (
                              <input
                                type="text"
                                value={item.rejection_reason}
                                onChange={(e) => updateLineItem(index, 'rejection_reason', e.target.value)}
                                placeholder="Reason..."
                                className="w-full border border-gray-300 hover:border-gray-400 rounded-md px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] transition-colors duration-150"
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Validation warnings */}
              {lineItems.some(
                (item) => item.received_qty > 0 && item.accepted_qty + item.rejected_qty !== item.received_qty
              ) && (
                <div className="mt-3 flex items-center gap-2 text-sm text-warning-600 bg-warning-50 p-3 rounded-md">
                  <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                  <span>
                    Accepted + Rejected quantities must equal Received quantity for each item.
                  </span>
                </div>
              )}
            </div>
          )}

          <Textarea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes about the receipt..."
            rows={2}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={handleCloseCreateModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending}
              disabled={lineItems.length === 0 || !selectedPOId}
            >
              <ClipboardDocumentCheckIcon className="h-4 w-4 mr-1" />
              Create Goods Receipt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedGRN(null)
        }}
        title={`Goods Receipt ${selectedGRN?.grn_number || ''}`}
        size="xl"
      >
        {selectedGRN && (
          <div className="space-y-5">
            {/* Header Info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={statusColors[selectedGRN.status] || 'default'} dot>
                  {selectedGRN.status_display || selectedGRN.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Inspection Status</p>
                <Badge variant={inspectionColors[selectedGRN.inspection_status] || 'default'}>
                  {selectedGRN.inspection_status_display || selectedGRN.inspection_status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Purchase Order</p>
                <p className="text-sm font-medium text-primary-600">
                  {selectedGRN.po_number || selectedGRN.purchase_order}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Receipt Date</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(selectedGRN.receipt_date)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Received By</p>
                <p className="text-sm font-medium text-gray-900">{selectedGRN.received_by_name || '-'}</p>
              </div>
            </div>

            {/* Notes */}
            {selectedGRN.notes && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">{selectedGRN.notes}</p>
              </div>
            )}

            {/* Receipt Summary */}
            {selectedGRN.items && selectedGRN.items.length > 0 && (() => {
              const summary = getReceiptSummary(selectedGRN)
              if (!summary) return null
              return (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{summary.totalReceived}</p>
                    <p className="text-xs text-blue-600">Total Received</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-md p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{summary.totalAccepted}</p>
                    <p className="text-xs text-green-600">Accepted</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">{summary.totalRejected}</p>
                    <p className="text-xs text-red-600">Rejected</p>
                  </div>
                </div>
              )
            })()}

            {/* Line Items */}
            {selectedGRN.items && selectedGRN.items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Received Items</h4>
                <div className="overflow-x-auto border border-gray-300 rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Item</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Received</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Accepted</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Rejected</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Rejection Reason</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {selectedGRN.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {item.po_item_description || item.po_item}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700 text-right">{item.received_qty}</td>
                          <td className="px-4 py-2 text-sm text-right">
                            <span className="text-success-600 font-medium">{item.accepted_qty}</span>
                          </td>
                          <td className="px-4 py-2 text-sm text-right">
                            <span className={item.rejected_qty > 0 ? 'text-danger-600 font-medium' : 'text-gray-500'}>
                              {item.rejected_qty}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {item.rejection_reason || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-gray-200">
              {selectedGRN.status === 'DRAFT' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => submitMutation.mutate(selectedGRN.id)}
                  isLoading={submitMutation.isPending}
                >
                  <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                  Submit for Approval
                </Button>
              )}
              {selectedGRN.status === 'SUBMITTED' && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => approveMutation.mutate(selectedGRN.id)}
                  isLoading={approveMutation.isPending}
                >
                  <CheckIcon className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedGRN(null)
                }}
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
