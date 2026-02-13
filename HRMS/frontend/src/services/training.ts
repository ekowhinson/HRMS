import api from '@/lib/api'
import type {
  PaginatedResponse,
  TrainingProgram,
  TrainingSession,
  TrainingEnrollment,
  TrainingDashboardData,
} from '@/types'

export interface TrainingProgramFilters {
  category?: string
  training_type?: string
  is_mandatory?: string
  is_active?: string
  search?: string
  page?: number
  page_size?: number
}

export interface TrainingSessionFilters {
  program?: string
  status?: string
  start_after?: string
  start_before?: string
  search?: string
  page?: number
  page_size?: number
}

export interface TrainingEnrollmentFilters {
  session?: string
  employee?: string
  status?: string
  page?: number
  page_size?: number
}

// Post-Training Report types
export interface PostTrainingReport {
  id: string
  enrollment: string
  employee_name: string
  session_title: string
  program_name: string
  key_learnings: string
  skills_acquired: string
  knowledge_application: string
  action_plan: string
  recommendations: string
  challenges: string
  overall_rating: number
  status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED'
  status_display: string
  submitted_at: string | null
  created_at: string
}

export interface PostTrainingReportCreate {
  enrollment: string
  key_learnings: string
  skills_acquired: string
  knowledge_application: string
  action_plan: string
  recommendations?: string
  challenges?: string
  overall_rating: number
}

// Training Impact Assessment types
export type ImpactRating = 'SIGNIFICANT' | 'MODERATE' | 'MINIMAL' | 'NO_CHANGE' | 'DECLINED'

export interface TrainingImpactAssessment {
  id: string
  enrollment: string
  assessor: string
  assessor_name: string
  employee_name: string
  session_title: string
  program_name: string
  assessment_date: string
  assessment_period_start: string
  assessment_period_end: string
  performance_before: string
  performance_after: string
  skills_application: string
  skills_application_rating: number
  impact_rating: ImpactRating
  impact_rating_display: string
  recommendations: string
  follow_up_actions: string
  further_training_needed: boolean
  further_training_details: string
  overall_effectiveness_score: number
  status: 'DRAFT' | 'SUBMITTED'
  status_display: string
  submitted_at: string | null
  created_at: string
}

export interface TrainingImpactAssessmentCreate {
  enrollment: string
  assessment_date: string
  assessment_period_start: string
  assessment_period_end: string
  performance_before: string
  performance_after: string
  skills_application: string
  skills_application_rating: number
  impact_rating: ImpactRating
  recommendations?: string
  follow_up_actions?: string
  further_training_needed?: boolean
  further_training_details?: string
  overall_effectiveness_score: number
}

