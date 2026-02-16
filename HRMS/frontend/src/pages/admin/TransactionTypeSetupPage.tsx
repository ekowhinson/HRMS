import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  BeakerIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { transactionsService } from '@/services/transactions'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Table, { TablePagination } from '@/components/ui/Table'
import { formatCurrency } from '@/lib/utils'
import type { PayComponent, ComponentType, CalculationType, ComponentCategory } from '@/types'

const componentTypeOptions = [
  { value: '', label: 'All Types' },
  { value: 'EARNING', label: 'Earning' },
  { value: 'DEDUCTION', label: 'Deduction' },
  { value: 'EMPLOYER', label: 'Employer Contribution' },
]

// Extended calculation types with user-friendly categories
const calculationModeOptions = [
  { value: 'FIXED', label: 'Fixed Amount', description: 'A fixed monetary amount' },
  { value: 'PERCENTAGE', label: 'Percentage', description: 'Percentage of basic or gross salary' },
  { value: 'LOAN', label: 'Loan Deduction', description: 'Loan repayment with interest' },
  { value: 'OVERTIME', label: 'Overtime', description: 'Hourly rate multiplier' },
  { value: 'CUSTOM', label: 'Custom Formula', description: 'Advanced custom formula' },
]

const categoryOptions = [
  { value: 'BASIC', label: 'Basic Salary' },
  { value: 'ALLOWANCE', label: 'Allowance' },
  { value: 'BONUS', label: 'Bonus' },
  { value: 'STATUTORY', label: 'Statutory Deduction' },
  { value: 'OVERTIME', label: 'Overtime' },
  { value: 'SHIFT', label: 'Shift Allowance' },
  { value: 'LOAN', label: 'Loan Deduction' },
  { value: 'FUND', label: 'Fund Contribution' },
  { value: 'OTHER', label: 'Other' },
]

const categoryFilterOptions = [{ value: '', label: 'All Categories' }, ...categoryOptions]

const typeColors: Record<string, 'success' | 'danger' | 'info'> = {
  EARNING: 'success',
  DEDUCTION: 'danger',
  EMPLOYER: 'info',
}

// Loan calculation methods
type LoanMethod = 'AMORTIZATION' | 'REDUCING_BALANCE' | 'REDUCING_BALANCE_EQUAL_PRINCIPAL'

const loanMethodOptions = [
  {
    value: 'AMORTIZATION',
    label: 'Amortization (Equal Payments)',
    description: 'Fixed monthly payment, interest portion decreases over time'
  },
  {
    value: 'REDUCING_BALANCE',
    label: 'Reducing Balance',
    description: 'Interest calculated on remaining principal each period'
  },
  {
    value: 'REDUCING_BALANCE_EQUAL_PRINCIPAL',
    label: 'Equal Principal + Interest',
    description: 'Fixed principal payment plus interest on balance'
  },
]

interface ComponentFormData {
  code: string
  name: string
  short_name: string
  description: string
  component_type: ComponentType
  calculation_type: CalculationType
  category: ComponentCategory
  default_amount: string
  percentage_value: string
  formula: string
  is_taxable: boolean
  reduces_taxable: boolean
  is_overtime: boolean
  is_bonus: boolean
  affects_ssnit: boolean
  is_statutory: boolean
  is_recurring: boolean
  is_prorated: boolean
  requires_approval: boolean
  approval_threshold: string
  show_on_payslip: boolean
  display_order: string
  is_active: boolean
}

const initialFormData: ComponentFormData = {
  code: '',
  name: '',
  short_name: '',
  description: '',
  component_type: 'EARNING',
  calculation_type: 'FIXED',
  category: 'OTHER',
  default_amount: '',
  percentage_value: '',
  formula: '',
  is_taxable: true,
  reduces_taxable: false,
  is_overtime: false,
  is_bonus: false,
  affects_ssnit: false,
  is_statutory: false,
  is_recurring: true,
  is_prorated: true,
  requires_approval: false,
  approval_threshold: '',
  show_on_payslip: true,
  display_order: '0',
  is_active: true,
}

