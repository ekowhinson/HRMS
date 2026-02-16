import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  StarIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { performanceService, type CoreValue } from '@/services/performance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'

const initialFormData: Partial<CoreValue> = {
  code: '',
  name: '',
  description: '',
  behavioral_indicators: '',
  is_active: true,
  sort_order: 0,
}

export default function CoreValuesPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingValue, setEditingValue] = useState<CoreValue | null>(null)
  const [formData, setFormData] = useState(initialFormData)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingValue, setDeletingValue] = useState<CoreValue | null>(null)

  const { data: coreValues, isLoading } = useQuery({
    queryKey: ['core-values'],
    queryFn: () => performanceService.getCoreValues(true),
  })

  const createMutation = useMutation({
    mutationFn: performanceService.createCoreValue,
    onSuccess: () => {
      toast.success('Core value created successfully')
      queryClient.invalidateQueries({ queryKey: ['core-values'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create core value')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CoreValue> }) =>
      performanceService.updateCoreValue(id, data),
    onSuccess: () => {
      toast.success('Core value updated successfully')
      queryClient.invalidateQueries({ queryKey: ['core-values'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update core value')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: performanceService.deleteCoreValue,
    onSuccess: () => {
      toast.success('Core value deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['core-values'] })
      setShowDeleteModal(false)
      setDeletingValue(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete core value')
    },
  })

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleOpenCreate = () => {
    setEditingValue(null)
    setFormData(initialFormData)
    setShowModal(true)
  }

  const handleOpenEdit = (value: CoreValue) => {
    setEditingValue(value)
    setFormData({
      code: value.code,
      name: value.name,
      description: value.description,
      behavioral_indicators: value.behavioral_indicators,
      is_active: value.is_active,
      sort_order: value.sort_order,
    })
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingValue(null)
    setFormData(initialFormData)
  }

  const handleSubmit = () => {
    if (!formData.code || !formData.name || !formData.description) {
      toast.error('Please fill in all required fields')
      return
    }

    if (editingValue) {
      updateMutation.mutate({ id: editingValue.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (value: CoreValue) => {
    setDeletingValue(value)
    setShowDeleteModal(true)
  }

  const confirmDelete = () => {
    if (deletingValue) {
      deleteMutation.mutate(deletingValue.id)
    }
  }

  const columns = [
    {
      key: 'sort_order',
      header: '#',
      render: (value: CoreValue) => (
        <span className="text-gray-500 font-medium">{value.sort_order}</span>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      render: (value: CoreValue) => (
        <span className="font-mono text-sm font-semibold text-primary-600">
          {value.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (value: CoreValue) => (
        <div className="flex items-center gap-2">
          <StarIcon className="h-5 w-5 text-yellow-500" />
          <span className="font-medium text-gray-900">{value.name}</span>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (value: CoreValue) => (
        <p className="text-sm text-gray-600 max-w-md truncate">
          {value.description}
        </p>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (value: CoreValue) => (
        <Badge variant={value.is_active ? 'success' : 'default'}>
          {value.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (value: CoreValue) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenEdit(value)}
          >
            <PencilSquareIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(value)}
          >
            <TrashIcon className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Core Values</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage organization core values for appraisal assessments
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Core Value
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <StarIcon className="h-5 w-5 mr-2 text-yellow-500" />
            Organization Core Values
          </CardTitle>
        </CardHeader>
        {coreValues && coreValues.length > 0 ? (
          <Table
            data={coreValues}
            columns={columns}
            isLoading={isLoading}
          />
        ) : (
          <CardContent>
            <EmptyState
              type="data"
              title="No core values defined"
              description="Add core values to enable value-based appraisal assessments."
              action={{ label: 'Add Core Value', onClick: handleOpenCreate }}
            />
          </CardContent>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingValue ? 'Edit Core Value' : 'Add Core Value'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Code"
              value={formData.code || ''}
              onChange={(e) => handleChange('code', e.target.value)}
              placeholder="e.g., INT"
              required
            />
            <Input
              label="Sort Order"
              type="number"
              value={formData.sort_order?.toString() || '0'}
              onChange={(e) => handleChange('sort_order', parseInt(e.target.value) || 0)}
            />
          </div>

          <Input
            label="Name"
            value={formData.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g., Integrity"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] sm:text-sm bg-gray-50 focus:bg-white hover:border-gray-400 transition-colors duration-150"
              rows={3}
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe what this value means..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Behavioral Indicators
            </label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] sm:text-sm bg-gray-50 focus:bg-white hover:border-gray-400 transition-colors duration-150"
              rows={4}
              value={formData.behavioral_indicators || ''}
              onChange={(e) => handleChange('behavioral_indicators', e.target.value)}
              placeholder="List observable behaviors that demonstrate this value (one per line)..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => handleChange('is_active', e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-1 focus:ring-[#0969da] border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              Active (available for assessments)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingValue ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Core Value"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-md">
            <XCircleIcon className="h-6 w-6 text-red-500" />
            <p className="text-sm text-red-700">
              Are you sure you want to delete{' '}
              <strong>{deletingValue?.name}</strong>? This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              isLoading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
