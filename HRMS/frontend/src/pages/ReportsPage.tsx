import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ChartBarIcon,
  DocumentArrowDownIcon,
  UsersIcon,
  BanknotesIcon,
  CalendarIcon,
  CreditCardIcon,
  FunnelIcon,
  TableCellsIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  DocumentDuplicateIcon,
  BuildingLibraryIcon,
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
  category: 'hr' | 'payroll' | 'leave' | 'loans'
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
    id: 'employee-master',
    name: 'Employee Master Report',
    description: 'Complete list of all employees with their details',
    icon: UsersIcon,
    category: 'hr',
    filters: ['employee_code', 'division', 'directorate', 'department', 'position', 'grade', 'salary_band', 'salary_level', 'staff_category', 'status'],
    exportFn: (filters, format) => reportsService.exportEmployeeMaster(filters, format),
  },
  {
    id: 'headcount',
    name: 'Headcount Report',
    description: 'Employee count by department, region, and grade',
    icon: UsersIcon,
    category: 'hr',
    filters: ['division', 'directorate', 'department', 'grade', 'staff_category'],
    exportFn: (filters, format) => reportsService.exportHeadcount(format, filters),
  },
  {
    id: 'payroll-summary',
    name: 'Payroll Summary',
    description: 'Summary of payroll by period with all employee details',
    icon: BanknotesIcon,
    category: 'payroll',
    filters: ['period', 'employee_code', 'division', 'directorate', 'department', 'position', 'grade', 'salary_band', 'salary_level', 'staff_category'],
    exportFn: (filters, format) => reportsService.exportPayrollSummary(filters.period, format, filters),
  },
  {
    id: 'payroll-master',
    name: 'Payroll Master Report',
    description: 'Detailed breakdown of earnings, deductions, and employer contributions per employee',
    icon: ClipboardDocumentListIcon,
    category: 'payroll',
    filters: ['period', 'employee_code', 'division', 'directorate', 'department', 'position', 'grade', 'salary_band', 'salary_level', 'staff_category'],
    exportFn: (filters, format) => reportsService.exportPayrollMaster({ payroll_run: filters.period, ...filters }, format),
  },
  {
    id: 'paye',
    name: 'PAYE Tax Report',
    description: 'Monthly income tax (PAYE) report for GRA submission',
    icon: BanknotesIcon,
    category: 'payroll',
    filters: ['period', 'employee_code', 'division', 'directorate', 'department', 'grade', 'staff_category'],
    exportFn: (filters, format) => reportsService.exportPAYEReport(filters.period, format, filters),
  },
  {
    id: 'ssnit',
    name: 'SSNIT Contribution Report',
    description: 'Monthly SSNIT contributions for statutory submission',
    icon: BanknotesIcon,
    category: 'payroll',
    filters: ['period', 'employee_code', 'division', 'directorate', 'department', 'grade', 'staff_category'],
    exportFn: (filters, format) => reportsService.exportSSNITReport(filters.period, format, filters),
  },
  {
    id: 'bank-advice',
    name: 'Bank Advice Report',
    description: 'Bank transfer details for salary payments',
    icon: BanknotesIcon,
    category: 'payroll',
    filters: ['period', 'employee_code', 'division', 'directorate', 'department', 'bank'],
    exportFn: (filters, format) => reportsService.exportBankAdvice(filters.period, format, filters),
  },
  {
    id: 'payslips',
    name: 'Employee Payslips',
    description: 'Download all generated payslips for a payroll run as a ZIP file',
    icon: DocumentDuplicateIcon,
    category: 'payroll',
    filters: ['period'],
    singleDownload: true,
    downloadLabel: 'Download Payslips (ZIP)',
    exportFn: (filters) => {
      if (!filters.period) {
        return Promise.reject(new Error('Please select a payroll period'))
      }
      return reportsService.downloadAllPayslips(filters.period)
    },
  },
  {
    id: 'bank-file',
    name: 'Bank Payment File',
    description: 'Download the generated bank payment file for salary transfers',
    icon: BuildingLibraryIcon,
    category: 'payroll',
    filters: ['period'],
    singleDownload: true,
    downloadLabel: 'Download Bank File',
    exportFn: async (filters) => {
      if (!filters.period) {
        return Promise.reject(new Error('Please select a payroll period'))
      }
      // Get the bank files for this run and download the first one
      const data = await reportsService.getBankFilesForRun(filters.period)
      if (data.bank_files && data.bank_files.length > 0) {
        return reportsService.downloadBankFile(data.bank_files[0].id)
      }
      return Promise.reject(new Error('No bank file generated for this payroll run'))
    },
  },
  {
    id: 'leave-balance',
    name: 'Leave Balance Report',
    description: 'Current leave balances for all employees',
    icon: CalendarIcon,
    category: 'leave',
    filters: ['employee_code', 'division', 'directorate', 'department', 'grade', 'staff_category'],
    exportFn: (filters, format) => reportsService.exportLeaveBalance(filters, format),
  },
  {
    id: 'loan-outstanding',
    name: 'Outstanding Loans Report',
    description: 'All active loans with balances',
    icon: CreditCardIcon,
    category: 'loans',
    filters: ['employee_code', 'division', 'directorate', 'department', 'grade', 'staff_category'],
    exportFn: (filters, format) => reportsService.exportLoanOutstanding(filters, format),
  },
]

const categoryLabels: Record<string, string> = {
  hr: 'Human Resources',
  payroll: 'Payroll',
  leave: 'Leave Management',
  loans: 'Loans & Benefits',
}

export default function ReportsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
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

  const filteredReports =
    selectedCategory === 'all'
      ? reportConfigs
      : reportConfigs.filter((r) => r.category === selectedCategory)

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
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Generate and download various reports
          </p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === 'all' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
        >
          All Reports
        </Button>
        {Object.entries(categoryLabels).map(([key, label]) => (
          <Button
            key={key}
            variant={selectedCategory === key ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(key)}
          >
            {label}
          </Button>
        ))}
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
                {filteredReports.map((report) => (
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
                        <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                          {categoryLabels[report.category]}
                        </span>
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
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                      <h5 className="text-sm font-medium text-gray-700 sticky top-0 bg-white py-1">Filters</h5>
                      {selectedReport.filters.map((filter) => renderFilterInput(filter))}
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
                        <h5 className="text-sm font-medium text-gray-700">Download Format</h5>

                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => handleGenerateReport('csv')}
                          isLoading={isGenerating === 'csv'}
                          disabled={isGenerating !== null}
                        >
                          <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                          Download CSV
                        </Button>

                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => handleGenerateReport('excel')}
                          isLoading={isGenerating === 'excel'}
                          disabled={isGenerating !== null}
                        >
                          <TableCellsIcon className="h-4 w-4 mr-2" />
                          Download Excel
                        </Button>

                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => handleGenerateReport('pdf')}
                          isLoading={isGenerating === 'pdf'}
                          disabled={isGenerating !== null}
                        >
                          <DocumentTextIcon className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                      </>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 text-center">
                    {selectedReport.singleDownload
                      ? 'Click the button above to download the file'
                      : 'Choose your preferred format: CSV for data processing, Excel for spreadsheets, or PDF for printing'}
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
