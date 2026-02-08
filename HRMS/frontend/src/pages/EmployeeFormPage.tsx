import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeftIcon, CameraIcon, TrashIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import { employeeService } from '@/services/employees'
import { payrollSetupService } from '@/services/payrollSetup'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import LinkedSelect from '@/components/ui/LinkedSelect'
import api from '@/lib/api'

interface EmployeeFormData {
  // Employee ID
  employee_number: string

  // Personal Information
  title: string
  first_name: string
  middle_name: string
  last_name: string
  maiden_name: string
  preferred_name: string
  date_of_birth: string
  gender: string
  marital_status: string
  nationality: string

  // National IDs
  ghana_card_number: string
  ssnit_number: string
  tin_number: string
  voter_id: string
  passport_number: string
  passport_expiry: string

  // Contact Information
  personal_email: string
  work_email: string
  mobile_phone: string
  home_phone: string
  work_phone: string

  // Address
  residential_address: string
  residential_city: string
  residential_region: string
  residential_district: string
  postal_address: string
  digital_address: string

  // Employment Details
  legacy_employee_id: string
  old_staff_number: string
  employment_type: string
  status: string
  assignment_status: string
  date_of_joining: string
  date_of_confirmation: string
  probation_end_date: string
  contract_start_date: string
  contract_end_date: string
  date_of_exit: string
  exit_reason: string
  retirement_date: string

  // Organization
  division: string
  directorate: string
  department: string
  position: string
  grade: string
  work_location: string
  cost_center: string
  supervisor: string

  // Salary Structure
  staff_category: string
  salary_notch: string

  // Medical
  blood_group: string
  medical_conditions: string
  disability: string

  // Bank Details
  bank_id: string
  branch_id: string
  account_number: string
  account_name: string
  account_type: string

  // Notes
  notes: string
}

const initialFormData: EmployeeFormData = {
  employee_number: '',
  title: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  maiden_name: '',
  preferred_name: '',
  date_of_birth: '',
  gender: '',
  marital_status: '',
  nationality: 'Ghanaian',
  ghana_card_number: '',
  ssnit_number: '',
  tin_number: '',
  voter_id: '',
  passport_number: '',
  passport_expiry: '',
  personal_email: '',
  work_email: '',
  mobile_phone: '',
  home_phone: '',
  work_phone: '',
  residential_address: '',
  residential_city: '',
  residential_region: '',
  residential_district: '',
  postal_address: '',
  digital_address: '',
  legacy_employee_id: '',
  old_staff_number: '',
  employment_type: 'PERMANENT',
  status: 'ACTIVE',
  assignment_status: 'ACTIVE',
  date_of_joining: '',
  date_of_confirmation: '',
  probation_end_date: '',
  contract_start_date: '',
  contract_end_date: '',
  date_of_exit: '',
  exit_reason: '',
  retirement_date: '',
  division: '',
  directorate: '',
  department: '',
  position: '',
  grade: '',
  work_location: '',
  cost_center: '',
  supervisor: '',
  staff_category: '',
  salary_notch: '',
  blood_group: '',
  medical_conditions: '',
  disability: '',
  bank_id: '',
  branch_id: '',
  account_number: '',
  account_name: '',
  account_type: 'SAVINGS',
  notes: '',
}

