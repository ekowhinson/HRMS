import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { reportsService, ExportFormat } from '@/services/reports'
import api from '@/lib/api'
import {
  DocumentArrowDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface JournalEntry {
  account_code: string
  account_name: string
  component_type: string
  credit_amount: number | null
  debit_amount: number | null
  is_arrear?: boolean
}

interface JournalData {
  period: {
    name: string
    start_date: string
    end_date: string
    run_id: string
    run_number: string
    run_date: string
    status: string
  }
  entries: JournalEntry[]
  summary: {
    total_credits: number
    total_debits: number
    is_balanced: boolean
    variance: number
  }
  meta: {
    credit_count: number
    debit_count: number
    total_entries: number
  }
  filters?: Record<string, string>
}

const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === 0) return ''
  return new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export default function PayrollJournalPage() {
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>({
    division: '',
    directorate: '',
    department: '',
    grade: '',
  })

  // Build active filters for API calls
  const activeFilters = useMemo(() => {
    const active: Record<string, string> = {}
    Object.entries(filters).forEach(([key, value]) => {
      if (value) active[key] = value
    })
    return active
  }, [filters])

  const hasActiveFilters = Object.keys(activeFilters).length > 0

  // Fetch filter options
  const { data: divisions } = useQuery({
    queryKey: ['divisions'],
    queryFn: async () => {
      const res = await api.get('/organization/divisions/')
      return res.data.results || res.data || []
    },
  })

  const { data: directorates } = useQuery({
    queryKey: ['directorates'],
    queryFn: async () => {
      const res = await api.get('/organization/directorates/')
      return res.data.results || res.data || []
    },
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get('/organization/departments/')
      return res.data.results || res.data || []
    },
  })

  const { data: grades } = useQuery({
    queryKey: ['grades'],
    queryFn: async () => {
      const res = await api.get('/organization/grades/')
      return res.data.results || res.data || []
    },
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['payroll-journal', activeFilters],
    queryFn: () => reportsService.getPayrollJournal(undefined, hasActiveFilters ? activeFilters : undefined),
  })

  const journalData: JournalData | null = data?.data || null

  const handleExport = async (format: ExportFormat) => {
    setExporting(format)
    try {
      await reportsService.exportPayrollJournal(undefined, format, hasActiveFilters ? activeFilters : undefined)
      toast.success(`Journal exported as ${format.toUpperCase()}`)
    } catch (err) {
      toast.error('Failed to export journal')
    } finally {
      setExporting(null)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({ division: '', directorate: '', department: '', grade: '' })
  }

  // Get filter label for active filter badges
  const getFilterLabel = (key: string, value: string) => {
    const lists: Record<string, any[]> = { division: divisions, directorate: directorates, department: departments, grade: grades }
    const list = lists[key] || []
    const item = list.find((i: any) => i.id === value)
    return item?.name || value
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error || !journalData) {
    return (
      <div className="p-6 space-y-6">
        {/* Still show filters when no data */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Payroll Journal</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={hasActiveFilters ? 'border-blue-500 text-blue-600' : ''}
            >
              <FunnelIcon className="h-4 w-4 mr-1" />
              Filters {hasActiveFilters && `(${Object.keys(activeFilters).length})`}
            </Button>
          </div>
        </div>

        {showFilters && (
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Division</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={filters.division} onChange={e => handleFilterChange('division', e.target.value)}>
                  <option value="">All Divisions</option>
                  {(divisions || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Directorate</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={filters.directorate} onChange={e => handleFilterChange('directorate', e.target.value)}>
                  <option value="">All Directorates</option>
                  {(directorates || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={filters.department} onChange={e => handleFilterChange('department', e.target.value)}>
                  <option value="">All Departments</option>
                  {(departments || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Job Grade</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={filters.grade} onChange={e => handleFilterChange('grade', e.target.value)}>
                  <option value="">All Grades</option>
                  {(grades || []).map((g: any) => <option key={g.id} value={g.id}>{g.name} ({g.code})</option>)}
                </select>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="mt-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <XMarkIcon className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              </div>
            )}
          </Card>
        )}

        <Card className="p-6">
          <div className="text-center text-gray-500">
            <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No payroll journal data available{hasActiveFilters ? ' for the selected filters' : ''}.</p>
            <p className="text-sm mt-2">
              {hasActiveFilters ? 'Try adjusting or clearing your filters.' : 'Please ensure a payroll run has been computed.'}
            </p>
          </div>
        </Card>
      </div>
    )
  }

  const creditEntries = journalData.entries.filter(e => e.credit_amount !== null)
  const debitEntries = journalData.entries.filter(e => e.debit_amount !== null)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Payroll Journal</h1>
          <p className="text-gray-500 mt-1">
            {journalData.period.name} - {journalData.period.run_number}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={hasActiveFilters ? 'border-blue-500 text-blue-600' : ''}
          >
            <FunnelIcon className="h-4 w-4 mr-1" />
            Filters {hasActiveFilters && `(${Object.keys(activeFilters).length})`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            disabled={!!exporting}
          >
            <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
            {exporting === 'csv' ? 'Exporting...' : 'CSV'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('excel')}
            disabled={!!exporting}
          >
            <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
            {exporting === 'excel' ? 'Exporting...' : 'Excel'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('pdf')}
            disabled={!!exporting}
          >
            <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
            {exporting === 'pdf' ? 'Exporting...' : 'PDF'}
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Division</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={filters.division} onChange={e => handleFilterChange('division', e.target.value)}>
                <option value="">All Divisions</option>
                {(divisions || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Directorate</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={filters.directorate} onChange={e => handleFilterChange('directorate', e.target.value)}>
                <option value="">All Directorates</option>
                {(directorates || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={filters.department} onChange={e => handleFilterChange('department', e.target.value)}>
                <option value="">All Departments</option>
                {(departments || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Job Grade</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={filters.grade} onChange={e => handleFilterChange('grade', e.target.value)}>
                <option value="">All Grades</option>
                {(grades || []).map((g: any) => <option key={g.id} value={g.id}>{g.name} ({g.code})</option>)}
              </select>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <XMarkIcon className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-500">Filtered by:</span>
          {Object.entries(activeFilters).map(([key, value]) => (
            <Badge key={key} variant="info" className="text-xs">
              {key.charAt(0).toUpperCase() + key.slice(1)}: {getFilterLabel(key, value)}
              <button
                className="ml-1 hover:text-blue-800"
                onClick={() => handleFilterChange(key, '')}
              >
                &times;
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Balance Status */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {journalData.summary.is_balanced ? (
              <>
                <CheckCircleIcon className="h-6 w-6 text-green-500" />
                <span className="text-green-700 font-medium">Journal is Balanced</span>
              </>
            ) : (
              <>
                <ExclamationTriangleIcon className="h-6 w-6 text-amber-500" />
                <span className="text-amber-700 font-medium">
                  Journal has variance of {formatCurrency(journalData.summary.variance)}
                </span>
              </>
            )}
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-gray-500">
              Status: <Badge variant={journalData.period.status === 'PAID' ? 'success' : 'warning'}>{journalData.period.status}</Badge>
            </span>
            <span className="text-gray-500">
              Entries: {journalData.meta.total_entries}
            </span>
          </div>
        </div>
      </Card>

      {/* Journal Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Name
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Credit Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Debit Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Credit Entries */}
              {creditEntries.map((entry, idx) => (
                <tr key={`credit-${idx}`} className={entry.is_arrear ? 'hover:bg-blue-50 bg-blue-50/30' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                    {entry.account_name}
                    {entry.component_type === 'EMPLOYER' && (
                      <Badge variant="info" className="ml-2 text-xs">Employer</Badge>
                    )}
                    {entry.component_type === 'PAYMENT' && (
                      <Badge variant="success" className="ml-2 text-xs">Net Pay</Badge>
                    )}
                    {entry.is_arrear && (
                      <Badge variant="warning" className="ml-2 text-xs">Backpay</Badge>
                    )}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(entry.credit_amount)}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">
                    -
                  </td>
                </tr>
              ))}

              {/* Debit Entries */}
              {debitEntries.map((entry, idx) => (
                <tr key={`debit-${idx}`} className={entry.is_arrear ? 'hover:bg-blue-50 bg-blue-50/30' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                    {entry.account_name}
                    {entry.component_type === 'EMPLOYER' && (
                      <Badge variant="info" className="ml-2 text-xs">Employer</Badge>
                    )}
                    {entry.is_arrear && (
                      <Badge variant="warning" className="ml-2 text-xs">Backpay</Badge>
                    )}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">
                    -
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(entry.debit_amount)}
                  </td>
                </tr>
              ))}

              {/* Totals Row */}
              <tr className="bg-gray-100 font-semibold">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  TOTAL
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {formatCurrency(journalData.summary.total_credits)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {formatCurrency(journalData.summary.total_debits)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-500">Total Credits</div>
          <div className="text-xl font-semibold text-gray-900">
            GHS {formatCurrency(journalData.summary.total_credits)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Total Debits</div>
          <div className="text-xl font-semibold text-gray-900">
            GHS {formatCurrency(journalData.summary.total_debits)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Credit Entries</div>
          <div className="text-xl font-semibold text-gray-900">
            {journalData.meta.credit_count}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Debit Entries</div>
          <div className="text-xl font-semibold text-gray-900">
            {journalData.meta.debit_count}
          </div>
        </Card>
      </div>
    </div>
  )
}
