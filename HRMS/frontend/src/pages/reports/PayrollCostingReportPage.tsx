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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Select,
  Input,
  PageHeader,
  EmptyState,
  SkeletonTable,
} from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { useGroupBy } from '@/hooks/useGroupBy'
import type { PayrollRun } from '@/types'

interface CostingEmployee {
  srn: number
  staff_id: string
  full_name: string
  department: string
  grade: string
  staff_category: string
  basic_salary: number
  total_allowances: number
  total_emoluments: number
  emp_ssf: number
  emp_pf: number
  employer_ssf: number
  employer_pf: number
  tax_relief: number
  net_taxable_pay: number
  paye_tax: number
  duties_and_tax: number
  tax_refund: number
  union_dues: number
  ext_car_loan: number
  int_car_loan: number
  student_loan: number
  rent: number
  sal_adv_surcharge: number
  net_salary: number
}

interface PayrollCostingData {
  summary: {
    total_employees: number
    total_basic: number
    total_emoluments: number
    total_paye: number
    total_net: number
  }
  employees: CostingEmployee[]
}

const COSTING_NUMERIC_KEYS = [
  'basic_salary', 'total_allowances', 'total_emoluments',
  'emp_ssf', 'emp_pf', 'employer_ssf', 'employer_pf',
  'tax_relief', 'net_taxable_pay', 'paye_tax',
  'duties_and_tax', 'tax_refund', 'union_dues',
  'ext_car_loan', 'int_car_loan', 'student_loan',
  'rent', 'sal_adv_surcharge', 'net_salary',
]

const GROUP_BY_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'department', label: 'Department' },
  { value: 'grade', label: 'Grade' },
  { value: 'staff_category', label: 'Staff Category' },
]

const GROUP_BY_LABELS: Record<string, string> = {
  department: 'Department',
  grade: 'Grade',
  staff_category: 'Staff Category',
}

const TOTAL_COLUMNS = 22

