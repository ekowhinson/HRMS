import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  MagnifyingGlassIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import { reportsService } from '@/services/reports'
import type { ExportFormat } from '@/services/reports'
import { Card, CardContent } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { StatsCard } from '@/components/ui/StatsCard'
import { UsersIcon } from '@heroicons/react/24/outline'
import ExportMenu from '@/components/ui/ExportMenu'
import { TablePagination } from '@/components/ui/Table'
import { useClientPagination } from '@/hooks/useClientPagination'

interface EmployeeRecord {
  employee_number: string
  first_name: string
  last_name: string
  email: string
  phone_primary: string
  date_of_joining: string
  employment_type: string
  department_name: string
  grade_name: string
  position_name: string
}

export default function EmployeeDirectoryReportPage() {
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [exporting, setExporting] = useState(false)

  const handleExport = async (format: ExportFormat) => {
    setExporting(true)
    try {
      await reportsService.exportEmployeeMaster({ employee_code: search }, format)
    } finally {
      setExporting(false)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['hr-report-employee-directory'],
    queryFn: () => reportsService.getEmployeeMaster(),
  })

  const employees: EmployeeRecord[] = data?.data || []
  const totalCount: number = data?.total_count || 0

  // Extract unique departments and employment types for filters
  const departments = [...new Set(employees.map((e) => e.department_name).filter(Boolean))].sort()
  const employmentTypes = [...new Set(employees.map((e) => e.employment_type).filter(Boolean))].sort()

  // Filter
  const filtered = employees.filter((emp) => {
    const matchesSearch =
      !search ||
      `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_number.toLowerCase().includes(search.toLowerCase()) ||
      (emp.email && emp.email.toLowerCase().includes(search.toLowerCase()))
    const matchesDept = !deptFilter || emp.department_name === deptFilter
    const matchesType = !typeFilter || emp.employment_type === typeFilter
    return matchesSearch && matchesDept && matchesType
  })

  const { paged, currentPage, totalPages, totalItems, pageSize, setCurrentPage, setPageSize, resetPage } = useClientPagination(filtered, 50)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/hr-reports" className="p-2 rounded-md hover:bg-gray-100 transition-colors">
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employee Directory Report</h1>
            <p className="mt-1 text-sm text-gray-500">
              Complete employee directory with search and filtering
            </p>
          </div>
        </div>
        <ExportMenu onExport={handleExport} loading={exporting} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Total Employees"
          value={totalCount.toLocaleString()}
          variant="primary"
          icon={<UsersIcon className="h-5 w-5" />}
        />
        <StatsCard
          title="Departments"
          value={departments.length}
          variant="info"
        />
        <StatsCard
          title="Showing"
          value={totalItems.toLocaleString()}
          variant="default"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by name, ID, or email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); resetPage() }}
                leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
              />
            </div>
            <div className="w-56">
              <Select
                label="Department"
                value={deptFilter}
                onChange={(e) => { setDeptFilter(e.target.value); resetPage() }}
                options={[
                  { value: '', label: 'All Departments' },
                  ...departments.map((d) => ({ value: d, label: d })),
                ]}
              />
            </div>
            <div className="w-48">
              <Select
                label="Employment Type"
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); resetPage() }}
                options={[
                  { value: '', label: 'All Types' },
                  ...employmentTypes.map((t) => ({ value: t, label: t })),
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paged.map((emp) => (
                  <tr key={emp.employee_number} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{emp.employee_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{emp.first_name} {emp.last_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp.email || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp.phone_primary || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp.department_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp.position_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp.grade_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp.employment_type || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp.date_of_joining || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalItems > 0 && (
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[25, 50, 100, 200]}
            />
          )}
          {totalItems === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No employees match your filters.
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
