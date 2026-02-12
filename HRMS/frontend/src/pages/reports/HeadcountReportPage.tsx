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
  const byGrade: { grade_name: string; count: number }[] = data?.by_grade || []
  const byType: { employment_type: string; count: number }[] = data?.by_employment_type || []
  const byLocation: { location_name: string; count: number }[] = data?.by_location || []

  const deptChartData = [...byDepartment]
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
    .map((d) => ({ name: d.department_name || 'Unknown', value: d.count }))

  const gradeChartData = [...byGrade]
    .sort((a, b) => b.count - a.count)
    .map((d) => ({ name: d.grade_name || 'Unknown', value: d.count }))

  const typeChartData = byType.map((d) => ({ name: d.employment_type || 'Unknown', value: d.count }))
  const locationChartData = [...byLocation]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((d) => ({ name: d.location_name || 'Unknown', value: d.count }))

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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BarChartCard
              title="By Department"
              subtitle={`Top ${deptChartData.length} departments`}
              data={deptChartData}
              layout="horizontal"
              height={Math.max(250, deptChartData.length * 30)}
              color={chartColors.primary}
            />
            <PieChartCard
              title="By Employment Type"
              data={typeChartData}
              donut
              centerLabel={{ value: totalHeadcount, label: 'Total' }}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BarChartCard
              title="By Grade"
              data={gradeChartData}
              layout="horizontal"
              height={Math.max(250, gradeChartData.length * 30)}
              colors={chartColors.palette as unknown as string[]}
            />
            {locationChartData.length > 0 && (
              <BarChartCard
                title="By Location"
                subtitle={`Top ${locationChartData.length} locations`}
                data={locationChartData}
                layout="horizontal"
                height={Math.max(250, locationChartData.length * 30)}
                color={chartColors.secondary}
              />
            )}
          </div>

          {/* Department detail table */}
          <Card>
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-900">Department Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {[...byDepartment]
                      .sort((a, b) => b.count - a.count)
                      .map((dept) => (
                        <tr key={dept.department_name} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{dept.department_name || 'Unknown'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{dept.count.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 text-right">
                            {totalHeadcount > 0 ? ((dept.count / totalHeadcount) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      ))}
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
