import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { employeeService } from '@/services/employees'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import Avatar from '@/components/ui/Avatar'
import type { Employee } from '@/types'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ACTIVE: 'success',
  PROBATION: 'warning',
  ON_LEAVE: 'info',
  SUSPENDED: 'danger',
  NOTICE: 'warning',
  TERMINATED: 'danger',
  RESIGNED: 'default',
  RETIRED: 'info',
  DECEASED: 'danger',
}

export default function EmployeesPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    department: '',
    employment_status: '',
    grade: '',
  })
  const [showFilters, setShowFilters] = useState(false)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['employees', page, search, filters],
    queryFn: () => employeeService.getAll({
      page,
      search,
      ...filters,
    }),
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: employeeService.getDepartments,
  })

  const { data: grades } = useQuery({
    queryKey: ['grades'],
    queryFn: employeeService.getGrades,
  })

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (employee: Employee) => (
        <div className="flex items-center">
          <Avatar
            firstName={employee.first_name}
            lastName={employee.last_name}
            src={employee.photo}
            size="sm"
          />
          <div className="ml-3">
            <Link
              to={`/employees/${employee.id}`}
              className="text-sm font-medium text-gray-900 hover:text-primary-600"
            >
              {employee.first_name} {employee.last_name}
            </Link>
            <p className="text-xs text-gray-500">{(employee as any).employee_number || employee.employee_id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (employee: Employee) => (
        <span className="text-sm text-gray-700">
          {employee.department_name || 'Unassigned'}
        </span>
      ),
    },
    {
      key: 'position',
      header: 'Position',
      render: (employee: Employee) => (
        <span className="text-sm text-gray-700">
          {(employee as any).position_title || employee.position_name || 'Not Set'}
        </span>
      ),
    },
    {
      key: 'grade',
      header: 'Grade',
      render: (employee: Employee) => (
        <span className="text-sm text-gray-700">
          {employee.grade_name || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (employee: Employee) => {
        const status = (employee as any).status || employee.employment_status || 'UNKNOWN'
        return (
          <Badge variant={statusColors[status] || 'default'}>
            {status.replace(/_/g, ' ')}
          </Badge>
        )
      },
    },
    {
      key: 'hire_date',
      header: 'Hire Date',
      render: (employee: Employee) => {
        const hireDate = (employee as any).date_of_joining || employee.date_of_hire
        return (
          <span className="text-sm text-gray-700">
            {hireDate ? new Date(hireDate).toLocaleDateString() : '-'}
          </span>
        )
      },
    },
  ]

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilters({
      department: '',
      employment_status: '',
      grade: '',
    })
    setSearch('')
    setPage(1)
  }

  const employmentStatusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'PROBATION', label: 'On Probation' },
    { value: 'ON_LEAVE', label: 'On Leave' },
    { value: 'SUSPENDED', label: 'Suspended' },
    { value: 'NOTICE', label: 'Notice Period' },
    { value: 'TERMINATED', label: 'Terminated' },
    { value: 'RESIGNED', label: 'Resigned' },
    { value: 'RETIRED', label: 'Retired' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage employee records and information
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm">
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Link to="/employees/new">
            <Button size="sm">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search by name, employee ID, or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </form>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-gray-100' : ''}
            >
              <FunnelIcon className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="Department"
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
                options={[
                  { value: '', label: 'All Departments' },
                  ...(departments?.map((d: { id: string; name: string }) => ({
                    value: d.id,
                    label: d.name,
                  })) || []),
                ]}
              />
              <Select
                label="Status"
                value={filters.employment_status}
                onChange={(e) => handleFilterChange('employment_status', e.target.value)}
                options={employmentStatusOptions}
              />
              <Select
                label="Grade"
                value={filters.grade}
                onChange={(e) => handleFilterChange('grade', e.target.value)}
                options={[
                  { value: '', label: 'All Grades' },
                  ...(grades?.map((g: { id: string; name: string }) => ({
                    value: g.id,
                    label: g.name,
                  })) || []),
                ]}
              />
              <div className="sm:col-span-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        {isError ? (
          <div className="flex flex-col items-center justify-center py-12">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load employees</h2>
            <p className="text-sm text-gray-500 mb-4">
              {(error as any)?.message || 'Unable to connect to the server. Please make sure the backend is running.'}
            </p>
            <Button onClick={() => refetch()}>Try Again</Button>
          </div>
        ) : (
          <Table
            data={data?.results || []}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No employees found"
          />
        )}
        {data && data.count > 0 && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data.count)} of{' '}
              {data.count} employees
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 20 >= data.count}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
