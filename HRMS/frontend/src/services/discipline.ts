/**
 * Discipline & Grievance API service
 */

import api from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────

export interface MisconductCategory {
  id: string
  code: string
  name: string
  description: string
  severity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'GROSS'
  recommended_action: string
  is_active: boolean
}

export interface GrievanceCategory {
  id: string
  code: string
  name: string
  description: string
  is_active: boolean
}

export interface DisciplinaryAction {
  id: string
  case: string
  action_type: string
  action_type_display: string
  action_date: string
  effective_date: string
  end_date: string | null
  description: string
  conditions: string
  suspension_days: number | null
  reduction_percentage: number | null
  reduction_duration_months: number | null
  issued_by: string | null
  issued_by_name: string
  acknowledged_by_employee: boolean
  acknowledged_date: string | null
}

export interface HearingCommitteeMember {
  id: string
  hearing: string
  employee: string
  employee_name: string
  role: 'CHAIR' | 'MEMBER' | 'HR_REP' | 'SECRETARY'
  role_display: string
  attended: boolean | null
}

export interface DisciplinaryHearing {
  id: string
  case: string
  hearing_number: number
  scheduled_date: string
  scheduled_time: string
  location: string
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'ADJOURNED' | 'CANCELLED'
  status_display: string
  employee_present: boolean | null
  employee_representation: string
  minutes: string
  findings: string
  recommendations: string
  actual_start_time: string | null
  actual_end_time: string | null
  next_hearing_date: string | null
  adjournment_reason: string
  committee_members: HearingCommitteeMember[]
}

export interface DisciplinaryEvidence {
  id: string
  case: string
  evidence_type: string
  evidence_type_display: string
  title: string
  description: string
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  has_file: boolean
  submitted_by: string | null
  submitted_by_name: string
  submitted_date: string
}

export interface DisciplinaryAppeal {
  id: string
  case: string
  appeal_number: number
  filed_date: string
  grounds_for_appeal: string
  document_name: string | null
  document_size: number | null
  document_mime: string | null
  has_document: boolean
  status: 'FILED' | 'UNDER_REVIEW' | 'HEARING_SCHEDULED' | 'DECISION_PENDING' | 'UPHELD' | 'PARTIALLY_UPHELD' | 'DISMISSED' | 'WITHDRAWN'
  status_display: string
  reviewed_by: string | null
  reviewed_by_name: string
  decision: string
  decision_date: string | null
  decision_rationale: string
}

export type DisciplinaryCaseStatus =
  | 'DRAFT' | 'REPORTED' | 'UNDER_INVESTIGATION' | 'SHOW_CAUSE_ISSUED'
  | 'SHOW_CAUSE_RECEIVED' | 'HEARING_SCHEDULED' | 'HEARING_COMPLETED'
  | 'PENDING_DECISION' | 'DECISION_ISSUED' | 'APPEAL_FILED'
  | 'CLOSED' | 'WITHDRAWN'

export interface DisciplinaryCase {
  id: string
  case_number: string
  employee: string
  employee_name: string
  employee_number: string
  misconduct_category: string
  category_name: string
  severity: string
  category_data?: MisconductCategory
  incident_date: string
  incident_location: string
  incident_description: string
  reported_date: string
  reported_by: string | null
  reported_by_name: string
  status: DisciplinaryCaseStatus
  assigned_investigator: string | null
  investigator_name: string
  hr_representative: string | null
  hr_representative_name: string
  investigation_start_date: string | null
  investigation_end_date: string | null
  investigation_findings: string
  is_substantiated: boolean | null
  show_cause_issued_date: string | null
  show_cause_response_date: string | null
  show_cause_response: string
  final_decision: string
  decision_date: string | null
  decision_by: string | null
  decision_by_name: string
  closure_date: string | null
  closure_notes: string
  actions?: DisciplinaryAction[]
  hearings?: DisciplinaryHearing[]
  evidence?: DisciplinaryEvidence[]
  appeals?: DisciplinaryAppeal[]
  created_at?: string
  updated_at?: string
}

export type GrievanceStatus =
  | 'DRAFT' | 'SUBMITTED' | 'ACKNOWLEDGED' | 'UNDER_INVESTIGATION'
  | 'MEDIATION' | 'PENDING_RESOLUTION' | 'RESOLVED' | 'ESCALATED'
  | 'CLOSED' | 'WITHDRAWN'

