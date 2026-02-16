import { useState } from 'react'
import {
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import {
  Card,
  CardContent,
  Input,
  Select,
  Button,
  PageHeader,
  EmptyState,
  SkeletonCard,
} from '@/components/ui'
import type { BreadcrumbItem } from '@/components/ui'
import PeriodRangeSelector from '@/components/reports/PeriodRangeSelector'
import { formatCurrency, formatNumber } from '@/lib/utils'

export interface StatementColumn {
  key: string
  label: string
  format?: 'currency' | 'number'
}

interface PeriodData {
  period_name: string
  year: number
  [key: string]: any
}

interface YearlySubtotal {
  [key: string]: number
}

export interface EmployeeStatement {
  employee_number: string
  full_name: string
  department: string
  ssf_number?: string
  tin?: string
  dob?: string
  hire_date?: string
  periods: PeriodData[]
  yearly_subtotals: Record<string, YearlySubtotal>
  grand_total: Record<string, number>
}

interface ContributionStatementLayoutProps {
  title: string
  backLink: string
  breadcrumbs?: BreadcrumbItem[]
  columns: StatementColumn[]
  employees: EmployeeStatement[]
  isLoading: boolean
  // Period range
  fromPeriod: string
  toPeriod: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  periodOptions: { value: string; label: string }[]
  periodsLoading?: boolean
  // Filters
  search: string
  onSearchChange: (value: string) => void
  departmentFilter?: string
  onDepartmentChange?: (value: string) => void
  departments?: string[]
  // Extra header content
  headerRight?: React.ReactNode
}

export default function ContributionStatementLayout({
  title,
  backLink,
  breadcrumbs,
  columns,
  employees,
  isLoading,
  fromPeriod,
  toPeriod,
  onFromChange,
  onToChange,
  periodOptions,
  periodsLoading,
  search,
  onSearchChange,
  departmentFilter,
  onDepartmentChange,
  departments = [],
  headerRight,
}: ContributionStatementLayoutProps) {
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set())

  const toggleEmployee = (empNo: string) => {
    setExpandedEmployees((prev) => {
      const next = new Set(prev)
      if (next.has(empNo)) next.delete(empNo)
      else next.add(empNo)
      return next
    })
  }

  const expandAll = () => {
    setExpandedEmployees(new Set(filtered.map((e) => e.employee_number)))
  }

  const collapseAll = () => {
    setExpandedEmployees(new Set())
  }

  // Filter employees
  const filtered = employees.filter((emp) => {
    const matchesSearch =
      !search ||
      emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_number.toLowerCase().includes(search.toLowerCase())
    const matchesDept =
      !departmentFilter || emp.department === departmentFilter
    return matchesSearch && matchesDept
  })

  const formatValue = (col: StatementColumn, value: any) => {
    if (value == null) return '-'
    if (col.format === 'currency') return formatCurrency(Number(value))
    if (col.format === 'number') return formatNumber(Number(value))
    return String(value)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={
          fromPeriod && toPeriod
            ? 'Showing data for selected period range'
            : 'Select a period range to generate the report'
        }
        breadcrumbs={breadcrumbs || [
          { label: 'Reports', href: backLink },
          { label: title },
        ]}
        actions={headerRight}
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <PeriodRangeSelector
              fromPeriod={fromPeriod}
              toPeriod={toPeriod}
              onFromChange={onFromChange}
              onToChange={onToChange}
              periodOptions={periodOptions}
              isLoading={periodsLoading}
            />
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by name or ID..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
              />
            </div>
            {onDepartmentChange && (
              <div className="w-56">
                <Select
                  label="Department"
                  value={departmentFilter || ''}
                  onChange={(e) => onDepartmentChange(e.target.value)}
                  options={[
                    { value: '', label: 'All Departments' },
                    ...departments.map((d) => ({ value: d, label: d })),
                  ]}
                />
              </div>
            )}
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
            <Button size="sm" variant="outline" onClick={expandAll}>
              Expand All
            </Button>
            <Button size="sm" variant="outline" onClick={collapseAll}>
              Collapse All
            </Button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              type={!fromPeriod || !toPeriod ? 'data' : 'search'}
              title={!fromPeriod || !toPeriod ? 'Select a period range' : 'No records found'}
              description={
                !fromPeriod || !toPeriod
                  ? 'Please select a period range to view the report.'
                  : 'No records found matching your criteria.'
              }
              compact
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((emp) => {
            const isExpanded = expandedEmployees.has(emp.employee_number)
            return (
              <Card key={emp.employee_number}>
                {/* Employee Header */}
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
                      <p className="text-sm text-gray-500">
                        {emp.department}
                        {emp.ssf_number && ` | SSF#: ${emp.ssf_number}`}
                        {emp.tin && ` | TIN: ${emp.tin}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Grand Total</p>
                    <p className="font-bold text-gray-900">
                      {columns.length > 0 && formatValue(
                        columns[columns.length - 1],
                        emp.grand_total[columns[columns.length - 1].key]
                      )}
                    </p>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <CardContent className="border-t p-0">
                    {/* Employee info row */}
                    <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 flex gap-6">
                      {emp.dob && <span>DOB: {emp.dob}</span>}
                      {emp.hire_date && <span>Hire Date: {emp.hire_date}</span>}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Period
                            </th>
                            {columns.map((col) => (
                              <th
                                key={col.key}
                                className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"
                              >
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {(() => {
                            // Group periods by year
                            const years = [...new Set(emp.periods.map((p) => p.year))].sort()
                            return years.map((year) => {
                              const yearPeriods = emp.periods.filter((p) => p.year === year)
                              const yearSub = emp.yearly_subtotals[String(year)]
                              return (
                                <YearSection
                                  key={year}
                                  year={year}
                                  periods={yearPeriods}
                                  yearSubtotal={yearSub}
                                  columns={columns}
                                  formatValue={formatValue}
                                />
                              )
                            })
                          })()}
                          {/* Grand Total Row */}
                          <tr className="bg-gray-200 font-bold">
                            <td className="px-4 py-2 text-sm text-gray-900">GRAND TOTAL</td>
                            {columns.map((col) => (
                              <td
                                key={col.key}
                                className="px-4 py-2 text-sm text-right text-gray-900"
                              >
                                {formatValue(col, emp.grand_total[col.key])}
                              </td>
                            ))}
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

function YearSection({
  year,
  periods,
  yearSubtotal,
  columns,
  formatValue,
}: {
  year: number
  periods: PeriodData[]
  yearSubtotal?: Record<string, number>
  columns: StatementColumn[]
  formatValue: (col: StatementColumn, value: any) => string
}) {
  return (
    <>
      {periods.map((period) => (
        <tr key={period.period_name} className="hover:bg-gray-50">
          <td className="px-4 py-2 text-sm text-gray-700">{period.period_name}</td>
          {columns.map((col) => (
            <td key={col.key} className="px-4 py-2 text-sm text-right text-gray-700">
              {formatValue(col, period[col.key])}
            </td>
          ))}
        </tr>
      ))}
      {yearSubtotal && (
        <tr className="bg-yellow-50 font-semibold">
          <td className="px-4 py-2 text-sm text-yellow-800">{year} Subtotal</td>
          {columns.map((col) => (
            <td key={col.key} className="px-4 py-2 text-sm text-right text-yellow-800">
              {formatValue(col, yearSubtotal[col.key])}
            </td>
          ))}
        </tr>
      )}
    </>
  )
}
