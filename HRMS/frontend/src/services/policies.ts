import api from '@/lib/api'

export interface PolicyCategory {
  id: string
  name: string
  code: string
  description: string
  icon: string
  sort_order: number
  is_active: boolean
  policy_count: number
  created_at: string
  updated_at: string
}

export interface Policy {
  id: string
  title: string
  code: string
  category: string
  category_name: string
  policy_type: 'POLICY' | 'SOP' | 'GUIDELINE' | 'MANUAL' | 'CIRCULAR' | 'MEMO'
  type_display: string
  summary: string
  content?: string
  version: string
  version_notes?: string
  status: 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED'
  status_display: string
  effective_date: string | null
  review_date: string | null
  expiry_date: string | null
  published_at: string | null
  published_by?: string
  published_by_name?: string
  approved_at?: string
  approved_by?: string
  approved_by_name?: string
  requires_acknowledgement: boolean
  acknowledgement_deadline_days: number
  applies_to_all: boolean
  target_departments?: string[]
  target_divisions?: string[]
  acknowledgement_count: number
  pending_acknowledgement_count: number
  is_active: boolean
  has_attachment: boolean
  attachment_name?: string
  attachment_type?: string
  attachment_size?: number
  versions?: PolicyVersion[]
  user_acknowledged?: boolean
  created_at: string
  updated_at: string
}

export interface PolicyVersion {
  id: string
  version: string
  title: string
  content: string
  version_notes: string
  effective_date: string | null
  versioned_at: string
  versioned_by: string
  versioned_by_name: string
}

export interface PolicyAcknowledgement {
  id: string
  policy: string
  policy_code: string
  policy_title: string
  employee: string
  employee_name: string
  employee_number: string
  acknowledged_at: string
  acknowledged_version: string
  ip_address: string
  comments: string
  created_at: string
}

export interface PolicyStats {
  total_policies: number
  published_policies: number
  draft_policies: number
  total_acknowledgements: number
  pending_acknowledgements: number
  overdue_acknowledgements: number
  policies_by_category: { name: string; count: number }[]
  policies_by_type: { policy_type: string; count: number }[]
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export const policyService = {
  // Categories
  getCategories: async (params?: { active_only?: boolean }) => {
    const response = await api.get<PolicyCategory[] | { results: PolicyCategory[] }>('/policies/categories/', { params })
    const data = response.data
    return Array.isArray(data) ? data : data.results
  },

  createCategory: async (data: Partial<PolicyCategory>) => {
    const response = await api.post<PolicyCategory>('/policies/categories/', data)
    return response.data
  },

  updateCategory: async (id: string, data: Partial<PolicyCategory>) => {
    const response = await api.patch<PolicyCategory>(`/policies/categories/${id}/`, data)
    return response.data
  },

  deleteCategory: async (id: string) => {
    await api.delete(`/policies/categories/${id}/`)
  },

  // Policies
  getPolicies: async (params?: {
    category?: string
    policy_type?: string
    status?: string
    search?: string
    active_only?: boolean
    requires_acknowledgement?: boolean
    unacknowledged?: boolean
    page?: number
  }) => {
    const response = await api.get<PaginatedResponse<Policy>>('/policies/policies/', { params })
    return response.data
  },

  getPolicy: async (id: string) => {
    const response = await api.get<Policy>(`/policies/policies/${id}/`)
    return response.data
  },

  createPolicy: async (data: Partial<Policy>) => {
    const response = await api.post<Policy>('/policies/policies/', data)
    return response.data
  },

  updatePolicy: async (id: string, data: Partial<Policy>) => {
    const response = await api.patch<Policy>(`/policies/policies/${id}/`, data)
    return response.data
  },

  deletePolicy: async (id: string) => {
    await api.delete(`/policies/policies/${id}/`)
  },

  publishPolicy: async (id: string) => {
    const response = await api.post<Policy>(`/policies/policies/${id}/publish/`)
    return response.data
  },

  archivePolicy: async (id: string) => {
    const response = await api.post<Policy>(`/policies/policies/${id}/archive/`)
    return response.data
  },

  acknowledgePolicy: async (id: string, comments?: string) => {
    const response = await api.post<PolicyAcknowledgement>(
      `/policies/policies/${id}/acknowledge/`,
      { comments }
    )
    return response.data
  },

  getPolicyAcknowledgements: async (id: string, params?: { page?: number }) => {
    const response = await api.get<PaginatedResponse<PolicyAcknowledgement>>(
      `/policies/policies/${id}/acknowledgements/`,
      { params }
    )
    return response.data
  },

  getPolicyVersions: async (id: string) => {
    const response = await api.get<PolicyVersion[]>(`/policies/policies/${id}/versions/`)
    return response.data
  },

  downloadAttachment: async (id: string) => {
    const response = await api.get(`/policies/policies/${id}/download_attachment/`, {
      responseType: 'blob'
    })
    return response.data
  },

  getAttachmentBlobUrl: async (id: string): Promise<string> => {
    const response = await api.get(`/policies/policies/${id}/view_attachment/`, {
      responseType: 'blob'
    })
    return URL.createObjectURL(response.data)
  },

  getStats: async () => {
    const response = await api.get<PolicyStats>('/policies/policies/stats/')
    return response.data
  },

  getMyPendingPolicies: async () => {
    const response = await api.get<Policy[]>('/policies/policies/my_pending/')
    return response.data
  },

  // Acknowledgements
  getAcknowledgements: async (params?: { policy?: string; page?: number }) => {
    const response = await api.get<PaginatedResponse<PolicyAcknowledgement>>(
      '/policies/acknowledgements/',
      { params }
    )
    return response.data
  },

  getMyAcknowledgements: async () => {
    const response = await api.get<PolicyAcknowledgement[]>(
      '/policies/acknowledgements/my_acknowledgements/'
    )
    return response.data
  },
}

export default policyService
