import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeftIcon, BriefcaseIcon } from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import api from '@/lib/api'
import { employeeService } from '@/services/employees'

const employmentTypeOptions = [
  { value: 'PERMANENT', label: 'Permanent' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'TEMPORARY', label: 'Temporary' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'INTERNSHIP', label: 'Internship' },
]

const postingTypeOptions = [
  { value: 'BOTH', label: 'Internal & External' },
  { value: 'INTERNAL', label: 'Internal Only' },
  { value: 'EXTERNAL', label: 'External Only' },
]

const statusOptions = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

interface VacancyFormData {
  job_title: string
  position: string
  department: string
  grade: string
  work_location: string
  job_description: string
  requirements: string
  responsibilities: string
  qualifications: string
  experience_required: string
  skills_required: string
  number_of_positions: number
  employment_type: string
  posting_type: string
  status: string
  salary_range_min: string
  salary_range_max: string
  show_salary: boolean
  closing_date: string
  target_hire_date: string
  justification: string
  auto_shortlist: boolean
}

const initialFormData: VacancyFormData = {
  job_title: '',
  position: '',
  department: '',
  grade: '',
  work_location: '',
  job_description: '',
  requirements: '',
  responsibilities: '',
  qualifications: '',
  experience_required: '',
  skills_required: '',
  number_of_positions: 1,
  employment_type: 'PERMANENT',
  posting_type: 'BOTH',
  status: 'DRAFT',
  salary_range_min: '',
  salary_range_max: '',
  show_salary: false,
  closing_date: '',
  target_hire_date: '',
  justification: '',
  auto_shortlist: true,
}

