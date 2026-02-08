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

  // ==================== Units ====================

  getUnits: async (params?: Record<string, any>) => {
    const response = await api.get('/organization/units/', { params })
    return response.data.results || response.data
  },

  createUnit: async (data: any) => {
    const response = await api.post('/organization/units/', data)
    return response.data
  },

  updateUnit: async (id: string, data: any) => {
    const response = await api.patch(`/organization/units/${id}/`, data)
    return response.data
  },

  deleteUnit: async (id: string) => {
    await api.delete(`/organization/units/${id}/`)
  },

  // ==================== Categories ====================

  getCategories: async (params?: Record<string, any>) => {
    const response = await api.get('/organization/categories/', { params })
    return response.data.results || response.data
  },

  createCategory: async (data: any) => {
    const response = await api.post('/organization/categories/', data)
    return response.data
  },

  updateCategory: async (id: string, data: any) => {
    const response = await api.patch(`/organization/categories/${id}/`, data)
    return response.data
  },

  deleteCategory: async (id: string) => {
    await api.delete(`/organization/categories/${id}/`)
  },

  // ==================== Cost Centers ====================

  getCostCenters: async (params?: Record<string, any>) => {
    const response = await api.get('/organization/cost-centers/', { params })
    return response.data.results || response.data
  },

  createCostCenter: async (data: any) => {
    const response = await api.post('/organization/cost-centers/', data)
    return response.data
  },

  updateCostCenter: async (id: string, data: any) => {
    const response = await api.patch(`/organization/cost-centers/${id}/`, data)
    return response.data
  },

  deleteCostCenter: async (id: string) => {
    await api.delete(`/organization/cost-centers/${id}/`)
  },

  // ==================== Locations ====================

  getLocations: async (params?: Record<string, any>) => {
    const response = await api.get('/organization/locations/', { params })
    return response.data.results || response.data
  },

  createLocation: async (data: any) => {
    const response = await api.post('/organization/locations/', data)
    return response.data
  },

  updateLocation: async (id: string, data: any) => {
    const response = await api.patch(`/organization/locations/${id}/`, data)
    return response.data
  },

  deleteLocation: async (id: string) => {
    await api.delete(`/organization/locations/${id}/`)
  },

  // ==================== Holidays ====================

  getHolidays: async (params?: Record<string, any>) => {
    const response = await api.get('/organization/holidays/', { params })
    return response.data.results || response.data
  },

  createHoliday: async (data: any) => {
    const response = await api.post('/organization/holidays/', data)
    return response.data
  },

  updateHoliday: async (id: string, data: any) => {
    const response = await api.patch(`/organization/holidays/${id}/`, data)
    return response.data
  },

  deleteHoliday: async (id: string) => {
    await api.delete(`/organization/holidays/${id}/`)
  },

  // ==================== Read-only: Chart, Regions, Districts ====================

  getOrgChart: async () => {
    const response = await api.get('/organization/chart/')
    return response.data
  },

  getRegions: async () => {
    const response = await api.get('/organization/regions/')
    return response.data.results || response.data
  },

  getDistricts: async (regionId?: string) => {
    const params = regionId ? { region: regionId } : {}
    const response = await api.get('/organization/districts/', { params })
    return response.data.results || response.data
  },

  // Upload employee photo
  uploadPhoto: async (id: string, file: File): Promise<{ message: string; photo_url: string }> => {
    const formData = new FormData()
    formData.append('photo', file)
    const response = await api.post(`/employees/${id}/upload_photo/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  // Delete employee photo
  deletePhoto: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/employees/${id}/delete_photo/`)
    return response.data
  },

  // Get employee photo
  getPhoto: async (id: string): Promise<{ photo_url: string; photo_name: string; photo_type: string }> => {
    const response = await api.get(`/employees/${id}/photo/`)
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
