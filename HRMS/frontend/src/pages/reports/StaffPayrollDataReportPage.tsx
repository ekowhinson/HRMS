import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  DocumentArrowDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { reportsService, ExportFormat } from '@/services/reports'
import { payrollService } from '@/services/payroll'
import { payrollSetupService } from '@/services/payrollSetup'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils'
import { useGroupBy } from '@/hooks/useGroupBy'
import type { PayrollRun } from '@/types'

interface StaffPayrollEmployee {
  no: number
  staff_number: string
  full_name: string
  hire_date: string
  location: string
  position: string
  grade: string
  grade_step: string
  basic_salary: number
  transport_allowance: number
  utility_allowance: number
  fuel_allowance: number
  vehicle_allowance: number
  acting_allowance: number
}

interface StaffPayrollDataResponse {
  summary: {
    total_employees: number
    total_basic: number
    total_transport: number
    total_utility: number
    total_fuel: number
    total_vehicle: number
    total_acting: number
  }
  employees: StaffPayrollEmployee[]
}

const STAFF_NUMERIC_KEYS = [
  'basic_salary', 'transport_allowance', 'utility_allowance',
  'fuel_allowance', 'vehicle_allowance', 'acting_allowance',
]

const GROUP_BY_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'location', label: 'Location' },
  { value: 'grade', label: 'Grade' },
  { value: 'position', label: 'Position' },
]

const GROUP_BY_LABELS: Record<string, string> = {
  location: 'Location',
  grade: 'Grade',
  position: 'Position',
}

const TOTAL_COLUMNS = 14