export type GrievancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface GrievanceNote {
  id: string
  grievance: string
  note: string
  is_internal: boolean
  added_by: string | null
  added_by_name: string
  created_at: string
}

export interface GrievanceAttachment {
  id: string
  grievance: string
  title: string
  description: string
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  has_file: boolean
  uploaded_by: string | null
  uploaded_by_name: string
  created_at: string
}

export interface Grievance {
  id: string
  grievance_number: string
  employee: string
  employee_name: string
  employee_number?: string
  category: string
  category_name: string
  category_data?: GrievanceCategory
  subject: string
  description: string
  incident_date: string | null
  desired_outcome: string
  against_employee: string | null
  against_employee_name: string
  against_department: string | null
  against_department_name: string
  against_manager: string | null
  against_manager_name: string
  status: GrievanceStatus
  priority: GrievancePriority
  is_confidential: boolean
  is_anonymous: boolean
  submitted_date: string | null
  acknowledged_date: string | null
  target_resolution_date: string | null
  resolution_date: string | null
  assigned_to: string | null
  assigned_to_name: string
  hr_representative: string | null
  hr_representative_name: string
  resolution: string
  resolution_accepted: boolean | null
  resolution_feedback: string
  escalation_level: number
  escalated_to: string | null
  escalated_to_name: string
  escalation_reason: string
  escalated_date: string | null
  notes?: GrievanceNote[]
  attachments?: GrievanceAttachment[]
  created_at?: string
  updated_at?: string
}

export interface CaseStats {
  total: number
  open: number
  by_severity: Record<string, number>
}

