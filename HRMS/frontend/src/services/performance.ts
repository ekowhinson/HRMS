import api from '@/lib/api'
import type { PaginatedResponse } from '@/types'

// Appraisal Status Types
export type AppraisalStatus =
  | 'DRAFT' | 'GOAL_SETTING' | 'GOALS_SUBMITTED' | 'GOALS_APPROVED'
  | 'IN_PROGRESS' | 'SELF_ASSESSMENT' | 'MANAGER_REVIEW' | 'MEETING'
  | 'CALIBRATION' | 'COMPLETED' | 'ACKNOWLEDGED'

export type GoalStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

// Appraisal Types
export interface Appraisal {
  id: string
  employee: string
  employee_name: string
  employee_number: string
  department_name: string
  position_title: string
  appraisal_cycle: string
  cycle_name: string
  cycle_year: number
  manager: string | null
  manager_name: string
  status: AppraisalStatus
  status_display: string
  // Self assessment
  self_assessment_date: string | null
  objectives_self_rating: number | null
  competencies_self_rating: number | null
  values_self_rating: number | null
  overall_self_rating: number | null
  self_assessment_comments: string
  // Manager assessment
  manager_review_date: string | null
  objectives_manager_rating: number | null
  competencies_manager_rating: number | null
  values_manager_rating: number | null
  overall_manager_rating: number | null
  manager_comments: string
  // Final ratings
  objectives_final_rating: number | null
  competencies_final_rating: number | null
  values_final_rating: number | null
  overall_final_rating: number | null
  // Weighted scores
  weighted_objectives_score: number | null
  weighted_competencies_score: number | null
  weighted_values_score: number | null
  // Other
  strengths: string
  areas_for_improvement: string
  career_aspirations: string
  development_needs: string
  overall_comments: string
  completion_date: string | null
  acknowledged_at: string | null
  created_at: string
  updated_at: string
}

export interface AppraisalDetail extends Appraisal {
  goals: Goal[]
  competency_assessments: CompetencyAssessment[]
  value_assessments: CoreValueAssessment[]
  training_needs: TrainingNeed[]
}

// Goal Types
export interface GoalCategory {
  id: string
  name: string
  code: string
  description: string
  is_active: boolean
}

export interface Goal {
  id: string
  appraisal: string
  category: string | null
  category_name: string
  title: string
  description: string
  key_results: string
  weight: number
  target_date: string | null
  status: GoalStatus
  status_display: string
  progress_percentage: number
  self_rating: number | null
  self_comments: string
  manager_rating: number | null
  manager_comments: string
  final_rating: number | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  updates: GoalUpdate[]
}

export interface GoalUpdate {
  id: string
  goal: string
  update_date: string
  progress_percentage: number
  notes: string
  challenges: string
  support_needed: string
  created_by: string
  created_at: string
}

// Competency Types
export interface Competency {
  id: string
  name: string
  code: string
  category: string
  description: string
  behavioral_indicators: string
  is_active: boolean
  sort_order: number
  levels: CompetencyLevel[]
}

export interface CompetencyLevel {
  id: string
  competency: string
  level: number
  name: string
  description: string
}

export interface CompetencyAssessment {
  id: string
  appraisal: string
  competency: string
  competency_name: string
  competency_code: string
  expected_level: number
  self_rating: number | null
  self_comments: string
  manager_rating: number | null
  manager_comments: string
  final_rating: number | null
  created_at: string
  updated_at: string
}

// Rating Scale Types
export interface RatingScale {
  id: string
  name: string
  code: string
  description: string
  is_active: boolean
  is_default: boolean
  levels: RatingScaleLevel[]
}

export interface RatingScaleLevel {
  id: string
  rating_scale: string
  value: number
  label: string
  description: string
  color: string
}

// Filter interfaces
export interface AppraisalFilters {
  cycle?: string
  status?: string
  department?: string
  search?: string
  page?: number
  page_size?: number
}

export interface GoalFilters {
  appraisal?: string
  status?: string
  category?: string
}

