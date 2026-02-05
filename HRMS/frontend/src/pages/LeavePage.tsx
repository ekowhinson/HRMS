import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  CalendarIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { leaveService } from '@/services/leave'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { useAuthStore } from '@/features/auth/store'
import type { LeaveRequest } from '@/types'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
  RECALLED: 'info',
}

export default function LeavePage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [formData, setFormData] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: '',
  })

  const { data: leaveRequests, isLoading } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: leaveService.getMyRequests,
  })

  const { data: leaveBalances } = useQuery({
    queryKey: ['leave-balances'],
    queryFn: leaveService.getMyBalances,
  })

  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => leaveService.getLeaveTypes(),
  })

  const { data: pendingApprovals } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: leaveService.getPendingApprovals,
    enabled: user?.role === 'manager' || user?.role === 'hr',
  })

  const applyMutation = useMutation({
    mutationFn: leaveService.apply,
    onSuccess: () => {
      toast.success('Leave request submitted')
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] })
      setShowApplyModal(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit request')
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      action === 'approve' ? leaveService.approve(id) : leaveService.reject(id),
    onSuccess: () => {
      toast.success('Leave request updated')
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
      setSelectedRequest(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Action failed')
    },
  })

  const resetForm = () => {
    setFormData({
      leave_type: '',
      start_date: '',
      end_date: '',
      reason: '',
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    applyMutation.mutate(formData)
  }

  const columns = [
    {
      key: 'leave_type',
      header: 'Leave Type',
      render: (request: LeaveRequest) => (
        <span className="text-sm font-medium text-gray-900">
          {request.leave_type_name}
        </span>
      ),
    },
    {
      key: 'dates',
      header: 'Dates',
      render: (request: LeaveRequest) => (
        <div className="text-sm text-gray-700">
          <p>{new Date(request.start_date).toLocaleDateString()}</p>
          <p className="text-gray-500">to {new Date(request.end_date).toLocaleDateString()}</p>
        </div>
      ),
    },
    {
      key: 'days',
      header: 'Days',
      render: (request: LeaveRequest) => (
        <span className="text-sm text-gray-700">{request.number_of_days}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (request: LeaveRequest) => (
        <Badge variant={statusColors[request.status] || 'default'}>
          {request.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (request: LeaveRequest) => (
        request.status === 'PENDING' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedRequest(request)}
          >
            View
          </Button>
        )
      ),
    },
  ]

  const approvalColumns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (request: LeaveRequest) => (
        <span className="text-sm font-medium text-gray-900">
          {request.employee_name}
        </span>
      ),
    },
    ...columns.slice(0, -1),
    {
      key: 'actions',
      header: 'Actions',
      render: (request: LeaveRequest) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => approveMutation.mutate({ id: request.id, action: 'approve' })}
            disabled={approveMutation.isPending}
          >
            <CheckIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => approveMutation.mutate({ id: request.id, action: 'reject' })}
            disabled={approveMutation.isPending}
          >
            <XMarkIcon className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Apply for leave and track your requests
          </p>
        </div>
        <Button onClick={() => setShowApplyModal(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Apply for Leave
        </Button>
      </div>

      {/* Leave Balances */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {leaveBalances?.map((balance: any) => (
          <Card key={balance.id}>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">{balance.leave_type_name}</p>
              <p className="text-2xl font-bold text-gray-900">{balance.available_balance}</p>
              <p className="text-xs text-gray-400">
                Used: {balance.taken} / {balance.total_entitlement}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending Approvals (for managers/HR) */}
      {pendingApprovals && pendingApprovals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ClockIcon className="h-5 w-5 mr-2 text-yellow-500" />
              Pending Approvals ({pendingApprovals.length})
            </CardTitle>
          </CardHeader>
          <Table
            data={pendingApprovals}
            columns={approvalColumns}
            isLoading={false}
            emptyMessage="No pending approvals"
          />
        </Card>
      )}

      {/* My Leave Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2 text-gray-500" />
            My Leave Requests
          </CardTitle>
        </CardHeader>
        <Table
          data={leaveRequests || []}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No leave requests found"
        />
      </Card>

      {/* Apply Leave Modal */}
      <Modal
        isOpen={showApplyModal}
        onClose={() => {
          setShowApplyModal(false)
          resetForm()
        }}
        title="Apply for Leave"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Leave Type"
            value={formData.leave_type}
            onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
            options={
              leaveTypes?.map((lt: any) => ({
                value: lt.id,
                label: lt.name,
              })) || []
            }
            placeholder="Select leave type"
          />

          <div className="grid grid-cols-2 gap-4">
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
              min={formData.start_date}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason
            </label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              rows={3}
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Reason for leave request..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowApplyModal(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={applyMutation.isPending}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Request Modal */}
      <Modal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title="Leave Request Details"
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Leave Type</p>
                <p className="font-medium">{selectedRequest.leave_type_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={statusColors[selectedRequest.status]}>
                  {selectedRequest.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Start Date</p>
                <p className="font-medium">
                  {new Date(selectedRequest.start_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">End Date</p>
                <p className="font-medium">
                  {new Date(selectedRequest.end_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Days Requested</p>
                <p className="font-medium">{selectedRequest.number_of_days}</p>
              </div>
            </div>
            {selectedRequest.reason && (
              <div>
                <p className="text-sm text-gray-500">Reason</p>
                <p className="text-gray-700">{selectedRequest.reason}</p>
              </div>
            )}
            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
