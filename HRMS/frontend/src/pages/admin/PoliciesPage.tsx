import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  FunnelIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  ArchiveBoxIcon,
  DocumentArrowUpIcon,
} from '@heroicons/react/24/outline'
import { policyService, type Policy, type PolicyCategory } from '@/services/policies'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { StatsCard } from '@/components/ui/StatsCard'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  UNDER_REVIEW: 'info',
  APPROVED: 'info',
  PUBLISHED: 'success',
  ARCHIVED: 'warning',
}

const typeColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  POLICY: 'info',
  SOP: 'success',
  GUIDELINE: 'warning',
  MANUAL: 'default',
  CIRCULAR: 'danger',
  MEMO: 'default',
}

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'POLICY', label: 'Policy' },
  { value: 'SOP', label: 'SOP' },
  { value: 'GUIDELINE', label: 'Guideline' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'CIRCULAR', label: 'Circular' },
  { value: 'MEMO', label: 'Memo' },
]

export default function PoliciesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingPolicy, setDeletingPolicy] = useState<Policy | null>(null)

  // Fetch policies
  const { data: policies, isLoading } = useQuery({
    queryKey: ['policies', categoryFilter, statusFilter, typeFilter, searchQuery, currentPage],
    queryFn: () =>
      policyService.getPolicies({
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
        policy_type: typeFilter || undefined,
        search: searchQuery || undefined,
        page: currentPage,
      }),
  })

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ['policy-categories'],
    queryFn: () => policyService.getCategories(),
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['policy-stats'],
    queryFn: policyService.getStats,
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: policyService.deletePolicy,
    onSuccess: () => {
      toast.success('Policy deleted')
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      queryClient.invalidateQueries({ queryKey: ['policy-stats'] })
      setShowDeleteModal(false)
      setDeletingPolicy(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete policy')
    },
  })

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: policyService.publishPolicy,
    onSuccess: () => {
      toast.success('Policy published')
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      queryClient.invalidateQueries({ queryKey: ['policy-stats'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to publish policy')
    },
  })

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: policyService.archivePolicy,
    onSuccess: () => {
      toast.success('Policy archived')
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      queryClient.invalidateQueries({ queryKey: ['policy-stats'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to archive policy')
    },
  })

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...(categories?.map((c: PolicyCategory) => ({
      value: c.id,
      label: c.name,
    })) || []),
  ]

  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (policy: Policy) => (
        <span className="font-mono text-sm text-gray-700">{policy.code}</span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (policy: Policy) => (
        <div>
          <p className="font-medium text-gray-900">{policy.title}</p>
          <p className="text-sm text-gray-500">{policy.category_name}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (policy: Policy) => (
        <Badge variant={typeColors[policy.policy_type] || 'default'}>
          {policy.type_display}
        </Badge>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      render: (policy: Policy) => (
        <span className="text-sm text-gray-600">v{policy.version}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (policy: Policy) => (
        <Badge variant={statusColors[policy.status] || 'default'}>
          {policy.status_display}
        </Badge>
      ),
    },
    {
      key: 'acknowledgements',
      header: 'Acknowledgements',
      render: (policy: Policy) =>
        policy.requires_acknowledgement ? (
          <div className="text-sm">
            <span className="text-green-600 font-medium">{policy.acknowledgement_count}</span>
            <span className="text-gray-400"> / </span>
            <span className="text-orange-600">
              {policy.acknowledgement_count + policy.pending_acknowledgement_count}
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">N/A</span>
        ),
    },
    {
      key: 'effective_date',
      header: 'Effective Date',
      render: (policy: Policy) => (
        <span className="text-sm text-gray-600">
          {policy.effective_date
            ? new Date(policy.effective_date).toLocaleDateString()
            : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (policy: Policy) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/policies/${policy.id}`)}
            title="View Details"
          >
            <EyeIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/policies/${policy.id}/edit`)}
            title="Edit"
          >
            <PencilIcon className="h-4 w-4" />
          </Button>
          {policy.status === 'DRAFT' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => publishMutation.mutate(policy.id)}
              title="Publish"
              disabled={publishMutation.isPending}
            >
              <DocumentArrowUpIcon className="h-4 w-4 text-green-500" />
            </Button>
          )}
          {policy.status === 'PUBLISHED' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => archiveMutation.mutate(policy.id)}
              title="Archive"
              disabled={archiveMutation.isPending}
            >
              <ArchiveBoxIcon className="h-4 w-4 text-orange-500" />
            </Button>
          )}
          {policy.status === 'DRAFT' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDeletingPolicy(policy)
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Policies</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage policies, SOPs, and staff acknowledgements
          </p>
        </div>
        <Button onClick={() => navigate('/admin/policies/new')}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Policy
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Policies"
          value={stats?.total_policies || 0}
          icon={<DocumentTextIcon className="h-6 w-6" />}
        />
        <StatsCard
          title="Published"
          value={stats?.published_policies || 0}
          icon={<CheckCircleIcon className="h-6 w-6" />}
          variant="success"
        />
        <StatsCard
          title="Draft"
          value={stats?.draft_policies || 0}
          icon={<ClockIcon className="h-6 w-6" />}
          variant="warning"
        />
        <StatsCard
          title="Pending Acknowledgements"
          value={stats?.pending_acknowledgements || 0}
          icon={<DocumentTextIcon className="h-6 w-6" />}
          variant="primary"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <Select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setCurrentPage(1)
              }}
              options={categoryOptions}
            />
            <Select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value)
                setCurrentPage(1)
              }}
              options={typeOptions}
            />
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              options={statusOptions}
            />
            <Input
              placeholder="Search policies..."
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

      {/* Policies Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DocumentTextIcon className="h-5 w-5 mr-2 text-primary-500" />
            Policies & SOPs
          </CardTitle>
        </CardHeader>
        <Table
          data={policies?.results || []}
          columns={columns}
          isLoading={isLoading}
        />
        {policies && policies.count > pageSize && (
          <TablePagination
            currentPage={currentPage}
            totalPages={Math.ceil(policies.count / pageSize)}
            onPageChange={setCurrentPage}
            totalItems={policies.count}
            pageSize={pageSize}
          />
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Policy"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the policy{' '}
            <strong>{deletingPolicy?.title}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deletingPolicy && deleteMutation.mutate(deletingPolicy.id)}
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
