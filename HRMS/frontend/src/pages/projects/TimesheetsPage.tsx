import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ClockIcon,
  CheckIcon,
  XMarkIcon,
  FunnelIcon,
  PlusIcon,
  PaperAirplaneIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import {
  projectsService,
  type Timesheet,
  type TimesheetFilters,
} from '@/services/projects'
import { employeeService } from '@/services/employees'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatsCard } from '@/components/ui/StatsCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonStatsCard, SkeletonTable } from '@/components/ui/Skeleton'
import { formatDate } from '@/lib/utils'

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

function getWeekDates(date: Date): { start: string; end: string } {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday start
  const start = new Date(d.setDate(diff))
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

function getWeekDays(startDate: string): string[] {
  const days: string[] = []
  const start = new Date(startDate)
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function TimesheetsPage() {
  const queryClient = useQueryClient()
  const [activeView, setActiveView] = useState('list')

  // Filters
  const [filters, setFilters] = useState<TimesheetFilters>({
    page: 1,
    page_size: 20,
  })
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Create form
  const [formData, setFormData] = useState({
    employee: '',
    project: '',
    task: '',
    date: new Date().toISOString().split('T')[0],
    hours: '',
    description: '',
  })

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

  // Weekly view
  const currentWeek = getWeekDates(new Date())
  const [weekStart, setWeekStart] = useState(currentWeek.start)

  // Queries
  const { data: timesheetsData, isLoading } = useQuery({
    queryKey: ['timesheets', filters],
    queryFn: () => projectsService.getTimesheets(filters),
  })

  const { data: allTimesheets } = useQuery({
    queryKey: ['timesheets-stats'],
    queryFn: () => projectsService.getTimesheets({ page_size: 1000 }),
  })

  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => employeeService.getAll({ page_size: 500 }),
  })

  const { data: projects } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => projectsService.getProjects({ page_size: 500, status: 'ACTIVE' }),
  })

  const { data: tasks } = useQuery({
    queryKey: ['tasks-list', formData.project],
    queryFn: () => projectsService.getTasks({ project: formData.project }),
    enabled: !!formData.project,
  })

  // Weekly data
  const { data: weeklyTimesheets } = useQuery({
    queryKey: ['timesheets-weekly', weekStart],
    queryFn: () => {
      const weekEnd = getWeekDays(weekStart)[6]
      return projectsService.getTimesheets({
        date_from: weekStart,
        date_to: weekEnd,
        page_size: 500,
      })
    },
    enabled: activeView === 'weekly',
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<Timesheet>) => projectsService.createTimesheet(data),
    onSuccess: () => {
      toast.success('Timesheet entry created')
      queryClient.invalidateQueries({ queryKey: ['timesheets'] })
      queryClient.invalidateQueries({ queryKey: ['timesheets-stats'] })
      setShowCreateModal(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create entry')
    },
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) => projectsService.submitTimesheet(id),
    onSuccess: () => {
      toast.success('Timesheet submitted')
      queryClient.invalidateQueries({ queryKey: ['timesheets'] })
      queryClient.invalidateQueries({ queryKey: ['timesheets-stats'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Submit failed')
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => projectsService.approveTimesheet(id),
    onSuccess: () => {
      toast.success('Timesheet approved')
      queryClient.invalidateQueries({ queryKey: ['timesheets'] })
      queryClient.invalidateQueries({ queryKey: ['timesheets-stats'] })
      setSelectedIds(new Set())
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Approve failed')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => projectsService.rejectTimesheet(id),
    onSuccess: () => {
      toast.success('Timesheet rejected')
      queryClient.invalidateQueries({ queryKey: ['timesheets'] })
      queryClient.invalidateQueries({ queryKey: ['timesheets-stats'] })
      setSelectedIds(new Set())
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Reject failed')
    },
  })

  const resetForm = () => {
    setFormData({
      employee: '',
      project: '',
      task: '',
      date: new Date().toISOString().split('T')[0],
      hours: '',
      description: '',
    })
  }

  const handleCreate = () => {
    createMutation.mutate({
      employee: formData.employee || undefined,
      project: formData.project,
      task: formData.task || undefined,
      date: formData.date,
      hours: parseFloat(formData.hours) || 0,
      description: formData.description,
    } as Partial<Timesheet>)
  }

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    const mutation = action === 'approve' ? approveMutation : rejectMutation
    const ids = Array.from(selectedIds)

    for (const id of ids) {
      try {
        await mutation.mutateAsync(id.toString())
      } catch {
        // Individual errors handled by mutation error handler
      }
    }
    setSelectedIds(new Set())
  }

  // Stats
  const allEntries = allTimesheets?.results || []
  const totalHours = allEntries.reduce((sum, t) => sum + t.hours, 0)
  const pendingCount = allEntries.filter((t) => t.status === 'SUBMITTED').length
  const approvedCount = allEntries.filter((t) => t.status === 'APPROVED').length
  const draftCount = allEntries.filter((t) => t.status === 'DRAFT').length

  // Options
  const employeeOptions = [
    { value: '', label: 'All Employees' },
    ...(employees?.results || []).map((e: any) => ({
      value: e.id,
      label: `${e.first_name} ${e.last_name}`,
    })),
  ]

  const projectOptions = [
    { value: '', label: 'All Projects' },
    ...(projects?.results || []).map((p: any) => ({
      value: p.id,
      label: `${p.code} - ${p.name}`,
    })),
  ]

  const taskOptions = (tasks || []).map((t: any) => ({
    value: t.id,
    label: t.name,
  }))

  const totalPages = timesheetsData ? Math.ceil(timesheetsData.count / (filters.page_size || 20)) : 0

  // Weekly view data
  const weekDays = getWeekDays(weekStart)
  const weeklyEntries = weeklyTimesheets?.results || []

  // Group weekly entries by employee
  const weeklyByEmployee = useMemo(() => {
    const map = new Map<string, { name: string; entries: Map<string, number> }>()
    weeklyEntries.forEach((entry) => {
      const key = entry.employee
      if (!map.has(key)) {
        map.set(key, { name: entry.employee_name || 'Unknown', entries: new Map() })
      }
      const current = map.get(key)!.entries.get(entry.date) || 0
      map.get(key)!.entries.set(entry.date, current + entry.hours)
    })
    return Array.from(map.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      days: weekDays.map((d) => data.entries.get(d) || 0),
      total: weekDays.reduce((sum, d) => sum + (data.entries.get(d) || 0), 0),
    }))
  }, [weeklyEntries, weekDays])

  const columns = [
    {
      key: 'employee_name',
      header: 'Employee',
      render: (t: Timesheet) => (
        <div>
          <p className="font-medium text-gray-900">{t.employee_name || 'Unknown'}</p>
          {t.employee_number && <p className="text-xs text-gray-500">{t.employee_number}</p>}
        </div>
      ),
    },
    {
      key: 'project_name',
      header: 'Project',
      render: (t: Timesheet) => <span className="text-sm">{t.project_name || '-'}</span>,
    },
    {
      key: 'task_name',
      header: 'Task',
      render: (t: Timesheet) => <span className="text-sm text-gray-700">{t.task_name || '-'}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      width: 110,
      sortable: true,
      render: (t: Timesheet) => <span className="text-sm">{formatDate(t.date)}</span>,
    },
    {
      key: 'hours',
      header: 'Hours',
      width: 80,
      render: (t: Timesheet) => <span className="text-sm font-semibold">{t.hours}h</span>,
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
        <Badge variant={STATUS_VARIANTS[t.status] || 'default'} size="xs" dot>
          {t.status_display || t.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 200,
      render: (t: Timesheet) => (
        <div className="flex items-center gap-1">
          {t.status === 'DRAFT' && (
            <Button
              size="xs"
              variant="outline"
              leftIcon={<PaperAirplaneIcon className="w-3 h-3" />}
              onClick={(e) => {
                e.stopPropagation()
                submitMutation.mutate(t.id)
              }}
              isLoading={submitMutation.isPending}
            >
              Submit
            </Button>
          )}
          {t.status === 'SUBMITTED' && (
            <>
              <Button
                size="xs"
                variant="success"
                leftIcon={<CheckIcon className="w-3 h-3" />}
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
                leftIcon={<XMarkIcon className="w-3 h-3" />}
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
          {t.approved_by_name && (
            <span className="text-xs text-gray-400">by {t.approved_by_name}</span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Timesheet Management"
        subtitle="Review, approve, and manage timesheet entries"
        actions={
          <Button
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={() => setShowCreateModal(true)}
          >
            New Entry
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonStatsCard key={i} />)
        ) : (
          <>
            <StatsCard
              title="Total Hours"
              value={`${totalHours.toFixed(1)}h`}
              variant="primary"
              icon={<ClockIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Pending Approval"
              value={pendingCount}
              variant="warning"
              icon={<PaperAirplaneIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Approved"
              value={approvedCount}
              variant="success"
              icon={<CheckIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Drafts"
              value={draftCount}
              variant="default"
              icon={<CalendarDaysIcon className="w-5 h-5" />}
            />
          </>
        )}
      </div>

      {/* View Toggle + Filters */}
      <Tabs value={activeView} onValueChange={setActiveView}>
        <div className="flex items-center justify-between mb-4">
          <TabsList variant="pills">
            <TabsTrigger value="list" variant="pills">
              List View
            </TabsTrigger>
            <TabsTrigger value="weekly" variant="pills">
              Weekly Summary
            </TabsTrigger>
          </TabsList>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{selectedIds.size} selected</span>
              <Button
                size="sm"
                variant="success"
                leftIcon={<CheckIcon className="w-4 h-4" />}
                onClick={() => handleBulkAction('approve')}
                isLoading={approveMutation.isPending}
              >
                Approve All
              </Button>
              <Button
                size="sm"
                variant="danger"
                leftIcon={<XMarkIcon className="w-4 h-4" />}
                onClick={() => handleBulkAction('reject')}
                isLoading={rejectMutation.isPending}
              >
                Reject All
              </Button>
            </div>
          )}
        </div>

        {/* List View */}
        <TabsContent value="list">
          {/* Filters */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                <div className="w-48">
                  <Select
                    options={STATUS_OPTIONS}
                    value={filters.status || ''}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
                    placeholder="Status"
                  />
                </div>
                <div className="w-48">
                  <Select
                    options={projectOptions}
                    value={filters.project || ''}
                    onChange={(e) => setFilters({ ...filters, project: e.target.value, page: 1 })}
                    placeholder="Project"
                  />
                </div>
                <Button
                  variant="secondary"
                  leftIcon={<FunnelIcon className="w-4 h-4" />}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  {showFilters ? 'Less' : 'More'}
                </Button>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-100">
                  <Select
                    label="Employee"
                    options={employeeOptions}
                    value={filters.employee || ''}
                    onChange={(e) => setFilters({ ...filters, employee: e.target.value, page: 1 })}
                  />
                  <Input
                    label="Date From"
                    type="date"
                    value={filters.date_from || ''}
                    onChange={(e) => setFilters({ ...filters, date_from: e.target.value, page: 1 })}
                  />
                  <Input
                    label="Date To"
                    type="date"
                    value={filters.date_to || ''}
                    onChange={(e) => setFilters({ ...filters, date_to: e.target.value, page: 1 })}
                  />
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilters({ page: 1, page_size: 20 })}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Table */}
          {isLoading ? (
            <SkeletonTable columns={8} rows={5} />
          ) : !timesheetsData?.results?.length ? (
            <Card>
              <EmptyState
                type="data"
                title="No timesheet entries"
                description="Create timesheet entries to track project hours."
                action={{ label: 'New Entry', onClick: () => setShowCreateModal(true) }}
              />
            </Card>
          ) : (
            <>
              <Table
                data={timesheetsData.results}
                columns={columns}
                selectable
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
              />
              {totalPages > 1 && (
                <TablePagination
                  currentPage={filters.page || 1}
                  totalPages={totalPages}
                  totalItems={timesheetsData.count}
                  pageSize={filters.page_size || 20}
                  onPageChange={(page) => setFilters({ ...filters, page })}
                  onPageSizeChange={(size) => setFilters({ ...filters, page_size: size, page: 1 })}
                />
              )}
            </>
          )}
        </TabsContent>

        {/* Weekly Summary View */}
        <TabsContent value="weekly">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Weekly Summary</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const d = new Date(weekStart)
                      d.setDate(d.getDate() - 7)
                      setWeekStart(d.toISOString().split('T')[0])
                    }}
                  >
                    Previous
                  </Button>
                  <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">
                    {formatDate(weekStart)} - {formatDate(weekDays[6])}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const d = new Date(weekStart)
                      d.setDate(d.getDate() + 7)
                      setWeekStart(d.toISOString().split('T')[0])
                    }}
                  >
                    Next
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setWeekStart(currentWeek.start)}
                  >
                    Today
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {weeklyByEmployee.length === 0 ? (
                <EmptyState
                  type="data"
                  title="No entries this week"
                  description="No timesheet entries found for the selected week."
                  compact
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Employee
                        </th>
                        {DAY_LABELS.map((day, i) => (
                          <th
                            key={day}
                            className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[70px]"
                          >
                            <div>{day}</div>
                            <div className="text-gray-400 font-normal normal-case">
                              {new Date(weekDays[i]).getDate()}/{new Date(weekDays[i]).getMonth() + 1}
                            </div>
                          </th>
                        ))}
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {weeklyByEmployee.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                          {row.days.map((hours, i) => (
                            <td key={i} className="px-3 py-3 text-center">
                              {hours > 0 ? (
                                <span
                                  className={`inline-flex items-center justify-center w-10 h-8 rounded text-sm font-medium ${
                                    hours >= 8
                                      ? 'bg-success-100 text-success-700'
                                      : hours > 0
                                      ? 'bg-info-100 text-info-700'
                                      : ''
                                  }`}
                                >
                                  {hours}h
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-12 h-8 rounded text-sm font-bold ${
                                row.total >= 40
                                  ? 'bg-success-100 text-success-700'
                                  : row.total >= 20
                                  ? 'bg-warning-100 text-warning-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {row.total}h
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">Daily Total</td>
                        {DAY_LABELS.map((_, i) => {
                          const dayTotal = weeklyByEmployee.reduce((sum, row) => sum + row.days[i], 0)
                          return (
                            <td key={i} className="px-3 py-3 text-center text-sm font-semibold text-gray-700">
                              {dayTotal > 0 ? `${dayTotal}h` : '-'}
                            </td>
                          )
                        })}
                        <td className="px-3 py-3 text-center text-sm font-bold text-gray-900">
                          {weeklyByEmployee.reduce((sum, row) => sum + row.total, 0)}h
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Timesheet Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          resetForm()
        }}
        title="New Timesheet Entry"
      >
        <div className="space-y-4">
          <Select
            label="Employee"
            options={[
              { value: '', label: 'Select employee...' },
              ...(employees?.results || []).map((e: any) => ({
                value: e.id,
                label: `${e.first_name} ${e.last_name}`,
              })),
            ]}
            value={formData.employee}
            onChange={(e) => setFormData({ ...formData, employee: e.target.value })}
            required
          />
          <Select
            label="Project"
            options={[
              { value: '', label: 'Select project...' },
              ...(projects?.results || []).map((p: any) => ({
                value: p.id,
                label: `${p.code} - ${p.name}`,
              })),
            ]}
            value={formData.project}
            onChange={(e) => setFormData({ ...formData, project: e.target.value, task: '' })}
            required
          />
          {formData.project && taskOptions.length > 0 && (
            <Select
              label="Task"
              options={[{ value: '', label: 'No specific task' }, ...taskOptions]}
              value={formData.task}
              onChange={(e) => setFormData({ ...formData, task: e.target.value })}
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            <Input
              label="Hours"
              type="number"
              step="0.5"
              min="0"
              max="24"
              placeholder="0.0"
              value={formData.hours}
              onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
              required
            />
          </div>
          <Textarea
            label="Description"
            placeholder="What did you work on?"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
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
              disabled={!formData.project || !formData.date || !formData.hours}
            >
              Create Entry
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
