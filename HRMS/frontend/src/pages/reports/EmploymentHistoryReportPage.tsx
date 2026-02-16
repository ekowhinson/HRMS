import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { employeeService } from '@/services/employees'
import { reportsService } from '@/services/reports'
import type { ExportFormat } from '@/services/reports'
import api from '@/lib/api'
import {
  Card,
  CardContent,
  Input,
  Button,
  PageHeader,
  EmptyState,
  SkeletonTable,
} from '@/components/ui'
import ExportMenu from '@/components/ui/ExportMenu'
import type { Employee } from '@/types'

interface HistoryRecord {
  id: string
  change_type: string
  effective_date: string
  previous_department: string
  new_department: string
  previous_position: string
  new_position: string
  previous_grade: string
  new_grade: string
  reason: string
}

export default function EmploymentHistoryReportPage() {
  const [search, setSearch] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [exporting, setExporting] = useState(false)

  const handleExport = async (format: ExportFormat) => {
    if (!selectedEmployee) return
    setExporting(true)
    try {
      await reportsService.exportEmploymentHistory(selectedEmployee.id, format)
    } finally {
      setExporting(false)
    }
  }

  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees-lookup', search],
    queryFn: () => employeeService.getEmployees({ search, page_size: 20 }),
    enabled: search.length >= 2,
  })

  const employees = employeesData?.results || []

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ['employee-history', selectedEmployee?.id],
    queryFn: () => api.get(`/employees/${selectedEmployee!.id}/history/`).then((r) => r.data),
    enabled: !!selectedEmployee,
  })

  const history: HistoryRecord[] = Array.isArray(historyData) ? historyData : historyData?.results || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employment History Report"
        subtitle="View position, department, and grade changes for an employee"
        breadcrumbs={[
          { label: 'HR Reports', href: '/hr-reports' },
          { label: 'Employment History Report' },
        ]}
        actions={<ExportMenu onExport={handleExport} loading={exporting} disabled={!selectedEmployee} />}
      />

      {/* Employee Search */}
      <Card>
        <CardContent className="p-4">
          <div className="max-w-md">
            <Input
              label="Search Employee"
              placeholder="Type name or employee number..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                if (e.target.value.length < 2) setSelectedEmployee(null)
              }}
              leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
            />
          </div>

          {/* Search results dropdown */}
          {search.length >= 2 && !selectedEmployee && (
            <div className="mt-2 max-w-md border border-gray-200 rounded-md bg-white shadow-sm max-h-60 overflow-y-auto">
              {loadingEmployees ? (
                <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
              ) : employees.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">No employees found</div>
              ) : (
                employees.map((emp) => (
                  <button
                    key={emp.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    onClick={() => {
                      setSelectedEmployee(emp)
                      setSearch(`${emp.first_name} ${emp.last_name} (${emp.employee_number})`)
                    }}
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {emp.first_name} {emp.last_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {emp.employee_number} &middot; {emp.department_name || 'No department'}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {selectedEmployee && (
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">
                {selectedEmployee.first_name} {selectedEmployee.last_name} ({selectedEmployee.employee_number})
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setSelectedEmployee(null)
                  setSearch('')
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Table */}
      {selectedEmployee && (
        loadingHistory ? (
          <div className="space-y-6">
            <SkeletonTable rows={5} columns={4} />
          </div>
        ) : history.length === 0 ? (
          <Card>
            <EmptyState
              type="data"
              title="No employment history"
              description="No employment history records found for this employee."
              compact
            />
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Change Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effective Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Previous Dept</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Dept</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Previous Position</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Position</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Previous Grade</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Grade</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.map((record, idx) => (
                    <tr key={record.id || idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {record.change_type || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{record.effective_date || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{record.previous_department || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{record.new_department || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{record.previous_position || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{record.new_position || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{record.previous_grade || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{record.new_grade || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{record.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {!selectedEmployee && (
        <Card>
          <EmptyState
            type="search"
            title="Select an employee"
            description="Search and select an employee above to view their employment history."
            compact
          />
        </Card>
      )}
    </div>
  )
}