// Core Value Types
export interface CoreValue {
  id: string
  code: string
  name: string
  description: string
  behavioral_indicators: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CoreValueAssessment {
  id: string
  appraisal: string
  core_value: string
  core_value_name: string
  core_value_code: string
  self_rating: number | null
  self_comments: string
  manager_rating: number | null
  manager_comments: string
  final_rating: number | null
  created_at: string
  updated_at: string
}

// Probation Assessment Types
export type ProbationPeriod = '3M' | '6M' | '12M'
export type ProbationStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'CONFIRMED' | 'EXTENDED' | 'TERMINATED'

export interface ProbationAssessment {
  id: string
  employee: string
  employee_name: string
  employee_number: string
  department_name: string
  position_title: string
  assessment_period: ProbationPeriod
  period_display: string
  assessment_date: string
  due_date: string
  overall_rating: number | null
  job_knowledge: number | null
  work_quality: number | null
  attendance_punctuality: number | null
  teamwork: number | null
  communication: number | null
  initiative: number | null
  supervisor_comments: string
  employee_comments: string
  hr_comments: string
  status: ProbationStatus
  status_display: string
  recommendation: string
  extension_duration: number | null
  reviewed_by: string | null
  reviewed_by_name: string
  reviewed_at: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export interface DueProbationAssessment {
  employee_id: string
  employee_name: string
  employee_number: string
  period: ProbationPeriod
  due_date: string
}

// Training Need Types
export type TrainingPriority = 'HIGH' | 'MEDIUM' | 'LOW'
export type TrainingStatus = 'IDENTIFIED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type TrainingType = 'TRAINING' | 'CERTIFICATION' | 'WORKSHOP' | 'CONFERENCE' | 'MENTORING' | 'ONLINE' | 'ON_THE_JOB' | 'OTHER'

export interface TrainingNeed {
  id: string
  employee: string
  employee_name: string
  employee_number: string
  appraisal: string | null
  appraisal_cycle: string
  title: string
  description: string
  training_type: TrainingType
  type_display: string
  competency: string | null
  competency_name: string
  priority: TrainingPriority
  priority_display: string
  target_date: string | null
  completion_date: string | null
  status: TrainingStatus
  status_display: string
  estimated_cost: number | null
  actual_cost: number | null
  training_provider: string
  outcome: string
  created_at: string
  updated_at: string
}

// Performance Appeal Types
export type AppealStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'HEARING' | 'UPHELD' | 'PARTIAL' | 'DISMISSED' | 'WITHDRAWN'

export interface PerformanceAppeal {
  id: string
  appeal_number: string
  appraisal: string
  employee_name: string
  employee_number: string
  appraisal_cycle: string
  grounds: string
  disputed_ratings: Record<string, boolean>
  requested_remedy: string
  supporting_evidence: string
  submitted_at: string
  status: AppealStatus
  status_display: string
  reviewer: string | null
  reviewer_name: string
  review_comments: string
  hearing_date: string | null
  decision: string
  revised_ratings: Record<string, any>
  decision_date: string | null
  decided_by: string | null
  decided_by_name: string
  created_at: string
  updated_at: string
}

// Appraisal Cycle Types (extended)
export interface AppraisalCycle {
  id: string
  name: string
  description: string
  year: number
  start_date: string
  end_date: string
  goal_setting_start: string | null
  goal_setting_end: string | null
  mid_year_start: string | null
  mid_year_end: string | null
  year_end_start: string | null
  year_end_end: string | null
  status: string
  is_active: boolean
  allow_self_assessment: boolean
  allow_peer_feedback: boolean
  require_manager_approval: boolean
  min_goals: number
  max_goals: number
  // Weight configuration
  objectives_weight: number
  competencies_weight: number
  values_weight: number
  // Threshold configuration
  pass_mark: number
  increment_threshold: number
  promotion_threshold: number
  pip_threshold: number
}

// Score Calculation Result
export interface AppraisalScores {
  objectives_score: number | null
  competencies_score: number | null
  values_score: number | null
  weighted_objectives: number | null
  weighted_competencies: number | null
  weighted_values: number | null
  final_score: number | null
  passed: boolean | null
  increment_eligible: boolean | null
  promotion_eligible: boolean | null
  pip_required: boolean | null
}

// Filter interfaces
export interface ProbationFilters {
  status?: string
  period?: string
  department?: string
  search?: string
  page?: number
}

export interface TrainingNeedFilters {
  status?: string
  priority?: string
  type?: string
  employee?: string
  appraisal?: string
  search?: string
  page?: number
}

export interface AppealFilters {
  status?: string
  cycle?: string
  search?: string
  page?: number
}

export const performanceService = {
  // Core Values
  getCoreValues: async (includeInactive = false): Promise<CoreValue[]> => {
    const params = includeInactive ? { include_inactive: 'true' } : {}
    const response = await api.get('/performance/core-values/', { params })
    return response.data.results || response.data
  },

  getCoreValue: async (id: string): Promise<CoreValue> => {
    const response = await api.get(`/performance/core-values/${id}/`)
    return response.data
  },

  createCoreValue: async (data: Partial<CoreValue>): Promise<CoreValue> => {
    const response = await api.post('/performance/core-values/', data)
    return response.data
  },

  updateCoreValue: async (id: string, data: Partial<CoreValue>): Promise<CoreValue> => {
    const response = await api.patch(`/performance/core-values/${id}/`, data)
    return response.data
  },

  deleteCoreValue: async (id: string): Promise<void> => {
    await api.delete(`/performance/core-values/${id}/`)
  },

  // Core Value Assessments
  getValueAssessments: async (appraisalId: string): Promise<CoreValueAssessment[]> => {
    const response = await api.get('/performance/value-assessments/', {
      params: { appraisal: appraisalId }
    })
    return response.data.results || response.data
  },

  createValueAssessment: async (data: Partial<CoreValueAssessment>): Promise<CoreValueAssessment> => {
    const response = await api.post('/performance/value-assessments/', data)
    return response.data
  },

  updateValueAssessment: async (id: string, data: Partial<CoreValueAssessment>): Promise<CoreValueAssessment> => {
    const response = await api.patch(`/performance/value-assessments/${id}/`, data)
    return response.data
  },

  bulkCreateValueAssessments: async (appraisalId: string): Promise<CoreValueAssessment[]> => {
    const response = await api.post('/performance/value-assessments/bulk_create/', {
      appraisal: appraisalId
    })
    return response.data
  },

  // Probation Assessments
  getProbationAssessments: async (filters: ProbationFilters = {}): Promise<PaginatedResponse<ProbationAssessment>> => {
    const response = await api.get('/performance/probation-assessments/', { params: filters })
    return response.data
  },

  getProbationAssessment: async (id: string): Promise<ProbationAssessment> => {
    const response = await api.get(`/performance/probation-assessments/${id}/`)
    return response.data
  },

  createProbationAssessment: async (data: Partial<ProbationAssessment>): Promise<ProbationAssessment> => {
    const response = await api.post('/performance/probation-assessments/', data)
    return response.data
  },

  updateProbationAssessment: async (id: string, data: Partial<ProbationAssessment>): Promise<ProbationAssessment> => {
    const response = await api.patch(`/performance/probation-assessments/${id}/`, data)
    return response.data
  },

  getDueProbationAssessments: async (days = 30): Promise<DueProbationAssessment[]> => {
    const response = await api.get('/performance/probation-assessments/due/', {
      params: { days }
    })
    return response.data
  },

  submitProbationAssessment: async (id: string): Promise<ProbationAssessment> => {
    const response = await api.post(`/performance/probation-assessments/${id}/submit/`)
    return response.data
  },

  confirmProbation: async (id: string): Promise<ProbationAssessment> => {
    const response = await api.post(`/performance/probation-assessments/${id}/confirm/`)
    return response.data
  },

  extendProbation: async (id: string, extensionMonths: number, reason: string): Promise<ProbationAssessment> => {
    const response = await api.post(`/performance/probation-assessments/${id}/extend/`, {
      extension_months: extensionMonths,
      reason
    })
    return response.data
  },

  terminateProbation: async (id: string, reason: string): Promise<ProbationAssessment> => {
    const response = await api.post(`/performance/probation-assessments/${id}/terminate/`, {
      reason
    })
    return response.data
  },

  getProbationStats: async (): Promise<{
    total: number
    by_status: { status: string; count: number }[]
    by_period: { assessment_period: string; count: number }[]
    overdue: number
  }> => {
    const response = await api.get('/performance/probation-assessments/stats/')
    return response.data
  },

  // Training Needs
  getTrainingNeeds: async (filters: TrainingNeedFilters = {}): Promise<PaginatedResponse<TrainingNeed>> => {
    const response = await api.get('/performance/training-needs/', { params: filters })
    return response.data
  },

  getTrainingNeed: async (id: string): Promise<TrainingNeed> => {
    const response = await api.get(`/performance/training-needs/${id}/`)
    return response.data
  },

  createTrainingNeed: async (data: Partial<TrainingNeed>): Promise<TrainingNeed> => {
    const response = await api.post('/performance/training-needs/', data)
    return response.data
  },

  updateTrainingNeed: async (id: string, data: Partial<TrainingNeed>): Promise<TrainingNeed> => {
    const response = await api.patch(`/performance/training-needs/${id}/`, data)
    return response.data
  },

  deleteTrainingNeed: async (id: string): Promise<void> => {
    await api.delete(`/performance/training-needs/${id}/`)
  },

  getMyTrainingNeeds: async (): Promise<TrainingNeed[]> => {
    const response = await api.get('/performance/training-needs/my_training_needs/')
    return response.data
  },

  updateTrainingStatus: async (id: string, status: TrainingStatus, outcome?: string, actualCost?: number): Promise<TrainingNeed> => {
    const response = await api.post(`/performance/training-needs/${id}/update_status/`, {
      status,
      outcome,
      actual_cost: actualCost
    })
    return response.data
  },

  identifyTrainingFromAppraisal: async (appraisalId: string): Promise<TrainingNeed[]> => {
    const response = await api.post('/performance/training-needs/identify_from_appraisal/', {
      appraisal: appraisalId
    })
    return response.data
  },

  getTrainingStats: async (): Promise<{
    total: number
    by_status: { status: string; count: number }[]
    by_priority: { priority: string; count: number }[]
    by_type: { training_type: string; count: number }[]
    estimated_cost: number
    actual_cost: number
  }> => {
    const response = await api.get('/performance/training-needs/stats/')
    return response.data
  },

  // Performance Appeals
  getAppeals: async (filters: AppealFilters = {}): Promise<PaginatedResponse<PerformanceAppeal>> => {
    const response = await api.get('/performance/appeals/', { params: filters })
    return response.data
  },

  getAppeal: async (id: string): Promise<PerformanceAppeal> => {
    const response = await api.get(`/performance/appeals/${id}/`)
    return response.data
  },

  createAppeal: async (data: {
    appraisal: string
    grounds: string
    disputed_ratings: Record<string, boolean>
    requested_remedy: string
    supporting_evidence?: string
  }): Promise<PerformanceAppeal> => {
    const response = await api.post('/performance/appeals/', data)
    return response.data
  },

  getMyAppeals: async (): Promise<PerformanceAppeal[]> => {
    const response = await api.get('/performance/appeals/my_appeals/')
    return response.data
  },

  assignReviewer: async (id: string, reviewerId: string): Promise<PerformanceAppeal> => {
    const response = await api.post(`/performance/appeals/${id}/assign_reviewer/`, {
      reviewer: reviewerId
    })
    return response.data
  },

  scheduleHearing: async (id: string, hearingDate: string): Promise<PerformanceAppeal> => {
    const response = await api.post(`/performance/appeals/${id}/schedule_hearing/`, {
      hearing_date: hearingDate
    })
    return response.data
  },

  decideAppeal: async (id: string, decision: string, status: 'UPHELD' | 'PARTIAL' | 'DISMISSED', revisedRatings?: Record<string, any>): Promise<PerformanceAppeal> => {
    const response = await api.post(`/performance/appeals/${id}/decide/`, {
      decision,
      status,
      revised_ratings: revisedRatings
    })
    return response.data
  },

  withdrawAppeal: async (id: string): Promise<PerformanceAppeal> => {
    const response = await api.post(`/performance/appeals/${id}/withdraw/`)
    return response.data
  },

  getAppealStats: async (): Promise<{
    total: number
    by_status: { status: string; count: number }[]
    pending: number
  }> => {
    const response = await api.get('/performance/appeals/stats/')
    return response.data
  },

  // Appraisal Cycles (extended)
  getAppraisalCycles: async (): Promise<AppraisalCycle[]> => {
    const response = await api.get('/performance/cycles/')
    return response.data.results || response.data
  },

  getAppraisalCycle: async (id: string): Promise<AppraisalCycle> => {
    const response = await api.get(`/performance/cycles/${id}/`)
    return response.data
  },

  updateAppraisalCycle: async (id: string, data: Partial<AppraisalCycle>): Promise<AppraisalCycle> => {
    const response = await api.patch(`/performance/cycles/${id}/`, data)
    return response.data
  },

  // Score Calculation
  calculateAppraisalScores: async (appraisalId: string, save = false): Promise<AppraisalScores> => {
    const response = await api.post(`/performance/appraisals/${appraisalId}/calculate_scores/`, {
      save
    })
    return response.data
  },

  getAppraisalDetail: async (appraisalId: string): Promise<AppraisalDetail> => {
    const response = await api.get(`/performance/appraisals/${appraisalId}/detail/`)
    return response.data
  },

  // Appraisal Cycles - Full CRUD
  createAppraisalCycle: async (data: Partial<AppraisalCycle>): Promise<AppraisalCycle> => {
    const response = await api.post('/performance/cycles/', data)
    return response.data
  },

  deleteAppraisalCycle: async (id: string): Promise<void> => {
    await api.delete(`/performance/cycles/${id}/`)
  },

  getActiveCycle: async (): Promise<AppraisalCycle | null> => {
    const response = await api.get('/performance/cycles/active/')
    return response.data
  },

  activateCycle: async (id: string): Promise<AppraisalCycle> => {
    const response = await api.post(`/performance/cycles/${id}/activate/`)
    return response.data
  },

  // Appraisals - Full CRUD
  getAppraisals: async (filters: AppraisalFilters = {}): Promise<PaginatedResponse<Appraisal>> => {
    const response = await api.get('/performance/appraisals/', { params: filters })
    return response.data
  },

  getAppraisal: async (id: string): Promise<Appraisal> => {
    const response = await api.get(`/performance/appraisals/${id}/`)
    return response.data
  },

  createAppraisal: async (data: {
    employee: string
    appraisal_cycle: string
    manager?: string
  }): Promise<Appraisal> => {
    const response = await api.post('/performance/appraisals/', data)
    return response.data
  },

  updateAppraisal: async (id: string, data: Partial<Appraisal>): Promise<Appraisal> => {
    const response = await api.patch(`/performance/appraisals/${id}/`, data)
    return response.data
  },

  deleteAppraisal: async (id: string): Promise<void> => {
    await api.delete(`/performance/appraisals/${id}/`)
  },

  getMyAppraisals: async (): Promise<Appraisal[]> => {
    const response = await api.get('/performance/appraisals/my_appraisals/')
    return response.data
  },

  getTeamAppraisals: async (): Promise<Appraisal[]> => {
    const response = await api.get('/performance/appraisals/team_appraisals/')
    return response.data
  },

  submitSelfAssessment: async (id: string): Promise<Appraisal> => {
    const response = await api.post(`/performance/appraisals/${id}/submit_self_assessment/`)
    return response.data
  },

  completeReview: async (id: string): Promise<Appraisal> => {
    const response = await api.post(`/performance/appraisals/${id}/complete_review/`)
    return response.data
  },

  getAppraisalStats: async (cycleId?: string): Promise<{
    total_appraisals: number
    by_status: { status: string; count: number }[]
    average_rating: number | null
    completed: number
    pending: number
  }> => {
    const params = cycleId ? { cycle: cycleId } : {}
    const response = await api.get('/performance/appraisals/stats/', { params })
    return response.data
  },

  // Goals
  getGoals: async (filters: GoalFilters = {}): Promise<Goal[]> => {
    const response = await api.get('/performance/goals/', { params: filters })
    return response.data.results || response.data
  },

  getGoal: async (id: string): Promise<Goal> => {
    const response = await api.get(`/performance/goals/${id}/`)
    return response.data
  },

  createGoal: async (data: {
    appraisal: string
    title: string
    description: string
    key_results?: string
    weight?: number
    target_date?: string
    category?: string
  }): Promise<Goal> => {
    const response = await api.post('/performance/goals/', data)
    return response.data
  },

  updateGoal: async (id: string, data: Partial<Goal>): Promise<Goal> => {
    const response = await api.patch(`/performance/goals/${id}/`, data)
    return response.data
  },

  deleteGoal: async (id: string): Promise<void> => {
    await api.delete(`/performance/goals/${id}/`)
  },

  updateGoalProgress: async (id: string, data: {
    progress_percentage: number
    notes?: string
    challenges?: string
    support_needed?: string
  }): Promise<Goal> => {
    const response = await api.post(`/performance/goals/${id}/update_progress/`, data)
    return response.data
  },

  approveGoal: async (id: string): Promise<Goal> => {
    const response = await api.post(`/performance/goals/${id}/approve/`)
    return response.data
  },

  // Goal Categories
  getGoalCategories: async (): Promise<GoalCategory[]> => {
    const response = await api.get('/performance/goal-categories/')
    return response.data.results || response.data
  },

  createGoalCategory: async (data: Partial<GoalCategory>): Promise<GoalCategory> => {
    const response = await api.post('/performance/goal-categories/', data)
    return response.data
  },

  updateGoalCategory: async (id: string, data: Partial<GoalCategory>): Promise<GoalCategory> => {
    const response = await api.patch(`/performance/goal-categories/${id}/`, data)
    return response.data
  },

  deleteGoalCategory: async (id: string): Promise<void> => {
    await api.delete(`/performance/goal-categories/${id}/`)
  },

  // Competencies
  getCompetencies: async (category?: string): Promise<Competency[]> => {
    const params = category ? { category } : {}
    const response = await api.get('/performance/competencies/', { params })
    return response.data.results || response.data
  },

  getCompetency: async (id: string): Promise<Competency> => {
    const response = await api.get(`/performance/competencies/${id}/`)
    return response.data
  },

  createCompetency: async (data: Partial<Competency>): Promise<Competency> => {
    const response = await api.post('/performance/competencies/', data)
    return response.data
  },

  updateCompetency: async (id: string, data: Partial<Competency>): Promise<Competency> => {
    const response = await api.patch(`/performance/competencies/${id}/`, data)
    return response.data
  },

  deleteCompetency: async (id: string): Promise<void> => {
    await api.delete(`/performance/competencies/${id}/`)
  },

  // Competency Assessments
  getCompetencyAssessments: async (appraisalId: string): Promise<CompetencyAssessment[]> => {
    const response = await api.get('/performance/competency-assessments/', {
      params: { appraisal: appraisalId }
    })
    return response.data.results || response.data
  },

  updateCompetencyAssessment: async (id: string, data: Partial<CompetencyAssessment>): Promise<CompetencyAssessment> => {
    const response = await api.patch(`/performance/competency-assessments/${id}/`, data)
    return response.data
  },

  // Rating Scales
  getRatingScales: async (): Promise<RatingScale[]> => {
    const response = await api.get('/performance/rating-scales/')
    return response.data.results || response.data
  },

  getRatingScale: async (id: string): Promise<RatingScale> => {
    const response = await api.get(`/performance/rating-scales/${id}/`)
    return response.data
  },

  createRatingScale: async (data: Partial<RatingScale>): Promise<RatingScale> => {
    const response = await api.post('/performance/rating-scales/', data)
    return response.data
  },

  updateRatingScale: async (id: string, data: Partial<RatingScale>): Promise<RatingScale> => {
    const response = await api.patch(`/performance/rating-scales/${id}/`, data)
    return response.data
  },

  deleteRatingScale: async (id: string): Promise<void> => {
    await api.delete(`/performance/rating-scales/${id}/`)
  },

  // Development Plans
  getDevelopmentPlans: async (filters: { employee?: string; is_active?: string; search?: string; page?: number } = {}): Promise<PaginatedResponse<any>> => {
    const response = await api.get('/performance/development-plans/', { params: filters })
    return response.data
  },

  getDevelopmentPlan: async (id: string): Promise<any> => {
    const response = await api.get(`/performance/development-plans/${id}/`)
    return response.data
  },

  createDevelopmentPlan: async (data: any): Promise<any> => {
    const response = await api.post('/performance/development-plans/', data)
    return response.data
  },

  updateDevelopmentPlan: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/performance/development-plans/${id}/`, data)
    return response.data
  },

  deleteDevelopmentPlan: async (id: string): Promise<void> => {
    await api.delete(`/performance/development-plans/${id}/`)
  },

  approveDevelopmentPlan: async (id: string): Promise<any> => {
    const response = await api.post(`/performance/development-plans/${id}/approve/`)
    return response.data
  },

  // Development Activities
  getDevelopmentActivities: async (planId?: string): Promise<any[]> => {
    const params = planId ? { plan: planId } : {}
    const response = await api.get('/performance/development-activities/', { params })
    return response.data.results || response.data
  },

  createDevelopmentActivity: async (data: any): Promise<any> => {
    const response = await api.post('/performance/development-activities/', data)
    return response.data
  },

  updateDevelopmentActivity: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/performance/development-activities/${id}/`, data)
    return response.data
  },

  deleteDevelopmentActivity: async (id: string): Promise<void> => {
    await api.delete(`/performance/development-activities/${id}/`)
  },
}
