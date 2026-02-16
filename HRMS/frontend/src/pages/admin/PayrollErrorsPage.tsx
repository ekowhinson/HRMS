import { useState, useMemo, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { payrollService } from '@/services/payroll'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import { TablePagination } from '@/components/ui/Table'
import { formatCurrency } from '@/lib/utils'
import type { PayrollItem } from '@/types'

export default function PayrollErrorsPage() {
  const { runId } = useParams<{ runId: string }>()
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'employee_number' | 'employee_name' | 'department_name' | 'basic_salary'>('employee_number')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const { data: run } = useQuery({
    queryKey: ['payroll-run', runId],
    queryFn: () => payrollService.getPayrollRun(runId!),
    enabled: !!runId,
  })

  const { data: errorItems, isLoading } = useQuery({
    queryKey: ['payroll-error-items', runId],
    queryFn: () => payrollService.getPayrollErrorItems(runId!),
    enabled: !!runId,
  })

  const filteredItems = useMemo(() => {
    if (!errorItems) return []
    let items = errorItems.filter((item: PayrollItem) => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        item.employee_name?.toLowerCase().includes(q) ||
        item.employee_number?.toLowerCase().includes(q) ||
        item.department_name?.toLowerCase().includes(q) ||
        item.error_message?.toLowerCase().includes(q)
      )
    })
    items.sort((a: PayrollItem, b: PayrollItem) => {
      const aVal = a[sortField] ?? ''
      const bVal = b[sortField] ?? ''
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
    return items
  }, [errorItems, search, sortField, sortDir])

  const totalItems = filteredItems.length
  const totalPages = Math.ceil(totalItems / pageSize)
  const paginatedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize)

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [search, sortField, sortDir])

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null
    return sortDir === 'asc' ? (
      <ChevronUpIcon className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDownIcon className="w-3 h-3 inline ml-1" />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/admin/payroll"
          className="p-2 rounded-md hover:bg-gray-100 transition-colors duration-150"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Payroll Error Investigation</h1>
          {run && (
            <p className="text-sm text-gray-500 mt-1">
              Run #{run.run_number} &middot; {run.period_name} &middot; {new Date(run.run_date).toLocaleDateString()}
            </p>
          )}
        </div>
        {errorItems && (
          <Badge variant="danger">
            {errorItems.length} error{errorItems.length !== 1 ? 's' : ''} out of {run?.total_employees || '?'} employees
          </Badge>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name, employee number, department, or error message..."
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Error Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employees with Errors</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {search ? 'No matching error records found.' : 'No payroll errors found for this run.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-8 px-4 py-3" />
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('employee_number')}
                    >
                      Emp # <SortIcon field="employee_number" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('employee_name')}
                    >
                      Name <SortIcon field="employee_name" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('department_name')}
                    >
                      Department <SortIcon field="department_name" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Position
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('basic_salary')}
                    >
                      Basic Salary <SortIcon field="basic_salary" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedItems.map((item: PayrollItem) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      isExpanded={expandedId === item.id}
                      onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalItems > 0 && (
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ItemRow({
  item,
  isExpanded,
  onToggle,
}: {
  item: PayrollItem
  isExpanded: boolean
  onToggle: () => void
}) {
  const earnings = item.details?.filter(d => d.component_type === 'EARNING') || []
  const deductions = item.details?.filter(d => d.component_type === 'DEDUCTION') || []
  const employerItems = item.details?.filter(d => d.component_type === 'EMPLOYER') || []

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          {isExpanded ? (
            <ChevronUpIcon className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          )}
        </td>
        <td className="px-4 py-3 text-sm font-mono text-gray-900">{item.employee_number}</td>
        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.employee_name}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{item.department_name || '-'}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{item.position_name || '-'}</td>
        <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
          {formatCurrency(item.basic_salary || 0)}
        </td>
        <td className="px-4 py-3 text-sm text-red-600 max-w-xs truncate" title={item.error_message || ''}>
          {item.error_message || 'Unknown error'}
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={7} className="px-4 py-0">
            <div className="bg-gray-50 rounded-md p-6 my-2 space-y-6">
              {/* Employee Info Card */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{item.employee_name}</h3>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-sm text-gray-500">
                    <span>#{item.employee_number}</span>
                    {item.department_name && <span>{item.department_name}</span>}
                    {item.position_name && <span>{item.position_name}</span>}
                    {item.grade_name && <span>Grade: {item.grade_name}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase">Basic Salary</p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(item.basic_salary || 0)}</p>
                </div>
              </div>

              {/* Error Banner */}
              <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Computation Error</p>
                  <p className="text-sm text-red-700 mt-1">{item.error_message || 'Unknown error'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payslip Breakdown */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Payslip Breakdown</h4>

                  {/* Earnings */}
                  {earnings.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase mb-2">Earnings</p>
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-100">
                          {earnings.map(d => (
                            <tr key={d.id}>
                              <td className="py-1.5 text-gray-700">{d.component_name}</td>
                              <td className="py-1.5 text-right font-mono text-gray-900">{formatCurrency(d.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Deductions */}
                  {deductions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase mb-2">Deductions</p>
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-100">
                          {deductions.map(d => (
                            <tr key={d.id}>
                              <td className="py-1.5 text-gray-700">{d.component_name}</td>
                              <td className="py-1.5 text-right font-mono text-red-600">-{formatCurrency(d.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Employer Contributions */}
                  {employerItems.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase mb-2">Employer Contributions</p>
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-100">
                          {employerItems.map(d => (
                            <tr key={d.id}>
                              <td className="py-1.5 text-gray-700">{d.component_name}</td>
                              <td className="py-1.5 text-right font-mono text-gray-900">{formatCurrency(d.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {earnings.length === 0 && deductions.length === 0 && employerItems.length === 0 && (
                    <p className="text-sm text-gray-400 italic">No component details available (error may have occurred before computation).</p>
                  )}

                  {/* Summary */}
                  {(item.gross_earnings > 0 || item.total_deductions > 0 || item.net_salary > 0) && (
                    <div className="border-t pt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Gross Earnings</span>
                        <span className="font-mono font-medium">{formatCurrency(item.gross_earnings || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Deductions</span>
                        <span className="font-mono font-medium text-red-600">-{formatCurrency(item.total_deductions || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold border-t pt-2">
                        <span className="text-gray-900">Net Salary</span>
                        <span className="font-mono text-green-700">{formatCurrency(item.net_salary || 0)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mini Payroll Journal */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Payroll Journal</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="py-2 text-gray-700">Basic Salary</td>
                        <td className="py-2 text-right font-mono">{formatCurrency(item.basic_salary || 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-gray-700">Taxable Income</td>
                        <td className="py-2 text-right font-mono">{formatCurrency(item.taxable_income || 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-gray-700">PAYE</td>
                        <td className="py-2 text-right font-mono text-red-600">{formatCurrency(item.paye || 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-gray-700">SSNIT (Employee)</td>
                        <td className="py-2 text-right font-mono text-red-600">{formatCurrency(item.ssnit_employee || 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-gray-700">SSNIT (Employer)</td>
                        <td className="py-2 text-right font-mono">{formatCurrency(item.ssnit_employer || 0)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-gray-700">Tier 2 (Employer)</td>
                        <td className="py-2 text-right font-mono">{formatCurrency(item.tier2_employer || 0)}</td>
                      </tr>
                      {(item.overtime_tax > 0 || item.bonus_tax > 0) && (
                        <>
                          {item.overtime_tax > 0 && (
                            <tr>
                              <td className="py-2 text-gray-700">Overtime Tax</td>
                              <td className="py-2 text-right font-mono text-red-600">{formatCurrency(item.overtime_tax)}</td>
                            </tr>
                          )}
                          {item.bonus_tax > 0 && (
                            <tr>
                              <td className="py-2 text-gray-700">Bonus Tax</td>
                              <td className="py-2 text-right font-mono text-red-600">{formatCurrency(item.bonus_tax)}</td>
                            </tr>
                          )}
                        </>
                      )}
                      <tr className="border-t-2 font-semibold">
                        <td className="py-2 text-gray-900">Total Employer Cost</td>
                        <td className="py-2 text-right font-mono">{formatCurrency(item.employer_cost || 0)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {item.days_worked > 0 && item.proration_factor < 1 && (
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
                      Prorated: {item.days_worked} days worked (factor: {item.proration_factor?.toFixed(4)})
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
