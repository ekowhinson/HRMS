import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'
import { performanceService, type AppraisalCycle } from '@/services/performance'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  PLANNING: 'default',
  GOAL_SETTING: 'info',
  IN_PROGRESS: 'warning',
  REVIEW: 'warning',
  COMPLETED: 'success',
  ARCHIVED: 'default',
}

const initialFormData: Partial<AppraisalCycle> = {
  name: '',
  description: '',
  year: new Date().getFullYear(),
  start_date: '',
  end_date: '',
  goal_setting_start: '',
  goal_setting_end: '',
  mid_year_start: '',
  mid_year_end: '',
  year_end_start: '',
  year_end_end: '',
  objectives_weight: 60,
  competencies_weight: 20,
  values_weight: 20,
  pass_mark: 60,
  increment_threshold: 70,
  promotion_threshold: 85,
  pip_threshold: 40,
  min_goals: 3,
  max_goals: 7,
  allow_self_assessment: true,
  allow_peer_feedback: false,
  require_manager_approval: true,
}

export default function AppraisalCyclesPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingCycle, setEditingCycle] = useState<AppraisalCycle | null>(null)
  const [formData, setFormData] = useState(initialFormData)
  const [activeTab, setActiveTab] = useState('basic')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingCycle, setDeletingCycle] = useState<AppraisalCycle | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const { data: cycles, isLoading } = useQuery({
    queryKey: ['appraisal-cycles'],
    queryFn: performanceService.getAppraisalCycles,
  })

  const createMutation = useMutation({
    mutationFn: performanceService.createAppraisalCycle,
    onSuccess: () => {
      toast.success('Appraisal cycle created successfully')
      queryClient.invalidateQueries({ queryKey: ['appraisal-cycles'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create cycle')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AppraisalCycle> }) =>
      performanceService.updateAppraisalCycle(id, data),
    onSuccess: () => {
      toast.success('Appraisal cycle updated successfully')
      queryClient.invalidateQueries({ queryKey: ['appraisal-cycles'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update cycle')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: performanceService.deleteAppraisalCycle,
    onSuccess: () => {
      toast.success('Appraisal cycle deleted')
      queryClient.invalidateQueries({ queryKey: ['appraisal-cycles'] })
      setShowDeleteModal(false)
      setDeletingCycle(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete cycle')
    },
  })

  const activateMutation = useMutation({
    mutationFn: performanceService.activateCycle,
    onSuccess: () => {
      toast.success('Cycle activated successfully')
      queryClient.invalidateQueries({ queryKey: ['appraisal-cycles'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to activate cycle')
    },
  })

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleOpenCreate = () => {
    setEditingCycle(null)
    setFormData({
      ...initialFormData,
      year: new Date().getFullYear(),
      start_date: `${new Date().getFullYear()}-01-01`,
      end_date: `${new Date().getFullYear()}-12-31`,
    })
    setActiveTab('basic')
    setShowModal(true)
  }

  const handleOpenEdit = (cycle: AppraisalCycle) => {
    setEditingCycle(cycle)
    setFormData({
      name: cycle.name,
      description: cycle.description,
      year: cycle.year,
      start_date: cycle.start_date,
      end_date: cycle.end_date,
      goal_setting_start: cycle.goal_setting_start || '',
      goal_setting_end: cycle.goal_setting_end || '',
      mid_year_start: cycle.mid_year_start || '',
      mid_year_end: cycle.mid_year_end || '',
      year_end_start: cycle.year_end_start || '',
      year_end_end: cycle.year_end_end || '',
      objectives_weight: cycle.objectives_weight,
      competencies_weight: cycle.competencies_weight,
      values_weight: cycle.values_weight,
      pass_mark: cycle.pass_mark,
      increment_threshold: cycle.increment_threshold,
      promotion_threshold: cycle.promotion_threshold,
      pip_threshold: cycle.pip_threshold,
      min_goals: cycle.min_goals,
      max_goals: cycle.max_goals,
      allow_self_assessment: cycle.allow_self_assessment,
      allow_peer_feedback: cycle.allow_peer_feedback,
      require_manager_approval: cycle.require_manager_approval,
    })
    setActiveTab('basic')
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingCycle(null)
    setFormData(initialFormData)
    setActiveTab('basic')
  }

  const validateWeights = () => {
    const total = (formData.objectives_weight || 0) +
                  (formData.competencies_weight || 0) +
                  (formData.values_weight || 0)
    return total === 100
  }

  const handleSubmit = () => {
    if (!formData.name || !formData.year || !formData.start_date || !formData.end_date) {
      toast.error('Please fill in all required fields')
      return
    }

    if (!validateWeights()) {
      toast.error('Component weights must sum to 100%')
      return
    }

    if (editingCycle) {
      updateMutation.mutate({ id: editingCycle.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (cycle: AppraisalCycle) => {
    setDeletingCycle(cycle)
    setShowDeleteModal(true)
  }

  const columns = [
    {
      key: 'name',
      header: 'Cycle Name',
      render: (cycle: AppraisalCycle) => (
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-5 w-5 text-primary-500" />
          <div>
            <p className="font-medium text-gray-900">{cycle.name}</p>
            <p className="text-sm text-gray-500">{cycle.year}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Period',
      render: (cycle: AppraisalCycle) => (
        <span className="text-sm text-gray-600">
          {new Date(cycle.start_date).toLocaleDateString()} - {new Date(cycle.end_date).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'weights',
      header: 'Weights',
      render: (cycle: AppraisalCycle) => (
        <div className="text-sm">
          <span className="text-blue-600">Obj: {cycle.objectives_weight}%</span> /
          <span className="text-green-600"> Comp: {cycle.competencies_weight}%</span> /
          <span className="text-purple-600"> Val: {cycle.values_weight}%</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (cycle: AppraisalCycle) => (
        <div className="flex items-center gap-2">
          <Badge variant={statusColors[cycle.status] || 'default'}>
            {cycle.status?.replace('_', ' ') || 'Unknown'}
          </Badge>
          {cycle.is_active && (
            <Badge variant="success">
              <CheckCircleIcon className="h-3 w-3 mr-1" />
              Active
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (cycle: AppraisalCycle) => (
        <div className="flex gap-1">
          {!cycle.is_active && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => activateMutation.mutate(cycle.id)}
              title="Activate"
            >
              <PlayIcon className="h-4 w-4 text-green-600" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenEdit(cycle)}
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(cycle)}
            title="Delete"
          >
            <TrashIcon className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ]

  const totalWeight = (formData.objectives_weight || 0) +
                      (formData.competencies_weight || 0) +
                      (formData.values_weight || 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appraisal Cycles</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure appraisal cycles with phases, weights, and thresholds
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Cycle
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarDaysIcon className="h-5 w-5 mr-2 text-primary-500" />
            Appraisal Cycles
          </CardTitle>
        </CardHeader>
        <Table
          data={(cycles || []).slice((currentPage - 1) * pageSize, currentPage * pageSize)}
          columns={columns}
          isLoading={isLoading}
        />
        {(cycles || []).length > pageSize && (
          <TablePagination
            currentPage={currentPage}
            totalPages={Math.ceil((cycles || []).length / pageSize)}
            totalItems={(cycles || []).length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingCycle ? 'Edit Appraisal Cycle' : 'New Appraisal Cycle'}
        size="xl"
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="phases">Phases</TabsTrigger>
            <TabsTrigger value="weights">Weights</TabsTrigger>
            <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <Input
              label="Cycle Name"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., 2026 Annual Appraisal"
              required
            />
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Year"
                type="number"
                value={formData.year?.toString() || ''}
                onChange={(e) => handleChange('year', parseInt(e.target.value))}
                required
              />
              <Input
                label="Start Date"
                type="date"
                value={formData.start_date || ''}
                onChange={(e) => handleChange('start_date', e.target.value)}
                required
              />
              <Input
                label="End Date"
                type="date"
                value={formData.end_date || ''}
                onChange={(e) => handleChange('end_date', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                rows={3}
                value={formData.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe this appraisal cycle..."
              />
            </div>
          </TabsContent>

          <TabsContent value="phases" className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Goal Setting Phase</h4>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Start Date"
                  type="date"
                  value={formData.goal_setting_start || ''}
                  onChange={(e) => handleChange('goal_setting_start', e.target.value)}
                />
                <Input
                  label="End Date"
                  type="date"
                  value={formData.goal_setting_end || ''}
                  onChange={(e) => handleChange('goal_setting_end', e.target.value)}
                />
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-medium text-yellow-900 mb-2">Mid-Year Review Phase</h4>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Start Date"
                  type="date"
                  value={formData.mid_year_start || ''}
                  onChange={(e) => handleChange('mid_year_start', e.target.value)}
                />
                <Input
                  label="End Date"
                  type="date"
                  value={formData.mid_year_end || ''}
                  onChange={(e) => handleChange('mid_year_end', e.target.value)}
                />
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Year-End Review Phase</h4>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Start Date"
                  type="date"
                  value={formData.year_end_start || ''}
                  onChange={(e) => handleChange('year_end_start', e.target.value)}
                />
                <Input
                  label="End Date"
                  type="date"
                  value={formData.year_end_end || ''}
                  onChange={(e) => handleChange('year_end_end', e.target.value)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="weights" className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total Weight:</span>
                <span className={`text-lg font-bold ${totalWeight === 100 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalWeight}%
                </span>
              </div>
              {totalWeight !== 100 && (
                <p className="text-sm text-red-600 mt-1">Weights must sum to 100%</p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Objectives Weight (%)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.objectives_weight || 0}
                    onChange={(e) => handleChange('objectives_weight', parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={formData.objectives_weight?.toString() || '0'}
                    onChange={(e) => handleChange('objectives_weight', parseInt(e.target.value) || 0)}
                    className="w-20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Competencies Weight (%)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.competencies_weight || 0}
                    onChange={(e) => handleChange('competencies_weight', parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={formData.competencies_weight?.toString() || '0'}
                    onChange={(e) => handleChange('competencies_weight', parseInt(e.target.value) || 0)}
                    className="w-20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Core Values Weight (%)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.values_weight || 0}
                    onChange={(e) => handleChange('values_weight', parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={formData.values_weight?.toString() || '0'}
                    onChange={(e) => handleChange('values_weight', parseInt(e.target.value) || 0)}
                    className="w-20"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="thresholds" className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Configure score thresholds for automatic recommendations
            </p>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Pass Mark (%)"
                type="number"
                value={formData.pass_mark?.toString() || '60'}
                onChange={(e) => handleChange('pass_mark', parseInt(e.target.value) || 0)}
                helperText="Minimum score to pass appraisal"
              />
              <Input
                label="Increment Threshold (%)"
                type="number"
                value={formData.increment_threshold?.toString() || '70'}
                onChange={(e) => handleChange('increment_threshold', parseInt(e.target.value) || 0)}
                helperText="Score required for salary increment"
              />
              <Input
                label="Promotion Threshold (%)"
                type="number"
                value={formData.promotion_threshold?.toString() || '85'}
                onChange={(e) => handleChange('promotion_threshold', parseInt(e.target.value) || 0)}
                helperText="Score required for promotion consideration"
              />
              <Input
                label="PIP Threshold (%)"
                type="number"
                value={formData.pip_threshold?.toString() || '40'}
                onChange={(e) => handleChange('pip_threshold', parseInt(e.target.value) || 0)}
                helperText="Score below which PIP is required"
              />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Minimum Goals"
                type="number"
                value={formData.min_goals?.toString() || '3'}
                onChange={(e) => handleChange('min_goals', parseInt(e.target.value) || 1)}
              />
              <Input
                label="Maximum Goals"
                type="number"
                value={formData.max_goals?.toString() || '7'}
                onChange={(e) => handleChange('max_goals', parseInt(e.target.value) || 10)}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allow_self_assessment"
                  checked={formData.allow_self_assessment}
                  onChange={(e) => handleChange('allow_self_assessment', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="allow_self_assessment" className="text-sm font-medium text-gray-700">
                  Allow Self Assessment
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allow_peer_feedback"
                  checked={formData.allow_peer_feedback}
                  onChange={(e) => handleChange('allow_peer_feedback', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="allow_peer_feedback" className="text-sm font-medium text-gray-700">
                  Allow Peer Feedback (360°)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="require_manager_approval"
                  checked={formData.require_manager_approval}
                  onChange={(e) => handleChange('require_manager_approval', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="require_manager_approval" className="text-sm font-medium text-gray-700">
                  Require Manager Approval for Goals
                </label>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t mt-6">
          <Button variant="outline" onClick={handleCloseModal}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={createMutation.isPending || updateMutation.isPending}
          >
            {editingCycle ? 'Update' : 'Create'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Appraisal Cycle"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deletingCycle?.name}</strong>?
            This action cannot be undone and will affect all associated appraisals.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deletingCycle && deleteMutation.mutate(deletingCycle.id)}
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
