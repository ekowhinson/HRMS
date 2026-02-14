import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { reportsService } from '@/services/reports'
import { Card, CardContent } from '@/components/ui/Card'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import { StatsCard } from '@/components/ui/StatsCard'
import ExportMenu from '@/components/ui/ExportMenu'
import { usePeriodRange } from '@/hooks/usePeriodRange'
import { useExport } from '@/hooks/useExport'
import { useSortable } from '@/hooks/useSortable'
import PeriodRangeSelector from '@/components/reports/PeriodRangeSelector'
import { SortableHeader } from '@/components/reports/GroupableTable'
import { formatCurrency } from '@/lib/utils'

const groupByLabels: Record<string, string> = {
  department: 'Department',
  staff_category: 'Staff Category',
  division: 'Division',
  directorate: 'Directorate',
  region: 'Region',
  district: 'District',
}

interface SummaryRow {
  group_name: string
  employee_count: number
  total_earnings: number
  total_deductions: number
  total_net: number
  total_employer_cost: number
}

export default function ConsolidatedPayrollSummaryPage() {
  const { fromPeriod, setFromPeriod, toPeriod, setToPeriod, periodOptions, isLoading: periodsLoading } = usePeriodRange()
  const [groupBy, setGroupBy] = useState('department')
  const [search, setSearch] = useState('')

  const { exporting, handleExport } = useExport((format) =>
    reportsService.exportConsolidatedSummary(
      { from_period: fromPeriod, to_period: toPeriod, group_by: groupBy },
      format
    )
  )

  const { data, isLoading } = useQuery({
    queryKey: ['consolidated-summary', fromPeriod, toPeriod, groupBy],
    queryFn: () =>
      reportsService.getConsolidatedSummary({
        from_period: fromPeriod,
        to_period: toPeriod,
        group_by: groupBy,
      }),
    enabled: !!fromPeriod && !!toPeriod,
  })

  const rows: SummaryRow[] = data?.rows || []
  const grandTotals = data?.grand_totals || {}

  const filtered = rows.filter(
    (r) => !search || r.group_name.toLowerCase().includes(search.toLowerCase())
  )

  const { sorted, toggleSort, getSortIcon } = useSortable(filtered)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/reports" className="p-2 rounded-md hover:bg-gray-100 transition-colors">
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consolidated Payroll Summary</h1>
            <p className="mt-1 text-sm text-gray-500">
              {data?.from_period_name && data?.to_period_name
                ? `${data.from_period_name} to ${data.to_period_name}`
                : 'Select a period range to view consolidated payroll data'}
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
            <div className="w-48">
              <Select
                label="Group By"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                options={[
                  { value: 'department', label: 'Department' },
                  { value: 'staff_category', label: 'Staff Category' },
                  { value: 'division', label: 'Division' },
                  { value: 'directorate', label: 'Directorate' },
                  { value: 'region', label: 'Region' },
                  { value: 'district', label: 'District' },
                ]}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search groups..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {data && rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard title="Total Employees" value={grandTotals.employee_count || 0} variant="primary" />
          <StatsCard title="Total Earnings" value={formatCurrency(grandTotals.total_earnings || 0)} variant="success" />
          <StatsCard title="Total Deductions" value={formatCurrency(grandTotals.total_deductions || 0)} variant="warning" />
          <StatsCard title="Total Net Pay" value={formatCurrency(grandTotals.total_net || 0)} variant="info" />
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          </CardContent>
        </Card>
      ) : sorted.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader label={groupByLabels[groupBy] || 'Group'} field="group_name" sortIcon={getSortIcon('group_name')} onSort={toggleSort} className="text-left" />
                  <SortableHeader label="Employees" field="employee_count" sortIcon={getSortIcon('employee_count')} onSort={toggleSort} className="text-right" />
                  <SortableHeader label="Total Earnings" field="total_earnings" sortIcon={getSortIcon('total_earnings')} onSort={toggleSort} className="text-right" />
                  <SortableHeader label="Total Deductions" field="total_deductions" sortIcon={getSortIcon('total_deductions')} onSort={toggleSort} className="text-right" />
                  <SortableHeader label="Net Pay" field="total_net" sortIcon={getSortIcon('total_net')} onSort={toggleSort} className="text-right" />
                  <SortableHeader label="Employer Cost" field="total_employer_cost" sortIcon={getSortIcon('total_employer_cost')} onSort={toggleSort} className="text-right" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sorted.map((row) => (
                  <tr key={row.group_name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.group_name}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">{row.employee_count}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600">{formatCurrency(row.total_earnings)}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">{formatCurrency(row.total_deductions)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{formatCurrency(row.total_net)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCurrency(row.total_employer_cost)}</td>
                  </tr>
                ))}
                {/* Grand Total */}
                <tr className="bg-gray-200 font-bold">
                  <td className="px-4 py-3 text-sm text-gray-900">GRAND TOTAL</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{grandTotals.employee_count}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(grandTotals.total_earnings)}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(grandTotals.total_deductions)}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(grandTotals.total_net)}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(grandTotals.total_employer_cost)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      ) : fromPeriod && toPeriod ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-gray-500">
            No payroll data found for the selected period range.
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
