import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PaperAirplaneIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import { inventoryService } from '@/services/inventory'
import type { Asset } from '@/services/inventory'
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
import { formatCurrency, formatDate } from '@/lib/utils'

// ==================== Types ====================

type DisposalStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
type DisposalType = 'SALE' | 'SCRAP' | 'DONATION'

interface AssetDisposal {
  id: string
  asset: string
  asset_number?: string
  asset_name?: string
  disposal_type: DisposalType
  disposal_date: string
  proceeds: number | string
  book_value: number | string
  gain_loss: number | string
  status: DisposalStatus
  status_display?: string
  reason: string
  approved_by?: string
  approved_by_name?: string
  created_at: string
  updated_at?: string
}

// ==================== Form ====================

interface DisposalFormData {
  asset: string
  disposal_type: DisposalType
  disposal_date: string
  proceeds: string
  reason: string
}

const defaultFormData: DisposalFormData = {
  asset: '',
  disposal_type: 'SALE',
  disposal_date: new Date().toISOString().split('T')[0],
  proceeds: '0',
  reason: '',
}

// ==================== Helpers ====================

const statusColors: Record<DisposalStatus, 'default' | 'warning' | 'success' | 'danger' | 'info'> = {
  DRAFT: 'default',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  COMPLETED: 'info',
}

const DISPOSAL_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'COMPLETED', label: 'Completed' },
]

const DISPOSAL_TYPE_OPTIONS = [
  { value: 'SALE', label: 'Sale' },
  { value: 'SCRAP', label: 'Scrap' },
  { value: 'DONATION', label: 'Donation' },
]

// ==================== Component ====================

