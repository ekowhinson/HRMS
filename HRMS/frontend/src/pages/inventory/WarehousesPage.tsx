import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  BuildingStorefrontIcon,
  MapPinIcon,
  UserIcon,
  CubeIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { inventoryService } from '@/services/inventory'
import type { Warehouse, WarehouseFilters, StockLedger } from '@/services/inventory'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Table from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Textarea from '@/components/ui/Textarea'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonCard } from '@/components/ui/Skeleton'

const ACTIVE_FILTER_OPTIONS = [
  { value: '', label: 'All Warehouses' },
  { value: 'true', label: 'Active Only' },
  { value: 'false', label: 'Inactive Only' },
]

const initialFormData = {
  name: '',
  code: '',
  location: '',
  manager: '',
  address: '',
  is_active: true,
}

export default function WarehousesPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [formData, setFormData] = useState(initialFormData)
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState<WarehouseFilters>({
    search: '',
    is_active: undefined,
    page: 1,
    page_size: 50,
  })

  // Queries
  const { data: warehousesData, isLoading } = useQuery({
    queryKey: ['inventory-warehouses', filters],
    queryFn: () => inventoryService.getWarehouses(filters),
  })

  const { data: warehouseStockData, isLoading: loadingStock } = useQuery({
    queryKey: ['warehouse-stock', selectedWarehouse?.id],
    queryFn: () =>
      inventoryService.getStockLedger({ warehouse: selectedWarehouse!.id, page_size: 100 }),
    enabled: !!selectedWarehouse,
  })

  const warehouses = warehousesData?.results || []
  const warehouseStock = warehouseStockData?.results || []

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<Warehouse>) => inventoryService.createWarehouse(data),
    onSuccess: () => {
      toast.success('Warehouse created successfully')
      queryClient.invalidateQueries({ queryKey: ['inventory-warehouses'] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create warehouse')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Warehouse> }) =>
      inventoryService.updateWarehouse(id, data),
    onSuccess: () => {
      toast.success('Warehouse updated successfully')
      queryClient.invalidateQueries({ queryKey: ['inventory-warehouses'] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update warehouse')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryService.deleteWarehouse(id),
    onSuccess: () => {
      toast.success('Warehouse deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['inventory-warehouses'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete warehouse')
    },
  })

  // Handlers
  const openCreateModal = () => {
    setEditingWarehouse(null)
    setFormData(initialFormData)
    setShowModal(true)
  }

  const openEditModal = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse)
    setFormData({
      name: warehouse.name,
      code: warehouse.code,
      location: warehouse.location,
      manager: warehouse.manager || '',
      address: warehouse.address || '',
      is_active: warehouse.is_active,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingWarehouse(null)
    setFormData(initialFormData)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingWarehouse) {
      updateMutation.mutate({ id: editingWarehouse.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (warehouse: Warehouse) => {
    if (confirm(`Are you sure you want to delete warehouse "${warehouse.name}"?`)) {
      deleteMutation.mutate(warehouse.id)
    }
  }

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  // Stock summary columns for the detail modal
  const stockColumns = [
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
      key: 'balance',
      header: 'Balance',
      render: (row: StockLedger) => (
        <span className="text-sm font-semibold text-gray-900">{row.balance_qty}</span>
      ),
    },
    {
      key: 'avg_cost',
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
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        subtitle="Manage storage locations and view stock by warehouse"
        actions={
          <Button onClick={openCreateModal}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Warehouse
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search warehouses..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                leftIcon={<MagnifyingGlassIcon className="h-5 w-5" />}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                options={ACTIVE_FILTER_OPTIONS}
                value={
                  filters.is_active === undefined
                    ? ''
                    : filters.is_active
                    ? 'true'
                    : 'false'
                }
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    is_active: e.target.value === '' ? undefined : e.target.value === 'true',
                    page: 1,
                  }))
                }
                placeholder="Status"
              />
            </div>
            <Button variant="secondary" onClick={handleSearch}>
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Warehouse Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : warehouses.length === 0 ? (
        <Card>
          <EmptyState
            type="data"
            title="No warehouses found"
            description="Create your first warehouse to start managing inventory locations."
            action={{ label: 'Add Warehouse', onClick: openCreateModal }}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.map((warehouse: Warehouse) => (
            <Card
              key={warehouse.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                      <BuildingStorefrontIcon className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{warehouse.name}</h3>
                      <p className="text-xs font-mono text-gray-500">{warehouse.code}</p>
                    </div>
                  </div>
                  <Badge variant={warehouse.is_active ? 'success' : 'default'} size="xs">
                    {warehouse.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  {warehouse.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPinIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{warehouse.location}</span>
                    </div>
                  )}
                  {warehouse.manager_name && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <UserIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{warehouse.manager_name}</span>
                    </div>
                  )}
                  {warehouse.address && (
                    <p className="text-xs text-gray-500 truncate">{warehouse.address}</p>
                  )}
                </div>

                {/* Summary stats */}
                <div className="flex items-center gap-4 py-3 border-t border-gray-100">
                  {warehouse.stock_count !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <CubeIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {warehouse.stock_count} items
                      </span>
                    </div>
                  )}
                  {warehouse.total_value !== undefined && (
                    <span className="text-sm font-medium text-gray-900">
                      {Number(warehouse.total_value).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setSelectedWarehouse(warehouse)}
                  >
                    View Stock
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => openEditModal(warehouse)}
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleDelete(warehouse)}
                    disabled={deleteMutation.isPending}
                  >
                    <TrashIcon className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingWarehouse ? 'Edit Warehouse' : 'Create Warehouse'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Warehouse Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Main Warehouse"
              required
            />
            <Input
              label="Warehouse Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., WH-001"
              required
            />
          </div>

          <Input
            label="Location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="Location"
          />

          <Textarea
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Full address"
            rows={2}
          />

          <Input
            label="Manager"
            value={formData.manager}
            onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
            placeholder="Warehouse manager"
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              <BuildingStorefrontIcon className="h-4 w-4 mr-2" />
              {editingWarehouse ? 'Update Warehouse' : 'Create Warehouse'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Stock Detail Modal */}
      <Modal
        isOpen={!!selectedWarehouse}
        onClose={() => setSelectedWarehouse(null)}
        title={`Stock Summary - ${selectedWarehouse?.name || ''}`}
        size="lg"
      >
        {selectedWarehouse && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Warehouse Code</p>
                <p className="text-sm font-mono font-medium">{selectedWarehouse.code}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="text-sm font-medium">{selectedWarehouse.location || '-'}</p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Items in Stock</h4>
              {loadingStock ? (
                <div className="text-center py-6 text-gray-500">Loading stock data...</div>
              ) : warehouseStock.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-6 text-center">
                  <CubeIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No stock in this warehouse</p>
                </div>
              ) : (
                <>
                  <Table data={warehouseStock} columns={stockColumns} />
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">
                      Total Items: {warehouseStock.length}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      Total Value:{' '}
                      {warehouseStock
                        .reduce((sum: number, row: StockLedger) => sum + Number(row.valuation_amount), 0)
                        .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => setSelectedWarehouse(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
