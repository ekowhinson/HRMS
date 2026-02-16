import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsService } from '@/services/reports'
import {
  Card,
  CardContent,
  Select,
  StatsCard,
  PageHeader,
  EmptyState,
  SkeletonTable,
  SkeletonStatsCard,
} from '@/components/ui'
import { usePeriodRange } from '@/hooks/usePeriodRange'
import { useExport } from '@/hooks/useExport'
import ExportMenu from '@/components/ui/ExportMenu'
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
      <PageHeader
        title="Labour Cost Report"
        subtitle={
          data?.from_period_name && data?.to_period_name
            ? `${data.from_period_name} to ${data.to_period_name}`
            : 'Breakdown of labour costs by department'
        }
        breadcrumbs={[
          { label: 'Reports', href: '/reports' },
          { label: 'Labour Cost Report' },
        ]}
        actions={<ExportMenu onExport={handleExport} loading={exporting} disabled={!fromPeriod || !toPeriod} />}
      />

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
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <SkeletonStatsCard />
          <SkeletonStatsCard />
          <SkeletonStatsCard />
        </div>
      ) : data && rows.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatsCard title="Total Basic" value={formatCurrency(grandTotals.basic_salary || 0)} variant="primary" />
          <StatsCard title="Total Labour Cost" value={formatCurrency(grandTotals.total || 0)} variant="success" />
          <StatsCard title="Overtime %" value={`${grandTotals.overtime_pct || 0}%`} variant="warning" />
        </div>
      ) : null}

      {/* Table */}
      {isLoading ? (
        <SkeletonTable rows={6} columns={9} />
      ) : sorted.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader label={groupByLabels[groupBy] || 'Group'} field="group_name" sortIcon={getSortIcon('group_name')} onSort={toggleSort} className="text-left" />
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
          <CardContent>
            <EmptyState
              type="data"
              title="No labour cost data"
              description="No labour cost data found for the selected period range."
              compact
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
