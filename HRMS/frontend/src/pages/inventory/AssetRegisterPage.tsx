import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ComputerDesktopIcon,
  CurrencyDollarIcon,
  ArrowsRightLeftIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline'
import { inventoryService } from '@/services/inventory'
import type {
  Asset,
  AssetStatus,
  AssetFilters,
  AssetDepreciation,
  AssetTransfer,
  MaintenanceSchedule,
  ItemCategory,
  DepreciationMethod,
} from '@/services/inventory'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { StatsCard } from '@/components/ui/StatsCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Textarea from '@/components/ui/Textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable, SkeletonStatsCard } from '@/components/ui/Skeleton'

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISPOSED', label: 'Disposed' },
  { value: 'TRANSFERRED', label: 'Transferred' },
  { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' },
  { value: 'WRITTEN_OFF', label: 'Written Off' },
]

const DEPRECIATION_METHOD_OPTIONS = [
  { value: 'STRAIGHT_LINE', label: 'Straight Line' },
  { value: 'DECLINING_BALANCE', label: 'Declining Balance' },
  { value: 'SUM_OF_YEARS', label: 'Sum of Years Digits' },
]

const statusColors: Record<AssetStatus, 'success' | 'danger' | 'info' | 'warning' | 'default'> = {
  ACTIVE: 'success',
  DISPOSED: 'danger',
  TRANSFERRED: 'info',
  UNDER_MAINTENANCE: 'warning',
  WRITTEN_OFF: 'default',
}

const initialAssetForm = {
  asset_number: '',
  name: '',
  description: '',
  category: '',
  item: '',
  acquisition_date: '',
  acquisition_cost: 0,
  depreciation_method: 'STRAIGHT_LINE' as DepreciationMethod,
  useful_life_months: 60,
  salvage_value: 0,
  location: '',
  custodian: '',
  department: '',
  serial_number: '',
  warranty_expiry: '',
}

const initialTransferForm = {
  to_location: '',
  to_custodian: '',
  reason: '',
  transfer_date: new Date().toISOString().split('T')[0],
}

const initialDisposeForm = {
  reason: '',
  disposal_date: new Date().toISOString().split('T')[0],
  disposal_value: 0,
}

