import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

// Separate axios instance — does NOT use @/lib/api (which attaches JWT tokens)
const portalApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach portal token on every request
portalApi.interceptors.request.use((config) => {
  const token = getPortalToken()
  if (token) {
    config.headers['X-Portal-Token'] = token
  }
  return config
})

// ==================== Token Management ====================

export function setPortalToken(token: string) {
  sessionStorage.setItem('portal_token', token)
}

export function getPortalToken(): string | null {
  return sessionStorage.getItem('portal_token')
}

export function clearPortalToken() {
  sessionStorage.removeItem('portal_token')
}

// ==================== Types ====================

export interface PortalApplicant {
  id: string
  applicant_number: string
  first_name: string
  last_name: string
  email: string
  vacancy: string
  vacancy_title: string
  vacancy_department: string
  vacancy_location: string | null
  status: string
  status_display: string
  application_date: string
  status_history: PortalStatusHistoryEntry[]
}

export interface PortalStatusHistoryEntry {
  id: string
  old_status: string
  new_status: string
  status_display: string
  changed_at: string
  display_message: string
}

export interface PortalOffer {
  id: string
  offer_number: string
  status: string
  status_display: string
  position: string
  department: string
  grade: string
  basic_salary: string
  allowances: string
  total_compensation: string
  compensation_notes: string
  offer_date: string
  response_deadline: string
  proposed_start_date: string
  has_offer_letter: boolean
  offer_letter_base64: string | null
  offer_letter_name: string | null
  offer_letter_mime: string | null
}

export interface PortalDocument {
  id: string
  document_type: string
  document_type_display: string
  status: string
  status_display: string
  file_name: string | null
  file_size: number | null
  rejection_reason: string
  notes?: string
  updated_at: string | null
}

export interface PortalInterview {
  id: string
  interview_type: string
  interview_type_display: string
  round_number?: number
  scheduled_date: string
  scheduled_time: string
  duration_minutes: number
  location: string
  meeting_link: string
  status: string
  status_display: string
}

export interface PortalDashboardData {
  applicant: PortalApplicant
  offer: {
    id: string
    offer_number: string
    status: string
    status_display: string
    position: string
    department: string
    basic_salary: string
    total_compensation: string
    proposed_start_date: string
    response_deadline: string
    has_offer_letter: boolean
  } | null
  documents: PortalDocument[]
  interviews: PortalInterview[]
  timeline: PortalStatusHistoryEntry[]
}

export interface PublicVacancy {
  id: string
  vacancy_number: string
  job_title: string
  position_name: string
  department_name: string
  location_name: string | null
  job_description: string
  requirements: string
  responsibilities: string
  qualifications: string
  experience_required: string
  skills_required: string
  employment_type: string
  closing_date: string | null
  salary_range_min: number | null
  salary_range_max: number | null
  show_salary: boolean
}

// ==================== Service ====================

export const applicantPortalService = {
  // Public vacancy endpoints (no token needed)
  getPublicVacancies: async (): Promise<PublicVacancy[]> => {
    const response = await portalApi.get('/recruitment/careers/')
    return response.data.results || response.data
  },

  getPublicVacancyDetail: async (slug: string): Promise<{ vacancy: PublicVacancy; url_type: string; closing_date: string | null }> => {
    const response = await portalApi.get(`/recruitment/careers/apply/${slug}/`)
    return response.data
  },

  submitApplication: async (slug: string, data: FormData): Promise<{ message: string; applicant_number: string; portal_token: string }> => {
    const response = await portalApi.post(`/recruitment/careers/apply/${slug}/submit/`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  // Portal auth
  portalLogin: async (email: string, token: string): Promise<{ applicant: PortalApplicant; token_expires_at: string }> => {
    const response = await portalApi.post('/recruitment/portal/login/', { email, token })
    return response.data
  },

  // Dashboard
  getDashboard: async (): Promise<PortalDashboardData> => {
    const response = await portalApi.get('/recruitment/portal/dashboard/')
    return response.data
  },

  // Offer
  getOffer: async (): Promise<PortalOffer> => {
    const response = await portalApi.get('/recruitment/portal/offer/')
    return response.data
  },

  acceptOffer: async (acceptanceLetter?: File): Promise<{ message: string; status: string }> => {
    const formData = new FormData()
    if (acceptanceLetter) {
      formData.append('acceptance_letter', acceptanceLetter)
    }
    const response = await portalApi.post('/recruitment/portal/offer/accept/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  declineOffer: async (reason: string): Promise<{ message: string; status: string }> => {
    const response = await portalApi.post('/recruitment/portal/offer/decline/', { reason })
    return response.data
  },

  // Documents
  getDocuments: async (): Promise<PortalDocument[]> => {
    const response = await portalApi.get('/recruitment/portal/documents/')
    return response.data
  },

  uploadDocument: async (documentType: string, file: File): Promise<PortalDocument> => {
    const formData = new FormData()
    formData.append('document_type', documentType)
    formData.append('file', file)
    const response = await portalApi.post('/recruitment/portal/documents/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  // Interviews
  getInterviews: async (): Promise<PortalInterview[]> => {
    const response = await portalApi.get('/recruitment/portal/interviews/')
    return response.data
  },
}
