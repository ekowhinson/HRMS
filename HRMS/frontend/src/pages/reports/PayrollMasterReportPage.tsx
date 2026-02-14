import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  DocumentArrowDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { reportsService } from '@/services/reports'
import { payrollService } from '@/services/payroll'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { useGroupBy } from '@/hooks/useGroupBy'
import type { PayrollRun, Department } from '@/types'

interface TransactionItem {
  code: string
  name: string
  amount: number
  notes: string | null
}

interface EmployeePayrollData {
  employee_id: string
  employee_number: string
  full_name: string
  department: string | null
  position: string | null
  grade: string | null
  bank_name: string | null
  bank_account: string | null
  earnings: TransactionItem[]
  gross_salary: number
  deductions: TransactionItem[]
  total_deductions: number
  net_salary: number
  employer_contributions: TransactionItem[]
  total_employer_contributions: number
  employer_cost: number
}

interface PayrollMasterData {
  payroll_run: {
    id: string
    run_number: string
    period_name: string
    status: string
    run_date: string
  }
  summary: {
    total_employees: number
    total_gross: number
    total_deductions: number
    total_net: number
    total_employer_contributions: number
    total_employer_cost: number
  }
  employees: EmployeePayrollData[]
}

const GROUP_BY_OPTIONS = [
  { value: '', label: 'No Grouping' },
  { value: 'department', label: 'Department' },
  { value: 'grade', label: 'Grade' },
]

const NUMERIC_KEYS = ['gross_salary', 'total_deductions', 'net_salary', 'total_employer_contributions', 'employer_cost']