export default function AssetRegisterPage() {
  const queryClient = useQueryClient()
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showDisposeModal, setShowDisposeModal] = useState(false)
  const [assetForm, setAssetForm] = useState(initialAssetForm)
  const [transferForm, setTransferForm] = useState(initialTransferForm)
  const [disposeForm, setDisposeForm] = useState(initialDisposeForm)
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState<AssetFilters>({
    search: '',
    status: undefined,
    category: undefined,
    department: undefined,
    page: 1,
    page_size: 10,
  })

  // Queries
  const { data: assetsData, isLoading } = useQuery({
    queryKey: ['inventory-assets', filters],
    queryFn: () => inventoryService.getAssets(filters),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: () => inventoryService.getCategories({ is_asset_category: true }),
  })

  const { data: depreciationHistory = [] } = useQuery({
    queryKey: ['asset-depreciations', selectedAsset?.id],
    queryFn: () => inventoryService.getAssetDepreciations(selectedAsset!.id),
    enabled: !!selectedAsset,
  })

  const { data: transferHistory = [] } = useQuery({
    queryKey: ['asset-transfers', selectedAsset?.id],
    queryFn: () => inventoryService.getAssetTransfersByAsset(selectedAsset!.id),
    enabled: !!selectedAsset,
  })

  const { data: maintenanceHistory = [] } = useQuery({
    queryKey: ['asset-maintenance', selectedAsset?.id],
    queryFn: () => inventoryService.getAssetMaintenanceSchedules(selectedAsset!.id),
    enabled: !!selectedAsset,
  })

  const assets = assetsData?.results || []
  const totalAssets = assetsData?.count || 0
  const totalPages = Math.ceil(totalAssets / (filters.page_size || 10))

  // Compute summary stats
  const totalAcquisitionCost = assets.reduce((sum: number, a: Asset) => sum + Number(a.acquisition_cost), 0)
  const totalCurrentValue = assets.reduce((sum: number, a: Asset) => sum + Number(a.current_value), 0)
  const totalDepreciation = assets.reduce((sum: number, a: Asset) => sum + Number(a.accumulated_depreciation), 0)

  const categoryOptions = categories.map((c: ItemCategory) => ({ value: c.id, label: c.name }))

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<Asset>) => inventoryService.createAsset(data),
    onSuccess: () => {
      toast.success('Asset created successfully')
      queryClient.invalidateQueries({ queryKey: ['inventory-assets'] })
      setShowCreateModal(false)
      setAssetForm(initialAssetForm)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create asset')
    },
  })

  const transferMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof initialTransferForm }) =>
      inventoryService.transferAsset(id, data),
    onSuccess: () => {
      toast.success('Asset transfer initiated')
      queryClient.invalidateQueries({ queryKey: ['inventory-assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset-transfers'] })
      setShowTransferModal(false)
      setTransferForm(initialTransferForm)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to transfer asset')
    },
  })

  const disposeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof initialDisposeForm }) =>
      inventoryService.disposeAsset(id, data),
    onSuccess: () => {
      toast.success('Asset disposed successfully')
      queryClient.invalidateQueries({ queryKey: ['inventory-assets'] })
      setShowDisposeModal(false)
      setDisposeForm(initialDisposeForm)
      setSelectedAsset(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to dispose asset')
    },
  })

  // Handlers
  const handleCreateAsset = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Partial<Asset> = {
      ...assetForm,
      item: assetForm.item || undefined,
      custodian: assetForm.custodian || undefined,
      department: assetForm.department || undefined,
      warranty_expiry: assetForm.warranty_expiry || undefined,
    } as any
    createMutation.mutate(payload)
  }

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAsset) return
    transferMutation.mutate({ id: selectedAsset.id, data: transferForm })
  }

  const handleDispose = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAsset) return
    disposeMutation.mutate({ id: selectedAsset.id, data: disposeForm })
  }

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const formatCurrency = (value: number) =>
    Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Asset list columns
  const columns = [
    {
      key: 'asset_number',
      header: 'Asset #',
      render: (asset: Asset) => (
        <span className="text-sm font-mono font-medium text-primary-600 cursor-pointer hover:underline"
          onClick={() => setSelectedAsset(asset)}
        >
          {asset.asset_number}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (asset: Asset) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{asset.name}</p>
          {asset.serial_number && (
            <p className="text-xs text-gray-500">S/N: {asset.serial_number}</p>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (asset: Asset) => (
        <span className="text-sm text-gray-700">{asset.category_name || '-'}</span>
      ),
    },
    {
      key: 'acquisition',
      header: 'Acquisition Cost',
      render: (asset: Asset) => (
        <span className="text-sm text-gray-700">{formatCurrency(asset.acquisition_cost)}</span>
      ),
    },
    {
      key: 'current_value',
      header: 'Current Value',
      render: (asset: Asset) => (
        <span className="text-sm font-medium text-gray-900">{formatCurrency(asset.current_value)}</span>
      ),
    },
    {
      key: 'depreciation',
      header: 'Accum. Depr.',
      render: (asset: Asset) => (
        <span className="text-sm text-gray-500">{formatCurrency(asset.accumulated_depreciation)}</span>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (asset: Asset) => (
        <span className="text-sm text-gray-700">{asset.location || '-'}</span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (asset: Asset) => (
        <span className="text-sm text-gray-700">{asset.department_name || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (asset: Asset) => (
        <Badge variant={statusColors[asset.status]} size="xs">
          {asset.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
  ]

  // Detail view
  if (selectedAsset) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedAsset(null)}>
            <ChevronLeftIcon className="h-4 w-4 mr-1" />
            Back to Assets
          </Button>
        </div>

        <PageHeader
          title={selectedAsset.name}
          subtitle={`Asset #${selectedAsset.asset_number}`}
          actions={
            <div className="flex gap-2">
              {selectedAsset.status === 'ACTIVE' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTransferForm({
                        ...initialTransferForm,
                        transfer_date: new Date().toISOString().split('T')[0],
                      })
                      setShowTransferModal(true)
                    }}
                  >
                    <ArrowsRightLeftIcon className="h-4 w-4 mr-2" />
                    Transfer
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setDisposeForm({
                        ...initialDisposeForm,
                        disposal_date: new Date().toISOString().split('T')[0],
                      })
                      setShowDisposeModal(true)
                    }}
                  >
                    <XCircleIcon className="h-4 w-4 mr-2" />
                    Dispose
                  </Button>
                </>
              )}
            </div>
          }
        />

        {/* Asset summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Acquisition Cost"
            value={formatCurrency(selectedAsset.acquisition_cost)}
            variant="primary"
            icon={<CurrencyDollarIcon className="h-5 w-5" />}
          />
          <StatsCard
            title="Current Value"
            value={formatCurrency(selectedAsset.current_value)}
            variant="success"
            icon={<CurrencyDollarIcon className="h-5 w-5" />}
          />
          <StatsCard
            title="Accum. Depreciation"
            value={formatCurrency(selectedAsset.accumulated_depreciation)}
            variant="warning"
            icon={<CurrencyDollarIcon className="h-5 w-5" />}
          />
          <StatsCard
            title="Monthly Depreciation"
            value={formatCurrency(selectedAsset.monthly_depreciation)}
            variant="info"
            icon={<CurrencyDollarIcon className="h-5 w-5" />}
          />
        </div>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="depreciation">Depreciation History</TabsTrigger>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details">
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-gray-500">Asset Number</p>
                    <p className="text-sm font-medium font-mono">{selectedAsset.asset_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="text-sm font-medium">{selectedAsset.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Category</p>
                    <p className="text-sm font-medium">{selectedAsset.category_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Serial Number</p>
                    <p className="text-sm font-medium font-mono">{selectedAsset.serial_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge variant={statusColors[selectedAsset.status]} size="sm">
                      {selectedAsset.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Acquisition Date</p>
                    <p className="text-sm font-medium">
                      {selectedAsset.acquisition_date
                        ? new Date(selectedAsset.acquisition_date).toLocaleDateString()
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Depreciation Method</p>
                    <p className="text-sm font-medium">
                      {selectedAsset.depreciation_method.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Useful Life</p>
                    <p className="text-sm font-medium">{selectedAsset.useful_life_months} months</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Salvage Value</p>
                    <p className="text-sm font-medium">{formatCurrency(selectedAsset.salvage_value)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="text-sm font-medium">{selectedAsset.location || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Custodian</p>
                    <p className="text-sm font-medium">{selectedAsset.custodian_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Department</p>
                    <p className="text-sm font-medium">{selectedAsset.department_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Warranty Expiry</p>
                    <p className="text-sm font-medium">
                      {selectedAsset.warranty_expiry
                        ? new Date(selectedAsset.warranty_expiry).toLocaleDateString()
                        : '-'}
                    </p>
                  </div>
                </div>
                {selectedAsset.description && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-500 mb-1">Description</p>
                    <p className="text-sm text-gray-700">{selectedAsset.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Depreciation History Tab */}
          <TabsContent value="depreciation">
            <Card>
              {depreciationHistory.length === 0 ? (
                <EmptyState
                  type="data"
                  title="No depreciation records"
                  description="Depreciation records will appear here after monthly depreciation runs."
                  compact
                />
              ) : (
                <Table
                  data={depreciationHistory}
                  columns={[
                    {
                      key: 'fiscal_period',
                      header: 'Period',
                      render: (d: AssetDepreciation) => (
                        <span className="text-sm font-medium text-gray-900">{d.fiscal_period}</span>
                      ),
                    },
                    {
                      key: 'depreciation_amount',
                      header: 'Depreciation',
                      render: (d: AssetDepreciation) => (
                        <span className="text-sm text-gray-700">{formatCurrency(d.depreciation_amount)}</span>
                      ),
                    },
                    {
                      key: 'accumulated',
                      header: 'Accumulated',
                      render: (d: AssetDepreciation) => (
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(d.accumulated_depreciation)}
                        </span>
                      ),
                    },
                    {
                      key: 'book_value',
                      header: 'Book Value',
                      render: (d: AssetDepreciation) => (
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(d.book_value)}</span>
                      ),
                    },
                    {
                      key: 'date',
                      header: 'Date',
                      render: (d: AssetDepreciation) => (
                        <span className="text-sm text-gray-500">
                          {new Date(d.created_at).toLocaleDateString()}
                        </span>
                      ),
                    },
                  ]}
                />
              )}
            </Card>
          </TabsContent>

          {/* Transfers Tab */}
          <TabsContent value="transfers">
            <Card>
              {transferHistory.length === 0 ? (
                <EmptyState
                  type="data"
                  title="No transfer records"
                  description="Asset transfer history will appear here."
                  compact
                />
              ) : (
                <Table
                  data={transferHistory}
                  columns={[
                    {
                      key: 'date',
                      header: 'Date',
                      render: (t: AssetTransfer) => (
                        <span className="text-sm text-gray-900">
                          {new Date(t.transfer_date).toLocaleDateString()}
                        </span>
                      ),
                    },
                    {
                      key: 'from',
                      header: 'From',
                      render: (t: AssetTransfer) => (
                        <div className="text-sm">
                          <p className="text-gray-900">{t.from_location}</p>
                          {t.from_custodian_name && (
                            <p className="text-gray-500">{t.from_custodian_name}</p>
                          )}
                        </div>
                      ),
                    },
                    {
                      key: 'to',
                      header: 'To',
                      render: (t: AssetTransfer) => (
                        <div className="text-sm">
                          <p className="text-gray-900">{t.to_location}</p>
                          {t.to_custodian_name && (
                            <p className="text-gray-500">{t.to_custodian_name}</p>
                          )}
                        </div>
                      ),
                    },
                    {
                      key: 'reason',
                      header: 'Reason',
                      render: (t: AssetTransfer) => (
                        <span className="text-sm text-gray-700">{t.reason || '-'}</span>
                      ),
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (t: AssetTransfer) => {
                        const colors: Record<string, 'warning' | 'success' | 'info' | 'danger'> = {
                          PENDING: 'warning',
                          APPROVED: 'success',
                          COMPLETED: 'info',
                          REJECTED: 'danger',
                        }
                        return (
                          <Badge variant={colors[t.status] || 'default'} size="xs">
                            {t.status}
                          </Badge>
                        )
                      },
                    },
                  ]}
                />
              )}
            </Card>
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance">
            <Card>
              {maintenanceHistory.length === 0 ? (
                <EmptyState
                  type="data"
                  title="No maintenance schedules"
                  description="Maintenance schedules for this asset will appear here."
                  compact
                />
              ) : (
                <Table
                  data={maintenanceHistory}
                  columns={[
                    {
                      key: 'description',
                      header: 'Description',
                      render: (m: MaintenanceSchedule) => (
                        <span className="text-sm font-medium text-gray-900">{m.description}</span>
                      ),
                    },
                    {
                      key: 'frequency',
                      header: 'Frequency',
                      render: (m: MaintenanceSchedule) => (
                        <Badge variant="default" size="xs">{m.frequency}</Badge>
                      ),
                    },
                    {
                      key: 'next_due',
                      header: 'Next Due',
                      render: (m: MaintenanceSchedule) => (
                        <span className="text-sm text-gray-700">
                          {new Date(m.next_due_date).toLocaleDateString()}
                        </span>
                      ),
                    },
                    {
                      key: 'vendor',
                      header: 'Vendor',
                      render: (m: MaintenanceSchedule) => (
                        <span className="text-sm text-gray-700">{m.vendor || '-'}</span>
                      ),
                    },
                    {
                      key: 'est_cost',
                      header: 'Est. Cost',
                      render: (m: MaintenanceSchedule) => (
                        <span className="text-sm text-gray-700">{formatCurrency(m.estimated_cost)}</span>
                      ),
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (m: MaintenanceSchedule) => {
                        const colors: Record<string, 'success' | 'danger' | 'warning'> = {
                          SCHEDULED: 'warning',
                          OVERDUE: 'danger',
                          COMPLETED: 'success',
                        }
                        return (
                          <Badge variant={colors[m.status] || 'default'} size="xs">
                            {m.status}
                          </Badge>
                        )
                      },
                    },
                  ]}
                />
              )}
            </Card>
          </TabsContent>
        </Tabs>

        {/* Transfer Modal */}
        <Modal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          title={`Transfer Asset - ${selectedAsset.asset_number}`}
        >
          <form onSubmit={handleTransfer} className="space-y-4">
            <Input
              label="Transfer Date"
              type="date"
              value={transferForm.transfer_date}
              onChange={(e) => setTransferForm({ ...transferForm, transfer_date: e.target.value })}
              required
            />
            <Input
              label="To Location"
              value={transferForm.to_location}
              onChange={(e) => setTransferForm({ ...transferForm, to_location: e.target.value })}
              placeholder="New location"
              required
            />
            <Input
              label="To Custodian"
              value={transferForm.to_custodian}
              onChange={(e) => setTransferForm({ ...transferForm, to_custodian: e.target.value })}
              placeholder="New custodian (optional)"
            />
            <Textarea
              label="Reason"
              value={transferForm.reason}
              onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
              placeholder="Reason for transfer"
              required
              rows={3}
            />
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button type="button" variant="outline" onClick={() => setShowTransferModal(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={transferMutation.isPending}>
                <ArrowsRightLeftIcon className="h-4 w-4 mr-2" />
                Transfer Asset
              </Button>
            </div>
          </form>
        </Modal>

        {/* Dispose Modal */}
        <Modal
          isOpen={showDisposeModal}
          onClose={() => setShowDisposeModal(false)}
          title={`Dispose Asset - ${selectedAsset.asset_number}`}
        >
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4 flex items-start gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              This action will mark the asset as disposed. This cannot be undone.
            </p>
          </div>
          <form onSubmit={handleDispose} className="space-y-4">
            <Input
              label="Disposal Date"
              type="date"
              value={disposeForm.disposal_date}
              onChange={(e) => setDisposeForm({ ...disposeForm, disposal_date: e.target.value })}
              required
            />
            <Input
              label="Disposal Value"
              type="number"
              min="0"
              step="0.01"
              value={disposeForm.disposal_value}
              onChange={(e) =>
                setDisposeForm({ ...disposeForm, disposal_value: parseFloat(e.target.value) || 0 })
              }
            />
            <Textarea
              label="Reason"
              value={disposeForm.reason}
              onChange={(e) => setDisposeForm({ ...disposeForm, reason: e.target.value })}
              placeholder="Reason for disposal"
              required
              rows={3}
            />
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button type="button" variant="outline" onClick={() => setShowDisposeModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" isLoading={disposeMutation.isPending}>
                <XCircleIcon className="h-4 w-4 mr-2" />
                Dispose Asset
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    )
  }

  // Asset list view
  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Register"
        subtitle="Manage fixed assets, track depreciation, and monitor asset lifecycle"
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Asset
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonStatsCard key={i} />)
        ) : (
          <>
            <StatsCard
              title="Total Assets"
              value={totalAssets}
              variant="primary"
              icon={<ComputerDesktopIcon className="h-5 w-5" />}
            />
            <StatsCard
              title="Acquisition Cost"
              value={formatCurrency(totalAcquisitionCost)}
              variant="info"
              icon={<CurrencyDollarIcon className="h-5 w-5" />}
            />
            <StatsCard
              title="Current Value"
              value={formatCurrency(totalCurrentValue)}
              variant="success"
              icon={<CurrencyDollarIcon className="h-5 w-5" />}
            />
            <StatsCard
              title="Total Depreciation"
              value={formatCurrency(totalDepreciation)}
              variant="warning"
              icon={<CurrencyDollarIcon className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search assets by name, number, or serial..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                leftIcon={<MagnifyingGlassIcon className="h-5 w-5" />}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                options={STATUS_OPTIONS}
                value={filters.status || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: (e.target.value || undefined) as AssetStatus | undefined,
                    page: 1,
                  }))
                }
                placeholder="Status"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                options={[{ value: '', label: 'All Categories' }, ...categoryOptions]}
                value={filters.category || ''}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, category: e.target.value || undefined, page: 1 }))
                }
                placeholder="Category"
              />
            </div>
            <Button variant="secondary" onClick={handleSearch}>
              Search
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSearchInput('')
                setFilters({ page: 1, page_size: 10 })
              }}
            >
              <ArrowPathIcon className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Assets Table */}
      <Card>
        {isLoading ? (
          <SkeletonTable />
        ) : assets.length === 0 ? (
          <EmptyState
            type="data"
            title="No assets found"
            description="Register your first asset to start tracking fixed assets."
            action={{ label: 'Add Asset', onClick: () => setShowCreateModal(true) }}
          />
        ) : (
          <>
            <Table
              data={assets}
              columns={columns}
              onRowClick={(asset) => setSelectedAsset(asset)}
            />
            {totalPages > 1 && (
              <TablePagination
                currentPage={filters.page || 1}
                totalPages={totalPages}
                totalItems={totalAssets}
                pageSize={filters.page_size || 10}
                onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
              />
            )}
          </>
        )}
      </Card>

      {/* Create Asset Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setAssetForm(initialAssetForm)
        }}
        title="Register New Asset"
        size="xl"
      >
        <form onSubmit={handleCreateAsset} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Asset Number"
              value={assetForm.asset_number}
              onChange={(e) => setAssetForm({ ...assetForm, asset_number: e.target.value })}
              placeholder="e.g., AST-001"
              required
            />
            <Input
              label="Asset Name"
              value={assetForm.name}
              onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
              placeholder="Asset name"
              required
            />
          </div>

          <Textarea
            label="Description"
            value={assetForm.description}
            onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })}
            placeholder="Asset description..."
            rows={2}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Category"
              options={categoryOptions}
              value={assetForm.category}
              onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
              placeholder="Select category"
              required
            />
            <Input
              label="Serial Number"
              value={assetForm.serial_number}
              onChange={(e) => setAssetForm({ ...assetForm, serial_number: e.target.value })}
              placeholder="Serial number"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Acquisition Date"
              type="date"
              value={assetForm.acquisition_date}
              onChange={(e) => setAssetForm({ ...assetForm, acquisition_date: e.target.value })}
              required
            />
            <Input
              label="Acquisition Cost"
              type="number"
              min="0"
              step="0.01"
              value={assetForm.acquisition_cost}
              onChange={(e) =>
                setAssetForm({ ...assetForm, acquisition_cost: parseFloat(e.target.value) || 0 })
              }
              required
            />
            <Input
              label="Salvage Value"
              type="number"
              min="0"
              step="0.01"
              value={assetForm.salvage_value}
              onChange={(e) =>
                setAssetForm({ ...assetForm, salvage_value: parseFloat(e.target.value) || 0 })
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Depreciation Method"
              options={DEPRECIATION_METHOD_OPTIONS}
              value={assetForm.depreciation_method}
              onChange={(e) =>
                setAssetForm({ ...assetForm, depreciation_method: e.target.value as DepreciationMethod })
              }
              required
            />
            <Input
              label="Useful Life (months)"
              type="number"
              min="1"
              value={assetForm.useful_life_months}
              onChange={(e) =>
                setAssetForm({ ...assetForm, useful_life_months: parseInt(e.target.value) || 0 })
              }
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Location"
              value={assetForm.location}
              onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
              placeholder="Asset location"
            />
            <Input
              label="Warranty Expiry"
              type="date"
              value={assetForm.warranty_expiry}
              onChange={(e) => setAssetForm({ ...assetForm, warranty_expiry: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateModal(false)
                setAssetForm(initialAssetForm)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              <ComputerDesktopIcon className="h-4 w-4 mr-2" />
              Register Asset
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
