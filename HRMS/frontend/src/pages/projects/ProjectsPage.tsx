import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  FolderOpenIcon,
  PauseCircleIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  FunnelIcon,
  PlayIcon,
  XMarkIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline'
import {
  projectsService,
  type Project,
  type ProjectFilters,
} from '@/services/projects'
import { employeeService } from '@/services/employees'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { StatsCard } from '@/components/ui/StatsCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonStatsCard, SkeletonTable } from '@/components/ui/Skeleton'
import { Dropdown } from '@/components/ui/Dropdown'
import { formatCurrency, formatDate } from '@/lib/utils'

const PROJECT_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'PLANNING', label: 'Planning' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const PRIORITY_OPTIONS = [
  { value: '1', label: '1 - Critical' },
  { value: '2', label: '2 - High' },
  { value: '3', label: '3 - Medium' },
  { value: '4', label: '4 - Low' },
  { value: '5', label: '5 - Minimal' },
]

const statusVariantMap: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  PLANNING: 'info',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
}

function getPriorityLabel(priority: number): string {
  const labels: Record<number, string> = {
    1: 'Critical',
    2: 'High',
    3: 'Medium',
    4: 'Low',
    5: 'Minimal',
  }
  return labels[priority] || `P${priority}`
}

function getPriorityVariant(priority: number): 'danger' | 'warning' | 'info' | 'default' {
  if (priority <= 1) return 'danger'
  if (priority <= 2) return 'warning'
  if (priority <= 3) return 'info'
  return 'default'
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState<ProjectFilters>({ page: 1, page_size: 10 })
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    project_manager: '',
    department: '',
    start_date: '',
    end_date: '',
    budget_amount: '',
    priority: '3',
    customer: '',
  })

  // Queries
  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects', filters],
    queryFn: () => projectsService.getProjects(filters),
  })

  const { data: allProjects } = useQuery({
    queryKey: ['projects-stats'],
    queryFn: () => projectsService.getProjects({ page_size: 1000 }),
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => employeeService.getDepartments(),
  })

  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => employeeService.getAll({ page_size: 500 }),
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<Project>) => projectsService.createProject(data),
    onSuccess: () => {
      toast.success('Project created successfully')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects-stats'] })
      setShowCreateModal(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || error.response?.data?.name?.[0] || 'Failed to create project')
    },
  })

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'activate' | 'hold' | 'complete' | 'cancel' }) => {
      const actions = {
        activate: projectsService.activateProject,
        hold: projectsService.holdProject,
        complete: projectsService.completeProject,
        cancel: projectsService.cancelProject,
      }
      return actions[action](id)
    },
    onSuccess: (_data, variables) => {
      const actionLabels: Record<string, string> = {
        activate: 'activated',
        hold: 'put on hold',
        complete: 'completed',
        cancel: 'cancelled',
      }
      toast.success(`Project ${actionLabels[variables.action]} successfully`)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects-stats'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Action failed')
    },
  })

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      project_manager: '',
      department: '',
      start_date: '',
      end_date: '',
      budget_amount: '',
      priority: '3',
      customer: '',
    })
  }

  const handleCreate = () => {
    createMutation.mutate({
      code: formData.code,
      name: formData.name,
      description: formData.description,
      project_manager: formData.project_manager || undefined,
      department: formData.department || undefined,
      start_date: formData.start_date,
      end_date: formData.end_date || undefined,
      budget_amount: formData.budget_amount ? parseFloat(formData.budget_amount) : 0,
      priority: parseInt(formData.priority),
      customer: formData.customer,
    } as Partial<Project>)
  }

  // Stats
  const projects = allProjects?.results || []
  const activeCount = projects.filter((p) => p.status === 'ACTIVE').length
  const onHoldCount = projects.filter((p) => p.status === 'ON_HOLD').length
  const completedCount = projects.filter((p) => p.status === 'COMPLETED').length
  const totalBudget = projects.reduce((sum, p) => sum + (p.budget_amount || 0), 0)

  const employeeOptions = (employees?.results || []).map((e: any) => ({
    value: e.id,
    label: `${e.first_name} ${e.last_name}`,
  }))

  const departmentOptions = [
    { value: '', label: 'All Departments' },
    ...(departments || []).map((d: any) => ({
      value: d.id,
      label: d.name,
    })),
  ]

  const managerFilterOptions = [
    { value: '', label: 'All Managers' },
    ...employeeOptions,
  ]

  const totalPages = projectsData ? Math.ceil(projectsData.count / (filters.page_size || 10)) : 0

  const getQuickActions = (project: Project) => {
    const actions: { label: string; onClick: () => void; icon?: React.ReactNode }[] = [
      {
        label: 'View Details',
        onClick: () => navigate(`/projects/${project.id}`),
      },
    ]

    if (project.status === 'PLANNING') {
      actions.push({
        label: 'Activate',
        onClick: () => actionMutation.mutate({ id: project.id, action: 'activate' }),
        icon: <PlayIcon className="w-4 h-4" />,
      })
    }
    if (project.status === 'ACTIVE') {
      actions.push(
        {
          label: 'Put On Hold',
          onClick: () => actionMutation.mutate({ id: project.id, action: 'hold' }),
          icon: <PauseCircleIcon className="w-4 h-4" />,
        },
        {
          label: 'Complete',
          onClick: () => actionMutation.mutate({ id: project.id, action: 'complete' }),
          icon: <CheckCircleIcon className="w-4 h-4" />,
        }
      )
    }
    if (project.status === 'ON_HOLD') {
      actions.push({
        label: 'Activate',
        onClick: () => actionMutation.mutate({ id: project.id, action: 'activate' }),
        icon: <PlayIcon className="w-4 h-4" />,
      })
    }
    if (project.status !== 'COMPLETED' && project.status !== 'CANCELLED') {
      actions.push({
        label: 'Cancel',
        onClick: () => actionMutation.mutate({ id: project.id, action: 'cancel' }),
        icon: <XMarkIcon className="w-4 h-4" />,
      })
    }

    return actions
  }

  const columns = [
    {
      key: 'code',
      header: 'Code',
      width: 100,
      render: (project: Project) => (
        <span className="font-mono text-xs font-medium text-gray-900">{project.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Project Name',
      render: (project: Project) => (
        <div>
          <p className="font-medium text-gray-900">{project.name}</p>
          {project.customer && (
            <p className="text-xs text-gray-500 mt-0.5">Client: {project.customer}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 120,
      render: (project: Project) => (
        <Badge variant={statusVariantMap[project.status] || 'default'} dot>
          {project.status_display || project.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      width: 100,
      render: (project: Project) => (
        <Badge variant={getPriorityVariant(project.priority)} size="xs">
          {getPriorityLabel(project.priority)}
        </Badge>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      width: 160,
      render: (project: Project) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                project.completion_percentage >= 100
                  ? 'bg-success-500'
                  : project.completion_percentage >= 50
                  ? 'bg-primary-500'
                  : 'bg-warning-500'
              }`}
              style={{ width: `${Math.min(project.completion_percentage, 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-600 min-w-[36px] text-right">
            {project.completion_percentage}%
          </span>
        </div>
      ),
    },
    {
      key: 'budget_amount',
      header: 'Budget',
      width: 130,
      render: (project: Project) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{formatCurrency(project.budget_amount)}</p>
          {project.actual_cost > 0 && (
            <p className={`text-xs ${project.actual_cost > project.budget_amount ? 'text-danger-600' : 'text-gray-500'}`}>
              Spent: {formatCurrency(project.actual_cost)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'project_manager_name',
      header: 'Manager',
      width: 140,
      render: (project: Project) => (
        <span className="text-sm text-gray-700">{project.project_manager_name || '-'}</span>
      ),
    },
    {
      key: 'dates',
      header: 'Timeline',
      width: 160,
      render: (project: Project) => (
        <div className="text-xs text-gray-500">
          <p>{formatDate(project.start_date)}</p>
          {project.end_date && <p>to {formatDate(project.end_date)}</p>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 50,
      render: (project: Project) => (
        <Dropdown
          trigger={
            <button className="p-1 rounded hover:bg-gray-100 transition-colors">
              <EllipsisVerticalIcon className="w-5 h-5 text-gray-400" />
            </button>
          }
          items={getQuickActions(project)}
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Project Management"
        subtitle="Track and manage all organizational projects"
        actions={
          <Button
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={() => setShowCreateModal(true)}
          >
            New Project
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonStatsCard key={i} />)
        ) : (
          <>
            <StatsCard
              title="Active Projects"
              value={activeCount}
              variant="success"
              icon={<FolderOpenIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="On Hold"
              value={onHoldCount}
              variant="warning"
              icon={<PauseCircleIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Completed"
              value={completedCount}
              variant="info"
              icon={<CheckCircleIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Total Budget"
              value={formatCurrency(totalBudget)}
              variant="primary"
              icon={<CurrencyDollarIcon className="w-5 h-5" />}
            />
          </>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search projects..."
                value={filters.search || ''}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              />
            </div>
            <div className="w-48">
              <Select
                options={PROJECT_STATUSES}
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
                placeholder="Status"
              />
            </div>
            <Button
              variant="secondary"
              leftIcon={<FunnelIcon className="w-4 h-4" />}
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? 'Less Filters' : 'More Filters'}
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100">
              <Select
                options={departmentOptions}
                value={filters.department || ''}
                onChange={(e) => setFilters({ ...filters, department: e.target.value, page: 1 })}
                placeholder="Department"
                label="Department"
              />
              <Select
                options={managerFilterOptions}
                value={filters.project_manager || ''}
                onChange={(e) => setFilters({ ...filters, project_manager: e.target.value, page: 1 })}
                placeholder="Manager"
                label="Project Manager"
              />
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({ page: 1, page_size: 10 })}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projects Table */}
      {isLoading ? (
        <SkeletonTable columns={8} rows={5} />
      ) : !projectsData?.results?.length ? (
        <Card>
          <EmptyState
            type="data"
            title="No projects found"
            description="Create your first project to get started with project management."
            action={{
              label: 'Create Project',
              onClick: () => setShowCreateModal(true),
            }}
          />
        </Card>
      ) : (
        <>
          <Table
            data={projectsData.results}
            columns={columns}
            onRowClick={(project) => navigate(`/projects/${project.id}`)}
          />
          {totalPages > 1 && (
            <TablePagination
              currentPage={filters.page || 1}
              totalPages={totalPages}
              totalItems={projectsData.count}
              pageSize={filters.page_size || 10}
              onPageChange={(page) => setFilters({ ...filters, page })}
              onPageSizeChange={(size) => setFilters({ ...filters, page_size: size, page: 1 })}
            />
          )}
        </>
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          resetForm()
        }}
        title="Create New Project"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Project Code"
              placeholder="e.g., PRJ-001"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
            />
            <Input
              label="Project Name"
              placeholder="Enter project name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <Textarea
            label="Description"
            placeholder="Describe the project objectives and scope..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Project Manager"
              options={[{ value: '', label: 'Select manager...' }, ...employeeOptions]}
              value={formData.project_manager}
              onChange={(e) => setFormData({ ...formData, project_manager: e.target.value })}
            />
            <Select
              label="Department"
              options={[
                { value: '', label: 'Select department...' },
                ...(departments || []).map((d: any) => ({ value: d.id, label: d.name })),
              ]}
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
            <Select
              label="Priority"
              options={PRIORITY_OPTIONS}
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Budget Amount"
              type="number"
              placeholder="0.00"
              value={formData.budget_amount}
              onChange={(e) => setFormData({ ...formData, budget_amount: e.target.value })}
            />
            <Input
              label="Customer / Client"
              placeholder="Client name"
              value={formData.customer}
              onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              isLoading={createMutation.isPending}
              disabled={!formData.code || !formData.name || !formData.start_date}
            >
              Create Project
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
