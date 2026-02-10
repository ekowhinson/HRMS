import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  PauseIcon,
  PlayIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { transactionsService } from '@/services/transactions'
import { employeeService } from '@/services/employees'
import { payrollSetupService } from '@/services/payrollSetup'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import LinkedSelect from '@/components/ui/LinkedSelect'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Table, { TablePagination } from '@/components/ui/Table'
import { formatCurrency } from '@/lib/utils'
import type {
  EmployeeTransaction,
  PayComponent,
  Employee,
  TransactionOverrideType,
  TransactionStatus,
} from '@/types'

const statusColors: Record<TransactionStatus, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  PENDING: 'warning',
  APPROVED: 'info',
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  COMPLETED: 'default',
  CANCELLED: 'danger',
}

const overrideTypeOptions = [
  { value: 'NONE', label: 'Use Default' },
  { value: 'FIXED', label: 'Fixed Amount' },
  { value: 'PCT', label: 'Custom Percentage' },
  { value: 'FORMULA', label: 'Custom Formula' },
]

const targetTypeOptions = [
  { value: 'INDIVIDUAL', label: 'Individual Employee', description: 'Apply to a specific employee' },
  { value: 'GRADE', label: 'Job Grade', description: 'Apply to all employees in a grade' },
  { value: 'BAND', label: 'Salary Band', description: 'Apply to all employees in a salary band' },
]

type TargetType = 'INDIVIDUAL' | 'GRADE' | 'BAND'

interface TransactionFormData {
  target_type: TargetType
  employee: string
  employee_ids: string[]
  job_grade: string
  salary_band: string
  pay_component: string
  override_type: TransactionOverrideType
  override_amount: string
  override_percentage: string
  override_formula: string
  quantity: string
  is_recurring: boolean
  effective_from: string
  effective_to: string
  description: string
}

const initialFormData: TransactionFormData = {
  target_type: 'INDIVIDUAL',
  employee: '',
  employee_ids: [],
  job_grade: '',
  salary_band: '',
  pay_component: '',
  override_type: 'NONE',
  override_amount: '',
  override_percentage: '',
  override_formula: '',
  quantity: '1',
  is_recurring: true,
  effective_from: new Date().toISOString().split('T')[0],
  effective_to: '',
  description: '',
}

