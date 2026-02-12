import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { reportsService } from '@/services/reports'
import type { ExportFormat } from '@/services/reports'
import { Card, CardContent } from '@/components/ui/Card'
import Select from '@/components/ui/Select'
import { StatsCard } from '@/components/ui/StatsCard'
import { LineChartCard } from '@/components/charts/LineChartCard'
import { BarChartCard } from '@/components/charts/BarChartCard'
import { PieChartCard } from '@/components/charts/PieChartCard'
import { chartColors } from '@/lib/design-tokens'
import ExportMenu from '@/components/ui/ExportMenu'

export default function TurnoverReportPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(String(currentYear))
  const [exporting, setExporting] = useState(false)

  const handleExport = async (format: ExportFormat) => {
    setExporting(true)
    try {
      await reportsService.exportTurnover({ year }, format)
    } finally {
      setExporting(false)
    }
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = currentYear - i
    return { value: String(y), label: String(y) }
  })

  const { data, isLoading } = useQuery({
    queryKey: ['hr-report-turnover', year],
    queryFn: () => reportsService.getTurnover({ year }),
  })

  const totalExits: number = data?.total_exits || 0
  const newHires: number = data?.new_hires || 0
  const turnoverRate: number = data?.turnover_rate || 0
  const exitsByMonth: { month: string; count: number }[] = data?.exits_by_month || []
  const exitsByReason: { exit_reason: string; count: number }[] = data?.exits_by_reason || []
  const exitsByDepartment: { department_name: string; count: number }[] = data?.exits_by_department || []

  const monthlyData = exitsByMonth.map((m) => ({
    name: m.month,
    exits: m.count,
  }))

  const reasonData = exitsByReason.map((r) => ({
    name: r.exit_reason || 'Unknown',
    value: r.count,
  }))

  const deptData = exitsByDepartment
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
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
            <h1 className="text-2xl font-bold text-gray-900">Turnover Report</h1>
            <p className="mt-1 text-sm text-gray-500">
              Staff turnover analysis including exits, new hires, and trends
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32">
            <Select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              options={yearOptions}
            />
          </div>
          <ExportMenu onExport={handleExport} loading={exporting} />
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
              title="Total Exits"
              value={totalExits.toLocaleString()}
              variant="danger"
            />
            <StatsCard
              title="New Hires"
              value={newHires.toLocaleString()}
              variant="success"
            />
            <StatsCard
              title="Turnover Rate"
              value={`${turnoverRate.toFixed(1)}%`}
              variant="warning"
            />
          </div>

          {monthlyData.length > 0 && (
            <LineChartCard
              title="Exits by Month"
              subtitle={`Monthly exit trends for ${year}`}
              data={monthlyData}
              lines={[
                { dataKey: 'exits', name: 'Exits', color: chartColors.palette[4] },
              ]}
              height={300}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {reasonData.length > 0 && (
              <PieChartCard
                title="Exits by Reason"
                data={reasonData}
                donut
                centerLabel={{ value: totalExits, label: 'Exits' }}
              />
            )}
            {deptData.length > 0 && (
              <BarChartCard
                title="Exits by Department"
                subtitle="Top 10 departments"
                data={deptData}
                layout="horizontal"
                height={Math.max(250, deptData.length * 30)}
                color={chartColors.palette[4]}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
