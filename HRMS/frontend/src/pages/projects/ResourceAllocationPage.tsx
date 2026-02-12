import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  UserGroupIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import {
  projectsService,
  type Resource,
} from '@/services/projects'
import { employeeService } from '@/services/employees'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatsCard } from '@/components/ui/StatsCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Table from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton, SkeletonStatsCard } from '@/components/ui/Skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { formatCurrency, formatDate } from '@/lib/utils'

interface EmployeeAllocation {
  id: string
  name: string
  number?: string
  totalAllocation: number
  projects: {
    id: string
    resourceId: string
    projectName: string
    projectCode: string
    projectStatus: string
    role: string
    allocationPercent: number
    startDate: string
    endDate: string | null
    hourlyRate: number
  }[]
}

export default function ResourceAllocationPage() {
  const queryClient = useQueryClient()
  const [activeView, setActiveView] = useState('matrix')
  const [showModal, setShowModal] = useState(false)
  const [editingResource, setEditingResource] = useState<Resource | null>(null)
  const [filterProject, setFilterProject] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const [form, setForm] = useState({
    project: '',
    employee: '',
    role: '',
    allocation_percent: '100',
    start_date: '',
    end_date: '',
    hourly_rate: '',
  })

  // Queries
  const { data: allResources = [], isLoading: loadingResources } = useQuery({
    queryKey: ['all-resources'],
    queryFn: () => projectsService.getResources({ page_size: 1000 }),
  })

  const { data: projectsData } = useQuery({
    queryKey: ['projects-active'],
    queryFn: () => projectsService.getProjects({ page_size: 500 }),
  })

  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => employeeService.getAll({ page_size: 500 }),
  })

  const projects = projectsData?.results || []
  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<Resource>) => projectsService.createResource(data),
    onSuccess: () => {
      toast.success('Resource allocation created')
      queryClient.invalidateQueries({ queryKey: ['all-resources'] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || error.response?.data?.employee?.[0] || 'Failed to create allocation')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Resource> }) =>
      projectsService.updateResource(id, data),
    onSuccess: () => {
      toast.success('Allocation updated')
      queryClient.invalidateQueries({ queryKey: ['all-resources'] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsService.deleteResource(id),
    onSuccess: () => {
      toast.success('Resource removed')
      queryClient.invalidateQueries({ queryKey: ['all-resources'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to remove resource')
    },
  })

  // Build employee allocation data
  const employeeAllocations: EmployeeAllocation[] = useMemo(() => {
    const map = new Map<string, EmployeeAllocation>()

    allResources.forEach((resource) => {
      const empId = resource.employee
      if (!map.has(empId)) {
        map.set(empId, {
          id: empId,
          name: resource.employee_name || 'Unknown',
          number: resource.employee_number,
          totalAllocation: 0,
          projects: [],
        })
      }

      const emp = map.get(empId)!
      const project = projects.find((p) => p.id === resource.project)

      emp.projects.push({
        id: resource.project,
        resourceId: resource.id,
        projectName: resource.project_name || project?.name || 'Unknown',
        projectCode: project?.code || '',
        projectStatus: project?.status || '',
        role: resource.role || '',
        allocationPercent: resource.allocation_percent,
        startDate: resource.start_date,
        endDate: resource.end_date,
        hourlyRate: resource.hourly_rate,
      })
      emp.totalAllocation += resource.allocation_percent
    })

    return Array.from(map.values()).sort((a, b) => b.totalAllocation - a.totalAllocation)
  }, [allResources, projects])

  // Filter
  const filteredAllocations = useMemo(() => {
    let result = employeeAllocations

    if (filterProject) {
      result = result.filter((emp) => emp.projects.some((p) => p.id === filterProject))
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      result = result.filter(
        (emp) =>
          emp.name.toLowerCase().includes(lower) ||
          emp.number?.toLowerCase().includes(lower) ||
          emp.projects.some((p) => p.projectName.toLowerCase().includes(lower))
      )
    }

    return result
  }, [employeeAllocations, filterProject, searchTerm])

  // Stats
  const totalResources = employeeAllocations.length
  const overAllocated = employeeAllocations.filter((e) => e.totalAllocation > 100).length
  const fullyAllocated = employeeAllocations.filter(
    (e) => e.totalAllocation >= 80 && e.totalAllocation <= 100
  ).length
  const underAllocated = employeeAllocations.filter((e) => e.totalAllocation < 80).length

  // Options
  const employeeOptions = (employees?.results || []).map((e: any) => ({
    value: e.id,
    label: `${e.first_name} ${e.last_name}`,
  }))

  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: `${p.code} - ${p.name}`,
  }))

  const projectFilterOptions = [
    { value: '', label: 'All Projects' },
    ...projectOptions,
  ]

  const closeModal = () => {
    setShowModal(false)
    setEditingResource(null)
    setForm({
      project: '',
      employee: '',
      role: '',
      allocation_percent: '100',
      start_date: '',
      end_date: '',
      hourly_rate: '',
    })
  }

  const openEditFromMatrix = (resourceId: string) => {
    const resource = allResources.find((r) => r.id === resourceId)
    if (resource) {
      setEditingResource(resource)
      setForm({
        project: resource.project,
        employee: resource.employee,
        role: resource.role || '',
        allocation_percent: resource.allocation_percent?.toString() || '100',
        start_date: resource.start_date || '',
        end_date: resource.end_date || '',
        hourly_rate: resource.hourly_rate?.toString() || '',
      })
      setShowModal(true)
    }
  }

  const handleSave = () => {
    const data: Partial<Resource> = {
      project: form.project,
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

  const handleDelete = (id: string) => {
    if (confirm('Remove this resource allocation?')) {
      deleteMutation.mutate(id)
    }
  }

  // Flat list for table view
  const flatResources = useMemo(() => {
    return allResources
      .filter((r) => {
        if (filterProject && r.project !== filterProject) return false
        if (searchTerm) {
          const lower = searchTerm.toLowerCase()
          if (
            !(r.employee_name || '').toLowerCase().includes(lower) &&
            !(r.project_name || '').toLowerCase().includes(lower)
          ) {
            return false
          }
        }
        return true
      })
      .sort((a, b) => (a.employee_name || '').localeCompare(b.employee_name || ''))
  }, [allResources, filterProject, searchTerm])

  const tableColumns = [
    {
      key: 'employee_name',
      header: 'Employee',
      render: (r: Resource) => {
        const emp = employeeAllocations.find((e) => e.id === r.employee)
        const isOver = emp && emp.totalAllocation > 100
        return (
          <div className="flex items-center gap-2">
            <div>
              <p className="font-medium text-gray-900">{r.employee_name || 'Unknown'}</p>
              {r.employee_number && <p className="text-xs text-gray-500">{r.employee_number}</p>}
            </div>
            {isOver && (
              <ExclamationTriangleIcon className="w-4 h-4 text-danger-500" title="Over-allocated" />
            )}
          </div>
        )
      },
    },
    {
      key: 'project_name',
      header: 'Project',
      render: (r: Resource) => (
        <span className="text-sm font-medium">{r.project_name || 'Unknown'}</span>
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
      width: 140,
      render: (r: Resource) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[60px]">
            <div
              className={`h-full rounded-full ${
                r.allocation_percent > 100
                  ? 'bg-danger-500'
                  : r.allocation_percent > 80
                  ? 'bg-warning-500'
                  : 'bg-success-500'
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
      render: (r: Resource) => (
        <span className="text-sm">{r.hourly_rate > 0 ? formatCurrency(r.hourly_rate) : '-'}</span>
      ),
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
              openEditFromMatrix(r.id)
            }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(r.id)
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
      <PageHeader
        title="Resource Allocation"
        subtitle="Plan and manage resource assignments across projects"
        actions={
          <Button
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={() => setShowModal(true)}
          >
            Assign Resource
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loadingResources ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonStatsCard key={i} />)
        ) : (
          <>
            <StatsCard
              title="Total Resources"
              value={totalResources}
              variant="primary"
              icon={<UserGroupIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Over-Allocated"
              value={overAllocated}
              variant="danger"
              icon={<ExclamationTriangleIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Fully Allocated (80-100%)"
              value={fullyAllocated}
              variant="success"
              icon={<ChartBarIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Under-Allocated (<80%)"
              value={underAllocated}
              variant="warning"
              icon={<ChartBarIcon className="w-5 h-5" />}
            />
          </>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search employees or projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-56">
              <Select
                options={projectFilterOptions}
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                placeholder="Filter by project"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList variant="pills" className="mb-4">
          <TabsTrigger value="matrix" variant="pills">
            Allocation Matrix
          </TabsTrigger>
          <TabsTrigger value="table" variant="pills">
            Table View
          </TabsTrigger>
        </TabsList>

        {/* Matrix View */}
        <TabsContent value="matrix">
          {loadingResources ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : filteredAllocations.length === 0 ? (
            <Card>
              <EmptyState
                type="data"
                title="No resource allocations"
                description="Start assigning employees to projects to see the allocation matrix."
                action={{ label: 'Assign Resource', onClick: () => setShowModal(true) }}
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredAllocations.map((emp) => (
                <Card
                  key={emp.id}
                  className={`${
                    emp.totalAllocation > 100 ? 'border-danger-300 bg-danger-50/30' : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <UserGroupIcon className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-gray-900">{emp.name}</h3>
                            {emp.number && (
                              <span className="text-xs text-gray-500">{emp.number}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {emp.projects.length} project{emp.projects.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {emp.totalAllocation > 100 && (
                          <Badge variant="danger" size="xs" dot pulse>
                            Over-Allocated
                          </Badge>
                        )}
                        <span
                          className={`text-lg font-bold ${
                            emp.totalAllocation > 100
                              ? 'text-danger-600'
                              : emp.totalAllocation >= 80
                              ? 'text-success-600'
                              : 'text-warning-600'
                          }`}
                        >
                          {emp.totalAllocation}%
                        </span>
                      </div>
                    </div>

                    {/* Allocation Bar */}
                    <div className="mb-3">
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                        {emp.projects.map((proj, i) => {
                          const colors = [
                            'bg-primary-500',
                            'bg-info-500',
                            'bg-success-500',
                            'bg-warning-500',
                            'bg-purple-500',
                            'bg-pink-500',
                          ]
                          const width =
                            emp.totalAllocation > 0
                              ? (proj.allocationPercent / Math.max(emp.totalAllocation, 100)) * 100
                              : 0
                          return (
                            <div
                              key={proj.resourceId}
                              className={`h-full ${colors[i % colors.length]} ${i > 0 ? 'border-l border-white' : ''}`}
                              style={{ width: `${width}%` }}
                              title={`${proj.projectName}: ${proj.allocationPercent}%`}
                            />
                          )
                        })}
                      </div>
                    </div>

                    {/* Project Breakdown */}
                    <div className="space-y-2">
                      {emp.projects.map((proj) => (
                        <div
                          key={proj.resourceId}
                          className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-mono text-gray-400 min-w-[60px]">
                              {proj.projectCode}
                            </span>
                            <span className="text-sm text-gray-900 truncate">{proj.projectName}</span>
                            {proj.role && (
                              <Badge variant="default" size="xs">
                                {proj.role}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700">
                              {proj.allocationPercent}%
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditFromMatrix(proj.resourceId)}
                                className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                              >
                                <PencilIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(proj.resourceId)}
                                className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-danger-600"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Table View */}
        <TabsContent value="table">
          <Table
            data={flatResources}
            columns={tableColumns}
            isLoading={loadingResources}
            emptyMessage="No resource allocations found"
            emptyAction={{
              label: 'Assign Resource',
              onClick: () => setShowModal(true),
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Over-allocation Warnings */}
      {overAllocated > 0 && (
        <Card className="mt-6 border-danger-200 bg-danger-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-danger-700">
              <ExclamationTriangleIcon className="w-5 h-5" />
              Over-Allocation Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {employeeAllocations
                .filter((e) => e.totalAllocation > 100)
                .map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-danger-200"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                      <p className="text-xs text-gray-500">
                        Assigned to {emp.projects.length} projects:{' '}
                        {emp.projects.map((p) => `${p.projectCode} (${p.allocationPercent}%)`).join(', ')}
                      </p>
                    </div>
                    <Badge variant="danger" size="sm">
                      {emp.totalAllocation}% allocated
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Resource Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingResource ? 'Edit Resource Allocation' : 'Assign Resource to Project'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Employee"
              options={[{ value: '', label: 'Select employee...' }, ...employeeOptions]}
              value={form.employee}
              onChange={(e) => setForm({ ...form, employee: e.target.value })}
              required
              disabled={!!editingResource}
            />
            <Select
              label="Project"
              options={[{ value: '', label: 'Select project...' }, ...projectOptions]}
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value })}
              required
              disabled={!!editingResource}
            />
          </div>

          <Input
            label="Role"
            placeholder="e.g., Lead Developer, Designer, QA..."
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Allocation %"
              type="number"
              min="1"
              max="100"
              value={form.allocation_percent}
              onChange={(e) => setForm({ ...form, allocation_percent: e.target.value })}
              required
            />
            <Input
              label="Start Date"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>

          <Input
            label="Hourly Rate"
            type="number"
            placeholder="0.00"
            value={form.hourly_rate}
            onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
          />

          {/* Show allocation warning */}
          {form.employee && (
            (() => {
              const existingEmp = employeeAllocations.find((e) => e.id === form.employee)
              const currentAlloc = existingEmp?.totalAllocation || 0
              const editingAlloc = editingResource
                ? existingEmp?.projects.find((p) => p.resourceId === editingResource.id)?.allocationPercent || 0
                : 0
              const newTotal = currentAlloc - editingAlloc + (parseFloat(form.allocation_percent) || 0)

              if (newTotal > 100) {
                return (
                  <div className="flex items-start gap-2 p-3 bg-danger-50 rounded-lg border border-danger-200">
                    <ExclamationTriangleIcon className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-danger-700">Over-Allocation Warning</p>
                      <p className="text-xs text-danger-600 mt-0.5">
                        This employee will be at {newTotal}% allocation (current: {currentAlloc}%).
                        This exceeds the 100% threshold.
                      </p>
                    </div>
                  </div>
                )
              }
              return null
            })()
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              isLoading={createMutation.isPending || updateMutation.isPending}
              disabled={!form.employee || !form.project || !form.allocation_percent || !form.start_date}
            >
              {editingResource ? 'Update Allocation' : 'Assign Resource'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
