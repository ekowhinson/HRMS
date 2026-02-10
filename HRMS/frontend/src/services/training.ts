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

  // Dashboard
  getDashboard: async (): Promise<TrainingDashboardData> => {
    const response = await api.get('/training/dashboard/')
    return response.data
  },
}
