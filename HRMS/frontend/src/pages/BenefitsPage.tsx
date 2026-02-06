import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  GiftIcon,
  BanknotesIcon,
  PlusIcon,
  DocumentTextIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline'
import { benefitsService } from '@/services/benefits'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils'
import type { LoanAccount, BenefitClaim } from '@/types'

const loanStatusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  pending: 'warning',
  approved: 'info',
  disbursed: 'success',
  repaying: 'success',
  completed: 'default',
  rejected: 'danger',
  defaulted: 'danger',
}

const claimStatusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  paid: 'success',
}

export default function BenefitsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'loans' | 'benefits'>('loans')
  const [showLoanModal, setShowLoanModal] = useState(false)
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [loanForm, setLoanForm] = useState({
    loan_type: '',
    amount_requested: '',
    purpose: '',
    repayment_months: '',
  })
  const [claimForm, setClaimForm] = useState({
    benefit_type: '',
    amount: '',
    description: '',
  })

  // Pagination state
  const [loansPage, setLoansPage] = useState(1)
  const [claimsPage, setClaimsPage] = useState(1)
  const pageSize = 10

  const { data: myLoans, isLoading: loansLoading } = useQuery({
    queryKey: ['my-loans'],
    queryFn: benefitsService.getMyLoans,
  })

  const { data: myClaims, isLoading: claimsLoading } = useQuery({
    queryKey: ['my-claims'],
    queryFn: benefitsService.getMyClaims,
  })

  const { data: loanTypes } = useQuery({
    queryKey: ['loan-types'],
    queryFn: benefitsService.getLoanTypes,
  })

  const { data: benefitTypes } = useQuery({
    queryKey: ['benefit-types'],
    queryFn: benefitsService.getBenefitTypes,
  })

  const applyLoanMutation = useMutation({
    mutationFn: benefitsService.applyLoan,
    onSuccess: () => {
      toast.success('Loan application submitted')
      queryClient.invalidateQueries({ queryKey: ['my-loans'] })
      setShowLoanModal(false)
      setLoanForm({
        loan_type: '',
        amount_requested: '',
        purpose: '',
        repayment_months: '',
      })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit loan application')
    },
  })

  const submitClaimMutation = useMutation({
    mutationFn: benefitsService.submitClaim,
    onSuccess: () => {
      toast.success('Claim submitted')
      queryClient.invalidateQueries({ queryKey: ['my-claims'] })
      setShowClaimModal(false)
      setClaimForm({
        benefit_type: '',
        amount: '',
        description: '',
      })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit claim')
    },
  })

  const handleLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    applyLoanMutation.mutate({
      ...loanForm,
      amount_requested: parseFloat(loanForm.amount_requested),
      repayment_months: parseInt(loanForm.repayment_months),
    })
  }

  const handleClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitClaimMutation.mutate({
      ...claimForm,
      amount: parseFloat(claimForm.amount),
    })
  }

  const loanColumns = [
    {
      key: 'loan_type',
      header: 'Loan Type',
      render: (loan: LoanAccount) => (
        <span className="text-sm font-medium text-gray-900">{loan.loan_type_name}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (loan: LoanAccount) => (
        <div className="text-sm">
          <p className="font-medium text-gray-900">{formatCurrency(loan.principal_amount)}</p>
          <p className="text-xs text-gray-500">
            Balance: {formatCurrency(loan.outstanding_balance)}
          </p>
        </div>
      ),
    },
    {
      key: 'interest',
      header: 'Interest Rate',
      render: (loan: LoanAccount) => (
        <span className="text-sm text-gray-700">{loan.interest_rate}%</span>
      ),
    },
    {
      key: 'monthly',
      header: 'Monthly Payment',
      render: (loan: LoanAccount) => (
        <span className="text-sm text-gray-700">{formatCurrency(loan.monthly_deduction)}</span>
      ),
    },
    {
      key: 'tenure',
      header: 'Tenure',
      render: (loan: LoanAccount) => (
        <span className="text-sm text-gray-700">
          {loan.payments_made}/{loan.total_payments} months
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (loan: LoanAccount) => (
        <Badge variant={loanStatusColors[loan.status] || 'default'}>
          {loan.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
  ]

  const claimColumns = [
    {
      key: 'benefit_type',
      header: 'Benefit Type',
      render: (claim: BenefitClaim) => (
        <span className="text-sm font-medium text-gray-900">{claim.benefit_type_name}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (claim: BenefitClaim) => (
        <span className="text-sm text-gray-700">{formatCurrency(claim.amount)}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (claim: BenefitClaim) => (
        <span className="text-sm text-gray-700">
          {new Date(claim.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (claim: BenefitClaim) => (
        <Badge variant={claimStatusColors[claim.status] || 'default'}>{claim.status}</Badge>
      ),
    },
  ]

  // Calculate loan summary
  const loanSummary = myLoans?.reduce(
    (acc: { total: number; outstanding: number; monthly: number }, loan: LoanAccount) => {
      if (loan.status === 'repaying' || loan.status === 'disbursed') {
        acc.total += loan.principal_amount
        acc.outstanding += loan.outstanding_balance
        acc.monthly += loan.monthly_deduction
      }
      return acc
    },
    { total: 0, outstanding: 0, monthly: 0 }
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Benefits & Loans</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your loans and benefit claims
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowClaimModal(true)}>
            <DocumentTextIcon className="h-4 w-4 mr-2" />
            New Claim
          </Button>
          <Button onClick={() => setShowLoanModal(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Apply for Loan
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('loans')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'loans'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <CreditCardIcon className="h-5 w-5" />
            Loans
          </button>
          <button
            onClick={() => setActiveTab('benefits')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'benefits'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <GiftIcon className="h-5 w-5" />
            Benefits
          </button>
        </nav>
      </div>

      {activeTab === 'loans' && (
        <>
          {/* Loan Summary Cards */}
          {loanSummary && (loanSummary.total > 0 || (myLoans?.length ?? 0) > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <BanknotesIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Borrowed</p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(loanSummary.total)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <BanknotesIcon className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Outstanding Balance</p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(loanSummary.outstanding)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <BanknotesIcon className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Monthly Deduction</p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(loanSummary.monthly)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Loans Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCardIcon className="h-5 w-5 mr-2 text-gray-500" />
                My Loans
              </CardTitle>
            </CardHeader>
            <Table
              data={(myLoans || []).slice((loansPage - 1) * pageSize, loansPage * pageSize)}
              columns={loanColumns}
              isLoading={loansLoading}
              emptyMessage="No loans found"
            />
            {myLoans && myLoans.length > pageSize && (
              <TablePagination
                currentPage={loansPage}
                totalPages={Math.ceil(myLoans.length / pageSize)}
                totalItems={myLoans.length}
                pageSize={pageSize}
                onPageChange={setLoansPage}
              />
            )}
          </Card>
        </>
      )}

      {activeTab === 'benefits' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <GiftIcon className="h-5 w-5 mr-2 text-gray-500" />
              My Benefit Claims
            </CardTitle>
          </CardHeader>
          <Table
            data={(myClaims || []).slice((claimsPage - 1) * pageSize, claimsPage * pageSize)}
            columns={claimColumns}
            isLoading={claimsLoading}
            emptyMessage="No claims found"
          />
          {myClaims && myClaims.length > pageSize && (
            <TablePagination
              currentPage={claimsPage}
              totalPages={Math.ceil(myClaims.length / pageSize)}
              totalItems={myClaims.length}
              pageSize={pageSize}
              onPageChange={setClaimsPage}
            />
          )}
        </Card>
      )}

      {/* Apply for Loan Modal */}
      <Modal
        isOpen={showLoanModal}
        onClose={() => setShowLoanModal(false)}
        title="Apply for Loan"
      >
        <form onSubmit={handleLoanSubmit} className="space-y-4">
          <Select
            label="Loan Type"
            value={loanForm.loan_type}
            onChange={(e) => setLoanForm({ ...loanForm, loan_type: e.target.value })}
            options={
              loanTypes?.map((lt: any) => ({
                value: lt.id,
                label: `${lt.name} (${lt.interest_rate}% interest)`,
              })) || []
            }
            placeholder="Select loan type"
          />

          <Input
            label="Amount Requested (GHS)"
            type="number"
            min="0"
            step="0.01"
            value={loanForm.amount_requested}
            onChange={(e) => setLoanForm({ ...loanForm, amount_requested: e.target.value })}
            required
          />

          <Input
            label="Repayment Period (Months)"
            type="number"
            min="1"
            max="60"
            value={loanForm.repayment_months}
            onChange={(e) => setLoanForm({ ...loanForm, repayment_months: e.target.value })}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              rows={3}
              value={loanForm.purpose}
              onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })}
              placeholder="Purpose of loan..."
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowLoanModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={applyLoanMutation.isPending}>
              Submit Application
            </Button>
          </div>
        </form>
      </Modal>

      {/* Submit Claim Modal */}
      <Modal
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        title="Submit Benefit Claim"
      >
        <form onSubmit={handleClaimSubmit} className="space-y-4">
          <Select
            label="Benefit Type"
            value={claimForm.benefit_type}
            onChange={(e) => setClaimForm({ ...claimForm, benefit_type: e.target.value })}
            options={
              benefitTypes?.map((bt: any) => ({
                value: bt.id,
                label: bt.name,
              })) || []
            }
            placeholder="Select benefit type"
          />

          <Input
            label="Amount (GHS)"
            type="number"
            min="0"
            step="0.01"
            value={claimForm.amount}
            onChange={(e) => setClaimForm({ ...claimForm, amount: e.target.value })}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              rows={3}
              value={claimForm.description}
              onChange={(e) => setClaimForm({ ...claimForm, description: e.target.value })}
              placeholder="Describe your claim..."
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowClaimModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submitClaimMutation.isPending}>
              Submit Claim
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
