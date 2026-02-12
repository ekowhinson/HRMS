import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { employeeService } from '@/services/employees'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
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
      <div className="flex items-center gap-4">
        <Link to="/hr-reports" className="p-2 rounded-md hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employment History Report</h1>
          <p className="mt-1 text-sm text-gray-500">
            View position, department, and grade changes for an employee
          </p>
        </div>
      </div>

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
              <button
                className="text-xs text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setSelectedEmployee(null)
                  setSearch('')
                }}
              >
                Clear
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Table */}
      {selectedEmployee && (
        loadingHistory ? (
          <Card>
            <CardContent className="p-8">
              <div className="flex justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
              </div>
            </CardContent>
          </Card>
        ) : history.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-gray-500">
              No employment history records found for this employee.
            </CardContent>
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
          <CardContent className="p-8 text-center text-sm text-gray-500">
            Search and select an employee above to view their employment history.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
