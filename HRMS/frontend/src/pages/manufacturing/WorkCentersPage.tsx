import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import { manufacturingService } from '@/services/manufacturing'
import type { WorkCenter, WorkCenterFilters } from '@/services/manufacturing'
import { employeeService } from '@/services/employees'
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

const ACTIVE_FILTER_OPTIONS = [
  { value: '', label: 'All Work Centers' },
  { value: 'true', label: 'Active Only' },
  { value: 'false', label: 'Inactive Only' },
]

const initialFormData = {
  code: '',
  name: '',
  description: '',
  department: '',
  hourly_rate: 0,
  capacity_per_day: 0,
  is_active: true,
}

export default function WorkCentersPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingWorkCenter, setEditingWorkCenter] = useState<WorkCenter | null>(null)
  const [formData, setFormData] = useState(initialFormData)
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState<WorkCenterFilters>({
    search: '',
    is_active: undefined,
    page: 1,
    page_size: 10,
  })

  // Queries
  const { data: workCentersData, isLoading } = useQuery({
    queryKey: ['manufacturing-work-centers', filters],
    queryFn: () => manufacturingService.getWorkCenters(filters),
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => employeeService.getDepartments(),
  })

  const workCenters = workCentersData?.results || []
  const totalItems = workCentersData?.count || 0
  const totalPages = Math.ceil(totalItems / (filters.page_size || 10))

  const departmentOptions = departments.map((d: any) => ({
    value: d.id,
    label: d.name,
  }))

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<WorkCenter>) => manufacturingService.createWorkCenter(data),
    onSuccess: () => {
      toast.success('Work center created successfully')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-work-centers'] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create work center')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WorkCenter> }) =>
      manufacturingService.updateWorkCenter(id, data),
    onSuccess: () => {
      toast.success('Work center updated successfully')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-work-centers'] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update work center')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => manufacturingService.deleteWorkCenter(id),
    onSuccess: () => {
      toast.success('Work center deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-work-centers'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete work center')
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      manufacturingService.updateWorkCenter(id, { is_active }),
    onSuccess: () => {
      toast.success('Work center status updated')
      queryClient.invalidateQueries({ queryKey: ['manufacturing-work-centers'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update status')
    },
  })

  // Handlers
  const openCreateModal = () => {
    setEditingWorkCenter(null)
    setFormData(initialFormData)
    setShowModal(true)
  }

  const openEditModal = (wc: WorkCenter) => {
    setEditingWorkCenter(wc)
    setFormData({
      code: wc.code,
      name: wc.name,
      description: wc.description || '',
      department: wc.department || '',
      hourly_rate: wc.hourly_rate,
      capacity_per_day: wc.capacity_per_day,
      is_active: wc.is_active,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingWorkCenter(null)
    setFormData(initialFormData)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingWorkCenter) {
      updateMutation.mutate({ id: editingWorkCenter.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (wc: WorkCenter) => {
    if (confirm(`Are you sure you want to delete work center "${wc.name}"?`)) {
      deleteMutation.mutate(wc.id)
    }
  }

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  // Columns
  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (wc: WorkCenter) => (
        <span className="text-sm font-mono font-medium text-gray-900">{wc.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (wc: WorkCenter) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{wc.name}</p>
          {wc.description && (
            <p className="text-xs text-gray-500 truncate max-w-xs">{wc.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (wc: WorkCenter) => (
        <span className="text-sm text-gray-700">{wc.department_name || '-'}</span>
      ),
    },
    {
      key: 'hourly_rate',
      header: 'Hourly Rate',
      render: (wc: WorkCenter) => (
        <span className="text-sm text-gray-700">
          {Number(wc.hourly_rate).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: 'capacity_per_day',
      header: 'Capacity/Day',
      render: (wc: WorkCenter) => (
        <span className="text-sm text-gray-700">{wc.capacity_per_day}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (wc: WorkCenter) => (
        <Badge variant={wc.is_active ? 'success' : 'default'} size="xs">
          {wc.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (wc: WorkCenter) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => openEditModal(wc)} title="Edit">
            <PencilSquareIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() =>
              toggleActiveMutation.mutate({ id: wc.id, is_active: !wc.is_active })
            }
            disabled={toggleActiveMutation.isPending}
            title={wc.is_active ? 'Deactivate' : 'Activate'}
          >
            <span className={`text-xs font-medium ${wc.is_active ? 'text-red-500' : 'text-green-600'}`}>
              {wc.is_active ? 'Deactivate' : 'Activate'}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => handleDelete(wc)}
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
        title="Work Centers"
        subtitle="Manage manufacturing work centers and their capacities"
        actions={
          <Button onClick={openCreateModal}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Work Center
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search work centers by name or code..."
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

      {/* Work Centers Table */}
      <Card>
        {isLoading ? (
          <SkeletonTable />
        ) : workCenters.length === 0 ? (
          <EmptyState
            type="data"
            title="No work centers found"
            description="Create your first work center to define manufacturing stations."
            action={{ label: 'Add Work Center', onClick: openCreateModal }}
          />
        ) : (
          <>
            <Table data={workCenters} columns={columns} />
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
        title={editingWorkCenter ? 'Edit Work Center' : 'Create Work Center'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Work Center Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., WC-001"
              required
            />
            <Input
              label="Work Center Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Work center name"
              required
            />
          </div>

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Work center description..."
            rows={2}
          />

          <Select
            label="Department"
            options={departmentOptions}
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            placeholder="Select department"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Hourly Rate"
              type="number"
              min="0"
              step="0.01"
              value={formData.hourly_rate}
              onChange={(e) =>
                setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })
              }
            />
            <Input
              label="Capacity Per Day"
              type="number"
              min="0"
              value={formData.capacity_per_day}
              onChange={(e) =>
                setFormData({ ...formData, capacity_per_day: parseInt(e.target.value) || 0 })
              }
            />
          </div>

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
              <WrenchScrewdriverIcon className="h-4 w-4 mr-2" />
              {editingWorkCenter ? 'Update Work Center' : 'Create Work Center'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
