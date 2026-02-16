import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import {
  ArrowLeftIcon,
  PencilIcon,
  DocumentArrowUpIcon,
  ArchiveBoxIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  UserGroupIcon,
  CalendarIcon,
  PaperClipIcon,
  EyeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { policyService, type PolicyAcknowledgement } from '@/services/policies'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'

function isViewableType(type?: string): boolean {
  if (!type) return false
  return type === 'application/pdf' || type.startsWith('image/')
}

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  UNDER_REVIEW: 'info',
  APPROVED: 'info',
  PUBLISHED: 'success',
  ARCHIVED: 'warning',
}

export default function PolicyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showAckModal, setShowAckModal] = useState(false)
  const [ackComments, setAckComments] = useState('')
  const [activeTab, setActiveTab] = useState('content')
  const [viewerBlobUrl, setViewerBlobUrl] = useState<string | null>(null)
  const [viewerLoading, setViewerLoading] = useState(false)

  // Fetch policy
  const { data: policy, isLoading } = useQuery({
    queryKey: ['policy', id],
    queryFn: () => policyService.getPolicy(id!),
    enabled: !!id,
  })

  // Fetch acknowledgements
  const { data: acknowledgements } = useQuery({
    queryKey: ['policy-acknowledgements', id],
    queryFn: () => policyService.getPolicyAcknowledgements(id!),
    enabled: !!id && activeTab === 'acknowledgements',
  })

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: () => policyService.publishPolicy(id!),
    onSuccess: () => {
      toast.success('Policy published')
      queryClient.invalidateQueries({ queryKey: ['policy', id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to publish policy')
    },
  })

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: () => policyService.archivePolicy(id!),
    onSuccess: () => {
      toast.success('Policy archived')
      queryClient.invalidateQueries({ queryKey: ['policy', id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to archive policy')
    },
  })

  // Acknowledge mutation
  const acknowledgeMutation = useMutation({
    mutationFn: (comments: string) => policyService.acknowledgePolicy(id!, comments),
    onSuccess: () => {
      toast.success('Policy acknowledged')
      queryClient.invalidateQueries({ queryKey: ['policy', id] })
      queryClient.invalidateQueries({ queryKey: ['policy-acknowledgements', id] })
      setShowAckModal(false)
      setAckComments('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to acknowledge policy')
    },
  })

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (viewerBlobUrl) URL.revokeObjectURL(viewerBlobUrl)
    }
  }, [viewerBlobUrl])

  const toggleViewer = useCallback(async () => {
    if (viewerBlobUrl) {
      URL.revokeObjectURL(viewerBlobUrl)
      setViewerBlobUrl(null)
      return
    }
    setViewerLoading(true)
    try {
      const url = await policyService.getAttachmentBlobUrl(id!)
      setViewerBlobUrl(url)
    } catch {
      toast.error('Failed to load attachment')
    } finally {
      setViewerLoading(false)
    }
  }, [id, viewerBlobUrl])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!policy) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Policy not found</p>
        <Button variant="outline" onClick={() => navigate('/admin/policies')} className="mt-4">
          Back to Policies
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/policies')}>
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{policy.title}</h1>
              <Badge variant={statusColors[policy.status]}>{policy.status_display}</Badge>
            </div>
            <p className="text-sm text-gray-500">
              {policy.code} • {policy.category_name} • Version {policy.version}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {policy.status === 'PUBLISHED' && policy.requires_acknowledgement && !policy.user_acknowledged && (
            <Button onClick={() => setShowAckModal(true)}>
              <CheckCircleIcon className="h-4 w-4 mr-2" />
              Acknowledge
            </Button>
          )}
          {policy.status === 'DRAFT' && (
            <Button
              variant="success"
              onClick={() => publishMutation.mutate()}
              isLoading={publishMutation.isPending}
            >
              <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
              Publish
            </Button>
          )}
          {policy.status === 'PUBLISHED' && (
            <Button
              variant="secondary"
              onClick={() => archiveMutation.mutate()}
              isLoading={archiveMutation.isPending}
            >
              <ArchiveBoxIcon className="h-4 w-4 mr-2" />
              Archive
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate(`/admin/policies/${id}/edit`)}>
            <PencilIcon className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-md">
                <DocumentTextIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Type</p>
                <p className="font-medium">{policy.type_display}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-md">
                <CalendarIcon className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Effective Date</p>
                <p className="font-medium">
                  {policy.effective_date
                    ? new Date(policy.effective_date).toLocaleDateString()
                    : 'Not set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-md">
                <ClockIcon className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Review Date</p>
                <p className="font-medium">
                  {policy.review_date
                    ? new Date(policy.review_date).toLocaleDateString()
                    : 'Not set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-md">
                <UserGroupIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Acknowledgements</p>
                <p className="font-medium">
                  {policy.requires_acknowledgement ? (
                    <>
                      <span className="text-green-600">{policy.acknowledgement_count}</span>
                      {' / '}
                      <span className="text-gray-600">
                        {policy.acknowledgement_count + policy.pending_acknowledgement_count}
                      </span>
                    </>
                  ) : (
                    'Not required'
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="border-b">
            <TabsList>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="acknowledgements">
                Acknowledgements ({policy.acknowledgement_count})
              </TabsTrigger>
              <TabsTrigger value="versions">Version History</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
          </CardHeader>

          <TabsContent value="content" className="p-6">
            {policy.summary && (
              <div className="mb-6 p-4 bg-gray-50 rounded-md">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Summary</h3>
                <p className="text-gray-700">{policy.summary}</p>
              </div>
            )}
            <div className="prose max-w-none">
              <ReactMarkdown>{policy.content || ''}</ReactMarkdown>
            </div>
            {policy.has_attachment && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Attachment</h3>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                  <PaperClipIcon className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-700 flex-1">{policy.attachment_name}</span>
                  {isViewableType(policy.attachment_type) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleViewer}
                      isLoading={viewerLoading}
                    >
                      <EyeIcon className="h-4 w-4 mr-1" />
                      {viewerBlobUrl ? 'Hide' : 'View'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const blob = await policyService.downloadAttachment(id!)
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = policy.attachment_name || 'attachment'
                      a.click()
                      window.URL.revokeObjectURL(url)
                    }}
                  >
                    Download
                  </Button>
                </div>
                {viewerBlobUrl && (
                  <div className="mt-3 border rounded-md overflow-hidden relative">
                    <button
                      onClick={() => {
                        URL.revokeObjectURL(viewerBlobUrl)
                        setViewerBlobUrl(null)
                      }}
                      className="absolute top-2 right-2 z-10 p-1 bg-white rounded-full hover:bg-gray-100"
                    >
                      <XMarkIcon className="h-4 w-4 text-gray-500" />
                    </button>
                    {policy.attachment_type === 'application/pdf' ? (
                      <iframe
                        src={viewerBlobUrl}
                        className="w-full h-[600px]"
                        title="Policy attachment"
                      />
                    ) : (
                      <img
                        src={viewerBlobUrl}
                        alt={policy.attachment_name || 'Attachment'}
                        className="max-w-full h-auto"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="acknowledgements" className="p-6">
            {acknowledgements?.results && acknowledgements.results.length > 0 ? (
              <div className="space-y-4">
                {acknowledgements.results.map((ack: PolicyAcknowledgement) => (
                  <div
                    key={ack.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-md"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{ack.employee_name}</p>
                      <p className="text-sm text-gray-500">{ack.employee_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-700">
                        {new Date(ack.acknowledged_at).toLocaleDateString()}{' '}
                        {new Date(ack.acknowledged_at).toLocaleTimeString()}
                      </p>
                      <p className="text-xs text-gray-500">v{ack.acknowledged_version}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No acknowledgements yet</p>
            )}
          </TabsContent>

          <TabsContent value="versions" className="p-6">
            {policy.versions && policy.versions.length > 0 ? (
              <div className="space-y-4">
                {policy.versions.map((version) => (
                  <div
                    key={version.id}
                    className="p-4 border rounded-md"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Version {version.version}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(version.versioned_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{version.title}</p>
                    {version.version_notes && (
                      <p className="text-sm text-gray-500 mt-1">{version.version_notes}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No version history</p>
            )}
          </TabsContent>

          <TabsContent value="details" className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-4">Policy Information</h3>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Code</dt>
                    <dd className="font-medium">{policy.code}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Category</dt>
                    <dd className="font-medium">{policy.category_name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Type</dt>
                    <dd className="font-medium">{policy.type_display}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Version</dt>
                    <dd className="font-medium">{policy.version}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Status</dt>
                    <dd>
                      <Badge variant={statusColors[policy.status]}>{policy.status_display}</Badge>
                    </dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-4">Dates & Publishing</h3>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Effective Date</dt>
                    <dd className="font-medium">
                      {policy.effective_date
                        ? new Date(policy.effective_date).toLocaleDateString()
                        : '-'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Review Date</dt>
                    <dd className="font-medium">
                      {policy.review_date
                        ? new Date(policy.review_date).toLocaleDateString()
                        : '-'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Published At</dt>
                    <dd className="font-medium">
                      {policy.published_at
                        ? new Date(policy.published_at).toLocaleDateString()
                        : '-'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Published By</dt>
                    <dd className="font-medium">{policy.published_by_name || '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Requires Acknowledgement</dt>
                    <dd className="font-medium">{policy.requires_acknowledgement ? 'Yes' : 'No'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Acknowledge Modal */}
      <Modal
        isOpen={showAckModal}
        onClose={() => setShowAckModal(false)}
        title="Acknowledge Policy"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            I acknowledge that I have read and understood the policy{' '}
            <strong>{policy.title}</strong>.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comments (Optional)
            </label>
            <textarea
              value={ackComments}
              onChange={(e) => setAckComments(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:bg-white hover:border-gray-400 focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] transition-colors duration-150"
              rows={3}
              placeholder="Any comments or questions..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowAckModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => acknowledgeMutation.mutate(ackComments)}
              isLoading={acknowledgeMutation.isPending}
            >
              <CheckCircleIcon className="h-4 w-4 mr-2" />
              Acknowledge
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