export interface GrievanceStats {
  total: number
  open: number
  by_priority: Record<string, number>
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ── API Service ───────────────────────────────────────────────

export const disciplineService = {
  // ── Misconduct Categories ──

  getMisconductCategories: async (): Promise<MisconductCategory[]> => {
    const response = await api.get('/discipline/misconduct-categories/')
    return Array.isArray(response.data) ? response.data : response.data.results || []
  },

  createMisconductCategory: async (data: Partial<MisconductCategory>): Promise<MisconductCategory> => {
    const response = await api.post('/discipline/misconduct-categories/', data)
    return response.data
  },

  updateMisconductCategory: async (id: string, data: Partial<MisconductCategory>): Promise<MisconductCategory> => {
    const response = await api.patch(`/discipline/misconduct-categories/${id}/`, data)
    return response.data
  },

  deleteMisconductCategory: async (id: string): Promise<void> => {
    await api.delete(`/discipline/misconduct-categories/${id}/`)
  },

  // ── Grievance Categories ──

  getGrievanceCategories: async (): Promise<GrievanceCategory[]> => {
    const response = await api.get('/discipline/grievance-categories/')
    return Array.isArray(response.data) ? response.data : response.data.results || []
  },

  createGrievanceCategory: async (data: Partial<GrievanceCategory>): Promise<GrievanceCategory> => {
    const response = await api.post('/discipline/grievance-categories/', data)
    return response.data
  },

  updateGrievanceCategory: async (id: string, data: Partial<GrievanceCategory>): Promise<GrievanceCategory> => {
    const response = await api.patch(`/discipline/grievance-categories/${id}/`, data)
    return response.data
  },

  deleteGrievanceCategory: async (id: string): Promise<void> => {
    await api.delete(`/discipline/grievance-categories/${id}/`)
  },

  // ── Disciplinary Cases ──

  getCases: async (params?: Record<string, any>): Promise<PaginatedResponse<DisciplinaryCase>> => {
    const response = await api.get('/discipline/cases/', { params })
    return response.data
  },

  getCase: async (id: string): Promise<DisciplinaryCase> => {
    const response = await api.get(`/discipline/cases/${id}/`)
    return response.data
  },

  createCase: async (data: Partial<DisciplinaryCase>): Promise<DisciplinaryCase> => {
    const response = await api.post('/discipline/cases/', data)
    return response.data
  },

  updateCase: async (id: string, data: Partial<DisciplinaryCase>): Promise<DisciplinaryCase> => {
    const response = await api.patch(`/discipline/cases/${id}/`, data)
    return response.data
  },

  getCaseStats: async (): Promise<CaseStats> => {
    const response = await api.get('/discipline/cases/stats/')
    return response.data
  },

  submitCase: async (id: string): Promise<DisciplinaryCase> => {
    const response = await api.post(`/discipline/cases/${id}/submit/`)
    return response.data
  },

  investigateCase: async (id: string, data?: { assigned_investigator?: string }): Promise<DisciplinaryCase> => {
    const response = await api.post(`/discipline/cases/${id}/investigate/`, data)
    return response.data
  },

  issueShowCause: async (id: string): Promise<DisciplinaryCase> => {
    const response = await api.post(`/discipline/cases/${id}/issue_show_cause/`)
    return response.data
  },

  receiveShowCause: async (id: string, data: { show_cause_response: string }): Promise<DisciplinaryCase> => {
    const response = await api.post(`/discipline/cases/${id}/receive_show_cause/`, data)
    return response.data
  },

  scheduleHearing: async (id: string): Promise<DisciplinaryCase> => {
    const response = await api.post(`/discipline/cases/${id}/schedule_hearing/`)
    return response.data
  },

  completeHearing: async (id: string): Promise<DisciplinaryCase> => {
    const response = await api.post(`/discipline/cases/${id}/complete_hearing/`)
    return response.data
  },

  issueDecision: async (id: string, data: { final_decision: string }): Promise<DisciplinaryCase> => {
    const response = await api.post(`/discipline/cases/${id}/issue_decision/`, data)
    return response.data
  },

  closeCase: async (id: string, data?: { closure_notes?: string }): Promise<DisciplinaryCase> => {
    const response = await api.post(`/discipline/cases/${id}/close/`, data)
    return response.data
  },

  withdrawCase: async (id: string, data?: { closure_notes?: string }): Promise<DisciplinaryCase> => {
    const response = await api.post(`/discipline/cases/${id}/withdraw/`, data)
    return response.data
  },

  // ── Case Actions ──

  getCaseActions: async (caseId: string): Promise<DisciplinaryAction[]> => {
    const response = await api.get('/discipline/actions/', { params: { case: caseId } })
    return Array.isArray(response.data) ? response.data : response.data.results || []
  },

  createAction: async (data: Partial<DisciplinaryAction>): Promise<DisciplinaryAction> => {
    const response = await api.post('/discipline/actions/', data)
    return response.data
  },

  // ── Hearings ──

  getCaseHearings: async (caseId: string): Promise<DisciplinaryHearing[]> => {
    const response = await api.get('/discipline/hearings/', { params: { case: caseId } })
    return Array.isArray(response.data) ? response.data : response.data.results || []
  },

  createHearing: async (data: Partial<DisciplinaryHearing>): Promise<DisciplinaryHearing> => {
    const response = await api.post('/discipline/hearings/', data)
    return response.data
  },

  updateHearing: async (id: string, data: Partial<DisciplinaryHearing>): Promise<DisciplinaryHearing> => {
    const response = await api.patch(`/discipline/hearings/${id}/`, data)
    return response.data
  },

  // ── Committee Members ──

  createCommitteeMember: async (data: Partial<HearingCommitteeMember>): Promise<HearingCommitteeMember> => {
    const response = await api.post('/discipline/committee-members/', data)
    return response.data
  },

  deleteCommitteeMember: async (id: string): Promise<void> => {
    await api.delete(`/discipline/committee-members/${id}/`)
  },

  // ── Evidence ──

  getCaseEvidence: async (caseId: string): Promise<DisciplinaryEvidence[]> => {
    const response = await api.get('/discipline/evidence/', { params: { case: caseId } })
    return Array.isArray(response.data) ? response.data : response.data.results || []
  },

  createEvidence: async (data: Partial<DisciplinaryEvidence>): Promise<DisciplinaryEvidence> => {
    const response = await api.post('/discipline/evidence/', data)
    return response.data
  },

  uploadEvidence: async (id: string, file: File): Promise<DisciplinaryEvidence> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post(`/discipline/evidence/${id}/upload/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  downloadEvidence: async (id: string): Promise<Blob> => {
    const response = await api.get(`/discipline/evidence/${id}/download/`, { responseType: 'blob' })
    return response.data
  },

  // ── Appeals ──

  getCaseAppeals: async (caseId: string): Promise<DisciplinaryAppeal[]> => {
    const response = await api.get('/discipline/appeals/', { params: { case: caseId } })
    return Array.isArray(response.data) ? response.data : response.data.results || []
  },

  createAppeal: async (data: Partial<DisciplinaryAppeal>): Promise<DisciplinaryAppeal> => {
    const response = await api.post('/discipline/appeals/', data)
    return response.data
  },

  // ── Grievances ──

  getGrievances: async (params?: Record<string, any>): Promise<PaginatedResponse<Grievance>> => {
    const response = await api.get('/discipline/grievances/', { params })
    return response.data
  },

  getGrievance: async (id: string): Promise<Grievance> => {
    const response = await api.get(`/discipline/grievances/${id}/`)
    return response.data
  },

  createGrievance: async (data: Partial<Grievance>): Promise<Grievance> => {
    const response = await api.post('/discipline/grievances/', data)
    return response.data
  },

  updateGrievance: async (id: string, data: Partial<Grievance>): Promise<Grievance> => {
    const response = await api.patch(`/discipline/grievances/${id}/`, data)
    return response.data
  },

  getGrievanceStats: async (): Promise<GrievanceStats> => {
    const response = await api.get('/discipline/grievances/stats/')
    return response.data
  },

  submitGrievance: async (id: string): Promise<Grievance> => {
    const response = await api.post(`/discipline/grievances/${id}/submit/`)
    return response.data
  },

  acknowledgeGrievance: async (id: string): Promise<Grievance> => {
    const response = await api.post(`/discipline/grievances/${id}/acknowledge/`)
    return response.data
  },

  investigateGrievance: async (id: string, data?: { assigned_to?: string }): Promise<Grievance> => {
    const response = await api.post(`/discipline/grievances/${id}/investigate/`, data)
    return response.data
  },

  escalateGrievance: async (id: string, data: { escalated_to?: string; escalation_reason?: string }): Promise<Grievance> => {
    const response = await api.post(`/discipline/grievances/${id}/escalate/`, data)
    return response.data
  },

  resolveGrievance: async (id: string, data: { resolution: string }): Promise<Grievance> => {
    const response = await api.post(`/discipline/grievances/${id}/resolve/`, data)
    return response.data
  },

  closeGrievance: async (id: string): Promise<Grievance> => {
    const response = await api.post(`/discipline/grievances/${id}/close_grievance/`)
    return response.data
  },

  addGrievanceNote: async (id: string, data: { note: string; is_internal?: boolean }): Promise<GrievanceNote> => {
    const response = await api.post(`/discipline/grievances/${id}/add_note/`, data)
    return response.data
  },

  acceptResolution: async (id: string, data?: { feedback?: string }): Promise<Grievance> => {
    const response = await api.post(`/discipline/grievances/${id}/accept_resolution/`, data)
    return response.data
  },

  rejectResolution: async (id: string, data?: { feedback?: string }): Promise<Grievance> => {
    const response = await api.post(`/discipline/grievances/${id}/reject_resolution/`, data)
    return response.data
  },

  // ── Grievance Attachments ──

  uploadGrievanceAttachment: async (id: string, file: File): Promise<GrievanceAttachment> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post(`/discipline/grievance-attachments/${id}/upload/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  downloadGrievanceAttachment: async (id: string): Promise<Blob> => {
    const response = await api.get(`/discipline/grievance-attachments/${id}/download/`, { responseType: 'blob' })
    return response.data
  },

  // ── Self-Service ──

  getMyCases: async (): Promise<DisciplinaryCase[]> => {
    const response = await api.get('/discipline/my-cases/')
    return Array.isArray(response.data) ? response.data : response.data.results || []
  },

  respondToShowCause: async (caseId: string, data: { show_cause_response: string }): Promise<DisciplinaryCase> => {
    const response = await api.post(`/discipline/my-cases/${caseId}/respond/`, data)
    return response.data
  },

  acknowledgeAction: async (caseId: string, actionId: string): Promise<DisciplinaryAction> => {
    const response = await api.post(`/discipline/my-cases/${caseId}/acknowledge-action/`, { action_id: actionId })
    return response.data
  },

  fileAppeal: async (caseId: string, data: FormData): Promise<DisciplinaryAppeal> => {
    const response = await api.post(`/discipline/my-cases/${caseId}/appeal/`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  getMyGrievances: async (): Promise<Grievance[]> => {
    const response = await api.get('/discipline/my-grievances/')
    return Array.isArray(response.data) ? response.data : response.data.results || []
  },

  fileGrievance: async (data: Partial<Grievance>): Promise<Grievance> => {
    const response = await api.post('/discipline/my-grievances/file/', data)
    return response.data
  },
}
