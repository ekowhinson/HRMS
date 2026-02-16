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
  Select,
  PageHeader,
  EmptyState,
  TablePagination,
  SkeletonStatsCard,
  SkeletonTable,
} from '@/components/ui'
import { UsersIcon } from '@heroicons/react/24/outline'
import ExportMenu from '@/components/ui/ExportMenu'
import { useClientPagination } from '@/hooks/useClientPagination'
import { useGroupBy } from '@/hooks/useGroupBy'
import GroupableTable from '@/components/reports/GroupableTable'

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

const GROUP_BY_OPTIONS = [
  { value: '', label: 'No Grouping' },
  { value: 'department_name', label: 'Department' },
  { value: 'grade_name', label: 'Grade' },
  { value: 'employment_type', label: 'Employment Type' },
]

export default function EmployeeDirectoryReportPage() {
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [groupByField, setGroupByField] = useState('')
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

  const isGrouped = !!groupByField
  const { groups, grandTotals } = useGroupBy(filtered, groupByField || null, [])

  // When grouped, show all items (no pagination). When not grouped, paginate.
  const { paged, currentPage, totalPages, totalItems, pageSize, setCurrentPage, setPageSize, resetPage } = useClientPagination(filtered, 50)

  const groupByLabel = GROUP_BY_OPTIONS.find((o) => o.value === groupByField)?.label || ''

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Directory Report"
        subtitle="Complete employee directory with search and filtering"
        breadcrumbs={[
          { label: 'HR Reports', href: '/hr-reports' },
          { label: 'Employee Directory Report' },
        ]}
        actions={<ExportMenu onExport={handleExport} loading={exporting} />}
      />

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonStatsCard key={i} />
            ))}
          </div>
          <SkeletonTable rows={5} columns={9} />
        </div>
      ) : (
        <>
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
              value={(isGrouped ? filtered.length : totalItems).toLocaleString()}
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
                <div className="w-48">
                  <Select
                    label="Group By"
                    value={groupByField}
                    onChange={(e) => { setGroupByField(e.target.value); resetPage() }}
                    options={GROUP_BY_OPTIONS}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            {isGrouped ? (
              <GroupableTable<EmployeeRecord>
                groups={groups}
                isGrouped={true}
                groupByLabel={groupByLabel}
                totalColumns={9}
                labelColumns={9}
                grandTotals={grandTotals}
                renderHeaderRow={() => (
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
                )}
                renderRow={(emp) => (
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
                )}
                renderTotalCells={() => null}
                emptyMessage="No employees match your filters."
              />
            ) : (
              <>
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
              </>
            )}
            {!isGrouped && totalItems === 0 && (
              <EmptyState
                type="search"
                title="No employees match your filters"
                description="Try adjusting your search or filter criteria."
                compact
              />
            )}
          </Card>
        </>
      )}
    </div>
  )
}
