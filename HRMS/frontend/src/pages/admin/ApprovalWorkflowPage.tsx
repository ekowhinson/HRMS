/**
 * Admin page for configuring Approval Workflows.
 * Create/edit workflow definitions with up to 5 approval levels.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { Card } from '@/components/ui/Card'
import { TablePagination } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Modal from '@/components/ui/Modal'
import {
  getWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  getApproverTypes,
  getContentTypes,
  type ApprovalWorkflow,
  type ApprovalWorkflowDetail,
  type ApprovalLevelInput,
  type ApproverTypeOption,
  type ContentTypeOption,
  type WorkflowCreateInput,
} from '@/services/approval'

const emptyLevel = (num: number): ApprovalLevelInput => ({
  level: num,
  name: '',
  approver_type: 'SUPERVISOR',
  can_skip: false,
  skip_if_same_as_previous: true,
  allow_self_approval: false,
})

export default function ApprovalWorkflowPage() {
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Form state
  const [formData, setFormData] = useState<WorkflowCreateInput>({
    code: '',
    name: '',
    description: '',
    content_type_key: '',
    is_active: true,
    approval_levels: [emptyLevel(1)],
  })

  // ── Data ────────────────────────────────────────────────────

  const { data: workflows = [], isLoading } = useQuery<ApprovalWorkflow[]>({
    queryKey: ['approval-workflows'],
    queryFn: () => getWorkflows(),
  })

  const { data: approverTypes = [] } = useQuery<ApproverTypeOption[]>({
    queryKey: ['approver-types'],
    queryFn: getApproverTypes,
  })

  const { data: contentTypes = [] } = useQuery<ContentTypeOption[]>({
    queryKey: ['workflow-content-types'],
    queryFn: getContentTypes,
  })

  // ── Expanded row detail ─────────────────────────────────────

  const DetailRow = ({ workflowId }: { workflowId: string }) => {
    const { data: detail, isLoading: detailLoading } = useQuery<ApprovalWorkflowDetail>({
      queryKey: ['approval-workflow', workflowId],
      queryFn: () => getWorkflow(workflowId),
    })

    if (detailLoading) return <div className="p-4 text-sm text-gray-500">Loading...</div>
    if (!detail) return null

    return (
      <div className="bg-gray-50 border-t px-6 py-4 space-y-3">
        <div className="text-sm text-gray-600">
          <span className="font-medium">Module:</span> {detail.content_type_display}
        </div>
        {detail.description && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">Description:</span> {detail.description}
          </div>
        )}
        <div className="text-sm font-medium text-gray-700 mt-2">Approval Chain:</div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {detail.approval_levels.length === 0 ? (
            <span className="text-sm text-gray-400 italic">No levels configured</span>
          ) : (
            detail.approval_levels
              .sort((a, b) => a.level - b.level)
              .map((level, idx) => (
                <div key={level.id} className="flex items-center gap-2">
                  <div className="flex-shrink-0 bg-white border rounded-lg px-3 py-2 shadow-sm min-w-[140px]">
                    <div className="text-xs text-gray-400">Level {level.level}</div>
                    <div className="text-sm font-medium text-gray-800">{level.name}</div>
                    <div className="text-xs text-gray-500">{level.approver_type_display}</div>
                    {level.approver_role_name && (
                      <div className="text-xs text-blue-600">Role: {level.approver_role_name}</div>
                    )}
                    {level.approver_user_name && (
                      <div className="text-xs text-blue-600">User: {level.approver_user_name}</div>
                    )}
                    <div className="flex gap-1 mt-1">
                      {level.can_skip && <Badge variant="default">Skippable</Badge>}
                      {level.skip_if_same_as_previous && <Badge variant="default">Auto-skip</Badge>}
                    </div>
                  </div>
                  {idx < detail.approval_levels.length - 1 && (
                    <span className="text-gray-300 text-lg flex-shrink-0">&rarr;</span>
                  )}
                </div>
              ))
          )}
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleEdit(detail)}
          >
            <PencilIcon className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDelete(detail.id)}
          >
            <TrashIcon className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>
    )
  }

  // ── Mutations ───────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: WorkflowCreateInput) => createWorkflow(data),
    onSuccess: () => {
      toast.success('Workflow created')
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] })
      closeModal()
    },
    onError: (err: any) => {
      const detail = err?.response?.data
      if (typeof detail === 'object') {
        const msgs = Object.values(detail).flat().join(', ')
        toast.error(msgs || 'Failed to create workflow')
      } else {
        toast.error('Failed to create workflow')
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WorkflowCreateInput> }) =>
      updateWorkflow(id, data),
    onSuccess: () => {
      toast.success('Workflow updated')
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] })
      queryClient.invalidateQueries({ queryKey: ['approval-workflow'] })
      closeModal()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to update workflow')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWorkflow(id),
    onSuccess: () => {
      toast.success('Workflow deleted')
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to delete workflow')
    },
  })

  // ── Handlers ────────────────────────────────────────────────

  const handleEdit = (detail: ApprovalWorkflowDetail) => {
    setEditingId(detail.id)
    setFormData({
      code: detail.code,
      name: detail.name,
      description: detail.description || '',
      content_type_key: detail.content_type_display,
      is_active: detail.is_active,
      approval_levels: detail.approval_levels.length > 0
        ? detail.approval_levels.map((l) => ({
            level: l.level,
            name: l.name,
            description: l.description,
            approver_type: l.approver_type,
            approver_role: l.approver_role,
            approver_user: l.approver_user,
            can_skip: l.can_skip,
            skip_if_same_as_previous: l.skip_if_same_as_previous,
            allow_self_approval: l.allow_self_approval,
          }))
        : [emptyLevel(1)],
    })
    setShowModal(true)
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this workflow?')) {
      deleteMutation.mutate(id)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setFormData({
      code: '',
      name: '',
      description: '',
      content_type_key: '',
      is_active: true,
      approval_levels: [emptyLevel(1)],
    })
  }

  const handleSubmit = () => {
    if (!formData.name || !formData.code || !formData.content_type_key) {
      toast.error('Please fill in name, code, and module')
      return
    }
    if (!formData.approval_levels || formData.approval_levels.length === 0) {
      toast.error('At least one approval level is required')
      return
    }
    for (const level of formData.approval_levels) {
      if (!level.name) {
        toast.error(`Level ${level.level} needs a name`)
        return
      }
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const addLevel = () => {
    const levels = formData.approval_levels || []
    if (levels.length >= 5) {
      toast.error('Maximum 5 approval levels')
      return
    }
    setFormData({
      ...formData,
      approval_levels: [...levels, emptyLevel(levels.length + 1)],
    })
  }

  const removeLevel = (idx: number) => {
    const levels = [...(formData.approval_levels || [])]
    levels.splice(idx, 1)
    // Renumber
    const renumbered = levels.map((l, i) => ({ ...l, level: i + 1 }))
    setFormData({ ...formData, approval_levels: renumbered })
  }

  const updateLevel = (idx: number, field: string, value: any) => {
    const levels = [...(formData.approval_levels || [])]
    levels[idx] = { ...levels[idx], [field]: value }
    setFormData({ ...formData, approval_levels: levels })
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Workflows</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure multi-level approval chains for HR modules
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <PlusIcon className="h-4 w-4 mr-1" />
          New Workflow
        </Button>
      </div>

      {/* Workflows Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Module
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Levels
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                    Loading workflows...
                  </td>
                </tr>
              ) : workflows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                    No workflows configured yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                workflows.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((wf) => (
                  <>
                    <tr
                      key={wf.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === wf.id ? null : wf.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{wf.name}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 font-mono">{wf.code}</td>
                      <td className="px-6 py-4">
                        <Badge variant="info">{wf.content_type_display}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{wf.level_count} levels</td>
                      <td className="px-6 py-4">
                        <Badge variant={wf.is_active ? 'success' : 'default'}>
                          {wf.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {expandedId === wf.id ? (
                          <ChevronUpIcon className="h-4 w-4 text-gray-400 inline" />
                        ) : (
                          <ChevronDownIcon className="h-4 w-4 text-gray-400 inline" />
                        )}
                      </td>
                    </tr>
                    {expandedId === wf.id && (
                      <tr key={`${wf.id}-detail`}>
                        <td colSpan={6} className="p-0">
                          <DetailRow workflowId={wf.id} />
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
        {workflows.length > pageSize && (
          <TablePagination
            currentPage={currentPage}
            totalPages={Math.ceil(workflows.length / pageSize)}
            totalItems={workflows.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingId ? 'Edit Workflow' : 'Create Approval Workflow'}
        size="lg"
      >
        <div className="space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Workflow Name"
              placeholder="e.g. Leave Approval - Head Office"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Code"
              placeholder="e.g. LEAVE_HO"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
              disabled={!!editingId}
            />
          </div>

          <Select
            label="Module (Content Type)"
            value={formData.content_type_key}
            onChange={(e) => setFormData({ ...formData, content_type_key: e.target.value })}
            placeholder="Select module..."
            options={contentTypes.map((ct) => ({ value: ct.key, label: ct.label }))}
          />

          <Textarea
            label="Description"
            placeholder="Describe this workflow..."
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.is_active ?? true}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Active
          </label>

          {/* Approval Levels */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Approval Levels ({formData.approval_levels?.length || 0}/5)
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={addLevel}
                disabled={(formData.approval_levels?.length || 0) >= 5}
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Level
              </Button>
            </div>

            <div className="space-y-4">
              {(formData.approval_levels || []).map((level, idx) => (
                <div key={idx} className="border rounded-lg p-4 bg-gray-50 relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase">
                      Level {level.level}
                    </span>
                    {(formData.approval_levels?.length || 0) > 1 && (
                      <button
                        onClick={() => removeLevel(idx)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Level Name"
                      placeholder="e.g. Supervisor Review"
                      value={level.name}
                      onChange={(e) => updateLevel(idx, 'name', e.target.value)}
                      required
                    />
                    <Select
                      label="Approver Type"
                      value={level.approver_type}
                      onChange={(e) => updateLevel(idx, 'approver_type', e.target.value)}
                      options={approverTypes.map((t) => ({ value: t.value, label: t.label }))}
                    />
                  </div>

                  {/* Conditional fields based on approver type */}
                  {level.approver_type === 'ROLE' && (
                    <div className="mt-3">
                      <Input
                        label="Role ID"
                        placeholder="Enter role UUID"
                        value={level.approver_role || ''}
                        onChange={(e) => updateLevel(idx, 'approver_role', e.target.value || null)}
                      />
                    </div>
                  )}
                  {level.approver_type === 'USER' && (
                    <div className="mt-3">
                      <Input
                        label="User ID"
                        placeholder="Enter user UUID"
                        value={level.approver_user || ''}
                        onChange={(e) => updateLevel(idx, 'approver_user', e.target.value || null)}
                      />
                    </div>
                  )}
                  {level.approver_type === 'DYNAMIC' && (
                    <div className="mt-3">
                      <Input
                        label="Field Path"
                        placeholder="e.g. supervisor.user"
                        value={level.approver_field || ''}
                        onChange={(e) => updateLevel(idx, 'approver_field', e.target.value)}
                      />
                    </div>
                  )}

                  {/* Config toggles */}
                  <div className="flex flex-wrap gap-4 mt-3">
                    <label className="flex items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={level.can_skip ?? false}
                        onChange={(e) => updateLevel(idx, 'can_skip', e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      Can skip
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={level.skip_if_same_as_previous ?? true}
                        onChange={(e) => updateLevel(idx, 'skip_if_same_as_previous', e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      Skip if same as previous
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={level.allow_self_approval ?? false}
                        onChange={(e) => updateLevel(idx, 'allow_self_approval', e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      Allow self-approval
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? 'Update Workflow' : 'Create Workflow'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
