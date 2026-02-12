import api from '@/lib/api'

// ==================== Interfaces ====================

export interface Project {
  id: string
  code: string
  name: string
  description: string
  project_manager: string
  project_manager_name?: string
  department: string
  department_name?: string
  start_date: string
  end_date: string | null
  budget_amount: number
  actual_cost: number
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
  status_display?: string
  priority: number
  completion_percentage: number
  customer: string
  created_at?: string
  updated_at?: string
}

export interface ProjectTask {
  id: string
  project: string
  project_name?: string
  name: string
  parent: string | null
  parent_name?: string
  assigned_to: string | null
  assigned_to_name?: string
  start_date: string | null
  end_date: string | null
  estimated_hours: number
  actual_hours: number
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED'
  status_display?: string
  priority: number
  description: string
  sort_order: number
  children?: ProjectTask[]
  created_at?: string
  updated_at?: string
}

export interface Resource {
  id: string
  project: string
  project_name?: string
  employee: string
  employee_name?: string
  employee_number?: string
  role: string
  allocation_percent: number
  start_date: string
  end_date: string | null
  hourly_rate: number
  created_at?: string
  updated_at?: string
}

export interface Timesheet {
  id: string
  employee: string
  employee_name?: string
  employee_number?: string
  project: string
  project_name?: string
  task: string | null
  task_name?: string
  date: string
  hours: number
  description: string
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  status_display?: string
  approved_by: string | null
  approved_by_name?: string
  approved_at: string | null
  created_at?: string
  updated_at?: string
}

export interface ProjectBudget {
  id: string
  project: string
  project_name?: string
  account: string
  description: string
  budget_amount: number
  spent_amount: number
  remaining?: number
  utilization_percent?: number
  created_at?: string
  updated_at?: string
}

export interface Milestone {
  id: string
  project: string
  project_name?: string
  name: string
  due_date: string
  amount: number
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'
  status_display?: string
  completion_date: string | null
  description: string
  created_at?: string
  updated_at?: string
}

