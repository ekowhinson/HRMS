import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  TicketIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  StarIcon,
  PaperClipIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import {
  serviceRequestService,
  ServiceRequest,
  ServiceRequestType,
  ServiceRequestPriority,
} from '@/services/selfService'
import { documentService, formatFileSize, downloadFromDataUri } from '@/services/documents'

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'default',
  SUBMITTED: 'warning',
  ACKNOWLEDGED: 'info',
  IN_PROGRESS: 'info',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  COMPLETED: 'success',
  ESCALATED: 'danger',
  CANCELLED: 'default',
}

const PRIORITY_COLORS: Record<string, 'default' | 'warning' | 'danger' | 'info' | 'success'> = {
  LOW: 'default',
  MEDIUM: 'warning',
  HIGH: 'danger',
  URGENT: 'danger',
}

const SLA_COLORS: Record<string, string> = {
  GREEN: 'text-success-600 bg-success-50',
  AMBER: 'text-warning-600 bg-warning-50',
  RED: 'text-danger-600 bg-danger-50',
}

export default function ServiceRequestsPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null)
  const [newComment, setNewComment] = useState('')
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackText, setFeedbackText] = useState('')
  const [isUploadingDocument, setIsUploadingDocument] = useState(false)
  const [formData, setFormData] = useState({
    request_type: '',
    subject: '',
    description: '',
    priority: 'MEDIUM' as ServiceRequestPriority,
  })

  // Fetch request types
  const { data: requestTypes = [] } = useQuery({
    queryKey: ['service-request-types'],
    queryFn: serviceRequestService.getTypes,
  })

  // Fetch my requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['my-service-requests'],
    queryFn: serviceRequestService.getMyRequests,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: serviceRequestService.createRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-service-requests'] })
      setIsCreateModalOpen(false)
      resetForm()
    },
  })

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: serviceRequestService.submitRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-service-requests'] })
      setIsDetailModalOpen(false)
    },
  })

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: serviceRequestService.cancelRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-service-requests'] })
      setIsDetailModalOpen(false)
    },
  })

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      serviceRequestService.addComment(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-service-requests'] })
      setNewComment('')
      // Refresh selected request
      if (selectedRequest) {
        serviceRequestService.getRequest(selectedRequest.id).then(setSelectedRequest)
      }
    },
  })

  // Feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: ({ id, rating, feedback }: { id: string; rating: number; feedback?: string }) =>
      serviceRequestService.provideFeedback(id, rating, feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-service-requests'] })
      setIsFeedbackModalOpen(false)
      setFeedbackRating(0)
      setFeedbackText('')
    },
  })

  // Fetch documents for selected request
  const { data: documents = [], isLoading: loadingDocuments, refetch: refetchDocuments } = useQuery({
    queryKey: ['service-request-documents', selectedRequest?.id],
    queryFn: () => documentService.serviceRequestDocuments.get(selectedRequest!.id),
    enabled: !!selectedRequest?.id,
  })

  // Document upload handler
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedRequest) return

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setIsUploadingDocument(true)
    try {
      await documentService.serviceRequestDocuments.upload(selectedRequest.id, file)
      toast.success('Document uploaded successfully')
      refetchDocuments()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to upload document')
    } finally {
      setIsUploadingDocument(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Document download handler
  const handleDocumentDownload = async (docId: string, fileName: string) => {
    try {
      // Use the generic attachment download
      const doc = await documentService.downloadAttachment(docId)
      if (doc.file_url) {
        downloadFromDataUri(doc.file_url, fileName)
        toast.success('Document downloaded')
      }
    } catch (error: any) {
      toast.error('Failed to download document')
    }
  }

  // Document delete handler
  const handleDocumentDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      await documentService.serviceRequestDocuments.delete(selectedRequest!.id, docId)
      toast.success('Document deleted')
      refetchDocuments()
    } catch (error: any) {
      toast.error('Failed to delete document')
    }
  }

  const resetForm = () => {
    setFormData({
      request_type: '',
      subject: '',
      description: '',
      priority: 'MEDIUM',
    })
  }

  const handleCreate = () => {
    if (!formData.request_type || !formData.subject || !formData.description) return
    createMutation.mutate(formData)
  }

  const handleViewDetails = (request: ServiceRequest) => {
    setSelectedRequest(request)
    setIsDetailModalOpen(true)
  }

  const handleAddComment = () => {
    if (!selectedRequest || !newComment.trim()) return
    addCommentMutation.mutate({ id: selectedRequest.id, comment: newComment.trim() })
  }

  const handleProvideFeedback = () => {
    if (!selectedRequest || feedbackRating === 0) return
    feedbackMutation.mutate({
      id: selectedRequest.id,
      rating: feedbackRating,
      feedback: feedbackText || undefined,
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircleIcon className="h-5 w-5 text-success-600" />
      case 'IN_PROGRESS':
      case 'ACKNOWLEDGED':
        return <ClockIcon className="h-5 w-5 text-primary-600" />
      case 'ESCALATED':
        return <ExclamationTriangleIcon className="h-5 w-5 text-danger-600" />
      default:
        return <TicketIcon className="h-5 w-5 text-gray-600" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Requests</h1>
          <p className="text-gray-600 mt-1">Request HR services and track their progress</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <TicketIcon className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Requests</p>
              <p className="text-xl font-semibold">{requests.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <ClockIcon className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">In Progress</p>
              <p className="text-xl font-semibold">
                {requests.filter((r: ServiceRequest) =>
                  ['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_APPROVAL'].includes(r.status)
                ).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-100 rounded-lg">
              <CheckCircleIcon className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-xl font-semibold">
                {requests.filter((r: ServiceRequest) => r.status === 'COMPLETED').length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger-100 rounded-lg">
              <ExclamationTriangleIcon className="h-5 w-5 text-danger-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Escalated</p>
              <p className="text-xl font-semibold">
                {requests.filter((r: ServiceRequest) => r.is_escalated).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Requests List */}
      <Card>
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">My Requests</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center">
            <TicketIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No service requests yet</p>
            <p className="text-sm text-gray-400 mt-1">Create a request to get HR support</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {requests.map((request: ServiceRequest) => (
              <div
                key={request.id}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleViewDetails(request)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      {getStatusIcon(request.status)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{request.subject}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-500">{request.request_number}</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-sm text-gray-500">{request.request_type_name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {request.sla_status && (
                      <span className={`px-2 py-1 text-xs font-medium rounded ${SLA_COLORS[request.sla_status]}`}>
                        SLA: {request.sla_status}
                      </span>
                    )}
                    <Badge variant={PRIORITY_COLORS[request.priority] || 'default'}>
                      {request.priority}
                    </Badge>
                    <div className="text-right">
                      <Badge variant={STATUS_COLORS[request.status]}>{request.status_display}</Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create Request Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          resetForm()
        }}
        title="New Service Request"
        size="lg"
      >
        <div className="space-y-6">
          {/* Request Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Request Type *
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={formData.request_type}
              onChange={(e) => setFormData({ ...formData, request_type: e.target.value })}
            >
              <option value="">Select a request type...</option>
              {requestTypes.map((type: ServiceRequestType) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            {formData.request_type && (
              <p className="text-sm text-gray-500 mt-1">
                {requestTypes.find((t: ServiceRequestType) => t.id === formData.request_type)?.description}
              </p>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject *
            </label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Brief description of your request"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <div className="flex gap-3">
              {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as ServiceRequestPriority[]).map((priority) => (
                <button
                  key={priority}
                  onClick={() => setFormData({ ...formData, priority })}
                  className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                    formData.priority === priority
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {priority}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide detailed information about your request..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.request_type || !formData.subject || !formData.description || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Request'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedRequest(null)
          setNewComment('')
        }}
        title="Request Details"
        size="lg"
      >
        {selectedRequest && (
          <div className="space-y-6">
            {/* Status & SLA Info */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(selectedRequest.status)}
                <div>
                  <Badge variant={STATUS_COLORS[selectedRequest.status]}>{selectedRequest.status_display}</Badge>
                  {selectedRequest.assigned_to_name && (
                    <p className="text-sm text-gray-500 mt-1">Assigned to: {selectedRequest.assigned_to_name}</p>
                  )}
                </div>
              </div>
              {selectedRequest.sla_deadline && (
                <div className={`px-3 py-2 rounded-lg ${SLA_COLORS[selectedRequest.sla_status]}`}>
                  <p className="text-sm font-medium">SLA: {selectedRequest.sla_status}</p>
                  {selectedRequest.days_until_sla !== null && (
                    <p className="text-xs">
                      {selectedRequest.days_until_sla > 0
                        ? `${selectedRequest.days_until_sla} days remaining`
                        : selectedRequest.is_overdue
                        ? 'Overdue'
                        : 'Due today'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Request Info */}
            <div>
              <h3 className="font-semibold text-lg text-gray-900">{selectedRequest.subject}</h3>
              <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                <span>{selectedRequest.request_number}</span>
                <span className="text-gray-300">|</span>
                <span>{selectedRequest.request_type_name}</span>
                <span className="text-gray-300">|</span>
                <Badge variant={PRIORITY_COLORS[selectedRequest.priority] || 'default'}>
                  {selectedRequest.priority}
                </Badge>
              </div>
            </div>

            {/* Description */}
            <div>
              <p className="text-sm text-gray-500 mb-1">Description</p>
              <p className="text-gray-900 whitespace-pre-wrap">{selectedRequest.description}</p>
            </div>

            {/* Resolution (if completed) */}
            {selectedRequest.status === 'COMPLETED' && selectedRequest.resolution_notes && (
              <div className="p-4 bg-success-50 border border-success-200 rounded-lg">
                <p className="font-medium text-success-800 mb-1">Resolution</p>
                <p className="text-success-700">{selectedRequest.resolution_notes}</p>
              </div>
            )}

            {/* Rejection (if rejected) */}
            {selectedRequest.status === 'REJECTED' && selectedRequest.rejection_reason && (
              <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg">
                <p className="font-medium text-danger-800 mb-1">Rejection Reason</p>
                <p className="text-danger-700">{selectedRequest.rejection_reason}</p>
              </div>
            )}

            {/* Comments */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">
                Comments ({selectedRequest.comments?.length || 0})
              </p>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {selectedRequest.comments?.filter(c => c.is_visible_to_employee).map((comment) => (
                  <div key={comment.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <ChatBubbleLeftRightIcon className="h-4 w-4 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{comment.commented_by_name}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                        <Badge variant="default" className="text-xs">{comment.comment_type}</Badge>
                      </div>
                      <p className="text-gray-700 mt-1">{comment.comment}</p>
                    </div>
                  </div>
                ))}
                {(!selectedRequest.comments || selectedRequest.comments.filter(c => c.is_visible_to_employee).length === 0) && (
                  <p className="text-center text-gray-500 py-4">No comments yet</p>
                )}
              </div>

              {/* Add Comment */}
              {!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(selectedRequest.status) && (
                <div className="mt-4 flex gap-2">
                  <Input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1"
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || addCommentMutation.isPending}
                  >
                    <PaperAirplaneIcon className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Attachments Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">
                  Attachments ({documents.length})
                </p>
                {!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(selectedRequest.status) && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
                      onChange={handleDocumentUpload}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingDocument}
                    >
                      {isUploadingDocument ? (
                        <div className="animate-spin h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full" />
                      ) : (
                        <>
                          <PaperClipIcon className="h-4 w-4 mr-1" />
                          Attach File
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>

              {loadingDocuments ? (
                <div className="text-center py-4 text-gray-500">Loading documents...</div>
              ) : documents.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <PaperClipIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No attachments</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg border border-gray-200">
                          <DocumentTextIcon className="h-5 w-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.file_name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(doc.file_size)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDocumentDownload(doc.id, doc.file_name)}
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Download"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </button>
                        {!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(selectedRequest.status) && (
                          <button
                            onClick={() => handleDocumentDelete(doc.id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Satisfaction Rating (if completed and not yet rated) */}
            {selectedRequest.status === 'COMPLETED' && !selectedRequest.satisfaction_rating && (
              <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                <p className="font-medium text-primary-800 mb-2">How was your experience?</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDetailModalOpen(false)
                    setIsFeedbackModalOpen(true)
                  }}
                >
                  <StarIcon className="h-4 w-4 mr-2" />
                  Provide Feedback
                </Button>
              </div>
            )}

            {/* Display Rating */}
            {selectedRequest.satisfaction_rating && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-2">Your Rating</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarSolidIcon
                      key={star}
                      className={`h-5 w-5 ${
                        star <= selectedRequest.satisfaction_rating! ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                {selectedRequest.feedback && (
                  <p className="text-gray-700 mt-2">{selectedRequest.feedback}</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </Button>
              {selectedRequest.status === 'DRAFT' && (
                <>
                  <Button
                    variant="outline"
                    className="text-danger-600 hover:bg-danger-50"
                    onClick={() => cancelMutation.mutate(selectedRequest.id)}
                    disabled={cancelMutation.isPending}
                  >
                    <XMarkIcon className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={() => submitMutation.mutate(selectedRequest.id)}
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </>
              )}
              {['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(selectedRequest.status) && (
                <Button
                  variant="outline"
                  className="text-danger-600 hover:bg-danger-50"
                  onClick={() => cancelMutation.mutate(selectedRequest.id)}
                  disabled={cancelMutation.isPending}
                >
                  <XMarkIcon className="h-4 w-4 mr-2" />
                  Cancel Request
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Feedback Modal */}
      <Modal
        isOpen={isFeedbackModalOpen}
        onClose={() => {
          setIsFeedbackModalOpen(false)
          setFeedbackRating(0)
          setFeedbackText('')
        }}
        title="Provide Feedback"
        size="sm"
      >
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-gray-600 mb-4">How satisfied are you with the service?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setFeedbackRating(star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  {star <= feedbackRating ? (
                    <StarSolidIcon className="h-8 w-8 text-yellow-400" />
                  ) : (
                    <StarIcon className="h-8 w-8 text-gray-300 hover:text-yellow-300" />
                  )}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {feedbackRating === 1 && 'Very Poor'}
              {feedbackRating === 2 && 'Poor'}
              {feedbackRating === 3 && 'Average'}
              {feedbackRating === 4 && 'Good'}
              {feedbackRating === 5 && 'Excellent'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Comments (optional)
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows={3}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Share your experience..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsFeedbackModalOpen(false)
                setFeedbackRating(0)
                setFeedbackText('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProvideFeedback}
              disabled={feedbackRating === 0 || feedbackMutation.isPending}
            >
              {feedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
