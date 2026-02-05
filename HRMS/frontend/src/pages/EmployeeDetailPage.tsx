import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeftIcon,
  PencilIcon,
  UserIcon,
  BriefcaseIcon,
  AcademicCapIcon,
  DocumentTextIcon,
  BanknotesIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  PauseIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'
import { employeeService } from '@/services/employees'
import { transactionsService } from '@/services/transactions'
import { leaveService } from '@/services/leave'
import type { PayComponent, EmployeeTransaction, LeaveRequest } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import { formatCurrency } from '@/lib/utils'

type TabType = 'personal' | 'employment' | 'education' | 'documents' | 'salary' | 'leave' | 'transactions'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE: 'success',
  PROBATION: 'warning',
  ON_LEAVE: 'info',
  SUSPENDED: 'danger',
  NOTICE: 'warning',
  TERMINATED: 'danger',
  RESIGNED: 'default',
  RETIRED: 'info',
  DECEASED: 'danger',
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<TabType>('personal')

  const { data: employee, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeeService.getById(id!),
    enabled: !!id,
  })

  // Transaction queries
  const queryClient = useQueryClient()
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [selectedComponent, setSelectedComponent] = useState<string>('')
  const [overrideType, setOverrideType] = useState<'NONE' | 'FIXED' | 'PERCENTAGE' | 'FORMULA'>('NONE')
  const [overrideAmount, setOverrideAmount] = useState('')
  const [overridePercentage, setOverridePercentage] = useState('')
  const [overrideFormula, setOverrideFormula] = useState('')
  const [isRecurring, setIsRecurring] = useState(true)
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0])
  const [effectiveTo, setEffectiveTo] = useState('')
  const [description, setDescription] = useState('')

  const { data: employeeTransactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['employee-transactions', id],
    queryFn: () => transactionsService.getTransactions({ employee: id }),
    enabled: !!id,
  })

  const { data: payComponents } = useQuery({
    queryKey: ['pay-components'],
    queryFn: () => transactionsService.getPayComponents({}),
  })

  // Leave requests query for the employee
  const { data: leaveRequestsData, isLoading: isLoadingLeaveRequests } = useQuery({
    queryKey: ['employee-leave-requests', id],
    queryFn: () => leaveService.getLeaveRequests({ employee: id }),
    enabled: !!id,
  })

  const createTransactionMutation = useMutation({
    mutationFn: (data: any) => transactionsService.createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-transactions', id] })
      setShowTransactionModal(false)
      resetTransactionForm()
    },
  })

  const approveTransactionMutation = useMutation({
    mutationFn: ({ txnId, notes }: { txnId: string; notes?: string }) =>
      transactionsService.approveTransaction(txnId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-transactions', id] })
    },
  })

  const rejectTransactionMutation = useMutation({
    mutationFn: ({ txnId, reason }: { txnId: string; reason: string }) =>
      transactionsService.rejectTransaction(txnId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-transactions', id] })
    },
  })

  const suspendTransactionMutation = useMutation({
    mutationFn: (txnId: string) => transactionsService.suspendTransaction(txnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-transactions', id] })
    },
  })

  const reactivateTransactionMutation = useMutation({
    mutationFn: (txnId: string) => transactionsService.reactivateTransaction(txnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-transactions', id] })
    },
  })

  const resetTransactionForm = () => {
    setSelectedComponent('')
    setOverrideType('NONE')
    setOverrideAmount('')
    setOverridePercentage('')
    setOverrideFormula('')
    setIsRecurring(true)
    setEffectiveFrom(new Date().toISOString().split('T')[0])
    setEffectiveTo('')
    setDescription('')
  }

  const handleCreateTransaction = () => {
    const data: any = {
      employee: id,
      pay_component: selectedComponent,
      override_type: overrideType,
      is_recurring: isRecurring,
      effective_from: effectiveFrom,
      description,
    }
    if (overrideType === 'FIXED') data.override_amount = overrideAmount
    if (overrideType === 'PERCENTAGE') data.override_percentage = overridePercentage
    if (overrideType === 'FORMULA') data.override_formula = overrideFormula
    if (effectiveTo) data.effective_to = effectiveTo
    createTransactionMutation.mutate(data)
  }

  const getTransactionStatusColor = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
    const colors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
      PENDING: 'warning',
      APPROVED: 'info',
      ACTIVE: 'success',
      SUSPENDED: 'danger',
      COMPLETED: 'default',
      CANCELLED: 'danger',
      REJECTED: 'danger',
    }
    return colors[status] || 'default'
  }

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: UserIcon },
    { id: 'employment', label: 'Employment', icon: BriefcaseIcon },
    { id: 'education', label: 'Education', icon: AcademicCapIcon },
    { id: 'documents', label: 'Documents', icon: DocumentTextIcon },
    { id: 'salary', label: 'Salary', icon: BanknotesIcon },
    { id: 'leave', label: 'Leave', icon: CalendarIcon },
    { id: 'transactions', label: 'Transactions', icon: CurrencyDollarIcon },
  ]

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="bg-white rounded-xl h-64" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load employee</h2>
        <p className="text-sm text-gray-500 mb-4">
          {(error as any)?.message || 'Unable to fetch employee details.'}
        </p>
        <div className="flex gap-3">
          <Button onClick={() => refetch()}>Try Again</Button>
          <Link to="/employees">
            <Button variant="outline">Back to Employees</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Employee not found</p>
        <Link to="/employees" className="text-primary-600 hover:underline mt-2 inline-block">
          Back to Employees
        </Link>
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
      </div>

      {/* Employee Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <Avatar
              firstName={employee.first_name}
              lastName={employee.last_name}
              src={employee.photo}
              size="xl"
            />
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {employee.first_name} {employee.middle_name} {employee.last_name}
                </h1>
                <Badge variant={statusColors[(employee as any).status || employee.employment_status] || 'default'}>
                  {((employee as any).status || employee.employment_status || 'UNKNOWN').replace(/_/g, ' ')}
                </Badge>
              </div>
              <p className="text-gray-500 mt-1">{(employee as any).employee_number || employee.employee_id}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                <span>{(employee as any).position_title || employee.position_name || 'No Position'}</span>
                <span className="text-gray-300">|</span>
                <span>{employee.department_name || 'No Department'}</span>
                <span className="text-gray-300">|</span>
                <span>Grade: {employee.grade_name || 'Not Set'}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Link to={`/employees/${id}/edit`}>
                <Button variant="outline">
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'personal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Full Name</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {employee.first_name} {employee.middle_name} {employee.last_name}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Date of Birth</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {employee.date_of_birth
                      ? new Date(employee.date_of_birth).toLocaleDateString()
                      : '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Gender</dt>
                  <dd className="text-sm font-medium text-gray-900 capitalize">
                    {employee.gender || '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Marital Status</dt>
                  <dd className="text-sm font-medium text-gray-900 capitalize">
                    {employee.marital_status || '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Nationality</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {employee.nationality || '-'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Personal Email</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {employee.personal_email || '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Work Email</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {employee.work_email || '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Phone</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {(employee as any).mobile_phone || employee.phone_number || '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Address</dt>
                  <dd className="text-sm font-medium text-gray-900 text-right">
                    {employee.residential_address || '-'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>National IDs</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Ghana Card</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {employee.ghana_card_number || '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">SSNIT Number</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {employee.ssnit_number || '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">TIN</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {employee.tin_number || '-'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bank Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Bank Name</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {employee.bank_name || '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Branch</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {employee.bank_branch || '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Account Number</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {employee.bank_account_number || '-'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'employment' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Employment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Employee ID</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {(employee as any).employee_number || employee.employee_id}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Date of Hire</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {((employee as any).date_of_joining || employee.date_of_hire)
                      ? new Date((employee as any).date_of_joining || employee.date_of_hire).toLocaleDateString()
                      : '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Employment Type</dt>
                  <dd className="text-sm font-medium text-gray-900 capitalize">
                    {employee.employment_type?.replace(/_/g, ' ') || '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Status</dt>
                  <dd>
                    <Badge variant={statusColors[(employee as any).status || employee.employment_status] || 'default'}>
                      {((employee as any).status || employee.employment_status || 'UNKNOWN').replace(/_/g, ' ')}
                    </Badge>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Confirmation Date</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {((employee as any).date_of_confirmation || employee.confirmation_date)
                      ? new Date((employee as any).date_of_confirmation || employee.confirmation_date).toLocaleDateString()
                      : '-'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Position & Organization</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Position</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {(employee as any).position_title || employee.position_name || '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Department</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {employee.department_name || '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Grade</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {employee.grade_name || '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Reports To</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {(employee as any).supervisor_name || employee.reports_to_name || '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Work Location</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {(employee as any).work_location_name || employee.work_location || '-'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'education' && (
        <Card>
          <CardHeader>
            <CardTitle>Education History</CardTitle>
          </CardHeader>
          <CardContent>
            {employee.education?.length > 0 ? (
              <div className="space-y-4">
                {employee.education.map((edu: any, index: number) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900">{edu.degree}</h4>
                    <p className="text-sm text-gray-600">{edu.institution}</p>
                    <p className="text-sm text-gray-500">
                      {edu.start_year} - {edu.end_year || 'Present'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No education records found</p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'documents' && (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {employee.documents?.length > 0 ? (
              <div className="space-y-3">
                {employee.documents.map((doc: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                        <p className="text-xs text-gray-500">{doc.type}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No documents uploaded</p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'salary' && (
        <Card>
          <CardHeader>
            <CardTitle>Salary Information</CardTitle>
          </CardHeader>
          <CardContent>
            {employee.salary ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-600">Basic Salary</p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatCurrency(employee.salary.basic_salary)}
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600">Total Allowances</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {formatCurrency(employee.salary.total_allowances || 0)}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-600">Gross Salary</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {formatCurrency(employee.salary.gross_salary || 0)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No salary information available</p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'leave' && (
        <div className="space-y-6">
          {/* Leave Balances */}
          <Card>
            <CardHeader>
              <CardTitle>Leave Balances</CardTitle>
            </CardHeader>
            <CardContent>
              {employee.leave_balances?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {employee.leave_balances.map((balance: any, index: number) => {
                    const taken = balance.taken || 0
                    const entitlement = balance.total_entitlement || 0
                    const available = balance.available_balance || 0
                    const usedPercentage = entitlement > 0 ? (taken / entitlement) * 100 : 0

                    return (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-sm font-medium text-gray-700 mb-3">{balance.leave_type_name}</p>

                        {/* Days Left - Prominent Display */}
                        <div className="text-center mb-3">
                          <p className={`text-3xl font-bold ${available > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {available}
                          </p>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Days Left</p>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                          <div
                            className={`h-2 rounded-full ${usedPercentage > 80 ? 'bg-red-500' : usedPercentage > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(usedPercentage, 100)}%` }}
                          />
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="bg-white rounded p-2">
                            <p className="text-lg font-semibold text-gray-800">{taken}</p>
                            <p className="text-xs text-gray-500">Days Taken</p>
                          </div>
                          <div className="bg-white rounded p-2">
                            <p className="text-lg font-semibold text-gray-800">{entitlement}</p>
                            <p className="text-xs text-gray-500">Entitled</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No leave balances found</p>
              )}
            </CardContent>
          </Card>

          {/* Leave History */}
          <Card>
            <CardHeader>
              <CardTitle>Leave History</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingLeaveRequests ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-gray-200 rounded" />
                  ))}
                </div>
              ) : leaveRequestsData?.results && leaveRequestsData.results.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Leave Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Period
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Days
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reason
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {leaveRequestsData.results.map((request: LeaveRequest) => {
                        const statusColor: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
                          DRAFT: 'info',
                          PENDING: 'warning',
                          APPROVED: 'success',
                          REJECTED: 'danger',
                          CANCELLED: 'default',
                        }
                        const statusLabel: Record<string, string> = {
                          DRAFT: 'Plan',
                          PENDING: 'Pending',
                          APPROVED: 'Approved',
                          REJECTED: 'Rejected',
                          CANCELLED: 'Cancelled',
                        }

                        return (
                          <tr key={request.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-sm font-medium text-gray-900">
                                {request.leave_type_name}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              <div>
                                {new Date(request.start_date).toLocaleDateString()}
                                {request.start_date !== request.end_date && (
                                  <> - {new Date(request.end_date).toLocaleDateString()}</>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-sm font-semibold text-gray-900">
                                {request.number_of_days || request.days_requested || '-'} days
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge variant={statusColor[request.status] || 'default'}>
                                {statusLabel[request.status] || request.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                              {request.reason || '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No leave records found</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Employee Transactions</CardTitle>
              <Button onClick={() => setShowTransactionModal(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingTransactions ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded" />
                  ))}
                </div>
              ) : employeeTransactions?.results?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reference
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Transaction Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Effective Period
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {employeeTransactions.results.map((txn: EmployeeTransaction) => (
                        <tr key={txn.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {txn.reference_number}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{txn.component_name}</p>
                              <p className="text-xs text-gray-500">{txn.component_code}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge variant={txn.component_type === 'EARNING' ? 'success' : 'danger'}>
                              {txn.component_type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {txn.override_type === 'NONE' ? (
                              <span className="text-gray-500">Default</span>
                            ) : txn.override_type === 'PCT' ? (
                              `${txn.override_percentage}%`
                            ) : txn.override_type === 'FORMULA' ? (
                              <span className="font-mono text-xs">{txn.override_formula}</span>
                            ) : (
                              formatCurrency(Number(txn.override_amount) || 0)
                            )}
                            {txn.calculated_amount && (
                              <span className="block text-xs text-gray-500">
                                = {formatCurrency(parseFloat(txn.calculated_amount))}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            <div>
                              <p>{new Date(txn.effective_from).toLocaleDateString()}</p>
                              {txn.effective_to && (
                                <p className="text-xs">to {new Date(txn.effective_to).toLocaleDateString()}</p>
                              )}
                              <Badge variant={txn.is_recurring ? 'info' : 'default'} className="mt-1">
                                {txn.is_recurring ? 'Recurring' : 'One-time'}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge variant={getTransactionStatusColor(txn.status)}>
                              {txn.status_display || txn.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex gap-1">
                              {txn.status === 'PENDING' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => approveTransactionMutation.mutate({ txnId: txn.id })}
                                    title="Approve"
                                  >
                                    <CheckIcon className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const reason = prompt('Enter rejection reason:')
                                      if (reason) rejectTransactionMutation.mutate({ txnId: txn.id, reason })
                                    }}
                                    title="Reject"
                                  >
                                    <XMarkIcon className="h-4 w-4 text-red-600" />
                                  </Button>
                                </>
                              )}
                              {txn.status === 'ACTIVE' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => suspendTransactionMutation.mutate(txn.id)}
                                  title="Suspend"
                                >
                                  <PauseIcon className="h-4 w-4 text-yellow-600" />
                                </Button>
                              )}
                              {txn.status === 'SUSPENDED' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => reactivateTransactionMutation.mutate(txn.id)}
                                  title="Reactivate"
                                >
                                  <PlayIcon className="h-4 w-4 text-green-600" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No transactions attached to this employee</p>
              )}
            </CardContent>
          </Card>

          {/* Add Transaction Modal */}
          {showTransactionModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-semibold">Add Transaction</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Attach a transaction to {employee.first_name} {employee.last_name}
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Transaction Type
                    </label>
                    <select
                      value={selectedComponent}
                      onChange={(e) => setSelectedComponent(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select transaction type...</option>
                      {payComponents?.results?.map((comp: PayComponent) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.name} ({comp.code}) - {comp.component_type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Override Type
                    </label>
                    <select
                      value={overrideType}
                      onChange={(e) => setOverrideType(e.target.value as any)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="NONE">Use Default</option>
                      <option value="FIXED">Fixed Amount</option>
                      <option value="PERCENTAGE">Percentage</option>
                      <option value="FORMULA">Custom Formula</option>
                    </select>
                  </div>

                  {overrideType === 'FIXED' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount
                      </label>
                      <input
                        type="number"
                        value={overrideAmount}
                        onChange={(e) => setOverrideAmount(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                        placeholder="Enter amount"
                      />
                    </div>
                  )}

                  {overrideType === 'PERCENTAGE' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Percentage
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={overridePercentage}
                        onChange={(e) => setOverridePercentage(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                        placeholder="Enter percentage (e.g., 10 for 10%)"
                      />
                    </div>
                  )}

                  {overrideType === 'FORMULA' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Formula
                      </label>
                      <textarea
                        value={overrideFormula}
                        onChange={(e) => setOverrideFormula(e.target.value)}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                        placeholder="e.g., basic * 0.10 or min(gross * 0.05, 500)"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Variables: basic, gross. Functions: min(), max(), round(), abs()
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isRecurring}
                        onChange={(e) => setIsRecurring(e.target.checked)}
                        className="rounded border-gray-300 text-primary-600"
                      />
                      <span className="text-sm text-gray-700">Recurring Transaction</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Effective From
                      </label>
                      <input
                        type="date"
                        value={effectiveFrom}
                        onChange={(e) => setEffectiveFrom(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Effective To (Optional)
                      </label>
                      <input
                        type="date"
                        value={effectiveTo}
                        onChange={(e) => setEffectiveTo(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                      placeholder="Optional description or justification"
                    />
                  </div>
                </div>
                <div className="p-6 border-t flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowTransactionModal(false)
                      resetTransactionForm()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateTransaction}
                    disabled={!selectedComponent || createTransactionMutation.isPending}
                  >
                    {createTransactionMutation.isPending ? 'Creating...' : 'Create Transaction'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
