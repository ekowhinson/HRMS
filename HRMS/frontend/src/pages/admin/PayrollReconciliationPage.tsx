import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon,
  UserPlusIcon,
  UserMinusIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon,
  PrinterIcon,
  ChartBarIcon,
  TableCellsIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import { Card, CardContent, PageHeader, Badge } from '@/components/ui'
import { reportsService, ExportFormat } from '@/services/reports'
import api from '@/lib/api'

interface VarianceData {
  current: number
  previous: number
  difference: number
  percentage: number
}

interface ReconciliationEmployee {
  employee_number: string
  employee_name: string
  department: string
  position?: string
  prev_basic?: number
  curr_basic?: number
  basic_diff?: number
  prev_gross?: number
  curr_gross?: number
  gross_diff?: number
  prev_deductions?: number
  curr_deductions?: number
  deductions_diff?: number
  prev_net?: number
  curr_net?: number
  net_diff?: number
  basic_salary?: number
  gross_earnings?: number
  total_deductions?: number
  net_salary?: number
  reason?: string
  change_reasons?: string
}

interface ReconciliationData {
  summary: {
    current_period: string
    previous_period: string
    current_run_date: string
    previous_run_date: string
    employees: VarianceData
    gross: VarianceData
    deductions: VarianceData
    net: VarianceData
    paye: VarianceData
    ssnit_employee: VarianceData
    ssnit_employer: VarianceData
  }
  impact: {
    new_employees_count: number
    new_employees_cost: number
    separated_employees_count: number
    separated_employees_savings: number
    changed_employees_count: number
    net_salary_impact: number
    unchanged_employees_count: number
  }
  new_employees: ReconciliationEmployee[]
  separated_employees: ReconciliationEmployee[]
  changed_employees: ReconciliationEmployee[]
  unchanged_count: number
  message?: string
}

interface PayrollPeriod {
  id: string
  name: string
  year: number
  month: number
  start_date: string
  end_date: string
  payment_date: string | null
  status: string
  is_supplementary: boolean
}

type SortField = 'employee_name' | 'department' | 'gross' | 'net' | 'diff'
type SortDirection = 'asc' | 'desc'

