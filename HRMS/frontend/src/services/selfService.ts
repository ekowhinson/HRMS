import api from '@/lib/api'

// ==================== Data Update Request Types ====================

export type DataUpdateRequestType =
  | 'BANK_DETAILS'
  | 'NAME_CHANGE'
  | 'ADDRESS'
  | 'CONTACT'
  | 'EMERGENCY_CONTACT'
  | 'DEPENDENT'
  | 'PERSONAL'
  | 'EDUCATION'

export type DataUpdateRequestStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'

export interface DataUpdateDocument {
  id: string
  file_name: string
  mime_type: string
  file_size: number
  document_type: string
  document_type_display: string
  uploaded_at: string
  uploaded_by_name: string
}

export interface DataUpdateRequest {
  id: string
  request_number: string
  employee: string
  employee_name: string
  employee_number: string
  request_type: DataUpdateRequestType
  request_type_display: string
  old_values: Record<string, any>
  new_values: Record<string, any>
  reason: string
  status: DataUpdateRequestStatus
  status_display: string
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  reviewed_by_name: string | null
  review_comments: string
  rejection_reason: string
  applied_at: string | null
  applied_by: string | null
  documents: DataUpdateDocument[]
  created_at: string
  updated_at: string
}

// ==================== Service Request Types ====================

export type ServiceRequestPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type ServiceRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'ESCALATED'
  | 'CANCELLED'

export type SLAStatus = 'GREEN' | 'AMBER' | 'RED'

export interface ServiceRequestType {
  id: string
  code: string
  name: string
  description: string
  sla_days: number
  auto_response_message: string
  requires_manager_approval: boolean
  requires_hr_approval: boolean
  route_to_location_hr: boolean
  requires_document: boolean
  document_types_accepted: string
  is_active: boolean
  sort_order: number
}

export interface ServiceRequestComment {
  id: string
  comment: string
  comment_type: 'USER' | 'HR' | 'SYSTEM' | 'INTERNAL'
  comment_type_display: string
  is_visible_to_employee: boolean
  commented_by: string
  commented_by_name: string
  created_at: string
}

export interface ServiceRequestDocument {
  id: string
  file_name: string
  mime_type: string
  file_size: number
  description: string
  uploaded_at: string
  uploaded_by_name: string
}

export interface ServiceRequest {
  id: string
  request_number: string
  request_type: string
  request_type_name: string
  request_type_details: ServiceRequestType
  employee: string
  employee_name: string
  employee_number: string
  subject: string
  description: string
  priority: ServiceRequestPriority
  priority_display: string
  status: ServiceRequestStatus
  status_display: string
  sla_deadline: string | null
  sla_status: SLAStatus
  sla_status_display: string
  days_until_sla: number | null
  is_overdue: boolean
  submitted_at: string | null
  acknowledged_at: string | null
  assigned_to: string | null
  assigned_to_name: string | null
  resolved_at: string | null
  resolved_by: string | null
  resolved_by_name: string | null
  resolution_notes: string
  rejection_reason: string
  is_escalated: boolean
  escalated_at: string | null
  escalated_to: string | null
  escalated_to_name: string | null
  escalation_reason: string
  satisfaction_rating: number | null
  feedback: string
  comments: ServiceRequestComment[]
  documents: ServiceRequestDocument[]
  created_at: string
  updated_at: string
}

export interface ServiceRequestDashboard {
  total: number
  by_status: Record<string, number>
  by_priority: Record<string, number>
  by_sla_status: Record<string, number>
  overdue_count: number
  resolved_this_month: number
  avg_resolution_days: number
}

// ==================== Data Update Request Service ====================

