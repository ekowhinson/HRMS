import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { employeeService } from '@/services/employees'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'

interface EmployeeFormData {
  first_name: string
  middle_name: string
  last_name: string
  personal_email: string
  work_email: string
  mobile_phone: string
  date_of_birth: string
  gender: string
  marital_status: string
  nationality: string
  ghana_card_number: string
  ssnit_number: string
  tin_number: string
  residential_address: string
  employment_type: string
  status: string
  date_of_joining: string
  department: string
  position: string
  grade: string
  supervisor: string
  work_location: string
  bank_name: string
  bank_branch: string
  bank_account_number: string
}

const initialFormData: EmployeeFormData = {
  first_name: '',
  middle_name: '',
  last_name: '',
  personal_email: '',
  work_email: '',
  mobile_phone: '',
  date_of_birth: '',
  gender: '',
  marital_status: '',
  nationality: 'Ghanaian',
  ghana_card_number: '',
  ssnit_number: '',
  tin_number: '',
  residential_address: '',
  employment_type: 'PERMANENT',
  status: 'ACTIVE',
  date_of_joining: '',
  department: '',
  position: '',
  grade: '',
  supervisor: '',
  work_location: '',
  bank_name: '',
  bank_branch: '',
  bank_account_number: '',
}

export default function EmployeeFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = !!id

  const [formData, setFormData] = useState<EmployeeFormData>(initialFormData)
  const [activeSection, setActiveSection] = useState(0)

  const { data: employee, isLoading: loadingEmployee } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeeService.getById(id!),
    enabled: isEdit,
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: employeeService.getDepartments,
  })

  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: employeeService.getPositions,
  })

  const { data: grades } = useQuery({
    queryKey: ['grades'],
    queryFn: employeeService.getGrades,
  })

  useEffect(() => {
    if (employee) {
      const emp = employee as any
      setFormData({
        first_name: emp.first_name || '',
        middle_name: emp.middle_name || '',
        last_name: emp.last_name || '',
        personal_email: emp.personal_email || '',
        work_email: emp.work_email || '',
        mobile_phone: emp.mobile_phone || emp.phone_number || '',
        date_of_birth: emp.date_of_birth || '',
        gender: emp.gender || '',
        marital_status: emp.marital_status || '',
        nationality: emp.nationality || 'Ghanaian',
        ghana_card_number: emp.ghana_card_number || '',
        ssnit_number: emp.ssnit_number || '',
        tin_number: emp.tin_number || '',
        residential_address: emp.residential_address || '',
        employment_type: emp.employment_type || 'PERMANENT',
        status: emp.status || emp.employment_status || 'ACTIVE',
        date_of_joining: emp.date_of_joining || emp.date_of_hire || '',
        department: emp.department || '',
        position: emp.position || '',
        grade: emp.grade || '',
        supervisor: emp.supervisor || '',
        work_location: emp.work_location || '',
        bank_name: emp.bank_name || '',
        bank_branch: emp.bank_branch || '',
        bank_account_number: emp.bank_account_number || '',
      })
    }
  }, [employee])

  const createMutation = useMutation({
    mutationFn: employeeService.create,
    onSuccess: (data) => {
      toast.success('Employee created successfully')
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      navigate(`/employees/${data.id}`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create employee')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: EmployeeFormData) => employeeService.update(id!, data),
    onSuccess: () => {
      toast.success('Employee updated successfully')
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employee', id] })
      navigate(`/employees/${id}`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update employee')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEdit) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleChange = (field: keyof EmployeeFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const sections = [
    { title: 'Personal Information', id: 'personal' },
    { title: 'Contact Details', id: 'contact' },
    { title: 'Employment Details', id: 'employment' },
    { title: 'Bank Details', id: 'bank' },
  ]

  if (isEdit && loadingEmployee) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="bg-white rounded-xl h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/employees">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edit Employee' : 'Add New Employee'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isEdit ? 'Update employee information' : 'Enter employee details'}
          </p>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="border-b">
        <nav className="flex gap-4 overflow-x-auto">
          {sections.map((section, index) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(index)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeSection === index
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {section.title}
            </button>
          ))}
        </nav>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Personal Information */}
        {activeSection === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="First Name"
                  value={formData.first_name}
                  onChange={(e) => handleChange('first_name', e.target.value)}
                  required
                />
                <Input
                  label="Middle Name"
                  value={formData.middle_name}
                  onChange={(e) => handleChange('middle_name', e.target.value)}
                />
                <Input
                  label="Last Name"
                  value={formData.last_name}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  required
                />
                <Input
                  label="Date of Birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => handleChange('date_of_birth', e.target.value)}
                  required
                />
                <Select
                  label="Gender"
                  value={formData.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  options={[
                    { value: '', label: 'Select Gender' },
                    { value: 'M', label: 'Male' },
                    { value: 'F', label: 'Female' },
                  ]}
                />
                <Select
                  label="Marital Status"
                  value={formData.marital_status}
                  onChange={(e) => handleChange('marital_status', e.target.value)}
                  options={[
                    { value: '', label: 'Select Status' },
                    { value: 'SINGLE', label: 'Single' },
                    { value: 'MARRIED', label: 'Married' },
                    { value: 'DIVORCED', label: 'Divorced' },
                    { value: 'WIDOWED', label: 'Widowed' },
                    { value: 'SEPARATED', label: 'Separated' },
                  ]}
                />
                <Input
                  label="Nationality"
                  value={formData.nationality}
                  onChange={(e) => handleChange('nationality', e.target.value)}
                />
                <Input
                  label="Ghana Card Number"
                  value={formData.ghana_card_number}
                  onChange={(e) => handleChange('ghana_card_number', e.target.value)}
                  placeholder="GHA-XXXXXXXXX-X"
                />
                <Input
                  label="SSNIT Number"
                  value={formData.ssnit_number}
                  onChange={(e) => handleChange('ssnit_number', e.target.value)}
                />
                <Input
                  label="TIN"
                  value={formData.tin_number}
                  onChange={(e) => handleChange('tin_number', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Details */}
        {activeSection === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Contact Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Personal Email"
                  type="email"
                  value={formData.personal_email}
                  onChange={(e) => handleChange('personal_email', e.target.value)}
                />
                <Input
                  label="Work Email"
                  type="email"
                  value={formData.work_email}
                  onChange={(e) => handleChange('work_email', e.target.value)}
                  required
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  value={formData.mobile_phone}
                  onChange={(e) => handleChange('mobile_phone', e.target.value)}
                  required
                />
                <Input
                  label="Work Location"
                  value={formData.work_location}
                  onChange={(e) => handleChange('work_location', e.target.value)}
                />
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Residential Address
                  </label>
                  <textarea
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    rows={3}
                    value={formData.residential_address}
                    onChange={(e) => handleChange('residential_address', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Employment Details */}
        {activeSection === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Employment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Date of Joining"
                  type="date"
                  value={formData.date_of_joining}
                  onChange={(e) => handleChange('date_of_joining', e.target.value)}
                  required
                />
                <Select
                  label="Employment Type"
                  value={formData.employment_type}
                  onChange={(e) => handleChange('employment_type', e.target.value)}
                  options={[
                    { value: 'PERMANENT', label: 'Permanent' },
                    { value: 'CONTRACT', label: 'Contract' },
                    { value: 'TEMPORARY', label: 'Temporary' },
                    { value: 'INTERN', label: 'Intern' },
                  ]}
                />
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  options={[
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'PROBATION', label: 'On Probation' },
                    { value: 'SUSPENDED', label: 'Suspended' },
                    { value: 'ON_LEAVE', label: 'On Leave' },
                    { value: 'NOTICE', label: 'Notice Period' },
                  ]}
                />
                <Select
                  label="Department"
                  value={formData.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                  options={[
                    { value: '', label: 'Select Department' },
                    ...(departments?.map((d: any) => ({
                      value: d.id,
                      label: d.name,
                    })) || []),
                  ]}
                />
                <Select
                  label="Position"
                  value={formData.position}
                  onChange={(e) => handleChange('position', e.target.value)}
                  options={[
                    { value: '', label: 'Select Position' },
                    ...(positions?.map((p: any) => ({
                      value: p.id,
                      label: p.title,
                    })) || []),
                  ]}
                />
                <Select
                  label="Grade"
                  value={formData.grade}
                  onChange={(e) => handleChange('grade', e.target.value)}
                  options={[
                    { value: '', label: 'Select Grade' },
                    ...(grades?.map((g: any) => ({
                      value: g.id,
                      label: g.name,
                    })) || []),
                  ]}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bank Details */}
        {activeSection === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Bank Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Bank Name"
                  value={formData.bank_name}
                  onChange={(e) => handleChange('bank_name', e.target.value)}
                />
                <Input
                  label="Branch"
                  value={formData.bank_branch}
                  onChange={(e) => handleChange('bank_branch', e.target.value)}
                />
                <Input
                  label="Account Number"
                  value={formData.bank_account_number}
                  onChange={(e) => handleChange('bank_account_number', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form Actions */}
        <div className="flex justify-between pt-4">
          <div>
            {activeSection > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveSection(activeSection - 1)}
              >
                Previous
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Link to="/employees">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            {activeSection < sections.length - 1 ? (
              <Button
                type="button"
                onClick={() => setActiveSection(activeSection + 1)}
              >
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                isLoading={createMutation.isPending || updateMutation.isPending}
              >
                {isEdit ? 'Update Employee' : 'Create Employee'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
