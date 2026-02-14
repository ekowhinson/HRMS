import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { reportsService } from '@/services/reports'
import { Card, CardContent } from '@/components/ui/Card'
import Select from '@/components/ui/Select'
import { StatsCard } from '@/components/ui/StatsCard'
import { usePeriodRange } from '@/hooks/usePeriodRange'
import { useExport } from '@/hooks/useExport'
import ExportMenu from '@/components/ui/ExportMenu'
import { useSortable } from '@/hooks/useSortable'
import PeriodRangeSelector from '@/components/reports/PeriodRangeSelector'
import { SortableHeader } from '@/components/reports/GroupableTable'
import { formatCurrency } from '@/lib/utils'

interface LabourCostRow {
  group_name: string
  basic_salary: number
  company_ssf: number
  company_pf: number
  overtime: number
  other_allowances: number
  total: number
  overtime_pct: number
  allowances_pct: number
}

export default function LabourCostReportPage() {
  const { fromPeriod, setFromPeriod, toPeriod, setToPeriod, periodOptions, isLoading: periodsLoading } = usePeriodRange()
  const [groupBy, setGroupBy] = useState('department')

  const { exporting, handleExport } = useExport((format) =>
    reportsService.exportLabourCost(
      { from_period: fromPeriod, to_period: toPeriod, group_by: groupBy },
      format
    )
  )

  const { data, isLoading } = useQuery({
    queryKey: ['labour-cost', fromPeriod, toPeriod, groupBy],
    queryFn: () =>
      reportsService.getLabourCost({
        from_period: fromPeriod,
        to_period: toPeriod,
        group_by: groupBy,
      }),
    enabled: !!fromPeriod && !!toPeriod,
  })

  const rows: LabourCostRow[] = data?.rows || []
  const grandTotals = data?.grand_totals || {}

  const { sorted, toggleSort, getSortIcon } = useSortable(rows)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/reports" className="p-2 rounded-md hover:bg-gray-100 transition-colors">
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Labour Cost Report</h1>
            <p className="mt-1 text-sm text-gray-500">
              {data?.from_period_name && data?.to_period_name
                ? `${data.from_period_name} to ${data.to_period_name}`
                : 'Breakdown of labour costs by department'}
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
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {data && rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatsCard title="Total Basic" value={formatCurrency(grandTotals.basic_salary || 0)} variant="primary" />
          <StatsCard title="Total Labour Cost" value={formatCurrency(grandTotals.total || 0)} variant="success" />
          <StatsCard title="Overtime %" value={`${grandTotals.overtime_pct || 0}%`} variant="warning" />
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
                  <SortableHeader label={groupBy === 'department' ? 'Department' : 'Staff Category'} field="group_name" sortIcon={getSortIcon('group_name')} onSort={toggleSort} className="text-left" />
                  <SortableHeader label="(A) Basic" field="basic_salary" sortIcon={getSortIcon('basic_salary')} onSort={toggleSort} className="text-right" />
                  <SortableHeader label="(B) Co. SSF" field="company_ssf" sortIcon={getSortIcon('company_ssf')} onSort={toggleSort} className="text-right" />
                  <SortableHeader label="(C) Co. PF" field="company_pf" sortIcon={getSortIcon('company_pf')} onSort={toggleSort} className="text-right" />
                  <SortableHeader label="(D) Overtime" field="overtime" sortIcon={getSortIcon('overtime')} onSort={toggleSort} className="text-right" />
                  <SortableHeader label="(E) Other Allow." field="other_allowances" sortIcon={getSortIcon('other_allowances')} onSort={toggleSort} className="text-right" />
                  <SortableHeader label="Total" field="total" sortIcon={getSortIcon('total')} onSort={toggleSort} className="text-right" />
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">D/(A+B+C)%</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">E/(A+B+C)%</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sorted.map((row) => (
                  <tr key={row.group_name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.group_name}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.basic_salary)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.company_ssf)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.company_pf)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.overtime)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.other_allowances)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(row.total)}</td>
                    <td className="px-4 py-3 text-sm text-right text-blue-600">{row.overtime_pct}%</td>
                    <td className="px-4 py-3 text-sm text-right text-blue-600">{row.allowances_pct}%</td>
                  </tr>
                ))}
                {/* Grand Total */}
                <tr className="bg-gray-200 font-bold">
                  <td className="px-4 py-3 text-sm text-gray-900">GRAND TOTAL</td>
                  <td className="px-4 py-3 text-sm text-right">{formatCurrency(grandTotals.basic_salary)}</td>
                  <td className="px-4 py-3 text-sm text-right">{formatCurrency(grandTotals.company_ssf)}</td>
                  <td className="px-4 py-3 text-sm text-right">{formatCurrency(grandTotals.company_pf)}</td>
                  <td className="px-4 py-3 text-sm text-right">{formatCurrency(grandTotals.overtime)}</td>
                  <td className="px-4 py-3 text-sm text-right">{formatCurrency(grandTotals.other_allowances)}</td>
                  <td className="px-4 py-3 text-sm text-right">{formatCurrency(grandTotals.total)}</td>
                  <td className="px-4 py-3 text-sm text-right">{grandTotals.overtime_pct}%</td>
                  <td className="px-4 py-3 text-sm text-right">{grandTotals.allowances_pct}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      ) : fromPeriod && toPeriod ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-gray-500">
            No labour cost data found for the selected period range.
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
