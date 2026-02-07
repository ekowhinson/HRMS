import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { reportsService, ExportFormat } from '@/services/reports'
import {
  DocumentArrowDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface JournalEntry {
  account_code: string
  account_name: string
  component_type: string
  credit_amount: number | null
  debit_amount: number | null
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['payroll-journal'],
    queryFn: () => reportsService.getPayrollJournal(),
  })

  const journalData: JournalData | null = data?.data || null

  const handleExport = async (format: ExportFormat) => {
    setExporting(format)
    try {
      await reportsService.exportPayrollJournal(undefined, format)
      toast.success(`Journal exported as ${format.toUpperCase()}`)
    } catch (err) {
      toast.error('Failed to export journal')
    } finally {
      setExporting(null)
    }
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
      <div className="p-6">
        <Card className="p-6">
          <div className="text-center text-gray-500">
            <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No payroll journal data available.</p>
            <p className="text-sm mt-2">Please ensure a payroll run has been computed.</p>
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
                <tr key={`credit-${idx}`} className="hover:bg-gray-50">
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                    {entry.account_name}
                    {entry.component_type === 'EMPLOYER' && (
                      <Badge variant="info" className="ml-2 text-xs">Employer</Badge>
                    )}
                    {entry.component_type === 'PAYMENT' && (
                      <Badge variant="success" className="ml-2 text-xs">Net Pay</Badge>
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
                <tr key={`debit-${idx}`} className="hover:bg-gray-50">
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                    {entry.account_name}
                    {entry.component_type === 'EMPLOYER' && (
                      <Badge variant="info" className="ml-2 text-xs">Employer</Badge>
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
