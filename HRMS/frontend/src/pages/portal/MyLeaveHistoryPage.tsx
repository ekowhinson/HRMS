import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon,
  FunnelIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'
import { portalService } from '@/services/portal'
import { leaveService } from '@/services/leave'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import type { LeaveRequest } from '@/types'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'info',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
  RECALLED: 'info',
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Plan',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  RECALLED: 'Recalled',
}

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const currentYear = new Date().getFullYear()
const yearOptions = [
  { value: '', label: 'All Years' },
  ...Array.from({ length: 5 }, (_, i) => ({
    value: String(currentYear - i),
    label: String(currentYear - i),
  })),
]

export default function MyLeaveHistoryPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({
    status: '',
    year: '',
  })

  const { data: requests, isLoading, isError } = useQuery({
    queryKey: ['my-leave-history', filters],
    queryFn: () =>
      portalService.getMyLeaveHistory({
        status: filters.status || undefined,
        year: filters.year ? parseInt(filters.year) : undefined,
      }),
    retry: false,
  })

  const submitMutation = useMutation({
    mutationFn: leaveService.submit,
    onSuccess: () => {
      toast.success('Leave request submitted for approval')
      queryClient.invalidateQueries({ queryKey: ['my-leave-history'] })
      queryClient.invalidateQueries({ queryKey: ['my-leave-balances'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to submit request')
    },
  })

  const columns = [
    {
      key: 'request_number',
      header: 'Request #',
      render: (req: LeaveRequest) => (
        <span className="font-mono text-sm text-gray-600">{req.request_number}</span>
      ),
    },
    {
      key: 'type',
      header: 'Leave Type',
      render: (req: LeaveRequest) => (
        <span className="font-medium text-gray-900">{req.leave_type_name}</span>
      ),
    },
    {
      key: 'dates',
      header: 'Duration',
      render: (req: LeaveRequest) => (
        <div className="text-sm">
          <p className="text-gray-900">
            {new Date(req.start_date).toLocaleDateString()} -{' '}
            {new Date(req.end_date).toLocaleDateString()}
          </p>
          <p className="text-gray-500">{req.number_of_days} day(s)</p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (req: LeaveRequest) => (
        <p className="text-sm text-gray-600 max-w-xs truncate">{req.reason}</p>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (req: LeaveRequest) => (
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={statusColors[req.status] || 'default'}>
              {statusLabels[req.status] || req.status}
            </Badge>
            {req.status === 'DRAFT' && (
              <Button
                size="sm"
                onClick={() => submitMutation.mutate(req.id)}
                disabled={submitMutation.isPending}
              >
                Submit
              </Button>
            )}
          </div>
          {req.approved_at && (
            <p className="text-xs text-gray-500 mt-1">
              {new Date(req.approved_at).toLocaleDateString()}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (req: LeaveRequest) => (
        <span className="text-sm text-gray-500">
          {new Date(req.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ]

  // Calculate summary stats
  const summary = {
    total: requests?.length || 0,
    approved: requests?.filter((r) => r.status === 'APPROVED').length || 0,
    pending: requests?.filter((r) => r.status === 'PENDING').length || 0,
    rejected: requests?.filter((r) => r.status === 'REJECTED').length || 0,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/my-leave">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leave History</h1>
            <p className="mt-1 text-sm text-gray-500">
              View your complete leave request history
            </p>
          </div>
        </div>
        <Link to="/my-leave/calendar">
          <Button variant="outline">
            <CalendarIcon className="h-4 w-4 mr-2" />
            Calendar View
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
            <p className="text-sm text-gray-500">Total Requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{summary.approved}</p>
            <p className="text-sm text-gray-500">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{summary.pending}</p>
            <p className="text-sm text-gray-500">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{summary.rejected}</p>
            <p className="text-sm text-gray-500">Rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <FunnelIcon className="h-5 w-5 mr-2 text-gray-500" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Select
                label="Status"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                options={statusOptions}
              />
            </div>
            <div className="w-48">
              <Select
                label="Year"
                value={filters.year}
                onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                options={yearOptions}
              />
            </div>
            {(filters.status || filters.year) && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({ status: '', year: '' })}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <Table
          data={isError ? [] : (requests || [])}
          columns={columns}
          isLoading={isLoading}
          emptyMessage={isError ? "Unable to load leave history" : "No leave requests found"}
        />
      </Card>
    </div>
  )
}
