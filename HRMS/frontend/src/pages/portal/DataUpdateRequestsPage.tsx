import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PencilSquareIcon,
  PlusIcon,
  DocumentTextIcon,
  XMarkIcon,
  CheckIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PaperClipIcon,
  ArrowDownTrayIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { Card } from '@/components/ui/Card'
import { TablePagination } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import { dataUpdateService, DataUpdateRequest, DataUpdateRequestType } from '@/services/selfService'
import { documentService, formatFileSize, downloadFromDataUri } from '@/services/documents'

const REQUEST_TYPE_OPTIONS: { value: DataUpdateRequestType; label: string; description: string }[] = [
  { value: 'BANK_DETAILS', label: 'Bank Details', description: 'Update your bank account information' },
  { value: 'NAME_CHANGE', label: 'Name Change', description: 'Request a legal name change' },
  { value: 'ADDRESS', label: 'Address', description: 'Update your residential address' },
  { value: 'CONTACT', label: 'Contact Information', description: 'Update phone or email' },
  { value: 'EMERGENCY_CONTACT', label: 'Emergency Contact', description: 'Update emergency contact details' },
  { value: 'DEPENDENT', label: 'Dependent Information', description: 'Add or update dependent details' },
  { value: 'PERSONAL', label: 'Personal Information', description: 'Update other personal details' },
  { value: 'EDUCATION', label: 'Education/Qualifications', description: 'Add new qualifications or certificates' },
]

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'default',
  PENDING: 'warning',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
}

// Document type options for data update requests
const DOCUMENT_TYPE_OPTIONS = [
  { value: 'SUPPORTING_DOCUMENT', label: 'Supporting Document' },
  { value: 'ID_DOCUMENT', label: 'ID Document' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'OTHER', label: 'Other' },
]

