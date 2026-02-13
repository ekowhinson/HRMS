import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, ExclamationTriangleIcon, ClockIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { reportsService } from '@/services/reports'
import type { ExportFormat } from '@/services/reports'
import { Card, CardContent } from '@/components/ui/Card'
import { StatsCard } from '@/components/ui/StatsCard'
import { PieChartCard } from '@/components/charts/PieChartCard'
import { AreaChartCard } from '@/components/charts/AreaChartCard'
import { BarChartCard } from '@/components/charts/BarChartCard'
import { UsersIcon } from '@heroicons/react/24/outline'
import { chartColors } from '@/lib/design-tokens'
import ExportMenu from '@/components/ui/ExportMenu'

interface RetirementEmployee {
  employee_id: string
  first_name: string
  last_name: string
  age: number
  department: string
  position: string
  retirement_date: string
  years_to_60: number
}

export default function DemographicsReportPage() {
  const [exporting, setExporting] = useState(false)
  const [selectedOver60Age, setSelectedOver60Age] = useState<number | null>(null)
  const [selectedApproachingAge, setSelectedApproachingAge] = useState<number | null>(null)

  const handleExport = async (format: ExportFormat) => {
    setExporting(true)
    try {
      await reportsService.exportDemographics(undefined, format)
    } finally {
      setExporting(false)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['hr-report-demographics'],
    queryFn: () => reportsService.getDemographics(),
  })

  const totalEmployees: number = data?.total_employees || 0
  const byGender: { gender: string; count: number }[] = data?.by_gender || []
  const byMarital: { marital_status: string; count: number }[] = data?.by_marital_status || []
  const byAge: { bracket: string; count: number }[] = data?.by_age || []
  const averageAge: number = data?.average_age || 0
  const retirementOver60: RetirementEmployee[] = data?.retirement_over_60 || []
  const retirementApproaching: RetirementEmployee[] = data?.retirement_approaching || []
  const retirementOver60Count: number = data?.retirement_over_60_count || 0
  const retirementApproachingCount: number = data?.retirement_approaching_count || 0

  // Bin retirement employees by age for bar charts
  const binByAge = (employees: RetirementEmployee[]) => {
    const counts: Record<number, number> = {}
    employees.forEach((emp) => {
      counts[emp.age] = (counts[emp.age] || 0) + 1
    })
    return Object.entries(counts)
      .map(([age, count]) => ({ name: `${age}`, value: count, age: Number(age) }))
      .sort((a, b) => a.age - b.age)
  }

  const over60ByAge = binByAge(retirementOver60)
  const approachingByAge = binByAge(retirementApproaching)

  const genderData = byGender.map((g) => ({
    name: g.gender || 'Not Specified',
    value: g.count,
  }))

  const maritalData = byMarital.map((m) => ({
    name: m.marital_status || 'Not Specified',
    value: m.count,
  }))

  const ageChartData = byAge.map((a) => ({
    name: a.bracket,
    value: a.count,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/hr-reports" className="p-2 rounded-md hover:bg-gray-100 transition-colors">
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Demographics Report</h1>
            <p className="mt-1 text-sm text-gray-500">
              Workforce demographics by gender, marital status, and age distribution
            </p>
          </div>
        </div>
        <ExportMenu onExport={handleExport} loading={exporting} />
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatsCard
              title="Total Employees"
              value={totalEmployees.toLocaleString()}
              variant="primary"
              icon={<UsersIcon className="h-5 w-5" />}
            />
            <StatsCard title="Gender Groups" value={byGender.length} variant="info" />
            <StatsCard title="Marital Statuses" value={byMarital.length} variant="warning" />
            <StatsCard title="Average Age" value={averageAge ? averageAge : 'N/A'} variant="default" />
            <StatsCard
              title="Past Retirement (60+)"
              value={retirementOver60Count}
              variant="danger"
              icon={<ExclamationTriangleIcon className="h-5 w-5" />}
            />
            <StatsCard
              title="Approaching Retirement"
              value={retirementApproachingCount}
              variant="warning"
              icon={<ClockIcon className="h-5 w-5" />}
            />
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

          {ageChartData.length > 0 && (
            <AreaChartCard
              title="Age Distribution"
              subtitle={`Average age: ${averageAge}`}
              data={ageChartData}
              color={chartColors.primary}
              gradient
              height={300}
              tooltipLabel="Employees"
            />
          )}

          {/* Retirement Planning - Two side-by-side charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BarChartCard
              title="Past Retirement Age (60+)"
              subtitle={`${retirementOver60Count} employees — click a bar to view details`}
              data={over60ByAge}
              color="#ef4444"
              height={220}
              barSize={28}
              radius={4}
              onBarClick={(entry) => {
                const age = Number(entry.name)
                setSelectedOver60Age(selectedOver60Age === age ? null : age)
              }}
            />
            <BarChartCard
              title="Approaching Retirement (55-59)"
              subtitle={`${retirementApproachingCount} employees — click a bar to view details`}
              data={approachingByAge}
              color="#f59e0b"
              height={220}
              barSize={28}
              radius={4}
              onBarClick={(entry) => {
                const age = Number(entry.name)
                setSelectedApproachingAge(selectedApproachingAge === age ? null : age)
              }}
            />
          </div>

          {/* Past Retirement detail table */}
          {selectedOver60Age !== null && (
            <Card>
              <CardContent className="p-0">
                <div className="px-6 py-4 border-b border-gray-200 border-l-4 border-l-red-500 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      Employees Aged {selectedOver60Age}
                    </h3>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {retirementOver60.filter((e) => e.age === selectedOver60Age).length} employees past retirement age
                    </p>
                  </div>
                  <button onClick={() => setSelectedOver60Age(null)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
                    <XMarkIcon className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Age</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retirement Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {retirementOver60.filter((e) => e.age === selectedOver60Age).map((emp) => (
                        <tr key={emp.employee_id} className="hover:bg-red-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{emp.employee_id}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{emp.first_name} {emp.last_name}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-red-600">{emp.age}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{emp.department || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{emp.position || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{new Date(emp.retirement_date).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approaching Retirement detail table */}
          {selectedApproachingAge !== null && (
            <Card>
              <CardContent className="p-0">
                <div className="px-6 py-4 border-b border-gray-200 border-l-4 border-l-amber-500 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      Employees Aged {selectedApproachingAge}
                    </h3>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {retirementApproaching.filter((e) => e.age === selectedApproachingAge).length} employees approaching retirement
                    </p>
                  </div>
                  <button onClick={() => setSelectedApproachingAge(null)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
                    <XMarkIcon className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Age</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retirement Date</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Years to 60</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {retirementApproaching.filter((e) => e.age === selectedApproachingAge).map((emp) => (
                        <tr key={emp.employee_id} className="hover:bg-amber-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{emp.employee_id}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{emp.first_name} {emp.last_name}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-amber-600">{emp.age}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{emp.department || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{emp.position || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{new Date(emp.retirement_date).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                              {emp.years_to_60} {emp.years_to_60 === 1 ? 'year' : 'years'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
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
                    {byGender.map((g) => {
                      const pct = totalEmployees > 0 ? ((g.count / totalEmployees) * 100).toFixed(1) : '0'
                      return (
                        <tr key={g.gender} className="hover:bg-gray-50" title={`${g.gender || 'Not Specified'}: ${g.count.toLocaleString()} employees (${pct}%)`}>
                          <td className="px-4 py-3 text-sm text-gray-900">{g.gender || 'Not Specified'}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium">{g.count.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500">{pct}%</td>
                        </tr>
                      )
                    })}
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
                    {byMarital.map((m) => {
                      const pct = totalEmployees > 0 ? ((m.count / totalEmployees) * 100).toFixed(1) : '0'
                      return (
                        <tr key={m.marital_status} className="hover:bg-gray-50" title={`${m.marital_status || 'Not Specified'}: ${m.count.toLocaleString()} employees (${pct}%)`}>
                          <td className="px-4 py-3 text-sm text-gray-900">{m.marital_status || 'Not Specified'}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium">{m.count.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500">{pct}%</td>
                        </tr>
                      )
                    })}
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
