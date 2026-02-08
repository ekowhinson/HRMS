/**
 * Approval Inbox — lists pending approvals for the current user
 * with the ability to approve, reject, or delegate.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { Card, CardContent, StatCard } from '@/components/ui/Card'
import { TablePagination } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Modal from '@/components/ui/Modal'
import {
  getMyPendingApprovals,
  getApprovalStats,
  processApproval,
  type PendingApproval,
  type ApprovalStats,
} from '@/services/approval'

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'

const moduleLabel = (m: string) => {
  const map: Record<string, string> = {
    leave: 'Leave', benefits: 'Benefits', payroll: 'Payroll',
    employees: 'Employee', performance: 'Performance',
    recruitment: 'Recruitment', exits: 'Exit', discipline: 'Discipline',
  }
  const app = m.split('.')[0]
  return map[app] || app
}

export default function ApprovalInboxPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionModal, setActionModal] = useState<{
    id: string
    action: 'APPROVE' | 'REJECT' | 'DELEGATE'
  } | null>(null)
  const [comments, setComments] = useState('')
  const [delegateTo, setDelegateTo] = useState('')

  // ── Data ────────────────────────────────────────────────────

  const { data: stats } = useQuery<ApprovalStats>({
    queryKey: ['approval-stats'],
    queryFn: getApprovalStats,
  })

  const params: Record<string, string> = {}
  if (search) params.search = search
  if (moduleFilter) params.module = moduleFilter

  const {
    data: approvals = [],
    isLoading,
    refetch,
  } = useQuery<PendingApproval[]>({
    queryKey: ['my-pending-approvals', params],
    queryFn: () => getMyPendingApprovals(params),
  })

  // ── Mutation ────────────────────────────────────────────────

  const actionMutation = useMutation({
    mutationFn: (payload: { id: string; action: 'APPROVE' | 'REJECT' | 'DELEGATE'; comments: string; delegated_to?: string }) =>
      processApproval(payload.id, {
        action: payload.action,
        comments: payload.comments,
        delegated_to: payload.delegated_to || null,
      }),
    onSuccess: (_, vars) => {
      const label = vars.action === 'APPROVE' ? 'Approved' : vars.action === 'REJECT' ? 'Rejected' : 'Delegated'
      toast.success(`${label} successfully`)
      queryClient.invalidateQueries({ queryKey: ['my-pending-approvals'] })
      queryClient.invalidateQueries({ queryKey: ['approval-stats'] })
      setActionModal(null)
      setComments('')
      setDelegateTo('')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Action failed')
    },
  })

  const handleAction = () => {
    if (!actionModal) return
    actionMutation.mutate({
      id: actionModal.id,
      action: actionModal.action,
      comments,
      delegated_to: actionModal.action === 'DELEGATE' ? delegateTo : undefined,
    })
  }

  // ── Expanded row: show timeline ─────────────────────────────

  const TimelineRow = ({ approval }: { approval: PendingApproval }) => {
    return (
      <tr>
        <td colSpan={7} className="px-6 py-4 bg-gray-50">
          <div className="space-y-2">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Workflow:</span> {approval.workflow_name}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">Object:</span> {approval.object_display}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">Level:</span> {approval.level_number} of {approval.total_levels}
              {approval.level_name && ` — ${approval.level_name}`}
            </div>
            {approval.comments && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Comments:</span> {approval.comments}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="success"
                onClick={() => setActionModal({ id: approval.id, action: 'APPROVE' })}
              >
                <CheckCircleIcon className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => setActionModal({ id: approval.id, action: 'REJECT' })}
              >
                <XCircleIcon className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActionModal({ id: approval.id, action: 'DELEGATE' })}
              >
                <UserIcon className="h-4 w-4 mr-1" />
                Delegate
              </Button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Approvals</h1>
        <p className="text-sm text-gray-500 mt-1">Review and act on pending approval requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Pending"
          value={stats?.pending_count ?? 0}
          icon={<ClockIcon className="h-6 w-6 text-amber-500" />}
        />
        <StatCard
          title="Approved Today"
          value={stats?.approved_today ?? 0}
          icon={<CheckCircleIcon className="h-6 w-6 text-green-500" />}
        />
        <StatCard
          title="Rejected Today"
          value={stats?.rejected_today ?? 0}
          icon={<XCircleIcon className="h-6 w-6 text-red-500" />}
        />
        <StatCard
          title="Overdue"
          value={stats?.overdue_count ?? 0}
          icon={<ClockIcon className="h-6 w-6 text-red-500" />}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search workflows..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                value={moduleFilter}
                onChange={(e) => { setModuleFilter(e.target.value); setCurrentPage(1) }}
                placeholder="All Modules"
                options={[
                  { value: 'leave.leaverequest', label: 'Leave' },
                  { value: 'benefits.benefit', label: 'Benefits' },
                  { value: 'payroll.payrollrun', label: 'Payroll' },
                  { value: 'employees.dataupdaterequest', label: 'Data Updates' },
                  { value: 'performance.appraisal', label: 'Performance' },
                ]}
              />
            </div>
            <Button variant="ghost" onClick={() => refetch()}>
              <ArrowPathIcon className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Module
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Request
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workflow
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requested
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                    Loading approvals...
                  </td>
                </tr>
              ) : approvals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                    <CheckCircleIcon className="h-8 w-8 text-green-300 mx-auto mb-2" />
                    No pending approvals
                  </td>
                </tr>
              ) : (
                approvals.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((a) => (
                  <>
                    <tr
                      key={a.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant="info">{moduleLabel(a.module_name)}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                          {a.object_display}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{a.workflow_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {a.level_number}/{a.total_levels}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(a.requested_at)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="warning">Pending</Badge>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="xs"
                            variant="success"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActionModal({ id: a.id, action: 'APPROVE' })
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="xs"
                            variant="danger"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActionModal({ id: a.id, action: 'REJECT' })
                            }}
                          >
                            Reject
                          </Button>
                          <button
                            className="p-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedId(expandedId === a.id ? null : a.id)
                            }}
                          >
                            {expandedId === a.id ? (
                              <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === a.id && <TimelineRow key={`${a.id}-detail`} approval={a} />}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
        {approvals.length > pageSize && (
          <TablePagination
            currentPage={currentPage}
            totalPages={Math.ceil(approvals.length / pageSize)}
            totalItems={approvals.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        )}
      </Card>

      {/* Action Modal */}
      <Modal
        isOpen={!!actionModal}
        onClose={() => {
          setActionModal(null)
          setComments('')
          setDelegateTo('')
        }}
        title={
          actionModal?.action === 'APPROVE'
            ? 'Approve Request'
            : actionModal?.action === 'REJECT'
            ? 'Reject Request'
            : 'Delegate Request'
        }
      >
        <div className="space-y-4">
          {actionModal?.action === 'DELEGATE' && (
            <Input
              label="Delegate to (User ID)"
              placeholder="Enter user ID to delegate to"
              value={delegateTo}
              onChange={(e) => setDelegateTo(e.target.value)}
            />
          )}
          <Textarea
            label={actionModal?.action === 'REJECT' ? 'Reason for rejection' : 'Comments (optional)'}
            placeholder="Enter your comments..."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setActionModal(null)
                setComments('')
                setDelegateTo('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant={actionModal?.action === 'REJECT' ? 'danger' : actionModal?.action === 'APPROVE' ? 'success' : 'primary'}
              onClick={handleAction}
              isLoading={actionMutation.isPending}
            >
              {actionModal?.action === 'APPROVE'
                ? 'Confirm Approve'
                : actionModal?.action === 'REJECT'
                ? 'Confirm Reject'
                : 'Confirm Delegate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
