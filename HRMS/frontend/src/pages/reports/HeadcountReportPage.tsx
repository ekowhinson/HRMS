import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { reportsService } from '@/services/reports'
import type { ExportFormat } from '@/services/reports'
import {
  Card,
  CardContent,
  StatsCard,
  Input,
  PageHeader,
  EmptyState,
  SkeletonStatsCard,
  SkeletonTable,
} from '@/components/ui'
import { PieChartCard } from '@/components/charts/PieChartCard'
import { UsersIcon } from '@heroicons/react/24/outline'
import { chartColors } from '@/lib/design-tokens'
import ExportMenu from '@/components/ui/ExportMenu'

export default function HeadcountReportPage() {
  const [deptSearch, setDeptSearch] = useState('')
  const [exporting, setExporting] = useState(false)

  const handleExport = async (format: ExportFormat) => {
    setExporting(true)
    try {
      await reportsService.exportHeadcount(format)
    } finally {
      setExporting(false)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['hr-report-headcount'],
    queryFn: () => reportsService.getHeadcount(),
  })

  const totalHeadcount: number = data?.total_headcount || 0
  const byDivision: { division_name: string; count: number }[] = data?.by_division || []
  const byDirectorate: { directorate_name: string; count: number }[] = data?.by_directorate || []
  const byDepartment: { department_name: string; count: number }[] = data?.by_department || []
  const byGrade: { grade_name: string; grade_level: number; count: number }[] = data?.by_grade || []
  const byType: { employment_type: string; count: number }[] = data?.by_employment_type || []
  const byLocation: { location_name: string; count: number }[] = data?.by_location || []

  // Division — donut (few slices, perfect for part-of-whole)
  const divisionPieData = [...byDivision]
    .sort((a, b) => b.count - a.count)
    .map((d) => ({ name: d.division_name || 'Unassigned', value: d.count }))

  // Directorate — horizontal bar (ranked, moderate count)
  const sortedDirectorates = [...byDirectorate].sort((a, b) => b.count - a.count)
  const directorateChartData = sortedDirectorates.map((d) => ({
    name: d.directorate_name || 'Unassigned',
    value: d.count,
  }))

  // Department — searchable table (53 items, too many for chart)
  const sortedDepts = [...byDepartment].sort((a, b) => b.count - a.count)
  const filteredDepts = sortedDepts.filter((d) => {
    if (!deptSearch) return true
    return (d.department_name || '').toLowerCase().includes(deptSearch.toLowerCase())
  })

  // Grades sorted by level — vertical bar
  const gradeChartData = [...byGrade]
    .sort((a, b) => (a.grade_level ?? 0) - (b.grade_level ?? 0))
    .map((d) => ({ name: d.grade_name || 'Unknown', value: d.count }))

  // Location — donut (top 8 + "Other")
  const sortedLocations = [...byLocation].sort((a, b) => b.count - a.count)
  const topLocations = sortedLocations.slice(0, 8)
  const otherLocationCount = sortedLocations.slice(8).reduce((sum, l) => sum + l.count, 0)
  const locationPieData = [
    ...topLocations.map((d) => ({ name: d.location_name || 'Unknown', value: d.count })),
    ...(otherLocationCount > 0 ? [{ name: 'Other', value: otherLocationCount }] : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Headcount Report"
        subtitle="Workforce headcount breakdown by organizational structure, grade, type, and location"
        breadcrumbs={[
          { label: 'HR Reports', href: '/hr-reports' },
          { label: 'Headcount Report' },
        ]}
        actions={<ExportMenu onExport={handleExport} loading={exporting} />}
      />

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonStatsCard key={i} />
            ))}
          </div>
          <SkeletonTable rows={5} columns={5} />
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <StatsCard
              title="Total Headcount"
              value={totalHeadcount.toLocaleString()}
              variant="primary"
              icon={<UsersIcon className="h-5 w-5" />}
            />
            <StatsCard title="Divisions" value={byDivision.length} variant="info" />
            <StatsCard title="Directorates" value={byDirectorate.length} variant="info" />
            <StatsCard title="Departments" value={byDepartment.length} variant="warning" />
            <StatsCard title="Locations" value={byLocation.length} variant="default" />
          </div>

          {/* Organization hierarchy: Division (donut) + Directorate (donut) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PieChartCard
              title="Headcount by Division"
              subtitle={`${byDivision.length} divisions`}
              data={divisionPieData}
              donut
              centerLabel={{ value: totalHeadcount.toLocaleString(), label: 'Total' }}
              colors={[...chartColors.palette]}
              height={340}
            />
            <PieChartCard
              title="Headcount by Directorate"
              subtitle={`${byDirectorate.length} directorates`}
              data={directorateChartData}
              donut
              centerLabel={{ value: totalHeadcount.toLocaleString(), label: 'Total' }}
              colors={[...chartColors.palette]}
              height={340}
            />
          </div>

          {/* Grade distribution + Location split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PieChartCard
              title="Headcount by Grade"
              subtitle="Distribution across job grades"
              data={gradeChartData}
              donut
              centerLabel={{ value: totalHeadcount.toLocaleString(), label: 'Total' }}
              colors={[...chartColors.palette]}
              height={300}
            />
            <PieChartCard
              title="Headcount by Location"
              subtitle={`${byLocation.length} locations`}
              data={locationPieData}
              donut
              colors={[...chartColors.palette]}
              height={300}
            />
          </div>

          {/* Employment type — progress bars */}
          <Card>
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-900">Employment Type</h3>
              </div>
              <div className="px-6 py-4 space-y-3">
                {byType.map((t) => {
                  const pct = totalHeadcount > 0 ? (t.count / totalHeadcount) * 100 : 0
                  return (
                    <div key={t.employment_type} title={`${t.employment_type || 'Unknown'}: ${t.count.toLocaleString()} employees (${pct.toFixed(1)}% of total)`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{t.employment_type || 'Unknown'}</span>
                        <span className="text-sm text-gray-500">{t.count.toLocaleString()} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: chartColors.primary }}
                        />
                      </div>
                    </div>
                  )
                })}
                {byType.length === 0 && (
                  <EmptyState
                    type="data"
                    title="No employment type data"
                    description="No employment type data available."
                    compact
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Department detail table — searchable */}
          <Card>
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Department Breakdown</h3>
                  <p className="text-sm text-gray-500 mt-0.5">All {byDepartment.length} departments</p>
                </div>
                <div className="w-64">
                  <Input
                    placeholder="Search departments..."
                    value={deptSearch}
                    onChange={(e) => setDeptSearch(e.target.value)}
                    leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-24">Count</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-20">%</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-48">Proportion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredDepts.map((dept, idx) => {
                      const pct = totalHeadcount > 0 ? (dept.count / totalHeadcount) * 100 : 0
                      return (
                        <tr key={dept.department_name} className="hover:bg-gray-50" title={`${dept.department_name || 'Unknown'}: ${dept.count.toLocaleString()} employees (${pct.toFixed(1)}% of total headcount)`}>
                          <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{dept.department_name || 'Unknown'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{dept.count.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 text-right">{pct.toFixed(1)}%</td>
                          <td className="px-4 py-3">
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden" title={`${pct.toFixed(1)}% of headcount`}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: chartColors.primary,
                                  minWidth: pct > 0 ? '2px' : '0',
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {filteredDepts.length === 0 && (
                <EmptyState
                  type="search"
                  title="No departments match your search"
                  description="Try adjusting your search criteria."
                  compact
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
