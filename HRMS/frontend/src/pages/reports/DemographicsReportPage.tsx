import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { reportsService } from '@/services/reports'
import { Card, CardContent } from '@/components/ui/Card'
import { StatsCard } from '@/components/ui/StatsCard'
import { PieChartCard } from '@/components/charts/PieChartCard'
import { BarChartCard } from '@/components/charts/BarChartCard'
import { UsersIcon } from '@heroicons/react/24/outline'
import { chartColors } from '@/lib/design-tokens'

export default function DemographicsReportPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['hr-report-demographics'],
    queryFn: () => reportsService.getDemographics(),
  })

  const totalEmployees: number = data?.total_employees || 0
  const byGender: { gender: string; count: number }[] = data?.by_gender || []
  const byMarital: { marital_status: string; count: number }[] = data?.by_marital_status || []
  const byNationality: { nationality: string; count: number }[] = data?.by_nationality || []

  const genderData = byGender.map((g) => ({
    name: g.gender || 'Not Specified',
    value: g.count,
  }))

  const maritalData = byMarital.map((m) => ({
    name: m.marital_status || 'Not Specified',
    value: m.count,
  }))

  const nationalityData = byNationality
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
    .map((n) => ({
      name: n.nationality || 'Not Specified',
      value: n.count,
    }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/hr-reports" className="p-2 rounded-md hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demographics Report</h1>
          <p className="mt-1 text-sm text-gray-500">
            Workforce demographics by gender, marital status, and nationality
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
              title="Total Employees"
              value={totalEmployees.toLocaleString()}
              variant="primary"
              icon={<UsersIcon className="h-5 w-5" />}
            />
            <StatsCard title="Gender Groups" value={byGender.length} variant="info" />
            <StatsCard title="Marital Statuses" value={byMarital.length} variant="warning" />
            <StatsCard title="Nationalities" value={byNationality.length} variant="default" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PieChartCard
              title="By Gender"
              data={genderData}
              donut
              centerLabel={{ value: totalEmployees, label: 'Total' }}
              colors={['#3b82f6', '#ec4899', '#8b5cf6', '#6b7280']}
            />
            <PieChartCard
              title="By Marital Status"
              data={maritalData}
              donut
            />
          </div>

          {nationalityData.length > 0 && (
            <BarChartCard
              title="By Nationality"
              subtitle={`Top ${nationalityData.length} nationalities`}
              data={nationalityData}
              layout="horizontal"
              height={Math.max(250, nationalityData.length * 30)}
              colors={chartColors.palette as unknown as string[]}
            />
          )}

          {/* Summary table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-0">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900">Gender Breakdown</h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gender</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {byGender.map((g) => (
                      <tr key={g.gender} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{g.gender || 'Not Specified'}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">{g.count.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-500">
                          {totalEmployees > 0 ? ((g.count / totalEmployees) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-0">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900">Marital Status Breakdown</h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {byMarital.map((m) => (
                      <tr key={m.marital_status} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{m.marital_status || 'Not Specified'}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">{m.count.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-500">
                          {totalEmployees > 0 ? ((m.count / totalEmployees) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
