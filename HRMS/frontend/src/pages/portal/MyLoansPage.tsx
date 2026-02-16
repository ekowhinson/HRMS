import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CreditCardIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { TablePagination } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { benefitsService, type LoanAccount, type LoanSchedule, type LoanTransaction } from '@/services/benefits'

const statusConfig: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default'; label: string }> = {
  DRAFT: { variant: 'default', label: 'Draft' },
  PENDING: { variant: 'warning', label: 'Pending' },
  APPROVED: { variant: 'info', label: 'Approved' },
  REJECTED: { variant: 'danger', label: 'Rejected' },
  DISBURSED: { variant: 'info', label: 'Disbursed' },
  ACTIVE: { variant: 'success', label: 'Active' },
  COMPLETED: { variant: 'success', label: 'Completed' },
  DEFAULTED: { variant: 'danger', label: 'Defaulted' },
  WRITTEN_OFF: { variant: 'danger', label: 'Written Off' },
  CANCELLED: { variant: 'default', label: 'Cancelled' },
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function MyLoansPage() {
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ['my-loans'],
    queryFn: benefitsService.getMyLoans,
  })

  const activeLoans = loans.filter((l) => ['ACTIVE', 'DISBURSED'].includes(l.status))
  const otherLoans = loans.filter((l) => !['ACTIVE', 'DISBURSED'].includes(l.status))

  const totalOutstanding = activeLoans.reduce((sum, l) => sum + l.outstanding_balance, 0)
  const totalMonthlyDeduction = activeLoans.reduce((sum, l) => sum + l.monthly_installment, 0)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Loans</h1>
        <p className="mt-1 text-sm text-gray-500">
          View your loan accounts, repayment schedules, and transaction history
        </p>
      </div>

      {/* Summary Stats */}
      {loans.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-md border border-gray-300 shadow-xs border-l-4 border-l-primary-500">
            <p className="text-sm text-gray-500">Active Loans</p>
            <p className="text-xl font-bold text-gray-900">{activeLoans.length}</p>
          </div>
          <div className="bg-white p-4 rounded-md border border-gray-300 shadow-xs border-l-4 border-l-warning-500">
            <p className="text-sm text-gray-500">Total Outstanding</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalOutstanding)}</p>
          </div>
          <div className="bg-white p-4 rounded-md border border-gray-300 shadow-xs border-l-4 border-l-info-500">
            <p className="text-sm text-gray-500">Monthly Deduction</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalMonthlyDeduction)}</p>
          </div>
        </div>
      )}

      {/* Loans List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-md">
              <CreditCardIcon className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Loan Accounts</h2>
              <p className="text-sm text-gray-500">Click on a loan to view schedule and transactions</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-gray-500">Loading loans...</div>
          ) : loans.length === 0 ? (
            <div className="p-8 text-center">
              <InformationCircleIcon className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">You have no loan accounts</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* Active loans first, then others */}
              {[...activeLoans, ...otherLoans].slice((currentPage - 1) * pageSize, currentPage * pageSize).map((loan) => (
                <LoanRow
                  key={loan.id}
                  loan={loan}
                  isExpanded={expandedLoanId === loan.id}
                  onToggle={() =>
                    setExpandedLoanId(expandedLoanId === loan.id ? null : loan.id)
                  }
                />
              ))}
            </div>
          )}
          {loans.length > pageSize && (
            <TablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(loans.length / pageSize)}
              totalItems={loans.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LoanRow({
  loan,
  isExpanded,
  onToggle,
}: {
  loan: LoanAccount
  isExpanded: boolean
  onToggle: () => void
}) {
  const status = statusConfig[loan.status] || statusConfig.DRAFT
  const progress =
    loan.total_amount > 0
      ? Math.min(((loan.principal_paid + loan.interest_paid) / loan.total_amount) * 100, 100)
      : 0

  return (
    <div>
      <div
        className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={status.variant} size="xs">
                {status.label}
              </Badge>
              <span className="text-xs text-gray-400">{loan.loan_number}</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">{loan.loan_type_name}</h3>
            <p className="text-xs text-gray-500 mt-1">{loan.purpose}</p>
          </div>
          <div className="flex items-center gap-6 flex-shrink-0">
            <div className="text-right">
              <p className="text-sm font-bold text-gray-900">
                {formatCurrency(loan.outstanding_balance)}
              </p>
              <p className="text-xs text-gray-400">Outstanding</p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-700">
                {formatCurrency(loan.monthly_installment)}
              </p>
              <p className="text-xs text-gray-400">Monthly</p>
            </div>
            {isExpanded ? (
              <ChevronUpIcon className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>

        {/* Progress bar */}
        {['ACTIVE', 'DISBURSED'].includes(loan.status) && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Repayment Progress</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-colors duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Expanded Detail */}
      {isExpanded && <LoanDetail loan={loan} />}
    </div>
  )
}

function LoanDetail({ loan }: { loan: LoanAccount }) {
  const { data: schedule = [], isLoading: loadingSchedule } = useQuery({
    queryKey: ['loan-schedule', loan.id],
    queryFn: () => benefitsService.getLoanSchedule(loan.id),
  })

  const { data: transactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: ['loan-transactions', loan.id],
    queryFn: () => benefitsService.getLoanTransactions(loan.id),
  })

  return (
    <div className="px-6 pb-4 bg-gray-50 border-t border-gray-100">
      {/* Loan Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
        <div>
          <p className="text-xs text-gray-500">Principal Amount</p>
          <p className="text-sm font-semibold text-gray-900">
            {formatCurrency(loan.principal_amount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Interest Rate</p>
          <p className="text-sm font-semibold text-gray-900">{loan.interest_rate}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Tenure</p>
          <p className="text-sm font-semibold text-gray-900">{loan.tenure_months} months</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total Interest</p>
          <p className="text-sm font-semibold text-gray-900">
            {formatCurrency(loan.total_interest)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total Amount</p>
          <p className="text-sm font-semibold text-gray-900">
            {formatCurrency(loan.total_amount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Amount Paid</p>
          <p className="text-sm font-semibold text-success-600">
            {formatCurrency(loan.principal_paid + loan.interest_paid)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Disbursed</p>
          <p className="text-sm text-gray-700">{formatDate(loan.disbursement_date)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Expected Completion</p>
          <p className="text-sm text-gray-700">{formatDate(loan.expected_completion_date)}</p>
        </div>
      </div>

      {/* Schedule & Transactions Tabs */}
      <div className="mt-4">
        <Tabs defaultValue="schedule">
          <TabsList>
            <TabsTrigger value="schedule">Repayment Schedule</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule">
            {loadingSchedule ? (
              <p className="py-4 text-sm text-gray-500">Loading schedule...</p>
            ) : schedule.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">No repayment schedule available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-4">#</th>
                      <th className="py-2 pr-4">Due Date</th>
                      <th className="py-2 pr-4 text-right">Principal</th>
                      <th className="py-2 pr-4 text-right">Interest</th>
                      <th className="py-2 pr-4 text-right">Total</th>
                      <th className="py-2 pr-4 text-right">Balance</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {schedule.map((row: LoanSchedule) => (
                      <tr key={row.id} className={row.is_paid ? 'text-gray-400' : ''}>
                        <td className="py-2 pr-4">{row.installment_number}</td>
                        <td className="py-2 pr-4">{formatDate(row.due_date)}</td>
                        <td className="py-2 pr-4 text-right">
                          {formatCurrency(row.principal_amount)}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {formatCurrency(row.interest_amount)}
                        </td>
                        <td className="py-2 pr-4 text-right font-medium">
                          {formatCurrency(row.total_amount)}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {formatCurrency(row.closing_balance)}
                        </td>
                        <td className="py-2">
                          {row.is_paid ? (
                            <Badge variant="success" size="xs">
                              Paid
                            </Badge>
                          ) : (
                            <Badge variant="default" size="xs">
                              Pending
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="transactions">
            {loadingTransactions ? (
              <p className="py-4 text-sm text-gray-500">Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">No transactions recorded yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4 text-right">Principal</th>
                      <th className="py-2 pr-4 text-right">Interest</th>
                      <th className="py-2 pr-4 text-right">Total</th>
                      <th className="py-2 pr-4 text-right">Balance After</th>
                      <th className="py-2">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map((tx: LoanTransaction) => (
                      <tr key={tx.id}>
                        <td className="py-2 pr-4">{formatDate(tx.transaction_date)}</td>
                        <td className="py-2 pr-4">
                          <Badge variant="info" size="xs">
                            {tx.transaction_type}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {formatCurrency(tx.principal_amount)}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {formatCurrency(tx.interest_amount)}
                        </td>
                        <td className="py-2 pr-4 text-right font-medium">
                          {formatCurrency(tx.total_amount)}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {formatCurrency(tx.balance_after)}
                        </td>
                        <td className="py-2 text-xs text-gray-400">
                          {tx.reference_number || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
