import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  AcademicCapIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { performanceService, type Competency } from '@/services/performance'
import { Card, CardContent } from '@/components/ui/Card'
import { TablePagination } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'

const categoryOptions = [
  { value: '', label: 'Select Category' },
  { value: 'CORE', label: 'Core Competencies' },
  { value: 'FUNCTIONAL', label: 'Functional Competencies' },
  { value: 'LEADERSHIP', label: 'Leadership Competencies' },
  { value: 'TECHNICAL', label: 'Technical Competencies' },
]

const initialFormData: Partial<Competency> = {
  name: '',
  code: '',
  category: 'CORE',
  description: '',
  behavioral_indicators: '',
  is_active: true,
  sort_order: 0,
}

export default function CompetenciesPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingCompetency, setEditingCompetency] = useState<Competency | null>(null)
  const [formData, setFormData] = useState(initialFormData)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingCompetency, setDeletingCompetency] = useState<Competency | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    CORE: true,
    FUNCTIONAL: true,
    LEADERSHIP: true,
    TECHNICAL: true,
  })
  const [categoryFilter, setCategoryFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const { data: competencies, isLoading } = useQuery({
    queryKey: ['competencies', categoryFilter],
    queryFn: () => performanceService.getCompetencies(categoryFilter || undefined),
  })

  const createMutation = useMutation({
    mutationFn: performanceService.createCompetency,
    onSuccess: () => {
      toast.success('Competency created successfully')
      queryClient.invalidateQueries({ queryKey: ['competencies'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create competency')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Competency> }) =>
      performanceService.updateCompetency(id, data),
    onSuccess: () => {
      toast.success('Competency updated successfully')
      queryClient.invalidateQueries({ queryKey: ['competencies'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update competency')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: performanceService.deleteCompetency,
    onSuccess: () => {
      toast.success('Competency deleted')
      queryClient.invalidateQueries({ queryKey: ['competencies'] })
      setShowDeleteModal(false)
      setDeletingCompetency(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete competency')
    },
  })

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleOpenCreate = () => {
    setEditingCompetency(null)
    setFormData(initialFormData)
    setShowModal(true)
  }

  const handleOpenEdit = (competency: Competency) => {
    setEditingCompetency(competency)
    setFormData({
      name: competency.name,
      code: competency.code,
      category: competency.category,
      description: competency.description,
      behavioral_indicators: competency.behavioral_indicators,
      is_active: competency.is_active,
      sort_order: competency.sort_order,
    })
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingCompetency(null)
    setFormData(initialFormData)
  }

  const handleSubmit = () => {
    if (!formData.name || !formData.code || !formData.category) {
      toast.error('Please fill in all required fields')
      return
    }

    if (editingCompetency) {
      updateMutation.mutate({ id: editingCompetency.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (competency: Competency) => {
    setDeletingCompetency(competency)
    setShowDeleteModal(true)
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }))
  }

  // Paginate then group by category
  const paginatedCompetencies = (competencies || []).slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const groupedCompetencies = paginatedCompetencies.reduce((acc: Record<string, Competency[]>, comp) => {
    const cat = comp.category || 'OTHER'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(comp)
    return acc
  }, {})

  const getCategoryLabel = (cat: string) => {
    return categoryOptions.find((o) => o.value === cat)?.label || cat
  }

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      CORE: 'bg-blue-100 text-blue-800',
      FUNCTIONAL: 'bg-green-100 text-green-800',
      LEADERSHIP: 'bg-purple-100 text-purple-800',
      TECHNICAL: 'bg-orange-100 text-orange-800',
    }
    return colors[cat] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Competency Framework</h1>
          <p className="mt-1 text-sm text-gray-500">
            Define competencies and proficiency levels for performance assessment
          </p>
        </div>
        <div className="flex gap-3">
          <Select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1) }}
            options={[{ value: '', label: 'All Categories' }, ...categoryOptions.slice(1)]}
          />
          <Button onClick={handleOpenCreate}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Competency
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : competencies && competencies.length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groupedCompetencies).map(([category, comps]) => (
            <Card key={category}>
              <button
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center gap-3">
                  <AcademicCapIcon className="h-5 w-5 text-primary-500" />
                  <span className="font-medium text-gray-900">
                    {getCategoryLabel(category)}
                  </span>
                  <Badge className={getCategoryColor(category)}>
                    {comps.length} competencies
                  </Badge>
                </div>
                {expandedCategories[category] ? (
                  <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {expandedCategories[category] && (
                <CardContent className="pt-0">
                  <div className="divide-y">
                    {comps.map((competency) => (
                      <div
                        key={competency.id}
                        className="py-4 flex items-start justify-between"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-primary-600 font-medium">
                              {competency.code}
                            </span>
                            <span className="font-medium text-gray-900">
                              {competency.name}
                            </span>
                            {!competency.is_active && (
                              <Badge variant="default">Inactive</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {competency.description}
                          </p>
                          {competency.behavioral_indicators && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-gray-500">Behavioral Indicators:</p>
                              <p className="text-xs text-gray-500 whitespace-pre-line">
                                {competency.behavioral_indicators}
                              </p>
                            </div>
                          )}
                          {competency.levels && competency.levels.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {competency.levels.map((level) => (
                                <span
                                  key={level.id}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600"
                                >
                                  L{level.level}: {level.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(competency)}
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(competency)}
                          >
                            <TrashIcon className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
          {competencies && competencies.length > pageSize && (
            <TablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(competencies.length / pageSize)}
              totalItems={competencies.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              type="data"
              title="No competencies defined"
              description="Create competencies to enable competency-based assessments."
              action={{ label: 'Add Competency', onClick: handleOpenCreate }}
            />
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingCompetency ? 'Edit Competency' : 'Add Competency'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Code"
              value={formData.code || ''}
              onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
              placeholder="e.g., COMM"
              required
            />
            <Select
              label="Category"
              value={formData.category || ''}
              onChange={(e) => handleChange('category', e.target.value)}
              options={categoryOptions}
              required
            />
          </div>

          <Input
            label="Name"
            value={formData.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g., Communication"
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
              placeholder="Describe what this competency entails..."
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
              placeholder="List observable behaviors that demonstrate this competency (one per line)..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Sort Order"
              type="number"
              value={formData.sort_order?.toString() || '0'}
              onChange={(e) => handleChange('sort_order', parseInt(e.target.value) || 0)}
            />
            <div className="flex items-center pt-6">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => handleChange('is_active', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-1 focus:ring-[#0969da] border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-700">
                Active (available for assessments)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingCompetency ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Competency"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deletingCompetency?.name}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deletingCompetency && deleteMutation.mutate(deletingCompetency.id)}
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