export const trainingService = {
  // Programs
  getPrograms: async (filters: TrainingProgramFilters = {}): Promise<PaginatedResponse<TrainingProgram>> => {
    const response = await api.get('/training/programs/', { params: filters })
    return response.data
  },

  getProgram: async (id: string): Promise<TrainingProgram> => {
    const response = await api.get(`/training/programs/${id}/`)
    return response.data
  },

  createProgram: async (data: Partial<TrainingProgram>): Promise<TrainingProgram> => {
    const response = await api.post('/training/programs/', data)
    return response.data
  },

  updateProgram: async (id: string, data: Partial<TrainingProgram>): Promise<TrainingProgram> => {
    const response = await api.patch(`/training/programs/${id}/`, data)
    return response.data
  },

  deleteProgram: async (id: string): Promise<void> => {
    await api.delete(`/training/programs/${id}/`)
  },

  getProgramStats: async () => {
    const response = await api.get('/training/programs/stats/')
    return response.data
  },

  getProgramSessions: async (id: string): Promise<TrainingSession[]> => {
    const response = await api.get(`/training/programs/${id}/sessions/`)
    return response.data
  },

  // Sessions
  getSessions: async (filters: TrainingSessionFilters = {}): Promise<PaginatedResponse<TrainingSession>> => {
    const response = await api.get('/training/sessions/', { params: filters })
    return response.data
  },

  getSession: async (id: string): Promise<TrainingSession> => {
    const response = await api.get(`/training/sessions/${id}/`)
    return response.data
  },

  createSession: async (data: Partial<TrainingSession>): Promise<TrainingSession> => {
    const response = await api.post('/training/sessions/', data)
    return response.data
  },

  updateSession: async (id: string, data: Partial<TrainingSession>): Promise<TrainingSession> => {
    const response = await api.patch(`/training/sessions/${id}/`, data)
    return response.data
  },

  deleteSession: async (id: string): Promise<void> => {
    await api.delete(`/training/sessions/${id}/`)
  },

  enrollEmployees: async (sessionId: string, employeeIds: string[]): Promise<{ enrolled: number; skipped: number }> => {
    const response = await api.post(`/training/sessions/${sessionId}/enroll/`, {
      employee_ids: employeeIds,
    })
    return response.data
  },

  markAttendance: async (sessionId: string, updates: { enrollment_id: string; status: string }[]): Promise<{ updated: number }> => {
    const response = await api.post(`/training/sessions/${sessionId}/mark_attendance/`, {
      updates,
    })
    return response.data
  },

  completeSession: async (id: string): Promise<TrainingSession> => {
    const response = await api.post(`/training/sessions/${id}/complete/`)
    return response.data
  },

  cancelSession: async (id: string): Promise<TrainingSession> => {
    const response = await api.post(`/training/sessions/${id}/cancel/`)
    return response.data
  },

  // Enrollments
  getEnrollments: async (filters: TrainingEnrollmentFilters = {}): Promise<PaginatedResponse<TrainingEnrollment>> => {
    const response = await api.get('/training/enrollments/', { params: filters })
    return response.data
  },

  updateEnrollment: async (id: string, data: Partial<TrainingEnrollment>): Promise<TrainingEnrollment> => {
    const response = await api.patch(`/training/enrollments/${id}/`, data)
    return response.data
  },

  evaluateEnrollment: async (id: string, data: { score?: number; feedback?: string }): Promise<TrainingEnrollment> => {
    const response = await api.post(`/training/enrollments/${id}/evaluate/`, data)
    return response.data
  },

  issueCertificate: async (id: string): Promise<TrainingEnrollment> => {
    const response = await api.post(`/training/enrollments/${id}/issue_certificate/`)
    return response.data
  },

  // My Enrollments (Employee Self-Service)
  getMyEnrollments: async (params: { status?: string } = {}) => {
    const response = await api.get('/training/enrollments/my_enrollments/', { params })
    return response.data
  },

  // Dashboard
  getDashboard: async (): Promise<TrainingDashboardData> => {
    const response = await api.get('/training/dashboard/')
    return response.data
  },

  // Post-Training Reports
  getPostTrainingReports: async (params: { enrollment?: string; status?: string; page?: number; page_size?: number } = {}): Promise<PaginatedResponse<PostTrainingReport>> => {
    const response = await api.get('/training/post-training-reports/', { params })
    return response.data
  },

  getPostTrainingReport: async (id: string): Promise<PostTrainingReport> => {
    const response = await api.get(`/training/post-training-reports/${id}/`)
    return response.data
  },

  createPostTrainingReport: async (data: PostTrainingReportCreate): Promise<PostTrainingReport> => {
    const response = await api.post('/training/post-training-reports/', data)
    return response.data
  },

  updatePostTrainingReport: async (id: string, data: Partial<PostTrainingReportCreate>): Promise<PostTrainingReport> => {
    const response = await api.patch(`/training/post-training-reports/${id}/`, data)
    return response.data
  },

  submitPostTrainingReport: async (id: string): Promise<PostTrainingReport> => {
    const response = await api.post(`/training/post-training-reports/${id}/submit/`)
    return response.data
  },

  getMyReports: async (params: { page?: number; page_size?: number } = {}): Promise<PaginatedResponse<PostTrainingReport>> => {
    const response = await api.get('/training/post-training-reports/my_reports/', { params })
    return response.data
  },

  // Training Impact Assessments
  getImpactAssessments: async (params: { enrollment?: string; status?: string; page?: number; page_size?: number } = {}): Promise<PaginatedResponse<TrainingImpactAssessment>> => {
    const response = await api.get('/training/impact-assessments/', { params })
    return response.data
  },

  getImpactAssessment: async (id: string): Promise<TrainingImpactAssessment> => {
    const response = await api.get(`/training/impact-assessments/${id}/`)
    return response.data
  },

  createImpactAssessment: async (data: TrainingImpactAssessmentCreate): Promise<TrainingImpactAssessment> => {
    const response = await api.post('/training/impact-assessments/', data)
    return response.data
  },

  updateImpactAssessment: async (id: string, data: Partial<TrainingImpactAssessmentCreate>): Promise<TrainingImpactAssessment> => {
    const response = await api.patch(`/training/impact-assessments/${id}/`, data)
    return response.data
  },

  submitImpactAssessment: async (id: string): Promise<TrainingImpactAssessment> => {
    const response = await api.post(`/training/impact-assessments/${id}/submit/`)
    return response.data
  },

  getMyAssessments: async (params: { page?: number; page_size?: number } = {}): Promise<PaginatedResponse<TrainingImpactAssessment>> => {
    const response = await api.get('/training/impact-assessments/my_assessments/', { params })
    return response.data
  },

  // Training Requests (Self-Service)
  getTrainingRequests: async (params: { status?: string; department?: string; page?: number; page_size?: number } = {}): Promise<any> => {
    const response = await api.get('/training/requests/', { params })
    return response.data
  },

  getTrainingRequest: async (id: string): Promise<any> => {
    const response = await api.get(`/training/requests/${id}/`)
    return response.data
  },

  createTrainingRequest: async (data: any): Promise<any> => {
    const response = await api.post('/training/requests/', data)
    return response.data
  },

  updateTrainingRequest: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/training/requests/${id}/`, data)
    return response.data
  },

  getMyTrainingRequests: async (params: { status?: string } = {}): Promise<any> => {
    const response = await api.get('/training/requests/my_requests/', { params })
    return response.data
  },

  submitTrainingRequest: async (id: string): Promise<any> => {
    const response = await api.post(`/training/requests/${id}/submit/`)
    return response.data
  },

  approveTrainingRequest: async (id: string, notes?: string): Promise<any> => {
    const response = await api.post(`/training/requests/${id}/approve/`, { review_notes: notes })
    return response.data
  },

  rejectTrainingRequest: async (id: string, notes: string): Promise<any> => {
    const response = await api.post(`/training/requests/${id}/reject/`, { review_notes: notes })
    return response.data
  },
}