export default function PayrollMasterReportPage() {
  const [selectedRun, setSelectedRun] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set())
  const [groupByField, setGroupByField] = useState('')

  // Fetch payroll runs
  const { data: runs } = useQuery({
    queryKey: ['payroll-runs-for-report'],
    queryFn: () => payrollService.getRuns(),
  })

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await fetch('/api/v1/organization/departments/')
      return response.json()
    },
  })

  // Fetch payroll master report
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['payroll-master-report', selectedRun, selectedDepartment],
    queryFn: () => reportsService.getPayrollMaster({
      payroll_run: selectedRun || undefined,
      department: selectedDepartment || undefined,
    }),
    enabled: true,
  })

  const data = reportData as PayrollMasterData | undefined

  // Filter employees by search term
  const filteredEmployees = data?.employees.filter(emp =>
    emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_number.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const isGrouped = !!groupByField
  const { groups, grandTotals } = useGroupBy(filteredEmployees, groupByField || null, NUMERIC_KEYS)

  const toggleExpand = (employeeId: string) => {
    const newExpanded = new Set(expandedEmployees)
    if (newExpanded.has(employeeId)) {
      newExpanded.delete(employeeId)
    } else {
      newExpanded.add(employeeId)
    }
    setExpandedEmployees(newExpanded)
  }

  const expandAll = () => {
    setExpandedEmployees(new Set(filteredEmployees.map(e => e.employee_id)))
  }

  const collapseAll = () => {
    setExpandedEmployees(new Set())
  }

  // Get computed/approved/paid runs for dropdown
  const availableRuns = runs?.filter((r: PayrollRun) =>
    ['COMPUTED', 'APPROVED', 'PAID'].includes(r.status.toUpperCase())
  ) || []

  const groupByLabel = GROUP_BY_OPTIONS.find((o) => o.value === groupByField)?.label || ''

  const renderEmployeeCard = (emp: EmployeePayrollData) => {
    const isExpanded = expandedEmployees.has(emp.employee_id)
    return (
      <Card key={emp.employee_id}>
        <div
          className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
          onClick={() => toggleExpand(emp.employee_id)}
        >
          <div className="flex items-center gap-4">
            {isExpanded ? (
              <ChevronDownIcon className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronRightIcon className="h-5 w-5 text-gray-400" />
            )}
            <div>
              <p className="font-medium text-gray-900">
                {emp.employee_number} - {emp.full_name}
              </p>
              <p className="text-sm text-gray-500">
                {emp.department} {emp.position && `| ${emp.position}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-8 text-right">
            <div>
              <p className="text-xs text-gray-500">Gross</p>
              <p className="font-medium text-green-600">{formatCurrency(emp.gross_salary)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Deductions</p>
              <p className="font-medium text-red-600">{formatCurrency(emp.total_deductions)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Net Salary</p>
              <p className="font-bold text-purple-600">{formatCurrency(emp.net_salary)}</p>
            </div>
          </div>
        </div>

        {isExpanded && (
          <CardContent className="border-t bg-gray-50 p-0">
            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x">
              {/* Earnings */}
              <div className="p-4">
                <h4 className="font-medium text-green-700 mb-3 flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  Earnings
                </h4>
                <div className="space-y-2">
                  {emp.earnings.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.name}</span>
                      <span className="font-medium">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-green-200">
                    <span className="text-green-700">Gross Salary</span>
                    <span className="text-green-700">{formatCurrency(emp.gross_salary)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="p-4">
                <h4 className="font-medium text-red-700 mb-3 flex items-center">
                  <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                  Deductions
                </h4>
                <div className="space-y-2">
                  {emp.deductions.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.name}</span>
                      <span className="font-medium text-red-600">-{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-red-200">
                    <span className="text-red-700">Total Deductions</span>
                    <span className="text-red-700">-{formatCurrency(emp.total_deductions)}</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t-2 border-purple-300">
                  <div className="flex justify-between font-bold">
                    <span className="text-purple-700">NET SALARY</span>
                    <span className="text-purple-700 text-lg">{formatCurrency(emp.net_salary)}</span>
                  </div>
                </div>
              </div>

              {/* Employer Contributions */}
              <div className="p-4">
                <h4 className="font-medium text-orange-700 mb-3 flex items-center">
                  <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                  Employer Contributions
                </h4>
                <div className="space-y-2">
                  {emp.employer_contributions.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.name}</span>
                      <span className="font-medium">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-orange-200">
                    <span className="text-orange-700">Total Contributions</span>
                    <span className="text-orange-700">{formatCurrency(emp.total_employer_contributions)}</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t-2 border-gray-300">
                  <div className="flex justify-between font-bold">
                    <span className="text-gray-700">EMPLOYER COST</span>
                    <span className="text-gray-700 text-lg">{formatCurrency(emp.employer_cost)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    (Gross + Employer Contributions)
                  </p>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            {(emp.bank_name || emp.bank_account) && (
              <div className="px-4 py-3 bg-gray-100 text-sm text-gray-600 border-t">
                <span className="font-medium">Bank:</span> {emp.bank_name || 'N/A'} |{' '}
                <span className="font-medium">Account:</span> {emp.bank_account || 'N/A'}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Master Report</h1>
          <p className="mt-1 text-sm text-gray-500">
            Detailed breakdown of earnings, deductions, and employer contributions per employee
          </p>
        </div>
        <Button variant="outline" disabled>
          <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-64">
              <Select
                label="Payroll Run"
                value={selectedRun}
                onChange={(e) => setSelectedRun(e.target.value)}
                options={[
                  { value: '', label: 'Latest Run' },
                  ...availableRuns.map((r: PayrollRun) => ({
                    value: r.id,
                    label: `${r.period_name || r.run_number} (${r.status})`,
                  })),
                ]}
              />
            </div>
            <div className="w-64">
              <Select
                label="Department"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                options={[
                  { value: '', label: 'All Departments' },
                  ...(Array.isArray(departments?.results) ? departments.results : Array.isArray(departments) ? departments : []).map((d: Department) => ({
                    value: d.id,
                    label: d.name,
                  })),
                ]}
              />
            </div>
            <div className="w-48">
              <Select
                label="Group By"
                value={groupByField}
                onChange={(e) => setGroupByField(e.target.value)}
                options={GROUP_BY_OPTIONS}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search employee..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
              />
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              <FunnelIcon className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                {data.payroll_run.period_name || data.payroll_run.run_number}
                <Badge variant="info" className="ml-2">{data.payroll_run.status}</Badge>
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={expandAll}>
                  Expand All
                </Button>
                <Button size="sm" variant="outline" onClick={collapseAll}>
                  Collapse All
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600">Employees</p>
                <p className="text-xl font-bold text-blue-700">{data.summary.total_employees}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-green-600">Total Gross</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(data.summary.total_gross)}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-red-600">Total Deductions</p>
                <p className="text-lg font-bold text-red-700">{formatCurrency(data.summary.total_deductions)}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-purple-600">Total Net</p>
                <p className="text-lg font-bold text-purple-700">{formatCurrency(data.summary.total_net)}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-xs text-orange-600">Employer Contrib.</p>
                <p className="text-lg font-bold text-orange-700">{formatCurrency(data.summary.total_employer_contributions)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">Employer Cost</p>
                <p className="text-lg font-bold text-gray-700">{formatCurrency(data.summary.total_employer_cost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee Details */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          </CardContent>
        </Card>
      ) : filteredEmployees.length > 0 ? (
        isGrouped ? (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.label} className="space-y-2">
                {/* Group Header */}
                <div className="bg-blue-50 rounded-lg px-4 py-3 flex items-center justify-between">
                  <h3 className="font-semibold text-blue-800">
                    {groupByLabel}: {group.label} ({group.items.length} employee{group.items.length !== 1 ? 's' : ''})
                  </h3>
                </div>

                {/* Employee Cards */}
                <div className="space-y-4">
                  {group.items.map(renderEmployeeCard)}
                </div>

                {/* Group Sub-Total */}
                <div className="bg-blue-50/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-800">Sub-Total: {group.label}</span>
                    <div className="flex gap-6 text-sm">
                      <span>Gross: <strong className="text-green-700">{formatCurrency(group.totals.gross_salary)}</strong></span>
                      <span>Deductions: <strong className="text-red-700">{formatCurrency(group.totals.total_deductions)}</strong></span>
                      <span>Net: <strong className="text-purple-700">{formatCurrency(group.totals.net_salary)}</strong></span>
                      <span>Employer Cost: <strong className="text-gray-700">{formatCurrency(group.totals.employer_cost)}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Grand Total */}
            <div className="bg-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between font-bold">
                <span className="text-gray-900 uppercase">Grand Total</span>
                <div className="flex gap-6 text-sm">
                  <span>Gross: <strong className="text-green-700">{formatCurrency(grandTotals.gross_salary)}</strong></span>
                  <span>Deductions: <strong className="text-red-700">{formatCurrency(grandTotals.total_deductions)}</strong></span>
                  <span>Net: <strong className="text-purple-700">{formatCurrency(grandTotals.net_salary)}</strong></span>
                  <span>Employer Cost: <strong className="text-gray-700">{formatCurrency(grandTotals.employer_cost)}</strong></span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEmployees.map(renderEmployeeCard)}
          </div>
        )
      ) : data ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">No employees found matching your criteria.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