export default function PayrollReconciliationPage() {
  const [currentPeriodId, setCurrentPeriodId] = useState<string>('')
  const [previousPeriodId, setPreviousPeriodId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'summary' | 'new' | 'separated' | 'changed'>('summary')
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('employee_name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedEmployee, setSelectedEmployee] = useState<ReconciliationEmployee | null>(null)
  const [viewMode, setViewMode] = useState<'cards' | 'chart'>('cards')

  // Fetch all payroll periods
  const { data: allPeriodsData } = useQuery<PayrollPeriod[]>({
    queryKey: ['payroll-periods-all'],
    queryFn: async () => {
      const response = await api.get('/payroll/periods/', {
        params: { page_size: 100 },
      })
      return response.data.results || response.data || []
    },
  })

  // Filter active periods (OPEN, PROCESSING, COMPUTED) for current period
  const activePeriods = useMemo(() => {
    const activeStatuses = ['OPEN', 'PROCESSING', 'COMPUTED']
    return (allPeriodsData || []).filter((p) => activeStatuses.includes(p.status))
  }, [allPeriodsData])

  // Filter closed periods (APPROVED, PAID, CLOSED) for previous period
  const closedPeriods = useMemo(() => {
    const closedStatuses = ['APPROVED', 'PAID', 'CLOSED']
    return (allPeriodsData || []).filter((p) => closedStatuses.includes(p.status))
  }, [allPeriodsData])

  // All periods combined for finding adjacent periods
  const allPeriods = useMemo(() => {
    const periods = [...(activePeriods || []), ...(closedPeriods || [])]
    // Sort by year and month descending
    return periods.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    })
  }, [activePeriods, closedPeriods])

  // Helper to get period sort key (year * 12 + month)
  const getPeriodKey = (period: PayrollPeriod) => period.year * 12 + period.month

  // Handle current period selection - auto-select previous closed period
  const handleCurrentPeriodChange = (periodId: string) => {
    setCurrentPeriodId(periodId)
    if (periodId && closedPeriods?.length) {
      const selectedPeriod = allPeriods.find((p) => p.id === periodId)
      if (selectedPeriod) {
        const selectedKey = getPeriodKey(selectedPeriod)
        // Find the most recent closed period before the current period
        const previousClosed = closedPeriods
          .filter((p) => getPeriodKey(p) < selectedKey)
          .sort((a, b) => getPeriodKey(b) - getPeriodKey(a))[0]
        if (previousClosed) {
          setPreviousPeriodId(previousClosed.id)
        } else if (closedPeriods.length > 0) {
          // If no earlier period, select the most recent closed
          setPreviousPeriodId(closedPeriods[0].id)
        }
      }
    }
  }

  // Handle previous period selection - auto-select next active period
  const handlePreviousPeriodChange = (periodId: string) => {
    setPreviousPeriodId(periodId)
    if (periodId && activePeriods?.length) {
      const selectedPeriod = allPeriods.find((p) => p.id === periodId)
      if (selectedPeriod) {
        const selectedKey = getPeriodKey(selectedPeriod)
        // Find the earliest active period after the selected period
        const nextActive = activePeriods
          .filter((p) => getPeriodKey(p) > selectedKey)
          .sort((a, b) => getPeriodKey(a) - getPeriodKey(b))[0]
        if (nextActive) {
          setCurrentPeriodId(nextActive.id)
        } else if (activePeriods.length > 0) {
          // If no later period, select the most recent active
          setCurrentPeriodId(activePeriods[0].id)
        }
      }
    }
  }

  // Fetch reconciliation data - only when both periods are selected
  const {
    data: reconciliation,
    error,
    refetch,
    isFetching,
  } = useQuery<ReconciliationData>({
    queryKey: ['payroll-reconciliation', currentPeriodId, previousPeriodId],
    queryFn: () => reportsService.getPayrollReconciliationByPeriod(currentPeriodId, previousPeriodId),
    enabled: !!(currentPeriodId && previousPeriodId),
  })

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(format)
    try {
      await reportsService.exportPayrollReconciliationByPeriod(currentPeriodId, previousPeriodId, format)
      toast.success(`Reconciliation report exported as ${format.toUpperCase()}`)
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Failed to export report')
    } finally {
      setIsExporting(null)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      minimumFractionDigits: 2,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  // Sort and filter employees
  const sortAndFilter = (employees: ReconciliationEmployee[]) => {
    if (!employees || !Array.isArray(employees)) return []

    let filtered = employees

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = employees.filter(
        (emp) =>
          (emp.employee_name || '').toLowerCase().includes(query) ||
          (emp.employee_number || '').toLowerCase().includes(query) ||
          (emp.department || '').toLowerCase().includes(query)
      )
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''

      switch (sortField) {
        case 'employee_name':
          aVal = a.employee_name || ''
          bVal = b.employee_name || ''
          break
        case 'department':
          aVal = a.department || ''
          bVal = b.department || ''
          break
        case 'gross':
          aVal = a.gross_earnings || a.curr_gross || 0
          bVal = b.gross_earnings || b.curr_gross || 0
          break
        case 'net':
          aVal = a.net_salary || a.curr_net || 0
          bVal = b.net_salary || b.curr_net || 0
          break
        case 'diff':
          aVal = a.net_diff || 0
          bVal = b.net_diff || 0
          break
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal)
      }

      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? (
      <ChevronUpIcon className="h-3 w-3" />
    ) : (
      <ChevronDownIcon className="h-3 w-3" />
    )
  }

  const filteredNewEmployees = useMemo(
    () => sortAndFilter(reconciliation?.new_employees || []),
    [reconciliation?.new_employees, searchQuery, sortField, sortDirection]
  )

  const filteredSeparatedEmployees = useMemo(
    () => sortAndFilter(reconciliation?.separated_employees || []),
    [reconciliation?.separated_employees, searchQuery, sortField, sortDirection]
  )

  const filteredChangedEmployees = useMemo(
    () => sortAndFilter(reconciliation?.changed_employees || []),
    [reconciliation?.changed_employees, searchQuery, sortField, sortDirection]
  )

  const VarianceCard = ({
    title,
    data,
    isCurrency = true,
  }: {
    title: string
    data: VarianceData | undefined
    isCurrency?: boolean
  }) => {
    if (!data) return null
    const isPositive = (data.difference || 0) > 0
    const isNegative = (data.difference || 0) < 0

    const current = data.current ?? 0
    const previous = data.previous ?? 0
    const difference = data.difference ?? 0
    const percentage = data.percentage ?? 0

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
        <p className="text-sm text-gray-500 mb-1">{title}</p>
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-semibold text-gray-900">
            {isCurrency ? formatCurrency(current) : current.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            {isPositive && <ArrowUpIcon className="h-4 w-4 text-green-500" />}
            {isNegative && <ArrowDownIcon className="h-4 w-4 text-red-500" />}
            <span
              className={`text-sm font-medium ${
                isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
              }`}
            >
              {formatPercent(percentage)}
            </span>
          </div>
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-400">
          <span>Previous: {isCurrency ? formatCurrency(previous) : previous.toLocaleString()}</span>
          <span
            className={`font-medium ${
              isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : ''
            }`}
          >
            {isPositive ? '+' : ''}
            {isCurrency ? formatCurrency(difference) : difference.toLocaleString()}
          </span>
        </div>
      </div>
    )
  }

  const ImpactCard = ({
    title,
    count,
    amount,
    icon: Icon,
    color,
    onClick,
  }: {
    title: string
    count: number
    amount: number
    icon: React.ComponentType<{ className?: string }>
    color: 'green' | 'red' | 'yellow' | 'gray'
    onClick?: () => void
  }) => {
    const colorClasses = {
      green: 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100',
      red: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100',
      yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200 hover:bg-yellow-100',
      gray: 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100',
    }

    return (
      <button
        onClick={onClick}
        className={`rounded-lg border p-4 ${colorClasses[color]} transition-colors cursor-pointer w-full text-left`}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-8 w-8" />
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-2xl font-bold">{count}</p>
            {amount !== 0 && (
              <p className="text-sm opacity-80">
                {amount > 0 ? '+' : ''}
                {formatCurrency(amount)}
              </p>
            )}
          </div>
        </div>
      </button>
    )
  }

  // Chart component for summary view
  const ComparisonChart = () => {
    if (!reconciliation?.summary) return null

    const summary = reconciliation.summary
    const data = [
      { label: 'Gross', prev: summary.gross?.previous ?? 0, curr: summary.gross?.current ?? 0 },
      { label: 'Deductions', prev: summary.deductions?.previous ?? 0, curr: summary.deductions?.current ?? 0 },
      { label: 'Net', prev: summary.net?.previous ?? 0, curr: summary.net?.current ?? 0 },
      { label: 'PAYE', prev: summary.paye?.previous ?? 0, curr: summary.paye?.current ?? 0 },
      { label: 'SSNIT', prev: summary.ssnit_employee?.previous ?? 0, curr: summary.ssnit_employee?.current ?? 0 },
    ]

    const maxValue = Math.max(...data.flatMap((d) => [d.prev, d.curr]), 1) // Minimum of 1 to avoid division by zero

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Period Comparison</h3>
        <div className="space-y-4">
          {data.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{item.label}</span>
                <span>
                  {formatCurrency(item.curr - item.prev)} ({item.curr > item.prev ? '+' : ''}
                  {item.prev !== 0 ? (((item.curr - item.prev) / item.prev) * 100).toFixed(1) : '0.0'}%)
                </span>
              </div>
              <div className="flex gap-1 h-6">
                <div
                  className="bg-gray-300 rounded-l"
                  style={{ width: `${(item.prev / maxValue) * 100}%` }}
                  title={`Previous: ${formatCurrency(item.prev)}`}
                />
                <div
                  className={`rounded-r ${item.curr >= item.prev ? 'bg-primary-500' : 'bg-red-400'}`}
                  style={{ width: `${(item.curr / maxValue) * 100}%` }}
                  title={`Current: ${formatCurrency(item.curr)}`}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">{formatCurrency(item.prev)}</span>
                <span className="font-medium text-gray-700">{formatCurrency(item.curr)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-6 mt-4 pt-4 border-t text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-300 rounded" />
            <span className="text-gray-500">Previous Period</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary-500 rounded" />
            <span className="text-gray-500">Current Period</span>
          </div>
        </div>
      </div>
    )
  }

  // Employee detail modal
  const EmployeeDetailModal = () => {
    if (!selectedEmployee) return null

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto">
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{selectedEmployee.employee_name}</h3>
              <p className="text-sm text-gray-500">{selectedEmployee.employee_number}</p>
            </div>
            <button
              onClick={() => setSelectedEmployee(null)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Department</p>
                <p className="font-medium">{selectedEmployee.department || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Position</p>
                <p className="font-medium">{selectedEmployee.position || 'N/A'}</p>
              </div>
            </div>

            {selectedEmployee.change_reasons && (
              <div>
                <p className="text-xs text-gray-500 uppercase mb-2">Change Reason</p>
                <Badge variant="warning">{selectedEmployee.change_reasons}</Badge>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Component</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Previous</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Current</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedEmployee.prev_basic !== undefined && (
                    <tr>
                      <td className="px-4 py-2 text-sm">Basic Salary</td>
                      <td className="px-4 py-2 text-sm text-right text-gray-500">
                        {formatCurrency(selectedEmployee.prev_basic || 0)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-medium">
                        {formatCurrency(selectedEmployee.curr_basic || 0)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right">
                        <span
                          className={
                            (selectedEmployee.basic_diff || 0) > 0
                              ? 'text-green-600'
                              : (selectedEmployee.basic_diff || 0) < 0
                              ? 'text-red-600'
                              : ''
                          }
                        >
                          {(selectedEmployee.basic_diff || 0) > 0 ? '+' : ''}
                          {formatCurrency(selectedEmployee.basic_diff || 0)}
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="px-4 py-2 text-sm">Gross Earnings</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-500">
                      {formatCurrency(selectedEmployee.prev_gross || 0)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium">
                      {formatCurrency(selectedEmployee.curr_gross || selectedEmployee.gross_earnings || 0)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      <span
                        className={
                          (selectedEmployee.gross_diff || 0) > 0
                            ? 'text-green-600'
                            : (selectedEmployee.gross_diff || 0) < 0
                            ? 'text-red-600'
                            : ''
                        }
                      >
                        {(selectedEmployee.gross_diff || 0) > 0 ? '+' : ''}
                        {formatCurrency(selectedEmployee.gross_diff || 0)}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-sm">Total Deductions</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-500">
                      {formatCurrency(selectedEmployee.prev_deductions || 0)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium">
                      {formatCurrency(selectedEmployee.curr_deductions || selectedEmployee.total_deductions || 0)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      <span
                        className={
                          (selectedEmployee.deductions_diff || 0) > 0
                            ? 'text-red-600'
                            : (selectedEmployee.deductions_diff || 0) < 0
                            ? 'text-green-600'
                            : ''
                        }
                      >
                        {(selectedEmployee.deductions_diff || 0) > 0 ? '+' : ''}
                        {formatCurrency(selectedEmployee.deductions_diff || 0)}
                      </span>
                    </td>
                  </tr>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-2 text-sm">Net Salary</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-500">
                      {formatCurrency(selectedEmployee.prev_net || 0)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      {formatCurrency(selectedEmployee.curr_net || selectedEmployee.net_salary || 0)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      <span
                        className={
                          (selectedEmployee.net_diff || 0) > 0
                            ? 'text-green-600'
                            : (selectedEmployee.net_diff || 0) < 0
                            ? 'text-red-600'
                            : ''
                        }
                      >
                        {(selectedEmployee.net_diff || 0) > 0 ? '+' : ''}
                        {formatCurrency(selectedEmployee.net_diff || 0)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Search and filter bar component
  const SearchBar = () => (
    <div className="flex items-center gap-4 mb-4">
      <div className="relative flex-1 max-w-md">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, ID, or department..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>
    </div>
  )

  // Table header component with sorting
  const SortableHeader = ({
    field,
    children,
    className = '',
  }: {
    field: SortField
    children: React.ReactNode
    className?: string
  }) => (
    <th
      className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
        {children}
        <SortIcon field={field} />
      </div>
    </th>
  )

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex justify-between items-start print:hidden">
        <PageHeader
          title="Payroll Reconciliation"
          subtitle="Compare payroll between periods to identify changes"
        />
      </div>

      {/* Print Header */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold text-center">Payroll Reconciliation Report</h1>
        {reconciliation?.summary && (
          <p className="text-center text-gray-600 mt-1">
            {reconciliation.summary.previous_period ?? ''} to {reconciliation.summary.current_period ?? ''}
          </p>
        )}
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Period <span className="text-xs text-gray-400">(Active)</span>
              </label>
              <select
                value={currentPeriodId}
                onChange={(e) => handleCurrentPeriodChange(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              >
                <option value="">Select active period...</option>
                {activePeriods?.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name} ({period.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Previous Period <span className="text-xs text-gray-400">(Closed)</span>
              </label>
              <select
                value={previousPeriodId}
                onChange={(e) => handlePreviousPeriodChange(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              >
                <option value="">Select closed period...</option>
                {closedPeriods?.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name} ({period.status})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => refetch()}
              disabled={isFetching || !currentPeriodId || !previousPeriodId}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Compare
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                disabled={isExporting !== null || !reconciliation}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                CSV
              </button>
              <button
                onClick={() => handleExport('excel')}
                disabled={isExporting !== null || !reconciliation}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <TableCellsIcon className="h-4 w-4" />
                Excel
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={isExporting !== null || !reconciliation}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                PDF
              </button>
              <button
                onClick={handlePrint}
                disabled={!reconciliation}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <PrinterIcon className="h-4 w-4" />
                Print
              </button>
            </div>
          </div>
          {isExporting && (
            <div className="mt-3 text-sm text-primary-600 flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
              Generating {isExporting.toUpperCase()} report...
            </div>
          )}
        </CardContent>
      </Card>

      {error ? (
        <div className="text-center py-12">
          <p className="text-red-500">Failed to load reconciliation data. Please try again.</p>
          <button
            onClick={() => refetch()}
            className="mt-4 text-primary-600 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : isFetching ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading reconciliation data...</p>
        </div>
      ) : !currentPeriodId || !previousPeriodId ? (
        <div className="text-center py-12">
          <ChartBarIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">
            Select both a current period and a previous period, then click Compare.
          </p>
        </div>
      ) : reconciliation?.message ? (
        <div className="text-center py-12">
          <p className="text-gray-500">{reconciliation.message}</p>
        </div>
      ) : reconciliation?.summary ? (
        <>
          {/* Period Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-xl p-6 text-white print:bg-gray-100 print:text-gray-900">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <p className="text-sm opacity-80 print:opacity-100">Comparing</p>
                <p className="text-xl font-semibold">
                  {reconciliation.summary.previous_period ?? 'N/A'} → {reconciliation.summary.current_period ?? 'N/A'}
                </p>
                <p className="text-xs opacity-70 mt-1">
                  {reconciliation.summary.previous_run_date ?? ''} to {reconciliation.summary.current_run_date ?? ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-80 print:opacity-100">Net Salary Change</p>
                <p className="text-3xl font-bold">
                  {(reconciliation.summary.net?.difference ?? 0) >= 0 ? '+' : ''}
                  {formatCurrency(reconciliation.summary.net?.difference ?? 0)}
                </p>
                <p className="text-sm opacity-70">
                  ({formatPercent(reconciliation.summary.net?.percentage ?? 0)})
                </p>
              </div>
            </div>
          </div>

          {/* Impact Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ImpactCard
              title="New Employees"
              count={reconciliation.impact?.new_employees_count ?? 0}
              amount={reconciliation.impact?.new_employees_cost ?? 0}
              icon={UserPlusIcon}
              color="green"
              onClick={() => setActiveTab('new')}
            />
            <ImpactCard
              title="Separated"
              count={reconciliation.impact?.separated_employees_count ?? 0}
              amount={-(reconciliation.impact?.separated_employees_savings ?? 0)}
              icon={UserMinusIcon}
              color="red"
              onClick={() => setActiveTab('separated')}
            />
            <ImpactCard
              title="Changed"
              count={reconciliation.impact?.changed_employees_count ?? 0}
              amount={reconciliation.impact?.net_salary_impact ?? 0}
              icon={PencilSquareIcon}
              color="yellow"
              onClick={() => setActiveTab('changed')}
            />
            <ImpactCard
              title="Unchanged"
              count={reconciliation.impact?.unchanged_employees_count ?? 0}
              amount={0}
              icon={CheckCircleIcon}
              color="gray"
            />
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 print:hidden">
            <nav className="-mb-px flex gap-6 overflow-x-auto">
              {[
                { id: 'summary', label: 'Summary', icon: ChartBarIcon },
                { id: 'new', label: `New (${reconciliation.impact?.new_employees_count ?? 0})`, icon: UserPlusIcon },
                { id: 'separated', label: `Separated (${reconciliation.impact?.separated_employees_count ?? 0})`, icon: UserMinusIcon },
                { id: 'changed', label: `Changed (${reconciliation.impact?.changed_employees_count ?? 0})`, icon: PencilSquareIcon },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* View toggle */}
              <div className="flex justify-end gap-2 print:hidden">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`p-2 rounded ${viewMode === 'cards' ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <TableCellsIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode('chart')}
                  className={`p-2 rounded ${viewMode === 'chart' ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <ChartBarIcon className="h-5 w-5" />
                </button>
              </div>

              {viewMode === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <VarianceCard title="Employees" data={reconciliation.summary?.employees} isCurrency={false} />
                  <VarianceCard title="Gross Pay" data={reconciliation.summary?.gross} />
                  <VarianceCard title="Deductions" data={reconciliation.summary?.deductions} />
                  <VarianceCard title="Net Pay" data={reconciliation.summary?.net} />
                  <VarianceCard title="PAYE Tax" data={reconciliation.summary?.paye} />
                  <VarianceCard title="SSNIT Employee" data={reconciliation.summary?.ssnit_employee} />
                  <VarianceCard title="SSNIT Employer" data={reconciliation.summary?.ssnit_employer} />
                </div>
              ) : (
                <ComparisonChart />
              )}
            </div>
          )}

          {activeTab === 'new' && (
            <Card>
              <CardContent className="p-4">
                {(reconciliation.new_employees?.length ?? 0) === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <UserPlusIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    No new employees in this period
                  </div>
                ) : (
                  <>
                    <SearchBar />
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <SortableHeader field="employee_name" className="text-left">
                              Employee
                            </SortableHeader>
                            <SortableHeader field="department" className="text-left">
                              Department
                            </SortableHeader>
                            <SortableHeader field="gross" className="text-right">
                              Gross Salary
                            </SortableHeader>
                            <SortableHeader field="net" className="text-right">
                              Net Salary
                            </SortableHeader>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Reason
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {filteredNewEmployees.map((emp, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{emp.employee_name || 'N/A'}</div>
                                <div className="text-sm text-gray-500">{emp.employee_number || ''}</div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">{emp.department || 'N/A'}</td>
                              <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                                {formatCurrency(emp.gross_earnings || 0)}
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                                {formatCurrency(emp.net_salary || 0)}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="success">{emp.reason || 'New'}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={2} className="px-4 py-3 text-sm font-medium text-gray-900">
                              Total ({filteredNewEmployees.length} employees)
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-green-600">
                              +{formatCurrency(filteredNewEmployees.reduce((sum, e) => sum + (e.gross_earnings || 0), 0))}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-green-600">
                              +{formatCurrency(filteredNewEmployees.reduce((sum, e) => sum + (e.net_salary || 0), 0))}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'separated' && (
            <Card>
              <CardContent className="p-4">
                {(reconciliation.separated_employees?.length ?? 0) === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <UserMinusIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    No separated employees in this period
                  </div>
                ) : (
                  <>
                    <SearchBar />
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <SortableHeader field="employee_name" className="text-left">
                              Employee
                            </SortableHeader>
                            <SortableHeader field="department" className="text-left">
                              Department
                            </SortableHeader>
                            <SortableHeader field="gross" className="text-right">
                              Last Gross
                            </SortableHeader>
                            <SortableHeader field="net" className="text-right">
                              Last Net
                            </SortableHeader>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Reason
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {filteredSeparatedEmployees.map((emp, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{emp.employee_name || 'N/A'}</div>
                                <div className="text-sm text-gray-500">{emp.employee_number || ''}</div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">{emp.department || 'N/A'}</td>
                              <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                                {formatCurrency(emp.gross_earnings || 0)}
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                                {formatCurrency(emp.net_salary || 0)}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="danger">{emp.reason || 'Separated'}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={2} className="px-4 py-3 text-sm font-medium text-gray-900">
                              Total Savings ({filteredSeparatedEmployees.length} employees)
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-red-600">
                              -{formatCurrency(filteredSeparatedEmployees.reduce((sum, e) => sum + (e.gross_earnings || 0), 0))}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-red-600">
                              -{formatCurrency(filteredSeparatedEmployees.reduce((sum, e) => sum + (e.net_salary || 0), 0))}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'changed' && (
            <Card>
              <CardContent className="p-4">
                {(reconciliation.changed_employees?.length ?? 0) === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <PencilSquareIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    No salary changes in this period
                  </div>
                ) : (
                  <>
                    <SearchBar />
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <SortableHeader field="employee_name" className="text-left">
                              Employee
                            </SortableHeader>
                            <SortableHeader field="department" className="text-left">
                              Department
                            </SortableHeader>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              Prev Net
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              Curr Net
                            </th>
                            <SortableHeader field="diff" className="text-right">
                              Difference
                            </SortableHeader>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Reason
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase print:hidden">
                              Details
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {filteredChangedEmployees.map((emp, idx) => {
                            const isIncrease = (emp.net_diff || 0) > 0
                            return (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-900">{emp.employee_name || 'N/A'}</div>
                                  <div className="text-sm text-gray-500">{emp.employee_number || ''}</div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">{emp.department || 'N/A'}</td>
                                <td className="px-4 py-3 text-right text-sm text-gray-500">
                                  {formatCurrency(emp.prev_net || 0)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                                  {formatCurrency(emp.curr_net || 0)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span
                                    className={`inline-flex items-center gap-1 text-sm font-medium ${
                                      isIncrease ? 'text-green-600' : 'text-red-600'
                                    }`}
                                  >
                                    {isIncrease ? (
                                      <ArrowUpIcon className="h-3 w-3" />
                                    ) : (
                                      <ArrowDownIcon className="h-3 w-3" />
                                    )}
                                    {formatCurrency(Math.abs(emp.net_diff || 0))}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge variant="warning">{emp.change_reasons || 'Changed'}</Badge>
                                </td>
                                <td className="px-4 py-3 text-center print:hidden">
                                  <button
                                    onClick={() => setSelectedEmployee(emp)}
                                    className="p-1 hover:bg-gray-100 rounded"
                                    title="View details"
                                  >
                                    <EyeIcon className="h-4 w-4 text-gray-500" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-900">
                              Net Impact ({filteredChangedEmployees.length} employees)
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`text-sm font-bold ${
                                  reconciliation.impact.net_salary_impact >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {reconciliation.impact.net_salary_impact >= 0 ? '+' : ''}
                                {formatCurrency(reconciliation.impact.net_salary_impact)}
                              </span>
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <ChartBarIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">
            Select payroll periods to compare or click Compare to use the latest two runs.
          </p>
        </div>
      )}

      {/* Employee Detail Modal */}
      <EmployeeDetailModal />
    </div>
  )
}
