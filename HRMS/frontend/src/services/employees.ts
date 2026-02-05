import api from '@/lib/api'
import type { Employee, PaginatedResponse } from '@/types'

export interface EmployeeFilters {
  search?: string
  department?: string
  employment_status?: string
  grade?: string
  page?: number
}

export const employeeService = {
  // Get all employees with filters
  getAll: async (filters: EmployeeFilters = {}): Promise<PaginatedResponse<Employee>> => {
    // Map employment_status to status for backend compatibility
    const params: Record<string, any> = { ...filters }
    if (params.employment_status) {
      params.status = params.employment_status
      delete params.employment_status
    }
    const response = await api.get('/employees/', { params })
    return response.data
  },

  // Alias for getAll
  getEmployees: async (filters: EmployeeFilters = {}): Promise<PaginatedResponse<Employee>> => {
    const response = await api.get('/employees/', { params: filters })
    return response.data
  },

  // Get single employee by ID
  getById: async (id: string): Promise<Employee> => {
    const response = await api.get(`/employees/${id}/`)
    return response.data
  },

  // Alias for getById
  getEmployee: async (id: string): Promise<Employee> => {
    const response = await api.get(`/employees/${id}/`)
    return response.data
  },

  // Create new employee
  create: async (data: any): Promise<Employee> => {
    const response = await api.post('/employees/', data)
    return response.data
  },

  // Update employee
  update: async (id: string, data: any): Promise<Employee> => {
    const response = await api.patch(`/employees/${id}/`, data)
    return response.data
  },

  // Delete employee
  delete: async (id: string): Promise<void> => {
    await api.delete(`/employees/${id}/`)
  },

  // Get direct reports
  getDirectReports: async (id: string): Promise<Employee[]> => {
    const response = await api.get(`/employees/${id}/direct-reports/`)
    return response.data
  },

  // Get all divisions
  getDivisions: async () => {
    const response = await api.get('/organization/divisions/')
    return response.data.results || response.data
  },

  // Create division
  createDivision: async (data: any) => {
    const response = await api.post('/organization/divisions/', data)
    return response.data
  },

  // Update division
  updateDivision: async (id: string, data: any) => {
    const response = await api.patch(`/organization/divisions/${id}/`, data)
    return response.data
  },

  // Delete division
  deleteDivision: async (id: string) => {
    await api.delete(`/organization/divisions/${id}/`)
  },

  // Get all directorates
  getDirectorates: async (divisionId?: string) => {
    const params = divisionId ? { division: divisionId } : {}
    const response = await api.get('/organization/directorates/', { params })
    return response.data.results || response.data
  },

  // Create directorate
  createDirectorate: async (data: any) => {
    const response = await api.post('/organization/directorates/', data)
    return response.data
  },

  // Update directorate
  updateDirectorate: async (id: string, data: any) => {
    const response = await api.patch(`/organization/directorates/${id}/`, data)
    return response.data
  },

  // Delete directorate
  deleteDirectorate: async (id: string) => {
    await api.delete(`/organization/directorates/${id}/`)
  },

  // Get all departments
  getDepartments: async (directorateId?: string) => {
    const params = directorateId ? { directorate: directorateId } : {}
    const response = await api.get('/organization/departments/', { params })
    // Handle both paginated and non-paginated responses
    return response.data.results || response.data
  },

  // Create department
  createDepartment: async (data: any) => {
    const response = await api.post('/organization/departments/', data)
    return response.data
  },

  // Update department
  updateDepartment: async (id: string, data: any) => {
    const response = await api.patch(`/organization/departments/${id}/`, data)
    return response.data
  },

  // Delete department
  deleteDepartment: async (id: string) => {
    await api.delete(`/organization/departments/${id}/`)
  },

  // Get all positions
  getPositions: async () => {
    const response = await api.get('/organization/positions/')
    return response.data.results || response.data
  },

  // Create position
  createPosition: async (data: any) => {
    const response = await api.post('/organization/positions/', data)
    return response.data
  },

  // Update position
  updatePosition: async (id: string, data: any) => {
    const response = await api.patch(`/organization/positions/${id}/`, data)
    return response.data
  },

  // Delete position
  deletePosition: async (id: string) => {
    await api.delete(`/organization/positions/${id}/`)
  },

  // Get all grades
  getGrades: async () => {
    const response = await api.get('/organization/grades/')
    return response.data.results || response.data
  },

  // Create grade
  createGrade: async (data: any) => {
    const response = await api.post('/organization/grades/', data)
    return response.data
  },

  // Update grade
  updateGrade: async (id: string, data: any) => {
    const response = await api.patch(`/organization/grades/${id}/`, data)
    return response.data
  },

  // Delete grade
  deleteGrade: async (id: string) => {
    await api.delete(`/organization/grades/${id}/`)
  },

  // Upload employee photo
  uploadPhoto: async (id: string, file: File) => {
    const formData = new FormData()
    formData.append('photo', file)
    const response = await api.patch(`/employees/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  // Get employee statistics
  getStats: async () => {
    const response = await api.get('/employees/stats/')
    return response.data
  },

  // Export employees
  export: async (format: 'xlsx' | 'pdf' | 'csv' = 'xlsx', filters: EmployeeFilters = {}) => {
    const response = await api.get('/employees/export/', {
      params: { format, ...filters },
      responseType: 'blob',
    })
    return response.data
  },
}