export default function EmployeeFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = !!id

  const [formData, setFormData] = useState<EmployeeFormData>(initialFormData)
  const [activeSection, setActiveSection] = useState(0)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [useManualId, setUseManualId] = useState(false)

  // Fetch employee ID config for auto-generation
  const { data: empIdConfig } = useQuery({
    queryKey: ['employee-id-config'],
    queryFn: async () => {
      const res = await api.get('/core/employee-id-config/')
      return res.data as {
        prefix: string
        suffix: string
        next_number: number
        increment: number
        padding: number
        auto_generate: boolean
      }
    },
    enabled: !isEdit,
  })

  const nextIdPreview = empIdConfig
    ? `${empIdConfig.prefix}${String(empIdConfig.next_number).padStart(empIdConfig.padding, '0')}${empIdConfig.suffix}`
    : ''

  const { data: employee, isLoading: loadingEmployee } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeeService.getById(id!),
    enabled: isEdit,
  })

  // Organization data
  const { data: divisions } = useQuery({
    queryKey: ['divisions'],
    queryFn: async () => {
      const res = await api.get('/organization/divisions/')
      return res.data.results || res.data || []
    },
  })

  const { data: directorates } = useQuery({
    queryKey: ['directorates'],
    queryFn: async () => {
      const res = await api.get('/organization/directorates/')
      return res.data.results || res.data || []
    },
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => employeeService.getDepartments(),
  })

  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: employeeService.getPositions,
  })

  const { data: grades } = useQuery({
    queryKey: ['grades'],
    queryFn: employeeService.getGrades,
  })

  const { data: workLocations } = useQuery({
    queryKey: ['workLocations'],
    queryFn: async () => {
      const res = await api.get('/organization/work-locations/')
      return res.data.results || res.data || []
    },
  })

  const { data: costCenters } = useQuery({
    queryKey: ['costCenters'],
    queryFn: async () => {
      const res = await api.get('/organization/cost-centers/')
      return res.data.results || res.data || []
    },
  })

  const { data: regions } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const res = await api.get('/organization/regions/')
      return res.data.results || res.data || []
    },
  })

  const { data: districts } = useQuery({
    queryKey: ['districts', formData.residential_region],
    queryFn: async () => {
      const params: Record<string, string> = { page_size: '100' }
      if (formData.residential_region) params.region = formData.residential_region
      const res = await api.get('/organization/districts/', { params })
      return res.data.results || res.data || []
    },
  })

  const { data: employees } = useQuery({
    queryKey: ['employees-for-supervisor'],
    queryFn: async () => {
      const res = await api.get('/employees/', { params: { status: 'ACTIVE', page_size: 500 } })
      return res.data.results || res.data || []
    },
  })

  // Payroll data
  const { data: staffCategories } = useQuery({
    queryKey: ['staffCategories'],
    queryFn: async () => {
      const res = await api.get('/payroll/staff-categories/')
      return res.data.results || res.data || []
    },
  })

  const { data: salaryNotches } = useQuery({
    queryKey: ['salaryNotches'],
    queryFn: async () => {
      // Fetch all notches (override pagination) since we need them all for filtering
      const res = await api.get('/payroll/salary-notches/', { params: { page_size: 500 } })
      return res.data.results || res.data || []
    },
  })

  const { data: salaryBands } = useQuery({
    queryKey: ['salaryBands'],
    queryFn: async () => {
      const res = await api.get('/payroll/salary-bands/', { params: { page_size: 100 } })
      return res.data.results || res.data || []
    },
  })

  const { data: salaryLevels } = useQuery({
    queryKey: ['salaryLevels'],
    queryFn: async () => {
      const res = await api.get('/payroll/salary-levels/', { params: { page_size: 100 } })
      return res.data.results || res.data || []
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  const { data: banks, isLoading: loadingBanks } = useQuery({
    queryKey: ['banks'],
    queryFn: payrollSetupService.getBanks,
  })

  const { data: bankBranches, isLoading: loadingBranches } = useQuery({
    queryKey: ['bankBranches', formData.bank_id],
    queryFn: () => payrollSetupService.getBankBranches(formData.bank_id || undefined),
    enabled: true,
  })

  useEffect(() => {
    if (employee) {
      const emp = employee as any
      setFormData({
        employee_number: emp.employee_number || '',
        title: emp.title || '',
        first_name: emp.first_name || '',
        middle_name: emp.middle_name || '',
        last_name: emp.last_name || '',
        maiden_name: emp.maiden_name || '',
        preferred_name: emp.preferred_name || '',
        date_of_birth: emp.date_of_birth || '',
        gender: emp.gender || '',
        marital_status: emp.marital_status || '',
        nationality: emp.nationality || 'Ghanaian',
        ghana_card_number: emp.ghana_card_number || '',
        ssnit_number: emp.ssnit_number || '',
        tin_number: emp.tin_number || '',
        voter_id: emp.voter_id || '',
        passport_number: emp.passport_number || '',
        passport_expiry: emp.passport_expiry || '',
        personal_email: emp.personal_email || '',
        work_email: emp.work_email || '',
        mobile_phone: emp.mobile_phone || '',
        home_phone: emp.home_phone || '',
        work_phone: emp.work_phone || '',
        residential_address: emp.residential_address || '',
        residential_city: emp.residential_city || '',
        residential_region: emp.residential_region || '',
        residential_district: emp.residential_district || '',
        postal_address: emp.postal_address || '',
        digital_address: emp.digital_address || '',
        legacy_employee_id: emp.legacy_employee_id || '',
        old_staff_number: emp.old_staff_number || '',
        employment_type: emp.employment_type || 'PERMANENT',
        status: emp.status || 'ACTIVE',
        assignment_status: emp.assignment_status || 'ACTIVE',
        date_of_joining: emp.date_of_joining || '',
        date_of_confirmation: emp.date_of_confirmation || '',
        probation_end_date: emp.probation_end_date || '',
        contract_start_date: emp.contract_start_date || '',
        contract_end_date: emp.contract_end_date || '',
        date_of_exit: emp.date_of_exit || '',
        exit_reason: emp.exit_reason || '',
        retirement_date: emp.retirement_date || '',
        division: emp.division || '',
        directorate: emp.directorate || '',
        department: emp.department || '',
        position: emp.position || '',
        grade: emp.grade || '',
        work_location: emp.work_location || '',
        cost_center: emp.cost_center || '',
        supervisor: emp.supervisor || '',
        staff_category: emp.staff_category || '',
        salary_notch: emp.salary_notch || '',
        blood_group: emp.blood_group || '',
        medical_conditions: emp.medical_conditions || '',
        disability: emp.disability || '',
        // Bank account - get from bank_accounts_list
        bank_id: emp.bank_accounts_list?.[0]?.bank || '',
        branch_id: emp.bank_accounts_list?.[0]?.branch || '',
        account_number: emp.bank_accounts_list?.[0]?.account_number || emp.bank_account_number || '',
        account_name: emp.bank_accounts_list?.[0]?.account_name || '',
        account_type: emp.bank_accounts_list?.[0]?.account_type || 'SAVINGS',
        notes: emp.notes || '',
      })
      // Load existing photo if available
      if (emp.photo) {
        setPhotoPreview(emp.photo)
      } else if (emp.has_photo && id) {
        // Fetch photo from API if employee has one
        employeeService.getPhoto(id).then((res) => {
          if (res.photo_url) {
            setPhotoPreview(res.photo_url)
          }
        }).catch(() => {
          // Ignore errors - photo may not exist
        })
      }
    }
  }, [employee, id])

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
    // Clean up empty strings to null for optional fields
    const cleanedData = Object.fromEntries(
      Object.entries(formData).map(([key, value]) => [key, value === '' ? null : value])
    )
    // For create mode with auto-generate: omit employee_number so backend generates it
    if (!isEdit && empIdConfig?.auto_generate && !useManualId) {
      delete (cleanedData as any).employee_number
    }
    if (isEdit) {
      updateMutation.mutate(cleanedData as any)
    } else {
      createMutation.mutate(cleanedData as any)
    }
  }

  const handleChange = (field: keyof EmployeeFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Photo handling functions
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // If editing, upload immediately
    if (isEdit && id) {
      handlePhotoUpload(file)
    }
  }

  const handlePhotoUpload = async (file: File) => {
    if (!id) return

    setIsUploadingPhoto(true)
    try {
      const result = await employeeService.uploadPhoto(id, file)
      setPhotoPreview(result.photo_url)
      toast.success('Photo uploaded successfully')
      queryClient.invalidateQueries({ queryKey: ['employee', id] })
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to upload photo')
      // Revert preview if upload failed
      if (employee && (employee as any).photo) {
        setPhotoPreview((employee as any).photo)
      } else {
        setPhotoPreview(null)
      }
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handlePhotoDelete = async () => {
    if (!id) return

    setIsUploadingPhoto(true)
    try {
      await employeeService.deletePhoto(id)
      setPhotoPreview(null)
      toast.success('Photo deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['employee', id] })
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete photo')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const sections = [
    { title: 'Personal Info', id: 'personal' },
    { title: 'IDs & Documents', id: 'ids' },
    { title: 'Contact', id: 'contact' },
    { title: 'Address', id: 'address' },
    { title: 'Employment', id: 'employment' },
    { title: 'Organization', id: 'organization' },
    { title: 'Salary', id: 'salary' },
    { title: 'Medical', id: 'medical' },
    { title: 'Bank', id: 'bank' },
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
        <nav className="flex gap-2 overflow-x-auto pb-px">
          {sections.map((section, index) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(index)}
              className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
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
        {/* Section 0: Personal Information */}
        {activeSection === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Photo Upload Section */}
              <div className="flex items-start gap-6 mb-6 pb-6 border-b">
                <div className="relative">
                  <div className="h-32 w-32 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Employee photo"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserCircleIcon className="h-20 w-20 text-gray-400" />
                    )}
                    {isUploadingPhoto && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-full">
                        <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Employee Photo</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Upload a professional photo. Max size: 5MB. Supported formats: JPG, PNG, GIF.
                  </p>
                  <div className="flex gap-2">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploadingPhoto || (!isEdit)}
                    >
                      <CameraIcon className="h-4 w-4 mr-1" />
                      {photoPreview ? 'Change Photo' : 'Upload Photo'}
                    </Button>
                    {photoPreview && isEdit && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handlePhotoDelete}
                        disabled={isUploadingPhoto}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <TrashIcon className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                  {!isEdit && (
                    <p className="text-xs text-amber-600 mt-2">
                      Save the employee record first, then you can upload a photo.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  label="Title"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  options={[
                    { value: '', label: 'Select Title' },
                    { value: 'Mr.', label: 'Mr.' },
                    { value: 'Mrs.', label: 'Mrs.' },
                    { value: 'Ms.', label: 'Ms.' },
                    { value: 'Dr.', label: 'Dr.' },
                    { value: 'Prof.', label: 'Prof.' },
                    { value: 'Rev.', label: 'Rev.' },
                    { value: 'Hon.', label: 'Hon.' },
                  ]}
                />
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
                  label="Maiden Name"
                  value={formData.maiden_name}
                  onChange={(e) => handleChange('maiden_name', e.target.value)}
                />
                <Input
                  label="Preferred Name"
                  value={formData.preferred_name}
                  onChange={(e) => handleChange('preferred_name', e.target.value)}
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 1: IDs & Documents */}
        {activeSection === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>IDs & Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  label="TIN Number"
                  value={formData.tin_number}
                  onChange={(e) => handleChange('tin_number', e.target.value)}
                />
                <Input
                  label="Voter ID"
                  value={formData.voter_id}
                  onChange={(e) => handleChange('voter_id', e.target.value)}
                />
                <Input
                  label="Passport Number"
                  value={formData.passport_number}
                  onChange={(e) => handleChange('passport_number', e.target.value)}
                />
                <Input
                  label="Passport Expiry"
                  type="date"
                  value={formData.passport_expiry}
                  onChange={(e) => handleChange('passport_expiry', e.target.value)}
                />
                <Input
                  label="Legacy Employee ID"
                  value={formData.legacy_employee_id}
                  onChange={(e) => handleChange('legacy_employee_id', e.target.value)}
                />
                <Input
                  label="Old Staff Number"
                  value={formData.old_staff_number}
                  onChange={(e) => handleChange('old_staff_number', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 2: Contact */}
        {activeSection === 2 && (
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
                />
                <Input
                  label="Mobile Phone"
                  type="tel"
                  value={formData.mobile_phone}
                  onChange={(e) => handleChange('mobile_phone', e.target.value)}
                  required
                />
                <Input
                  label="Home Phone"
                  type="tel"
                  value={formData.home_phone}
                  onChange={(e) => handleChange('home_phone', e.target.value)}
                />
                <Input
                  label="Work Phone"
                  type="tel"
                  value={formData.work_phone}
                  onChange={(e) => handleChange('work_phone', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 3: Address */}
        {activeSection === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Address Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Residential Address
                  </label>
                  <textarea
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    rows={2}
                    value={formData.residential_address}
                    onChange={(e) => handleChange('residential_address', e.target.value)}
                  />
                </div>
                <Input
                  label="City/Town"
                  value={formData.residential_city}
                  onChange={(e) => handleChange('residential_city', e.target.value)}
                />
                <LinkedSelect
                  fieldKey="region"
                  label="Region"
                  value={formData.residential_region}
                  onChange={(e) => {
                    const newRegion = e.target.value
                    handleChange('residential_region', newRegion)
                    if (newRegion !== formData.residential_region) {
                      handleChange('residential_district', '')
                    }
                  }}
                  placeholder="Select Region"
                  options={(regions || []).map((r: any) => ({ value: r.id, label: r.name }))}
                />
                <LinkedSelect
                  fieldKey="district"
                  label="District"
                  value={formData.residential_district}
                  onChange={(e) => handleChange('residential_district', e.target.value)}
                  placeholder={formData.residential_region ? 'Select District' : 'Select Region first'}
                  options={(districts || []).map((d: any) => ({ value: d.id, label: d.name }))}
                />
                <Input
                  label="Digital Address (GPS)"
                  value={formData.digital_address}
                  onChange={(e) => handleChange('digital_address', e.target.value)}
                  placeholder="XX-XXX-XXXX"
                />
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Address
                  </label>
                  <textarea
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    rows={2}
                    value={formData.postal_address}
                    onChange={(e) => handleChange('postal_address', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 4: Employment */}
        {activeSection === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Employment Details</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Employee Number */}
              <div className="mb-6 pb-4 border-b">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Number
                </label>
                {isEdit ? (
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono max-w-xs">
                    {formData.employee_number || '—'}
                  </div>
                ) : empIdConfig?.auto_generate && !useManualId ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg text-sm font-mono text-primary-700">
                        {nextIdPreview || 'Loading...'}
                      </div>
                      <span className="text-xs text-gray-500">Auto-generated</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUseManualId(true)}
                      className="text-xs text-primary-600 hover:text-primary-800 underline"
                    >
                      Enter manually instead
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      value={formData.employee_number}
                      onChange={(e) => handleChange('employee_number', e.target.value)}
                      placeholder="Enter employee number"
                      required={!empIdConfig?.auto_generate}
                    />
                    {empIdConfig?.auto_generate && (
                      <button
                        type="button"
                        onClick={() => {
                          setUseManualId(false)
                          handleChange('employee_number', '')
                        }}
                        className="text-xs text-primary-600 hover:text-primary-800 underline"
                      >
                        Use auto-generated ID
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  label="Employment Type"
                  value={formData.employment_type}
                  onChange={(e) => handleChange('employment_type', e.target.value)}
                  options={[
                    { value: 'PERMANENT', label: 'Permanent' },
                    { value: 'CONTRACT', label: 'Contract' },
                    { value: 'TEMPORARY', label: 'Temporary' },
                    { value: 'INTERN', label: 'Intern' },
                    { value: 'CONSULTANT', label: 'Consultant' },
                    { value: 'PART_TIME', label: 'Part Time' },
                    { value: 'SECONDMENT', label: 'Secondment' },
                  ]}
                />
                <Select
                  label="Employment Status"
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  options={[
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'ON_LEAVE', label: 'On Leave' },
                    { value: 'SUSPENDED', label: 'Suspended' },
                    { value: 'PROBATION', label: 'On Probation' },
                    { value: 'NOTICE', label: 'Notice Period' },
                    { value: 'TERMINATED', label: 'Terminated' },
                    { value: 'RESIGNED', label: 'Resigned' },
                    { value: 'RETIRED', label: 'Retired' },
                    { value: 'DECEASED', label: 'Deceased' },
                  ]}
                />
                <Select
                  label="Assignment Status"
                  value={formData.assignment_status}
                  onChange={(e) => handleChange('assignment_status', e.target.value)}
                  options={[
                    { value: 'ACTIVE', label: 'Active Assignment' },
                    { value: 'SUSPENDED', label: 'Suspended Assignment' },
                    { value: 'ENDED', label: 'Ended Assignment' },
                    { value: 'PENDING', label: 'Pending Assignment' },
                  ]}
                />
                <Input
                  label="Date of Joining"
                  type="date"
                  value={formData.date_of_joining}
                  onChange={(e) => handleChange('date_of_joining', e.target.value)}
                  required
                />
                <Input
                  label="Date of Confirmation"
                  type="date"
                  value={formData.date_of_confirmation}
                  onChange={(e) => handleChange('date_of_confirmation', e.target.value)}
                />
                <Input
                  label="Probation End Date"
                  type="date"
                  value={formData.probation_end_date}
                  onChange={(e) => handleChange('probation_end_date', e.target.value)}
                />
                <Input
                  label="Contract Start Date"
                  type="date"
                  value={formData.contract_start_date}
                  onChange={(e) => handleChange('contract_start_date', e.target.value)}
                />
                <Input
                  label="Contract End Date"
                  type="date"
                  value={formData.contract_end_date}
                  onChange={(e) => handleChange('contract_end_date', e.target.value)}
                />
                <Input
                  label="Retirement Date"
                  type="date"
                  value={formData.retirement_date}
                  onChange={(e) => handleChange('retirement_date', e.target.value)}
                />
                <Input
                  label="Date of Exit"
                  type="date"
                  value={formData.date_of_exit}
                  onChange={(e) => handleChange('date_of_exit', e.target.value)}
                />
                <div className="md:col-span-2">
                  <Input
                    label="Exit Reason"
                    value={formData.exit_reason}
                    onChange={(e) => handleChange('exit_reason', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 5: Organization */}
        {activeSection === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>Organization Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LinkedSelect
                  fieldKey="division"
                  label="Division"
                  value={formData.division}
                  onChange={(e) => handleChange('division', e.target.value)}
                  placeholder="Select Division"
                  options={(divisions || []).map((d: any) => ({ value: d.id, label: d.name }))}
                />
                <LinkedSelect
                  fieldKey="directorate"
                  label="Directorate"
                  value={formData.directorate}
                  onChange={(e) => handleChange('directorate', e.target.value)}
                  placeholder="Select Directorate"
                  options={(directorates || []).map((d: any) => ({ value: d.id, label: d.name }))}
                />
                <LinkedSelect
                  fieldKey="department"
                  label="Department"
                  value={formData.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                  placeholder="Select Department"
                  options={(departments || []).map((d: any) => ({ value: d.id, label: d.name }))}
                />
                <LinkedSelect
                  fieldKey="position"
                  label="Position"
                  value={formData.position}
                  onChange={(e) => handleChange('position', e.target.value)}
                  placeholder="Select Position"
                  options={(positions || []).map((p: any) => ({ value: p.id, label: p.title }))}
                />
                <LinkedSelect
                  fieldKey="grade"
                  label="Grade"
                  value={formData.grade}
                  onChange={(e) => {
                    handleChange('grade', e.target.value)
                    // Clear salary_notch when grade changes (affects filtering)
                    handleChange('salary_notch', '')
                  }}
                  placeholder="Select Grade"
                  options={(grades || []).map((g: any) => ({
                    value: g.id,
                    label: `${g.name}${g.salary_band_name ? ` (${g.salary_band_name})` : ''}`
                  }))}
                />
                <LinkedSelect
                  fieldKey="work_location"
                  label="Work Location"
                  value={formData.work_location}
                  onChange={(e) => handleChange('work_location', e.target.value)}
                  placeholder="Select Work Location"
                  options={(workLocations || []).map((w: any) => ({ value: w.id, label: w.name }))}
                />
                <LinkedSelect
                  fieldKey="cost_center"
                  label="Cost Center"
                  value={formData.cost_center}
                  onChange={(e) => handleChange('cost_center', e.target.value)}
                  placeholder="Select Cost Center"
                  options={(costCenters || []).map((c: any) => ({ value: c.id, label: c.name }))}
                />
                <LinkedSelect
                  fieldKey="supervisor"
                  label="Supervisor"
                  value={formData.supervisor}
                  onChange={(e) => handleChange('supervisor', e.target.value)}
                  placeholder="Select Supervisor"
                  options={(employees || [])
                    .filter((e: any) => e.id !== id)
                    .map((e: any) => ({ value: e.id, label: `${e.employee_number} - ${e.full_name || `${e.first_name} ${e.last_name}`}` }))}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 6: Salary */}
        {activeSection === 6 && (
          <Card>
            <CardHeader>
              <CardTitle>Salary Structure</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                // Get the selected grade's linked salary structure
                const selectedGrade = (grades || []).find((g: any) => g.id === formData.grade)
                const gradeLinkedBandId = selectedGrade?.salary_band || null
                const gradeLinkedLevelId = selectedGrade?.salary_level || null

                // Get the selected staff category's linked salary band
                const selectedCategory = (staffCategories || []).find((c: any) => c.id === formData.staff_category)
                const categoryLinkedBandId = selectedCategory?.salary_band || null

                // Determine which band to use for filtering (grade takes priority)
                const effectiveBandId = gradeLinkedBandId || categoryLinkedBandId

                // Filter salary notches by band and/or level
                let filteredNotches = salaryNotches || []
                if (gradeLinkedLevelId) {
                  // If grade has a specific level linked, filter notches by that level
                  // Convert both to strings for comparison to handle UUID format differences
                  filteredNotches = filteredNotches.filter((n: any) =>
                    String(n.level).toLowerCase() === String(gradeLinkedLevelId).toLowerCase()
                  )
                } else if (effectiveBandId) {
                  // Otherwise filter by band
                  filteredNotches = filteredNotches.filter((n: any) =>
                    String(n.band_id).toLowerCase() === String(effectiveBandId).toLowerCase()
                  )
                }

                // Get linked structure names for display
                const linkedBand = (salaryBands || []).find((b: any) => b.id === effectiveBandId)
                const linkedLevel = (salaryLevels || []).find((l: any) => l.id === gradeLinkedLevelId)

                return (
                  <div className="space-y-4">
                    {/* Show linked structure info if grade has links */}
                    {(gradeLinkedBandId || categoryLinkedBandId) && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-700">
                          <strong>Linked Salary Structure:</strong>{' '}
                          {linkedBand && <span>Band: {linkedBand.name}</span>}
                          {linkedLevel && <span> → Level: {linkedLevel.name}</span>}
                          {!linkedBand && categoryLinkedBandId && <span>(from Staff Category)</span>}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Salary notch options are filtered based on the selected grade/category.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <LinkedSelect
                        fieldKey="staff_category"
                        label="Staff Category"
                        value={formData.staff_category}
                        onChange={(e) => {
                          handleChange('staff_category', e.target.value)
                          // Clear salary_notch if filter changes
                          if (!gradeLinkedBandId) {
                            handleChange('salary_notch', '')
                          }
                        }}
                        placeholder="Select Staff Category"
                        options={(staffCategories || []).map((c: any) => ({
                          value: c.id,
                          label: `${c.name}${c.salary_band_name ? ` (${c.salary_band_name})` : ''}`
                        }))}
                      />
                      <LinkedSelect
                        fieldKey="salary_notch"
                        label="Salary Notch"
                        value={formData.salary_notch}
                        onChange={(e) => handleChange('salary_notch', e.target.value)}
                        placeholder={filteredNotches.length === 0
                          ? 'No notches available for selected structure'
                          : 'Select Salary Notch'}
                        options={filteredNotches.map((n: any) => ({
                          value: n.id,
                          label: `${n.band_name || ''} / ${n.level_name || ''} / ${n.name || n.code} - GHS ${Number(n.amount || 0).toLocaleString()}`,
                        }))}
                      />
                    </div>

                    {/* Show current salary if notch is selected */}
                    {formData.salary_notch && (() => {
                      const selectedNotch = (salaryNotches || []).find((n: any) => n.id === formData.salary_notch)
                      if (selectedNotch) {
                        return (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
                            <p className="text-sm text-green-700">
                              <strong>Selected Salary:</strong> GHS {Number(selectedNotch.amount || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-green-600">
                              {selectedNotch.full_code || `${selectedNotch.band_code}/${selectedNotch.level_code}/${selectedNotch.code}`}
                            </p>
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        )}

        {/* Section 7: Medical */}
        {activeSection === 7 && (
          <Card>
            <CardHeader>
              <CardTitle>Medical Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Blood Group"
                  value={formData.blood_group}
                  onChange={(e) => handleChange('blood_group', e.target.value)}
                  options={[
                    { value: '', label: 'Select Blood Group' },
                    { value: 'A+', label: 'A+' },
                    { value: 'A-', label: 'A-' },
                    { value: 'B+', label: 'B+' },
                    { value: 'B-', label: 'B-' },
                    { value: 'AB+', label: 'AB+' },
                    { value: 'AB-', label: 'AB-' },
                    { value: 'O+', label: 'O+' },
                    { value: 'O-', label: 'O-' },
                  ]}
                />
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medical Conditions
                  </label>
                  <textarea
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    rows={3}
                    value={formData.medical_conditions}
                    onChange={(e) => handleChange('medical_conditions', e.target.value)}
                    placeholder="List any medical conditions..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Disability Information
                  </label>
                  <textarea
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    rows={3}
                    value={formData.disability}
                    onChange={(e) => handleChange('disability', e.target.value)}
                    placeholder="Describe any disabilities..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 8: Bank */}
        {activeSection === 8 && (
          <Card>
            <CardHeader>
              <CardTitle>Bank Details & Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <LinkedSelect
                  fieldKey="bank"
                  label="Bank Name"
                  value={formData.bank_id}
                  onChange={(e) => {
                    handleChange('bank_id', e.target.value)
                    handleChange('branch_id', '')
                  }}
                  placeholder="Select Bank"
                  isLoading={loadingBanks}
                  options={(banks || []).map((b) => ({ value: b.id, label: b.name }))}
                />
                <LinkedSelect
                  fieldKey="bank_branch"
                  label="Branch"
                  value={formData.branch_id}
                  onChange={(e) => handleChange('branch_id', e.target.value)}
                  placeholder={formData.bank_id ? 'Select Branch' : 'Select a bank first'}
                  isLoading={loadingBranches}
                  disabled={!formData.bank_id}
                  options={(bankBranches || [])
                    .filter((b) => !formData.bank_id || b.bank === formData.bank_id)
                    .map((b) => ({ value: b.id, label: b.name }))}
                />
                <Input
                  label="Account Number"
                  value={formData.account_number}
                  onChange={(e) => handleChange('account_number', e.target.value)}
                />
                <Input
                  label="Account Name"
                  value={formData.account_name}
                  onChange={(e) => handleChange('account_name', e.target.value)}
                  placeholder="Account holder name"
                />
                <Select
                  label="Account Type"
                  value={formData.account_type}
                  onChange={(e) => handleChange('account_type', e.target.value)}
                  options={[
                    { value: 'SAVINGS', label: 'Savings' },
                    { value: 'CURRENT', label: 'Current' },
                    { value: 'OTHER', label: 'Other' },
                  ]}
                />
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    rows={4}
                    value={formData.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    placeholder="Additional notes about the employee..."
                  />
                </div>
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
              <Button type="button" onClick={() => setActiveSection(activeSection + 1)}>
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
