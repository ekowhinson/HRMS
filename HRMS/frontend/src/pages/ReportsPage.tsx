import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ChartBarIcon,
  DocumentArrowDownIcon,
  UsersIcon,
  BanknotesIcon,
  FunnelIcon,
  TableCellsIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  DocumentDuplicateIcon,
  BuildingLibraryIcon,
  ArrowsRightLeftIcon,
  CalculatorIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  ReceiptPercentIcon,
  GiftIcon,
} from '@heroicons/react/24/outline'
import { reportsService, ExportFormat } from '@/services/reports'
import { payrollService } from '@/services/payroll'
import { employeeService } from '@/services/employees'
import { payrollSetupService } from '@/services/payrollSetup'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'

interface ReportConfig {
  id: string
  name: string
  description: string
  icon: React.ForwardRefExoticComponent<any>
  filters?: string[]
  exportFn: (filters: Record<string, string>, format: ExportFormat) => Promise<void>
  // Optional: specific formats available (if not set, all formats are shown)
  availableFormats?: ExportFormat[]
  // Optional: single download button instead of format selection
  singleDownload?: boolean
  downloadLabel?: string
}

const reportConfigs: ReportConfig[] = [
  {
    id: 'payroll-summary',
    name: 'Payroll Summary',
    description: 'Summary of payroll by period with all employee details',
    icon: BanknotesIcon,
    filters: ['period', 'employee_code', 'division', 'directorate', 'department', 'position', 'grade', 'salary_band', 'salary_level', 'staff_category'],
    exportFn: (filters, format) => reportsService.exportPayrollSummary(filters.period, format, filters),
  },
  {
    id: 'payroll-master',
    name: 'Payroll Master Report',
    description: 'Detailed breakdown of earnings, deductions, and employer contributions per employee',
    icon: ClipboardDocumentListIcon,

    filters: ['period', 'employee_code', 'division', 'directorate', 'department', 'position', 'grade', 'salary_band', 'salary_level', 'staff_category'],
    exportFn: (filters, format) => reportsService.exportPayrollMaster({ payroll_run: filters.period, ...filters }, format),
  },
  {
    id: 'paye',
    name: 'PAYE Tax Report',
    description: 'Monthly income tax (PAYE) report for GRA submission',
    icon: BanknotesIcon,

    filters: ['period', 'employee_code', 'division', 'directorate', 'department', 'grade', 'staff_category'],
    exportFn: (filters, format) => reportsService.exportPAYEReport(filters.period, format, filters),
  },
  {
    id: 'paye-gra',
    name: 'PAYE GRA Schedule',
    description: 'Official GRA PAYE Monthly Tax Deductions Schedule format with all 28 columns',
    icon: BanknotesIcon,

    filters: ['period', 'employee_code', 'division', 'directorate', 'department', 'grade', 'staff_category'],
    exportFn: (filters, format) => reportsService.exportPAYEGRAReport(filters.period, format, filters),
  },
  {
    id: 'ssnit',
    name: 'SSNIT Contribution Report',
    description: 'Monthly SSNIT contributions for statutory submission',
    icon: BanknotesIcon,

    filters: ['period', 'employee_code', 'division', 'directorate', 'department', 'grade', 'staff_category'],
    exportFn: (filters, format) => reportsService.exportSSNITReport(filters.period, format, filters),
  },
  {
    id: 'bank-advice',
    name: 'Bank Advice Report',
    description: 'Bank transfer details for salary payments',
    icon: BanknotesIcon,

    filters: ['period', 'employee_code', 'division', 'directorate', 'department', 'bank'],
    exportFn: (filters, format) => reportsService.exportBankAdvice(filters.period, format, filters),
  },
  {
    id: 'payslips',
    name: 'Employee Payslips',
    description: 'Download payslips as ZIP file (PDF, Excel, or Text format)',
    icon: DocumentDuplicateIcon,

    filters: ['period', 'employee_code', 'division', 'directorate', 'department', 'position', 'grade', 'salary_band', 'salary_level', 'staff_category'],
    exportFn: (filters, format) => {
      if (!filters.period) {
        return Promise.reject(new Error('Please select a payroll period'))
      }
      return reportsService.downloadFilteredPayslips(filters.period, filters, format)
    },
  },
  {
    id: 'bank-file',
    name: 'Bank Payment File',
    description: 'Download bank payment file (CSV, Excel, or PDF format)',
    icon: BuildingLibraryIcon,

    filters: ['period', 'employee_code', 'division', 'directorate', 'department', 'position', 'grade', 'salary_band', 'salary_level', 'staff_category', 'bank'],
    exportFn: async (filters, format) => {
      if (!filters.period) {
        return Promise.reject(new Error('Please select a payroll period'))
      }
      return reportsService.downloadFilteredBankFile(filters.period, filters, format)
    },
  },
]

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportConfig | null>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState<ExportFormat | null>(null)

  // Organization hierarchy queries
  const { data: divisions } = useQuery({
    queryKey: ['divisions'],
    queryFn: employeeService.getDivisions,
  })

  const { data: directorates } = useQuery({
    queryKey: ['directorates', filters.division],
    queryFn: () => employeeService.getDirectorates(filters.division || undefined),
  })

  const { data: departments } = useQuery({
    queryKey: ['departments', filters.directorate],
    queryFn: () => employeeService.getDepartments(filters.directorate || undefined),
  })

  // Position and grade queries
  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: employeeService.getPositions,
  })

  const { data: grades } = useQuery({
    queryKey: ['grades'],
    queryFn: employeeService.getGrades,
  })

  // Payroll setup queries
  const { data: staffCategories } = useQuery({
    queryKey: ['staff-categories'],
    queryFn: payrollSetupService.getStaffCategories,
  })

  const { data: salaryBands } = useQuery({
    queryKey: ['salary-bands'],
    queryFn: payrollSetupService.getSalaryBands,
  })

  const { data: salaryLevels } = useQuery({
    queryKey: ['salary-levels', filters.salary_band],
    queryFn: () => payrollSetupService.getSalaryLevels(filters.salary_band || undefined),
  })

  const { data: banks } = useQuery({
    queryKey: ['banks'],
    queryFn: payrollSetupService.getBanks,
  })

  const { data: payrollRuns } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => payrollService.getRuns(),
  })

  const handleGenerateReport = async (format: ExportFormat) => {
    if (!selectedReport) return

    setIsGenerating(format)
    try {
      await selectedReport.exportFn(filters, format)
      toast.success(`Report downloaded successfully as ${format.toUpperCase()}!`)
    } catch (error: any) {
      console.error('Failed to generate report:', error)
      toast.error(error.message || error.response?.data?.error || 'Failed to generate report')
    } finally {
      setIsGenerating(null)
    }
  }

  // Clear dependent filters when parent changes
  const handleFilterChange = (filterName: string, value: string) => {
    const newFilters = { ...filters, [filterName]: value }

    // Clear dependent filters
    if (filterName === 'division') {
      newFilters.directorate = ''
      newFilters.department = ''
    } else if (filterName === 'directorate') {
      newFilters.department = ''
    } else if (filterName === 'salary_band') {
      newFilters.salary_level = ''
    }

    setFilters(newFilters)
  }

  const renderFilterInput = (filterName: string) => {
    switch (filterName) {
      case 'employee_code':
        return (
          <Input
            key={filterName}
            label="Employee Code"
            placeholder="Enter employee code..."
            value={filters.employee_code || ''}
            onChange={(e) => handleFilterChange('employee_code', e.target.value)}
          />
        )
      case 'division':
        return (
          <Select
            key={filterName}
            label="Division"
            value={filters.division || ''}
            onChange={(e) => handleFilterChange('division', e.target.value)}
            options={[
              { value: '', label: 'All Divisions' },
              ...(divisions?.map((d: any) => ({
                value: d.id,
                label: d.name,
              })) || []),
            ]}
          />
        )
      case 'directorate':
        return (
          <Select
            key={filterName}
            label="Directorate"
            value={filters.directorate || ''}
            onChange={(e) => handleFilterChange('directorate', e.target.value)}
            options={[
              { value: '', label: 'All Directorates' },
              ...(directorates?.map((d: any) => ({
                value: d.id,
                label: d.name,
              })) || []),
            ]}
          />
        )
      case 'department':
        return (
          <Select
            key={filterName}
            label="Department"
            value={filters.department || ''}
            onChange={(e) => handleFilterChange('department', e.target.value)}
            options={[
              { value: '', label: 'All Departments' },
              ...(departments?.map((d: any) => ({
                value: d.id,
                label: d.name,
              })) || []),
            ]}
          />
        )
      case 'position':
        return (
          <Select
            key={filterName}
            label="Job Title / Position"
            value={filters.position || ''}
            onChange={(e) => handleFilterChange('position', e.target.value)}
            options={[
              { value: '', label: 'All Positions' },
              ...(positions?.map((p: any) => ({
                value: p.id,
                label: p.title || p.name,
              })) || []),
            ]}
          />
        )
      case 'grade':
        return (
          <Select
            key={filterName}
            label="Grade"
            value={filters.grade || ''}
            onChange={(e) => handleFilterChange('grade', e.target.value)}
            options={[
              { value: '', label: 'All Grades' },
              ...(grades?.map((g: any) => ({
                value: g.id,
                label: g.name || g.code,
              })) || []),
            ]}
          />
        )
      case 'staff_category':
        return (
          <Select
            key={filterName}
            label="Staff Category"
            value={filters.staff_category || ''}
            onChange={(e) => handleFilterChange('staff_category', e.target.value)}
            options={[
              { value: '', label: 'All Staff Categories' },
              ...(staffCategories?.map((c: any) => ({
                value: c.id,
                label: c.name,
              })) || []),
            ]}
          />
        )
      case 'salary_band':
        return (
          <Select
            key={filterName}
            label="Salary Band"
            value={filters.salary_band || ''}
            onChange={(e) => handleFilterChange('salary_band', e.target.value)}
            options={[
              { value: '', label: 'All Salary Bands' },
              ...(salaryBands?.map((b: any) => ({
                value: b.id,
                label: `${b.code} - ${b.name}`,
              })) || []),
            ]}
          />
        )
      case 'salary_level':
        return (
          <Select
            key={filterName}
            label="Salary Level"
            value={filters.salary_level || ''}
            onChange={(e) => handleFilterChange('salary_level', e.target.value)}
            options={[
              { value: '', label: 'All Salary Levels' },
              ...(salaryLevels?.map((l: any) => ({
                value: l.id,
                label: `${l.code} - ${l.name}`,
              })) || []),
            ]}
          />
        )
      case 'bank':
        return (
          <Select
            key={filterName}
            label="Bank"
            value={filters.bank || ''}
            onChange={(e) => handleFilterChange('bank', e.target.value)}
            options={[
              { value: '', label: 'All Banks' },
              ...(banks?.map((b: any) => ({
                value: b.id,
                label: b.name,
              })) || []),
            ]}
          />
        )
      case 'status':
        return (
          <Select
            key={filterName}
            label="Employment Status"
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'PROBATION', label: 'On Probation' },
              { value: 'SUSPENDED', label: 'Suspended' },
              { value: 'TERMINATED', label: 'Terminated' },
              { value: 'RESIGNED', label: 'Resigned' },
              { value: 'RETIRED', label: 'Retired' },
            ]}
          />
        )
      case 'period':
        return (
          <Select
            key={filterName}
            label="Payroll Period"
            value={filters.period || ''}
            onChange={(e) => handleFilterChange('period', e.target.value)}
            options={[
              { value: '', label: 'Latest Period' },
              ...(payrollRuns?.map((r: any) => ({
                value: r.id,
                label: `${r.period_name} (${r.run_number})`,
              })) || []),
            ]}
          />
        )
      case 'month':
        return (
          <Select
            key={filterName}
            label="Month"
            value={filters.month || ''}
            onChange={(e) => handleFilterChange('month', e.target.value)}
            options={[
              { value: '', label: 'Select Month' },
              { value: '1', label: 'January' },
              { value: '2', label: 'February' },
              { value: '3', label: 'March' },
              { value: '4', label: 'April' },
              { value: '5', label: 'May' },
              { value: '6', label: 'June' },
              { value: '7', label: 'July' },
              { value: '8', label: 'August' },
              { value: '9', label: 'September' },
              { value: '10', label: 'October' },
              { value: '11', label: 'November' },
              { value: '12', label: 'December' },
            ]}
          />
        )
      case 'year':
        return (
          <Select
            key={filterName}
            label="Year"
            value={filters.year || ''}
            onChange={(e) => handleFilterChange('year', e.target.value)}
            options={[
              { value: '', label: 'Current Year' },
              ...Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - i
                return { value: String(year), label: String(year) }
              }),
            ]}
          />
        )
      case 'date':
      case 'date_from':
        return (
          <Input
            key={filterName}
            label={filterName === 'date' ? 'As of Date' : 'From Date'}
            type="date"
            value={filters[filterName] || ''}
            onChange={(e) => handleFilterChange(filterName, e.target.value)}
          />
        )
      case 'date_to':
        return (
          <Input
            key={filterName}
            label="To Date"
            type="date"
            value={filters.date_to || ''}
            onChange={(e) => handleFilterChange('date_to', e.target.value)}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Generate and download payroll reports
          </p>
        </div>
      </div>

      {/* Quick Access - Dedicated Report Pages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Link
          to="/reports/journal"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
        >
          <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
            <DocumentTextIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 text-sm">Payroll Journal</h3>
            <p className="text-xs text-gray-500">View journal entries</p>
          </div>
        </Link>
        <Link
          to="/reports/salary-reconciliation"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-colors group"
        >
          <div className="p-2 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
            <ArrowsRightLeftIcon className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 text-sm">Salary Reconciliation</h3>
            <p className="text-xs text-gray-500">Compare salary changes</p>
          </div>
        </Link>
        <Link
          to="/reports/payroll-master"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors group"
        >
          <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
            <ClipboardDocumentListIcon className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 text-sm">Payroll Master</h3>
            <p className="text-xs text-gray-500">Detailed payroll breakdown</p>
          </div>
        </Link>
        <Link
          to="/reports/payroll-costing"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-colors group"
        >
          <div className="p-2 bg-teal-100 rounded-lg group-hover:bg-teal-200 transition-colors">
            <TableCellsIcon className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 text-sm">Payroll Costing</h3>
            <p className="text-xs text-gray-500">Salary payment summary</p>
          </div>
        </Link>
        <Link
          to="/reports/staff-payroll-data"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors group"
        >
          <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
            <UsersIcon className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 text-sm">Staff Payroll Data</h3>
            <p className="text-xs text-gray-500">Employee payroll details</p>
          </div>
        </Link>
        <Link
          to="/reports/consolidated-summary"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
        >
          <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
            <CalculatorIcon className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 text-sm">Consolidated Summary</h3>
            <p className="text-xs text-gray-500">Multi-period payroll summary</p>
          </div>
        </Link>
        <Link
          to="/reports/labour-cost"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-rose-300 hover:bg-rose-50 transition-colors group"
        >
          <div className="p-2 bg-rose-100 rounded-lg group-hover:bg-rose-200 transition-colors">
            <CurrencyDollarIcon className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 text-sm">Labour Cost</h3>
            <p className="text-xs text-gray-500">Cost breakdown by department</p>
          </div>
        </Link>
        <Link
          to="/reports/ssf-statement"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-cyan-300 hover:bg-cyan-50 transition-colors group"
        >
          <div className="p-2 bg-cyan-100 rounded-lg group-hover:bg-cyan-200 transition-colors">
            <ShieldCheckIcon className="h-5 w-5 text-cyan-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 text-sm">SSF Statement</h3>
            <p className="text-xs text-gray-500">SSF contribution breakdown</p>
          </div>
        </Link>
        <Link
          to="/reports/tax-statement"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors group"
        >
          <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
            <ReceiptPercentIcon className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 text-sm">Tax Statement</h3>
            <p className="text-xs text-gray-500">Income tax breakdown</p>
          </div>
        </Link>
        <Link
          to="/reports/allowance-statement"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-lime-300 hover:bg-lime-50 transition-colors group"
        >
          <div className="p-2 bg-lime-100 rounded-lg group-hover:bg-lime-200 transition-colors">
            <GiftIcon className="h-5 w-5 text-lime-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 text-sm">Allowance Statement</h3>
            <p className="text-xs text-gray-500">Allowance breakdown by period</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ChartBarIcon className="h-5 w-5 mr-2 text-gray-500" />
                Available Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {reportConfigs.map((report) => (
                  <div
                    key={report.id}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedReport?.id === report.id ? 'bg-primary-50' : ''
                    }`}
                    onClick={() => {
                      setSelectedReport(report)
                      setFilters({})
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          selectedReport?.id === report.id
                            ? 'bg-primary-100'
                            : 'bg-gray-100'
                        }`}
                      >
                        <report.icon
                          className={`h-5 w-5 ${
                            selectedReport?.id === report.id
                              ? 'text-primary-600'
                              : 'text-gray-500'
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900">{report.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Configuration */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FunnelIcon className="h-5 w-5 mr-2 text-gray-500" />
                Report Options
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedReport ? (
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900">{selectedReport.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">{selectedReport.description}</p>
                  </div>

                  {selectedReport.filters && selectedReport.filters.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between sticky top-0 bg-white py-1">
                        <h5 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <FunnelIcon className="h-4 w-4" />
                          Filters
                          {Object.values(filters).filter(v => v && v.trim() !== '').length > 0 && (
                            <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">
                              {Object.values(filters).filter(v => v && v.trim() !== '').length} active
                            </span>
                          )}
                        </h5>
                        {Object.values(filters).filter(v => v && v.trim() !== '').length > 0 && (
                          <button
                            type="button"
                            className="text-xs text-gray-500 hover:text-gray-700 underline"
                            onClick={() => setFilters({})}
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                        {selectedReport.filters.map((filter) => renderFilterInput(filter))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 space-y-3 border-t">
                    {selectedReport.singleDownload ? (
                      <>
                        <Button
                          className="w-full"
                          variant="primary"
                          onClick={() => handleGenerateReport('csv')}
                          isLoading={isGenerating === 'csv'}
                          disabled={isGenerating !== null}
                        >
                          <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                          {selectedReport.downloadLabel || 'Download'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <h5 className="text-sm font-medium text-gray-700">Select Export Format</h5>

                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                              isGenerating === 'csv'
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                            }`}
                            onClick={() => handleGenerateReport('csv')}
                            disabled={isGenerating !== null}
                          >
                            <DocumentArrowDownIcon className="h-6 w-6 text-green-600 mb-1" />
                            <span className="text-xs font-medium text-gray-700">CSV</span>
                            <span className="text-[10px] text-gray-400">Text</span>
                          </button>

                          <button
                            type="button"
                            className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                              isGenerating === 'excel'
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                            }`}
                            onClick={() => handleGenerateReport('excel')}
                            disabled={isGenerating !== null}
                          >
                            <TableCellsIcon className="h-6 w-6 text-green-700 mb-1" />
                            <span className="text-xs font-medium text-gray-700">Excel</span>
                            <span className="text-[10px] text-gray-400">Spreadsheet</span>
                          </button>

                          <button
                            type="button"
                            className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                              isGenerating === 'pdf'
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                            }`}
                            onClick={() => handleGenerateReport('pdf')}
                            disabled={isGenerating !== null}
                          >
                            <DocumentTextIcon className="h-6 w-6 text-red-600 mb-1" />
                            <span className="text-xs font-medium text-gray-700">PDF</span>
                            <span className="text-[10px] text-gray-400">Print</span>
                          </button>
                        </div>

                        {isGenerating && (
                          <div className="flex items-center justify-center gap-2 text-sm text-primary-600">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Generating {isGenerating.toUpperCase()} report...
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 text-center">
                    {selectedReport.singleDownload
                      ? 'Click the button above to download the file'
                      : 'Click a format to download. CSV for data, Excel for spreadsheets, PDF for printing.'}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ChartBarIcon className="h-12 w-12 mx-auto text-gray-300" />
                  <p className="mt-2">Select a report to configure</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
