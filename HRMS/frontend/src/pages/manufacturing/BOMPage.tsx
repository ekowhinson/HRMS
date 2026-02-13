import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilSquareIcon,
  DocumentDuplicateIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { manufacturingService } from '@/services/manufacturing'
import type { BillOfMaterials, BOMStatus, BOMFilters } from '@/services/manufacturing'
import { inventoryService } from '@/services/inventory'
import type { Item } from '@/services/inventory'
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

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'OBSOLETE', label: 'Obsolete' },
]

const statusColors: Record<BOMStatus, 'default' | 'success' | 'danger'> = {
  DRAFT: 'default',
  ACTIVE: 'success',
  OBSOLETE: 'danger',
}

const initialFormData = {
  code: '',
  name: '',
  description: '',
  finished_product: '',
  yield_qty: 1,
}

export default function BOMPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingBOM, setEditingBOM] = useState<BillOfMaterials | null>(null)
  const [formData, setFormData] = useState(initialFormData)
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState<BOMFilters>({
    search: '',
    status: undefined,
    page: 1,
    page_size: 10,
  })

  // Queries
  const { data: bomsData, isLoading } = useQuery({
    queryKey: ['manufacturing-boms', filters],
    queryFn: () => manufacturingService.getBOMs(filters),
  })

  const { data: itemsData } = useQuery({
    queryKey: ['inventory-items-lookup'],
    queryFn: () => inventoryService.getItems({ page_size: 200, is_active: true }),
  })

  const boms = bomsData?.results || []
  const totalItems = bomsData?.count || 0
  const totalPages = Math.ceil(totalItems / (filters.page_size || 10))
  const allItems = itemsData?.results || []

  const itemOptions = allItems.map((i: Item) => ({
    value: i.id,
    label: `${i.code} - ${i.name}`,
  }))

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<BillOfMaterials>) => manufacturingService.createBOM(data),
    onSuccess: () => {
      toast.success('BOM created successfully')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-boms'] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create BOM')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BillOfMaterials> }) =>
      manufacturingService.updateBOM(id, data),
    onSuccess: () => {
      toast.success('BOM updated successfully')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-boms'] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update BOM')
    },
  })

  const activateMutation = useMutation({
    mutationFn: (id: string) => manufacturingService.activateBOM(id),
    onSuccess: () => {
      toast.success('BOM activated')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-boms'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to activate BOM')
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => manufacturingService.deactivateBOM(id),
    onSuccess: () => {
      toast.success('BOM deactivated')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-boms'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to deactivate BOM')
    },
  })

  const copyVersionMutation = useMutation({
    mutationFn: (id: string) => manufacturingService.copyBOMVersion(id),
    onSuccess: () => {
      toast.success('BOM version copied successfully')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-boms'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to copy BOM version')
    },
  })

  // Handlers
  const openCreateModal = () => {
    setEditingBOM(null)
    setFormData(initialFormData)
    setShowModal(true)
  }

  const openEditModal = (bom: BillOfMaterials) => {
    setEditingBOM(bom)
    setFormData({
      code: bom.code,
      name: bom.name,
      description: bom.description || '',
      finished_product: bom.finished_product,
      yield_qty: bom.yield_qty,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingBOM(null)
    setFormData(initialFormData)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingBOM) {
      updateMutation.mutate({ id: editingBOM.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  // Get finished product name helper
  const getProductName = (productId: string) => {
    const item = allItems.find((i: Item) => i.id === productId)
    return item ? item.name : '-'
  }

  // Columns
  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (bom: BillOfMaterials) => (
        <span className="text-sm font-mono font-medium text-gray-900">{bom.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (bom: BillOfMaterials) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{bom.name}</p>
          {bom.description && (
            <p className="text-xs text-gray-500 truncate max-w-xs">{bom.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'finished_product',
      header: 'Finished Product',
      render: (bom: BillOfMaterials) => (
        <span className="text-sm text-gray-700">{getProductName(bom.finished_product)}</span>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      render: (bom: BillOfMaterials) => (
        <span className="text-sm text-gray-700">v{bom.version}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (bom: BillOfMaterials) => (
        <Badge variant={statusColors[bom.status]} size="xs">
          {bom.status}
        </Badge>
      ),
    },
    {
      key: 'yield_qty',
      header: 'Yield Qty',
      render: (bom: BillOfMaterials) => (
        <span className="text-sm text-gray-700">{bom.yield_qty}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (bom: BillOfMaterials) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => openEditModal(bom)} title="Edit">
            <PencilSquareIcon className="h-4 w-4" />
          </Button>
          {bom.status === 'DRAFT' && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => activateMutation.mutate(bom.id)}
              disabled={activateMutation.isPending}
              title="Activate"
            >
              <CheckCircleIcon className="h-4 w-4 text-green-600" />
            </Button>
          )}
          {bom.status === 'ACTIVE' && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => deactivateMutation.mutate(bom.id)}
              disabled={deactivateMutation.isPending}
              title="Deactivate"
            >
              <XCircleIcon className="h-4 w-4 text-red-500" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => copyVersionMutation.mutate(bom.id)}
            disabled={copyVersionMutation.isPending}
            title="Copy Version"
          >
            <DocumentDuplicateIcon className="h-4 w-4 text-blue-600" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bills of Materials"
        subtitle="Define product structure and material requirements"
        actions={
          <Button onClick={openCreateModal}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Create BOM
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search BOMs by name or code..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                leftIcon={<MagnifyingGlassIcon className="h-5 w-5" />}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                options={STATUS_FILTER_OPTIONS}
                value={filters.status || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: (e.target.value || undefined) as BOMStatus | undefined,
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

      {/* BOMs Table */}
      <Card>
        {isLoading ? (
          <SkeletonTable />
        ) : boms.length === 0 ? (
          <EmptyState
            type="data"
            title="No bills of materials found"
            description="Create your first BOM to define product structures."
            action={{ label: 'Create BOM', onClick: openCreateModal }}
          />
        ) : (
          <>
            <Table data={boms} columns={columns} />
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
        title={editingBOM ? 'Edit Bill of Materials' : 'Create Bill of Materials'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="BOM Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., BOM-001"
              required
            />
            <Input
              label="BOM Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Bill of materials name"
              required
            />
          </div>

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="BOM description..."
            rows={2}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Finished Product"
              options={itemOptions}
              value={formData.finished_product}
              onChange={(e) => setFormData({ ...formData, finished_product: e.target.value })}
              placeholder="Select finished product"
              required
            />
            <Input
              label="Yield Quantity"
              type="number"
              min="1"
              step="0.01"
              value={formData.yield_qty}
              onChange={(e) =>
                setFormData({ ...formData, yield_qty: parseFloat(e.target.value) || 1 })
              }
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingBOM ? 'Update BOM' : 'Create BOM'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