export interface ProjectBilling {
  id: string
  project: string
  project_name?: string
  billing_type: 'TIME_MATERIAL' | 'FIXED' | 'MILESTONE'
  billing_type_display?: string
  customer_invoice: string
  amount: number
  billing_date: string
  description: string
  created_at?: string
  updated_at?: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ProjectFilters {
  search?: string
  status?: string
  department?: string
  project_manager?: string
  priority?: number
  page?: number
  page_size?: number
}

export interface TimesheetFilters {
  employee?: string
  project?: string
  task?: string
  status?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export interface ResourceFilters {
  project?: string
  employee?: string
  page?: number
  page_size?: number
}

// ==================== Service ====================

export const projectsService = {
  // ==================== Projects ====================

  getProjects: async (filters: ProjectFilters = {}): Promise<PaginatedResponse<Project>> => {
    const response = await api.get('/projects/', { params: filters })
    return response.data
  },

  getProject: async (id: string): Promise<Project> => {
    const response = await api.get(`/projects/${id}/`)
    return response.data
  },

  createProject: async (data: Partial<Project>): Promise<Project> => {
    const response = await api.post('/projects/', data)
    return response.data
  },

  updateProject: async (id: string, data: Partial<Project>): Promise<Project> => {
    const response = await api.patch(`/projects/${id}/`, data)
    return response.data
  },

  deleteProject: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}/`)
  },

  activateProject: async (id: string): Promise<Project> => {
    const response = await api.post(`/projects/${id}/activate/`)
    return response.data
  },

  holdProject: async (id: string): Promise<Project> => {
    const response = await api.post(`/projects/${id}/hold/`)
    return response.data
  },

  completeProject: async (id: string): Promise<Project> => {
    const response = await api.post(`/projects/${id}/complete/`)
    return response.data
  },

  cancelProject: async (id: string): Promise<Project> => {
    const response = await api.post(`/projects/${id}/cancel/`)
    return response.data
  },

  // ==================== Tasks ====================

  getTasks: async (params?: { project?: string; parent?: string; page_size?: number }): Promise<ProjectTask[]> => {
    const response = await api.get('/projects/tasks/', { params: { page_size: 200, ...params } })
    return response.data?.results || response.data || []
  },

  getTask: async (id: string): Promise<ProjectTask> => {
    const response = await api.get(`/projects/tasks/${id}/`)
    return response.data
  },

  createTask: async (data: Partial<ProjectTask>): Promise<ProjectTask> => {
    const response = await api.post('/projects/tasks/', data)
    return response.data
  },

  updateTask: async (id: string, data: Partial<ProjectTask>): Promise<ProjectTask> => {
    const response = await api.patch(`/projects/tasks/${id}/`, data)
    return response.data
  },

  deleteTask: async (id: string): Promise<void> => {
    await api.delete(`/projects/tasks/${id}/`)
  },

  // ==================== Resources ====================

  getResources: async (filters: ResourceFilters = {}): Promise<Resource[]> => {
    const response = await api.get('/projects/resources/', { params: { page_size: 200, ...filters } })
    return response.data?.results || response.data || []
  },

  getResource: async (id: string): Promise<Resource> => {
    const response = await api.get(`/projects/resources/${id}/`)
    return response.data
  },

  createResource: async (data: Partial<Resource>): Promise<Resource> => {
    const response = await api.post('/projects/resources/', data)
    return response.data
  },

  updateResource: async (id: string, data: Partial<Resource>): Promise<Resource> => {
    const response = await api.patch(`/projects/resources/${id}/`, data)
    return response.data
  },

  deleteResource: async (id: string): Promise<void> => {
    await api.delete(`/projects/resources/${id}/`)
  },

  // ==================== Timesheets ====================

  getTimesheets: async (filters: TimesheetFilters = {}): Promise<PaginatedResponse<Timesheet>> => {
    const response = await api.get('/projects/timesheets/', { params: filters })
    return response.data
  },

  getTimesheet: async (id: string): Promise<Timesheet> => {
    const response = await api.get(`/projects/timesheets/${id}/`)
    return response.data
  },

  createTimesheet: async (data: Partial<Timesheet>): Promise<Timesheet> => {
    const response = await api.post('/projects/timesheets/', data)
    return response.data
  },

  updateTimesheet: async (id: string, data: Partial<Timesheet>): Promise<Timesheet> => {
    const response = await api.patch(`/projects/timesheets/${id}/`, data)
    return response.data
  },

  deleteTimesheet: async (id: string): Promise<void> => {
    await api.delete(`/projects/timesheets/${id}/`)
  },

  submitTimesheet: async (id: string): Promise<Timesheet> => {
    const response = await api.post(`/projects/timesheets/${id}/submit/`)
    return response.data
  },

  approveTimesheet: async (id: string): Promise<Timesheet> => {
    const response = await api.post(`/projects/timesheets/${id}/approve/`)
    return response.data
  },

  rejectTimesheet: async (id: string): Promise<Timesheet> => {
    const response = await api.post(`/projects/timesheets/${id}/reject/`)
    return response.data
  },

  // ==================== Budgets ====================

  getBudgets: async (params?: { project?: string }): Promise<ProjectBudget[]> => {
    const response = await api.get('/projects/budgets/', { params: { page_size: 200, ...params } })
    return response.data?.results || response.data || []
  },

  getBudget: async (id: string): Promise<ProjectBudget> => {
    const response = await api.get(`/projects/budgets/${id}/`)
    return response.data
  },

  createBudget: async (data: Partial<ProjectBudget>): Promise<ProjectBudget> => {
    const response = await api.post('/projects/budgets/', data)
    return response.data
  },

  updateBudget: async (id: string, data: Partial<ProjectBudget>): Promise<ProjectBudget> => {
    const response = await api.patch(`/projects/budgets/${id}/`, data)
    return response.data
  },

  deleteBudget: async (id: string): Promise<void> => {
    await api.delete(`/projects/budgets/${id}/`)
  },

  // ==================== Milestones ====================

  getMilestones: async (params?: { project?: string }): Promise<Milestone[]> => {
    const response = await api.get('/projects/milestones/', { params: { page_size: 200, ...params } })
    return response.data?.results || response.data || []
  },

  getMilestone: async (id: string): Promise<Milestone> => {
    const response = await api.get(`/projects/milestones/${id}/`)
    return response.data
  },

  createMilestone: async (data: Partial<Milestone>): Promise<Milestone> => {
    const response = await api.post('/projects/milestones/', data)
    return response.data
  },

  updateMilestone: async (id: string, data: Partial<Milestone>): Promise<Milestone> => {
    const response = await api.patch(`/projects/milestones/${id}/`, data)
    return response.data
  },

  deleteMilestone: async (id: string): Promise<void> => {
    await api.delete(`/projects/milestones/${id}/`)
  },

  // ==================== Billing ====================

  getBillings: async (params?: { project?: string }): Promise<ProjectBilling[]> => {
    const response = await api.get('/projects/billings/', { params: { page_size: 200, ...params } })
    return response.data?.results || response.data || []
  },

  getBilling: async (id: string): Promise<ProjectBilling> => {
    const response = await api.get(`/projects/billings/${id}/`)
    return response.data
  },

  createBilling: async (data: Partial<ProjectBilling>): Promise<ProjectBilling> => {
    const response = await api.post('/projects/billings/', data)
    return response.data
  },

  updateBilling: async (id: string, data: Partial<ProjectBilling>): Promise<ProjectBilling> => {
    const response = await api.patch(`/projects/billings/${id}/`, data)
    return response.data
  },

  deleteBilling: async (id: string): Promise<void> => {
    await api.delete(`/projects/billings/${id}/`)
  },
}
