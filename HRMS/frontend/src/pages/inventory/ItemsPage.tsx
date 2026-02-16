import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { inventoryService } from '@/services/inventory'
import type { Item, ItemCategory, ItemFilters } from '@/services/inventory'
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

const UNIT_OPTIONS = [
  { value: 'EACH', label: 'Each' },
  { value: 'PCS', label: 'Pieces' },
  { value: 'KG', label: 'Kilograms' },
  { value: 'LTR', label: 'Litres' },
  { value: 'MTR', label: 'Metres' },
  { value: 'BOX', label: 'Box' },
  { value: 'SET', label: 'Set' },
  { value: 'PACK', label: 'Pack' },
  { value: 'ROLL', label: 'Roll' },
  { value: 'REAM', label: 'Ream' },
]

const ACTIVE_FILTER_OPTIONS = [
  { value: '', label: 'All Items' },
  { value: 'true', label: 'Active Only' },
  { value: 'false', label: 'Inactive Only' },
]

const initialFormData = {
  code: '',
  name: '',
  description: '',
  category: '',
  unit_of_measure: 'EACH',
  reorder_level: 0,
  reorder_qty: 0,
  standard_cost: 0,
  is_stockable: true,
  is_asset: false,
  is_active: true,
}

export default function ItemsPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [formData, setFormData] = useState(initialFormData)
  const [filters, setFilters] = useState<ItemFilters>({
    search: '',
    category: '',
    is_active: undefined,
    page: 1,
    page_size: 10,
  })
  const [searchInput, setSearchInput] = useState('')

  // Queries
  const { data: itemsData, isLoading } = useQuery({
    queryKey: ['inventory-items', filters],
    queryFn: () => inventoryService.getItems(filters),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: () => inventoryService.getCategories(),
  })

  const items = itemsData?.results || []
  const totalItems = itemsData?.count || 0
  const totalPages = Math.ceil(totalItems / (filters.page_size || 10))

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<Item>) => inventoryService.createItem(data),
    onSuccess: () => {
      toast.success('Item created successfully')
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create item')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Item> }) =>
      inventoryService.updateItem(id, data),
    onSuccess: () => {
      toast.success('Item updated successfully')
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update item')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryService.deleteItem(id),
    onSuccess: () => {
      toast.success('Item deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete item')
    },
  })

  // Handlers
  const openCreateModal = () => {
    setEditingItem(null)
    setFormData(initialFormData)
    setShowModal(true)
  }

  const openEditModal = (item: Item) => {
    setEditingItem(item)
    setFormData({
      code: item.code,
      name: item.name,
      description: item.description || '',
      category: item.category,
      unit_of_measure: item.unit_of_measure,
      reorder_level: item.reorder_level,
      reorder_qty: item.reorder_qty,
      standard_cost: item.standard_cost,
      is_stockable: item.is_stockable,
      is_asset: item.is_asset,
      is_active: item.is_active,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setFormData(initialFormData)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (item: Item) => {
    if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
      deleteMutation.mutate(item.id)
    }
  }

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const categoryOptions = categories.map((c: ItemCategory) => ({
    value: c.id,
    label: c.name,
  }))

  // Columns
  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (item: Item) => (
        <span className="text-sm font-mono font-medium text-gray-900">{item.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (item: Item) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{item.name}</p>
          {item.description && (
            <p className="text-xs text-gray-500 truncate max-w-xs">{item.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (item: Item) => (
        <span className="text-sm text-gray-700">{item.category_name || '-'}</span>
      ),
    },
    {
      key: 'uom',
      header: 'UoM',
      render: (item: Item) => (
        <span className="text-sm text-gray-700">{item.unit_of_measure}</span>
      ),
    },
    {
      key: 'stock',
      header: 'Stock Level',
      render: (item: Item) => {
        const stock = item.current_stock ?? 0
        const belowReorder = item.is_stockable && stock <= item.reorder_level
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">{stock}</span>
            {belowReorder && (
              <Badge variant="danger" size="xs" dot>
                Low
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      key: 'cost',
      header: 'Std. Cost',
      render: (item: Item) => (
        <span className="text-sm text-gray-700">
          {Number(item.standard_cost).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (item: Item) => (
        <div className="flex gap-1">
          {item.is_asset && <Badge variant="info" size="xs">Asset</Badge>}
          {item.is_stockable && <Badge variant="default" size="xs">Stockable</Badge>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Item) => (
        <Badge variant={item.is_active ? 'success' : 'default'} size="xs">
          {item.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item: Item) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => openEditModal(item)}>
            <PencilSquareIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => handleDelete(item)}
            disabled={deleteMutation.isPending}
          >
            <TrashIcon className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Item Master"
        subtitle="Manage inventory items and track stock levels"
        actions={
          <Button onClick={openCreateModal}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search items by name or code..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                leftIcon={<MagnifyingGlassIcon className="h-5 w-5" />}
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
            <div className="w-full sm:w-40">
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

      {/* Low Stock Alert */}
      {items.some((item: Item) => item.is_stockable && (item.current_stock ?? 0) <= item.reorder_level) && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            Some items are below their reorder level. Review stock levels and create purchase orders as needed.
          </p>
        </div>
      )}

      {/* Items Table */}
      <Card>
        {isLoading ? (
          <SkeletonTable />
        ) : items.length === 0 ? (
          <EmptyState
            type="data"
            title="No items found"
            description="Create your first inventory item to get started."
            action={{ label: 'Add Item', onClick: openCreateModal }}
          />
        ) : (
          <>
            <Table data={items} columns={columns} />
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

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingItem ? 'Edit Item' : 'Create Item'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Item Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., ITM-001"
              required
            />
            <Input
              label="Item Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Item name"
              required
            />
          </div>

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Item description..."
            rows={2}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Category"
              options={categoryOptions}
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="Select category"
              required
            />
            <Select
              label="Unit of Measure"
              options={UNIT_OPTIONS}
              value={formData.unit_of_measure}
              onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Standard Cost"
              type="number"
              min="0"
              step="0.01"
              value={formData.standard_cost}
              onChange={(e) => setFormData({ ...formData, standard_cost: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="Reorder Level"
              type="number"
              min="0"
              value={formData.reorder_level}
              onChange={(e) => setFormData({ ...formData, reorder_level: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="Reorder Qty"
              type="number"
              min="0"
              value={formData.reorder_qty}
              onChange={(e) => setFormData({ ...formData, reorder_qty: parseInt(e.target.value) || 0 })}
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_stockable}
                onChange={(e) => setFormData({ ...formData, is_stockable: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
              />
              <span className="text-sm text-gray-700">Stockable</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_asset}
                onChange={(e) => setFormData({ ...formData, is_asset: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
              />
              <span className="text-sm text-gray-700">Fixed Asset</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              <CubeIcon className="h-4 w-4 mr-2" />
              {editingItem ? 'Update Item' : 'Create Item'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
