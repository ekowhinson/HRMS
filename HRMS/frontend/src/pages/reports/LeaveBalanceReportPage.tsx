import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { reportsService } from '@/services/reports'
import { Card, CardContent } from '@/components/ui/Card'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import { StatsCard } from '@/components/ui/StatsCard'
import { BarChartCard } from '@/components/charts/BarChartCard'
import { chartColors } from '@/lib/design-tokens'

interface LeaveBalanceEntry {
  employee__employee_number: string
  employee__first_name: string
  employee__last_name: string
  leave_type_name: string
  opening_balance: number
  earned: number
  taken: number
  pending: number
  carried_forward: number
}

interface LeaveSummary {
  leave_type_name: string
  total_entitled: number
  total_taken: number
  total_pending: number
}

export default function LeaveBalanceReportPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(String(currentYear))
  const [search, setSearch] = useState('')

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = currentYear - i
    return { value: String(y), label: String(y) }
  })

  const { data, isLoading } = useQuery({
    queryKey: ['hr-report-leave-balance', year],
    queryFn: () => reportsService.getLeaveBalance({ year }),
  })

  const balances: LeaveBalanceEntry[] = data?.balances || []
  const summary: LeaveSummary[] = data?.summary || []

  const filtered = balances.filter((b) => {
    if (!search) return true
    const term = search.toLowerCase()
    const fullName = `${b.employee__first_name || ''} ${b.employee__last_name || ''}`.toLowerCase()
    return (
      fullName.includes(term) ||
      b.employee__employee_number?.toLowerCase().includes(term) ||
      b.leave_type_name?.toLowerCase().includes(term)
    )
  })

  const summaryChartData = summary.map((s) => ({
    name: s.leave_type_name,
    value: s.total_taken,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/hr-reports" className="p-2 rounded-md hover:bg-gray-100 transition-colors">
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leave Balance Report</h1>
            <p className="mt-1 text-sm text-gray-500">
              Employee leave balances and entitlements for the year
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
            <StatsCard title="Leave Types" value={summary.length} variant="info" />
            <StatsCard
              title="Total Taken"
              value={summary.reduce((s, r) => s + r.total_taken, 0).toLocaleString()}
              variant="warning"
            />
            <StatsCard
              title="Total Pending"
              value={summary.reduce((s, r) => s + r.total_pending, 0).toLocaleString()}
              variant="success"
            />
          </div>

          {/* Summary by type chart */}
          {summaryChartData.length > 0 && (
            <BarChartCard
              title="Leave Taken by Type"
              subtitle={`Year ${year}`}
              data={summaryChartData}
              colors={chartColors.palette as unknown as string[]}
              height={250}
            />
          )}

          {/* Summary table */}
          <Card>
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-900">Summary by Leave Type</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leave Type</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Entitled</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Taken</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {summary.map((s) => (
                      <tr key={s.leave_type_name} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{s.leave_type_name}</td>
                        <td className="px-4 py-3 text-sm text-right">{s.total_entitled.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right text-orange-600 font-medium">{s.total_taken.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">{s.total_pending.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Employee balances */}
          <Card>
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
                <h3 className="text-base font-semibold text-gray-900">Employee Balances</h3>
                <div className="w-64">
                  <Input
                    placeholder="Search employees..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leave Type</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Opening</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Earned</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Taken</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filtered.slice(0, 100).map((b, idx) => (
                      <tr key={`${b.employee__employee_number}-${b.leave_type_name}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{b.employee__employee_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{`${b.employee__first_name || ''} ${b.employee__last_name || ''}`.trim()}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{b.leave_type_name}</td>
                        <td className="px-4 py-3 text-sm text-right">{b.opening_balance}</td>
                        <td className="px-4 py-3 text-sm text-right">{b.earned}</td>
                        <td className="px-4 py-3 text-sm text-right text-orange-600">{b.taken}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-green-600">{b.pending}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length > 100 && (
                <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 border-t">
                  Showing first 100 of {filtered.length.toLocaleString()} records. Use search to narrow down.
                </div>
              )}
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  No leave balance records found.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
