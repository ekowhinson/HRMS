import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { reportsService } from '@/services/reports'
import { usePeriodRange } from '@/hooks/usePeriodRange'
import { useExport } from '@/hooks/useExport'
import ExportMenu from '@/components/ui/ExportMenu'
import { Card, CardContent } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import PeriodRangeSelector from '@/components/reports/PeriodRangeSelector'
import { formatCurrency } from '@/lib/utils'

interface PayslipEntry {
  period_name: string
  year: number
  basic_salary: number
  gross_pay: number
  total_deductions: number
  net_pay: number
  paye_tax: number
  ssnit_employee: number
  ssnit_employer: number
  allowances: { name: string; amount: number }[]
  other_deductions: { name: string; amount: number }[]
  arrear_allowances: { name: string; amount: number }[]
  arrear_deductions: { name: string; amount: number }[]
}

interface PayslipEmployee {
  employee_number: string
  full_name: string
  department: string
  payslips: PayslipEntry[]
}

export default function PayslipStatementPage() {
  const { fromPeriod, setFromPeriod, toPeriod, setToPeriod, periodOptions, isLoading: periodsLoading } = usePeriodRange()
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set())

  const { exporting, handleExport } = useExport((format) =>
    reportsService.exportPayslipStatement(
      { from_period: fromPeriod, to_period: toPeriod },
      format
    )
  )

  const { data, isLoading } = useQuery({
    queryKey: ['payslip-statement', fromPeriod, toPeriod],
    queryFn: () =>
      reportsService.getPayslipStatement({
        from_period: fromPeriod,
        to_period: toPeriod,
      }),
    enabled: !!fromPeriod && !!toPeriod,
  })

  const employees: PayslipEmployee[] = data?.employees || []
  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))].sort()

  const filtered = employees.filter((emp) => {
    const matchesSearch =
      !search ||
      emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_number.toLowerCase().includes(search.toLowerCase())
    const matchesDept = !department || emp.department === department
    return matchesSearch && matchesDept
  })

  const toggleEmployee = (empNo: string) => {
    setExpandedEmployees((prev) => {
      const next = new Set(prev)
      if (next.has(empNo)) next.delete(empNo)
      else next.add(empNo)
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/reports" className="p-2 rounded-md hover:bg-gray-100 transition-colors">
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payslip Statement</h1>
            <p className="mt-1 text-sm text-gray-500">
              {data?.from_period_name && data?.to_period_name
                ? `${data.from_period_name} to ${data.to_period_name}`
                : 'Per-employee monthly payslips across period range'}
            </p>
          </div>
        </div>
        <ExportMenu onExport={handleExport} loading={exporting} disabled={!fromPeriod || !toPeriod} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <PeriodRangeSelector
              fromPeriod={fromPeriod}
              toPeriod={toPeriod}
              onFromChange={setFromPeriod}
              onToChange={setToPeriod}
              periodOptions={periodOptions}
              isLoading={periodsLoading}
            />
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
              />
            </div>
            <div className="w-56">
              <Select
                label="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                options={[
                  { value: '', label: 'All Departments' },
                  ...departments.map((d) => ({ value: d, label: d })),
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setExpandedEmployees(new Set(filtered.map((e) => e.employee_number)))}
              className="px-3 py-1 text-xs border rounded hover:bg-gray-50"
            >
              Expand All
            </button>
            <button
              onClick={() => setExpandedEmployees(new Set())}
              className="px-3 py-1 text-xs border rounded hover:bg-gray-50"
            >
              Collapse All
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-gray-500">
            {!fromPeriod || !toPeriod
              ? 'Please select a period range to view the report.'
              : 'No records found matching your criteria.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((emp) => {
            const isExpanded = expandedEmployees.has(emp.employee_number)
            const totalNet = emp.payslips.reduce((sum, ps) => sum + ps.net_pay, 0)
            return (
              <Card key={emp.employee_number}>
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                  onClick={() => toggleEmployee(emp.employee_number)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        {emp.employee_number} - {emp.full_name}
                      </p>
                      <p className="text-sm text-gray-500">{emp.department}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{emp.payslips.length} payslip{emp.payslips.length !== 1 ? 's' : ''}</p>
                    <p className="font-bold text-gray-900">
                      {formatCurrency(totalNet)}
                    </p>
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="border-t pt-0 px-4 pb-4">
                    <div className="divide-y divide-gray-200">
                      {emp.payslips.map((ps) => (
                        <PayslipCard key={ps.period_name} payslip={ps} />
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PayslipCard({ payslip: ps }: { payslip: PayslipEntry }) {
  const maxRows = Math.max(ps.allowances.length, ps.other_deductions.length, 1)
  const arrearMaxRows = Math.max(ps.arrear_allowances.length, ps.arrear_deductions.length)
  const hasArrears = arrearMaxRows > 0

  return (
    <div className="py-5 space-y-4">
      {/* Period Header */}
      <div className="text-center">
        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
          Payslip for {ps.period_name}
        </h4>
      </div>

      {/* Basic Salary Banner */}
      <div className="flex items-center justify-between bg-blue-600 text-white rounded px-4 py-2">
        <span className="text-sm font-bold">BASIC SALARY</span>
        <span className="text-sm font-bold">{formatCurrency(ps.basic_salary)}</span>
      </div>

      {/* Allowances & Deductions Side-by-Side Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-3 py-2 text-left font-semibold w-[30%]">Allowances</th>
              <th className="px-3 py-2 text-right font-semibold w-[20%]">Amount</th>
              <th className="px-3 py-2 text-left font-semibold w-[30%]">Deductions</th>
              <th className="px-3 py-2 text-right font-semibold w-[20%]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRows }, (_, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-1.5 text-gray-700">
                  {i < ps.allowances.length ? ps.allowances[i].name : ''}
                </td>
                <td className="px-3 py-1.5 text-right text-gray-900">
                  {i < ps.allowances.length ? formatCurrency(ps.allowances[i].amount) : ''}
                </td>
                <td className="px-3 py-1.5 text-gray-700">
                  {i < ps.other_deductions.length ? ps.other_deductions[i].name : ''}
                </td>
                <td className="px-3 py-1.5 text-right text-danger-600">
                  {i < ps.other_deductions.length ? formatCurrency(ps.other_deductions[i].amount) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Backpay Arrears Side-by-Side Table */}
      {hasArrears && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-orange-200">
            <thead>
              <tr className="bg-orange-500 text-white">
                <th className="px-3 py-2 text-left font-semibold w-[30%]">Backpay Arrear Earnings</th>
                <th className="px-3 py-2 text-right font-semibold w-[20%]">Amount</th>
                <th className="px-3 py-2 text-left font-semibold w-[30%]">Backpay Arrear Deductions</th>
                <th className="px-3 py-2 text-right font-semibold w-[20%]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: arrearMaxRows }, (_, i) => (
                <tr key={i} className="border-t border-orange-100">
                  <td className="px-3 py-1.5 text-gray-700">
                    {i < ps.arrear_allowances.length ? ps.arrear_allowances[i].name : ''}
                  </td>
                  <td className="px-3 py-1.5 text-right text-orange-700 font-medium">
                    {i < ps.arrear_allowances.length ? formatCurrency(ps.arrear_allowances[i].amount) : ''}
                  </td>
                  <td className="px-3 py-1.5 text-gray-700">
                    {i < ps.arrear_deductions.length ? ps.arrear_deductions[i].name : ''}
                  </td>
                  <td className="px-3 py-1.5 text-right text-danger-600">
                    {i < ps.arrear_deductions.length ? formatCurrency(ps.arrear_deductions[i].amount) : ''}
                  </td>
                </tr>
              ))}
              {/* Arrears totals row */}
              <tr className="border-t border-orange-300 bg-orange-50 font-semibold">
                <td className="px-3 py-1.5 text-orange-800">Total Arrear Earnings</td>
                <td className="px-3 py-1.5 text-right text-orange-800">
                  {formatCurrency(ps.arrear_allowances.reduce((s, a) => s + a.amount, 0))}
                </td>
                <td className="px-3 py-1.5 text-orange-800">Total Arrear Deductions</td>
                <td className="px-3 py-1.5 text-right text-orange-800">
                  {formatCurrency(ps.arrear_deductions.reduce((s, d) => s + d.amount, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Pay Summary */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th colSpan={4} className="px-3 py-2 text-center font-bold text-sm">
                PAY SUMMARY
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-200">
              <td className="px-3 py-2 font-semibold text-gray-700 w-[30%]">Total Earnings</td>
              <td className="px-3 py-2 text-right text-gray-900 w-[20%]">{formatCurrency(ps.gross_pay)}</td>
              <td className="px-3 py-2 font-semibold text-gray-700 w-[30%]">Total Deductions</td>
              <td className="px-3 py-2 text-right text-danger-600 w-[20%]">{formatCurrency(ps.total_deductions)}</td>
            </tr>
            <tr className="border-t border-gray-200">
              <td className="px-3 py-2 font-semibold text-gray-700">PAYE Tax</td>
              <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(ps.paye_tax)}</td>
              <td className="px-3 py-2 font-bold text-gray-900">Net Salary</td>
              <td className="px-3 py-2 text-right font-bold text-success-600 border-b-2 border-gray-900">
                {formatCurrency(ps.net_pay)}
              </td>
            </tr>
            <tr className="border-t border-gray-200">
              <td className="px-3 py-2 font-semibold text-gray-700">Employee SSF</td>
              <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(ps.ssnit_employee)}</td>
              <td className="px-3 py-2 font-semibold text-gray-700">Employer SSF</td>
              <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(ps.ssnit_employer)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
