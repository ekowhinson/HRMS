import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  CalendarIcon,
  ClockIcon,
  UserGroupIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { leaveService } from '@/services/leave'
import { portalService } from '@/services/portal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import LinkedSelect from '@/components/ui/LinkedSelect'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Table from '@/components/ui/Table'
import type { LeaveRequest } from '@/types'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'info',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Plan',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

export default function MyLeaveDashboard() {
  const queryClient = useQueryClient()
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [formData, setFormData] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: '',
  })

  const { data: balances, isLoading: balancesLoading, isError: balancesError } = useQuery({
    queryKey: ['my-leave-balances'],
    queryFn: () => portalService.getMyLeaveBalances(),
    retry: false,
  })

  const { data: recentRequests, isLoading: requestsLoading, isError: requestsError } = useQuery({
    queryKey: ['my-leave-history-recent'],
    queryFn: () => portalService.getMyLeaveHistory(),
    retry: false,
  })

  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => leaveService.getLeaveTypes(),
    retry: false,
  })

  const { data: teamOverview } = useQuery({
    queryKey: ['team-leave-overview'],
    queryFn: portalService.getTeamLeaveOverview,
    retry: false,
  })

  const applyMutation = useMutation({
    mutationFn: leaveService.apply,
    onSuccess: () => {
      toast.success('Leave plan created. Click Submit to send for approval.')
      queryClient.invalidateQueries({ queryKey: ['my-leave-history-recent'] })
      queryClient.invalidateQueries({ queryKey: ['my-leave-balances'] })
      setShowApplyModal(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || error.response?.data?.error || 'Failed to create leave plan')
    },
  })

  const submitMutation = useMutation({
    mutationFn: leaveService.submit,
    onSuccess: () => {
      toast.success('Leave request submitted for approval')
      queryClient.invalidateQueries({ queryKey: ['my-leave-history-recent'] })
      queryClient.invalidateQueries({ queryKey: ['my-leave-balances'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to submit request')
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

  const recentColumns = [
    {
      key: 'type',
      header: 'Type',
      render: (req: LeaveRequest) => (
        <span className="font-medium text-gray-900">{req.leave_type_name}</span>
      ),
    },
    {
      key: 'dates',
      header: 'Dates',
      render: (req: LeaveRequest) => (
        <div className="text-sm">
          <p>{new Date(req.start_date).toLocaleDateString()}</p>
          <p className="text-gray-500">to {new Date(req.end_date).toLocaleDateString()}</p>
        </div>
      ),
    },
    {
      key: 'days',
      header: 'Days',
      render: (req: LeaveRequest) => (
        <span className="text-sm text-gray-700">{req.number_of_days}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (req: LeaveRequest) => (
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
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Leave</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your leave requests and view balances
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/my-leave/calendar">
            <Button variant="outline">
              <CalendarIcon className="h-4 w-4 mr-2" />
              Calendar
            </Button>
          </Link>
          <Button onClick={() => setShowApplyModal(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Apply for Leave
          </Button>
        </div>
      </div>

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {balancesLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="h-8 bg-gray-200 rounded w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : balancesError || !balances || balances.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-500">
                  {balancesError
                    ? 'Unable to load leave balances. Please contact HR if this persists.'
                    : 'No leave balances available yet.'}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          balances.map((balance: any) => (
            <Card key={balance.id}>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 truncate">
                  {balance.leave_type_name || 'Leave'}
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {balance.available_balance ?? 0}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Used: {balance.taken || 0} / Total: {(balance.earned || 0) + (balance.opening_balance || 0)}
                </p>
                {balance.pending > 0 && (
                  <p className="text-xs text-yellow-600 mt-1">
                    {balance.pending} days pending
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Requests */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center">
                <ClockIcon className="h-5 w-5 mr-2 text-gray-500" />
                Recent Requests
              </CardTitle>
              <Link
                to="/my-leave/history"
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
              >
                View All
                <ArrowRightIcon className="h-4 w-4 ml-1" />
              </Link>
            </CardHeader>
            <Table
              data={requestsError ? [] : (recentRequests?.slice(0, 5) || [])}
              columns={recentColumns}
              isLoading={requestsLoading}
              emptyMessage={requestsError ? "Unable to load leave history" : "No leave requests yet"}
            />
          </Card>
        </div>

        {/* Team On Leave Today (for managers) */}
        {teamOverview && typeof teamOverview.team_size === 'number' && teamOverview.team_size > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <UserGroupIcon className="h-5 w-5 mr-2 text-gray-500" />
                Team Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <span className="text-sm text-gray-600">Team Size</span>
                  <span className="font-semibold">{teamOverview.team_size}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-md">
                  <span className="text-sm text-gray-600">Pending Approvals</span>
                  <Badge variant="warning">{teamOverview.pending_approvals}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-md">
                  <span className="text-sm text-gray-600">On Leave Today</span>
                  <Badge variant="info">{teamOverview.on_leave_count}</Badge>
                </div>

                {teamOverview.on_leave_today && teamOverview.on_leave_today.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">WHO'S OUT TODAY</p>
                    <div className="space-y-2">
                      {teamOverview.on_leave_today.map((person: any) => (
                        <div
                          key={person.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: person.leave_type_color || '#6b7280' }}
                          />
                          <span className="text-gray-700">{person.employee_name}</span>
                          <span className="text-gray-400">-</span>
                          <span className="text-gray-500">{person.leave_type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {typeof teamOverview.pending_approvals === 'number' && teamOverview.pending_approvals > 0 && (
                  <Link to="/admin/leave-approvals">
                    <Button variant="outline" size="sm" className="w-full">
                      Review Pending Approvals
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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
          <LinkedSelect
            fieldKey="leave_type"
            label="Leave Type"
            value={formData.leave_type}
            onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
            placeholder="Select leave type"
            options={
              leaveTypes?.map((lt: any) => ({
                value: lt.id,
                label: lt.name,
              })) || []
            }
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
              className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] transition-colors duration-150 sm:text-sm"
              rows={3}
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Reason for leave request..."
              required
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
              Create Plan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
