import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  DocumentTextIcon,
  PlusIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { performanceService } from '@/services/performance'
import { employeeService } from '@/services/employees'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { StatsCard } from '@/components/ui/StatsCard'

const activityTypeOptions = [
  { value: 'TRAINING', label: 'Training Course' },
  { value: 'CERTIFICATION', label: 'Certification' },
  { value: 'MENTORING', label: 'Mentoring' },
  { value: 'COACHING', label: 'Coaching' },
  { value: 'JOB_ROTATION', label: 'Job Rotation' },
  { value: 'PROJECT', label: 'Project Assignment' },
  { value: 'SELF_STUDY', label: 'Self Study' },
  { value: 'SHADOWING', label: 'Job Shadowing' },
  { value: 'OTHER', label: 'Other' },
]

const activityStatusOptions = [
  { value: 'PLANNED', label: 'Planned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  PLANNED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
}

const activeFilterOptions = [
  { value: '', label: 'All Plans' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

const initialPlanFormData = {
  employee: '',
  title: '',
  description: '',
  career_aspiration: '',
  strengths: '',
  development_areas: '',
  start_date: '',
  target_completion: '',
  is_active: true,
}

const initialActivityFormData = {
  title: '',
  description: '',
  activity_type: 'TRAINING',
  target_date: '',
  status: 'PLANNED',
  resources_needed: '',
  estimated_cost: '',
}

export default function DevelopmentPlansPage() {
  const queryClient = useQueryClient()
  const [activeFilter, setActiveFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [planFormData, setPlanFormData] = useState(initialPlanFormData)
  const [activityFormData, setActivityFormData] = useState(initialActivityFormData)

  // Employee search for plan creation
  const [employeeSearch, setEmployeeSearch] = useState('')
  const { data: employeeResults } = useQuery({
    queryKey: ['employee-search-dp', employeeSearch],
    queryFn: () => employeeService.getEmployees({ search: employeeSearch, page_size: 20 }),
    enabled: employeeSearch.length >= 2,
  })

  // Fetch plans
  const { data: plans, isLoading } = useQuery({
    queryKey: ['development-plans', activeFilter, searchQuery, currentPage],
    queryFn: () =>
      performanceService.getDevelopmentPlans({
        is_active: activeFilter || undefined,
        search: searchQuery || undefined,
        page: currentPage,
      }),
  })

  // Fetch plan detail when viewing
  const { data: planDetail } = useQuery({
    queryKey: ['development-plan-detail', selectedPlan?.id],
    queryFn: () => performanceService.getDevelopmentPlan(selectedPlan!.id),
    enabled: !!selectedPlan && showDetailModal,
  })

  // Stats
  const allPlans = plans?.results || []
  const totalPlans = plans?.count || 0
  const activePlans = allPlans.filter((p: any) => p.is_active).length
  const approvedPlans = allPlans.filter((p: any) => p.manager_approved).length

  // Mutations
  const createPlanMutation = useMutation({
    mutationFn: (data: any) => performanceService.createDevelopmentPlan(data),
    onSuccess: () => {
      toast.success('Development plan created')
      queryClient.invalidateQueries({ queryKey: ['development-plans'] })
      setShowCreateModal(false)
      setPlanFormData(initialPlanFormData)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to create plan'),
  })

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => performanceService.updateDevelopmentPlan(id, data),
    onSuccess: () => {
      toast.success('Plan updated')
      queryClient.invalidateQueries({ queryKey: ['development-plans'] })
      queryClient.invalidateQueries({ queryKey: ['development-plan-detail'] })
      setShowEditModal(false)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to update plan'),
  })

  const deletePlanMutation = useMutation({
    mutationFn: performanceService.deleteDevelopmentPlan,
    onSuccess: () => {
      toast.success('Plan deleted')
      queryClient.invalidateQueries({ queryKey: ['development-plans'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to delete plan'),
  })

  const approveMutation = useMutation({
    mutationFn: performanceService.approveDevelopmentPlan,
    onSuccess: () => {
      toast.success('Plan approved')
      queryClient.invalidateQueries({ queryKey: ['development-plans'] })
      queryClient.invalidateQueries({ queryKey: ['development-plan-detail'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to approve plan'),
  })

  const createActivityMutation = useMutation({
    mutationFn: (data: any) => performanceService.createDevelopmentActivity(data),
    onSuccess: () => {
      toast.success('Activity added')
      queryClient.invalidateQueries({ queryKey: ['development-plan-detail'] })
      setShowActivityModal(false)
      setActivityFormData(initialActivityFormData)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to add activity'),
  })

  const updateActivityMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => performanceService.updateDevelopmentActivity(id, data),
    onSuccess: () => {
      toast.success('Activity updated')
      queryClient.invalidateQueries({ queryKey: ['development-plan-detail'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to update activity'),
  })

  const handleCreatePlan = () => {
    createPlanMutation.mutate(planFormData)
  }

  const handleUpdatePlan = () => {
    if (!selectedPlan) return
    updatePlanMutation.mutate({ id: selectedPlan.id, data: planFormData })
  }

  const openEditModal = (plan: any) => {
    setSelectedPlan(plan)
    setPlanFormData({
      employee: plan.employee,
      title: plan.title,
      description: plan.description || '',
      career_aspiration: plan.career_aspiration || '',
      strengths: plan.strengths || '',
      development_areas: plan.development_areas || '',
      start_date: plan.start_date,
      target_completion: plan.target_completion,
      is_active: plan.is_active,
    })
    setShowEditModal(true)
  }

  const columns = [
    {
      key: 'employee_name',
      header: 'Employee',
      render: (row: any) => (
        <div>
          <p className="font-medium text-gray-900">{row.employee_name}</p>
          <p className="text-xs text-gray-500">{row.employee_number}</p>
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Plan Title',
      render: (row: any) => row.title,
    },
    {
      key: 'start_date',
      header: 'Period',
      render: (row: any) => (
        <span className="text-sm">
          {new Date(row.start_date).toLocaleDateString()} - {new Date(row.target_completion).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (row: any) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'manager_approved',
      header: 'Approved',
      render: (row: any) => (
        <Badge variant={row.manager_approved ? 'success' : 'warning'}>
          {row.manager_approved ? 'Approved' : 'Pending'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: any) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSelectedPlan(row); setShowDetailModal(true) }}
          >
            <EyeIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEditModal(row)}>
            <PencilSquareIcon className="h-4 w-4" />
          </Button>
          {!row.manager_approved && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => approveMutation.mutate(row.id)}
              title="Approve"
            >
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('Delete this plan?')) deletePlanMutation.mutate(row.id)
            }}
          >
            <TrashIcon className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ]

  const renderPlanForm = () => (
    <div className="space-y-4">
      {showCreateModal && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
          <Input
            placeholder="Search employee..."
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
          />
          {employeeResults?.results && employeeSearch.length >= 2 && (
            <div className="max-h-40 overflow-y-auto border rounded-md mt-1 divide-y">
              {employeeResults.results.map((emp: any) => (
                <button
                  key={emp.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => {
                    setPlanFormData({ ...planFormData, employee: emp.id })
                    setEmployeeSearch(`${emp.first_name} ${emp.last_name} (${emp.employee_number})`)
                  }}
                >
                  {emp.first_name} {emp.last_name} - {emp.employee_number}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <Input
        label="Plan Title"
        value={planFormData.title}
        onChange={(e) => setPlanFormData({ ...planFormData, title: e.target.value })}
        required
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          rows={2}
          value={planFormData.description}
          onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Start Date"
          type="date"
          value={planFormData.start_date}
          onChange={(e) => setPlanFormData({ ...planFormData, start_date: e.target.value })}
          required
        />
        <Input
          label="Target Completion"
          type="date"
          value={planFormData.target_completion}
          onChange={(e) => setPlanFormData({ ...planFormData, target_completion: e.target.value })}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Career Aspiration</label>
        <textarea
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          rows={2}
          value={planFormData.career_aspiration}
          onChange={(e) => setPlanFormData({ ...planFormData, career_aspiration: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Strengths</label>
          <textarea
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            rows={2}
            value={planFormData.strengths}
            onChange={(e) => setPlanFormData({ ...planFormData, strengths: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Development Areas</label>
          <textarea
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            rows={2}
            value={planFormData.development_areas}
            onChange={(e) => setPlanFormData({ ...planFormData, development_areas: e.target.value })}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={planFormData.is_active}
          onChange={(e) => setPlanFormData({ ...planFormData, is_active: e.target.checked })}
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        Active
      </label>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Development Plans</h1>
          <p className="text-sm text-gray-500 mt-1">Individual development plans for employee growth</p>
        </div>
        <Button onClick={() => { setPlanFormData(initialPlanFormData); setEmployeeSearch(''); setShowCreateModal(true) }}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Plan
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard title="Total Plans" value={totalPlans} icon={<DocumentTextIcon className="h-6 w-6" />} variant="primary" />
        <StatsCard title="Active" value={activePlans} icon={<ClockIcon className="h-6 w-6" />} variant="success" />
        <StatsCard title="Approved" value={approvedPlans} icon={<CheckCircleIcon className="h-6 w-6" />} variant="info" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              placeholder="Search plans..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
            />
            <Select
              value={activeFilter}
              onChange={(e) => { setActiveFilter(e.target.value); setCurrentPage(1) }}
              options={activeFilterOptions}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent>
          <Table
            columns={columns}
            data={allPlans}
            isLoading={isLoading}
            emptyMessage="No development plans found"
          />
          {plans && plans.count > pageSize && (
            <TablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(plans.count / pageSize)}
              onPageChange={setCurrentPage}
              totalItems={plans.count}
              pageSize={pageSize}
            />
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Development Plan" size="lg">
        {renderPlanForm()}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
          <Button onClick={handleCreatePlan} disabled={createPlanMutation.isPending}>
            {createPlanMutation.isPending ? 'Creating...' : 'Create Plan'}
          </Button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Development Plan" size="lg">
        {renderPlanForm()}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
          <Button onClick={handleUpdatePlan} disabled={updatePlanMutation.isPending}>
            {updatePlanMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Development Plan Details" size="xl">
        {planDetail && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Employee</p>
                <p className="font-medium">{planDetail.employee_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Title</p>
                <p className="font-medium">{planDetail.title}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Period</p>
                <p className="text-sm">
                  {new Date(planDetail.start_date).toLocaleDateString()} -{' '}
                  {new Date(planDetail.target_completion).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <div className="flex items-center gap-2">
                  <Badge variant={planDetail.is_active ? 'success' : 'default'}>
                    {planDetail.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant={planDetail.manager_approved ? 'success' : 'warning'}>
                    {planDetail.manager_approved ? 'Approved' : 'Pending Approval'}
                  </Badge>
                </div>
              </div>
            </div>
            {planDetail.description && (
              <div>
                <p className="text-xs text-gray-500">Description</p>
                <p className="text-sm mt-1">{planDetail.description}</p>
              </div>
            )}
            {planDetail.career_aspiration && (
              <div>
                <p className="text-xs text-gray-500">Career Aspiration</p>
                <p className="text-sm mt-1">{planDetail.career_aspiration}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {planDetail.strengths && (
                <div>
                  <p className="text-xs text-gray-500">Strengths</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{planDetail.strengths}</p>
                </div>
              )}
              {planDetail.development_areas && (
                <div>
                  <p className="text-xs text-gray-500">Development Areas</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{planDetail.development_areas}</p>
                </div>
              )}
            </div>

            {/* Activities */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Activities</h3>
                <Button
                  size="sm"
                  onClick={() => {
                    setActivityFormData(initialActivityFormData)
                    setShowActivityModal(true)
                  }}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Activity
                </Button>
              </div>
              {planDetail.activities && planDetail.activities.length > 0 ? (
                <div className="space-y-3">
                  {planDetail.activities.map((activity: any) => (
                    <div key={activity.id} className="border rounded-md p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{activity.title}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {activityTypeOptions.find((o) => o.value === activity.activity_type)?.label || activity.activity_type}
                            {activity.competency_name && ` - ${activity.competency_name}`}
                          </p>
                          {activity.description && (
                            <p className="text-xs text-gray-500 mt-1">{activity.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusColors[activity.status] || 'default'}>
                            {activityStatusOptions.find((o) => o.value === activity.status)?.label || activity.status}
                          </Badge>
                          <Select
                            value={activity.status}
                            onChange={(e) => {
                              updateActivityMutation.mutate({
                                id: activity.id,
                                data: { status: e.target.value },
                              })
                            }}
                            options={activityStatusOptions}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Target: {new Date(activity.target_date).toLocaleDateString()}</span>
                        {activity.estimated_cost && (
                          <span>Est. Cost: GHS {Number(activity.estimated_cost).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No activities added yet</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add Activity Modal */}
      <Modal isOpen={showActivityModal} onClose={() => setShowActivityModal(false)} title="Add Development Activity">
        <div className="space-y-4">
          <Input
            label="Activity Title"
            value={activityFormData.title}
            onChange={(e) => setActivityFormData({ ...activityFormData, title: e.target.value })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              rows={2}
              value={activityFormData.description}
              onChange={(e) => setActivityFormData({ ...activityFormData, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type"
              value={activityFormData.activity_type}
              onChange={(e) => setActivityFormData({ ...activityFormData, activity_type: e.target.value })}
              options={activityTypeOptions}
            />
            <Input
              label="Target Date"
              type="date"
              value={activityFormData.target_date}
              onChange={(e) => setActivityFormData({ ...activityFormData, target_date: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resources Needed</label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                rows={2}
                value={activityFormData.resources_needed}
                onChange={(e) => setActivityFormData({ ...activityFormData, resources_needed: e.target.value })}
              />
            </div>
            <Input
              label="Estimated Cost (GHS)"
              type="number"
              value={activityFormData.estimated_cost}
              onChange={(e) => setActivityFormData({ ...activityFormData, estimated_cost: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowActivityModal(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!selectedPlan) return
                createActivityMutation.mutate({
                  development_plan: selectedPlan.id,
                  ...activityFormData,
                  estimated_cost: activityFormData.estimated_cost ? parseFloat(activityFormData.estimated_cost) : null,
                })
              }}
              disabled={createActivityMutation.isPending}
            >
              {createActivityMutation.isPending ? 'Adding...' : 'Add Activity'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
