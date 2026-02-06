import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon,
  UserPlusIcon,
  UserMinusIcon,
  PencilSquareIcon,
  CheckCircleIcon,
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
}

interface PayrollRun {
  id: string
  run_number: string
  period_name: string
  status: string
  run_date: string
}

export default function PayrollReconciliationPage() {
  const [currentRunId, setCurrentRunId] = useState<string>('')
  const [previousRunId, setPreviousRunId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'summary' | 'new' | 'separated' | 'changed'>('summary')
  const [isExporting, setIsExporting] = useState(false)

  // Fetch available payroll runs
  const { data: payrollRuns } = useQuery<PayrollRun[]>({
    queryKey: ['payroll-runs-for-reconciliation'],
    queryFn: async () => {
      const response = await api.get('/payroll/runs/', {
        params: { status: 'APPROVED,PAID', ordering: '-run_date', page_size: 24 },
      })
      return response.data.results || response.data
    },
  })

  // Fetch reconciliation data
  const {
    data: reconciliation,
    isLoading,
    refetch,
  } = useQuery<ReconciliationData>({
    queryKey: ['payroll-reconciliation', currentRunId, previousRunId],
    queryFn: () => reportsService.getPayrollReconciliation(currentRunId, previousRunId),
    enabled: true, // Always enabled - backend will pick last 2 runs by default
  })

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true)
    try {
      await reportsService.exportPayrollReconciliation(currentRunId, previousRunId, format)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
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

  const VarianceCard = ({
    title,
    data,
    isCurrency = true,
  }: {
    title: string
    data: VarianceData
    isCurrency?: boolean
  }) => {
    const isPositive = data.difference > 0
    const isNegative = data.difference < 0

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-500 mb-1">{title}</p>
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-semibold text-gray-900">
            {isCurrency ? formatCurrency(data.current) : data.current.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            {isPositive && <ArrowUpIcon className="h-4 w-4 text-green-500" />}
            {isNegative && <ArrowDownIcon className="h-4 w-4 text-red-500" />}
            <span
              className={`text-sm font-medium ${
                isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
              }`}
            >
              {formatPercent(data.percentage)}
            </span>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-400">
          Previous: {isCurrency ? formatCurrency(data.previous) : data.previous.toLocaleString()}
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
  }: {
    title: string
    count: number
    amount: number
    icon: React.ComponentType<{ className?: string }>
    color: 'green' | 'red' | 'yellow' | 'gray'
  }) => {
    const colorClasses = {
      green: 'bg-green-50 text-green-600 border-green-200',
      red: 'bg-red-50 text-red-600 border-red-200',
      yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
      gray: 'bg-gray-50 text-gray-600 border-gray-200',
    }

    return (
      <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
        <div className="flex items-center gap-3">
          <Icon className="h-8 w-8" />
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-sm opacity-80">{formatCurrency(Math.abs(amount))}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Reconciliation"
        subtitle="Compare payroll between periods to identify changes"
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Period
              </label>
              <select
                value={currentRunId}
                onChange={(e) => setCurrentRunId(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              >
                <option value="">Latest Run</option>
                {payrollRuns?.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.period_name || run.run_number} ({run.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Previous Period
              </label>
              <select
                value={previousRunId}
                onChange={(e) => setPreviousRunId(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              >
                <option value="">Previous Run</option>
                {payrollRuns?.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.period_name || run.run_number} ({run.status})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Compare
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => handleExport('excel')}
                disabled={isExporting || !reconciliation}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                Excel
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={isExporting || !reconciliation}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                PDF
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading reconciliation data...</p>
        </div>
      ) : reconciliation ? (
        <>
          {/* Period Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-xl p-6 text-white">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm opacity-80">Comparing</p>
                <p className="text-xl font-semibold">
                  {reconciliation.summary.previous_period} → {reconciliation.summary.current_period}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-80">Net Salary Change</p>
                <p className="text-3xl font-bold">
                  {reconciliation.summary.net.difference >= 0 ? '+' : ''}
                  {formatCurrency(reconciliation.summary.net.difference)}
                </p>
              </div>
            </div>
          </div>

          {/* Impact Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ImpactCard
              title="New Employees"
              count={reconciliation.impact.new_employees_count}
              amount={reconciliation.impact.new_employees_cost}
              icon={UserPlusIcon}
              color="green"
            />
            <ImpactCard
              title="Separated"
              count={reconciliation.impact.separated_employees_count}
              amount={reconciliation.impact.separated_employees_savings}
              icon={UserMinusIcon}
              color="red"
            />
            <ImpactCard
              title="Changed"
              count={reconciliation.impact.changed_employees_count}
              amount={reconciliation.impact.net_salary_impact}
              icon={PencilSquareIcon}
              color="yellow"
            />
            <ImpactCard
              title="Unchanged"
              count={reconciliation.impact.unchanged_employees_count}
              amount={0}
              icon={CheckCircleIcon}
              color="gray"
            />
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex gap-6">
              {[
                { id: 'summary', label: 'Summary' },
                { id: 'new', label: `New (${reconciliation.impact.new_employees_count})` },
                {
                  id: 'separated',
                  label: `Separated (${reconciliation.impact.separated_employees_count})`,
                },
                { id: 'changed', label: `Changed (${reconciliation.impact.changed_employees_count})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <VarianceCard title="Employees" data={reconciliation.summary.employees} isCurrency={false} />
              <VarianceCard title="Gross Pay" data={reconciliation.summary.gross} />
              <VarianceCard title="Deductions" data={reconciliation.summary.deductions} />
              <VarianceCard title="Net Pay" data={reconciliation.summary.net} />
              <VarianceCard title="PAYE Tax" data={reconciliation.summary.paye} />
              <VarianceCard title="SSNIT Employee" data={reconciliation.summary.ssnit_employee} />
              <VarianceCard title="SSNIT Employer" data={reconciliation.summary.ssnit_employer} />
            </div>
          )}

          {activeTab === 'new' && (
            <Card>
              <CardContent className="p-0">
                {reconciliation.new_employees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No new employees in this period
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Employee
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Department
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Gross Salary
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Net Salary
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Reason
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {reconciliation.new_employees.map((emp, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{emp.employee_name}</div>
                              <div className="text-sm text-gray-500">{emp.employee_number}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{emp.department}</td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                              {formatCurrency(emp.gross_earnings || 0)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                              {formatCurrency(emp.net_salary || 0)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="success">{emp.reason}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={2} className="px-4 py-3 text-sm font-medium text-gray-900">
                            Total
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                            {formatCurrency(
                              reconciliation.new_employees.reduce(
                                (sum, e) => sum + (e.gross_earnings || 0),
                                0
                              )
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                            {formatCurrency(
                              reconciliation.new_employees.reduce(
                                (sum, e) => sum + (e.net_salary || 0),
                                0
                              )
                            )}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'separated' && (
            <Card>
              <CardContent className="p-0">
                {reconciliation.separated_employees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No separated employees in this period
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Employee
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Department
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Last Gross
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Last Net
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Reason
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {reconciliation.separated_employees.map((emp, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{emp.employee_name}</div>
                              <div className="text-sm text-gray-500">{emp.employee_number}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{emp.department}</td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                              {formatCurrency(emp.gross_earnings || 0)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                              {formatCurrency(emp.net_salary || 0)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="danger">{emp.reason}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={2} className="px-4 py-3 text-sm font-medium text-gray-900">
                            Total Savings
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-red-600">
                            -{formatCurrency(
                              reconciliation.separated_employees.reduce(
                                (sum, e) => sum + (e.gross_earnings || 0),
                                0
                              )
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-red-600">
                            -{formatCurrency(
                              reconciliation.separated_employees.reduce(
                                (sum, e) => sum + (e.net_salary || 0),
                                0
                              )
                            )}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'changed' && (
            <Card>
              <CardContent className="p-0">
                {reconciliation.changed_employees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No salary changes in this period
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Employee
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Department
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Prev Net
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Curr Net
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Difference
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Reason
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {reconciliation.changed_employees.map((emp, idx) => {
                          const isIncrease = (emp.net_diff || 0) > 0
                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{emp.employee_name}</div>
                                <div className="text-sm text-gray-500">{emp.employee_number}</div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">{emp.department}</td>
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
                                <Badge variant="warning">{emp.change_reasons}</Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-900">
                            Net Impact
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`text-sm font-bold ${
                                reconciliation.impact.net_salary_impact >= 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {reconciliation.impact.net_salary_impact >= 0 ? '+' : ''}
                              {formatCurrency(reconciliation.impact.net_salary_impact)}
                            </span>
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">
            Select payroll periods to compare or click Compare to use the latest two runs.
          </p>
        </div>
      )}
    </div>
  )
}
