import api from '@/lib/api'
import type { PaginatedResponse } from '@/types'

// ==================== Types ====================

export type VacancyStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'OPEN' | 'ON_HOLD' | 'CLOSED' | 'FILLED' | 'CANCELLED'
export type ApplicantStatus = 'NEW' | 'SCREENING' | 'SHORTLISTED' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'WITHDRAWN'
export type InterviewStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'RESCHEDULED'
export type OfferStatus = 'DRAFT' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'NEGOTIATING' | 'WITHDRAWN' | 'EXPIRED'

export interface Vacancy {
  id: string
  reference_number: string
  title: string
  department: string | null
  department_name: string
  position: string | null
  position_title: string
  grade: string | null
  grade_name: string
  work_location: string | null
  location_name: string
  employment_type: string
  description: string
  requirements: string
  responsibilities: string
  qualifications: string
  experience_years: number | null
  salary_min: number | null
  salary_max: number | null
  show_salary: boolean
  openings: number
  filled: number
  status: VacancyStatus
  status_display: string
  posted_date: string | null
  closing_date: string | null
  hiring_manager: string | null
  hiring_manager_name: string
  recruiter: string | null
  recruiter_name: string
  is_internal: boolean
  is_external: boolean
  applications_count: number
  created_at: string
  updated_at: string
}

export interface Applicant {
  id: string
  application_number: string
  vacancy: string
  vacancy_title: string
  vacancy_reference: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone: string
  alternate_phone: string
  address: string
  city: string
  region: string
  date_of_birth: string | null
  gender: string
  nationality: string
  highest_education: string
  field_of_study: string
  institution: string
  graduation_year: number | null
  years_of_experience: number | null
  current_employer: string
  current_position: string
  current_salary: number | null
  expected_salary: number | null
  notice_period_days: number | null
  status: ApplicantStatus
  status_display: string
  source: string
  referral_source: string
  cover_letter: string
  skills: string[]
  languages: string[]
  certifications: string[]
  shortlist_score: number | null
  shortlist_rank: number | null
  notes: string
  applied_at: string
  created_at: string
  updated_at: string
}

export interface Interview {
  id: string
  applicant: string
  applicant_name: string
  vacancy_title: string
  interview_type: string
  interview_type_display: string
  round_number: number
  scheduled_date: string
  scheduled_time: string
  duration_minutes: number
  location: string
  meeting_link: string
  status: InterviewStatus
  status_display: string
  panel_members: InterviewPanelMember[]
  feedback: InterviewFeedback[]
  average_score: number | null
  overall_recommendation: string
  notes: string
  created_at: string
  updated_at: string
}

export interface InterviewPanelMember {
  id: string
  interview: string
  employee: string
  employee_name: string
  role: string
  is_lead: boolean
  has_submitted_feedback: boolean
}

export interface InterviewFeedback {
  id: string
  interview: string
  panelist: string
  panelist_name: string
  overall_score: number | null
  strengths: string
  weaknesses: string
  recommendation: string
  comments: string
  submitted_at: string | null
}

export interface JobOffer {
  id: string
  offer_number: string
  applicant: string
  applicant_name: string
  vacancy: string
  vacancy_title: string
  position: string | null
  position_title: string
  grade: string | null
  grade_name: string
  department: string | null
  department_name: string
  work_location: string | null
  location_name: string
  employment_type: string
  offered_salary: number
  salary_currency: string
  allowances: Record<string, number>
  start_date: string
  probation_months: number
  benefits_summary: string
  terms_conditions: string
  status: OfferStatus
  status_display: string
  offered_by: string | null
  offered_by_name: string
  offered_at: string | null
  valid_until: string | null
  response_date: string | null
  response_comments: string
  created_at: string
  updated_at: string
}

export interface InterviewScoreTemplate {
  id: string
  name: string
  code: string
  description: string
  is_active: boolean
  is_default: boolean
  categories: InterviewScoreCategory[]
  created_at: string
}

