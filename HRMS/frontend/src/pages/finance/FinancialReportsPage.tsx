import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownTrayIcon,
  DocumentChartBarIcon,
} from '@heroicons/react/24/outline'
import { financeService } from '@/services/finance'
import type { FiscalYear, FiscalPeriod, TrialBalanceRow, IncomeStatementSection, BalanceSheetSection } from '@/services/finance'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils'

function exportToCSV(data: Record<string, any>[], filename: string) {
  if (data.length === 0) return
  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((h) => {
        const val = row[h]
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`
        return val ?? ''
      }).join(',')
    ),
  ]
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function TrialBalanceReport({ fiscalPeriod }: { fiscalPeriod: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['trial-balance', fiscalPeriod],
    queryFn: () => financeService.getTrialBalance({ fiscal_period: fiscalPeriod || undefined }),
    enabled: true,
  })

  const rows = data?.rows || []
  const totalDebit = data?.total_debit || 0
  const totalCredit = data?.total_credit || 0

  const handleExport = () => {
    exportToCSV(
      rows.map((r) => ({
        'Account Code': r.account_code,
        'Account Name': r.account_name,
        'Debit Balance': r.debit_balance,
        'Credit Balance': r.credit_balance,
      })),
      'trial-balance'
    )
  }

  if (isLoading) return <SkeletonTable rows={8} columns={4} showHeader />

  if (isError) {
    return (
      <EmptyState
        type="error"
        title="Failed to load trial balance"
        description={(error as any)?.message || 'An error occurred.'}
        compact
      />
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        type="data"
        title="No trial balance data"
        description="There are no posted journal entries for the selected period."
        compact
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
          onClick={handleExport}
        >
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Account Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Account Name</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Debit</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Credit</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((row: TrialBalanceRow, index: number) => (
              <tr key={index} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-mono text-gray-600">{row.account_code}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{row.account_name}</td>
                <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                  {row.debit_balance > 0 ? formatCurrency(row.debit_balance) : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                  {row.credit_balance > 0 ? formatCurrency(row.credit_balance) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-gray-300">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                Totals
              </td>
              <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                {formatCurrency(totalDebit)}
              </td>
              <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                {formatCurrency(totalCredit)}
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-center">
                {Math.abs(totalDebit - totalCredit) < 0.01 ? (
                  <span className="text-sm font-medium text-success-600">Trial balance is in balance</span>
                ) : (
                  <span className="text-sm font-medium text-danger-600">
                    Out of balance by {formatCurrency(Math.abs(totalDebit - totalCredit))}
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function IncomeStatementReport({ fiscalPeriod }: { fiscalPeriod: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['income-statement', fiscalPeriod],
    queryFn: () => financeService.getIncomeStatement({ fiscal_period: fiscalPeriod || undefined }),
    enabled: true,
  })

  const sections = data?.sections || []
  const netIncome = data?.net_income || 0

  const handleExport = () => {
    const rows: Record<string, any>[] = []
    sections.forEach((section) => {
      rows.push({ Category: section.category, Account: '', Amount: '' })
      section.accounts.forEach((acc) => {
        rows.push({ Category: '', Account: `${acc.account_code} - ${acc.account_name}`, Amount: acc.amount })
      })
      rows.push({ Category: `Total ${section.category}`, Account: '', Amount: section.total })
    })
    rows.push({ Category: 'NET INCOME', Account: '', Amount: netIncome })
    exportToCSV(rows, 'income-statement')
  }

  if (isLoading) return <SkeletonTable rows={8} columns={3} showHeader />

  if (isError) {
    return (
      <EmptyState
        type="error"
        title="Failed to load income statement"
        description={(error as any)?.message || 'An error occurred.'}
        compact
      />
    )
  }

  if (sections.length === 0) {
    return (
      <EmptyState
        type="data"
        title="No income statement data"
        description="There are no revenue or expense entries for the selected period."
        compact
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
          onClick={handleExport}
        >
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase" colSpan={2}>
                Account
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase w-40">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {sections.map((section: IncomeStatementSection, sIdx: number) => (
              <>
                {/* Section Header */}
                <tr key={`header-${sIdx}`} className="bg-gray-50">
                  <td colSpan={3} className="px-4 py-2 text-sm font-bold text-gray-900 uppercase">
                    {section.category}
                  </td>
                </tr>
                {/* Section Accounts */}
                {section.accounts.map((acc, aIdx) => (
                  <tr key={`${sIdx}-${aIdx}`} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2 text-sm font-mono text-gray-600 pl-8" style={{ width: '100px' }}>
                      {acc.account_code}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {acc.account_name}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(acc.amount)}
                    </td>
                  </tr>
                ))}
                {/* Section Total */}
                <tr key={`total-${sIdx}`} className="border-t border-gray-300">
                  <td colSpan={2} className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">
                    Total {section.category}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-bold text-gray-900">
                    {formatCurrency(section.total)}
                  </td>
                </tr>
              </>
            ))}
          </tbody>
          <tfoot className="bg-gray-100 border-t-2 border-gray-300">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                NET INCOME
              </td>
              <td className={`px-4 py-3 text-sm text-right font-bold ${netIncome >= 0 ? 'text-success-700' : 'text-danger-700'}`}>
                {formatCurrency(netIncome)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function BalanceSheetReport({ fiscalPeriod }: { fiscalPeriod: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['balance-sheet', fiscalPeriod],
    queryFn: () => financeService.getBalanceSheet({ fiscal_period: fiscalPeriod || undefined }),
    enabled: true,
  })

  const sections = data?.sections || []
  const totalAssets = data?.total_assets || 0
  const totalLiabilitiesEquity = data?.total_liabilities_equity || 0

  const handleExport = () => {
    const rows: Record<string, any>[] = []
    sections.forEach((section) => {
      rows.push({ Category: section.category, Account: '', Amount: '' })
      section.accounts.forEach((acc) => {
        rows.push({ Category: '', Account: `${acc.account_code} - ${acc.account_name}`, Amount: acc.amount })
      })
      rows.push({ Category: `Total ${section.category}`, Account: '', Amount: section.total })
    })
    rows.push({ Category: 'TOTAL ASSETS', Account: '', Amount: totalAssets })
    rows.push({ Category: 'TOTAL LIABILITIES & EQUITY', Account: '', Amount: totalLiabilitiesEquity })
    exportToCSV(rows, 'balance-sheet')
  }

  if (isLoading) return <SkeletonTable rows={8} columns={3} showHeader />

  if (isError) {
    return (
      <EmptyState
        type="error"
        title="Failed to load balance sheet"
        description={(error as any)?.message || 'An error occurred.'}
        compact
      />
    )
  }

  if (sections.length === 0) {
    return (
      <EmptyState
        type="data"
        title="No balance sheet data"
        description="There are no posted entries for the selected period."
        compact
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
          onClick={handleExport}
        >
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase" colSpan={2}>
                Account
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase w-40">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {sections.map((section: BalanceSheetSection, sIdx: number) => (
              <>
                <tr key={`header-${sIdx}`} className="bg-gray-50">
                  <td colSpan={3} className="px-4 py-2 text-sm font-bold text-gray-900 uppercase">
                    {section.category}
                  </td>
                </tr>
                {section.accounts.map((acc, aIdx) => (
                  <tr key={`${sIdx}-${aIdx}`} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2 text-sm font-mono text-gray-600 pl-8" style={{ width: '100px' }}>
                      {acc.account_code}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {acc.account_name}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(acc.amount)}
                    </td>
                  </tr>
                ))}
                <tr key={`total-${sIdx}`} className="border-t border-gray-300">
                  <td colSpan={2} className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">
                    Total {section.category}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-bold text-gray-900">
                    {formatCurrency(section.total)}
                  </td>
                </tr>
              </>
            ))}
          </tbody>
          <tfoot className="bg-gray-100 border-t-2 border-gray-300">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                TOTAL ASSETS
              </td>
              <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                {formatCurrency(totalAssets)}
              </td>
            </tr>
            <tr className="border-t border-gray-200">
              <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                TOTAL LIABILITIES & EQUITY
              </td>
              <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                {formatCurrency(totalLiabilitiesEquity)}
              </td>
            </tr>
            <tr className="border-t border-gray-200">
              <td colSpan={3} className="px-4 py-2 text-center">
                {Math.abs(totalAssets - totalLiabilitiesEquity) < 0.01 ? (
                  <span className="text-sm font-medium text-success-600">Balance sheet is in balance</span>
                ) : (
                  <span className="text-sm font-medium text-danger-600">
                    Out of balance by {formatCurrency(Math.abs(totalAssets - totalLiabilitiesEquity))}
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default function FinancialReportsPage() {
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('')

  const { data: yearsData } = useQuery({
    queryKey: ['fiscal-years-for-reports'],
    queryFn: () => financeService.getFiscalYears({ page_size: 100 }),
  })

  const { data: periodsData } = useQuery({
    queryKey: ['fiscal-periods-for-reports', selectedYear],
    queryFn: () => financeService.getFiscalPeriods({ fiscal_year: selectedYear, page_size: 100 }),
    enabled: !!selectedYear,
  })

  const yearOptions = useMemo(() => {
    const years = yearsData?.results || []
    return years.map((y: FiscalYear) => ({ value: y.id, label: y.name }))
  }, [yearsData])

  const periodOptions = useMemo(() => {
    const periods = periodsData?.results || []
    return [
      { value: '', label: 'All Periods' },
      ...periods.map((p: FiscalPeriod) => ({ value: p.id, label: p.name })),
    ]
  }, [periodsData])

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Financial Reports"
        subtitle="View trial balance, income statement, and balance sheet"
        breadcrumbs={[
          { label: 'Finance', href: '/finance' },
          { label: 'Financial Reports' },
        ]}
      />

      {/* Period Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="w-full sm:w-64">
              <Select
                label="Fiscal Year"
                value={selectedYear}
                onChange={(e) => { setSelectedYear(e.target.value); setSelectedPeriod('') }}
                options={yearOptions}
                placeholder="Select fiscal year"
              />
            </div>
            {selectedYear && (
              <div className="w-full sm:w-64">
                <Select
                  label="Fiscal Period"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  options={periodOptions}
                  placeholder="All Periods"
                />
              </div>
            )}
            {!selectedYear && (
              <p className="text-sm text-gray-500 pb-2">
                Select a fiscal year to view financial reports.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reports Tabs */}
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="trial-balance">
            <TabsList>
              <TabsTrigger value="trial-balance">
                <DocumentChartBarIcon className="w-4 h-4 mr-1.5" />
                Trial Balance
              </TabsTrigger>
              <TabsTrigger value="income-statement">
                Income Statement
              </TabsTrigger>
              <TabsTrigger value="balance-sheet">
                Balance Sheet
              </TabsTrigger>
            </TabsList>

            <TabsContent value="trial-balance">
              <TrialBalanceReport fiscalPeriod={selectedPeriod} />
            </TabsContent>

            <TabsContent value="income-statement">
              <IncomeStatementReport fiscalPeriod={selectedPeriod} />
            </TabsContent>

            <TabsContent value="balance-sheet">
              <BalanceSheetReport fiscalPeriod={selectedPeriod} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
