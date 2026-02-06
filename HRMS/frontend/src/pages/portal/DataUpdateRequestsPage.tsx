import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PencilSquareIcon,
  PlusIcon,
  DocumentTextIcon,
  XMarkIcon,
  CheckIcon,
  ClockIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import { dataUpdateService, DataUpdateRequest, DataUpdateRequestType } from '@/services/selfService'

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

export default function DataUpdateRequestsPage() {
  const queryClient = useQueryClient()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<DataUpdateRequest | null>(null)
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
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['my-data-update-requests'],
    queryFn: dataUpdateService.getMyRequests,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: dataUpdateService.createRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-data-update-requests'] })
      setIsCreateModalOpen(false)
      resetForm()
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
            <div className="p-2 bg-gray-100 rounded-lg">
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
            <div className="p-2 bg-warning-100 rounded-lg">
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
            <div className="p-2 bg-success-100 rounded-lg">
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
            <div className="p-2 bg-gray-100 rounded-lg">
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
          <div className="divide-y divide-gray-200">
            {requests.map((request: DataUpdateRequest) => (
              <div
                key={request.id}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleViewDetails(request)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary-50 rounded-lg">
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
                  className={`p-3 border rounded-lg text-left transition-colors ${
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Please explain why you need to update this information..."
              />
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
              <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg">
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
              <div className="p-4 bg-success-50 border border-success-200 rounded-lg">
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
              <div className="bg-gray-50 rounded-lg p-4">
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