export interface InterviewScoreCategory {
  id: string
  template: string
  name: string
  description: string
  weight: number
  max_score: number
  sort_order: number
  criteria: InterviewScoreCriterion[]
}

export interface InterviewScoreCriterion {
  id: string
  category: string
  name: string
  description: string
  max_score: number
  sort_order: number
}

export interface InterviewScoringSheet {
  id: string
  interview: string
  applicant_name: string
  panelist: string
  panelist_name: string
  template: string
  template_name: string
  total_score: number | null
  max_possible_score: number
  percentage_score: number | null
  recommendation: string
  overall_comments: string
  strengths: string
  areas_for_improvement: string
  scores: InterviewCriterionScore[]
  is_submitted: boolean
  submitted_at: string | null
  created_at: string
}

export interface InterviewCriterionScore {
  id: string
  scoring_sheet: string
  criterion: string
  criterion_name: string
  category_name: string
  score: number | null
  max_score: number
  comments: string
}

export interface VacancyURL {
  id: string
  vacancy: string
  vacancy_title: string
  vacancy_reference: string
  url_type: string
  slug: string
  full_url: string
  expires_at: string | null
  is_active: boolean
  max_applications: number | null
  current_applications: number
  views_count: number
  created_at: string
}

export interface ShortlistCriteria {
  id: string
  vacancy: string
  criteria_type: string
  criteria_type_display: string
  match_type: string
  match_type_display: string
  name: string
  description: string
  value_text: string
  value_number: number | null
  value_min: number | null
  value_max: number | null
  weight: number
  max_score: number
  is_mandatory: boolean
  sort_order: number
  created_at: string
}

export interface ShortlistRun {
  id: string
  vacancy: string
  vacancy_title: string
  run_number: string
  status: string
  status_display: string
  total_applicants: number
  qualified_count: number
  disqualified_count: number
  pass_threshold: number
  started_at: string | null
  completed_at: string | null
  run_by: string | null
  run_by_name: string
  results: ShortlistResult[]
  created_at: string
}

export interface ShortlistResult {
  id: string
  shortlist_run: string
  applicant: string
  applicant_name: string
  total_score: number
  max_possible_score: number
  percentage_score: number
  outcome: string
  outcome_display: string
  rank: number | null
  criterion_scores: Record<string, number>
  notes: string
}

// ==================== Filter Types ====================

export interface VacancyFilters {
  status?: string
  department?: string
  employment_type?: string
  is_internal?: boolean
  is_external?: boolean
  search?: string
  page?: number
}

export interface ApplicantFilters {
  vacancy?: string
  status?: string
  source?: string
  search?: string
  page?: number
}

export interface InterviewFilters {
  applicant?: string
  vacancy?: string
  status?: string
  interview_type?: string
  date_from?: string
  date_to?: string
  page?: number
}

// ==================== Service ====================