export default function PayrollCostingReportPage() {
  const [selectedRun, setSelectedRun] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedStaffCategory, setSelectedStaffCategory] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel')
  const [groupByField, setGroupByField] = useState('')

  // Fetch payroll runs
  const { data: runs } = useQuery({
    queryKey: ['payroll-runs-for-costing'],
    queryFn: () => payrollService.getRuns(),
  })

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await fetch('/api/v1/organization/departments/')
      return response.json()
    },
  })

  // Fetch staff categories
  const { data: staffCategories } = useQuery({
    queryKey: ['staff-categories'],
    queryFn: payrollSetupService.getStaffCategories,
  })

  // Fetch report data
  const { data: reportData, isLoading } = useQuery({
    queryKey: ['payroll-costing-report', selectedRun, selectedDepartment, selectedStaffCategory],
    queryFn: () =>
      reportsService.getPayrollCostingSummary({
        payroll_run: selectedRun || undefined,
        department: selectedDepartment || undefined,
        staff_category: selectedStaffCategory || undefined,
      }),
    enabled: true,
  })

  const data = reportData as PayrollCostingData | undefined

  // Filter employees by search term
  const filteredEmployees = useMemo(() =>
    data?.employees.filter(
      (emp) =>
        emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.staff_id.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [],
    [data?.employees, searchTerm]
  )

  // Group data
  const { groups, grandTotals } = useGroupBy<CostingEmployee>(
    filteredEmployees,
    groupByField || null,
    COSTING_NUMERIC_KEYS
  )

  const isGrouped = !!groupByField

  // Get computed/approved/paid runs for dropdown
  const availableRuns =
    runs?.filter((r: PayrollRun) =>
      ['COMPUTED', 'APPROVED', 'PAID'].includes(r.status.toUpperCase())
    ) || []

  const handleExport = async () => {
    try {
      await reportsService.exportPayrollCostingSummary(
        selectedRun || undefined,
        exportFormat,
        {
          department: selectedDepartment || undefined,
          staff_category: selectedStaffCategory || undefined,
        }
      )
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const renderTotalCells = (totals: Record<string, number>) => (
    <>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.basic_salary)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.total_allowances)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.total_emoluments)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.emp_ssf)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.emp_pf)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.employer_ssf)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.employer_pf)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.tax_relief)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.net_taxable_pay)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.paye_tax)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.duties_and_tax)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.tax_refund)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.union_dues)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.ext_car_loan)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.int_car_loan)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.student_loan)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.rent)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.sal_adv_surcharge)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap">{formatCurrency(totals.net_salary)}</td>
    </>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Costing Summary"
        subtitle="Comprehensive salary payment summary with all costing components"
        breadcrumbs={[
          { label: 'Reports', href: '/reports' },
          { label: 'Payroll Costing Summary' },
        ]}
        actions={
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
        }
      />

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
                label="Department"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                options={[
                  { value: '', label: 'All Departments' },
                  ...(
                    Array.isArray(departments?.results)
                      ? departments.results
                      : Array.isArray(departments)
                        ? departments
                        : []
                  ).map((d: any) => ({
                    value: d.id,
                    label: d.name,
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
                placeholder="Search by name or staff ID..."
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-blue-50 rounded-md border border-blue-100">
            <p className="text-xs text-blue-600 font-medium">Total Employees</p>
            <p className="text-2xl font-bold text-blue-700">{data.summary.total_employees}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-md border border-green-100">
            <p className="text-xs text-green-600 font-medium">Total Basic</p>
            <p className="text-lg font-bold text-green-700">
              {formatCurrency(data.summary.total_basic)}
            </p>
          </div>
          <div className="p-4 bg-teal-50 rounded-md border border-teal-100">
            <p className="text-xs text-teal-600 font-medium">Total Emoluments</p>
            <p className="text-lg font-bold text-teal-700">
              {formatCurrency(data.summary.total_emoluments)}
            </p>
          </div>
          <div className="p-4 bg-red-50 rounded-md border border-red-100">
            <p className="text-xs text-red-600 font-medium">Total PAYE</p>
            <p className="text-lg font-bold text-red-700">
              {formatCurrency(data.summary.total_paye)}
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-md border border-purple-100">
            <p className="text-xs text-purple-600 font-medium">Total Net</p>
            <p className="text-lg font-bold text-purple-700">
              {formatCurrency(data.summary.total_net)}
            </p>
          </div>
        </div>
      )}

      {/* Data Table */}
      {isLoading ? (
        <SkeletonTable rows={8} columns={10} />
      ) : filteredEmployees.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FunnelIcon className="h-5 w-5 mr-2 text-gray-500" />
              Payroll Costing Details ({filteredEmployees.length} employees)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-2 py-3 text-left font-medium whitespace-nowrap">SRN</th>
                    <th className="px-2 py-3 text-left font-medium whitespace-nowrap">Staff ID</th>
                    <th className="px-2 py-3 text-left font-medium whitespace-nowrap">Full Name</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Basic Salary</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Total Allowances</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Total Emoluments</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Emp SSF (5.5%)</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Emp PF (5%)</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Employer SSF (13%)</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Employer PF (5%)</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Tax Relief</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Net Taxable Pay</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">PAYE Tax</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Duties & Tax</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Tax Refund</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Union Dues</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Ext Car Loan</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Int Car Loan</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Student Loan</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Rent</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Sal Adv & Surcharge</th>
                    <th className="px-2 py-3 text-right font-medium whitespace-nowrap">Net Salary</th>
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
                          key={emp.staff_id}
                          className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        >
                          <td className="px-2 py-2 whitespace-nowrap">{emp.srn}</td>
                          <td className="px-2 py-2 whitespace-nowrap font-medium">{emp.staff_id}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{emp.full_name}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.basic_salary)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.total_allowances)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.total_emoluments)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.emp_ssf)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.emp_pf)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.employer_ssf)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.employer_pf)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.tax_relief)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.net_taxable_pay)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.paye_tax)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.duties_and_tax)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.tax_refund)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.union_dues)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.ext_car_loan)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.int_car_loan)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.student_loan)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.rent)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">{formatCurrency(emp.sal_adv_surcharge)}</td>
                          <td className="px-2 py-2 text-right whitespace-nowrap font-bold">{formatCurrency(emp.net_salary)}</td>
                        </tr>
                      ))}
                      {isGrouped && (
                        <tr key={`footer-${group.label}`} className="bg-blue-50 font-semibold text-gray-800 border-b-2 border-blue-200">
                          <td className="px-2 py-2" colSpan={3}>Sub-Total</td>
                          {renderTotalCells(group.totals)}
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-200 font-bold text-gray-900 border-t-2 border-gray-400">
                    <td className="px-2 py-3" colSpan={3}>
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
          <CardContent>
            <EmptyState
              type="search"
              title="No employees found"
              description="No employees found matching your criteria."
              compact
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