// Formula generation functions
function generateLoanFormula(
  principal: number,
  annualRate: number,
  termMonths: number,
  method: LoanMethod
): string {
  const monthlyRate = annualRate / 100 / 12

  switch (method) {
    case 'AMORTIZATION': {
      // PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
      if (monthlyRate === 0) {
        return (principal / termMonths).toFixed(2)
      }
      const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
                      (Math.pow(1 + monthlyRate, termMonths) - 1)
      return payment.toFixed(2)
    }
    case 'REDUCING_BALANCE': {
      // Interest = Outstanding Balance * Monthly Rate
      // This returns the monthly interest portion (principal payment is separate)
      // Formula: principal_remaining * monthly_rate
      return `${principal} * ${monthlyRate.toFixed(6)}`
    }
    case 'REDUCING_BALANCE_EQUAL_PRINCIPAL': {
      // Fixed principal + interest on remaining balance
      // Monthly Principal = Total Principal / Term
      // This returns fixed principal + average interest estimate
      const monthlyPrincipal = principal / termMonths
      const avgBalance = principal / 2
      const avgInterest = avgBalance * monthlyRate
      return (monthlyPrincipal + avgInterest).toFixed(2)
    }
    default:
      return '0'
  }
}

function generateOvertimeFormula(
  multiplier: number,
  hoursPerMonth: number = 176
): string {
  return `basic / ${hoursPerMonth} * ${multiplier}`
}

function generatePercentageFormula(
  percentage: number,
  base: 'basic' | 'gross',
  minCap?: number,
  maxCap?: number
): string {
  let formula = `${base} * ${(percentage / 100).toFixed(4)}`

  if (minCap !== undefined && maxCap !== undefined) {
    formula = `max(min(${formula}, ${maxCap}), ${minCap})`
  } else if (maxCap !== undefined) {
    formula = `min(${formula}, ${maxCap})`
  } else if (minCap !== undefined) {
    formula = `max(${formula}, ${minCap})`
  }

  return formula
}