export const recruitmentService = {
  // ==================== Vacancies ====================

  getVacancies: async (filters: VacancyFilters = {}): Promise<PaginatedResponse<Vacancy>> => {
    const response = await api.get('/recruitment/vacancies/', { params: filters })
    return response.data
  },

  getVacancy: async (id: string): Promise<Vacancy> => {
    const response = await api.get(`/recruitment/vacancies/${id}/`)
    return response.data
  },

  createVacancy: async (data: Partial<Vacancy>): Promise<Vacancy> => {
    const response = await api.post('/recruitment/vacancies/', data)
    return response.data
  },

  updateVacancy: async (id: string, data: Partial<Vacancy>): Promise<Vacancy> => {
    const response = await api.patch(`/recruitment/vacancies/${id}/`, data)
    return response.data
  },

  deleteVacancy: async (id: string): Promise<void> => {
    await api.delete(`/recruitment/vacancies/${id}/`)
  },

  publishVacancy: async (id: string): Promise<Vacancy> => {
    const response = await api.post(`/recruitment/vacancies/${id}/publish/`)
    return response.data
  },

  closeVacancy: async (id: string): Promise<Vacancy> => {
    const response = await api.post(`/recruitment/vacancies/${id}/close/`)
    return response.data
  },

  getVacancyStats: async (): Promise<{
    total: number
    open: number
    on_hold: number
    filled: number
    closed: number
    total_applications: number
  }> => {
    const response = await api.get('/recruitment/vacancies/stats/')
    return response.data
  },

  // ==================== Applicants ====================

  getApplicants: async (filters: ApplicantFilters = {}): Promise<PaginatedResponse<Applicant>> => {
    const response = await api.get('/recruitment/applicants/', { params: filters })
    return response.data
  },

  getApplicant: async (id: string): Promise<Applicant> => {
    const response = await api.get(`/recruitment/applicants/${id}/`)
    return response.data
  },

  createApplicant: async (data: Partial<Applicant>): Promise<Applicant> => {
    const response = await api.post('/recruitment/applicants/', data)
    return response.data
  },

  updateApplicant: async (id: string, data: Partial<Applicant>): Promise<Applicant> => {
    const response = await api.patch(`/recruitment/applicants/${id}/`, data)
    return response.data
  },

  updateApplicantStatus: async (id: string, status: ApplicantStatus, notes?: string): Promise<Applicant> => {
    const response = await api.post(`/recruitment/applicants/${id}/update_status/`, {
      status,
      notes
    })
    return response.data
  },

  shortlistApplicant: async (id: string): Promise<Applicant> => {
    const response = await api.post(`/recruitment/applicants/${id}/shortlist/`)
    return response.data
  },

  rejectApplicant: async (id: string, reason: string): Promise<Applicant> => {
    const response = await api.post(`/recruitment/applicants/${id}/reject/`, { reason })
    return response.data
  },

  getApplicantTimeline: async (id: string): Promise<any[]> => {
    const response = await api.get(`/recruitment/applicants/${id}/timeline/`)
    return response.data
  },

  // ==================== Interviews ====================

  getInterviews: async (filters: InterviewFilters = {}): Promise<PaginatedResponse<Interview>> => {
    const response = await api.get('/recruitment/interviews/', { params: filters })
    return response.data
  },

  getInterview: async (id: string): Promise<Interview> => {
    const response = await api.get(`/recruitment/interviews/${id}/`)
    return response.data
  },

  createInterview: async (data: {
    applicant: string
    interview_type: string
    round_number?: number
    scheduled_date: string
    scheduled_time: string
    duration_minutes?: number
    location?: string
    meeting_link?: string
    notes?: string
  }): Promise<Interview> => {
    const response = await api.post('/recruitment/interviews/', data)
    return response.data
  },

  updateInterview: async (id: string, data: Partial<Interview>): Promise<Interview> => {
    const response = await api.patch(`/recruitment/interviews/${id}/`, data)
    return response.data
  },

  cancelInterview: async (id: string, reason: string): Promise<Interview> => {
    const response = await api.post(`/recruitment/interviews/${id}/cancel/`, { reason })
    return response.data
  },

  rescheduleInterview: async (id: string, data: {
    scheduled_date: string
    scheduled_time: string
    reason: string
  }): Promise<Interview> => {
    const response = await api.post(`/recruitment/interviews/${id}/reschedule/`, data)
    return response.data
  },

  completeInterview: async (id: string): Promise<Interview> => {
    const response = await api.post(`/recruitment/interviews/${id}/complete/`)
    return response.data
  },

  // ==================== Interview Panels ====================

  addPanelMember: async (interviewId: string, data: {
    employee: string
    role?: string
    is_lead?: boolean
  }): Promise<InterviewPanelMember> => {
    const response = await api.post('/recruitment/interview-panels/', {
      interview: interviewId,
      ...data
    })
    return response.data
  },

  removePanelMember: async (id: string): Promise<void> => {
    await api.delete(`/recruitment/interview-panels/${id}/`)
  },

  // ==================== Interview Feedback ====================

  submitFeedback: async (interviewId: string, data: {
    overall_score: number
    strengths: string
    weaknesses: string
    recommendation: string
    comments?: string
  }): Promise<InterviewFeedback> => {
    const response = await api.post('/recruitment/interview-feedback/', {
      interview: interviewId,
      ...data
    })
    return response.data
  },

  updateFeedback: async (id: string, data: Partial<InterviewFeedback>): Promise<InterviewFeedback> => {
    const response = await api.patch(`/recruitment/interview-feedback/${id}/`, data)
    return response.data
  },

  // ==================== Job Offers ====================

  getOffers: async (params?: { status?: string; applicant?: string }): Promise<JobOffer[]> => {
    const response = await api.get('/recruitment/offers/', { params })
    return response.data.results || response.data
  },

  getOffer: async (id: string): Promise<JobOffer> => {
    const response = await api.get(`/recruitment/offers/${id}/`)
    return response.data
  },

  createOffer: async (data: {
    applicant: string
    position?: string
    grade?: string
    department?: string
    work_location?: string
    employment_type: string
    offered_salary: number
    start_date: string
    probation_months?: number
    benefits_summary?: string
    terms_conditions?: string
    valid_until?: string
  }): Promise<JobOffer> => {
    const response = await api.post('/recruitment/offers/', data)
    return response.data
  },

  updateOffer: async (id: string, data: Partial<JobOffer>): Promise<JobOffer> => {
    const response = await api.patch(`/recruitment/offers/${id}/`, data)
    return response.data
  },

  sendOffer: async (id: string): Promise<JobOffer> => {
    const response = await api.post(`/recruitment/offers/${id}/send/`)
    return response.data
  },

  acceptOffer: async (id: string): Promise<JobOffer> => {
    const response = await api.post(`/recruitment/offers/${id}/accept/`)
    return response.data
  },

  rejectOffer: async (id: string, reason: string): Promise<JobOffer> => {
    const response = await api.post(`/recruitment/offers/${id}/reject/`, { reason })
    return response.data
  },

  withdrawOffer: async (id: string, reason: string): Promise<JobOffer> => {
    const response = await api.post(`/recruitment/offers/${id}/withdraw/`, { reason })
    return response.data
  },

  // ==================== Score Templates ====================

  getScoreTemplates: async (): Promise<InterviewScoreTemplate[]> => {
    const response = await api.get('/recruitment/score-templates/')
    return response.data.results || response.data
  },

  getScoreTemplate: async (id: string): Promise<InterviewScoreTemplate> => {
    const response = await api.get(`/recruitment/score-templates/${id}/`)
    return response.data
  },

  createScoreTemplate: async (data: Partial<InterviewScoreTemplate>): Promise<InterviewScoreTemplate> => {
    const response = await api.post('/recruitment/score-templates/', data)
    return response.data
  },

  updateScoreTemplate: async (id: string, data: Partial<InterviewScoreTemplate>): Promise<InterviewScoreTemplate> => {
    const response = await api.patch(`/recruitment/score-templates/${id}/`, data)
    return response.data
  },

  // ==================== Scoring Sheets ====================

  getScoringSheets: async (interviewId: string): Promise<InterviewScoringSheet[]> => {
    const response = await api.get('/recruitment/scoring-sheets/', {
      params: { interview: interviewId }
    })
    return response.data.results || response.data
  },

  getScoringSheet: async (id: string): Promise<InterviewScoringSheet> => {
    const response = await api.get(`/recruitment/scoring-sheets/${id}/`)
    return response.data
  },

  createScoringSheet: async (data: {
    interview: string
    template: string
  }): Promise<InterviewScoringSheet> => {
    const response = await api.post('/recruitment/scoring-sheets/', data)
    return response.data
  },

  updateScoringSheet: async (id: string, data: Partial<InterviewScoringSheet>): Promise<InterviewScoringSheet> => {
    const response = await api.patch(`/recruitment/scoring-sheets/${id}/`, data)
    return response.data
  },

  submitScoringSheet: async (id: string): Promise<InterviewScoringSheet> => {
    const response = await api.post(`/recruitment/scoring-sheets/${id}/submit/`)
    return response.data
  },

  updateCriterionScore: async (sheetId: string, criterionId: string, score: number, comments?: string): Promise<InterviewCriterionScore> => {
    const response = await api.post(`/recruitment/scoring-sheets/${sheetId}/score_criterion/`, {
      criterion: criterionId,
      score,
      comments
    })
    return response.data
  },

  // ==================== Vacancy URLs ====================

  getVacancyURLs: async (vacancyId: string): Promise<VacancyURL[]> => {
    const response = await api.get('/recruitment/vacancy-urls/', {
      params: { vacancy: vacancyId }
    })
    return response.data.results || response.data
  },

  createVacancyURL: async (data: {
    vacancy: string
    url_type: string
    expires_at?: string
    max_applications?: number
  }): Promise<VacancyURL> => {
    const response = await api.post('/recruitment/vacancy-urls/', data)
    return response.data
  },

  deactivateVacancyURL: async (id: string): Promise<VacancyURL> => {
    const response = await api.post(`/recruitment/vacancy-urls/${id}/deactivate/`)
    return response.data
  },

  // ==================== Shortlisting ====================

  getShortlistCriteria: async (vacancyId: string): Promise<ShortlistCriteria[]> => {
    const response = await api.get('/recruitment/shortlist-criteria/', {
      params: { vacancy: vacancyId }
    })
    return response.data.results || response.data
  },

  createShortlistCriteria: async (data: Partial<ShortlistCriteria>): Promise<ShortlistCriteria> => {
    const response = await api.post('/recruitment/shortlist-criteria/', data)
    return response.data
  },

  updateShortlistCriteria: async (id: string, data: Partial<ShortlistCriteria>): Promise<ShortlistCriteria> => {
    const response = await api.patch(`/recruitment/shortlist-criteria/${id}/`, data)
    return response.data
  },

  deleteShortlistCriteria: async (id: string): Promise<void> => {
    await api.delete(`/recruitment/shortlist-criteria/${id}/`)
  },

  getShortlistRuns: async (vacancyId: string): Promise<ShortlistRun[]> => {
    const response = await api.get('/recruitment/shortlist-runs/', {
      params: { vacancy: vacancyId }
    })
    return response.data.results || response.data
  },

  createShortlistRun: async (vacancyId: string, passThreshold?: number): Promise<ShortlistRun> => {
    const response = await api.post('/recruitment/shortlist-runs/', {
      vacancy: vacancyId,
      pass_threshold: passThreshold
    })
    return response.data
  },

  executeShortlistRun: async (id: string): Promise<ShortlistRun> => {
    const response = await api.post(`/recruitment/shortlist-runs/${id}/execute/`)
    return response.data
  },

  getShortlistResults: async (runId: string): Promise<ShortlistResult[]> => {
    const response = await api.get('/recruitment/shortlist-results/', {
      params: { shortlist_run: runId }
    })
    return response.data.results || response.data
  },

  // ==================== Summary ====================

  getRecruitmentSummary: async (): Promise<{
    vacancies: { total: number; open: number; filled: number }
    applicants: { total: number; new: number; in_progress: number; hired: number }
    interviews: { scheduled: number; completed: number; this_week: number }
    offers: { pending: number; accepted: number; rejected: number }
  }> => {
    const response = await api.get('/recruitment/summary/')
    return response.data
  },

  // ==================== Public Careers ====================

  getPublicVacancies: async (): Promise<Vacancy[]> => {
    const response = await api.get('/recruitment/careers/')
    return response.data.results || response.data
  },

  getPublicVacancyDetail: async (slug: string): Promise<Vacancy> => {
    const response = await api.get(`/recruitment/careers/apply/${slug}/`)
    return response.data
  },

  submitPublicApplication: async (slug: string, data: Partial<Applicant>): Promise<Applicant> => {
    const response = await api.post(`/recruitment/careers/apply/${slug}/submit/`, data)
    return response.data
  },
}
