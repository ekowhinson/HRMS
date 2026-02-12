import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
  ArrowsRightLeftIcon,
  CubeIcon,
} from '@heroicons/react/24/outline'
import { inventoryService } from '@/services/inventory'
import type {
  StockEntry,
  StockEntryType,
  StockEntryStatus,
  StockEntryFilters,
  StockLedger,
  StockLedgerFilters,
  Item,
  Warehouse,
} from '@/services/inventory'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Textarea from '@/components/ui/Textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'

const ENTRY_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'RECEIPT', label: 'Receipt' },
  { value: 'ISSUE', label: 'Issue' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

const entryTypeColors: Record<StockEntryType, 'info' | 'warning' | 'success' | 'default'> = {
  RECEIPT: 'success',
  ISSUE: 'warning',
  TRANSFER: 'info',
  ADJUSTMENT: 'default',
}

const statusColors: Record<StockEntryStatus, 'default' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'default',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

const initialEntryForm = {
  entry_type: 'RECEIPT' as StockEntryType,
  item: '',
  warehouse: '',
  quantity: 0,
  unit_cost: 0,
  source: '',
  source_reference: '',
  reference_number: '',
  notes: '',
  from_warehouse: '',
}

export default function StockPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('entries')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState(initialEntryForm)

  // Stock entry filters
  const [entryFilters, setEntryFilters] = useState<StockEntryFilters>({
    entry_type: undefined,
    status: undefined,
    page: 1,
    page_size: 10,
  })

  // Stock ledger filters
  const [ledgerFilters, setLedgerFilters] = useState<StockLedgerFilters>({
    item: undefined,
    warehouse: undefined,
    page: 1,
    page_size: 10,
  })

  // Queries
  const { data: entriesData, isLoading: loadingEntries } = useQuery({
    queryKey: ['stock-entries', entryFilters],
    queryFn: () => inventoryService.getStockEntries(entryFilters),
  })

  const { data: ledgerData, isLoading: loadingLedger } = useQuery({
    queryKey: ['stock-ledger', ledgerFilters],
    queryFn: () => inventoryService.getStockLedger(ledgerFilters),
    enabled: activeTab === 'ledger',
  })

  const { data: itemsData } = useQuery({
    queryKey: ['inventory-items-lookup'],
    queryFn: () => inventoryService.getItems({ page_size: 200, is_active: true }),
  })

  const { data: warehousesData } = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => inventoryService.getWarehouses({ page_size: 200, is_active: true }),
  })

  const entries = entriesData?.results || []
  const totalEntries = entriesData?.count || 0
  const totalEntryPages = Math.ceil(totalEntries / (entryFilters.page_size || 10))

  const ledger = ledgerData?.results || []
  const totalLedger = ledgerData?.count || 0
  const totalLedgerPages = Math.ceil(totalLedger / (ledgerFilters.page_size || 10))

  const allItems = itemsData?.results || []
  const allWarehouses = warehousesData?.results || []

  const itemOptions = allItems.map((i: Item) => ({ value: i.id, label: `${i.code} - ${i.name}` }))
  const warehouseOptions = allWarehouses.map((w: Warehouse) => ({ value: w.id, label: `${w.code} - ${w.name}` }))

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<StockEntry>) => inventoryService.createStockEntry(data),
    onSuccess: () => {
      toast.success('Stock entry created successfully')
      queryClient.invalidateQueries({ queryKey: ['stock-entries'] })
      queryClient.invalidateQueries({ queryKey: ['stock-ledger'] })
      setShowCreateModal(false)
      setFormData(initialEntryForm)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create stock entry')
    },
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) => inventoryService.submitStockEntry(id),
    onSuccess: () => {
      toast.success('Stock entry submitted for approval')
      queryClient.invalidateQueries({ queryKey: ['stock-entries'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit stock entry')
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => inventoryService.approveStockEntry(id),
    onSuccess: () => {
      toast.success('Stock entry approved')
      queryClient.invalidateQueries({ queryKey: ['stock-entries'] })
      queryClient.invalidateQueries({ queryKey: ['stock-ledger'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to approve stock entry')
    },
  })

  // Handlers
  const handleCreateEntry = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Partial<StockEntry> = {
      entry_type: formData.entry_type,
      item: formData.item,
      warehouse: formData.warehouse,
      quantity: formData.quantity,
      unit_cost: formData.unit_cost,
      source: formData.source,
      source_reference: formData.source_reference,
      reference_number: formData.reference_number,
      notes: formData.notes,
    }
    if (formData.entry_type === 'TRANSFER' && formData.from_warehouse) {
      payload.from_warehouse = formData.from_warehouse
    }
    createMutation.mutate(payload)
  }

  // Entry columns
  const entryColumns = [
    {
      key: 'reference',
      header: 'Reference',
      render: (entry: StockEntry) => (
        <span className="text-sm font-mono font-medium text-gray-900">
          {entry.reference_number || '-'}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (entry: StockEntry) => (
        <Badge variant={entryTypeColors[entry.entry_type]} size="xs">
          {entry.entry_type}
        </Badge>
      ),
    },
    {
      key: 'item',
      header: 'Item',
      render: (entry: StockEntry) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{entry.item_name}</p>
          <p className="text-xs text-gray-500">{entry.item_code}</p>
        </div>
      ),
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (entry: StockEntry) => (
        <div className="text-sm text-gray-700">
          <p>{entry.warehouse_name}</p>
          {entry.entry_type === 'TRANSFER' && entry.from_warehouse_name && (
            <p className="text-xs text-gray-500">
              From: {entry.from_warehouse_name}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Qty',
      render: (entry: StockEntry) => (
        <span className="text-sm font-medium text-gray-900">{entry.quantity}</span>
      ),
    },
    {
      key: 'unit_cost',
      header: 'Unit Cost',
      render: (entry: StockEntry) => (
        <span className="text-sm text-gray-700">
          {Number(entry.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'total_cost',
      header: 'Total',
      render: (entry: StockEntry) => (
        <span className="text-sm font-medium text-gray-900">
          {Number(entry.total_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (entry: StockEntry) => (
        <Badge variant={statusColors[entry.status]} size="xs">
          {entry.status}
        </Badge>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (entry: StockEntry) => (
        <span className="text-sm text-gray-500">
          {new Date(entry.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (entry: StockEntry) => (
        <div className="flex items-center gap-1">
          {entry.status === 'DRAFT' && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => submitMutation.mutate(entry.id)}
              disabled={submitMutation.isPending}
              title="Submit for approval"
            >
              <PaperAirplaneIcon className="h-4 w-4 text-blue-600" />
            </Button>
          )}
          {entry.status === 'SUBMITTED' && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => approveMutation.mutate(entry.id)}
              disabled={approveMutation.isPending}
              title="Approve"
            >
              <CheckCircleIcon className="h-4 w-4 text-green-600" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  // Ledger columns
  const ledgerColumns = [
    {
      key: 'item',
      header: 'Item',
      render: (row: StockLedger) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{row.item_name}</p>
          <p className="text-xs text-gray-500">{row.item_code}</p>
        </div>
      ),
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (row: StockLedger) => (
        <span className="text-sm text-gray-700">{row.warehouse_name}</span>
      ),
    },
    {
      key: 'balance_qty',
      header: 'Balance Qty',
      render: (row: StockLedger) => (
        <span className="text-sm font-semibold text-gray-900">{row.balance_qty}</span>
      ),
    },
    {
      key: 'average_cost',
      header: 'Avg. Cost',
      render: (row: StockLedger) => (
        <span className="text-sm text-gray-700">
          {Number(row.average_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'valuation',
      header: 'Valuation',
      render: (row: StockLedger) => (
        <span className="text-sm font-medium text-gray-900">
          {Number(row.valuation_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'last_movement',
      header: 'Last Movement',
      render: (row: StockLedger) => (
        <span className="text-sm text-gray-500">
          {row.last_movement_date
            ? new Date(row.last_movement_date).toLocaleDateString()
            : '-'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Management"
        subtitle="Track stock movements and inventory balances"
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            New Stock Entry
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="entries">
            <ArrowsRightLeftIcon className="h-4 w-4 mr-1" />
            Stock Entries
          </TabsTrigger>
          <TabsTrigger value="ledger">
            <CubeIcon className="h-4 w-4 mr-1" />
            Stock Ledger
          </TabsTrigger>
        </TabsList>

        {/* Stock Entries Tab */}
        <TabsContent value="entries">
          {/* Filters */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:w-48">
                  <Select
                    options={ENTRY_TYPE_OPTIONS}
                    value={entryFilters.entry_type || ''}
                    onChange={(e) =>
                      setEntryFilters((prev) => ({
                        ...prev,
                        entry_type: (e.target.value || undefined) as StockEntryType | undefined,
                        page: 1,
                      }))
                    }
                    placeholder="Entry Type"
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Select
                    options={STATUS_OPTIONS}
                    value={entryFilters.status || ''}
                    onChange={(e) =>
                      setEntryFilters((prev) => ({
                        ...prev,
                        status: (e.target.value || undefined) as StockEntryStatus | undefined,
                        page: 1,
                      }))
                    }
                    placeholder="Status"
                  />
                </div>
                <div className="w-full sm:w-56">
                  <Select
                    options={[{ value: '', label: 'All Warehouses' }, ...warehouseOptions]}
                    value={entryFilters.warehouse || ''}
                    onChange={(e) =>
                      setEntryFilters((prev) => ({
                        ...prev,
                        warehouse: e.target.value || undefined,
                        page: 1,
                      }))
                    }
                    placeholder="Warehouse"
                  />
                </div>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setEntryFilters({ page: 1, page_size: 10 })
                  }
                >
                  <ArrowPathIcon className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            {loadingEntries ? (
              <SkeletonTable />
            ) : entries.length === 0 ? (
              <EmptyState
                type="data"
                title="No stock entries found"
                description="Create a stock entry to record receipts, issues, or transfers."
                action={{ label: 'New Stock Entry', onClick: () => setShowCreateModal(true) }}
              />
            ) : (
              <>
                <Table data={entries} columns={entryColumns} />
                {totalEntryPages > 1 && (
                  <TablePagination
                    currentPage={entryFilters.page || 1}
                    totalPages={totalEntryPages}
                    totalItems={totalEntries}
                    pageSize={entryFilters.page_size || 10}
                    onPageChange={(page) => setEntryFilters((prev) => ({ ...prev, page }))}
                  />
                )}
              </>
            )}
          </Card>
        </TabsContent>

        {/* Stock Ledger Tab */}
        <TabsContent value="ledger">
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:w-64">
                  <Select
                    options={[{ value: '', label: 'All Items' }, ...itemOptions]}
                    value={ledgerFilters.item || ''}
                    onChange={(e) =>
                      setLedgerFilters((prev) => ({
                        ...prev,
                        item: e.target.value || undefined,
                        page: 1,
                      }))
                    }
                    placeholder="Filter by Item"
                  />
                </div>
                <div className="w-full sm:w-56">
                  <Select
                    options={[{ value: '', label: 'All Warehouses' }, ...warehouseOptions]}
                    value={ledgerFilters.warehouse || ''}
                    onChange={(e) =>
                      setLedgerFilters((prev) => ({
                        ...prev,
                        warehouse: e.target.value || undefined,
                        page: 1,
                      }))
                    }
                    placeholder="Filter by Warehouse"
                  />
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setLedgerFilters({ page: 1, page_size: 10 })}
                >
                  <ArrowPathIcon className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            {loadingLedger ? (
              <SkeletonTable />
            ) : ledger.length === 0 ? (
              <EmptyState
                type="data"
                title="No stock balances found"
                description="Stock balances will appear here once stock entries are approved."
              />
            ) : (
              <>
                <Table data={ledger} columns={ledgerColumns} />
                {totalLedgerPages > 1 && (
                  <TablePagination
                    currentPage={ledgerFilters.page || 1}
                    totalPages={totalLedgerPages}
                    totalItems={totalLedger}
                    pageSize={ledgerFilters.page_size || 10}
                    onPageChange={(page) => setLedgerFilters((prev) => ({ ...prev, page }))}
                  />
                )}
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Stock Entry Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setFormData(initialEntryForm)
        }}
        title="New Stock Entry"
        size="lg"
      >
        <form onSubmit={handleCreateEntry} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Entry Type"
              options={[
                { value: 'RECEIPT', label: 'Receipt' },
                { value: 'ISSUE', label: 'Issue' },
                { value: 'TRANSFER', label: 'Transfer' },
                { value: 'ADJUSTMENT', label: 'Adjustment' },
              ]}
              value={formData.entry_type}
              onChange={(e) =>
                setFormData({ ...formData, entry_type: e.target.value as StockEntryType })
              }
              required
            />
            <Input
              label="Reference Number"
              value={formData.reference_number}
              onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
              placeholder="e.g., GRN-001"
            />
          </div>

          <Select
            label="Item"
            options={itemOptions}
            value={formData.item}
            onChange={(e) => setFormData({ ...formData, item: e.target.value })}
            placeholder="Select item"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label={formData.entry_type === 'TRANSFER' ? 'To Warehouse' : 'Warehouse'}
              options={warehouseOptions}
              value={formData.warehouse}
              onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
              placeholder="Select warehouse"
              required
            />
            {formData.entry_type === 'TRANSFER' && (
              <Select
                label="From Warehouse"
                options={warehouseOptions.filter(
                  (w: { value: string }) => w.value !== formData.warehouse
                )}
                value={formData.from_warehouse}
                onChange={(e) => setFormData({ ...formData, from_warehouse: e.target.value })}
                placeholder="Select source warehouse"
                required
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Quantity"
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
              required
            />
            <Input
              label="Unit Cost"
              type="number"
              min="0"
              step="0.01"
              value={formData.unit_cost}
              onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {/* Computed total cost */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Cost</span>
              <span className="text-lg font-semibold text-gray-900">
                {(formData.quantity * formData.unit_cost).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Source"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              placeholder="e.g., Purchase Order"
            />
            <Input
              label="Source Reference"
              value={formData.source_reference}
              onChange={(e) => setFormData({ ...formData, source_reference: e.target.value })}
              placeholder="e.g., PO-2026-001"
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
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateModal(false)
                setFormData(initialEntryForm)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Entry
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