export default function StaffPayrollDataReportPage() {
  const [selectedRun, setSelectedRun] = useState('')
  const [selectedStaffCategory, setSelectedStaffCategory] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedGrade, setSelectedGrade] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel')
  const [groupByField, setGroupByField] = useState('')

  // Fetch payroll runs
  const { data: runs } = useQuery({
    queryKey: ['payroll-runs-for-staff-data'],
    queryFn: () => payrollService.getRuns(),
  })

  // Fetch staff categories
  const { data: staffCategories } = useQuery({
    queryKey: ['staff-categories'],
    queryFn: payrollSetupService.getStaffCategories,
  })

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const response = await fetch('/api/v1/organization/locations/')
      return response.json()
    },
  })

  // Fetch grades
  const { data: grades } = useQuery({
    queryKey: ['grades'],
    queryFn: async () => {
      const response = await fetch('/api/v1/organization/grades/')
      return response.json()
    },
  })

  // Fetch report data
  const { data: reportData, isLoading } = useQuery({
    queryKey: ['staff-payroll-data-report', selectedRun, selectedStaffCategory, selectedLocation, selectedGrade],
    queryFn: () =>
      reportsService.getStaffPayrollData({
        payroll_run: selectedRun || undefined,
        staff_category: selectedStaffCategory || undefined,
        location: selectedLocation || undefined,
        grade: selectedGrade || undefined,
      }),
    enabled: true,
  })

  const data = reportData as StaffPayrollDataResponse | undefined

  // Filter employees by search term
  const filteredEmployees = useMemo(() =>
    data?.employees.filter(
      (emp) =>
        emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.staff_number.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [],
    [data?.employees, searchTerm]
  )

  // Group data
  const { groups, grandTotals } = useGroupBy<StaffPayrollEmployee>(
    filteredEmployees,
    groupByField || null,
    STAFF_NUMERIC_KEYS
  )

  const isGrouped = !!groupByField

  // Get computed/approved/paid runs for dropdown
  const availableRuns =
    runs?.filter((r: PayrollRun) =>
      ['COMPUTED', 'APPROVED', 'PAID'].includes(r.status.toUpperCase())
    ) || []

  const handleExport = async () => {
    try {
      await reportsService.exportStaffPayrollData(
        selectedRun || undefined,
        exportFormat,
        {
          staff_category: selectedStaffCategory || undefined,
          location: selectedLocation || undefined,
          grade: selectedGrade || undefined,
        }
      )
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // Helper to parse locations/grades from possible paginated response
  const locationsList = Array.isArray(locations?.results)
    ? locations.results
    : Array.isArray(locations)
      ? locations
      : []

  const gradesList = Array.isArray(grades?.results)
    ? grades.results
    : Array.isArray(grades)
      ? grades
      : []

  const renderTotalCells = (totals: Record<string, number>) => (
    <>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.basic_salary)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.transport_allowance)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.utility_allowance)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.fuel_allowance)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.vehicle_allowance)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.acting_allowance)}</td>
    </>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Payroll Data</h1>
          <p className="mt-1 text-sm text-gray-500">
            Employee payroll details including allowances and hire information
          </p>
        </div>
        <div className="relative">
          <div className="flex items-center gap-2">
            <Select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              options={[
                { value: 'excel', label: 'Excel' },
                { value: 'csv', label: 'CSV' },
                { value: 'pdf', label: 'PDF' },
              ]}
              className="w-24"
            />
            <Button variant="outline" onClick={handleExport} disabled={!data}>
              <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-64">
              <Select
                label="Payroll Run"
                value={selectedRun}
                onChange={(e) => setSelectedRun(e.target.value)}
                options={[
                  { value: '', label: 'Latest Run' },
                  ...availableRuns.map((r: PayrollRun) => ({
                    value: r.id,
                    label: `${r.period_name || r.run_number} (${r.status})`,
                  })),
                ]}
              />
            </div>
            <div className="w-64">
              <Select
                label="Staff Category"
                value={selectedStaffCategory}
                onChange={(e) => setSelectedStaffCategory(e.target.value)}
                options={[
                  { value: '', label: 'All Staff Categories' },
                  ...(staffCategories?.map((c) => ({
                    value: c.id,
                    label: c.name,
                  })) || []),
                ]}
              />
            </div>
            <div className="w-64">
              <Select
                label="Location"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                options={[
                  { value: '', label: 'All Locations' },
                  ...locationsList.map((l: any) => ({
                    value: l.id,
                    label: l.name,
                  })),
                ]}
              />
            </div>
            <div className="w-64">
              <Select
                label="Grade"
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                options={[
                  { value: '', label: 'All Grades' },
                  ...gradesList.map((g: any) => ({
                    value: g.id,
                    label: g.name || g.code,
                  })),
                ]}
              />
            </div>
            <div className="w-48">
              <Select
                label="Group By"
                value={groupByField}
                onChange={(e) => setGroupByField(e.target.value)}
                options={GROUP_BY_OPTIONS}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by name or staff number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs text-blue-600 font-medium">Total Employees</p>
            <p className="text-2xl font-bold text-blue-700">{data.summary.total_employees}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-100">
            <p className="text-xs text-green-600 font-medium">Total Basic</p>
            <p className="text-lg font-bold text-green-700">
              {formatCurrency(data.summary.total_basic)}
            </p>
          </div>
          <div className="p-4 bg-teal-50 rounded-lg border border-teal-100">
            <p className="text-xs text-teal-600 font-medium">Total Transport</p>
            <p className="text-lg font-bold text-teal-700">
              {formatCurrency(data.summary.total_transport)}
            </p>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
            <p className="text-xs text-amber-600 font-medium">Total Utility</p>
            <p className="text-lg font-bold text-amber-700">
              {formatCurrency(data.summary.total_utility)}
            </p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
            <p className="text-xs text-orange-600 font-medium">Total Fuel</p>
            <p className="text-lg font-bold text-orange-700">
              {formatCurrency(data.summary.total_fuel)}
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
            <p className="text-xs text-purple-600 font-medium">Total Vehicle</p>
            <p className="text-lg font-bold text-purple-700">
              {formatCurrency(data.summary.total_vehicle)}
            </p>
          </div>
          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
            <p className="text-xs text-indigo-600 font-medium">Total Acting</p>
            <p className="text-lg font-bold text-indigo-700">
              {formatCurrency(data.summary.total_acting)}
            </p>
          </div>
        </div>
      )}

      {/* Data Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          </CardContent>
        </Card>
      ) : filteredEmployees.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FunnelIcon className="h-5 w-5 mr-2 text-gray-500" />
              Staff Payroll Details ({filteredEmployees.length} employees)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-2 py-3 text-left font-medium whitespace-nowrap">No</th>
                    <th className="px-2 py-3 text-left font-medium whitespace-nowrap">Staff Number</th>
                    <th className="px-2 py-3 text-left font-medium whitespace-nowrap">Full Name</th>
                    <th className="px-2 py-3 text-left font-medium whitespace-nowrap">Hire Date</th>
                    <th className="px-2 py-3 text-left font-medium whitespace-nowrap">Location</th>
                    <th className="px-2 py-3 text-left font-medium whitespace-nowrap">Position</th>
                    <th className="px-2 py-3 text-left font-medium whitespace-nowrap">Grade</th>
                    <th className="px-2 py-3 text-left font-medium whitespace-nowrap">Grade Step</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Basic Salary</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Transport Allow.</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Utility Allow.</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Fuel Allow.</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Vehicle Allow.</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Acting Allow.</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <>
                      {isGrouped && (
                        <tr key={`header-${group.label}`} className="bg-blue-100 text-blue-900">
                          <td colSpan={TOTAL_COLUMNS} className="px-2 py-2 font-semibold">
                            {GROUP_BY_LABELS[groupByField] || groupByField}: {group.label} ({group.items.length} employee{group.items.length !== 1 ? 's' : ''})
                          </td>
                        </tr>
                      )}
                      {group.items.map((emp, index) => (
                        <tr
                          key={emp.staff_number}
                          className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        >
                          <td className="px-2 py-2 whitespace-nowrap">{emp.no}</td>
                          <td className="px-2 py-2 whitespace-nowrap font-medium">{emp.staff_number}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{emp.full_name}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{emp.hire_date}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{emp.location}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{emp.position}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{emp.grade}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{emp.grade_step}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.basic_salary)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.transport_allowance)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.utility_allowance)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.fuel_allowance)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.vehicle_allowance)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.acting_allowance)}</td>
                        </tr>
                      ))}
                      {isGrouped && (
                        <tr key={`footer-${group.label}`} className="bg-blue-50 font-semibold text-gray-800 border-b-2 border-blue-200">
                          <td className="px-2 py-2" colSpan={8}>Sub-Total</td>
                          {renderTotalCells(group.totals)}
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-200 font-bold text-gray-900 border-t-2 border-gray-400">
                    <td className="px-2 py-3" colSpan={8}>
                      GRAND TOTAL
                    </td>
                    {renderTotalCells(grandTotals)}
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : data ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">No employees found matching your criteria.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