export const dataUpdateService = {
  // Get all data update requests
  getRequests: async (params?: {
    status?: DataUpdateRequestStatus
    request_type?: DataUpdateRequestType
    employee?: string
    page?: number
  }) => {
    const response = await api.get('/employees/data-updates/', { params })
    return response.data
  },

  // Get my data update requests
  getMyRequests: async () => {
    const response = await api.get('/employees/data-updates/my_requests/')
    return response.data
  },

  // Get single request
  getRequest: async (id: string): Promise<DataUpdateRequest> => {
    const response = await api.get(`/employees/data-updates/${id}/`)
    return response.data
  },

  // Create data update request
  createRequest: async (data: {
    request_type: DataUpdateRequestType
    new_values: Record<string, any>
    reason: string
    old_values?: Record<string, any>
  }): Promise<DataUpdateRequest> => {
    const response = await api.post('/employees/data-updates/', data)
    return response.data
  },

  // Update draft request
  updateRequest: async (id: string, data: Partial<{
    new_values: Record<string, any>
    reason: string
  }>): Promise<DataUpdateRequest> => {
    const response = await api.patch(`/employees/data-updates/${id}/`, data)
    return response.data
  },

  // Submit request for review
  submitRequest: async (id: string): Promise<DataUpdateRequest> => {
    const response = await api.post(`/employees/data-updates/${id}/submit/`)
    return response.data
  },

  // Cancel request
  cancelRequest: async (id: string): Promise<void> => {
    await api.post(`/employees/data-updates/${id}/cancel/`)
  },

  // Get pending review (HR)
  getPendingReview: async () => {
    const response = await api.get('/employees/data-updates/pending_review/')
    return response.data
  },

  // Approve request (HR)
  approveRequest: async (id: string, comments?: string): Promise<DataUpdateRequest> => {
    const response = await api.post(`/employees/data-updates/${id}/approve/`, { comments })
    return response.data
  },

  // Reject request (HR)
  rejectRequest: async (id: string, reason: string): Promise<DataUpdateRequest> => {
    const response = await api.post(`/employees/data-updates/${id}/reject/`, { reason })
    return response.data
  },

  // Upload document
  uploadDocument: async (requestId: string, file: File, documentType: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', documentType)
    const response = await api.post(`/employees/data-updates/${requestId}/documents/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  // Delete document
  deleteDocument: async (requestId: string, documentId: string) => {
    await api.delete(`/employees/data-updates/${requestId}/documents/${documentId}/`)
  },
}

// ==================== Service Request Service ====================

export const serviceRequestService = {
  // Get all service request types
  getTypes: async (): Promise<ServiceRequestType[]> => {
    const response = await api.get('/employees/service-request-types/')
    return response.data.results || response.data
  },

  // Get all service requests
  getRequests: async (params?: {
    status?: ServiceRequestStatus
    priority?: ServiceRequestPriority
    sla_status?: SLAStatus
    request_type?: string
    employee?: string
    assigned_to?: string
    page?: number
  }) => {
    const response = await api.get('/employees/service-requests/', { params })
    return response.data
  },

  // Get my service requests
  getMyRequests: async () => {
    const response = await api.get('/employees/service-requests/my_requests/')
    return response.data
  },

  // Get single request
  getRequest: async (id: string): Promise<ServiceRequest> => {
    const response = await api.get(`/employees/service-requests/${id}/`)
    return response.data
  },

  // Create service request
  createRequest: async (data: {
    request_type: string
    subject: string
    description: string
    priority?: ServiceRequestPriority
  }): Promise<ServiceRequest> => {
    const response = await api.post('/employees/service-requests/', data)
    return response.data
  },

  // Update draft request
  updateRequest: async (id: string, data: Partial<{
    subject: string
    description: string
    priority: ServiceRequestPriority
  }>): Promise<ServiceRequest> => {
    const response = await api.patch(`/employees/service-requests/${id}/`, data)
    return response.data
  },

  // Submit request
  submitRequest: async (id: string): Promise<ServiceRequest> => {
    const response = await api.post(`/employees/service-requests/${id}/submit/`)
    return response.data
  },

  // Cancel request
  cancelRequest: async (id: string): Promise<void> => {
    await api.post(`/employees/service-requests/${id}/cancel/`)
  },

  // Add comment
  addComment: async (id: string, comment: string): Promise<ServiceRequestComment> => {
    const response = await api.post(`/employees/service-requests/${id}/add_comment/`, { comment })
    return response.data
  },

  // Get comments
  getComments: async (id: string): Promise<ServiceRequestComment[]> => {
    const response = await api.get(`/employees/service-requests/${id}/comments/`)
    return response.data
  },

  // Upload document
  uploadDocument: async (requestId: string, file: File, description?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (description) formData.append('description', description)
    const response = await api.post(`/employees/service-requests/${requestId}/documents/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  // Delete document
  deleteDocument: async (requestId: string, documentId: string) => {
    await api.delete(`/employees/service-requests/${requestId}/documents/${documentId}/`)
  },

  // Provide feedback
  provideFeedback: async (id: string, rating: number, feedback?: string): Promise<ServiceRequest> => {
    const response = await api.post(`/employees/service-requests/${id}/feedback/`, { rating, feedback })
    return response.data
  },

  // ==================== HR Actions ====================

  // Get requests assigned to me
  getAssignedToMe: async () => {
    const response = await api.get('/employees/service-requests/assigned_to_me/')
    return response.data
  },

  // Get pending requests
  getPending: async () => {
    const response = await api.get('/employees/service-requests/pending/')
    return response.data
  },

  // Get escalated requests
  getEscalated: async () => {
    const response = await api.get('/employees/service-requests/escalated/')
    return response.data
  },

  // Get SLA breached requests
  getSLABreached: async () => {
    const response = await api.get('/employees/service-requests/sla_breached/')
    return response.data
  },

  // Get dashboard stats
  getDashboard: async (): Promise<ServiceRequestDashboard> => {
    const response = await api.get('/employees/service-requests/dashboard/')
    return response.data
  },

  // Acknowledge request
  acknowledgeRequest: async (id: string): Promise<ServiceRequest> => {
    const response = await api.post(`/employees/service-requests/${id}/acknowledge/`)
    return response.data
  },

  // Assign request
  assignRequest: async (id: string, userId: string): Promise<ServiceRequest> => {
    const response = await api.post(`/employees/service-requests/${id}/assign/`, { user_id: userId })
    return response.data
  },

  // Start work on request
  startWork: async (id: string): Promise<ServiceRequest> => {
    const response = await api.post(`/employees/service-requests/${id}/start_work/`)
    return response.data
  },

  // Request approval
  requestApproval: async (id: string): Promise<ServiceRequest> => {
    const response = await api.post(`/employees/service-requests/${id}/request_approval/`)
    return response.data
  },

  // Approve request
  approveRequest: async (id: string): Promise<ServiceRequest> => {
    const response = await api.post(`/employees/service-requests/${id}/approve/`)
    return response.data
  },

  // Reject request
  rejectRequest: async (id: string, reason: string): Promise<ServiceRequest> => {
    const response = await api.post(`/employees/service-requests/${id}/reject/`, { reason })
    return response.data
  },

  // Resolve request
  resolveRequest: async (id: string, notes?: string): Promise<ServiceRequest> => {
    const response = await api.post(`/employees/service-requests/${id}/resolve/`, { notes })
    return response.data
  },

  // Escalate request
  escalateRequest: async (id: string, userId: string, reason: string): Promise<ServiceRequest> => {
    const response = await api.post(`/employees/service-requests/${id}/escalate/`, { user_id: userId, reason })
    return response.data
  },
}
