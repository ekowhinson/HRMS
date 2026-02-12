import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon,
  PauseCircleIcon,
  CheckCircleIcon,
  XMarkIcon,
  CurrencyDollarIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import {
  projectsService,
  type Project,
  type ProjectTask,
  type Resource,
  type Timesheet,
  type ProjectBudget,
  type Milestone,
  type ProjectBilling,
} from '@/services/projects'
import { employeeService } from '@/services/employees'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatsCard } from '@/components/ui/StatsCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Table from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatCurrency, formatDate } from '@/lib/utils'

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  PLANNING: 'info',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NOT_STARTED: 'default',
  IN_PROGRESS: 'info',
  PENDING: 'warning',
  OVERDUE: 'danger',
  DRAFT: 'default',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

const TASK_STATUSES = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const MILESTONE_STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'OVERDUE', label: 'Overdue' },
]

const BILLING_TYPES = [
  { value: 'TIME_MATERIAL', label: 'Time & Material' },
  { value: 'FIXED', label: 'Fixed Price' },
  { value: 'MILESTONE', label: 'Milestone-based' },
]

// ==================== Task Tree Component ====================

function TaskTreeItem({
  task,
  allTasks,
  level = 0,
  onEdit,
  onDelete,
}: {
  task: ProjectTask
  allTasks: ProjectTask[]
  level?: number
  onEdit: (task: ProjectTask) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const children = allTasks.filter((t) => t.parent === task.id)
  const hasChildren = children.length > 0

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded-md group transition-colors"
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 rounded hover:bg-gray-200 transition-colors"
          >
            {expanded ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-500" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">{task.name}</span>
            <Badge variant={STATUS_VARIANTS[task.status] || 'default'} size="xs">
              {task.status_display || task.status.replace(/_/g, ' ')}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500 mt-0.5">
            {task.assigned_to_name && <span>Assigned: {task.assigned_to_name}</span>}
            {task.estimated_hours > 0 && (
              <span>
                {task.actual_hours}/{task.estimated_hours}h
              </span>
            )}
            {task.start_date && <span>{formatDate(task.start_date)}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(task)
            }}
            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
          >
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(task.id)
            }}
            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-danger-600"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded &&
        children
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((child) => (
            <TaskTreeItem
              key={child.id}
              task={child}
              allTasks={allTasks}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
    </div>
  )
}

// ==================== Overview Tab ====================

