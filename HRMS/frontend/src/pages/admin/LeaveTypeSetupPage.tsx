import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import { leaveService } from '@/services/leave'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Table from '@/components/ui/Table'
import type { LeaveType, LeaveAccrualType, LeaveGenderApplicability } from '@/types'

const accrualTypeOptions = [
  { value: 'NONE', label: 'No Accrual' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
  { value: 'ON_HIRE', label: 'On Hire Date' },
]

const genderOptions = [
  { value: 'A', label: 'All Employees' },
  { value: 'M', label: 'Male Only' },
  { value: 'F', label: 'Female Only' },
]

const statusFilterOptions = [
  { value: '', label: 'All Status' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

const paidFilterOptions = [
  { value: '', label: 'All Types' },
  { value: 'true', label: 'Paid Leave' },
  { value: 'false', label: 'Unpaid Leave' },
]

// Preset leave type templates
const leaveTypePresets: Record<string, Partial<LeaveTypeFormData>> = {
  annual: {
    code: 'ANNUAL',
    name: 'Annual Leave',
    description: 'Paid annual leave entitlement',
    default_days: '21',
    min_days_per_request: '0.5',
    accrual_type: 'YEARLY',
    allow_carry_forward: true,
    max_carry_forward_days: '5',
    is_paid: true,
    requires_approval: true,
    advance_notice_days: '7',
    color_code: '#3B82F6',
  },
  sick: {
    code: 'SICK',
    name: 'Sick Leave',
    description: 'Leave for illness or medical appointments',
    default_days: '15',
    min_days_per_request: '0.5',
    accrual_type: 'YEARLY',
    allow_carry_forward: false,
    is_paid: true,
    requires_approval: true,
    requires_document: true,
    document_required_after_days: '2',
    advance_notice_days: '0',
    is_emergency: true,
    color_code: '#EF4444',
  },
  maternity: {
    code: 'MATERNITY',
    name: 'Maternity Leave',
    description: 'Leave for pregnancy and childbirth',
    default_days: '84',
    min_days_per_request: '14',
    accrual_type: 'NONE',
    allow_carry_forward: false,
    is_paid: true,
    requires_approval: true,
    requires_document: true,
    applies_to_gender: 'F',
    consecutive_days_only: true,
    advance_notice_days: '30',
    color_code: '#EC4899',
  },
  paternity: {
    code: 'PATERNITY',
    name: 'Paternity Leave',
    description: 'Leave for fathers after childbirth',
    default_days: '14',
    min_days_per_request: '1',
    accrual_type: 'NONE',
    allow_carry_forward: false,
    is_paid: true,
    requires_approval: true,
    requires_document: true,
    applies_to_gender: 'M',
    advance_notice_days: '7',
    color_code: '#8B5CF6',
  },
  compassionate: {
    code: 'COMPASSIONATE',
    name: 'Compassionate Leave',
    description: 'Leave for bereavement or family emergencies',
    default_days: '5',
    min_days_per_request: '1',
    max_days_per_request: '5',
    accrual_type: 'NONE',
    allow_carry_forward: false,
    is_paid: true,
    requires_approval: true,
    requires_document: true,
    advance_notice_days: '0',
    is_emergency: true,
    color_code: '#6B7280',
  },
  study: {
    code: 'STUDY',
    name: 'Study Leave',
    description: 'Leave for educational purposes',
    default_days: '10',
    min_days_per_request: '1',
    accrual_type: 'YEARLY',
    allow_carry_forward: false,
    is_paid: true,
    requires_approval: true,
    requires_document: true,
    min_service_months: '12',
    advance_notice_days: '14',
    color_code: '#F59E0B',
  },
  unpaid: {
    code: 'UNPAID',
    name: 'Unpaid Leave',
    description: 'Leave without pay',
    default_days: '30',
    min_days_per_request: '1',
    accrual_type: 'NONE',
    allow_carry_forward: false,
    is_paid: false,
    requires_approval: true,
    advance_notice_days: '14',
    color_code: '#9CA3AF',
  },
}

interface LeaveTypeFormData {
  code: string
  name: string
  description: string
  // Entitlement
  default_days: string
  max_days: string
  min_days_per_request: string
  max_days_per_request: string
  // Accrual
  accrual_type: LeaveAccrualType
  accrual_rate: string
  // Carry forward
  allow_carry_forward: boolean
  max_carry_forward_days: string
  carry_forward_expiry_months: string
  // Encashment
  allow_encashment: boolean
  max_encashment_days: string
  // Rules
  is_paid: boolean
  requires_approval: boolean
  requires_document: boolean
  document_required_after_days: string
  min_service_months: string
  applies_to_gender: LeaveGenderApplicability
  max_instances_per_year: string
  consecutive_days_only: boolean
  include_weekends: boolean
  include_holidays: boolean
  advance_notice_days: string
  is_emergency: boolean
  // Display
  color_code: string
  sort_order: string
  is_active: boolean
}

const initialFormData: LeaveTypeFormData = {
  code: '',
  name: '',
  description: '',
  default_days: '0',
  max_days: '',
  min_days_per_request: '0.5',
  max_days_per_request: '',
  accrual_type: 'YEARLY',
  accrual_rate: '',
  allow_carry_forward: false,
  max_carry_forward_days: '',
  carry_forward_expiry_months: '',
  allow_encashment: false,
  max_encashment_days: '',
  is_paid: true,
  requires_approval: true,
  requires_document: false,
  document_required_after_days: '',
  min_service_months: '0',
  applies_to_gender: 'A',
  max_instances_per_year: '',
  consecutive_days_only: false,
  include_weekends: false,
  include_holidays: false,
  advance_notice_days: '0',
  is_emergency: false,
  color_code: '#3B82F6',
  sort_order: '0',
  is_active: true,
}

export default function LeaveTypeSetupPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({
    is_active: '',
    is_paid: '',
  })
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState<LeaveType | null>(null)
  const [editingType, setEditingType] = useState<LeaveType | null>(null)
  const [formData, setFormData] = useState<LeaveTypeFormData>(initialFormData)
  const [activeSection, setActiveSection] = useState<'basic' | 'accrual' | 'rules' | 'display'>('basic')

  const { data: leaveTypes, isLoading } = useQuery({
    queryKey: ['leave-types', filters],
    queryFn: () =>
      leaveService.getLeaveTypes({
        is_active: filters.is_active ? filters.is_active === 'true' : undefined,
        is_paid: filters.is_paid ? filters.is_paid === 'true' : undefined,
      }),
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<LeaveType>) => leaveService.createLeaveType(data),
    onSuccess: () => {
      toast.success('Leave type created')
      queryClient.invalidateQueries({ queryKey: ['leave-types'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create leave type')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LeaveType> }) =>
      leaveService.updateLeaveType(id, data),
    onSuccess: () => {
      toast.success('Leave type updated')
      queryClient.invalidateQueries({ queryKey: ['leave-types'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update leave type')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leaveService.deleteLeaveType(id),
    onSuccess: () => {
      toast.success('Leave type deleted')
      queryClient.invalidateQueries({ queryKey: ['leave-types'] })
      setShowDeleteModal(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete leave type')
    },
  })

  const handleOpenCreate = () => {
    setEditingType(null)
    setFormData(initialFormData)
    setActiveSection('basic')
    setShowModal(true)
  }

  const handleOpenEdit = (leaveType: LeaveType) => {
    setEditingType(leaveType)
    setFormData({
      code: leaveType.code,
      name: leaveType.name,
      description: leaveType.description || '',
      default_days: leaveType.default_days?.toString() || '0',
      max_days: leaveType.max_days?.toString() || '',
      min_days_per_request: leaveType.min_days_per_request?.toString() || '0.5',
      max_days_per_request: leaveType.max_days_per_request?.toString() || '',
      accrual_type: leaveType.accrual_type || 'YEARLY',
      accrual_rate: leaveType.accrual_rate?.toString() || '',
      allow_carry_forward: leaveType.allow_carry_forward || false,
      max_carry_forward_days: leaveType.max_carry_forward_days?.toString() || '',
      carry_forward_expiry_months: leaveType.carry_forward_expiry_months?.toString() || '',
      allow_encashment: leaveType.allow_encashment || false,
      max_encashment_days: leaveType.max_encashment_days?.toString() || '',
      is_paid: leaveType.is_paid,
      requires_approval: leaveType.requires_approval,
      requires_document: leaveType.requires_document || false,
      document_required_after_days: leaveType.document_required_after_days?.toString() || '',
      min_service_months: leaveType.min_service_months?.toString() || '0',
      applies_to_gender: leaveType.applies_to_gender || 'A',
      max_instances_per_year: leaveType.max_instances_per_year?.toString() || '',
      consecutive_days_only: leaveType.consecutive_days_only || false,
      include_weekends: leaveType.include_weekends || false,
      include_holidays: leaveType.include_holidays || false,
      advance_notice_days: leaveType.advance_notice_days?.toString() || '0',
      is_emergency: leaveType.is_emergency || false,
      color_code: leaveType.color_code || '#3B82F6',
      sort_order: leaveType.sort_order?.toString() || '0',
      is_active: leaveType.is_active,
    })
    setActiveSection('basic')
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingType(null)
    setFormData(initialFormData)
  }

  const handleLoadPreset = (preset: string) => {
    const presetData = leaveTypePresets[preset]
    if (presetData) {
      setFormData({
        ...initialFormData,
        ...presetData,
      } as LeaveTypeFormData)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const data: Partial<LeaveType> = {
      code: formData.code,
      name: formData.name,
      description: formData.description || undefined,
      default_days: parseFloat(formData.default_days) || 0,
      max_days: formData.max_days ? parseFloat(formData.max_days) : undefined,
      min_days_per_request: parseFloat(formData.min_days_per_request) || 0.5,
      max_days_per_request: formData.max_days_per_request ? parseFloat(formData.max_days_per_request) : undefined,
      accrual_type: formData.accrual_type,
      accrual_rate: formData.accrual_rate ? parseFloat(formData.accrual_rate) : undefined,
      allow_carry_forward: formData.allow_carry_forward,
      max_carry_forward_days: formData.max_carry_forward_days ? parseFloat(formData.max_carry_forward_days) : undefined,
      carry_forward_expiry_months: formData.carry_forward_expiry_months ? parseInt(formData.carry_forward_expiry_months) : undefined,
      allow_encashment: formData.allow_encashment,
      max_encashment_days: formData.max_encashment_days ? parseFloat(formData.max_encashment_days) : undefined,
      is_paid: formData.is_paid,
      requires_approval: formData.requires_approval,
      requires_document: formData.requires_document,
      document_required_after_days: formData.document_required_after_days ? parseInt(formData.document_required_after_days) : undefined,
      min_service_months: parseInt(formData.min_service_months) || 0,
      applies_to_gender: formData.applies_to_gender,
      max_instances_per_year: formData.max_instances_per_year ? parseInt(formData.max_instances_per_year) : undefined,
      consecutive_days_only: formData.consecutive_days_only,
      include_weekends: formData.include_weekends,
      include_holidays: formData.include_holidays,
      advance_notice_days: parseInt(formData.advance_notice_days) || 0,
      is_emergency: formData.is_emergency,
      color_code: formData.color_code,
      sort_order: parseInt(formData.sort_order) || 0,
      is_active: formData.is_active,
    }

    if (editingType) {
      updateMutation.mutate({ id: editingType.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Leave Type',
      render: (item: LeaveType) => (
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color_code || '#3B82F6' }}
          />
          <div>
            <div className="font-medium">{item.name}</div>
            <div className="text-xs text-gray-500">{item.code}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'entitlement',
      header: 'Entitlement',
      render: (item: LeaveType) => (
        <div className="text-sm">
          <span className="font-medium">{item.default_days}</span> days/year
          {item.max_days && <span className="text-gray-500"> (max {item.max_days})</span>}
        </div>
      ),
    },
    {
      key: 'accrual',
      header: 'Accrual',
      render: (item: LeaveType) => (
        <span className="text-sm">{item.accrual_type_display || item.accrual_type}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (item: LeaveType) => (
        <Badge variant={item.is_paid ? 'success' : 'warning'}>
          {item.is_paid ? 'Paid' : 'Unpaid'}
        </Badge>
      ),
    },
    {
      key: 'carry_forward',
      header: 'Carry Forward',
      render: (item: LeaveType) => (
        <span className="text-sm">
          {item.allow_carry_forward ? (
            <span className="text-green-600">
              Yes {item.max_carry_forward_days && `(max ${item.max_carry_forward_days} days)`}
            </span>
          ) : (
            <span className="text-gray-400">No</span>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: LeaveType) => (
        <Badge variant={item.is_active ? 'success' : 'danger'}>
          {item.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: LeaveType) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleOpenEdit(item)
            }}
            className="p-1 text-gray-500 hover:text-primary-600"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowDeleteModal(item)
            }}
            className="p-1 text-gray-500 hover:text-red-600"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  const sectionTabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'accrual', label: 'Accrual & Carry Forward' },
    { id: 'rules', label: 'Rules & Restrictions' },
    { id: 'display', label: 'Display Settings' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Types</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure leave types with entitlements, accrual rules, and restrictions
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Leave Type
        </Button>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <InformationCircleIcon className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-600">
              <p>
                <strong>Leave Types</strong> define the different categories of leave available to employees.
                Each type can have its own entitlement, accrual method, carry-forward rules, and eligibility criteria.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <Select
              value={filters.is_active}
              onChange={(e) => setFilters({ ...filters, is_active: e.target.value })}
              options={statusFilterOptions}
              className="w-36"
            />
            <Select
              value={filters.is_paid}
              onChange={(e) => setFilters({ ...filters, is_paid: e.target.value })}
              options={paidFilterOptions}
              className="w-36"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table
            data={leaveTypes || []}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No leave types configured. Click 'New Leave Type' to get started."
          />
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingType ? 'Edit Leave Type' : 'Create Leave Type'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Preset Templates (only for new) */}
          {!editingType && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">Quick Start Templates:</span>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(leaveTypePresets).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleLoadPreset(preset)}
                      className="px-2 py-1 text-xs bg-white border border-blue-300 rounded hover:bg-blue-100 capitalize"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4">
              {sectionTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSection(tab.id as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeSection === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Basic Info Section */}
          {activeSection === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., ANNUAL, SICK"
                  required
                  disabled={!!editingType}
                />
                <Input
                  label="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Annual Leave"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description of this leave type..."
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                <h4 className="font-medium text-gray-700">Entitlement</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Default Days Per Year"
                    type="number"
                    step="0.5"
                    value={formData.default_days}
                    onChange={(e) => setFormData({ ...formData, default_days: e.target.value })}
                    required
                  />
                  <Input
                    label="Maximum Days (Optional)"
                    type="number"
                    step="0.5"
                    value={formData.max_days}
                    onChange={(e) => setFormData({ ...formData, max_days: e.target.value })}
                    placeholder="Leave empty for unlimited"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Min Days Per Request"
                    type="number"
                    step="0.5"
                    value={formData.min_days_per_request}
                    onChange={(e) => setFormData({ ...formData, min_days_per_request: e.target.value })}
                  />
                  <Input
                    label="Max Days Per Request (Optional)"
                    type="number"
                    step="0.5"
                    value={formData.max_days_per_request}
                    onChange={(e) => setFormData({ ...formData, max_days_per_request: e.target.value })}
                    placeholder="Leave empty for no limit"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_paid}
                    onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm">Paid Leave</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm">Active</span>
                </label>
              </div>
            </div>
          )}

          {/* Accrual & Carry Forward Section */}
          {activeSection === 'accrual' && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-4">
                <h4 className="font-medium text-green-800">Accrual Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Accrual Type"
                    value={formData.accrual_type}
                    onChange={(e) => setFormData({ ...formData, accrual_type: e.target.value as LeaveAccrualType })}
                    options={accrualTypeOptions}
                  />
                  {formData.accrual_type !== 'NONE' && formData.accrual_type !== 'ON_HIRE' && (
                    <Input
                      label="Accrual Rate (Optional)"
                      type="number"
                      step="0.01"
                      value={formData.accrual_rate}
                      onChange={(e) => setFormData({ ...formData, accrual_rate: e.target.value })}
                      placeholder="Days per period"
                    />
                  )}
                </div>
                <p className="text-xs text-green-600">
                  {formData.accrual_type === 'NONE' && 'Leave balance is manually assigned, not earned over time.'}
                  {formData.accrual_type === 'MONTHLY' && 'Leave balance accrues each month (e.g., 1.75 days/month for 21 days/year).'}
                  {formData.accrual_type === 'QUARTERLY' && 'Leave balance accrues each quarter.'}
                  {formData.accrual_type === 'YEARLY' && 'Full entitlement is credited at the start of each year.'}
                  {formData.accrual_type === 'ON_HIRE' && 'Full entitlement is credited on employee hire date anniversary.'}
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                <h4 className="font-medium text-blue-800">Carry Forward</h4>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.allow_carry_forward}
                    onChange={(e) => setFormData({ ...formData, allow_carry_forward: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm">Allow unused leave to carry forward to next year</span>
                </label>
                {formData.allow_carry_forward && (
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Max Carry Forward Days"
                      type="number"
                      step="0.5"
                      value={formData.max_carry_forward_days}
                      onChange={(e) => setFormData({ ...formData, max_carry_forward_days: e.target.value })}
                      placeholder="Leave empty for unlimited"
                    />
                    <Input
                      label="Expiry (Months)"
                      type="number"
                      value={formData.carry_forward_expiry_months}
                      onChange={(e) => setFormData({ ...formData, carry_forward_expiry_months: e.target.value })}
                      placeholder="e.g., 3 months"
                    />
                  </div>
                )}
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-4">
                <h4 className="font-medium text-amber-800">Encashment</h4>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.allow_encashment}
                    onChange={(e) => setFormData({ ...formData, allow_encashment: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm">Allow employees to encash unused leave days</span>
                </label>
                {formData.allow_encashment && (
                  <Input
                    label="Max Encashment Days Per Year"
                    type="number"
                    step="0.5"
                    value={formData.max_encashment_days}
                    onChange={(e) => setFormData({ ...formData, max_encashment_days: e.target.value })}
                    placeholder="Leave empty for unlimited"
                  />
                )}
              </div>
            </div>
          )}

          {/* Rules & Restrictions Section */}
          {activeSection === 'rules' && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                <h4 className="font-medium text-gray-700">Approval & Documentation</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.requires_approval}
                      onChange={(e) => setFormData({ ...formData, requires_approval: e.target.checked })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm">Requires manager approval</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.requires_document}
                      onChange={(e) => setFormData({ ...formData, requires_document: e.target.checked })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm">Requires supporting document</span>
                  </label>
                  {formData.requires_document && (
                    <Input
                      label="Document Required After (Days)"
                      type="number"
                      value={formData.document_required_after_days}
                      onChange={(e) => setFormData({ ...formData, document_required_after_days: e.target.value })}
                      placeholder="e.g., 2 (for sick leave)"
                      className="mt-2"
                    />
                  )}
                </div>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-4">
                <h4 className="font-medium text-purple-800">Eligibility</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Min Service (Months)"
                    type="number"
                    value={formData.min_service_months}
                    onChange={(e) => setFormData({ ...formData, min_service_months: e.target.value })}
                    placeholder="0 for no restriction"
                  />
                  <Select
                    label="Applies To"
                    value={formData.applies_to_gender}
                    onChange={(e) => setFormData({ ...formData, applies_to_gender: e.target.value as LeaveGenderApplicability })}
                    options={genderOptions}
                  />
                </div>
                <Input
                  label="Max Instances Per Year"
                  type="number"
                  value={formData.max_instances_per_year}
                  onChange={(e) => setFormData({ ...formData, max_instances_per_year: e.target.value })}
                  placeholder="Leave empty for unlimited"
                />
              </div>

              <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-4">
                <h4 className="font-medium text-red-800">Restrictions</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.consecutive_days_only}
                      onChange={(e) => setFormData({ ...formData, consecutive_days_only: e.target.checked })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm">Must be taken as consecutive days (no split)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.include_weekends}
                      onChange={(e) => setFormData({ ...formData, include_weekends: e.target.checked })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm">Count weekends in leave duration</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.include_holidays}
                      onChange={(e) => setFormData({ ...formData, include_holidays: e.target.checked })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm">Count public holidays in leave duration</span>
                  </label>
                </div>
                <Input
                  label="Advance Notice (Working Days)"
                  type="number"
                  value={formData.advance_notice_days}
                  onChange={(e) => setFormData({ ...formData, advance_notice_days: e.target.value })}
                  placeholder="0 for no advance notice required"
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_emergency}
                    onChange={(e) => setFormData({ ...formData, is_emergency: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm">Emergency leave type (bypasses advance notice)</span>
                </label>
                <p className="text-xs text-gray-500 -mt-2 ml-6">
                  Enable for leave types like Sick or Compassionate that don't require advance notice even when a notice period is set.
                </p>
              </div>
            </div>
          )}

          {/* Display Settings Section */}
          {activeSection === 'display' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color Code</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.color_code}
                      onChange={(e) => setFormData({ ...formData, color_code: e.target.value })}
                      className="h-10 w-16 rounded border border-gray-300 cursor-pointer"
                    />
                    <Input
                      value={formData.color_code}
                      onChange={(e) => setFormData({ ...formData, color_code: e.target.value })}
                      placeholder="#3B82F6"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Used in calendar and reports</p>
                </div>
                <Input
                  label="Sort Order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                  placeholder="0"
                />
              </div>

              {/* Color Preview */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-700 mb-3">Preview</h4>
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: formData.color_code }}
                  />
                  <span className="font-medium">{formData.name || 'Leave Type Name'}</span>
                  <Badge variant={formData.is_paid ? 'success' : 'warning'}>
                    {formData.is_paid ? 'Paid' : 'Unpaid'}
                  </Badge>
                  <Badge variant={formData.is_active ? 'success' : 'danger'}>
                    {formData.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              {/* Predefined Colors */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quick Select</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { color: '#3B82F6', name: 'Blue' },
                    { color: '#10B981', name: 'Green' },
                    { color: '#EF4444', name: 'Red' },
                    { color: '#F59E0B', name: 'Amber' },
                    { color: '#8B5CF6', name: 'Purple' },
                    { color: '#EC4899', name: 'Pink' },
                    { color: '#06B6D4', name: 'Cyan' },
                    { color: '#6B7280', name: 'Gray' },
                  ].map(({ color, name }) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color_code: color })}
                      className={`w-8 h-8 rounded-full border-2 ${
                        formData.color_code === color ? 'border-gray-900' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      title={name}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingType ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteModal}
        onClose={() => setShowDeleteModal(null)}
        title="Delete Leave Type"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{showDeleteModal?.name}</strong>?
          </p>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              This action cannot be undone. Any leave policies and balances associated with this type will be affected.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowDeleteModal(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => showDeleteModal && deleteMutation.mutate(showDeleteModal.id)}
              isLoading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
