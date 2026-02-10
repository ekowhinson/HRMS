import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  FunnelIcon,
  EyeIcon,
  TrashIcon,
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { performanceService, type Appraisal, type AppraisalCycle } from '@/services/performance'
import { employeeService } from '@/services/employees'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import { StatsCard } from '@/components/ui/StatsCard'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  GOAL_SETTING: 'info',
  GOALS_SUBMITTED: 'info',
  GOALS_APPROVED: 'info',
  IN_PROGRESS: 'warning',
  SELF_ASSESSMENT: 'warning',
  MANAGER_REVIEW: 'warning',
  MEETING: 'warning',
  CALIBRATION: 'warning',
  COMPLETED: 'success',
  ACKNOWLEDGED: 'success',
}

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'GOAL_SETTING', label: 'Goal Setting' },
  { value: 'GOALS_SUBMITTED', label: 'Goals Submitted' },
  { value: 'GOALS_APPROVED', label: 'Goals Approved' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'SELF_ASSESSMENT', label: 'Self Assessment' },
  { value: 'MANAGER_REVIEW', label: 'Manager Review' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
]

export default function AppraisalsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [cycleFilter, setCycleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [selectedCycle, setSelectedCycle] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingAppraisal, setDeletingAppraisal] = useState<Appraisal | null>(null)

  // Fetch appraisals
  const { data: appraisals, isLoading } = useQuery({
    queryKey: ['appraisals', cycleFilter, statusFilter, departmentFilter, searchQuery, currentPage],
    queryFn: () =>
      performanceService.getAppraisals({
        cycle: cycleFilter || undefined,
        status: statusFilter || undefined,
        department: departmentFilter || undefined,
        search: searchQuery || undefined,
        page: currentPage,
        page_size: pageSize,
      }),
  })

  // Fetch cycles for filter
  const { data: cycles } = useQuery({
    queryKey: ['appraisal-cycles'],
    queryFn: performanceService.getAppraisalCycles,
  })

  // Fetch departments for filter
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => employeeService.getDepartments(),
  })

  // Fetch employees for create modal
  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => employeeService.getAll({}),
    enabled: showCreateModal,
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['appraisal-stats', cycleFilter],
    queryFn: () => performanceService.getAppraisalStats(cycleFilter || undefined),
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: performanceService.createAppraisal,
    onSuccess: (data) => {
      toast.success('Appraisal created successfully')
      queryClient.invalidateQueries({ queryKey: ['appraisals'] })
      queryClient.invalidateQueries({ queryKey: ['appraisal-stats'] })
      setShowCreateModal(false)
      setSelectedEmployee('')
      setSelectedCycle('')
      navigate(`/admin/appraisals/${data.id}`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create appraisal')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: performanceService.deleteAppraisal,
    onSuccess: () => {
      toast.success('Appraisal deleted')
      queryClient.invalidateQueries({ queryKey: ['appraisals'] })
      queryClient.invalidateQueries({ queryKey: ['appraisal-stats'] })
      setShowDeleteModal(false)
      setDeletingAppraisal(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete appraisal')
    },
  })

  const handleCreate = () => {
    if (!selectedEmployee || !selectedCycle) {
      toast.error('Please select an employee and cycle')
      return
    }
    createMutation.mutate({
      employee: selectedEmployee,
      appraisal_cycle: selectedCycle,
    })
  }

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (appraisal: Appraisal) => (
        <div className="flex items-center gap-3">
          <Avatar
            firstName={appraisal.employee_name?.split(' ')[0]}
            lastName={appraisal.employee_name?.split(' ')[1]}
            size="sm"
          />
          <div>
            <p className="font-medium text-gray-900">{appraisal.employee_name}</p>
            <p className="text-sm text-gray-500">{appraisal.employee_number}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (appraisal: Appraisal) => (
        <div>
          <p className="text-sm text-gray-700">{appraisal.department_name}</p>
          <p className="text-xs text-gray-500">{appraisal.position_title}</p>
        </div>
      ),
    },
    {
      key: 'cycle',
      header: 'Cycle',
      render: (appraisal: Appraisal) => (
        <span className="text-sm text-gray-700">{appraisal.cycle_name}</span>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (appraisal: Appraisal) => (
        <div className="text-center">
          {appraisal.overall_final_rating != null ? (
            <span className="text-lg font-bold text-primary-600">
              {Number(appraisal.overall_final_rating).toFixed(1)}%
            </span>
          ) : appraisal.overall_self_rating != null ? (
            <span className="text-sm text-gray-500">
              Self: {Number(appraisal.overall_self_rating).toFixed(1)}%
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (appraisal: Appraisal) => (
        <Badge variant={statusColors[appraisal.status] || 'default'}>
          {appraisal.status_display || appraisal.status?.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (appraisal: Appraisal) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/appraisals/${appraisal.id}`)}
            title="View Details"
          >
            <EyeIcon className="h-4 w-4" />
          </Button>
          {appraisal.status === 'DRAFT' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDeletingAppraisal(appraisal)
                setShowDeleteModal(true)
              }}
              title="Delete"
            >
              <TrashIcon className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const activeCycle = cycles?.find((c: AppraisalCycle) => c.is_active)

  const cycleOptions = [
    { value: '', label: 'All Cycles' },
    ...(cycles?.map((c: AppraisalCycle) => ({
      value: c.id,
      label: `${c.name}${c.is_active ? ' (Active)' : ''}`,
    })) || []),
  ]

  const departmentOptions = [
    { value: '', label: 'All Departments' },
    ...(departments?.map((d: any) => ({
      value: d.id,
      label: d.name,
    })) || []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appraisals</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage employee performance appraisals
            {activeCycle && (
              <span className="ml-2 text-primary-600 font-medium">
                Active Cycle: {activeCycle.name}
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Appraisal
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Appraisals"
          value={stats?.total_appraisals || 0}
          icon={<ChartBarIcon className="h-6 w-6" />}
        />
        <StatsCard
          title="Completed"
          value={stats?.completed || 0}
          icon={<CheckCircleIcon className="h-6 w-6" />}
          variant="success"
        />
        <StatsCard
          title="Pending"
          value={stats?.pending || 0}
          icon={<ClockIcon className="h-6 w-6" />}
          variant="warning"
        />
        <StatsCard
          title="Average Rating"
          value={stats?.average_rating ? `${stats.average_rating.toFixed(1)}%` : '-'}
          icon={<UserGroupIcon className="h-6 w-6" />}
          variant="primary"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <Select
              value={cycleFilter}
              onChange={(e) => {
                setCycleFilter(e.target.value)
                setCurrentPage(1)
              }}
              options={cycleOptions}
            />
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              options={statusOptions}
            />
            <Select
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value)
                setCurrentPage(1)
              }}
              options={departmentOptions}
            />
            <Input
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-64"
            />
          </div>
        </CardContent>
      </Card>

      {/* Appraisals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ChartBarIcon className="h-5 w-5 mr-2 text-primary-500" />
            Employee Appraisals
          </CardTitle>
        </CardHeader>
        <Table
          data={appraisals?.results || []}
          columns={columns}
          isLoading={isLoading}
        />
        {appraisals && appraisals.count > pageSize && (
          <TablePagination
            currentPage={currentPage}
            totalPages={Math.ceil(appraisals.count / pageSize)}
            onPageChange={setCurrentPage}
            totalItems={appraisals.count}
            pageSize={pageSize}
          />
        )}
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Appraisal"
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Appraisal Cycle"
            value={selectedCycle}
            onChange={(e) => setSelectedCycle(e.target.value)}
            options={[
              { value: '', label: 'Select a cycle...' },
              ...(cycles?.map((c: AppraisalCycle) => ({
                value: c.id,
                label: `${c.name}${c.is_active ? ' (Active)' : ''}`,
              })) || []),
            ]}
            required
          />

          <Select
            label="Employee"
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            options={[
              { value: '', label: 'Select an employee...' },
              ...(employees?.results?.map((e: any) => ({
                value: e.id,
                label: `${e.full_name} (${e.employee_number})`,
              })) || []),
            ]}
            required
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              isLoading={createMutation.isPending}
            >
              Create Appraisal
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Appraisal"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the appraisal for{' '}
            <strong>{deletingAppraisal?.employee_name}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deletingAppraisal && deleteMutation.mutate(deletingAppraisal.id)}
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