export default function VacancyFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = !!id

  const [formData, setFormData] = useState<VacancyFormData>(initialFormData)

  // Fetch existing vacancy if editing
  const { data: existingVacancy, isLoading: isLoadingVacancy } = useQuery({
    queryKey: ['vacancy', id],
    queryFn: async () => {
      const response = await api.get(`/recruitment/vacancies/${id}/`)
      return response.data
    },
    enabled: isEditing,
  })

  // Fetch lookup data
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => employeeService.getDepartments(),
  })

  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: () => employeeService.getPositions(),
  })

  const { data: grades } = useQuery({
    queryKey: ['grades'],
    queryFn: () => employeeService.getGrades(),
  })

  const { data: locations } = useQuery({
    queryKey: ['work-locations'],
    queryFn: async () => {
      const response = await api.get('/organization/locations/')
      return response.data.results || response.data
    },
  })

  // Populate form when editing
  useEffect(() => {
    if (existingVacancy) {
      setFormData({
        job_title: existingVacancy.job_title || '',
        position: existingVacancy.position || '',
        department: existingVacancy.department || '',
        grade: existingVacancy.grade || '',
        work_location: existingVacancy.work_location || '',
        job_description: existingVacancy.job_description || '',
        requirements: existingVacancy.requirements || '',
        responsibilities: existingVacancy.responsibilities || '',
        qualifications: existingVacancy.qualifications || '',
        experience_required: existingVacancy.experience_required || '',
        skills_required: existingVacancy.skills_required || '',
        number_of_positions: existingVacancy.number_of_positions || 1,
        employment_type: existingVacancy.employment_type || 'PERMANENT',
        posting_type: existingVacancy.posting_type || 'BOTH',
        status: existingVacancy.status || 'DRAFT',
        salary_range_min: existingVacancy.salary_range_min || '',
        salary_range_max: existingVacancy.salary_range_max || '',
        show_salary: existingVacancy.show_salary ?? false,
        closing_date: existingVacancy.closing_date || '',
        target_hire_date: existingVacancy.target_hire_date || '',
        justification: existingVacancy.justification || '',
        auto_shortlist: existingVacancy.auto_shortlist ?? true,
      })
    }
  }, [existingVacancy])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const response = await api.post('/recruitment/vacancies/', data)
      return response.data
    },
    onSuccess: (data) => {
      toast.success('Vacancy created successfully')
      queryClient.invalidateQueries({ queryKey: ['vacancies'] })
      navigate(`/admin/recruitment/vacancies/${data.id}`)
    },
    onError: (error: any) => {
      const detail = error.response?.data
      if (detail && typeof detail === 'object') {
        const messages = Object.entries(detail)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join('\n')
        toast.error(messages || 'Failed to create vacancy')
      } else {
        toast.error('Failed to create vacancy')
      }
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const response = await api.patch(`/recruitment/vacancies/${id}/`, data)
      return response.data
    },
    onSuccess: () => {
      toast.success('Vacancy updated successfully')
      queryClient.invalidateQueries({ queryKey: ['vacancies'] })
      queryClient.invalidateQueries({ queryKey: ['vacancy', id] })
      navigate(`/admin/recruitment/vacancies/${id}`)
    },
    onError: (error: any) => {
      const detail = error.response?.data
      if (detail && typeof detail === 'object') {
        const messages = Object.entries(detail)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join('\n')
        toast.error(messages || 'Failed to update vacancy')
      } else {
        toast.error('Failed to update vacancy')
      }
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.job_title || !formData.position || !formData.department || !formData.job_description || !formData.requirements) {
      toast.error('Please fill in all required fields')
      return
    }

    const submitData: Record<string, any> = {
      ...formData,
      grade: formData.grade || null,
      work_location: formData.work_location || null,
      salary_range_min: formData.salary_range_min || null,
      salary_range_max: formData.salary_range_max || null,
      closing_date: formData.closing_date || null,
      target_hire_date: formData.target_hire_date || null,
    }

    if (isEditing) {
      updateMutation.mutate(submitData)
    } else {
      createMutation.mutate(submitData)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const departmentOptions = [
    { value: '', label: 'Select department...' },
    ...(departments?.map((d: any) => ({ value: String(d.id), label: d.name })) || []),
  ]

  const positionOptions = [
    { value: '', label: 'Select position...' },
    ...(positions?.map((p: any) => ({ value: String(p.id), label: p.name || p.title })) || []),
  ]

  const gradeOptions = [
    { value: '', label: 'Select grade (optional)...' },
    ...(grades?.map((g: any) => ({ value: String(g.id), label: g.name })) || []),
  ]

  const locationOptions = [
    { value: '', label: 'Select location (optional)...' },
    ...(locations?.map((l: any) => ({ value: String(l.id), label: l.name })) || []),
  ]

  if (isEditing && isLoadingVacancy) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/admin/recruitment')}>
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Vacancy' : 'Create New Vacancy'}
          </h1>
          <p className="text-sm text-gray-500">
            {isEditing ? 'Update vacancy details' : 'Post a new job vacancy'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BriefcaseIcon className="h-5 w-5 mr-2 text-primary-500" />
                  Job Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Job Title"
                  name="job_title"
                  value={formData.job_title}
                  onChange={handleChange}
                  placeholder="e.g., Senior Software Engineer"
                  required
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Position"
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    options={positionOptions}
                    required
                  />
                  <Select
                    label="Department"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    options={departmentOptions}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Grade"
                    name="grade"
                    value={formData.grade}
                    onChange={handleChange}
                    options={gradeOptions}
                  />
                  <Select
                    label="Work Location"
                    name="work_location"
                    value={formData.work_location}
                    onChange={handleChange}
                    options={locationOptions}
                  />
                </div>
                <Textarea
                  label="Job Description"
                  name="job_description"
                  value={formData.job_description}
                  onChange={handleChange}
                  placeholder="Describe the role and responsibilities..."
                  rows={4}
                />
                <Textarea
                  label="Requirements"
                  name="requirements"
                  value={formData.requirements}
                  onChange={handleChange}
                  placeholder="List the requirements for this role..."
                  rows={3}
                />
                <Textarea
                  label="Responsibilities"
                  name="responsibilities"
                  value={formData.responsibilities}
                  onChange={handleChange}
                  placeholder="Key responsibilities..."
                  rows={3}
                />
                <Textarea
                  label="Qualifications"
                  name="qualifications"
                  value={formData.qualifications}
                  onChange={handleChange}
                  placeholder="Required qualifications..."
                  rows={3}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Experience Required"
                    name="experience_required"
                    value={formData.experience_required}
                    onChange={handleChange}
                    placeholder="e.g., 3-5 years"
                  />
                  <Input
                    label="Number of Positions"
                    name="number_of_positions"
                    type="number"
                    value={formData.number_of_positions}
                    onChange={handleChange}
                    min={1}
                  />
                </div>
                <Textarea
                  label="Skills Required"
                  name="skills_required"
                  value={formData.skills_required}
                  onChange={handleChange}
                  placeholder="List required skills..."
                  rows={2}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Posting Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label="Status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  options={statusOptions}
                />
                <Select
                  label="Employment Type"
                  name="employment_type"
                  value={formData.employment_type}
                  onChange={handleChange}
                  options={employmentTypeOptions}
                />
                <Select
                  label="Posting Type"
                  name="posting_type"
                  value={formData.posting_type}
                  onChange={handleChange}
                  options={postingTypeOptions}
                />
                <Input
                  label="Closing Date"
                  name="closing_date"
                  type="date"
                  value={formData.closing_date}
                  onChange={handleChange}
                />
                <Input
                  label="Target Hire Date"
                  name="target_hire_date"
                  type="date"
                  value={formData.target_hire_date}
                  onChange={handleChange}
                />
                <div className="pt-2 border-t">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="auto_shortlist"
                      name="auto_shortlist"
                      checked={formData.auto_shortlist}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          auto_shortlist: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="auto_shortlist" className="ml-2 text-sm text-gray-700">
                      Enable auto-shortlisting
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    Automatically evaluate and shortlist applicants who meet the defined criteria
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Salary & Budget</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Salary Range Min"
                  name="salary_range_min"
                  type="number"
                  value={formData.salary_range_min}
                  onChange={handleChange}
                  placeholder="0.00"
                />
                <Input
                  label="Salary Range Max"
                  name="salary_range_max"
                  type="number"
                  value={formData.salary_range_max}
                  onChange={handleChange}
                  placeholder="0.00"
                />
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="show_salary"
                    name="show_salary"
                    checked={formData.show_salary}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        show_salary: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="show_salary" className="ml-2 text-sm text-gray-700">
                    Show salary on job posting
                  </label>
                </div>
                <Textarea
                  label="Justification"
                  name="justification"
                  value={formData.justification}
                  onChange={handleChange}
                  placeholder="Reason for this vacancy..."
                  rows={3}
                />
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/admin/recruitment')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                isLoading={createMutation.isPending || updateMutation.isPending}
              >
                {isEditing ? 'Update Vacancy' : 'Create Vacancy'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
