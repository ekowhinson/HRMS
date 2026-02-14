import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  PlayIcon,
  LockClosedIcon,
  LockOpenIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { performanceService, type AppraisalCycle, type AppraisalSchedule, type AppraisalDeadlineExtension, type SchedulePhase } from '@/services/performance'
import api from '@/lib/api'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import { useClientPagination } from '@/hooks/useClientPagination'
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
  const [pageTab, setPageTab] = useState('cycles')

  // Department Schedules state
  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    department_ids: [] as string[],
    phase: 'GOAL_SETTING' as SchedulePhase,
    start_date: '',
    end_date: '',
  })
  const [showExtensionModal, setShowExtensionModal] = useState(false)
  const [extensionForm, setExtensionForm] = useState({
    schedule: '',
    reason: '',
    new_end_date: '',
  })
  const [unlockReason, setUnlockReason] = useState('')
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [unlockingScheduleId, setUnlockingScheduleId] = useState('')

  const { data: cycles, isLoading } = useQuery({
    queryKey: ['appraisal-cycles'],
    queryFn: performanceService.getAppraisalCycles,
  })

  const { paged: pagedCycles, currentPage, totalPages, totalItems, pageSize, setCurrentPage } = useClientPagination(cycles || [], 10)

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

  // Schedule queries
  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['appraisal-schedules', selectedCycleId],
    queryFn: () => performanceService.getSchedules({ cycle: selectedCycleId }),
    enabled: !!selectedCycleId && pageTab === 'schedules',
  })

  const { data: extensions } = useQuery({
    queryKey: ['deadline-extensions'],
    queryFn: () => performanceService.getDeadlineExtensions({ status: 'PENDING' }),
    enabled: pageTab === 'schedules',
  })

  const { data: departments } = useQuery({
    queryKey: ['departments-lookup'],
    queryFn: async () => {
      const response = await api.get('/core/lookups/organization/')
      return response.data?.departments || []
    },
    enabled: showScheduleModal,
  })

  // Auto-select first cycle for schedules tab
  useEffect(() => {
    if (cycles && cycles.length > 0 && !selectedCycleId) {
      const active = cycles.find((c: AppraisalCycle) => c.is_active)
      setSelectedCycleId(active?.id || cycles[0].id)
    }
  }, [cycles, selectedCycleId])

  const bulkCreateScheduleMutation = useMutation({
    mutationFn: (data: { appraisal_cycle: string; department_ids: string[]; phase: SchedulePhase; start_date: string; end_date: string }) =>
      performanceService.bulkCreateSchedules(data),
    onSuccess: (data) => {
      toast.success(`${data.created} schedule(s) created`)
      queryClient.invalidateQueries({ queryKey: ['appraisal-schedules'] })
      setShowScheduleModal(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create schedules')
    },
  })

  const lockScheduleMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      performanceService.lockSchedule(id, reason),
    onSuccess: () => {
      toast.success('Schedule locked')
      queryClient.invalidateQueries({ queryKey: ['appraisal-schedules'] })
    },
  })

  const unlockScheduleMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      performanceService.unlockSchedule(id, reason),
    onSuccess: () => {
      toast.success('Schedule unlocked')
      queryClient.invalidateQueries({ queryKey: ['appraisal-schedules'] })
      setShowUnlockModal(false)
      setUnlockReason('')
    },
  })

  const approveExtensionMutation = useMutation({
    mutationFn: performanceService.approveDeadlineExtension,
    onSuccess: () => {
      toast.success('Extension approved')
      queryClient.invalidateQueries({ queryKey: ['deadline-extensions'] })
      queryClient.invalidateQueries({ queryKey: ['appraisal-schedules'] })
    },
  })

  const rejectExtensionMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      performanceService.rejectDeadlineExtension(id, reason),
    onSuccess: () => {
      toast.success('Extension rejected')
      queryClient.invalidateQueries({ queryKey: ['deadline-extensions'] })
    },
  })

  const handleCreateSchedules = () => {
    if (!selectedCycleId || scheduleForm.department_ids.length === 0 || !scheduleForm.start_date || !scheduleForm.end_date) {
      toast.error('Please fill all required fields')
      return
    }
    bulkCreateScheduleMutation.mutate({
      appraisal_cycle: selectedCycleId,
      ...scheduleForm,
    })
  }

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

  const scheduleColumns = [
    {
      key: 'department',
      header: 'Department',
      render: (s: AppraisalSchedule) => <span className="font-medium">{s.department_name}</span>,
    },
    {
      key: 'phase',
      header: 'Phase',
      render: (s: AppraisalSchedule) => <Badge variant="info">{s.phase_display}</Badge>,
    },
    {
      key: 'period',
      header: 'Deadline',
      render: (s: AppraisalSchedule) => (
        <span className="text-sm">
          {new Date(s.start_date).toLocaleDateString()} - {new Date(s.end_date).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s: AppraisalSchedule) => (
        <div className="flex items-center gap-2">
          {s.is_locked ? (
            <Badge variant="danger">
              <LockClosedIcon className="h-3 w-3 mr-1" /> Locked
            </Badge>
          ) : s.is_past_deadline ? (
            <Badge variant="warning">Past Deadline</Badge>
          ) : (
            <Badge variant="success">Open</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (s: AppraisalSchedule) => (
        <div className="flex gap-1">
          {s.is_locked ? (
            <Button variant="ghost" size="sm" onClick={() => { setUnlockingScheduleId(s.id); setShowUnlockModal(true) }} title="Unlock">
              <LockOpenIcon className="h-4 w-4 text-green-600" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => lockScheduleMutation.mutate({ id: s.id, reason: 'Manually locked' })} title="Lock">
              <LockClosedIcon className="h-4 w-4 text-red-500" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => { setExtensionForm({ schedule: s.id, reason: '', new_end_date: '' }); setShowExtensionModal(true) }} title="Request Extension">
            <ClockIcon className="h-4 w-4 text-blue-500" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appraisal Cycles</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure appraisal cycles with phases, weights, and thresholds
          </p>
        </div>
        {pageTab === 'cycles' && (
          <Button onClick={handleOpenCreate}>
            <PlusIcon className="h-4 w-4 mr-2" />
            New Cycle
          </Button>
        )}
        {pageTab === 'schedules' && (
          <Button onClick={() => setShowScheduleModal(true)} disabled={!selectedCycleId}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Schedules
          </Button>
        )}
      </div>

      <Tabs value={pageTab} onValueChange={setPageTab}>
        <TabsList>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
          <TabsTrigger value="schedules">Department Schedules</TabsTrigger>
        </TabsList>

        <TabsContent value="cycles">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CalendarDaysIcon className="h-5 w-5 mr-2 text-primary-500" />
                Appraisal Cycles
              </CardTitle>
            </CardHeader>
            <Table
              data={pagedCycles}
              columns={columns}
              isLoading={isLoading}
            />
            {totalItems > pageSize && (
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="schedules">
          <div className="space-y-4">
            {/* Cycle selector */}
            <Card>
              <div className="p-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Cycle</label>
                <select
                  className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  value={selectedCycleId}
                  onChange={(e) => setSelectedCycleId(e.target.value)}
                >
                  <option value="">Select a cycle...</option>
                  {(cycles || []).map((c: AppraisalCycle) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.year}){c.is_active ? ' - Active' : ''}</option>
                  ))}
                </select>
              </div>
            </Card>

            {/* Schedules table */}
            {selectedCycleId && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CalendarDaysIcon className="h-5 w-5 mr-2 text-primary-500" />
                    Department Schedules
                  </CardTitle>
                </CardHeader>
                <Table
                  data={schedules || []}
                  columns={scheduleColumns}
                  isLoading={schedulesLoading}
                />
              </Card>
            )}

            {/* Pending Extensions */}
            {(extensions || []).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <ClockIcon className="h-5 w-5 mr-2 text-yellow-500" />
                    Pending Extension Requests
                  </CardTitle>
                </CardHeader>
                <div className="divide-y">
                  {(extensions || []).map((ext: AppraisalDeadlineExtension) => (
                    <div key={ext.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{ext.schedule_department} - {ext.schedule_phase}</p>
                        <p className="text-sm text-gray-500">By: {ext.requested_by_name}</p>
                        <p className="text-sm text-gray-500">Reason: {ext.reason}</p>
                        <p className="text-sm text-gray-500">New end date: {new Date(ext.new_end_date).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approveExtensionMutation.mutate(ext.id)}>Approve</Button>
                        <Button size="sm" variant="danger" onClick={() => rejectExtensionMutation.mutate({ id: ext.id, reason: 'Rejected by admin' })}>Reject</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

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

      {/* Bulk Schedule Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Add Department Schedules"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
            <select
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              value={scheduleForm.phase}
              onChange={(e) => setScheduleForm(prev => ({ ...prev, phase: e.target.value as SchedulePhase }))}
            >
              <option value="GOAL_SETTING">Goal Setting</option>
              <option value="MID_YEAR">Mid-Year Review</option>
              <option value="YEAR_END">Year-End Appraisal</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={scheduleForm.start_date}
              onChange={(e) => setScheduleForm(prev => ({ ...prev, start_date: e.target.value }))}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={scheduleForm.end_date}
              onChange={(e) => setScheduleForm(prev => ({ ...prev, end_date: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Departments</label>
            <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
              {(departments || []).map((dept: any) => (
                <label key={dept.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleForm.department_ids.includes(dept.id)}
                    onChange={(e) => {
                      setScheduleForm(prev => ({
                        ...prev,
                        department_ids: e.target.checked
                          ? [...prev.department_ids, dept.id]
                          : prev.department_ids.filter(id => id !== dept.id)
                      }))
                    }}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm">{dept.name}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">{scheduleForm.department_ids.length} department(s) selected</p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowScheduleModal(false)}>Cancel</Button>
            <Button onClick={handleCreateSchedules} isLoading={bulkCreateScheduleMutation.isPending}>
              Create Schedules
            </Button>
          </div>
        </div>
      </Modal>

      {/* Unlock Schedule Modal */}
      <Modal
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        title="Unlock Schedule"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Provide a reason for unlocking this schedule:</p>
          <textarea
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            rows={3}
            value={unlockReason}
            onChange={(e) => setUnlockReason(e.target.value)}
            placeholder="Enter reason..."
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowUnlockModal(false)}>Cancel</Button>
            <Button
              onClick={() => unlockScheduleMutation.mutate({ id: unlockingScheduleId, reason: unlockReason })}
              isLoading={unlockScheduleMutation.isPending}
              disabled={!unlockReason.trim()}
            >
              Unlock
            </Button>
          </div>
        </div>
      </Modal>

      {/* Extension Request Modal */}
      <Modal
        isOpen={showExtensionModal}
        onClose={() => setShowExtensionModal(false)}
        title="Request Deadline Extension"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              rows={3}
              value={extensionForm.reason}
              onChange={(e) => setExtensionForm(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Reason for extension..."
            />
          </div>
          <Input
            label="New End Date"
            type="date"
            value={extensionForm.new_end_date}
            onChange={(e) => setExtensionForm(prev => ({ ...prev, new_end_date: e.target.value }))}
            required
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowExtensionModal(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                try {
                  await performanceService.createDeadlineExtension(extensionForm)
                  toast.success('Extension request submitted')
                  queryClient.invalidateQueries({ queryKey: ['deadline-extensions'] })
                  setShowExtensionModal(false)
                } catch (err: any) {
                  toast.error(err.response?.data?.detail || 'Failed to submit request')
                }
              }}
              disabled={!extensionForm.reason || !extensionForm.new_end_date}
            >
              Submit Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
