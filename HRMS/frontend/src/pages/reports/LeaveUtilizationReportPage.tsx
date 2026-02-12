import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { reportsService } from '@/services/reports'
import { Card, CardContent } from '@/components/ui/Card'
import Select from '@/components/ui/Select'
import { StatsCard } from '@/components/ui/StatsCard'
import { LineChartCard } from '@/components/charts/LineChartCard'
import { BarChartCard } from '@/components/charts/BarChartCard'
import { PieChartCard } from '@/components/charts/PieChartCard'
import { chartColors } from '@/lib/design-tokens'

export default function LeaveUtilizationReportPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(String(currentYear))

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = currentYear - i
    return { value: String(y), label: String(y) }
  })

  const { data, isLoading } = useQuery({
    queryKey: ['hr-report-leave-utilization', year],
    queryFn: () => reportsService.getLeaveUtilization({ year }),
  })

  const byMonth: { month: string; count: number }[] = data?.by_month || []
  const byLeaveType: { leave_type_name: string; count: number; total_days: number }[] = data?.by_leave_type || []
  const byDepartment: { department_name: string; count: number; total_days: number }[] = data?.by_department || []

  const totalUtilized = byLeaveType.reduce((s, t) => s + t.count, 0)

  const monthlyData = byMonth.map((m) => ({
    name: m.month,
    days: m.count,
  }))

  const typeData = byLeaveType.map((t) => ({
    name: t.leave_type_name,
    value: t.count,
  }))

  const deptData = byDepartment
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
    .map((d) => ({
      name: d.department_name || 'Unknown',
      value: d.count,
    }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/hr-reports" className="p-2 rounded-md hover:bg-gray-100 transition-colors">
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leave Utilization Report</h1>
            <p className="mt-1 text-sm text-gray-500">
              Leave usage patterns by month, type, and department
            </p>
          </div>
        </div>
        <div className="w-32">
          <Select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            options={yearOptions}
          />
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              title="Total Days Utilized"
              value={totalUtilized.toLocaleString()}
              variant="primary"
            />
            <StatsCard
              title="Leave Types Used"
              value={byLeaveType.length}
              variant="info"
            />
            <StatsCard
              title="Departments"
              value={byDepartment.length}
              variant="default"
            />
          </div>

          {monthlyData.length > 0 && (
            <LineChartCard
              title="Utilization by Month"
              subtitle={`Monthly leave days taken in ${year}`}
              data={monthlyData}
              lines={[
                { dataKey: 'days', name: 'Days Taken', color: chartColors.primary },
              ]}
              height={300}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {typeData.length > 0 && (
              <PieChartCard
                title="By Leave Type"
                data={typeData}
                donut
                centerLabel={{ value: totalUtilized, label: 'Days' }}
              />
            )}
            {deptData.length > 0 && (
              <BarChartCard
                title="By Department"
                subtitle={`Top ${deptData.length} departments`}
                data={deptData}
                layout="horizontal"
                height={Math.max(250, deptData.length * 30)}
                colors={chartColors.palette as unknown as string[]}
              />
            )}
          </div>

          {/* Detail tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-0">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900">By Leave Type</h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Days</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {byLeaveType
                      .sort((a, b) => b.count - a.count)
                      .map((t) => (
                        <tr key={t.leave_type_name} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{t.leave_type_name}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium">{t.count.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500">
                            {totalUtilized > 0 ? ((t.count / totalUtilized) * 100).toFixed(1) : 0}%
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
                  <h3 className="text-base font-semibold text-gray-900">Monthly Trend</h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {byMonth.map((m) => (
                      <tr key={m.month} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{m.month}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">{m.count.toLocaleString()}</td>
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
