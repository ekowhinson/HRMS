import api from '@/lib/api'

// ==================== Types ====================

export interface DocumentInfo {
  id: string
  name: string
  size: number
  type: string
  checksum?: string
  url?: string
  is_image?: boolean
  is_pdf?: boolean
  is_document?: boolean
}

export interface Attachment {
  id: string
  attachment_type: string
  description: string
  content_type_name: string
  object_id: string
  file_name: string
  file_size: number
  mime_type: string
  file_url?: string
  file_info?: {
    name: string
    size: number
    type: string
    checksum: string
    is_image: boolean
    is_pdf: boolean
    is_document: boolean
  }
  created_at: string
  created_by_name?: string
}

export type AttachmentType =
  | 'DOCUMENT'
  | 'IMAGE'
  | 'CERTIFICATE'
  | 'CONTRACT'
  | 'ID_CARD'
  | 'MEDICAL'
  | 'AUDIO'
  | 'VIDEO'
  | 'OTHER'

// ==================== Document Config ====================

export const DOCUMENT_CONFIG = {
  maxSize: 10 * 1024 * 1024, // 10MB
  acceptedTypes: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx',
  acceptedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
  ],
}

// ==================== Helper Functions ====================

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function isPreviewable(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf'
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : ''
}

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export function isPdf(mimeType: string): boolean {
  return mimeType === 'application/pdf'
}

export function isDocument(mimeType: string): boolean {
  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ]
  return documentTypes.includes(mimeType)
}

/**
 * Convert an Attachment API response to DocumentInfo format
 */
export function attachmentToDocumentInfo(attachment: Attachment): DocumentInfo {
  return {
    id: attachment.id,
    name: attachment.file_name,
    size: attachment.file_size,
    type: attachment.mime_type,
    checksum: attachment.file_info?.checksum,
    url: attachment.file_url,
    is_image: attachment.file_info?.is_image || isImage(attachment.mime_type),
    is_pdf: attachment.file_info?.is_pdf || isPdf(attachment.mime_type),
    is_document: attachment.file_info?.is_document || isDocument(attachment.mime_type),
  }
}

/**
 * Download a file from a data URI
 */
export function downloadFromDataUri(dataUri: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataUri
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// ==================== API Service ====================

export const documentService = {
  // ==================== Generic Attachments ====================

  /**
   * Get all attachments for a specific object
   */
  getAttachments: async (contentTypeName: string, objectId: string): Promise<Attachment[]> => {
    const response = await api.get('/core/attachments/', {
      params: { content_type_name: contentTypeName, object_id: objectId }
    })
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load attachments')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  /**
   * Get a single attachment with file data
   */
  getAttachment: async (id: string): Promise<Attachment> => {
    const response = await api.get(`/core/attachments/${id}/`)
    return response.data
  },

  /**
   * Upload an attachment for an object
   */
  uploadAttachment: async (
    contentTypeName: string,
    objectId: string,
    file: File,
    attachmentType: AttachmentType = 'DOCUMENT',
    description?: string
  ): Promise<Attachment> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('content_type_name', contentTypeName)
    formData.append('object_id', objectId)
    formData.append('attachment_type', attachmentType)
    if (description) {
      formData.append('description', description)
    }

    const response = await api.post('/core/attachments/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  /**
   * Delete an attachment
   */
  deleteAttachment: async (id: string): Promise<void> => {
    await api.delete(`/core/attachments/${id}/`)
  },

  /**
   * Download an attachment
   * Returns the attachment with file_url (data URI)
   */
  downloadAttachment: async (id: string): Promise<Attachment> => {
    const response = await api.get(`/core/attachments/${id}/`)
    return response.data
  },

  // ==================== Model-Specific Document APIs ====================

  /**
   * Upload document to a specific model endpoint
   * Used for models with their own document endpoints (leave, service requests, etc.)
   */
  uploadToModel: async (endpoint: string, file: File, additionalData?: Record<string, any>): Promise<any> => {
    const formData = new FormData()
    formData.append('file', file)
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value)
      })
    }

    const response = await api.post(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  /**
   * Get documents from a specific model endpoint
   */
  getFromModel: async (endpoint: string): Promise<any[]> => {
    const response = await api.get(endpoint)
    const data = response.data
    if (data?.success === false) throw new Error(data.error?.message || 'Failed to load documents')
    return Array.isArray(data) ? data : (data?.results || [])
  },

  /**
   * Delete document from a specific model endpoint
   */
  deleteFromModel: async (endpoint: string): Promise<void> => {
    await api.delete(endpoint)
  },

  // ==================== Leave Documents ====================

  leaveDocuments: {
    upload: async (leaveRequestId: string, file: File, documentType: string, description?: string) => {
      return documentService.uploadToModel(
        `/leave/requests/${leaveRequestId}/documents/`,
        file,
        { document_type: documentType, description }
      )
    },
    get: async (leaveRequestId: string) => {
      return documentService.getFromModel(`/leave/requests/${leaveRequestId}/documents/`)
    },
    delete: async (leaveRequestId: string, documentId: string) => {
      return documentService.deleteFromModel(`/leave/requests/${leaveRequestId}/documents/${documentId}/`)
    },
  },

  // ==================== Service Request Documents ====================

  serviceRequestDocuments: {
    upload: async (requestId: string, file: File, description?: string) => {
      return documentService.uploadToModel(
        `/employees/service-requests/${requestId}/documents/`,
        file,
        { description }
      )
    },
    get: async (requestId: string) => {
      return documentService.getFromModel(`/employees/service-requests/${requestId}/documents/`)
    },
    delete: async (requestId: string, documentId: string) => {
      return documentService.deleteFromModel(`/employees/service-requests/${requestId}/documents/${documentId}/`)
    },
  },

  // ==================== Data Update Documents ====================

  dataUpdateDocuments: {
    /**
     * Upload a document for a data update request
     */
    upload: async (dataUpdateRequestId: string, file: File, documentType: string, description?: string) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('data_update_request', dataUpdateRequestId)
      formData.append('document_type', documentType)
      if (description) {
        formData.append('description', description)
      }

      const response = await api.post('/employees/data-update-documents/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      return response.data
    },

    /**
     * Get all documents for a data update request
     */
    get: async (dataUpdateRequestId: string) => {
      const response = await api.get('/employees/data-update-documents/', {
        params: { data_update_request: dataUpdateRequestId }
      })
      const data = response.data
      if (data?.success === false) throw new Error(data.error?.message || 'Failed to load documents')
      return Array.isArray(data) ? data : (data?.results || [])
    },

    /**
     * Get a single document with file data
     */
    getOne: async (documentId: string) => {
      const response = await api.get(`/employees/data-update-documents/${documentId}/`)
      return response.data
    },

    /**
     * Download a document (returns with file_url data URI)
     */
    download: async (documentId: string) => {
      const response = await api.get(`/employees/data-update-documents/${documentId}/download/`)
      return response.data
    },

    /**
     * Delete a document
     */
    delete: async (documentId: string) => {
      await api.delete(`/employees/data-update-documents/${documentId}/`)
    },
  },
}

export default documentService