function OverviewTab({ project, milestones, budgets }: { project: Project; milestones: Milestone[]; budgets: ProjectBudget[] }) {
  const totalBudget = budgets.reduce((sum, b) => sum + b.budget_amount, 0) || project.budget_amount
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent_amount, 0) || project.actual_cost
  const utilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Completion"
          value={`${project.completion_percentage}%`}
          variant={project.completion_percentage >= 100 ? 'success' : 'primary'}
        />
        <StatsCard
          title="Budget"
          value={formatCurrency(totalBudget)}
          variant="info"
          icon={<CurrencyDollarIcon className="w-5 h-5" />}
        />
        <StatsCard
          title="Actual Cost"
          value={formatCurrency(totalSpent)}
          variant={totalSpent > totalBudget ? 'danger' : 'default'}
        />
        <StatsCard
          title="Budget Utilization"
          value={`${utilization.toFixed(1)}%`}
          variant={utilization > 100 ? 'danger' : utilization > 80 ? 'warning' : 'success'}
        />
      </div>

      {/* Project Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Code</dt>
                <dd className="text-sm font-medium text-gray-900 font-mono">{project.code}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Status</dt>
                <dd>
                  <Badge variant={STATUS_VARIANTS[project.status] || 'default'} dot>
                    {project.status_display || project.status.replace(/_/g, ' ')}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Priority</dt>
                <dd className="text-sm font-medium text-gray-900">{project.priority}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Manager</dt>
                <dd className="text-sm font-medium text-gray-900">{project.project_manager_name || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Department</dt>
                <dd className="text-sm font-medium text-gray-900">{project.department_name || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Customer</dt>
                <dd className="text-sm font-medium text-gray-900">{project.customer || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Start Date</dt>
                <dd className="text-sm font-medium text-gray-900">{formatDate(project.start_date)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">End Date</dt>
                <dd className="text-sm font-medium text-gray-900">{project.end_date ? formatDate(project.end_date) : '-'}</dd>
              </div>
            </dl>
            {project.description && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-700">{project.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget Utilization Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Budget Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Budget Utilization</span>
                  <span className="font-medium">{utilization.toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      utilization > 100 ? 'bg-danger-500' : utilization > 80 ? 'bg-warning-500' : 'bg-success-500'
                    }`}
                    style={{ width: `${Math.min(utilization, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Allocated</p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(totalBudget)}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Spent</p>
                  <p className={`text-lg font-semibold ${totalSpent > totalBudget ? 'text-danger-600' : 'text-gray-900'}`}>
                    {formatCurrency(totalSpent)}
                  </p>
                </div>
              </div>

              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Remaining</p>
                <p className={`text-lg font-semibold ${totalBudget - totalSpent < 0 ? 'text-danger-600' : 'text-success-600'}`}>
                  {formatCurrency(totalBudget - totalSpent)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Milestone Timeline */}
      {milestones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Milestone Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="absolute top-0 bottom-0 left-4 w-0.5 bg-gray-200" />
              <div className="space-y-6">
                {milestones
                  .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                  .map((milestone) => (
                    <div key={milestone.id} className="relative pl-10">
                      <div
                        className={`absolute left-2 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${
                          milestone.status === 'COMPLETED'
                            ? 'bg-success-500'
                            : milestone.status === 'OVERDUE'
                            ? 'bg-danger-500'
                            : milestone.status === 'IN_PROGRESS'
                            ? 'bg-info-500'
                            : 'bg-gray-300'
                        }`}
                      >
                        {milestone.status === 'COMPLETED' && (
                          <CheckCircleIcon className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium text-gray-900">{milestone.name}</h4>
                          <Badge variant={STATUS_VARIANTS[milestone.status] || 'default'} size="xs">
                            {milestone.status_display || milestone.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Due: {formatDate(milestone.due_date)}</span>
                          {milestone.amount > 0 && <span>{formatCurrency(milestone.amount)}</span>}
                          {milestone.completion_date && (
                            <span>Completed: {formatDate(milestone.completion_date)}</span>
                          )}
                        </div>
                        {milestone.description && (
                          <p className="text-xs text-gray-500 mt-1">{milestone.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ==================== Tasks Tab ====================

function TasksTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null)
  const [taskForm, setTaskForm] = useState({
    name: '',
    parent: '',
    assigned_to: '',
    start_date: '',
    end_date: '',
    estimated_hours: '',
    status: 'NOT_STARTED',
    priority: '3',
    description: '',
  })

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: () => projectsService.getTasks({ project: projectId }),
  })

  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => employeeService.getAll({ page_size: 500 }),
  })

  const createTaskMutation = useMutation({
    mutationFn: (data: Partial<ProjectTask>) => projectsService.createTask(data),
    onSuccess: () => {
      toast.success('Task created successfully')
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] })
      closeTaskModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create task')
    },
  })

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProjectTask> }) =>
      projectsService.updateTask(id, data),
    onSuccess: () => {
      toast.success('Task updated successfully')
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] })
      closeTaskModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update task')
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => projectsService.deleteTask(id),
    onSuccess: () => {
      toast.success('Task deleted')
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete task')
    },
  })

  const rootTasks = useMemo(
    () =>
      tasks
        .filter((t) => !t.parent)
        .sort((a, b) => a.sort_order - b.sort_order),
    [tasks]
  )

  const employeeOptions = (employees?.results || []).map((e: any) => ({
    value: e.id,
    label: `${e.first_name} ${e.last_name}`,
  }))

  const taskOptions = tasks.map((t) => ({
    value: t.id,
    label: t.name,
  }))

  const closeTaskModal = () => {
    setShowTaskModal(false)
    setEditingTask(null)
    setTaskForm({
      name: '',
      parent: '',
      assigned_to: '',
      start_date: '',
      end_date: '',
      estimated_hours: '',
      status: 'NOT_STARTED',
      priority: '3',
      description: '',
    })
  }

  const openEditTask = (task: ProjectTask) => {
    setEditingTask(task)
    setTaskForm({
      name: task.name,
      parent: task.parent || '',
      assigned_to: task.assigned_to || '',
      start_date: task.start_date || '',
      end_date: task.end_date || '',
      estimated_hours: task.estimated_hours?.toString() || '',
      status: task.status,
      priority: task.priority?.toString() || '3',
      description: task.description || '',
    })
    setShowTaskModal(true)
  }

  const handleSaveTask = () => {
    const data: Partial<ProjectTask> = {
      project: projectId,
      name: taskForm.name,
      parent: taskForm.parent || null,
      assigned_to: taskForm.assigned_to || null,
      start_date: taskForm.start_date || null,
      end_date: taskForm.end_date || null,
      estimated_hours: taskForm.estimated_hours ? parseFloat(taskForm.estimated_hours) : 0,
      status: taskForm.status as ProjectTask['status'],
      priority: parseInt(taskForm.priority),
      description: taskForm.description,
    }

    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, data })
    } else {
      createTaskMutation.mutate(data)
    }
  }

  const handleDeleteTask = (id: string) => {
    if (confirm('Are you sure you want to delete this task? This will also delete all child tasks.')) {
      deleteTaskMutation.mutate(id)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Work Breakdown Structure</h3>
          <p className="text-sm text-gray-500">{tasks.length} tasks total</p>
        </div>
        <Button
          size="sm"
          leftIcon={<PlusIcon className="w-4 h-4" />}
          onClick={() => setShowTaskModal(true)}
        >
          Add Task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <EmptyState
            type="data"
            title="No tasks yet"
            description="Break down your project into manageable tasks."
            action={{
              label: 'Add First Task',
              onClick: () => setShowTaskModal(true),
            }}
          />
        </Card>
      ) : (
        <Card>
          <CardContent className="p-2">
            {rootTasks.map((task) => (
              <TaskTreeItem
                key={task.id}
                task={task}
                allTasks={tasks}
                onEdit={openEditTask}
                onDelete={handleDeleteTask}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Task Modal */}
      <Modal
        isOpen={showTaskModal}
        onClose={closeTaskModal}
        title={editingTask ? 'Edit Task' : 'Add Task'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Task Name"
            placeholder="Enter task name"
            value={taskForm.name}
            onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Parent Task"
              options={[{ value: '', label: 'None (Root Task)' }, ...taskOptions.filter((t) => t.value !== editingTask?.id)]}
              value={taskForm.parent}
              onChange={(e) => setTaskForm({ ...taskForm, parent: e.target.value })}
            />
            <Select
              label="Assigned To"
              options={[{ value: '', label: 'Unassigned' }, ...employeeOptions]}
              value={taskForm.assigned_to}
              onChange={(e) => setTaskForm({ ...taskForm, assigned_to: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={taskForm.start_date}
              onChange={(e) => setTaskForm({ ...taskForm, start_date: e.target.value })}
            />
            <Input
              label="End Date"
              type="date"
              value={taskForm.end_date}
              onChange={(e) => setTaskForm({ ...taskForm, end_date: e.target.value })}
            />
            <Input
              label="Estimated Hours"
              type="number"
              placeholder="0"
              value={taskForm.estimated_hours}
              onChange={(e) => setTaskForm({ ...taskForm, estimated_hours: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Status"
              options={TASK_STATUSES}
              value={taskForm.status}
              onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
            />
            <Select
              label="Priority"
              options={[
                { value: '1', label: '1 - Critical' },
                { value: '2', label: '2 - High' },
                { value: '3', label: '3 - Medium' },
                { value: '4', label: '4 - Low' },
                { value: '5', label: '5 - Minimal' },
              ]}
              value={taskForm.priority}
              onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
            />
          </div>

          <Textarea
            label="Description"
            placeholder="Task description..."
            value={taskForm.description}
            onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
            rows={3}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={closeTaskModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTask}
              isLoading={createTaskMutation.isPending || updateTaskMutation.isPending}
              disabled={!taskForm.name}
            >
              {editingTask ? 'Update Task' : 'Add Task'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ==================== Resources Tab ====================

function ResourcesTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingResource, setEditingResource] = useState<Resource | null>(null)
  const [form, setForm] = useState({
    employee: '',
    role: '',
    allocation_percent: '100',
    start_date: '',
    end_date: '',
    hourly_rate: '',
  })

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['project-resources', projectId],
    queryFn: () => projectsService.getResources({ project: projectId }),
  })

  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => employeeService.getAll({ page_size: 500 }),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Resource>) => projectsService.createResource(data),
    onSuccess: () => {
      toast.success('Resource added successfully')
      queryClient.invalidateQueries({ queryKey: ['project-resources', projectId] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to add resource')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Resource> }) =>
      projectsService.updateResource(id, data),
    onSuccess: () => {
      toast.success('Resource updated')
      queryClient.invalidateQueries({ queryKey: ['project-resources', projectId] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update resource')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsService.deleteResource(id),
    onSuccess: () => {
      toast.success('Resource removed')
      queryClient.invalidateQueries({ queryKey: ['project-resources', projectId] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to remove resource')
    },
  })

  const employeeOptions = (employees?.results || []).map((e: any) => ({
    value: e.id,
    label: `${e.first_name} ${e.last_name}`,
  }))

  const closeModal = () => {
    setShowModal(false)
    setEditingResource(null)
    setForm({ employee: '', role: '', allocation_percent: '100', start_date: '', end_date: '', hourly_rate: '' })
  }

  const openEdit = (resource: Resource) => {
    setEditingResource(resource)
    setForm({
      employee: resource.employee,
      role: resource.role || '',
      allocation_percent: resource.allocation_percent?.toString() || '100',
      start_date: resource.start_date || '',
      end_date: resource.end_date || '',
      hourly_rate: resource.hourly_rate?.toString() || '',
    })
    setShowModal(true)
  }

  const handleSave = () => {
    const data: Partial<Resource> = {
      project: projectId,
      employee: form.employee,
      role: form.role,
      allocation_percent: parseFloat(form.allocation_percent) || 100,
      start_date: form.start_date,
      end_date: form.end_date || undefined,
      hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : 0,
    } as Partial<Resource>

    if (editingResource) {
      updateMutation.mutate({ id: editingResource.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const columns = [
    {
      key: 'employee_name',
      header: 'Team Member',
      render: (r: Resource) => (
        <div>
          <p className="font-medium text-gray-900">{r.employee_name || 'Unknown'}</p>
          {r.employee_number && <p className="text-xs text-gray-500">{r.employee_number}</p>}
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (r: Resource) => <span className="text-sm">{r.role || '-'}</span>,
    },
    {
      key: 'allocation_percent',
      header: 'Allocation',
      width: 120,
      render: (r: Resource) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[60px]">
            <div
              className={`h-full rounded-full ${
                r.allocation_percent > 100 ? 'bg-danger-500' : r.allocation_percent > 80 ? 'bg-warning-500' : 'bg-success-500'
              }`}
              style={{ width: `${Math.min(r.allocation_percent, 100)}%` }}
            />
          </div>
          <span className={`text-sm font-medium ${r.allocation_percent > 100 ? 'text-danger-600' : ''}`}>
            {r.allocation_percent}%
          </span>
        </div>
      ),
    },
    {
      key: 'hourly_rate',
      header: 'Rate/Hr',
      width: 100,
      render: (r: Resource) => <span className="text-sm">{r.hourly_rate > 0 ? formatCurrency(r.hourly_rate) : '-'}</span>,
    },
    {
      key: 'dates',
      header: 'Period',
      width: 160,
      render: (r: Resource) => (
        <div className="text-xs text-gray-500">
          {r.start_date && <p>{formatDate(r.start_date)}</p>}
          {r.end_date && <p>to {formatDate(r.end_date)}</p>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 80,
      render: (r: Resource) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              openEdit(r)
            }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (confirm('Remove this resource from the project?')) {
                deleteMutation.mutate(r.id)
              }
            }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-danger-600"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Team Resources</h3>
          <p className="text-sm text-gray-500">{resources.length} team members assigned</p>
        </div>
        <Button
          size="sm"
          leftIcon={<PlusIcon className="w-4 h-4" />}
          onClick={() => setShowModal(true)}
        >
          Add Resource
        </Button>
      </div>

      <Table
        data={resources}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No resources assigned"
        emptyAction={{
          label: 'Add Resource',
          onClick: () => setShowModal(true),
        }}
      />

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingResource ? 'Edit Resource' : 'Add Resource'}
      >
        <div className="space-y-4">
          <Select
            label="Employee"
            options={[{ value: '', label: 'Select employee...' }, ...employeeOptions]}
            value={form.employee}
            onChange={(e) => setForm({ ...form, employee: e.target.value })}
            required
          />
          <Input
            label="Role"
            placeholder="e.g., Lead Developer, Designer..."
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Allocation %"
              type="number"
              min="0"
              max="100"
              value={form.allocation_percent}
              onChange={(e) => setForm({ ...form, allocation_percent: e.target.value })}
            />
            <Input
              label="Hourly Rate"
              type="number"
              placeholder="0.00"
              value={form.hourly_rate}
              onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
            <Input
              label="End Date"
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button
              onClick={handleSave}
              isLoading={createMutation.isPending || updateMutation.isPending}
              disabled={!form.employee}
            >
              {editingResource ? 'Update' : 'Add Resource'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ==================== Timesheets Tab ====================

function TimesheetsTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()

  const { data: timesheetsData, isLoading } = useQuery({
    queryKey: ['project-timesheets', projectId],
    queryFn: () => projectsService.getTimesheets({ project: projectId, page_size: 100 }),
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => projectsService.approveTimesheet(id),
    onSuccess: () => {
      toast.success('Timesheet approved')
      queryClient.invalidateQueries({ queryKey: ['project-timesheets', projectId] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to approve')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => projectsService.rejectTimesheet(id),
    onSuccess: () => {
      toast.success('Timesheet rejected')
      queryClient.invalidateQueries({ queryKey: ['project-timesheets', projectId] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to reject')
    },
  })

  const timesheets = timesheetsData?.results || []

  const columns = [
    {
      key: 'employee_name',
      header: 'Employee',
      render: (t: Timesheet) => (
        <span className="font-medium text-gray-900">{t.employee_name || 'Unknown'}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      width: 120,
      render: (t: Timesheet) => <span className="text-sm">{formatDate(t.date)}</span>,
    },
    {
      key: 'task_name',
      header: 'Task',
      render: (t: Timesheet) => <span className="text-sm">{t.task_name || '-'}</span>,
    },
    {
      key: 'hours',
      header: 'Hours',
      width: 80,
      render: (t: Timesheet) => <span className="text-sm font-medium">{t.hours}h</span>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (t: Timesheet) => (
        <span className="text-sm text-gray-500 truncate max-w-[200px] block">{t.description || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 110,
      render: (t: Timesheet) => (
        <Badge variant={STATUS_VARIANTS[t.status] || 'default'} size="xs">
          {t.status_display || t.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 140,
      render: (t: Timesheet) => (
        <div className="flex items-center gap-1">
          {t.status === 'SUBMITTED' && (
            <>
              <Button
                size="xs"
                variant="success"
                onClick={(e) => {
                  e.stopPropagation()
                  approveMutation.mutate(t.id)
                }}
                isLoading={approveMutation.isPending}
              >
                Approve
              </Button>
              <Button
                size="xs"
                variant="danger"
                onClick={(e) => {
                  e.stopPropagation()
                  rejectMutation.mutate(t.id)
                }}
                isLoading={rejectMutation.isPending}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Project Timesheets</h3>
          <p className="text-sm text-gray-500">
            {timesheets.length} entries, {timesheets.reduce((sum, t) => sum + t.hours, 0).toFixed(1)} total hours
          </p>
        </div>
      </div>

      <Table
        data={timesheets}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No timesheet entries"
      />
    </div>
  )
}

// ==================== Budget Tab ====================

function BudgetTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingBudget, setEditingBudget] = useState<ProjectBudget | null>(null)
  const [form, setForm] = useState({ account: '', description: '', budget_amount: '', spent_amount: '' })

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['project-budgets', projectId],
    queryFn: () => projectsService.getBudgets({ project: projectId }),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<ProjectBudget>) => projectsService.createBudget(data),
    onSuccess: () => {
      toast.success('Budget line added')
      queryClient.invalidateQueries({ queryKey: ['project-budgets', projectId] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to add budget line')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProjectBudget> }) =>
      projectsService.updateBudget(id, data),
    onSuccess: () => {
      toast.success('Budget line updated')
      queryClient.invalidateQueries({ queryKey: ['project-budgets', projectId] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsService.deleteBudget(id),
    onSuccess: () => {
      toast.success('Budget line removed')
      queryClient.invalidateQueries({ queryKey: ['project-budgets', projectId] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete')
    },
  })

  const closeModal = () => {
    setShowModal(false)
    setEditingBudget(null)
    setForm({ account: '', description: '', budget_amount: '', spent_amount: '' })
  }

  const openEdit = (budget: ProjectBudget) => {
    setEditingBudget(budget)
    setForm({
      account: budget.account || '',
      description: budget.description || '',
      budget_amount: budget.budget_amount?.toString() || '',
      spent_amount: budget.spent_amount?.toString() || '',
    })
    setShowModal(true)
  }

  const handleSave = () => {
    const data: Partial<ProjectBudget> = {
      project: projectId,
      account: form.account,
      description: form.description,
      budget_amount: parseFloat(form.budget_amount) || 0,
      spent_amount: parseFloat(form.spent_amount) || 0,
    }

    if (editingBudget) {
      updateMutation.mutate({ id: editingBudget.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const totalBudget = budgets.reduce((sum, b) => sum + b.budget_amount, 0)
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent_amount, 0)

  const columns = [
    {
      key: 'account',
      header: 'Account',
      render: (b: ProjectBudget) => <span className="font-medium text-gray-900">{b.account}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (b: ProjectBudget) => <span className="text-sm text-gray-700">{b.description || '-'}</span>,
    },
    {
      key: 'budget_amount',
      header: 'Budget',
      width: 130,
      render: (b: ProjectBudget) => <span className="text-sm font-medium">{formatCurrency(b.budget_amount)}</span>,
    },
    {
      key: 'spent_amount',
      header: 'Spent',
      width: 130,
      render: (b: ProjectBudget) => (
        <span className={`text-sm font-medium ${b.spent_amount > b.budget_amount ? 'text-danger-600' : ''}`}>
          {formatCurrency(b.spent_amount)}
        </span>
      ),
    },
    {
      key: 'remaining',
      header: 'Remaining',
      width: 130,
      render: (b: ProjectBudget) => {
        const remaining = b.budget_amount - b.spent_amount
        return (
          <span className={`text-sm font-medium ${remaining < 0 ? 'text-danger-600' : 'text-success-600'}`}>
            {formatCurrency(remaining)}
          </span>
        )
      },
    },
    {
      key: 'utilization',
      header: 'Utilization',
      width: 120,
      render: (b: ProjectBudget) => {
        const util = b.budget_amount > 0 ? (b.spent_amount / b.budget_amount) * 100 : 0
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[60px]">
              <div
                className={`h-full rounded-full ${util > 100 ? 'bg-danger-500' : util > 80 ? 'bg-warning-500' : 'bg-success-500'}`}
                style={{ width: `${Math.min(util, 100)}%` }}
              />
            </div>
            <span className="text-xs">{util.toFixed(0)}%</span>
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      width: 80,
      render: (b: ProjectBudget) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              openEdit(b)
            }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (confirm('Delete this budget line?')) deleteMutation.mutate(b.id)
            }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-danger-600"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Budget Lines</h3>
          <p className="text-sm text-gray-500">
            Total: {formatCurrency(totalBudget)} | Spent: {formatCurrency(totalSpent)} |{' '}
            <span className={totalBudget - totalSpent < 0 ? 'text-danger-600' : 'text-success-600'}>
              Remaining: {formatCurrency(totalBudget - totalSpent)}
            </span>
          </p>
        </div>
        <Button
          size="sm"
          leftIcon={<PlusIcon className="w-4 h-4" />}
          onClick={() => setShowModal(true)}
        >
          Add Budget Line
        </Button>
      </div>

      <Table
        data={budgets}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No budget lines defined"
        emptyAction={{ label: 'Add Budget Line', onClick: () => setShowModal(true) }}
      />

      <Modal isOpen={showModal} onClose={closeModal} title={editingBudget ? 'Edit Budget Line' : 'Add Budget Line'}>
        <div className="space-y-4">
          <Input
            label="Account"
            placeholder="e.g., Labor, Materials, Equipment..."
            value={form.account}
            onChange={(e) => setForm({ ...form, account: e.target.value })}
            required
          />
          <Input
            label="Description"
            placeholder="Budget line description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Budget Amount"
              type="number"
              placeholder="0.00"
              value={form.budget_amount}
              onChange={(e) => setForm({ ...form, budget_amount: e.target.value })}
              required
            />
            <Input
              label="Spent Amount"
              type="number"
              placeholder="0.00"
              value={form.spent_amount}
              onChange={(e) => setForm({ ...form, spent_amount: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button
              onClick={handleSave}
              isLoading={createMutation.isPending || updateMutation.isPending}
              disabled={!form.account || !form.budget_amount}
            >
              {editingBudget ? 'Update' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ==================== Milestones Tab ====================

function MilestonesTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null)
  const [form, setForm] = useState({
    name: '',
    due_date: '',
    amount: '',
    status: 'PENDING',
    completion_date: '',
    description: '',
  })

  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ['project-milestones', projectId],
    queryFn: () => projectsService.getMilestones({ project: projectId }),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Milestone>) => projectsService.createMilestone(data),
    onSuccess: () => {
      toast.success('Milestone added')
      queryClient.invalidateQueries({ queryKey: ['project-milestones', projectId] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to add milestone')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Milestone> }) =>
      projectsService.updateMilestone(id, data),
    onSuccess: () => {
      toast.success('Milestone updated')
      queryClient.invalidateQueries({ queryKey: ['project-milestones', projectId] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update milestone')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsService.deleteMilestone(id),
    onSuccess: () => {
      toast.success('Milestone removed')
      queryClient.invalidateQueries({ queryKey: ['project-milestones', projectId] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete')
    },
  })

  const closeModal = () => {
    setShowModal(false)
    setEditingMilestone(null)
    setForm({ name: '', due_date: '', amount: '', status: 'PENDING', completion_date: '', description: '' })
  }

  const openEdit = (ms: Milestone) => {
    setEditingMilestone(ms)
    setForm({
      name: ms.name,
      due_date: ms.due_date,
      amount: ms.amount?.toString() || '',
      status: ms.status,
      completion_date: ms.completion_date || '',
      description: ms.description || '',
    })
    setShowModal(true)
  }

  const handleSave = () => {
    const data: Partial<Milestone> = {
      project: projectId,
      name: form.name,
      due_date: form.due_date,
      amount: parseFloat(form.amount) || 0,
      status: form.status as Milestone['status'],
      completion_date: form.completion_date || null,
      description: form.description,
    }

    if (editingMilestone) {
      updateMutation.mutate({ id: editingMilestone.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Milestone',
      render: (ms: Milestone) => (
        <div>
          <p className="font-medium text-gray-900">{ms.name}</p>
          {ms.description && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[250px]">{ms.description}</p>}
        </div>
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      width: 120,
      render: (ms: Milestone) => <span className="text-sm">{formatDate(ms.due_date)}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      width: 120,
      render: (ms: Milestone) => <span className="text-sm font-medium">{ms.amount > 0 ? formatCurrency(ms.amount) : '-'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: 120,
      render: (ms: Milestone) => (
        <Badge variant={STATUS_VARIANTS[ms.status] || 'default'} size="xs" dot>
          {ms.status_display || ms.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'completion_date',
      header: 'Completed',
      width: 120,
      render: (ms: Milestone) => (
        <span className="text-sm text-gray-500">{ms.completion_date ? formatDate(ms.completion_date) : '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 80,
      render: (ms: Milestone) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              openEdit(ms)
            }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (confirm('Delete this milestone?')) deleteMutation.mutate(ms.id)
            }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-danger-600"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Milestones</h3>
        <Button size="sm" leftIcon={<PlusIcon className="w-4 h-4" />} onClick={() => setShowModal(true)}>
          Add Milestone
        </Button>
      </div>

      <Table
        data={milestones}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No milestones defined"
        emptyAction={{ label: 'Add Milestone', onClick: () => setShowModal(true) }}
      />

      <Modal isOpen={showModal} onClose={closeModal} title={editingMilestone ? 'Edit Milestone' : 'Add Milestone'}>
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="Milestone name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Textarea
            label="Description"
            placeholder="Milestone description..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Due Date"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              required
            />
            <Input
              label="Amount"
              type="number"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Status"
              options={MILESTONE_STATUSES}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            />
            <Input
              label="Completion Date"
              type="date"
              value={form.completion_date}
              onChange={(e) => setForm({ ...form, completion_date: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button
              onClick={handleSave}
              isLoading={createMutation.isPending || updateMutation.isPending}
              disabled={!form.name || !form.due_date}
            >
              {editingMilestone ? 'Update' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ==================== Billing Tab ====================

function BillingTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingBilling, setEditingBilling] = useState<ProjectBilling | null>(null)
  const [form, setForm] = useState({
    billing_type: 'FIXED',
    customer_invoice: '',
    amount: '',
    billing_date: '',
    description: '',
  })

  const { data: billings = [], isLoading } = useQuery({
    queryKey: ['project-billings', projectId],
    queryFn: () => projectsService.getBillings({ project: projectId }),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<ProjectBilling>) => projectsService.createBilling(data),
    onSuccess: () => {
      toast.success('Billing entry added')
      queryClient.invalidateQueries({ queryKey: ['project-billings', projectId] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to add billing')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProjectBilling> }) =>
      projectsService.updateBilling(id, data),
    onSuccess: () => {
      toast.success('Billing updated')
      queryClient.invalidateQueries({ queryKey: ['project-billings', projectId] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsService.deleteBilling(id),
    onSuccess: () => {
      toast.success('Billing entry removed')
      queryClient.invalidateQueries({ queryKey: ['project-billings', projectId] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete')
    },
  })

  const closeModal = () => {
    setShowModal(false)
    setEditingBilling(null)
    setForm({ billing_type: 'FIXED', customer_invoice: '', amount: '', billing_date: '', description: '' })
  }

  const openEdit = (billing: ProjectBilling) => {
    setEditingBilling(billing)
    setForm({
      billing_type: billing.billing_type,
      customer_invoice: billing.customer_invoice || '',
      amount: billing.amount?.toString() || '',
      billing_date: billing.billing_date || '',
      description: billing.description || '',
    })
    setShowModal(true)
  }

  const handleSave = () => {
    const data: Partial<ProjectBilling> = {
      project: projectId,
      billing_type: form.billing_type as ProjectBilling['billing_type'],
      customer_invoice: form.customer_invoice,
      amount: parseFloat(form.amount) || 0,
      billing_date: form.billing_date,
      description: form.description,
    }

    if (editingBilling) {
      updateMutation.mutate({ id: editingBilling.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const totalBilled = billings.reduce((sum, b) => sum + b.amount, 0)

  const columns = [
    {
      key: 'billing_date',
      header: 'Date',
      width: 120,
      render: (b: ProjectBilling) => <span className="text-sm">{b.billing_date ? formatDate(b.billing_date) : '-'}</span>,
    },
    {
      key: 'billing_type',
      header: 'Type',
      width: 140,
      render: (b: ProjectBilling) => (
        <Badge variant="default" size="xs">
          {b.billing_type_display || b.billing_type.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'customer_invoice',
      header: 'Invoice',
      render: (b: ProjectBilling) => (
        <span className="text-sm font-medium text-gray-900">{b.customer_invoice || '-'}</span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (b: ProjectBilling) => <span className="text-sm text-gray-700">{b.description || '-'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      width: 130,
      render: (b: ProjectBilling) => <span className="text-sm font-semibold">{formatCurrency(b.amount)}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: 80,
      render: (b: ProjectBilling) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              openEdit(b)
            }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (confirm('Delete this billing entry?')) deleteMutation.mutate(b.id)
            }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-danger-600"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Billing</h3>
          <p className="text-sm text-gray-500">Total Billed: {formatCurrency(totalBilled)}</p>
        </div>
        <Button size="sm" leftIcon={<PlusIcon className="w-4 h-4" />} onClick={() => setShowModal(true)}>
          Add Billing
        </Button>
      </div>

      <Table
        data={billings}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No billing entries"
        emptyAction={{ label: 'Add Billing', onClick: () => setShowModal(true) }}
      />

      <Modal isOpen={showModal} onClose={closeModal} title={editingBilling ? 'Edit Billing' : 'Add Billing'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Billing Type"
              options={BILLING_TYPES}
              value={form.billing_type}
              onChange={(e) => setForm({ ...form, billing_type: e.target.value })}
            />
            <Input
              label="Invoice Reference"
              placeholder="INV-001"
              value={form.customer_invoice}
              onChange={(e) => setForm({ ...form, customer_invoice: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Amount"
              type="number"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
            <Input
              label="Billing Date"
              type="date"
              value={form.billing_date}
              onChange={(e) => setForm({ ...form, billing_date: e.target.value })}
              required
            />
          </div>
          <Input
            label="Description"
            placeholder="Billing description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button
              onClick={handleSave}
              isLoading={createMutation.isPending || updateMutation.isPending}
              disabled={!form.amount || !form.billing_date}
            >
              {editingBilling ? 'Update' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ==================== Main Page Component ====================

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsService.getProject(id!),
    enabled: !!id,
  })

  const { data: milestones = [] } = useQuery({
    queryKey: ['project-milestones', id],
    queryFn: () => projectsService.getMilestones({ project: id }),
    enabled: !!id,
  })

  const { data: budgets = [] } = useQuery({
    queryKey: ['project-budgets', id],
    queryFn: () => projectsService.getBudgets({ project: id }),
    enabled: !!id,
  })

  const actionMutation = useMutation({
    mutationFn: ({ action }: { action: 'activate' | 'hold' | 'complete' | 'cancel' }) => {
      const actions = {
        activate: projectsService.activateProject,
        hold: projectsService.holdProject,
        complete: projectsService.completeProject,
        cancel: projectsService.cancelProject,
      }
      return actions[action](id!)
    },
    onSuccess: (_data, variables) => {
      const labels: Record<string, string> = {
        activate: 'activated',
        hold: 'put on hold',
        complete: 'completed',
        cancel: 'cancelled',
      }
      toast.success(`Project ${labels[variables.action]}`)
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Action failed')
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div>
        <Button
          variant="ghost"
          leftIcon={<ArrowLeftIcon className="w-4 h-4" />}
          onClick={() => navigate('/projects')}
          className="mb-4"
        >
          Back to Projects
        </Button>
        <EmptyState
          type="error"
          title="Project not found"
          description="The project you are looking for does not exist or you do not have access."
          action={{ label: 'Go to Projects', onClick: () => navigate('/projects') }}
        />
      </div>
    )
  }

  const getActionButtons = () => {
    const buttons: React.ReactNode[] = []

    if (project.status === 'PLANNING') {
      buttons.push(
        <Button
          key="activate"
          variant="success"
          size="sm"
          leftIcon={<PlayIcon className="w-4 h-4" />}
          onClick={() => actionMutation.mutate({ action: 'activate' })}
          isLoading={actionMutation.isPending}
        >
          Activate
        </Button>
      )
    }
    if (project.status === 'ACTIVE') {
      buttons.push(
        <Button
          key="hold"
          variant="secondary"
          size="sm"
          leftIcon={<PauseCircleIcon className="w-4 h-4" />}
          onClick={() => actionMutation.mutate({ action: 'hold' })}
          isLoading={actionMutation.isPending}
        >
          Hold
        </Button>,
        <Button
          key="complete"
          variant="success"
          size="sm"
          leftIcon={<CheckCircleIcon className="w-4 h-4" />}
          onClick={() => actionMutation.mutate({ action: 'complete' })}
          isLoading={actionMutation.isPending}
        >
          Complete
        </Button>
      )
    }
    if (project.status === 'ON_HOLD') {
      buttons.push(
        <Button
          key="activate"
          variant="success"
          size="sm"
          leftIcon={<PlayIcon className="w-4 h-4" />}
          onClick={() => actionMutation.mutate({ action: 'activate' })}
          isLoading={actionMutation.isPending}
        >
          Activate
        </Button>
      )
    }
    if (project.status !== 'COMPLETED' && project.status !== 'CANCELLED') {
      buttons.push(
        <Button
          key="cancel"
          variant="danger"
          size="sm"
          leftIcon={<XMarkIcon className="w-4 h-4" />}
          onClick={() => {
            if (confirm('Are you sure you want to cancel this project?')) {
              actionMutation.mutate({ action: 'cancel' })
            }
          }}
          isLoading={actionMutation.isPending}
        >
          Cancel
        </Button>
      )
    }

    return buttons
  }

  return (
    <div>
      <PageHeader
        title={project.name}
        subtitle={`${project.code} - ${project.customer || 'Internal Project'}`}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANTS[project.status] || 'default'} size="md" dot>
              {project.status_display || project.status.replace(/_/g, ' ')}
            </Badge>
            {getActionButtons()}
          </div>
        }
      />

      {/* Progress Bar */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Project Progress</span>
            <span className="text-sm font-semibold text-gray-900">{project.completion_percentage}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                project.completion_percentage >= 100
                  ? 'bg-success-500'
                  : project.completion_percentage >= 50
                  ? 'bg-primary-500'
                  : 'bg-warning-500'
              }`}
              style={{ width: `${Math.min(project.completion_percentage, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab project={project} milestones={milestones} budgets={budgets} />
        </TabsContent>

        <TabsContent value="tasks">
          <TasksTab projectId={id!} />
        </TabsContent>

        <TabsContent value="resources">
          <ResourcesTab projectId={id!} />
        </TabsContent>

        <TabsContent value="timesheets">
          <TimesheetsTab projectId={id!} />
        </TabsContent>

        <TabsContent value="budget">
          <BudgetTab projectId={id!} />
        </TabsContent>

        <TabsContent value="milestones">
          <MilestonesTab projectId={id!} />
        </TabsContent>

        <TabsContent value="billing">
          <BillingTab projectId={id!} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
