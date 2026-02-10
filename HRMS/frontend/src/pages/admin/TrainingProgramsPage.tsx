import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  AcademicCapIcon,
  PlusIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import { trainingService } from '@/services/training'
import type { TrainingProgram } from '@/types'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { StatsCard } from '@/components/ui/StatsCard'

const categoryOptions = [
  { value: '', label: 'All Categories' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'LEADERSHIP', label: 'Leadership' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'SOFT_SKILLS', label: 'Soft Skills' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'OTHER', label: 'Other' },
]

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'INTERNAL', label: 'Internal' },
  { value: 'EXTERNAL', label: 'External' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'WORKSHOP', label: 'Workshop' },
  { value: 'CONFERENCE', label: 'Conference' },
  { value: 'CERTIFICATION', label: 'Certification' },
]

const mandatoryOptions = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Mandatory' },
  { value: 'false', label: 'Optional' },
]

const activeOptions = [
  { value: '', label: 'All Status' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

const categoryColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  TECHNICAL: 'info',
  LEADERSHIP: 'warning',
  COMPLIANCE: 'danger',
  SOFT_SKILLS: 'success',
  ONBOARDING: 'default',
  OTHER: 'default',
}

const initialFormData = {
  name: '',
  code: '',
  description: '',
  category: 'OTHER',
  training_type: 'INTERNAL',
  duration_hours: '',
  max_participants: '',
  is_mandatory: false,
  is_active: true,
  cost_per_person: '0',
  provider: '',
  objectives: '',
  prerequisites: '',
}

export default function TrainingProgramsPage() {
  const queryClient = useQueryClient()
  const [categoryFilter, setCategoryFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [mandatoryFilter, setMandatoryFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [selectedProgram, setSelectedProgram] = useState<TrainingProgram | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [formData, setFormData] = useState(initialFormData)

  // Fetch programs
  const { data: programs, isLoading } = useQuery({
    queryKey: ['training-programs', categoryFilter, typeFilter, mandatoryFilter, activeFilter, searchQuery, currentPage],
    queryFn: () =>
      trainingService.getPrograms({
        category: categoryFilter || undefined,
        training_type: typeFilter || undefined,
        is_mandatory: mandatoryFilter || undefined,
        is_active: activeFilter || undefined,
        search: searchQuery || undefined,
        page: currentPage,
        page_size: pageSize,
      }),
  })

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['training-program-stats'],
    queryFn: trainingService.getProgramStats,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => trainingService.createProgram(data),
    onSuccess: () => {
      toast.success('Program created successfully')
      queryClient.invalidateQueries({ queryKey: ['training-programs'] })
      queryClient.invalidateQueries({ queryKey: ['training-program-stats'] })
      setShowCreateModal(false)
      setFormData(initialFormData)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create program')
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => trainingService.updateProgram(id, data),
    onSuccess: () => {
      toast.success('Program updated successfully')
      queryClient.invalidateQueries({ queryKey: ['training-programs'] })
      queryClient.invalidateQueries({ queryKey: ['training-program-stats'] })
      setShowEditModal(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update program')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: trainingService.deleteProgram,
    onSuccess: () => {
      toast.success('Program deleted')
      queryClient.invalidateQueries({ queryKey: ['training-programs'] })
      queryClient.invalidateQueries({ queryKey: ['training-program-stats'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete program')
    },
  })

  const handleCreate = () => {
    const payload = {
      ...formData,
      duration_hours: parseFloat(formData.duration_hours) || 0,
      max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
      cost_per_person: parseFloat(formData.cost_per_person) || 0,
    }
    createMutation.mutate(payload)
  }

  const handleUpdate = () => {
    if (!selectedProgram) return
    const payload = {
      ...formData,
      duration_hours: parseFloat(formData.duration_hours) || 0,
      max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
      cost_per_person: parseFloat(formData.cost_per_person) || 0,
    }
    updateMutation.mutate({ id: selectedProgram.id, data: payload })
  }

  const openEditModal = (program: TrainingProgram) => {
    setSelectedProgram(program)
    setFormData({
      name: program.name,
      code: program.code,
      description: program.description || '',
      category: program.category,
      training_type: program.training_type,
      duration_hours: String(program.duration_hours),
      max_participants: program.max_participants ? String(program.max_participants) : '',
      is_mandatory: program.is_mandatory,
      is_active: program.is_active,
      cost_per_person: String(program.cost_per_person),
      provider: program.provider || '',
      objectives: program.objectives || '',
      prerequisites: program.prerequisites || '',
    })
    setShowEditModal(true)
  }

  const columns = [
    {
      key: 'name',
      header: 'Program',
      render: (row: TrainingProgram) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-500">{row.code}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row: TrainingProgram) => (
        <Badge variant={categoryColors[row.category] || 'default'}>
          {row.category_display}
        </Badge>
      ),
    },
    {
      key: 'training_type',
      header: 'Type',
      render: (row: TrainingProgram) => row.type_display,
    },
    {
      key: 'duration_hours',
      header: 'Duration',
      render: (row: TrainingProgram) => `${row.duration_hours}h`,
    },
    {
      key: 'session_count',
      header: 'Sessions',
      render: (row: TrainingProgram) => row.session_count,
    },
    {
      key: 'enrolled_count',
      header: 'Enrolled',
      render: (row: TrainingProgram) => row.enrolled_count,
    },
    {
      key: 'is_mandatory',
      header: 'Mandatory',
      render: (row: TrainingProgram) =>
        row.is_mandatory ? (
          <Badge variant="danger">Mandatory</Badge>
        ) : (
          <span className="text-xs text-gray-400">Optional</span>
        ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row: TrainingProgram) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: TrainingProgram) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSelectedProgram(row); setShowDetailModal(true) }}
          >
            <EyeIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEditModal(row)}>
            <PencilSquareIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('Delete this program?')) deleteMutation.mutate(row.id)
            }}
          >
            <TrashIcon className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ]

  const renderForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Program Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
        <Input
          label="Code"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
          required
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Category"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          options={categoryOptions.filter((o) => o.value)}
        />
        <Select
          label="Training Type"
          value={formData.training_type}
          onChange={(e) => setFormData({ ...formData, training_type: e.target.value })}
          options={typeOptions.filter((o) => o.value)}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="Duration (hours)"
          type="number"
          value={formData.duration_hours}
          onChange={(e) => setFormData({ ...formData, duration_hours: e.target.value })}
        />
        <Input
          label="Max Participants"
          type="number"
          value={formData.max_participants}
          onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
          placeholder="Unlimited"
        />
        <Input
          label="Cost per Person (GHS)"
          type="number"
          value={formData.cost_per_person}
          onChange={(e) => setFormData({ ...formData, cost_per_person: e.target.value })}
        />
      </div>
      <Input
        label="Provider"
        value={formData.provider}
        onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Objectives</label>
        <textarea
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          rows={2}
          value={formData.objectives}
          onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Prerequisites</label>
        <textarea
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          rows={2}
          value={formData.prerequisites}
          onChange={(e) => setFormData({ ...formData, prerequisites: e.target.value })}
        />
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formData.is_mandatory}
            onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Mandatory Program
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Active
        </label>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Programs</h1>
          <p className="text-sm text-gray-500 mt-1">Manage training program catalog</p>
        </div>
        <Button onClick={() => { setFormData(initialFormData); setShowCreateModal(true) }}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Program
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Programs"
          value={stats?.total_programs ?? 0}
          icon={<AcademicCapIcon className="h-6 w-6" />}
          variant="primary"
        />
        <StatsCard
          title="Mandatory"
          value={stats?.mandatory_programs ?? 0}
          icon={<ExclamationTriangleIcon className="h-6 w-6" />}
          variant="danger"
        />
        <StatsCard
          title="Active"
          value={stats?.active_programs ?? 0}
          icon={<CheckCircleIcon className="h-6 w-6" />}
          variant="success"
        />
        <StatsCard
          title="Total Enrolled"
          value={stats?.total_enrolled ?? 0}
          icon={<UsersIcon className="h-6 w-6" />}
          variant="info"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Input
              placeholder="Search programs..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
            />
            <Select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1) }}
              options={categoryOptions}
            />
            <Select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1) }}
              options={typeOptions}
            />
            <Select
              value={mandatoryFilter}
              onChange={(e) => { setMandatoryFilter(e.target.value); setCurrentPage(1) }}
              options={mandatoryOptions}
            />
            <Select
              value={activeFilter}
              onChange={(e) => { setActiveFilter(e.target.value); setCurrentPage(1) }}
              options={activeOptions}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent>
          <Table
            columns={columns}
            data={programs?.results || []}
            isLoading={isLoading}
            emptyMessage="No training programs found"
          />
          {programs && programs.count > pageSize && (
            <TablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(programs.count / pageSize)}
              onPageChange={setCurrentPage}
              totalItems={programs.count}
              pageSize={pageSize}
            />
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Training Program"
        size="lg"
      >
        {renderForm()}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Program'}
          </Button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Training Program"
        size="lg"
      >
        {renderForm()}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
          <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Program Details"
        size="lg"
      >
        {selectedProgram && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Name</p>
                <p className="font-medium">{selectedProgram.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Code</p>
                <p className="font-medium">{selectedProgram.code}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Category</p>
                <Badge variant={categoryColors[selectedProgram.category] || 'default'}>
                  {selectedProgram.category_display}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500">Type</p>
                <p>{selectedProgram.type_display}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Duration</p>
                <p>{selectedProgram.duration_hours} hours</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Max Participants</p>
                <p>{selectedProgram.max_participants || 'Unlimited'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Cost per Person</p>
                <p>GHS {Number(selectedProgram.cost_per_person).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Provider</p>
                <p>{selectedProgram.provider || '-'}</p>
              </div>
            </div>
            {selectedProgram.description && (
              <div>
                <p className="text-xs text-gray-500">Description</p>
                <p className="text-sm mt-1">{selectedProgram.description}</p>
              </div>
            )}
            {selectedProgram.objectives && (
              <div>
                <p className="text-xs text-gray-500">Objectives</p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{selectedProgram.objectives}</p>
              </div>
            )}
            {selectedProgram.prerequisites && (
              <div>
                <p className="text-xs text-gray-500">Prerequisites</p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{selectedProgram.prerequisites}</p>
              </div>
            )}
            <div className="flex items-center gap-4">
              <Badge variant={selectedProgram.is_mandatory ? 'danger' : 'default'}>
                {selectedProgram.is_mandatory ? 'Mandatory' : 'Optional'}
              </Badge>
              <Badge variant={selectedProgram.is_active ? 'success' : 'default'}>
                {selectedProgram.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div>
                <p className="text-xs text-gray-500">Total Sessions</p>
                <p className="text-lg font-semibold">{selectedProgram.session_count}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Enrolled</p>
                <p className="text-lg font-semibold">{selectedProgram.enrolled_count}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
