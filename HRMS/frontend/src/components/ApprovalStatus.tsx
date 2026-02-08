/**
 * Reusable ApprovalStatus component — horizontal stepper showing
 * the approval chain for any object.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useState } from 'react'
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  MinusCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/solid'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import {
  getObjectApprovalStatus,
  processApproval,
  type ApprovalInstance,
  type PendingApproval,
} from '@/services/approval'
import { useAuthStore } from '@/features/auth/store'

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GH', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

interface ApprovalStatusProps {
  contentType: string
  objectId: string
  compact?: boolean
}

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case 'APPROVED':
      return <CheckCircleIcon className="h-6 w-6 text-green-500" />
    case 'REJECTED':
      return <XCircleIcon className="h-6 w-6 text-red-500" />
    case 'PENDING':
      return <ClockIcon className="h-6 w-6 text-amber-500 animate-pulse" />
    case 'SKIPPED':
      return <MinusCircleIcon className="h-6 w-6 text-gray-300" />
    case 'DELEGATED':
      return <ArrowPathIcon className="h-5 w-5 text-blue-500" />
    default:
      return <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
  }
}

export default function ApprovalStatus({ contentType, objectId, compact = false }: ApprovalStatusProps) {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [actionTarget, setActionTarget] = useState<string | null>(null)
  const [comments, setComments] = useState('')

  const { data: instance, isLoading, error } = useQuery<ApprovalInstance>({
    queryKey: ['approval-status', contentType, objectId],
    queryFn: () => getObjectApprovalStatus(contentType, objectId),
    retry: false,
  })

  const actionMutation = useMutation({
    mutationFn: (params: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      processApproval(params.id, { action: params.action, comments }),
    onSuccess: (_, vars) => {
      toast.success(vars.action === 'APPROVE' ? 'Approved successfully' : 'Rejected')
      queryClient.invalidateQueries({ queryKey: ['approval-status', contentType, objectId] })
      queryClient.invalidateQueries({ queryKey: ['my-pending-approvals'] })
      setActionTarget(null)
      setComments('')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Action failed')
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <ArrowPathIcon className="h-4 w-4 animate-spin" />
        Loading approval status...
      </div>
    )
  }

  if (error || !instance) {
    return null // No workflow for this object — don't render anything
  }

  const requests = instance.approval_requests || []

  // Sort by level_number, deduplicate (keep latest per level)
  const byLevel = new Map<number, PendingApproval>()
  for (const r of [...requests].sort((a, b) => {
    if (a.level_number !== b.level_number) return a.level_number - b.level_number
    return new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
  })) {
    if (!byLevel.has(r.level_number)) {
      byLevel.set(r.level_number, r)
    }
  }
  const steps = Array.from(byLevel.values())

  const currentUserPending = requests.find(
    (r) => r.status === 'PENDING' && r.assigned_to === user?.id
  )

  return (
    <div className="space-y-3">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Approval Status
        </span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            instance.status === 'COMPLETED'
              ? 'bg-green-100 text-green-800'
              : instance.status === 'REJECTED'
              ? 'bg-red-100 text-red-800'
              : instance.status === 'CANCELLED'
              ? 'bg-gray-100 text-gray-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {instance.status}
        </span>
      </div>

      {/* Horizontal stepper */}
      <div className="flex items-start gap-0 overflow-x-auto pb-1">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-start flex-shrink-0">
            {/* Step */}
            <div className="flex flex-col items-center min-w-[100px]">
              <StepIcon status={step.status} />
              <span className="text-xs font-medium text-gray-700 mt-1 text-center leading-tight">
                {step.level_name || `Level ${step.level_number}`}
              </span>
              <span className="text-[11px] text-gray-500 text-center">
                {step.assigned_to_name || '—'}
              </span>
              {step.responded_at && (
                <span className="text-[10px] text-gray-400">{formatDate(step.responded_at)}</span>
              )}
            </div>
            {/* Connector */}
            {idx < steps.length - 1 && (
              <div className="flex items-center pt-3 px-1">
                <div
                  className={`h-0.5 w-6 ${
                    step.status === 'APPROVED' ? 'bg-green-300' : 'bg-gray-200'
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Inline actions if current user has a pending request */}
      {currentUserPending && !compact && (
        <div className="border-t pt-3 mt-2">
          {actionTarget === currentUserPending.id ? (
            <div className="space-y-2">
              <Textarea
                placeholder="Add comments (optional)..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="success"
                  onClick={() =>
                    actionMutation.mutate({ id: currentUserPending.id, action: 'APPROVE' })
                  }
                  isLoading={actionMutation.isPending}
                >
                  Confirm Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    actionMutation.mutate({ id: currentUserPending.id, action: 'REJECT' })
                  }
                  isLoading={actionMutation.isPending}
                >
                  Confirm Reject
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setActionTarget(null)
                    setComments('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="success"
                onClick={() => setActionTarget(currentUserPending.id)}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => setActionTarget(currentUserPending.id)}
              >
                Reject
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