export default function DataUpdateRequestsPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<DataUpdateRequest | null>(null)
  const [isUploadingDocument, setIsUploadingDocument] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState('SUPPORTING_DOCUMENT')
  const [formData, setFormData] = useState<{
    request_type: DataUpdateRequestType | ''
    reason: string
    new_values: Record<string, string>
  }>({
    request_type: '',
    reason: '',
    new_values: {},
  })

  // Fetch my requests
  const { data: requestsData, isLoading } = useQuery({
    queryKey: ['my-data-update-requests', page, pageSize],
    queryFn: () => dataUpdateService.getMyRequests({ page, page_size: pageSize }),
  })
  const requests: DataUpdateRequest[] = requestsData?.results || (Array.isArray(requestsData) ? requestsData : [])
  const totalItems = requestsData?.count || requests.length
  const totalPages = Math.ceil(totalItems / pageSize)

  // Create mutation
  const createMutation = useMutation({
    mutationFn: dataUpdateService.createRequest,
    onSuccess: (newRequest) => {
      queryClient.invalidateQueries({ queryKey: ['my-data-update-requests'] })
      setIsCreateModalOpen(false)
      resetForm()
      // Automatically open detail modal so user can attach documents
      if (newRequest) {
        setSelectedRequest(newRequest)
        setIsDetailModalOpen(true)
        toast.success('Request created! You can now attach supporting documents.')
      }
    },
  })

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: dataUpdateService.submitRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-data-update-requests'] })
      setIsDetailModalOpen(false)
    },
  })

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: dataUpdateService.cancelRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-data-update-requests'] })
      setIsDetailModalOpen(false)
    },
  })

  // Fetch documents for selected request
  const { data: documents = [], isLoading: loadingDocuments, refetch: refetchDocuments } = useQuery({
    queryKey: ['data-update-documents', selectedRequest?.id],
    queryFn: () => documentService.dataUpdateDocuments.get(selectedRequest!.id),
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
      await documentService.dataUpdateDocuments.upload(
        selectedRequest.id,
        file,
        selectedDocType
      )
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
      const doc = await documentService.dataUpdateDocuments.download(docId)
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
      await documentService.dataUpdateDocuments.delete(docId)
      toast.success('Document deleted')
      refetchDocuments()
    } catch (error: any) {
      toast.error('Failed to delete document')
    }
  }

  const resetForm = () => {
    setFormData({
      request_type: '',
      reason: '',
      new_values: {},
    })
  }

  const handleCreate = () => {
    if (!formData.request_type || !formData.reason) return
    createMutation.mutate({
      request_type: formData.request_type,
      reason: formData.reason,
      new_values: formData.new_values,
    })
  }

  const handleViewDetails = (request: DataUpdateRequest) => {
    setSelectedRequest(request)
    setIsDetailModalOpen(true)
  }

  const getFieldsForType = (type: DataUpdateRequestType): string[] => {
    switch (type) {
      case 'BANK_DETAILS':
        return ['bank_name', 'bank_branch', 'account_number', 'account_name']
      case 'NAME_CHANGE':
        return ['first_name', 'middle_name', 'last_name', 'reason_for_change']
      case 'ADDRESS':
        return ['street_address', 'city', 'region', 'postal_code', 'country']
      case 'CONTACT':
        return ['phone_number', 'personal_email', 'alternate_phone']
      case 'EMERGENCY_CONTACT':
        return ['contact_name', 'relationship', 'phone', 'address']
      case 'DEPENDENT':
        return ['dependent_name', 'relationship', 'date_of_birth', 'gender']
      case 'PERSONAL':
        return ['marital_status', 'nationality', 'religion']
      case 'EDUCATION':
        return ['qualification', 'institution', 'year_completed', 'grade']
      default:
        return []
    }
  }

  const formatFieldLabel = (field: string): string => {
    return field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Update Requests</h1>
          <p className="text-gray-600 mt-1">Request changes to your personal information</p>
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
            <div className="p-2 bg-gray-100 rounded-md">
              <DocumentTextIcon className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Requests</p>
              <p className="text-xl font-semibold">{requests.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-100 rounded-md">
              <ClockIcon className="h-5 w-5 text-warning-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-xl font-semibold">
                {requests.filter((r: DataUpdateRequest) => ['PENDING', 'UNDER_REVIEW'].includes(r.status)).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-100 rounded-md">
              <CheckIcon className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Approved</p>
              <p className="text-xl font-semibold">
                {requests.filter((r: DataUpdateRequest) => r.status === 'APPROVED').length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-md">
              <PencilSquareIcon className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Drafts</p>
              <p className="text-xl font-semibold">
                {requests.filter((r: DataUpdateRequest) => r.status === 'DRAFT').length}
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
            <DocumentTextIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No data update requests yet</p>
            <p className="text-sm text-gray-400 mt-1">Create a request to update your personal information</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200">
              {requests.map((request: DataUpdateRequest) => (
                <div
                  key={request.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleViewDetails(request)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary-50 rounded-md">
                        <PencilSquareIcon className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{request.request_type_display}</p>
                        <p className="text-sm text-gray-500">{request.request_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Badge variant={STATUS_COLORS[request.status]}>{request.status_display}</Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  {request.reason && (
                    <p className="text-sm text-gray-600 mt-2 ml-12 line-clamp-1">{request.reason}</p>
                  )}
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
              />
            )}
          </>
        )}
      </Card>

      {/* Create Request Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          resetForm()
        }}
        title="New Data Update Request"
        size="lg"
      >
        <div className="space-y-6">
          {/* Step 1: Select Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What would you like to update?
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {REQUEST_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFormData({ ...formData, request_type: option.value, new_values: {} })}
                  className={`p-3 border rounded-md text-left transition-colors duration-150 ${
                    formData.request_type === option.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-gray-900">{option.label}</p>
                  <p className="text-sm text-gray-500">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Enter New Values */}
          {formData.request_type && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter new information
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getFieldsForType(formData.request_type).map((field) => (
                  <div key={field}>
                    <label className="block text-sm text-gray-600 mb-1">{formatFieldLabel(field)}</label>
                    <Input
                      value={formData.new_values[field] || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData({
                          ...formData,
                          new_values: { ...formData.new_values, [field]: e.target.value },
                        })
                      }
                      placeholder={`Enter ${formatFieldLabel(field).toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reason */}
          {formData.request_type && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for this request
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] transition-colors duration-150"
                rows={3}
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Please explain why you need to update this information..."
              />
            </div>
          )}

          {/* Document Note */}
          {formData.request_type && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-start gap-2">
                <PaperClipIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-700">
                  After creating this request, you'll be able to attach supporting documents such as ID cards, bank statements, or certificates.
                </p>
              </div>
            </div>
          )}

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
              disabled={!formData.request_type || !formData.reason || createMutation.isPending}
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
        }}
        title="Request Details"
        size="lg"
      >
        {selectedRequest && (
          <div className="space-y-6">
            {/* Status Banner */}
            {selectedRequest.status === 'REJECTED' && selectedRequest.rejection_reason && (
              <div className="p-4 bg-danger-50 border border-danger-200 rounded-md">
                <div className="flex items-start gap-3">
                  <ExclamationCircleIcon className="h-5 w-5 text-danger-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-danger-800">Request Rejected</p>
                    <p className="text-sm text-danger-700 mt-1">{selectedRequest.rejection_reason}</p>
                  </div>
                </div>
              </div>
            )}

            {selectedRequest.status === 'APPROVED' && (
              <div className="p-4 bg-success-50 border border-success-200 rounded-md">
                <div className="flex items-start gap-3">
                  <CheckIcon className="h-5 w-5 text-success-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-success-800">Request Approved</p>
                    {selectedRequest.review_comments && (
                      <p className="text-sm text-success-700 mt-1">{selectedRequest.review_comments}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Request Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Request Number</p>
                <p className="font-medium">{selectedRequest.request_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Type</p>
                <p className="font-medium">{selectedRequest.request_type_display}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={STATUS_COLORS[selectedRequest.status]}>{selectedRequest.status_display}</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="font-medium">{new Date(selectedRequest.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Reason */}
            <div>
              <p className="text-sm text-gray-500 mb-1">Reason</p>
              <p className="text-gray-900">{selectedRequest.reason}</p>
            </div>

            {/* New Values */}
            <div>
              <p className="text-sm text-gray-500 mb-2">Requested Changes</p>
              <div className="bg-gray-50 rounded-md p-4">
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(selectedRequest.new_values).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-xs text-gray-500">{formatFieldLabel(key)}</p>
                      <p className="font-medium">{value as string || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Supporting Documents Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">Supporting Documents</p>
                {['DRAFT', 'PENDING'].includes(selectedRequest.status) && (
                  <div className="flex items-center gap-2">
                    <select
                      className="text-sm border border-gray-300 rounded-md px-2 py-1"
                      value={selectedDocType}
                      onChange={(e) => setSelectedDocType(e.target.value)}
                    >
                      {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
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
                          Attach
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {loadingDocuments ? (
                <div className="text-center py-4 text-gray-500">Loading documents...</div>
              ) : documents.length === 0 ? (
                <div className="bg-gray-50 rounded-md p-4 text-center">
                  <PaperClipIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No documents attached</p>
                  {['DRAFT', 'PENDING'].includes(selectedRequest.status) && (
                    <p className="text-xs text-gray-400 mt-1">
                      Upload supporting documents like ID cards, bank statements, or certificates
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-md border border-gray-200">
                          <DocumentTextIcon className="h-5 w-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.file_name}</p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(doc.file_size)} • {doc.document_type_display || doc.document_type}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDocumentDownload(doc.id, doc.file_name)}
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors duration-150"
                          title="Download"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </button>
                        {['DRAFT', 'PENDING'].includes(selectedRequest.status) && (
                          <button
                            onClick={() => handleDocumentDelete(doc.id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors duration-150"
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
                    Cancel Request
                  </Button>
                  <Button
                    onClick={() => submitMutation.mutate(selectedRequest.id)}
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending ? 'Submitting...' : 'Submit for Review'}
                  </Button>
                </>
              )}
              {['PENDING', 'UNDER_REVIEW'].includes(selectedRequest.status) && (
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
    </div>
  )
}