export default function EmployeeTransactionsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'active' | 'one-time'>('all')
  const [filters, setFilters] = useState({
    status: '',
    pay_component: '',
    department: '',
    target_type: '',
    search: '',
  })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState<EmployeeTransaction | null>(null)
  const [showApproveModal, setShowApproveModal] = useState<EmployeeTransaction | null>(null)
  const [showRejectModal, setShowRejectModal] = useState<EmployeeTransaction | null>(null)
  const [approvalNotes, setApprovalNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [formData, setFormData] = useState<TransactionFormData>(initialFormData)
  const [isBulkMode, setIsBulkMode] = useState(false)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Queries
  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['employee-transactions', activeTab, filters],
    queryFn: () => {
      const baseFilters: any = {
        ...filters,
        status: filters.status || undefined,
        pay_component: filters.pay_component || undefined,
        department: filters.department || undefined,
        target_type: filters.target_type || undefined,
        search: filters.search || undefined,
      }

      if (activeTab === 'pending') {
        baseFilters.status = 'PENDING'
      } else if (activeTab === 'active') {
        baseFilters.status = 'ACTIVE'
        baseFilters.is_recurring = true
      } else if (activeTab === 'one-time') {
        baseFilters.is_recurring = false
      }

      return transactionsService.getTransactions(baseFilters)
    },
  })

  const { data: componentsData } = useQuery({
    queryKey: ['pay-components-list'],
    queryFn: () => transactionsService.getPayComponents({ is_active: true }),
  })

  const { data: employeesData } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => employeeService.getEmployees(),
  })

  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await employeeService.getEmployees()
      // Extract unique departments from employees
      const departments = new Map()
      response.results?.forEach((emp: Employee) => {
        if (emp.department) {
          departments.set(emp.department, emp.department_name)
        }
      })
      return Array.from(departments.entries()).map(([id, name]) => ({ id, name }))
    },
  })

  const { data: gradesData } = useQuery({
    queryKey: ['job-grades'],
    queryFn: async () => {
      const res = await api.get('/organization/grades/', { params: { page_size: 100 } })
      return res.data.results || res.data || []
    },
  })

  const { data: salaryBandsData } = useQuery({
    queryKey: ['salary-bands'],
    queryFn: async () => {
      const res = await api.get('/payroll/salary-bands/', { params: { page_size: 100 } })
      return res.data.results || res.data || []
    },
  })

  const { data: settingsData } = useQuery({
    queryKey: ['payroll-settings'],
    queryFn: () => payrollSetupService.getPayrollSettings(),
  })

  const transactions = transactionsData?.results || []
  const components = componentsData?.results || []
  const employees = employeesData?.results || []
  const grades = gradesData || []
  const salaryBands = salaryBandsData || []
  const activePeriodName = settingsData?.settings?.active_period_name

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => transactionsService.createTransaction(data),
    onSuccess: () => {
      toast.success('Transaction created')
      queryClient.invalidateQueries({ queryKey: ['employee-transactions'] })
      handleCloseCreateModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create transaction')
    },
  })

  const bulkCreateMutation = useMutation({
    mutationFn: (data: any) => transactionsService.bulkCreateTransactions(data),
    onSuccess: (data) => {
      toast.success(`Created ${data.count} transactions`)
      queryClient.invalidateQueries({ queryKey: ['employee-transactions'] })
      handleCloseCreateModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create transactions')
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      transactionsService.approveTransaction(id, notes),
    onSuccess: () => {
      toast.success('Transaction approved')
      queryClient.invalidateQueries({ queryKey: ['employee-transactions'] })
      setShowApproveModal(null)
      setApprovalNotes('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to approve transaction')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      transactionsService.rejectTransaction(id, reason),
    onSuccess: () => {
      toast.success('Transaction rejected')
      queryClient.invalidateQueries({ queryKey: ['employee-transactions'] })
      setShowRejectModal(null)
      setRejectionReason('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to reject transaction')
    },
  })

  const suspendMutation = useMutation({
    mutationFn: (id: string) => transactionsService.suspendTransaction(id),
    onSuccess: () => {
      toast.success('Transaction suspended')
      queryClient.invalidateQueries({ queryKey: ['employee-transactions'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to suspend transaction')
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => transactionsService.reactivateTransaction(id),
    onSuccess: () => {
      toast.success('Transaction reactivated')
      queryClient.invalidateQueries({ queryKey: ['employee-transactions'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to reactivate transaction')
    },
  })

  // Handlers
  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    setFormData(initialFormData)
    setIsBulkMode(false)
    setSelectedEmployees([])
  }

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault()

    const data: any = {
      target_type: formData.target_type,
      pay_component: formData.pay_component,
      override_type: formData.override_type,
      is_recurring: formData.is_recurring,
      effective_from: formData.effective_from,
      description: formData.description || undefined,
    }

    if (formData.effective_to) {
      data.effective_to = formData.effective_to
    }

    if (formData.override_type === 'FIXED') {
      data.override_amount = parseFloat(formData.override_amount)
    } else if (formData.override_type === 'PCT') {
      data.override_percentage = parseFloat(formData.override_percentage)
    } else if (formData.override_type === 'FORMULA') {
      data.override_formula = formData.override_formula
    }

    const qty = parseFloat(formData.quantity)
    if (!isNaN(qty)) {
      data.quantity = qty
    }

    // Set target based on target_type
    if (formData.target_type === 'GRADE') {
      data.job_grade = formData.job_grade
      createMutation.mutate(data)
    } else if (formData.target_type === 'BAND') {
      data.salary_band = formData.salary_band
      createMutation.mutate(data)
    } else if (isBulkMode && selectedEmployees.length > 0) {
      data.employee_ids = selectedEmployees
      bulkCreateMutation.mutate(data)
    } else {
      data.employee = formData.employee
      createMutation.mutate(data)
    }
  }

  const handleBulkApprove = async () => {
    for (const id of selectedTransactions) {
      await approveMutation.mutateAsync({ id })
    }
    setSelectedTransactions([])
  }

  const handleBulkReject = async () => {
    if (!rejectionReason) {
      toast.error('Please provide a rejection reason')
      return
    }
    for (const id of selectedTransactions) {
      await rejectMutation.mutateAsync({ id, reason: rejectionReason })
    }
    setSelectedTransactions([])
    setRejectionReason('')
  }

  // Get selected component for amount preview
  const selectedComponent = components.find((c: PayComponent) => c.id === formData.pay_component)
  const selectedEmployee = employees.find((e: Employee) => e.id === formData.employee)

  // Calculate preview amount
  const getPreviewAmount = () => {
    if (!selectedComponent || !selectedEmployee) return null

    const basicSalary = selectedEmployee.salary?.basic_salary || 0
    const grossSalary = selectedEmployee.salary?.gross_salary || basicSalary
    const qty = parseFloat(formData.quantity) || 1

    let amount: number | null = null

    if (formData.override_type === 'FIXED' && formData.override_amount) {
      amount = parseFloat(formData.override_amount)
    } else if (formData.override_type === 'PCT' && formData.override_percentage) {
      amount = (basicSalary * parseFloat(formData.override_percentage)) / 100
    } else if (formData.override_type === 'NONE') {
      if (selectedComponent.calculation_type === 'FIXED') {
        amount = selectedComponent.default_amount || 0
      } else if (selectedComponent.calculation_type === 'PCT_BASIC') {
        amount = (basicSalary * (selectedComponent.percentage_value || 0)) / 100
      } else if (selectedComponent.calculation_type === 'PCT_GROSS') {
        amount = (grossSalary * (selectedComponent.percentage_value || 0)) / 100
      }
    }

    if (amount !== null) {
      return amount * qty
    }
    return null
  }

  const columns = [
    {
      key: 'select',
      header: '',
      render: (item: EmployeeTransaction) =>
        item.status === 'PENDING' ? (
          <input
            type="checkbox"
            checked={selectedTransactions.includes(item.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedTransactions([...selectedTransactions, item.id])
              } else {
                setSelectedTransactions(selectedTransactions.filter((id) => id !== item.id))
              }
            }}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
        ) : null,
      className: 'w-8',
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (item: EmployeeTransaction) => (
        <div>
          <div className="font-medium text-xs font-mono">{item.reference_number}</div>
        </div>
      ),
    },
    {
      key: 'target',
      header: 'Target',
      render: (item: EmployeeTransaction) => {
        const targetType = (item as any).target_type || 'INDIVIDUAL'
        if (targetType === 'GRADE') {
          return (
            <div>
              <Badge variant="info" className="mb-1">Grade</Badge>
              <div className="font-medium">{(item as any).job_grade_name || 'N/A'}</div>
              <div className="text-xs text-gray-500">{(item as any).applicable_employee_count || 0} employees</div>
            </div>
          )
        }
        if (targetType === 'BAND') {
          return (
            <div>
              <Badge variant="warning" className="mb-1">Band</Badge>
              <div className="font-medium">{(item as any).salary_band_name || 'N/A'}</div>
              <div className="text-xs text-gray-500">{(item as any).applicable_employee_count || 0} employees</div>
            </div>
          )
        }
        return (
          <div>
            <div className="font-medium">{item.employee_name || 'N/A'}</div>
            <div className="text-xs text-gray-500">{item.employee_number || ''}</div>
          </div>
        )
      },
    },
    {
      key: 'transaction',
      header: 'Transaction Type',
      render: (item: EmployeeTransaction) => (
        <div>
          <div className="font-medium">{item.component_name}</div>
          <div className="text-xs text-gray-500">{item.component_code}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount/Formula',
      render: (item: EmployeeTransaction) => {
        if (item.override_type === 'FIXED') {
          return <span className="font-medium">{formatCurrency(item.override_amount || 0)}</span>
        }
        if (item.override_type === 'PCT') {
          return <span className="font-medium">{item.override_percentage}%</span>
        }
        if (item.override_type === 'FORMULA') {
          return (
            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
              {item.override_formula?.slice(0, 15)}...
            </span>
          )
        }
        return (
          <span className="text-gray-500 text-sm">
            {item.calculated_amount ? formatCurrency(parseFloat(item.calculated_amount)) : 'Default'}
          </span>
        )
      },
    },
    {
      key: 'dates',
      header: 'Effective Dates',
      render: (item: EmployeeTransaction) => (
        <div className="text-sm">
          <div>{new Date(item.effective_from).toLocaleDateString()}</div>
          <div className="text-xs text-gray-500">
            {item.effective_to ? `to ${new Date(item.effective_to).toLocaleDateString()}` : 'Ongoing'}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (item: EmployeeTransaction) => (
        <Badge variant={item.is_recurring ? 'info' : 'default'}>
          {item.is_recurring ? 'Recurring' : 'One-time'}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: EmployeeTransaction) => (
        <Badge variant={statusColors[item.status]}>
          {item.status_display || item.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: EmployeeTransaction) => (
        <div className="flex gap-1">
          <button
            onClick={() => setShowViewModal(item)}
            className="p-1 text-gray-500 hover:text-gray-700"
            title="View"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          {item.status === 'PENDING' && (
            <>
              <button
                onClick={() => setShowApproveModal(item)}
                className="p-1 text-gray-500 hover:text-green-600"
                title="Approve"
              >
                <CheckIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowRejectModal(item)}
                className="p-1 text-gray-500 hover:text-red-600"
                title="Reject"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </>
          )}
          {item.status === 'ACTIVE' && (
            <button
              onClick={() => suspendMutation.mutate(item.id)}
              className="p-1 text-gray-500 hover:text-yellow-600"
              title="Suspend"
            >
              <PauseIcon className="h-4 w-4" />
            </button>
          )}
          {item.status === 'SUSPENDED' && (
            <button
              onClick={() => reactivateMutation.mutate(item.id)}
              className="p-1 text-gray-500 hover:text-green-600"
              title="Reactivate"
            >
              <PlayIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  const tabs = [
    { id: 'all', label: 'All', count: transactionsData?.count },
    { id: 'pending', label: 'Pending Approval' },
    { id: 'active', label: 'Active Recurring' },
    { id: 'one-time', label: 'One-Time' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Transactions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage employee earnings, deductions, and recurring transactions
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Transaction
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 px-1 text-sm font-medium border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <Select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              options={[
                { value: '', label: 'All Status' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'SUSPENDED', label: 'Suspended' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
              className="w-36"
            />
            <Select
              value={filters.pay_component}
              onChange={(e) => setFilters({ ...filters, pay_component: e.target.value })}
              options={[
                { value: '', label: 'All Types' },
                ...components.map((c: PayComponent) => ({ value: c.id, label: c.name })),
              ]}
              className="w-48"
            />
            <Select
              value={filters.target_type}
              onChange={(e) => setFilters({ ...filters, target_type: e.target.value })}
              options={[
                { value: '', label: 'All Targets' },
                { value: 'INDIVIDUAL', label: 'Individual' },
                { value: 'GRADE', label: 'Job Grade' },
                { value: 'BAND', label: 'Salary Band' },
              ]}
              className="w-36"
            />
            <Select
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              options={[
                { value: '', label: 'All Departments' },
                ...(departmentsData || []).map((d: any) => ({ value: d.id, label: d.name })),
              ]}
              className="w-48"
            />
            <Input
              placeholder="Search employee..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-48"
            />
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedTransactions.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {selectedTransactions.length} selected
              </span>
              <Button size="sm" onClick={handleBulkApprove}>
                <CheckIcon className="h-4 w-4 mr-1" />
                Approve Selected
              </Button>
              <Button size="sm" variant="danger" onClick={() => setShowRejectModal({} as any)}>
                <XMarkIcon className="h-4 w-4 mr-1" />
                Reject Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedTransactions([])}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table
            data={transactions.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No transactions found"
          />
          {transactions.length > pageSize && (
            <TablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(transactions.length / pageSize)}
              totalItems={transactions.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Create Transaction Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        title="Create Transaction"
        size="lg"
      >
        <form onSubmit={handleSubmitCreate} className="space-y-6">
          {/* Active Payroll Period */}
          {activePeriodName && (
            <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
              <span className="text-sm text-gray-600">Payroll Period</span>
              <Badge variant="info">{activePeriodName}</Badge>
            </div>
          )}

          {/* Target Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Apply Transaction To
            </label>
            <div className="grid grid-cols-3 gap-2">
              {targetTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, target_type: opt.value as TargetType })
                    setIsBulkMode(false)
                    setSelectedEmployees([])
                  }}
                  className={`px-3 py-2 text-sm rounded-lg border text-left ${
                    formData.target_type === opt.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs text-gray-500">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Target Selection based on type */}
          {formData.target_type === 'INDIVIDUAL' && (
            <>
              {/* Bulk Mode Toggle */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!isBulkMode}
                    onChange={() => setIsBulkMode(false)}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm">Single Employee</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={isBulkMode}
                    onChange={() => setIsBulkMode(true)}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm">Multiple Employees</span>
                </label>
              </div>

              {/* Employee Selection */}
              {isBulkMode ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Employees ({selectedEmployees.length} selected)
                  </label>
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    {employees.map((emp: Employee) => (
                      <label
                        key={emp.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(emp.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEmployees([...selectedEmployees, emp.id])
                            } else {
                              setSelectedEmployees(selectedEmployees.filter((id) => id !== emp.id))
                            }
                          }}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm">
                          {emp.full_name || `${emp.first_name} ${emp.last_name}`}
                        </span>
                        <span className="text-xs text-gray-500">{emp.employee_number}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <Select
                  label="Employee"
                  value={formData.employee}
                  onChange={(e) => setFormData({ ...formData, employee: e.target.value })}
                  options={[
                    { value: '', label: 'Select Employee' },
                    ...employees.map((emp: Employee) => ({
                      value: emp.id,
                      label: `${emp.full_name || `${emp.first_name} ${emp.last_name}`} (${emp.employee_number})`,
                    })),
                  ]}
                  required={!isBulkMode}
                />
              )}
            </>
          )}

          {formData.target_type === 'GRADE' && (
            <div>
              <Select
                label="Job Grade"
                value={formData.job_grade}
                onChange={(e) => setFormData({ ...formData, job_grade: e.target.value })}
                options={[
                  { value: '', label: 'Select Job Grade' },
                  ...grades.map((g: any) => ({
                    value: g.id,
                    label: `${g.code} - ${g.name}`,
                  })),
                ]}
                required
              />
              {formData.job_grade && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                  <strong>Note:</strong> This transaction will apply to all active employees with this job grade.
                </div>
              )}
            </div>
          )}

          {formData.target_type === 'BAND' && (
            <div>
              <Select
                label="Salary Band"
                value={formData.salary_band}
                onChange={(e) => setFormData({ ...formData, salary_band: e.target.value })}
                options={[
                  { value: '', label: 'Select Salary Band' },
                  ...salaryBands.map((b: any) => ({
                    value: b.id,
                    label: `${b.code} - ${b.name}`,
                  })),
                ]}
                required
              />
              {formData.salary_band && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                  <strong>Note:</strong> This transaction will apply to all active employees in this salary band (via grade or salary notch).
                </div>
              )}
            </div>
          )}

          {/* Transaction Type */}
          <LinkedSelect
            fieldKey="payroll_component"
            label="Transaction Type"
            value={formData.pay_component}
            onChange={(e) => setFormData({ ...formData, pay_component: e.target.value })}
            placeholder="Select Transaction Type"
            options={
              components.map((c: PayComponent) => ({
                value: c.id,
                label: `${c.name} (${c.component_type})`,
              }))
            }
          />

          {/* Value Configuration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Value Configuration
            </label>
            <div className="grid grid-cols-2 gap-2">
              {overrideTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, override_type: opt.value as TransactionOverrideType })
                  }
                  className={`px-3 py-2 text-sm rounded-lg border ${
                    formData.override_type === opt.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Override Value Inputs */}
          {formData.override_type === 'FIXED' && (
            <Input
              label="Fixed Amount"
              type="number"
              step="0.01"
              value={formData.override_amount}
              onChange={(e) => setFormData({ ...formData, override_amount: e.target.value })}
              placeholder="Enter fixed amount"
              required
            />
          )}

          {formData.override_type === 'PCT' && (
            <Input
              label="Percentage"
              type="number"
              step="0.01"
              value={formData.override_percentage}
              onChange={(e) => setFormData({ ...formData, override_percentage: e.target.value })}
              placeholder="Enter percentage (e.g., 10 for 10%)"
              required
            />
          )}

          {formData.override_type === 'FORMULA' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Formula</label>
              <textarea
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm font-mono"
                rows={2}
                value={formData.override_formula}
                onChange={(e) => setFormData({ ...formData, override_formula: e.target.value })}
                placeholder="e.g., basic * 0.15"
                required
              />
            </div>
          )}

          {/* Overtime Hours */}
          {selectedComponent?.is_overtime && (
            <Input
              label="Overtime Hours"
              type="number"
              step="0.5"
              min="0.5"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              required
            />
          )}

          {/* Amount Preview */}
          {!isBulkMode && selectedComponent && selectedEmployee && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <DocumentTextIcon className="h-4 w-4" />
                <span>
                  Estimated Amount:{' '}
                  <strong>
                    {getPreviewAmount() !== null ? formatCurrency(getPreviewAmount()!) : 'N/A'}
                  </strong>
                </span>
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Based on {selectedEmployee.full_name}'s salary:{' '}
                Basic {formatCurrency(selectedEmployee.salary?.basic_salary || 0)}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Effective From"
              type="date"
              value={formData.effective_from}
              onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
              required
            />
            <Input
              label="Effective To (Optional)"
              type="date"
              value={formData.effective_to}
              onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
            />
          </div>

          {/* Recurring Toggle */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_recurring}
              onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm">Recurring Transaction</span>
          </label>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description / Justification
            </label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Reason for this transaction..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleCloseCreateModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || bulkCreateMutation.isPending}
            >
              {isBulkMode ? `Create for ${selectedEmployees.length} Employees` : 'Create Transaction'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Transaction Modal */}
      <Modal
        isOpen={!!showViewModal}
        onClose={() => setShowViewModal(null)}
        title="Transaction Details"
        size="lg"
      >
        {showViewModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500">Reference</label>
                <p className="font-mono">{showViewModal.reference_number}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Status</label>
                <p>
                  <Badge variant={statusColors[showViewModal.status]}>
                    {showViewModal.status_display || showViewModal.status}
                  </Badge>
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Target Type</label>
                <p>
                  <Badge variant={(showViewModal as any).target_type === 'GRADE' ? 'info' : (showViewModal as any).target_type === 'BAND' ? 'warning' : 'default'}>
                    {(showViewModal as any).target_type_display || (showViewModal as any).target_type || 'Individual'}
                  </Badge>
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Applies To</label>
                {(showViewModal as any).target_type === 'GRADE' ? (
                  <p>{(showViewModal as any).job_grade_name} ({(showViewModal as any).applicable_employee_count || 0} employees)</p>
                ) : (showViewModal as any).target_type === 'BAND' ? (
                  <p>{(showViewModal as any).salary_band_name} ({(showViewModal as any).applicable_employee_count || 0} employees)</p>
                ) : (
                  <>
                    <p>{showViewModal.employee_name}</p>
                    <p className="text-sm text-gray-500">{showViewModal.employee_number}</p>
                  </>
                )}
              </div>
              {(showViewModal as any).target_type !== 'GRADE' && (showViewModal as any).target_type !== 'BAND' && (
                <div>
                  <label className="text-xs text-gray-500">Department</label>
                  <p>{showViewModal.department_name || '-'}</p>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500">Transaction Type</label>
                <p>{showViewModal.component_name}</p>
                <p className="text-sm text-gray-500">{showViewModal.component_code}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Calculated Amount</label>
                <p className="font-medium">
                  {showViewModal.calculated_amount
                    ? formatCurrency(parseFloat(showViewModal.calculated_amount))
                    : 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Value Override</label>
                <p>
                  {showViewModal.override_type === 'NONE'
                    ? 'Using Default'
                    : showViewModal.override_type === 'FIXED'
                    ? formatCurrency(showViewModal.override_amount || 0)
                    : showViewModal.override_type === 'PCT'
                    ? `${showViewModal.override_percentage}%`
                    : showViewModal.override_formula}
                </p>
              </div>
              {showViewModal.quantity && showViewModal.quantity !== 1 && (
                <div>
                  <label className="text-xs text-gray-500">Quantity / Hours</label>
                  <p>{showViewModal.quantity}</p>
                </div>
              )}
              {showViewModal.payroll_period_name && (
                <div>
                  <label className="text-xs text-gray-500">Payroll Period</label>
                  <p>{showViewModal.payroll_period_name}</p>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500">Type</label>
                <p>{showViewModal.is_recurring ? 'Recurring' : 'One-time'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Effective From</label>
                <p>{new Date(showViewModal.effective_from).toLocaleDateString()}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Effective To</label>
                <p>
                  {showViewModal.effective_to
                    ? new Date(showViewModal.effective_to).toLocaleDateString()
                    : 'Ongoing'}
                </p>
              </div>
            </div>

            {showViewModal.description && (
              <div>
                <label className="text-xs text-gray-500">Description</label>
                <p className="text-sm">{showViewModal.description}</p>
              </div>
            )}

            {showViewModal.approved_by_name && (
              <div className="pt-4 border-t">
                <label className="text-xs text-gray-500">Approved By</label>
                <p>
                  {showViewModal.approved_by_name} on{' '}
                  {new Date(showViewModal.approved_at!).toLocaleString()}
                </p>
                {showViewModal.approval_notes && (
                  <p className="text-sm text-gray-600 mt-1">{showViewModal.approval_notes}</p>
                )}
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => setShowViewModal(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal
        isOpen={!!showApproveModal}
        onClose={() => {
          setShowApproveModal(null)
          setApprovalNotes('')
        }}
        title="Approve Transaction"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Approve transaction for <strong>{showApproveModal?.employee_name}</strong>?
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              rows={2}
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Add any notes..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowApproveModal(null)
                setApprovalNotes('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                showApproveModal &&
                approveMutation.mutate({ id: showApproveModal.id, notes: approvalNotes })
              }
              isLoading={approveMutation.isPending}
            >
              Approve
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={!!showRejectModal}
        onClose={() => {
          setShowRejectModal(null)
          setRejectionReason('')
        }}
        title="Reject Transaction"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {selectedTransactions.length > 0
              ? `Reject ${selectedTransactions.length} selected transactions?`
              : `Reject transaction for ${showRejectModal?.employee_name}?`}
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Provide a reason for rejection..."
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectModal(null)
                setRejectionReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (selectedTransactions.length > 0) {
                  handleBulkReject()
                } else if (showRejectModal) {
                  rejectMutation.mutate({ id: showRejectModal.id, reason: rejectionReason })
                }
              }}
              isLoading={rejectMutation.isPending}
              disabled={!rejectionReason}
            >
              Reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
