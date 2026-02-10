import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { employeeService } from '@/services/employees';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/Badge';
import Table, { TablePagination } from '@/components/ui/Table';
import Avatar from '@/components/ui/Avatar';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import type { Employee } from '@/types';

interface EmployeesPageProps {
  readOnly?: boolean
  basePath?: string
}

export default function EmployeesPage({ readOnly = false, basePath = '/employees' }: EmployeesPageProps) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    department: '',
    employment_status: '',
    grade: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['employees', page, search, filters],
    queryFn: () =>
      employeeService.getAll({
        page,
        search,
        ...filters,
      }),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => employeeService.getDepartments(),
  });

  const { data: grades } = useQuery({
    queryKey: ['grades'],
    queryFn: employeeService.getGrades,
  });

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (employee: Employee) => (
        <div className="flex items-center gap-3">
          <Avatar
            firstName={employee.first_name}
            lastName={employee.last_name}
            src={employee.photo}
            size="sm"
          />
          <div>
            <Link
              to={`${basePath}/${employee.id}`}
              className="text-sm font-medium text-gray-900 hover:text-primary-600 transition-colors"
            >
              {employee.first_name} {employee.last_name}
            </Link>
            <p className="text-xs text-gray-500">
              {(employee as any).employee_number || employee.employee_id}
            </p>
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
        <span className="text-sm text-gray-700">{employee.grade_name || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (employee: Employee) => {
        const status =
          (employee as any).status || employee.employment_status || 'UNKNOWN';
        return <StatusBadge status={status} category="employment" dot />;
      },
    },
    {
      key: 'hire_date',
      header: 'Hire Date',
      render: (employee: Employee) => {
        const hireDate = (employee as any).date_of_joining || employee.date_of_hire;
        return (
          <span className="text-sm text-gray-700">
            {hireDate ? new Date(hireDate).toLocaleDateString() : '-'}
          </span>
        );
      },
    },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      department: '',
      employment_status: '',
      grade: '',
    });
    setSearch('');
    setPage(1);
  };

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
  ];

  const totalItems = data?.count || 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <PageHeader
        title={readOnly ? "Employee Directory" : "Employees"}
        subtitle={readOnly ? "View employee records for payroll processing" : "Manage employee records and information"}
        breadcrumbs={[{ label: readOnly ? 'Employee Directory' : 'Employees' }]}
        actions={
          <div className="flex gap-3">
            <Button variant="outline" size="sm" leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}>
              Export
            </Button>
            {!readOnly && (
              <Link to="/employees/new">
                <Button size="sm" leftIcon={<PlusIcon className="w-4 h-4" />}>
                  Add Employee
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Search and Filters Card */}
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
              className={showFilters ? 'bg-primary-50 border-primary-200' : ''}
              leftIcon={<FunnelIcon className="w-4 h-4" />}
            >
              Filters
              {(filters.department || filters.employment_status || filters.grade) && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                  {[filters.department, filters.employment_status, filters.grade].filter(Boolean)
                    .length}
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
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

      {/* Employees Table */}
      <Card>
        {isError ? (
          <EmptyState
            type="error"
            title="Failed to load employees"
            description={
              (error as any)?.message ||
              'Unable to connect to the server. Please make sure the backend is running.'
            }
            action={{
              label: 'Try Again',
              onClick: () => refetch(),
            }}
          />
        ) : isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} columns={6} showHeader />
          </div>
        ) : data?.results?.length === 0 ? (
          <EmptyState
            type="employees"
            title="No employees found"
            description={
              search || filters.department || filters.employment_status || filters.grade
                ? 'Try adjusting your search or filter criteria.'
                : 'Add your first employee to get started.'
            }
            action={
              search || filters.department || filters.employment_status || filters.grade
                ? { label: 'Clear Filters', onClick: clearFilters }
                : readOnly
                  ? undefined
                  : { label: 'Add Employee', onClick: () => (window.location.href = '/employees/new') }
            }
          />
        ) : (
          <>
            <Table
              data={data?.results || []}
              columns={columns}
              isLoading={false}
              emptyType="employees"
              striped
            />
            {totalPages > 1 && (
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