export default function TransactionTypeSetupPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState({
    component_type: '',
    category: '',
    is_active: '',
  })
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState<PayComponent | null>(null)
  const [editingComponent, setEditingComponent] = useState<PayComponent | null>(null)
  const [formData, setFormData] = useState<ComponentFormData>(initialFormData)
  const [formulaTestResult, setFormulaTestResult] = useState<{
    valid: boolean
    result?: string
    error?: string
  } | null>(null)
  const [testBasic, setTestBasic] = useState('5000')
  const [testGross, setTestGross] = useState('7000')

  // Calculation mode (UI state, maps to calculation_type)
  const [calculationMode, setCalculationMode] = useState<string>('FIXED')

  // Percentage calculation state
  const [percentageBase, setPercentageBase] = useState<'basic' | 'gross'>('basic')
  const [percentageValue, setPercentageValue] = useState('')
  const [minCap, setMinCap] = useState('')
  const [maxCap, setMaxCap] = useState('')

  // Loan calculation state
  const [loanPrincipal, setLoanPrincipal] = useState('')
  const [loanRate, setLoanRate] = useState('')
  const [loanTerm, setLoanTerm] = useState('')
  const [loanMethod, setLoanMethod] = useState<LoanMethod>('AMORTIZATION')

  // Overtime state
  const [overtimeMultiplier, setOvertimeMultiplier] = useState('1.5')
  const [hoursPerMonth, setHoursPerMonth] = useState('176')

  const { data: componentsData, isLoading } = useQuery({
    queryKey: ['pay-components', filters, page, pageSize],
    queryFn: () =>
      transactionsService.getPayComponents({
        component_type: filters.component_type || undefined,
        category: filters.category || undefined,
        is_active: filters.is_active ? filters.is_active === 'true' : undefined,
        page,
        page_size: pageSize,
      }),
  })

  const components = componentsData?.results || []
  const totalItems = componentsData?.count || 0
  const totalPages = Math.ceil(totalItems / pageSize)

  // Generate formula when calculation parameters change
  useEffect(() => {
    let generatedFormula = ''

    switch (calculationMode) {
      case 'PERCENTAGE':
        if (percentageValue) {
          generatedFormula = generatePercentageFormula(
            parseFloat(percentageValue),
            percentageBase,
            minCap ? parseFloat(minCap) : undefined,
            maxCap ? parseFloat(maxCap) : undefined
          )
        }
        break
      case 'LOAN':
        if (loanPrincipal && loanRate && loanTerm) {
          generatedFormula = generateLoanFormula(
            parseFloat(loanPrincipal),
            parseFloat(loanRate),
            parseInt(loanTerm),
            loanMethod
          )
        }
        break
      case 'OVERTIME':
        if (overtimeMultiplier) {
          generatedFormula = generateOvertimeFormula(
            parseFloat(overtimeMultiplier),
            parseInt(hoursPerMonth) || 176
          )
        }
        break
      case 'CUSTOM':
        // Keep manual formula
        return
      case 'FIXED':
        // No formula needed for fixed amount
        return
    }

    if (generatedFormula && calculationMode !== 'FIXED') {
      setFormData(prev => ({ ...prev, formula: generatedFormula }))
    }
  }, [
    calculationMode, percentageBase, percentageValue, minCap, maxCap,
    loanPrincipal, loanRate, loanTerm, loanMethod, overtimeMultiplier, hoursPerMonth
  ])

  // Update calculation_type based on mode
  useEffect(() => {
    if (calculationMode === 'FIXED') {
      setFormData(prev => ({ ...prev, calculation_type: 'FIXED' }))
    } else if (calculationMode === 'PERCENTAGE' && !minCap && !maxCap) {
      setFormData(prev => ({
        ...prev,
        calculation_type: percentageBase === 'basic' ? 'PCT_BASIC' : 'PCT_GROSS',
        percentage_value: percentageValue
      }))
    } else {
      setFormData(prev => ({ ...prev, calculation_type: 'FORMULA' }))
    }
  }, [calculationMode, percentageBase, percentageValue, minCap, maxCap])

  const createMutation = useMutation({
    mutationFn: (data: Partial<PayComponent>) => transactionsService.createPayComponent(data),
    onSuccess: () => {
      toast.success('Transaction type created')
      queryClient.invalidateQueries({ queryKey: ['pay-components'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create transaction type')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PayComponent> }) =>
      transactionsService.updatePayComponent(id, data),
    onSuccess: () => {
      toast.success('Transaction type updated')
      queryClient.invalidateQueries({ queryKey: ['pay-components'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update transaction type')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionsService.deletePayComponent(id),
    onSuccess: () => {
      toast.success('Transaction type deleted')
      queryClient.invalidateQueries({ queryKey: ['pay-components'] })
      setShowDeleteModal(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete transaction type')
    },
  })

  const validateFormulaMutation = useMutation({
    mutationFn: () =>
      transactionsService.validateFormula(
        formData.formula,
        parseFloat(testBasic) || 5000,
        parseFloat(testGross) || 7000
      ),
    onSuccess: (data) => {
      setFormulaTestResult(data)
    },
    onError: () => {
      setFormulaTestResult({ valid: false, error: 'Failed to validate formula' })
    },
  })

  const handleOpenCreate = () => {
    setEditingComponent(null)
    setFormData(initialFormData)
    setCalculationMode('FIXED')
    setPercentageBase('basic')
    setPercentageValue('')
    setMinCap('')
    setMaxCap('')
    setLoanPrincipal('')
    setLoanRate('')
    setLoanTerm('')
    setLoanMethod('AMORTIZATION')
    setOvertimeMultiplier('1.5')
    setHoursPerMonth('176')
    setFormulaTestResult(null)
    setShowModal(true)
  }

  const handleOpenEdit = (component: PayComponent) => {
    setEditingComponent(component)
    setFormData({
      code: component.code,
      name: component.name,
      short_name: component.short_name || '',
      description: component.description || '',
      component_type: component.component_type,
      calculation_type: component.calculation_type,
      category: component.category,
      default_amount: component.default_amount?.toString() || '',
      percentage_value: component.percentage_value?.toString() || '',
      formula: component.formula || '',
      is_taxable: component.is_taxable,
      reduces_taxable: component.reduces_taxable,
      is_overtime: component.is_overtime,
      is_bonus: component.is_bonus,
      affects_ssnit: component.affects_ssnit,
      is_statutory: component.is_statutory,
      is_recurring: component.is_recurring,
      is_prorated: component.is_prorated,
      requires_approval: component.requires_approval,
      approval_threshold: component.approval_threshold?.toString() || '',
      show_on_payslip: component.show_on_payslip,
      display_order: component.display_order?.toString() || '0',
      is_active: component.is_active,
    })

    // Determine calculation mode from existing data
    if (component.calculation_type === 'FIXED') {
      setCalculationMode('FIXED')
    } else if (component.calculation_type === 'PCT_BASIC' || component.calculation_type === 'PCT_GROSS') {
      setCalculationMode('PERCENTAGE')
      setPercentageBase(component.calculation_type === 'PCT_BASIC' ? 'basic' : 'gross')
      setPercentageValue(component.percentage_value?.toString() || '')
    } else if (component.calculation_type === 'FORMULA') {
      // Try to detect formula type
      if (component.formula?.includes('basic /') && component.formula?.includes('*')) {
        setCalculationMode('OVERTIME')
      } else {
        setCalculationMode('CUSTOM')
      }
    }

    setFormulaTestResult(null)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingComponent(null)
    setFormData(initialFormData)
    setFormulaTestResult(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const data: Partial<PayComponent> = {
      code: formData.code,
      name: formData.name,
      short_name: formData.short_name || undefined,
      description: formData.description || undefined,
      component_type: formData.component_type,
      calculation_type: formData.calculation_type,
      category: formData.category,
      is_taxable: formData.is_taxable,
      reduces_taxable: formData.reduces_taxable,
      is_overtime: formData.is_overtime,
      is_bonus: formData.is_bonus,
      affects_ssnit: formData.affects_ssnit,
      is_statutory: formData.is_statutory,
      is_recurring: formData.is_recurring,
      is_prorated: formData.is_prorated,
      requires_approval: formData.requires_approval,
      show_on_payslip: formData.show_on_payslip,
      display_order: parseInt(formData.display_order) || 0,
      is_active: formData.is_active,
    }

    // Add calculation-specific fields
    if (formData.calculation_type === 'FIXED') {
      data.default_amount = parseFloat(formData.default_amount) || 0
    } else if (
      formData.calculation_type === 'PCT_BASIC' ||
      formData.calculation_type === 'PCT_GROSS'
    ) {
      data.percentage_value = parseFloat(formData.percentage_value) || 0
    } else if (formData.calculation_type === 'FORMULA') {
      data.formula = formData.formula
    }

    if (formData.requires_approval && formData.approval_threshold) {
      data.approval_threshold = parseFloat(formData.approval_threshold)
    }

    if (editingComponent) {
      updateMutation.mutate({ id: editingComponent.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (item: PayComponent) => (
        <div>
          <div className="font-medium">{item.code}</div>
          <div className="text-xs text-gray-500">{item.short_name}</div>
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (item: PayComponent) => (
        <div>
          <div className="font-medium">{item.name}</div>
          {item.description && (
            <div className="text-xs text-gray-500 truncate max-w-xs">{item.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'component_type',
      header: 'Type',
      render: (item: PayComponent) => (
        <Badge variant={typeColors[item.component_type] || 'default'}>
          {item.component_type_display || item.component_type}
        </Badge>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (item: PayComponent) => (
        <span className="text-sm">{item.category_display || item.category}</span>
      ),
    },
    {
      key: 'calculation',
      header: 'Calculation',
      render: (item: PayComponent) => {
        if (item.calculation_type === 'FIXED') {
          return <span className="text-sm">{formatCurrency(item.default_amount || 0)}</span>
        }
        if (item.calculation_type === 'PCT_BASIC' || item.calculation_type === 'PCT_GROSS') {
          return (
            <span className="text-sm">
              {item.percentage_value}% of {item.calculation_type === 'PCT_BASIC' ? 'Basic' : 'Gross'}
            </span>
          )
        }
        if (item.calculation_type === 'FORMULA') {
          return (
            <span className="text-sm font-mono text-xs bg-gray-100 px-2 py-1 rounded">
              Formula
            </span>
          )
        }
        return <span className="text-sm">{item.calculation_type_display}</span>
      },
    },
    {
      key: 'transactions',
      header: 'Active Txns',
      render: (item: PayComponent) => (
        <span className="text-sm">{item.transaction_count || 0}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: PayComponent) => (
        <Badge variant={item.is_active ? 'success' : 'danger'}>
          {item.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: PayComponent) => (
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transaction Types</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage pay components for earnings, deductions, and contributions
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Transaction Type
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <Select
              value={filters.component_type}
              onChange={(e) => { setFilters({ ...filters, component_type: e.target.value }); setPage(1); }}
              options={componentTypeOptions}
              className="w-40"
            />
            <Select
              value={filters.category}
              onChange={(e) => { setFilters({ ...filters, category: e.target.value }); setPage(1); }}
              options={categoryFilterOptions}
              className="w-40"
            />
            <Select
              value={filters.is_active}
              onChange={(e) => { setFilters({ ...filters, is_active: e.target.value }); setPage(1); }}
              options={[
                { value: '', label: 'All Status' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table
            data={components}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No transaction types found"
          />
          <TablePagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingComponent ? 'Edit Transaction Type' : 'Create Transaction Type'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g., BASIC, PAYE, OT_1_5"
              required
              disabled={!!editingComponent}
            />
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Basic Salary, PAYE Tax"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Short Name"
              value={formData.short_name}
              onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
              placeholder="e.g., Basic"
            />
            <Input
              label="Display Order"
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:bg-white hover:border-gray-400 transition-colors duration-150 sm:text-sm"
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description of this transaction type..."
            />
          </div>

          {/* Type and Category */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Component Type"
              value={formData.component_type}
              onChange={(e) =>
                setFormData({ ...formData, component_type: e.target.value as ComponentType })
              }
              options={componentTypeOptions.slice(1)}
            />
            <Select
              label="Category"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value as ComponentCategory })
              }
              options={categoryOptions}
            />
          </div>

          {/* Calculation Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Calculation Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {calculationModeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCalculationMode(opt.value)}
                  className={`px-3 py-2 text-left rounded-md border transition-colors duration-150 ${
                    calculationMode === opt.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-gray-500">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fixed Amount Input */}
          {calculationMode === 'FIXED' && (
            <div className="p-4 bg-gray-50 rounded-md">
              <Input
                label="Fixed Amount (GH¢)"
                type="number"
                step="0.01"
                value={formData.default_amount}
                onChange={(e) => setFormData({ ...formData, default_amount: e.target.value })}
                placeholder="Enter fixed amount"
                required
              />
            </div>
          )}

          {/* Percentage Calculation */}
          {calculationMode === 'PERCENTAGE' && (
            <div className="p-4 bg-gray-50 rounded-md space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Calculate From"
                  value={percentageBase}
                  onChange={(e) => setPercentageBase(e.target.value as 'basic' | 'gross')}
                  options={[
                    { value: 'basic', label: 'Basic Salary' },
                    { value: 'gross', label: 'Gross Salary' },
                  ]}
                />
                <Input
                  label="Percentage (%)"
                  type="number"
                  step="0.01"
                  value={percentageValue}
                  onChange={(e) => setPercentageValue(e.target.value)}
                  placeholder="e.g., 5.5 for 5.5%"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Minimum Cap (Optional)"
                  type="number"
                  step="0.01"
                  value={minCap}
                  onChange={(e) => setMinCap(e.target.value)}
                  placeholder="e.g., 100"
                />
                <Input
                  label="Maximum Cap (Optional)"
                  type="number"
                  step="0.01"
                  value={maxCap}
                  onChange={(e) => setMaxCap(e.target.value)}
                  placeholder="e.g., 500"
                />
              </div>
              <p className="text-xs text-gray-500">
                Example: SSNIT Employee is 5.5% of Basic Salary
              </p>
            </div>
          )}

          {/* Loan Configuration */}
          {calculationMode === 'LOAN' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md space-y-4">
              <h4 className="text-sm font-medium text-blue-800">Loan Deduction Settings</h4>

              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Principal Amount (GH¢)"
                  type="number"
                  step="0.01"
                  value={loanPrincipal}
                  onChange={(e) => setLoanPrincipal(e.target.value)}
                  placeholder="e.g., 10000"
                  required
                />
                <Input
                  label="Annual Interest Rate (%)"
                  type="number"
                  step="0.01"
                  value={loanRate}
                  onChange={(e) => setLoanRate(e.target.value)}
                  placeholder="e.g., 15"
                  required
                />
                <Input
                  label="Loan Term (Months)"
                  type="number"
                  value={loanTerm}
                  onChange={(e) => setLoanTerm(e.target.value)}
                  placeholder="e.g., 12"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  Interest Calculation Method
                </label>
                <div className="space-y-2">
                  {loanMethodOptions.map((method) => (
                    <label
                      key={method.value}
                      className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors duration-150 ${
                        loanMethod === method.value
                          ? 'border-blue-500 bg-blue-100'
                          : 'border-blue-200 hover:border-blue-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="loanMethod"
                        value={method.value}
                        checked={loanMethod === method.value}
                        onChange={(e) => setLoanMethod(e.target.value as LoanMethod)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium text-blue-800">{method.label}</div>
                        <div className="text-xs text-blue-600">{method.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {loanPrincipal && loanRate && loanTerm && (
                <div className="p-3 bg-white rounded border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Monthly Deduction: </span>
                    {formatCurrency(parseFloat(formData.formula) || 0)}
                  </p>
                  {loanMethod === 'AMORTIZATION' && (
                    <p className="text-xs text-blue-600 mt-1">
                      Total Repayment: {formatCurrency((parseFloat(formData.formula) || 0) * parseInt(loanTerm))}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Overtime Configuration */}
          {calculationMode === 'OVERTIME' && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md space-y-4">
              <h4 className="text-sm font-medium text-green-800">Overtime Settings</h4>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Rate Multiplier"
                  type="number"
                  step="0.1"
                  value={overtimeMultiplier}
                  onChange={(e) => setOvertimeMultiplier(e.target.value)}
                  placeholder="e.g., 1.5 for time-and-half"
                  required
                />
                <Input
                  label="Standard Hours/Month"
                  type="number"
                  value={hoursPerMonth}
                  onChange={(e) => setHoursPerMonth(e.target.value)}
                  placeholder="e.g., 176"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOvertimeMultiplier('1.5')}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    overtimeMultiplier === '1.5'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'border-green-300 text-green-700 hover:bg-green-100'
                  }`}
                >
                  1.5x (Time & Half)
                </button>
                <button
                  type="button"
                  onClick={() => setOvertimeMultiplier('2')}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    overtimeMultiplier === '2'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'border-green-300 text-green-700 hover:bg-green-100'
                  }`}
                >
                  2x (Double Time)
                </button>
                <button
                  type="button"
                  onClick={() => setOvertimeMultiplier('2.5')}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    overtimeMultiplier === '2.5'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'border-green-300 text-green-700 hover:bg-green-100'
                  }`}
                >
                  2.5x (Holiday)
                </button>
              </div>

              <p className="text-xs text-green-700">
                Formula: (Basic Salary ÷ {hoursPerMonth || 176} hours) × {overtimeMultiplier || '1.5'} per overtime hour
              </p>
            </div>
          )}

          {/* Custom Formula */}
          {calculationMode === 'CUSTOM' && (
            <div className="p-4 bg-gray-50 rounded-md space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Formula</label>
                <textarea
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:bg-white hover:border-gray-400 transition-colors duration-150 sm:text-sm font-mono"
                  rows={3}
                  value={formData.formula}
                  onChange={(e) => setFormData({ ...formData, formula: e.target.value })}
                  placeholder="e.g., basic * 0.055"
                  required
                />
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  <p>
                    <span className="font-medium">Variables:</span>{' '}
                    <code className="bg-gray-200 px-1 rounded">basic</code>,{' '}
                    <code className="bg-gray-200 px-1 rounded">gross</code>
                  </p>
                  <p>
                    <span className="font-medium">Functions:</span>{' '}
                    <code className="bg-gray-200 px-1 rounded">min(a, b)</code>,{' '}
                    <code className="bg-gray-200 px-1 rounded">max(a, b)</code>,{' '}
                    <code className="bg-gray-200 px-1 rounded">round(x)</code>,{' '}
                    <code className="bg-gray-200 px-1 rounded">abs(x)</code>
                  </p>
                  <p>
                    <span className="font-medium">Conditional:</span>{' '}
                    <code className="bg-gray-200 px-1 rounded">value1 if condition else value2</code>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Formula Preview & Test (for non-fixed calculations) */}
          {calculationMode !== 'FIXED' && formData.formula && (
            <div className="p-3 bg-gray-100 rounded-md space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Generated Formula</label>
                <code className="block text-xs bg-white p-2 rounded border overflow-x-auto whitespace-pre-wrap">
                  {formData.formula}
                </code>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                <BeakerIcon className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Test Formula</span>
              </div>
              <div className="flex gap-3 items-end">
                <Input
                  label="Test Basic"
                  type="number"
                  value={testBasic}
                  onChange={(e) => setTestBasic(e.target.value)}
                  className="w-28"
                />
                <Input
                  label="Test Gross"
                  type="number"
                  value={testGross}
                  onChange={(e) => setTestGross(e.target.value)}
                  className="w-28"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => validateFormulaMutation.mutate()}
                  isLoading={validateFormulaMutation.isPending}
                >
                  Test
                </Button>
              </div>
              {formulaTestResult && (
                <div
                  className={`flex items-center gap-2 text-sm ${
                    formulaTestResult.valid ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formulaTestResult.valid ? (
                    <>
                      <CheckCircleIcon className="h-4 w-4" />
                      <span>Result: {formatCurrency(parseFloat(formulaTestResult.result || '0'))}</span>
                    </>
                  ) : (
                    <>
                      <XCircleIcon className="h-4 w-4" />
                      <span>{formulaTestResult.error}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Flags */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Tax Treatment</h4>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_taxable}
                  onChange={(e) => setFormData({ ...formData, is_taxable: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                  disabled={formData.is_overtime || formData.is_bonus}
                />
                <span className="text-sm">Is Taxable (via PAYE)</span>
              </label>
              {formData.component_type === 'DEDUCTION' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.reduces_taxable}
                    onChange={(e) => setFormData({ ...formData, reduces_taxable: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                  />
                  <span className="text-sm">Reduces Taxable Income (Pre-tax)</span>
                </label>
              )}
              {formData.component_type === 'EARNING' && (
                <>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_overtime}
                      onChange={(e) => setFormData({
                        ...formData,
                        is_overtime: e.target.checked,
                        is_bonus: false,
                        is_taxable: false
                      })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                    />
                    <span className="text-sm">Is Overtime (5%/10% tax)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_bonus}
                      onChange={(e) => setFormData({
                        ...formData,
                        is_bonus: e.target.checked,
                        is_overtime: false,
                        is_taxable: false
                      })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                    />
                    <span className="text-sm">Is Bonus (5% flat tax)</span>
                  </label>
                </>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.affects_ssnit}
                  onChange={(e) => setFormData({ ...formData, affects_ssnit: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                />
                <span className="text-sm">Affects SSNIT</span>
              </label>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Behavior</h4>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_statutory}
                  onChange={(e) => setFormData({ ...formData, is_statutory: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                />
                <span className="text-sm">Is Statutory</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                />
                <span className="text-sm">Is Recurring</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_prorated}
                  onChange={(e) => setFormData({ ...formData, is_prorated: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                />
                <span className="text-sm">Is Prorated</span>
              </label>
            </div>
          </div>

          {/* Display and Approval */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Display</h4>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.show_on_payslip}
                  onChange={(e) => setFormData({ ...formData, show_on_payslip: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                />
                <span className="text-sm">Show on Payslip</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                />
                <span className="text-sm">Is Active</span>
              </label>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Approval</h4>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.requires_approval}
                  onChange={(e) =>
                    setFormData({ ...formData, requires_approval: e.target.checked })
                  }
                  className="rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                />
                <span className="text-sm">Requires Approval</span>
              </label>
              {formData.requires_approval && (
                <Input
                  label="Approval Threshold"
                  type="number"
                  step="0.01"
                  value={formData.approval_threshold}
                  onChange={(e) =>
                    setFormData({ ...formData, approval_threshold: e.target.value })
                  }
                  placeholder="Amount above which approval is needed"
                />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingComponent ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteModal}
        onClose={() => setShowDeleteModal(null)}
        title="Delete Transaction Type"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{showDeleteModal?.name}</strong>?
          </p>
          {(showDeleteModal?.transaction_count || 0) > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                This transaction type has {showDeleteModal?.transaction_count} active transactions.
                Deleting it may affect payroll calculations.
              </p>
            </div>
          )}
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
