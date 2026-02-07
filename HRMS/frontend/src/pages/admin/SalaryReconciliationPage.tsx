import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { reportsService, ExportFormat } from '@/services/reports'
import {
  DocumentArrowDownIcon,
  ArrowTrendingUpIcon,
  UserPlusIcon,
  UserMinusIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface ReconciliationItem {
  description?: string
  employee_name?: string
  amount: number
  change?: number
}

interface ReconciliationSection {
  items: ReconciliationItem[]
  total: number
}

interface SalaryReconciliationData {
  periods: {
    current: { name: string; run_id: string; gross: number }
    previous: { name: string; run_id: string; gross: number }
  }
  reconciliation: {
    previous_gross: number
    less_non_recurring: ReconciliationSection
    basic_plus_recurring: number
    add_non_recurring: ReconciliationSection
    change_in_recurring: { items: ReconciliationItem[]; total: number }
    additions: ReconciliationSection
    deletions: ReconciliationSection
    current_gross: number
  }
  summary: {
    previous_gross: number
    less_non_recurring: number
    add_non_recurring: number
    recurring_changes: number
    additions: number
    deletions: number
    calculated_gross: number
    actual_gross: number
    variance: number
  }
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export default function SalaryReconciliationPage() {
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['salary-reconciliation'],
    queryFn: () => reportsService.getSalaryReconciliation(),
  })

  const reconciliationData: SalaryReconciliationData | null = data?.data || null

  const handleExport = async (format: ExportFormat) => {
    setExporting(format)
    try {
      await reportsService.exportSalaryReconciliation(undefined, undefined, format)
      toast.success(`Report exported as ${format.toUpperCase()}`)
    } catch (err) {
      toast.error('Failed to export report')
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

  if (error || !reconciliationData) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="text-center text-gray-500">
            <p>No salary reconciliation data available.</p>
            <p className="text-sm mt-2">Need at least two completed payroll periods.</p>
          </div>
        </Card>
      </div>
    )
  }

  const { periods, reconciliation, summary } = reconciliationData

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Salary Reconciliation</h1>
          <p className="text-gray-500 mt-1">
            {periods.previous.name} &rarr; {periods.current.name}
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

      {/* Period Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-500">Previous Period</div>
          <div className="text-lg font-semibold text-gray-900">{periods.previous.name}</div>
          <div className="text-xl font-bold text-gray-700 mt-2">
            GHS {formatCurrency(periods.previous.gross)}
          </div>
        </Card>
        <Card className="p-4 flex items-center justify-center">
          <div className="text-center">
            <ArrowTrendingUpIcon className="h-8 w-8 text-primary-500 mx-auto" />
            <div className="text-sm text-gray-500 mt-1">Change</div>
            <div className={`text-lg font-bold ${summary.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.variance >= 0 ? '+' : ''}{formatCurrency(periods.current.gross - periods.previous.gross)}
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Current Period</div>
          <div className="text-lg font-semibold text-gray-900">{periods.current.name}</div>
          <div className="text-xl font-bold text-primary-600 mt-2">
            GHS {formatCurrency(periods.current.gross)}
          </div>
        </Card>
      </div>

      {/* Reconciliation Details */}
      <Card className="overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Reconciliation Details</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {/* Previous Month Gross Salary - Starting Point */}
          <div className="p-4 flex justify-between items-center bg-blue-100 border-l-4 border-blue-500">
            <div>
              <span className="font-bold text-blue-800">Previous Month Gross Salary</span>
              <span className="text-sm text-blue-600 ml-2">({periods.previous.name})</span>
            </div>
            <span className="font-bold text-blue-900 text-lg">GHS {formatCurrency(reconciliation.previous_gross)}</span>
          </div>

          {/* Less: Non-Recurring Earnings */}
          <div className="p-4">
            <div className="flex justify-between items-center text-red-600 font-medium mb-2">
              <span>Less: Non-Recurring Earnings</span>
              <span>-{formatCurrency(reconciliation.less_non_recurring.total)}</span>
            </div>
            <div className="ml-4 space-y-1">
              {reconciliation.less_non_recurring.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm text-gray-600">
                  <span>{item.description}</span>
                  <span>{item.amount > 0 ? formatCurrency(item.amount) : '-'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Basic Plus Recurring */}
          <div className="p-4 flex justify-between items-center bg-blue-50">
            <span className="font-medium text-blue-700">Basic Salary Plus Recurring Earnings</span>
            <span className="font-semibold text-blue-900">GHS {formatCurrency(reconciliation.basic_plus_recurring)}</span>
          </div>

          {/* Add: Non-Recurring Earnings */}
          <div className="p-4">
            <div className="flex justify-between items-center text-green-600 font-medium mb-2">
              <span>Add: Non-Recurring Earnings</span>
              <span>+{formatCurrency(reconciliation.add_non_recurring.total)}</span>
            </div>
            <div className="ml-4 space-y-1">
              {reconciliation.add_non_recurring.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm text-gray-600">
                  <span>{item.description}</span>
                  <span>{item.amount > 0 ? formatCurrency(item.amount) : '-'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Change in Recurring */}
          <div className="p-4">
            <div className="flex justify-between items-center text-amber-600 font-medium mb-2">
              <span>Change in Recurring Earnings</span>
              <span>{reconciliation.change_in_recurring.total >= 0 ? '+' : ''}{formatCurrency(reconciliation.change_in_recurring.total)}</span>
            </div>
            <div className="ml-4 space-y-1">
              {reconciliation.change_in_recurring.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm text-gray-600">
                  <span>{item.description || item.employee_name}</span>
                  <span>{item.change !== undefined && item.change !== 0 ? formatCurrency(item.change) : '-'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Additions */}
          <div className="p-4">
            <div className="flex justify-between items-center text-green-600 font-medium mb-2">
              <div className="flex items-center gap-2">
                <UserPlusIcon className="h-5 w-5" />
                <span>Additions (New Employees)</span>
              </div>
              <span>+{formatCurrency(reconciliation.additions.total)}</span>
            </div>
            <div className="ml-4 space-y-1 max-h-60 overflow-y-auto">
              {reconciliation.additions.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm text-gray-600">
                  <span>{item.employee_name}</span>
                  <span>{item.amount > 0 ? formatCurrency(item.amount) : '-'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Deletions */}
          <div className="p-4">
            <div className="flex justify-between items-center text-red-600 font-medium mb-2">
              <div className="flex items-center gap-2">
                <UserMinusIcon className="h-5 w-5" />
                <span>Less: Deletions (Separated Employees)</span>
              </div>
              <span>-{formatCurrency(reconciliation.deletions.total)}</span>
            </div>
            <div className="ml-4 space-y-1 max-h-60 overflow-y-auto">
              {reconciliation.deletions.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm text-gray-600">
                  <span>{item.employee_name}</span>
                  <span>{item.amount > 0 ? formatCurrency(item.amount) : '-'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Current Month Gross Salary - Ending Point */}
          <div className="p-4 flex justify-between items-center bg-green-100 border-l-4 border-green-500">
            <div>
              <span className="font-bold text-green-800">Current Month Gross Salary</span>
              <span className="text-sm text-green-600 ml-2">({periods.current.name})</span>
            </div>
            <span className="font-bold text-green-900 text-lg">GHS {formatCurrency(reconciliation.current_gross)}</span>
          </div>
        </div>
      </Card>

      {/* Variance Check */}
      {Math.abs(summary.variance) > 0.01 && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-2">
            <Badge variant="warning">Variance Detected</Badge>
            <span className="text-amber-800">
              Calculated gross differs from actual by GHS {formatCurrency(Math.abs(summary.variance))}
            </span>
          </div>
        </Card>
      )}
    </div>
  )
}