export default function AssetDisposalPage() {
  const queryClient = useQueryClient()

  // List state
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const pageSize = 20

  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState<DisposalFormData>(defaultFormData)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedDisposal, setSelectedDisposal] = useState<AssetDisposal | null>(null)

  // ==================== Queries ====================

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inventory-asset-disposals', page, search, statusFilter],
    queryFn: () =>
      (inventoryService as any).getAssetDisposals({
        page,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  })

  const { data: assetsData } = useQuery({
    queryKey: ['inventory-assets-for-disposal'],
    queryFn: () => inventoryService.getAssets({ status: 'ACTIVE' as any, page_size: 500 }),
  })

  const disposals: AssetDisposal[] = data?.results || []
  const totalItems = data?.count || 0
  const totalPages = Math.ceil(totalItems / pageSize)

  const assetOptions = [
    { value: '', label: 'Select asset' },
    ...((assetsData?.results || []).map((a: Asset) => ({
      value: a.id,
      label: `${a.asset_number} - ${a.name}`,
    }))),
  ]

  // ==================== Mutations ====================

  const createMutation = useMutation({
    mutationFn: (data: Partial<AssetDisposal>) =>
      (inventoryService as any).createAssetDisposal(data),
    onSuccess: () => {
      toast.success('Disposal record created')
      queryClient.invalidateQueries({ queryKey: ['inventory-asset-disposals'] })
      closeForm()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to create disposal')
    },
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) => (inventoryService as any).submitAssetDisposal(id),
    onSuccess: () => {
      toast.success('Disposal submitted for approval')
      queryClient.invalidateQueries({ queryKey: ['inventory-asset-disposals'] })
      setShowDetailModal(false)
      setSelectedDisposal(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to submit disposal')
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => (inventoryService as any).approveAssetDisposal(id),
    onSuccess: () => {
      toast.success('Disposal approved')
      queryClient.invalidateQueries({ queryKey: ['inventory-asset-disposals'] })
      setShowDetailModal(false)
      setSelectedDisposal(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to approve disposal')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => (inventoryService as any).rejectAssetDisposal(id),
    onSuccess: () => {
      toast.success('Disposal rejected')
      queryClient.invalidateQueries({ queryKey: ['inventory-asset-disposals'] })
      setShowDetailModal(false)
      setSelectedDisposal(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to reject disposal')
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

  const handleViewDetail = (disposal: AssetDisposal) => {
    setSelectedDisposal(disposal)
    setShowDetailModal(true)
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.asset) errors.asset = 'Asset is required'
    if (!formData.disposal_date) errors.disposal_date = 'Disposal date is required'
    if (!formData.reason.trim()) errors.reason = 'Reason is required'
    if (formData.proceeds && isNaN(Number(formData.proceeds)))
      errors.proceeds = 'Proceeds must be a valid number'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: Partial<AssetDisposal> = {
      asset: formData.asset,
      disposal_type: formData.disposal_type,
      disposal_date: formData.disposal_date,
      proceeds: formData.proceeds || '0',
      reason: formData.reason.trim(),
    }

    createMutation.mutate(payload)
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setPage(1)
  }

  // ==================== Gain/Loss Formatting ====================

  const formatGainLoss = (value: number | string) => {
    const num = Number(value)
    if (num > 0) return <span className="text-success-600">+{formatCurrency(num)}</span>
    if (num < 0) return <span className="text-danger-600">{formatCurrency(num)}</span>
    return <span className="text-gray-500">{formatCurrency(0)}</span>
  }

  // ==================== Table Columns ====================

  const columns = [
    {
      key: 'asset_number',
      header: 'Asset #',
      render: (d: AssetDisposal) => (
        <span className="text-sm font-mono font-medium text-gray-900">{d.asset_number || '-'}</span>
      ),
    },
    {
      key: 'asset_name',
      header: 'Asset Name',
      render: (d: AssetDisposal) => (
        <span className="text-sm text-gray-900">{d.asset_name || '-'}</span>
      ),
    },
    {
      key: 'disposal_type',
      header: 'Type',
      render: (d: AssetDisposal) => (
        <Badge
          variant={
            d.disposal_type === 'SALE' ? 'info' :
            d.disposal_type === 'DONATION' ? 'success' : 'warning'
          }
          size="xs"
        >
          {d.disposal_type}
        </Badge>
      ),
    },
    {
      key: 'disposal_date',
      header: 'Disposal Date',
      render: (d: AssetDisposal) => (
        <span className="text-sm text-gray-700">{formatDate(d.disposal_date)}</span>
      ),
    },
    {
      key: 'proceeds',
      header: 'Proceeds',
      render: (d: AssetDisposal) => (
        <span className="text-sm font-medium text-gray-900">{formatCurrency(Number(d.proceeds))}</span>
      ),
    },
    {
      key: 'book_value',
      header: 'Book Value',
      render: (d: AssetDisposal) => (
        <span className="text-sm text-gray-700">{formatCurrency(Number(d.book_value))}</span>
      ),
    },
    {
      key: 'gain_loss',
      header: 'Gain/Loss',
      render: (d: AssetDisposal) => (
        <span className="text-sm font-medium">{formatGainLoss(d.gain_loss)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (d: AssetDisposal) => (
        <Badge variant={statusColors[d.status] || 'default'} size="xs" dot>
          {d.status_display || d.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (d: AssetDisposal) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => handleViewDetail(d)}>
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
        title="Asset Disposals"
        subtitle="Manage asset disposals, sales, scrapping, and donations"
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Asset Disposals' },
        ]}
        actions={
          <Button
            size="sm"
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={openForm}
          >
            New Disposal
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
                  placeholder="Search by asset number or name..."
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
                options={DISPOSAL_STATUS_OPTIONS}
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

      {/* Disposals Table */}
      <Card>
        {isError ? (
          <EmptyState
            type="error"
            title="Failed to load disposals"
            description={(error as any)?.message || 'An error occurred.'}
            action={{ label: 'Try Again', onClick: () => refetch() }}
          />
        ) : isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} columns={9} showHeader />
          </div>
        ) : disposals.length === 0 ? (
          <EmptyState
            type="data"
            title="No disposals found"
            description={
              search || statusFilter
                ? 'Try adjusting your filters.'
                : 'Create a new disposal record to get started.'
            }
            action={
              search || statusFilter
                ? { label: 'Clear Filters', onClick: clearFilters }
                : { label: 'New Disposal', onClick: openForm }
            }
          />
        ) : (
          <>
            <Table data={disposals} columns={columns} striped onRowClick={handleViewDetail} />
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

      {/* Create Disposal Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title="New Asset Disposal"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {createMutation.error && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
              {(createMutation.error as any)?.response?.data?.detail ||
                'An error occurred while creating the disposal.'}
            </div>
          )}

          <Select
            label="Asset"
            value={formData.asset}
            onChange={(e) => setFormData((prev) => ({ ...prev, asset: e.target.value }))}
            options={assetOptions}
            error={formErrors.asset}
            required
            placeholder="Select asset to dispose"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Disposal Type"
              value={formData.disposal_type}
              onChange={(e) => setFormData((prev) => ({ ...prev, disposal_type: e.target.value as DisposalType }))}
              options={DISPOSAL_TYPE_OPTIONS}
              required
            />
            <Input
              label="Disposal Date"
              type="date"
              value={formData.disposal_date}
              onChange={(e) => setFormData((prev) => ({ ...prev, disposal_date: e.target.value }))}
              error={formErrors.disposal_date}
              required
            />
          </div>

          <Input
            label="Proceeds"
            type="number"
            min="0"
            step="0.01"
            value={formData.proceeds}
            onChange={(e) => setFormData((prev) => ({ ...prev, proceeds: e.target.value }))}
            error={formErrors.proceeds}
            placeholder="0.00"
          />

          <Textarea
            label="Reason"
            value={formData.reason}
            onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
            error={formErrors.reason}
            required
            placeholder="Provide the reason for disposal..."
            rows={3}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="outline" type="button" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Disposal
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedDisposal(null) }}
        title={`Asset Disposal - ${selectedDisposal?.asset_number || ''}`}
        size="lg"
      >
        {selectedDisposal && (
          <div className="space-y-5">
            {/* Header Info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={statusColors[selectedDisposal.status] || 'default'} dot>
                  {selectedDisposal.status_display || selectedDisposal.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Asset</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedDisposal.asset_number} - {selectedDisposal.asset_name}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Disposal Type</p>
                <Badge
                  variant={
                    selectedDisposal.disposal_type === 'SALE' ? 'info' :
                    selectedDisposal.disposal_type === 'DONATION' ? 'success' : 'warning'
                  }
                  size="sm"
                >
                  {selectedDisposal.disposal_type}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Disposal Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(selectedDisposal.disposal_date)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Proceeds</p>
                <p className="text-sm font-bold text-gray-900">
                  {formatCurrency(Number(selectedDisposal.proceeds))}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Book Value</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatCurrency(Number(selectedDisposal.book_value))}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Gain / Loss</p>
                <p className="text-sm font-bold">
                  {formatGainLoss(selectedDisposal.gain_loss)}
                </p>
              </div>
              {selectedDisposal.approved_by_name && (
                <div>
                  <p className="text-sm text-gray-500">Approved By</p>
                  <p className="text-sm font-medium text-gray-900">{selectedDisposal.approved_by_name}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(selectedDisposal.created_at)}
                </p>
              </div>
            </div>

            {/* Reason */}
            {selectedDisposal.reason && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Reason</p>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedDisposal.reason}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-gray-200">
              {selectedDisposal.status === 'DRAFT' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => submitMutation.mutate(selectedDisposal.id)}
                  isLoading={submitMutation.isPending}
                >
                  <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                  Submit for Approval
                </Button>
              )}
              {selectedDisposal.status === 'PENDING' && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => rejectMutation.mutate(selectedDisposal.id)}
                    isLoading={rejectMutation.isPending}
                  >
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => approveMutation.mutate(selectedDisposal.id)}
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
                onClick={() => { setShowDetailModal(false); setSelectedDisposal(null) }}
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
