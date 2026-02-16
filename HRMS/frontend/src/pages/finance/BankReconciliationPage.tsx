import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircleIcon,
  XCircleIcon,
  LinkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { financeService } from '@/services/finance'
import type { OrganizationBankAccount, BankStatement, BankStatementLine, Payment } from '@/services/finance'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable, SkeletonStatsCard } from '@/components/ui/Skeleton'
import { StatsCard } from '@/components/ui/StatsCard'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function BankReconciliationPage() {
  const queryClient = useQueryClient()

  const [selectedBankAccount, setSelectedBankAccount] = useState('')
  const [selectedStatement, setSelectedStatement] = useState('')
  const [matchModalLine, setMatchModalLine] = useState<BankStatementLine | null>(null)
  const [selectedPayment, setSelectedPayment] = useState('')

  // Queries
  const { data: bankAccountsData } = useQuery({
    queryKey: ['bank-accounts-reconciliation'],
    queryFn: () => financeService.getBankAccounts({ is_active: true, page_size: 100 }),
  })

  const { data: statementsData, isLoading: statementsLoading } = useQuery({
    queryKey: ['bank-statements', selectedBankAccount],
    queryFn: () => financeService.getBankStatements({ bank_account: selectedBankAccount, page_size: 100 }),
    enabled: !!selectedBankAccount,
  })

  const { data: statementDetail, isLoading: statementLoading, refetch: refetchStatement } = useQuery({
    queryKey: ['bank-statement-detail', selectedStatement],
    queryFn: () => financeService.getBankStatement(selectedStatement),
    enabled: !!selectedStatement,
  })

  const { data: statementLines, isLoading: linesLoading, refetch: refetchLines } = useQuery({
    queryKey: ['bank-statement-lines', selectedStatement],
    queryFn: () => financeService.getBankStatementLines({ statement: selectedStatement, page_size: 500 }),
    enabled: !!selectedStatement,
  })

  const { data: unmatchedPayments } = useQuery({
    queryKey: ['unmatched-payments', selectedBankAccount],
    queryFn: () => financeService.getPayments({ bank_account: selectedBankAccount, page_size: 500 }),
    enabled: !!selectedBankAccount,
  })

  // Options
  const bankAccountOptions = useMemo(() => {
    const accounts = bankAccountsData?.results || []
    return accounts.map((a: OrganizationBankAccount) => ({
      value: a.id,
      label: `${a.bank_name} - ${a.account_number} (${formatCurrency(Number(a.current_balance), a.currency)})`,
    }))
  }, [bankAccountsData])

  const statementOptions = useMemo(() => {
    const stmts = statementsData?.results || []
    return stmts.map((s: BankStatement) => ({
      value: s.id,
      label: `${formatDate(s.statement_date)} | Opening: ${formatCurrency(Number(s.opening_balance))} | Closing: ${formatCurrency(Number(s.closing_balance))}`,
    }))
  }, [statementsData])

  const paymentOptions = useMemo(() => {
    const payments = unmatchedPayments?.results || []
    return payments.map((p: Payment) => ({
      value: p.id,
      label: `${p.payment_number} | ${formatDate(p.payment_date)} | ${formatCurrency(Number(p.amount))} | ${p.vendor_name || p.customer_name || p.reference || 'N/A'}`,
    }))
  }, [unmatchedPayments])

  // Line data
  const lines = statementLines?.results || []
  const unreconciledLines = lines.filter((l: BankStatementLine) => !l.is_reconciled)
  const reconciledLines = lines.filter((l: BankStatementLine) => l.is_reconciled)

  // Stats
  const totalDebits = lines.reduce((sum: number, l: BankStatementLine) => sum + Number(l.debit_amount || 0), 0)
  const totalCredits = lines.reduce((sum: number, l: BankStatementLine) => sum + Number(l.credit_amount || 0), 0)
  const reconciledCount = reconciledLines.length
  const unreconciledCount = unreconciledLines.length
  const reconciliationPct = lines.length > 0 ? Math.round((reconciledCount / lines.length) * 100) : 0

  // Match mutation
  const matchMutation = useMutation({
    mutationFn: ({ lineId, paymentId }: { lineId: string; paymentId: string }) =>
      financeService.updateBankStatementLine(lineId, {
        is_reconciled: true,
        matched_payment: paymentId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-statement-lines', selectedStatement] })
      queryClient.invalidateQueries({ queryKey: ['bank-statement-detail', selectedStatement] })
      setMatchModalLine(null)
      setSelectedPayment('')
    },
  })

  // Unreconcile mutation
  const unreconcileMutation = useMutation({
    mutationFn: (lineId: string) =>
      financeService.updateBankStatementLine(lineId, {
        is_reconciled: false,
        matched_payment: undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-statement-lines', selectedStatement] })
      queryClient.invalidateQueries({ queryKey: ['bank-statement-detail', selectedStatement] })
    },
  })

  const handleMatch = () => {
    if (!matchModalLine || !selectedPayment) return
    matchMutation.mutate({ lineId: matchModalLine.id, paymentId: selectedPayment })
  }

  const handleBankAccountChange = (value: string) => {
    setSelectedBankAccount(value)
    setSelectedStatement('')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Bank Reconciliation"
        subtitle="Match bank statement lines to recorded payments"
        breadcrumbs={[
          { label: 'Finance', href: '/finance' },
          { label: 'Bank Reconciliation' },
        ]}
        actions={
          selectedStatement && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowPathIcon className="w-4 h-4" />}
              onClick={() => { refetchStatement(); refetchLines() }}
            >
              Refresh
            </Button>
          )
        }
      />

      {/* Bank Account & Statement Selection */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Bank Account"
              value={selectedBankAccount}
              onChange={(e) => handleBankAccountChange(e.target.value)}
              options={bankAccountOptions}
              placeholder="Select a bank account"
            />
            {selectedBankAccount && (
              <Select
                label="Statement"
                value={selectedStatement}
                onChange={(e) => setSelectedStatement(e.target.value)}
                options={statementOptions}
                placeholder={statementsLoading ? 'Loading...' : 'Select a statement'}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedBankAccount && (
        <Card>
          <EmptyState
            type="data"
            title="Select a Bank Account"
            description="Choose a bank account above to begin the reconciliation process."
          />
        </Card>
      )}

      {selectedBankAccount && !selectedStatement && (
        <Card>
          <EmptyState
            type="data"
            title="Select a Statement"
            description="Choose a bank statement to view and reconcile transactions."
          />
        </Card>
      )}

      {selectedStatement && (
        <>
          {/* Reconciliation Stats */}
          {statementLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonStatsCard key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatsCard
                title="Opening Balance"
                value={statementDetail ? formatCurrency(Number(statementDetail.opening_balance)) : '-'}
                variant="default"
              />
              <StatsCard
                title="Total Debits"
                value={formatCurrency(totalDebits)}
                variant="danger"
              />
              <StatsCard
                title="Total Credits"
                value={formatCurrency(totalCredits)}
                variant="success"
              />
              <StatsCard
                title="Closing Balance"
                value={statementDetail ? formatCurrency(Number(statementDetail.closing_balance)) : '-'}
                variant="info"
              />
              <StatsCard
                title="Reconciled"
                value={`${reconciliationPct}%`}
                variant={reconciliationPct === 100 ? 'success' : reconciliationPct >= 50 ? 'warning' : 'danger'}
              />
            </div>
          )}

          {/* Unreconciled Lines */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Unreconciled Transactions ({unreconciledCount})
                </CardTitle>
              </div>
            </CardHeader>
            {linesLoading ? (
              <div className="p-4">
                <SkeletonTable rows={5} columns={6} showHeader />
              </div>
            ) : unreconciledLines.length === 0 ? (
              <EmptyState
                type="data"
                title="All Reconciled"
                description="All statement lines have been reconciled."
                compact
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reference</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Debit</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Credit</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase w-32">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {unreconciledLines.map((line: BankStatementLine) => (
                      <tr key={line.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-700">{formatDate(line.transaction_date)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{line.description}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{line.reference || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          {Number(line.debit_amount) > 0 ? formatCurrency(Number(line.debit_amount)) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          {Number(line.credit_amount) > 0 ? formatCurrency(Number(line.credit_amount)) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="xs"
                            leftIcon={<LinkIcon className="w-3.5 h-3.5" />}
                            onClick={() => { setMatchModalLine(line); setSelectedPayment('') }}
                          >
                            Match
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Reconciled Lines */}
          {reconciledLines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Reconciled Transactions ({reconciledCount})
                </CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Matched Payment</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Debit</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Credit</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase w-32">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {reconciledLines.map((line: BankStatementLine) => (
                      <tr key={line.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-700">{formatDate(line.transaction_date)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{line.description}</td>
                        <td className="px-4 py-3 text-sm text-primary-600 font-medium">
                          {line.matched_payment_number || line.matched_payment || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          {Number(line.debit_amount) > 0 ? formatCurrency(Number(line.debit_amount)) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          {Number(line.credit_amount) > 0 ? formatCurrency(Number(line.credit_amount)) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="success" size="xs" dot>
                            Reconciled
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => unreconcileMutation.mutate(line.id)}
                            isLoading={unreconcileMutation.isPending}
                          >
                            <XCircleIcon className="w-4 h-4 mr-1" />
                            Unmatch
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Match Modal */}
      <Modal
        isOpen={!!matchModalLine}
        onClose={() => { setMatchModalLine(null); setSelectedPayment('') }}
        title="Match Statement Line to Payment"
        size="lg"
      >
        {matchModalLine && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-md p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Statement Line</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Date</p>
                  <p className="font-medium">{formatDate(matchModalLine.transaction_date)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Amount</p>
                  <p className="font-medium">
                    {Number(matchModalLine.debit_amount) > 0
                      ? `Debit: ${formatCurrency(Number(matchModalLine.debit_amount))}`
                      : `Credit: ${formatCurrency(Number(matchModalLine.credit_amount))}`}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Description</p>
                  <p className="font-medium">{matchModalLine.description}</p>
                </div>
                {matchModalLine.reference && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Reference</p>
                    <p className="font-medium">{matchModalLine.reference}</p>
                  </div>
                )}
              </div>
            </div>

            <Select
              label="Select Matching Payment"
              value={selectedPayment}
              onChange={(e) => setSelectedPayment(e.target.value)}
              options={paymentOptions}
              placeholder="Search and select a payment..."
            />

            {matchMutation.error && (
              <div className="p-3 bg-danger-50 border border-danger-200 rounded-md text-sm text-danger-700">
                {(matchMutation.error as any)?.response?.data?.detail || 'Failed to match.'}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button variant="outline" onClick={() => { setMatchModalLine(null); setSelectedPayment('') }}>
                Cancel
              </Button>
              <Button
                onClick={handleMatch}
                disabled={!selectedPayment}
                isLoading={matchMutation.isPending}
                leftIcon={<CheckCircleIcon className="w-4 h-4" />}
              >
                Reconcile
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
