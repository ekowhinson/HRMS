import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowRightStartOnRectangleIcon,
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { exitService, type ExitRequest } from '@/services/exits'
import { employeeService } from '@/services/employees'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  SUBMITTED: 'info',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  REJECTED: 'danger',
  IN_PROGRESS: 'info',
  CLEARANCE: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
  WITHDRAWN: 'default',
}

export default function ExitsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // Fetch exit requests
  const { data: exitRequests, isLoading } = useQuery({
    queryKey: ['exit-requests', statusFilter, typeFilter],
    queryFn: () => exitService.getExitRequests({
      ...(statusFilter && { status: statusFilter }),
      ...(typeFilter && { exit_type: typeFilter }),
    }),
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['exit-stats'],
    queryFn: () => exitService.getExitStats(),
  })

  // Fetch exit types for filters and form
  const { data: exitTypes } = useQuery({
    queryKey: ['exit-types'],
    queryFn: () => exitService.getExitTypes(),
  })

  // Fetch employees for form
  const { data: employees } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => employeeService.getEmployees({ employment_status: 'ACTIVE' }),
  })

  // Create form state
  const [formData, setFormData] = useState({
    employee: '',
    exit_type: '',
    reason: '',
    proposed_last_day: '',
    additional_comments: '',
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: exitService.createExitRequest,
    onSuccess: (data) => {
      toast.success('Exit request created successfully')
      queryClient.invalidateQueries({ queryKey: ['exit-requests'] })
      queryClient.invalidateQueries({ queryKey: ['exit-stats'] })
      setShowCreateModal(false)
      setFormData({ employee: '', exit_type: '', reason: '', proposed_last_day: '', additional_comments: '' })
      navigate(`/admin/exits/${data.id}`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create exit request')
    },
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.employee || !formData.exit_type || !formData.reason || !formData.proposed_last_day) {
      toast.error('Please fill in all required fields')
      return
    }
    createMutation.mutate(formData)
  }

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'SUBMITTED', label: 'Submitted' },
    { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'CLEARANCE', label: 'Awaiting Clearance' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'REJECTED', label: 'Rejected' },
  ]

  const typeOptions = [
    { value: '', label: 'All Types' },
    ...(exitTypes?.map((t) => ({ value: t.id, label: t.name })) || []),
  ]

  const employeeOptions = [
    { value: '', label: 'Select Employee...' },
    ...(employees?.results?.map((e: any) => ({
      value: e.id,
      label: `${e.first_name} ${e.last_name} (${e.employee_number})`,
    })) || []),
  ]

  const exitTypeOptions = [
    { value: '', label: 'Select Exit Type...' },
    ...(exitTypes?.map((t) => ({ value: t.id, label: t.name })) || []),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exit Management</h1>
          <p className="text-sm text-gray-500">Manage employee offboarding and clearances</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Exit Request
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ArrowRightStartOnRectangleIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Requests</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <ClockIcon className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Approval</p>
                <p className="text-2xl font-bold">{stats?.pending_approval || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">In Clearance</p>
                <p className="text-2xl font-bold">{stats?.in_clearance || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Completed (Month)</p>
                <p className="text-2xl font-bold">{stats?.completed_this_month || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
            />
            <Select
              label="Exit Type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={typeOptions}
            />
          </div>
        </CardContent>
      </Card>

      {/* Exit Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Exit Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : exitRequests?.results && exitRequests.results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Request #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Exit Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Day
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Clearance
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {exitRequests.results.map((request: ExitRequest) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-primary-600">{request.request_number}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                            <UserIcon className="h-4 w-4 text-gray-500" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{request.employee_name}</p>
                            <p className="text-sm text-gray-500">{request.employee_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {request.exit_type_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {request.actual_last_day || request.proposed_last_day
                          ? new Date(request.actual_last_day || request.proposed_last_day).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={statusColors[request.status]}>
                          {request.status_display}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {request.status === 'CLEARANCE' || request.status === 'IN_PROGRESS' ? (
                          <span className={request.pending_clearances === 0 ? 'text-green-600' : 'text-yellow-600'}>
                            {(request.total_clearances || 0) - (request.pending_clearances || 0)}/{request.total_clearances || 0}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/exits/${request.id}`)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <ArrowRightStartOnRectangleIcon className="h-12 w-12 mb-2" />
              <p>No exit requests found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Exit Request"
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Select
            label="Employee"
            value={formData.employee}
            onChange={(e) => setFormData({ ...formData, employee: e.target.value })}
            options={employeeOptions}
            required
          />
          <Select
            label="Exit Type"
            value={formData.exit_type}
            onChange={(e) => setFormData({ ...formData, exit_type: e.target.value })}
            options={exitTypeOptions}
            required
          />
          <Input
            label="Proposed Last Working Day"
            type="date"
            value={formData.proposed_last_day}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, proposed_last_day: e.target.value })}
            required
          />
          <Textarea
            label="Reason for Exit"
            value={formData.reason}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="Enter the reason for exit..."
            rows={3}
            required
          />
          <Textarea
            label="Additional Comments"
            value={formData.additional_comments}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, additional_comments: e.target.value })}
            placeholder="Any additional comments..."
            rows={2}
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
