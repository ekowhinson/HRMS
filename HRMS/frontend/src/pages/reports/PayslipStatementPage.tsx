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

interface PayslipPeriod {
  period_name: string
  year: number
  earnings: Record<string, number>
  deductions: Record<string, number>
  total_earnings: number
  total_deductions: number
  net_salary: number
}

interface PayslipEmployee {
  employee_number: string
  full_name: string
  department: string
  periods: PayslipPeriod[]
  yearly_subtotals: Record<string, Record<string, number>>
  grand_total: Record<string, number>
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
  const earningNames: string[] = data?.earning_names || []
  const deductionNames: string[] = data?.deduction_names || []
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
                : 'Per-employee payslip breakdown by period'}
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
                    <p className="text-xs text-gray-500">Net Salary (Total)</p>
                    <p className="font-bold text-gray-900">
                      {formatCurrency(emp.grand_total.net_salary || 0)}
                    </p>
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="border-t p-0">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                            {earningNames.map((name) => (
                              <th key={`e-${name}`} className="px-4 py-2 text-right text-xs font-medium text-green-600 uppercase whitespace-nowrap">
                                {name}
                              </th>
                            ))}
                            <th className="px-4 py-2 text-right text-xs font-medium text-green-700 uppercase bg-green-50">Total Earn.</th>
                            {deductionNames.map((name) => (
                              <th key={`d-${name}`} className="px-4 py-2 text-right text-xs font-medium text-red-600 uppercase whitespace-nowrap">
                                {name}
                              </th>
                            ))}
                            <th className="px-4 py-2 text-right text-xs font-medium text-red-700 uppercase bg-red-50">Total Ded.</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 uppercase bg-gray-100">Net Salary</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {(() => {
                            const years = [...new Set(emp.periods.map((p) => p.year))].sort()
                            return years.map((year) => {
                              const yearPeriods = emp.periods.filter((p) => p.year === year)
                              const yearSub = emp.yearly_subtotals[String(year)]
                              return (
                                <PayslipYearSection
                                  key={year}
                                  year={year}
                                  periods={yearPeriods}
                                  yearSubtotal={yearSub}
                                  earningNames={earningNames}
                                  deductionNames={deductionNames}
                                />
                              )
                            })
                          })()}
                          {/* Grand Total */}
                          <tr className="bg-gray-200 font-bold">
                            <td className="px-4 py-2 text-sm text-gray-900">GRAND TOTAL</td>
                            {earningNames.map((name) => (
                              <td key={`e-${name}`} className="px-4 py-2 text-sm text-right">
                                {formatCurrency(emp.grand_total[`e_${name}`] || 0)}
                              </td>
                            ))}
                            <td className="px-4 py-2 text-sm text-right text-green-700">{formatCurrency(emp.grand_total.total_earnings || 0)}</td>
                            {deductionNames.map((name) => (
                              <td key={`d-${name}`} className="px-4 py-2 text-sm text-right">
                                {formatCurrency(emp.grand_total[`d_${name}`] || 0)}
                              </td>
                            ))}
                            <td className="px-4 py-2 text-sm text-right text-red-700">{formatCurrency(emp.grand_total.total_deductions || 0)}</td>
                            <td className="px-4 py-2 text-sm text-right font-bold">{formatCurrency(emp.grand_total.net_salary || 0)}</td>
                          </tr>
                        </tbody>
                      </table>
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

function PayslipYearSection({
  year,
  periods,
  yearSubtotal,
  earningNames,
  deductionNames,
}: {
  year: number
  periods: PayslipPeriod[]
  yearSubtotal?: Record<string, number>
  earningNames: string[]
  deductionNames: string[]
}) {
  return (
    <>
      {periods.map((period) => (
        <tr key={period.period_name} className="hover:bg-gray-50">
          <td className="px-4 py-2 text-sm text-gray-700">{period.period_name}</td>
          {earningNames.map((name) => (
            <td key={`e-${name}`} className="px-4 py-2 text-sm text-right">
              {formatCurrency(period.earnings[name] || 0)}
            </td>
          ))}
          <td className="px-4 py-2 text-sm text-right font-medium text-green-700">{formatCurrency(period.total_earnings)}</td>
          {deductionNames.map((name) => (
            <td key={`d-${name}`} className="px-4 py-2 text-sm text-right">
              {formatCurrency(period.deductions[name] || 0)}
            </td>
          ))}
          <td className="px-4 py-2 text-sm text-right font-medium text-red-700">{formatCurrency(period.total_deductions)}</td>
          <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(period.net_salary)}</td>
        </tr>
      ))}
      {yearSubtotal && (
        <tr className="bg-yellow-50 font-semibold">
          <td className="px-4 py-2 text-sm text-yellow-800">{year} Subtotal</td>
          {earningNames.map((name) => (
            <td key={`e-${name}`} className="px-4 py-2 text-sm text-right text-yellow-800">
              {formatCurrency(yearSubtotal[`e_${name}`] || 0)}
            </td>
          ))}
          <td className="px-4 py-2 text-sm text-right text-yellow-800">{formatCurrency(yearSubtotal.total_earnings || 0)}</td>
          {deductionNames.map((name) => (
            <td key={`d-${name}`} className="px-4 py-2 text-sm text-right text-yellow-800">
              {formatCurrency(yearSubtotal[`d_${name}`] || 0)}
            </td>
          ))}
          <td className="px-4 py-2 text-sm text-right text-yellow-800">{formatCurrency(yearSubtotal.total_deductions || 0)}</td>
          <td className="px-4 py-2 text-sm text-right text-yellow-800">{formatCurrency(yearSubtotal.net_salary || 0)}</td>
        </tr>
      )}
    </>
  )
}
