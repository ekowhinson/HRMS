import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { reportsService } from '@/services/reports'
import { Card, CardContent } from '@/components/ui/Card'
import { StatsCard } from '@/components/ui/StatsCard'
import { BarChartCard } from '@/components/charts/BarChartCard'
import { PieChartCard } from '@/components/charts/PieChartCard'
import { UsersIcon } from '@heroicons/react/24/outline'
import { chartColors } from '@/lib/design-tokens'

export default function HeadcountReportPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['hr-report-headcount'],
    queryFn: () => reportsService.getHeadcount(),
  })

  const totalHeadcount: number = data?.total_headcount || 0
  const byDepartment: { department_name: string; count: number }[] = data?.by_department || []
  const byGrade: { grade_name: string; grade_level: number; count: number }[] = data?.by_grade || []
  const byType: { employment_type: string; count: number }[] = data?.by_employment_type || []
  const byLocation: { location_name: string; count: number }[] = data?.by_location || []

  const sortedDepts = [...byDepartment].sort((a, b) => b.count - a.count)

  // Top 10 departments — horizontal bar (ranked categorical)
  const deptChartData = sortedDepts
    .slice(0, 10)
    .map((d) => ({ name: d.department_name || 'Unknown', value: d.count }))

  // Grades sorted by level — vertical bar (ordered distribution)
  const gradeChartData = [...byGrade]
    .sort((a, b) => (a.grade_level ?? 0) - (b.grade_level ?? 0))
    .map((d) => ({ name: d.grade_name || 'Unknown', value: d.count }))

  // Location — donut (proportional part-of-whole, top 8 + "Other")
  const sortedLocations = [...byLocation].sort((a, b) => b.count - a.count)
  const topLocations = sortedLocations.slice(0, 8)
  const otherLocationCount = sortedLocations.slice(8).reduce((sum, l) => sum + l.count, 0)
  const locationPieData = [
    ...topLocations.map((d) => ({ name: d.location_name || 'Unknown', value: d.count })),
    ...(otherLocationCount > 0 ? [{ name: 'Other', value: otherLocationCount }] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/hr-reports" className="p-2 rounded-md hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Headcount Report</h1>
          <p className="mt-1 text-sm text-gray-500">
            Workforce headcount breakdown by department, grade, type, and location
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatsCard
              title="Total Headcount"
              value={totalHeadcount.toLocaleString()}
              variant="primary"
              icon={<UsersIcon className="h-5 w-5" />}
            />
            <StatsCard title="Departments" value={byDepartment.length} variant="info" />
            <StatsCard title="Grades" value={byGrade.length} variant="warning" />
            <StatsCard title="Locations" value={byLocation.length} variant="default" />
          </div>

          {/* Row 1: Department bar (primary breakdown) — full width */}
          <BarChartCard
            title="Headcount by Department"
            subtitle={`Top ${deptChartData.length} of ${byDepartment.length} departments`}
            data={deptChartData}
            layout="horizontal"
            height={Math.max(300, deptChartData.length * 36)}
            color={chartColors.primary}
          />

          {/* Row 2: Grade distribution (vertical bar) + Location split (donut) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BarChartCard
              title="Headcount by Grade"
              subtitle="Distribution across job grades"
              data={gradeChartData}
              height={300}
              color={chartColors.secondary}
            />
            <PieChartCard
              title="Headcount by Location"
              subtitle={`${byLocation.length} locations`}
              data={locationPieData}
              donut
              centerLabel={{ value: totalHeadcount.toLocaleString(), label: 'Total' }}
              colors={[...chartColors.palette]}
              height={300}
            />
          </div>

          {/* Row 3: Employment type — simple card with bars (often just 1-3 types) */}
          <Card>
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-900">Employment Type</h3>
              </div>
              <div className="px-6 py-4 space-y-3">
                {byType.map((t) => {
                  const pct = totalHeadcount > 0 ? (t.count / totalHeadcount) * 100 : 0
                  return (
                    <div key={t.employment_type}>
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
                  <p className="text-sm text-gray-500">No employment type data available.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Department detail table with inline proportion bars */}
          <Card>
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-900">Department Breakdown</h3>
                <p className="text-sm text-gray-500 mt-0.5">All {byDepartment.length} departments</p>
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
                    {sortedDepts.map((dept, idx) => {
                      const pct = totalHeadcount > 0 ? (dept.count / totalHeadcount) * 100 : 0
                      return (
                        <tr key={dept.department_name} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{dept.department_name || 'Unknown'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{dept.count.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 text-right">{pct.toFixed(1)}%</td>
                          <td className="px-4 py-3">
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
