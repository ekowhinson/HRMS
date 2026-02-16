import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  CheckIcon,
  XMarkIcon,
  CalendarIcon,
  FunnelIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import { leaveService } from '@/services/leave'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import type { LeaveRequest } from '@/types'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
  RECALLED: 'info',
}

export default function LeaveApprovalsPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const { data: requests, isLoading } = useQuery({
    queryKey: ['leave-requests-admin', statusFilter],
    queryFn: () => leaveService.getLeaveRequests({ status: statusFilter }),
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => leaveService.approve(id),
    onSuccess: () => {
      toast.success('Leave request approved')
      queryClient.invalidateQueries({ queryKey: ['leave-requests-admin'] })
      setSelectedRequest(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to approve request')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      leaveService.reject(id, reason),
    onSuccess: () => {
      toast.success('Leave request rejected')
      queryClient.invalidateQueries({ queryKey: ['leave-requests-admin'] })
      setSelectedRequest(null)
      setShowRejectModal(false)
      setRejectReason('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to reject request')
    },
  })

  const handleApprove = (request: LeaveRequest) => {
    approveMutation.mutate(request.id)
  }

  const handleReject = () => {
    if (selectedRequest && rejectReason) {
      rejectMutation.mutate({ id: selectedRequest.id, reason: rejectReason })
    }
  }

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (request: LeaveRequest) => (
        <div className="flex items-center gap-3">
          <Avatar
            firstName={request.employee_name?.split(' ')[0]}
            lastName={request.employee_name?.split(' ')[1]}
            size="sm"
          />
          <span className="font-medium text-gray-900">{request.employee_name}</span>
        </div>
      ),
    },
    {
      key: 'leave_type',
      header: 'Type',
      render: (request: LeaveRequest) => (
        <span className="text-sm text-gray-700">{request.leave_type_name}</span>
      ),
    },
    {
      key: 'dates',
      header: 'Dates',
      render: (request: LeaveRequest) => (
        <div className="text-sm">
          <p className="text-gray-900">
            {new Date(request.start_date).toLocaleDateString()}
          </p>
          <p className="text-gray-500">
            to {new Date(request.end_date).toLocaleDateString()}
          </p>
        </div>
      ),
    },
    {
      key: 'days',
      header: 'Days',
      render: (request: LeaveRequest) => (
        <span className="text-sm font-medium text-gray-900">{request.number_of_days}</span>
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
      header: 'Actions',
      render: (request: LeaveRequest) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedRequest(request)}
          >
            <EyeIcon className="h-4 w-4" />
          </Button>
          {request.status === 'PENDING' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleApprove(request)}
                disabled={approveMutation.isPending}
              >
                <CheckIcon className="h-4 w-4 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedRequest(request)
                  setShowRejectModal(true)
                }}
              >
                <XMarkIcon className="h-4 w-4 text-red-600" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]

  const pendingCount = requests?.results?.filter(
    (r: LeaveRequest) => r.status === 'PENDING'
  ).length || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Approvals</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and approve leave requests
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 rounded-md">
            <CalendarIcon className="h-5 w-5 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-700">
              {pendingCount} pending approval{pendingCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'All Requests' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'REJECTED', label: 'Rejected' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2 text-gray-500" />
            Leave Requests
          </CardTitle>
        </CardHeader>
        <Table
          data={(requests?.results || []).slice((currentPage - 1) * pageSize, currentPage * pageSize)}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No leave requests found"
        />
        {requests?.results && requests.results.length > pageSize && (
          <TablePagination
            currentPage={currentPage}
            totalPages={Math.ceil(requests.results.length / pageSize)}
            totalItems={requests.results.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        )}
      </Card>

      {/* View Request Modal */}
      <Modal
        isOpen={!!selectedRequest && !showRejectModal}
        onClose={() => setSelectedRequest(null)}
        title="Leave Request Details"
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar
                firstName={selectedRequest.employee_name?.split(' ')[0]}
                lastName={selectedRequest.employee_name?.split(' ')[1]}
                size="lg"
              />
              <div>
                <h3 className="font-medium text-gray-900">
                  {selectedRequest.employee_name}
                </h3>
                <Badge variant={statusColors[selectedRequest.status]}>
                  {selectedRequest.status}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Leave Type</p>
                <p className="font-medium">{selectedRequest.leave_type_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Days Requested</p>
                <p className="font-medium">{selectedRequest.number_of_days}</p>
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
            </div>

            {selectedRequest.reason && (
              <div>
                <p className="text-sm text-gray-500">Reason</p>
                <p className="text-gray-700 mt-1">{selectedRequest.reason}</p>
              </div>
            )}

            {selectedRequest.status === 'PENDING' && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectModal(true)
                  }}
                >
                  <XMarkIcon className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleApprove(selectedRequest)}
                  isLoading={approveMutation.isPending}
                >
                  <CheckIcon className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false)
          setRejectReason('')
        }}
        title="Reject Leave Request"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for rejecting this leave request.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rejection Reason
            </label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] sm:text-sm bg-gray-50 focus:bg-white hover:border-gray-400"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectModal(false)
                setRejectReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleReject}
              isLoading={rejectMutation.isPending}
              disabled={!rejectReason}
            >
              Reject Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
