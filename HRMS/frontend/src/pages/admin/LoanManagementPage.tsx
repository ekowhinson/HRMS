import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  CreditCardIcon,
  CheckIcon,
  XMarkIcon,
  BanknotesIcon,
  EyeIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import { benefitsService } from '@/services/benefits'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import { formatCurrency } from '@/lib/utils'
import type { LoanAccount } from '@/types'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  pending: 'warning',
  approved: 'info',
  disbursed: 'success',
  repaying: 'success',
  completed: 'default',
  rejected: 'danger',
  defaulted: 'danger',
}

export default function LoanManagementPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('pending')
  const [selectedLoan, setSelectedLoan] = useState<LoanAccount | null>(null)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [approvalData, setApprovalData] = useState({
    approved_amount: '',
    interest_rate: '',
  })
  const [rejectReason, setRejectReason] = useState('')

  const { data: loans, isLoading } = useQuery({
    queryKey: ['all-loans', statusFilter],
    queryFn: () => benefitsService.getAllLoans({ status: statusFilter }),
  })

  const { data: loanTypes } = useQuery({
    queryKey: ['loan-types'],
    queryFn: benefitsService.getLoanTypes,
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { interest_rate: number; approved_amount: number } }) =>
      benefitsService.approveLoan(id, data),
    onSuccess: () => {
      toast.success('Loan approved successfully')
      queryClient.invalidateQueries({ queryKey: ['all-loans'] })
      setShowApproveModal(false)
      setSelectedLoan(null)
      setApprovalData({ approved_amount: '', interest_rate: '' })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to approve loan')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      benefitsService.rejectLoan(id, reason),
    onSuccess: () => {
      toast.success('Loan rejected')
      queryClient.invalidateQueries({ queryKey: ['all-loans'] })
      setShowRejectModal(false)
      setSelectedLoan(null)
      setRejectReason('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to reject loan')
    },
  })

  const disburseMutation = useMutation({
    mutationFn: (id: string) => benefitsService.disburseLoan(id),
    onSuccess: () => {
      toast.success('Loan disbursed successfully')
      queryClient.invalidateQueries({ queryKey: ['all-loans'] })
      setSelectedLoan(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to disburse loan')
    },
  })

  const handleApprove = () => {
    if (selectedLoan) {
      approveMutation.mutate({
        id: selectedLoan.id,
        data: {
          approved_amount: parseFloat(approvalData.approved_amount),
          interest_rate: parseFloat(approvalData.interest_rate),
        },
      })
    }
  }

  const handleReject = () => {
    if (selectedLoan && rejectReason) {
      rejectMutation.mutate({ id: selectedLoan.id, reason: rejectReason })
    }
  }

  const openApproveModal = (loan: LoanAccount) => {
    setSelectedLoan(loan)
    setApprovalData({
      approved_amount: loan.principal_amount?.toString() || '',
      interest_rate: loan.interest_rate?.toString() || '',
    })
    setShowApproveModal(true)
  }

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (loan: LoanAccount) => (
        <div className="flex items-center gap-3">
          <Avatar
            firstName={(loan as any).employee_name?.split(' ')[0]}
            lastName={(loan as any).employee_name?.split(' ')[1]}
            size="sm"
          />
          <div>
            <p className="font-medium text-gray-900">{(loan as any).employee_name}</p>
            <p className="text-xs text-gray-500">{loan.loan_number}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'loan_type',
      header: 'Type',
      render: (loan: LoanAccount) => (
        <span className="text-sm text-gray-700">{loan.loan_type_name}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (loan: LoanAccount) => (
        <div className="text-sm">
          <p className="font-medium text-gray-900">
            {formatCurrency(loan.principal_amount)}
          </p>
          {loan.status === 'repaying' && (
            <p className="text-xs text-gray-500">
              Balance: {formatCurrency(loan.outstanding_balance)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'interest',
      header: 'Interest',
      render: (loan: LoanAccount) => (
        <span className="text-sm text-gray-700">{loan.interest_rate}%</span>
      ),
    },
    {
      key: 'tenure',
      header: 'Tenure',
      render: (loan: LoanAccount) => (
        <span className="text-sm text-gray-700">
          {loan.payments_made || 0}/{loan.total_payments} months
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (loan: LoanAccount) => (
        <Badge variant={statusColors[loan.status] || 'default'}>
          {loan.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (loan: LoanAccount) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedLoan(loan)}
          >
            <EyeIcon className="h-4 w-4" />
          </Button>
          {loan.status === 'pending' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openApproveModal(loan)}
              >
                <CheckIcon className="h-4 w-4 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedLoan(loan)
                  setShowRejectModal(true)
                }}
              >
                <XMarkIcon className="h-4 w-4 text-red-600" />
              </Button>
            </>
          )}
          {loan.status === 'approved' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => disburseMutation.mutate(loan.id)}
            >
              <BanknotesIcon className="h-4 w-4 text-blue-600" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  // Calculate summary stats
  const stats = {
    pending: loans?.filter((l: LoanAccount) => l.status === 'pending').length || 0,
    totalDisbursed: loans?.filter((l: LoanAccount) => ['disbursed', 'repaying'].includes(l.status))
      .reduce((acc: number, l: LoanAccount) => acc + (l.principal_amount || 0), 0) || 0,
    totalOutstanding: loans?.filter((l: LoanAccount) => l.status === 'repaying')
      .reduce((acc: number, l: LoanAccount) => acc + (l.outstanding_balance || 0), 0) || 0,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loan Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and manage employee loan applications
          </p>
        </div>
        {stats.pending > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 rounded-lg">
            <CreditCardIcon className="h-5 w-5 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-700">
              {stats.pending} pending approval{stats.pending !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <CreditCardIcon className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Approvals</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
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
                <p className="text-sm text-gray-500">Total Disbursed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.totalDisbursed)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BanknotesIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Outstanding Balance</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.totalOutstanding)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'All Loans' },
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'disbursed', label: 'Disbursed' },
                { value: 'repaying', label: 'Repaying' },
                { value: 'completed', label: 'Completed' },
                { value: 'rejected', label: 'Rejected' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Loans Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CreditCardIcon className="h-5 w-5 mr-2 text-gray-500" />
            Loan Applications
          </CardTitle>
        </CardHeader>
        <Table
          data={loans || []}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No loan applications found"
        />
      </Card>

      {/* View Loan Modal */}
      <Modal
        isOpen={!!selectedLoan && !showApproveModal && !showRejectModal}
        onClose={() => setSelectedLoan(null)}
        title="Loan Details"
      >
        {selectedLoan && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar
                  firstName={(selectedLoan as any).employee_name?.split(' ')[0]}
                  lastName={(selectedLoan as any).employee_name?.split(' ')[1]}
                  size="lg"
                />
                <div>
                  <h3 className="font-medium text-gray-900">
                    {(selectedLoan as any).employee_name}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedLoan.loan_number}</p>
                </div>
              </div>
              <Badge variant={statusColors[selectedLoan.status]}>
                {selectedLoan.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Loan Type</p>
                <p className="font-medium">{selectedLoan.loan_type_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Interest Rate</p>
                <p className="font-medium">{selectedLoan.interest_rate}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Principal Amount</p>
                <p className="font-medium">{formatCurrency(selectedLoan.principal_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Monthly Payment</p>
                <p className="font-medium">{formatCurrency(selectedLoan.monthly_deduction)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Outstanding Balance</p>
                <p className="font-medium">{formatCurrency(selectedLoan.outstanding_balance)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payments</p>
                <p className="font-medium">
                  {selectedLoan.payments_made || 0} / {selectedLoan.total_payments}
                </p>
              </div>
            </div>

            {selectedLoan.status === 'pending' && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectModal(true)
                  }}
                >
                  <XMarkIcon className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button onClick={() => openApproveModal(selectedLoan)}>
                  <CheckIcon className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            )}

            {selectedLoan.status === 'approved' && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  onClick={() => disburseMutation.mutate(selectedLoan.id)}
                  isLoading={disburseMutation.isPending}
                >
                  <BanknotesIcon className="h-4 w-4 mr-2" />
                  Disburse Loan
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Approve Loan Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => {
          setShowApproveModal(false)
          setApprovalData({ approved_amount: '', interest_rate: '' })
        }}
        title="Approve Loan"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Review and confirm the loan approval details.
          </p>
          <Input
            label="Approved Amount (GHS)"
            type="number"
            value={approvalData.approved_amount}
            onChange={(e) =>
              setApprovalData({ ...approvalData, approved_amount: e.target.value })
            }
            required
          />
          <Input
            label="Interest Rate (%)"
            type="number"
            step="0.1"
            value={approvalData.interest_rate}
            onChange={(e) =>
              setApprovalData({ ...approvalData, interest_rate: e.target.value })
            }
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowApproveModal(false)
                setApprovalData({ approved_amount: '', interest_rate: '' })
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              isLoading={approveMutation.isPending}
              disabled={!approvalData.approved_amount || !approvalData.interest_rate}
            >
              Approve Loan
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Loan Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false)
          setRejectReason('')
        }}
        title="Reject Loan Application"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for rejecting this loan application.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rejection Reason
            </label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectModal(false)
                setRejectReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              isLoading={rejectMutation.isPending}
              disabled={!rejectReason}
            >
              Reject Application
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
