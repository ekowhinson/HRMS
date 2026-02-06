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
  PlusIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { benefitsService, LoanAccount, LoanType, LoanSummary } from '@/services/benefits'
import { employeeService } from '@/services/employees'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import { formatCurrency, formatDate } from '@/lib/utils'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  PENDING: 'warning',
  APPROVED: 'info',
  REJECTED: 'danger',
  DISBURSED: 'info',
  ACTIVE: 'success',
  COMPLETED: 'success',
  DEFAULTED: 'danger',
  WRITTEN_OFF: 'danger',
  CANCELLED: 'default',
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  DISBURSED: 'Disbursed',
  ACTIVE: 'Repaying',
  COMPLETED: 'Completed',
  DEFAULTED: 'Defaulted',
  WRITTEN_OFF: 'Written Off',
  CANCELLED: 'Cancelled',
}

export default function LoanManagementPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [selectedLoan, setSelectedLoan] = useState<LoanAccount | null>(null)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [newLoan, setNewLoan] = useState({
    employee: '',
    loan_type: '',
    principal_amount: '',
    tenure_months: '',
    purpose: '',
  })

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const { data: loans, isLoading } = useQuery({
    queryKey: ['all-loans', statusFilter],
    queryFn: () => benefitsService.getAllLoans({ status: statusFilter || undefined }),
  })

  const { data: loanTypes } = useQuery({
    queryKey: ['loan-types'],
    queryFn: benefitsService.getLoanTypes,
  })

  const { data: loanSummary } = useQuery<LoanSummary>({
    queryKey: ['loan-summary'],
    queryFn: benefitsService.getLoanSummary,
  })

  const { data: employees } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => employeeService.getAll({ employment_status: 'ACTIVE' }),
  })

  const createMutation = useMutation({
    mutationFn: (data: {
      employee: string
      loan_type: string
      principal_amount: number
      tenure_months: number
      purpose: string
    }) => benefitsService.createLoan(data),
    onSuccess: () => {
      toast.success('Loan application created successfully')
      queryClient.invalidateQueries({ queryKey: ['all-loans'] })
      queryClient.invalidateQueries({ queryKey: ['loan-summary'] })
      setShowCreateModal(false)
      setNewLoan({ employee: '', loan_type: '', principal_amount: '', tenure_months: '', purpose: '' })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create loan application')
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => benefitsService.approveLoan(id),
    onSuccess: () => {
      toast.success('Loan approved successfully')
      queryClient.invalidateQueries({ queryKey: ['all-loans'] })
      queryClient.invalidateQueries({ queryKey: ['loan-summary'] })
      setShowApproveModal(false)
      setSelectedLoan(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to approve loan')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      benefitsService.rejectLoan(id, reason),
    onSuccess: () => {
      toast.success('Loan rejected')
      queryClient.invalidateQueries({ queryKey: ['all-loans'] })
      queryClient.invalidateQueries({ queryKey: ['loan-summary'] })
      setShowRejectModal(false)
      setSelectedLoan(null)
      setRejectReason('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to reject loan')
    },
  })

  const disburseMutation = useMutation({
    mutationFn: (id: string) => benefitsService.disburseLoan(id),
    onSuccess: () => {
      toast.success('Loan disbursed successfully')
      queryClient.invalidateQueries({ queryKey: ['all-loans'] })
      queryClient.invalidateQueries({ queryKey: ['loan-summary'] })
      setSelectedLoan(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to disburse loan')
    },
  })

  const handleApprove = () => {
    if (selectedLoan) {
      approveMutation.mutate(selectedLoan.id)
    }
  }

  const handleReject = () => {
    if (selectedLoan && rejectReason) {
      rejectMutation.mutate({ id: selectedLoan.id, reason: rejectReason })
    }
  }

  const handleCreate = () => {
    if (newLoan.employee && newLoan.loan_type && newLoan.principal_amount && newLoan.tenure_months) {
      createMutation.mutate({
        employee: newLoan.employee,
        loan_type: newLoan.loan_type,
        principal_amount: parseFloat(newLoan.principal_amount),
        tenure_months: parseInt(newLoan.tenure_months),
        purpose: newLoan.purpose,
      })
    }
  }

  const openApproveModal = (loan: LoanAccount) => {
    setSelectedLoan(loan)
    setShowApproveModal(true)
  }

  // Get selected loan type for form validation
  const selectedLoanType = loanTypes?.find((lt: LoanType) => lt.id === newLoan.loan_type)

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (loan: LoanAccount) => (
        <div className="flex items-center gap-3">
          <Avatar
            firstName={loan.employee_name?.split(' ')[0]}
            lastName={loan.employee_name?.split(' ')[1]}
            size="sm"
          />
          <div>
            <p className="font-medium text-gray-900">{loan.employee_name}</p>
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
          {['ACTIVE', 'DISBURSED'].includes(loan.status) && loan.outstanding_balance > 0 && (
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
        <span className="text-sm text-gray-700">
          {loan.interest_rate > 0 ? `${loan.interest_rate}%` : 'Interest-free'}
        </span>
      ),
    },
    {
      key: 'tenure',
      header: 'Tenure',
      render: (loan: LoanAccount) => (
        <span className="text-sm text-gray-700">
          {loan.tenure_months} months
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (loan: LoanAccount) => (
        <Badge variant={statusColors[loan.status] || 'default'}>
          {statusLabels[loan.status] || loan.status}
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
            title="View Details"
          >
            <EyeIcon className="h-4 w-4" />
          </Button>
          {['PENDING', 'DRAFT'].includes(loan.status) && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openApproveModal(loan)}
                title="Approve"
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
                title="Reject"
              >
                <XMarkIcon className="h-4 w-4 text-red-600" />
              </Button>
            </>
          )}
          {loan.status === 'APPROVED' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => disburseMutation.mutate(loan.id)}
              title="Disburse"
            >
              <BanknotesIcon className="h-4 w-4 text-blue-600" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loan Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and manage employee loan applications
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loanSummary && loanSummary.pending_approval > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 rounded-lg">
              <CreditCardIcon className="h-5 w-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-700">
                {loanSummary.pending_approval} pending
              </span>
            </div>
          )}
          <Button onClick={() => setShowCreateModal(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            New Loan
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <DocumentTextIcon className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Loans</p>
                <p className="text-2xl font-bold text-gray-900">{loanSummary?.total_loans || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <CreditCardIcon className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Approval</p>
                <p className="text-2xl font-bold text-gray-900">{loanSummary?.pending_approval || 0}</p>
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
                  {formatCurrency(loanSummary?.total_disbursed || 0)}
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
                <p className="text-sm text-gray-500">Outstanding</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(loanSummary?.total_outstanding || 0)}
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
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              options={[
                { value: '', label: 'All Loans' },
                { value: 'DRAFT', label: 'Draft' },
                { value: 'PENDING', label: 'Pending Approval' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'DISBURSED', label: 'Disbursed' },
                { value: 'ACTIVE', label: 'Active (Repaying)' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'REJECTED', label: 'Rejected' },
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
          data={(loans || []).slice((currentPage - 1) * pageSize, currentPage * pageSize)}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No loan applications found"
        />
        {loans && loans.length > pageSize && (
          <TablePagination
            currentPage={currentPage}
            totalPages={Math.ceil(loans.length / pageSize)}
            totalItems={loans.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        )}
      </Card>

      {/* View Loan Modal */}
      <Modal
        isOpen={!!selectedLoan && !showApproveModal && !showRejectModal}
        onClose={() => setSelectedLoan(null)}
        title="Loan Details"
        size="lg"
      >
        {selectedLoan && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar
                  firstName={selectedLoan.employee_name?.split(' ')[0]}
                  lastName={selectedLoan.employee_name?.split(' ')[1]}
                  size="lg"
                />
                <div>
                  <h3 className="font-medium text-gray-900">
                    {selectedLoan.employee_name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {selectedLoan.employee_number} • {selectedLoan.loan_number}
                  </p>
                </div>
              </div>
              <Badge variant={statusColors[selectedLoan.status]}>
                {statusLabels[selectedLoan.status]}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Loan Type</p>
                <p className="font-medium">{selectedLoan.loan_type_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Interest Rate</p>
                <p className="font-medium">
                  {selectedLoan.interest_rate > 0 ? `${selectedLoan.interest_rate}%` : 'Interest-free'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Principal Amount</p>
                <p className="font-medium">{formatCurrency(selectedLoan.principal_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Monthly Installment</p>
                <p className="font-medium">{formatCurrency(selectedLoan.monthly_installment)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="font-medium">{formatCurrency(selectedLoan.total_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Outstanding Balance</p>
                <p className="font-medium">{formatCurrency(selectedLoan.outstanding_balance)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tenure</p>
                <p className="font-medium">{selectedLoan.tenure_months} months</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Application Date</p>
                <p className="font-medium">{formatDate(selectedLoan.application_date)}</p>
              </div>
              {selectedLoan.disbursement_date && (
                <div>
                  <p className="text-sm text-gray-500">Disbursement Date</p>
                  <p className="font-medium">{formatDate(selectedLoan.disbursement_date)}</p>
                </div>
              )}
              {selectedLoan.first_deduction_date && (
                <div>
                  <p className="text-sm text-gray-500">First Deduction</p>
                  <p className="font-medium">{formatDate(selectedLoan.first_deduction_date)}</p>
                </div>
              )}
            </div>

            {selectedLoan.purpose && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Purpose</p>
                <p className="text-gray-700">{selectedLoan.purpose}</p>
              </div>
            )}

            {selectedLoan.rejection_reason && (
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm font-medium text-red-800">Rejection Reason</p>
                <p className="text-red-700">{selectedLoan.rejection_reason}</p>
              </div>
            )}

            {['PENDING', 'DRAFT'].includes(selectedLoan.status) && (
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

            {selectedLoan.status === 'APPROVED' && (
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

      {/* Create Loan Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setNewLoan({ employee: '', loan_type: '', principal_amount: '', tenure_months: '', purpose: '' })
        }}
        title="Create New Loan Application"
        size="lg"
      >
        <div className="space-y-4">
          <Select
            label="Employee"
            value={newLoan.employee}
            onChange={(e) => setNewLoan({ ...newLoan, employee: e.target.value })}
            options={[
              { value: '', label: 'Select Employee' },
              ...(employees?.results || []).map((emp: any) => ({
                value: emp.id,
                label: `${emp.employee_number} - ${emp.full_name}`,
              })),
            ]}
            required
          />
          <Select
            label="Loan Type"
            value={newLoan.loan_type}
            onChange={(e) => {
              const lt = loanTypes?.find((l: LoanType) => l.id === e.target.value)
              setNewLoan({
                ...newLoan,
                loan_type: e.target.value,
                tenure_months: lt ? lt.max_tenure_months.toString() : '',
              })
            }}
            options={[
              { value: '', label: 'Select Loan Type' },
              ...(loanTypes || []).map((lt: LoanType) => ({
                value: lt.id,
                label: `${lt.name} (${lt.interest_rate > 0 ? lt.interest_rate + '%' : 'No interest'}, up to ${lt.max_tenure_months} months)`,
              })),
            ]}
            required
          />
          {selectedLoanType && (
            <div className="p-3 bg-blue-50 rounded-lg text-sm">
              <p className="font-medium text-blue-800">{selectedLoanType.name}</p>
              <ul className="mt-1 text-blue-700 space-y-1">
                <li>• Max: {selectedLoanType.max_salary_multiplier}x {selectedLoanType.salary_component.toLowerCase()} salary</li>
                <li>• Tenure: {selectedLoanType.min_tenure_months} - {selectedLoanType.max_tenure_months} months</li>
                <li>• Interest: {selectedLoanType.interest_rate > 0 ? `${selectedLoanType.interest_rate}%` : 'Interest-free'}</li>
                {selectedLoanType.cooldown_months > 0 && (
                  <li>• Cooldown: {selectedLoanType.cooldown_months} months after completion</li>
                )}
              </ul>
            </div>
          )}
          <Input
            label="Principal Amount (GHS)"
            type="number"
            value={newLoan.principal_amount}
            onChange={(e) => setNewLoan({ ...newLoan, principal_amount: e.target.value })}
            required
          />
          <Input
            label="Tenure (Months)"
            type="number"
            value={newLoan.tenure_months}
            onChange={(e) => setNewLoan({ ...newLoan, tenure_months: e.target.value })}
            min={selectedLoanType?.min_tenure_months || 1}
            max={selectedLoanType?.max_tenure_months || 120}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purpose
            </label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              rows={3}
              value={newLoan.purpose}
              onChange={(e) => setNewLoan({ ...newLoan, purpose: e.target.value })}
              placeholder="Describe the purpose of this loan..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false)
                setNewLoan({ employee: '', loan_type: '', principal_amount: '', tenure_months: '', purpose: '' })
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              isLoading={createMutation.isPending}
              disabled={!newLoan.employee || !newLoan.loan_type || !newLoan.principal_amount || !newLoan.tenure_months}
            >
              Create Loan Application
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approve Loan Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => {
          setShowApproveModal(false)
        }}
        title="Approve Loan"
      >
        {selectedLoan && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Employee</p>
              <p className="font-medium">{selectedLoan.employee_name}</p>
              <p className="text-sm text-gray-500 mt-2">Loan Details</p>
              <p className="font-medium">
                {selectedLoan.loan_type_name} - {formatCurrency(selectedLoan.principal_amount)}
                over {selectedLoan.tenure_months} months
              </p>
              {selectedLoan.interest_rate > 0 && (
                <p className="text-sm text-gray-600">Interest Rate: {selectedLoan.interest_rate}%</p>
              )}
            </div>
            <p className="text-sm text-gray-600">
              Approving this loan will automatically generate a repayment schedule and
              {selectedLoan.loan_type_details?.auto_post_to_payroll
                ? ' create payroll deductions for the employee.'
                : ' the loan will be ready for disbursement.'}
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowApproveModal(false)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApprove}
                isLoading={approveMutation.isPending}
              >
                Approve Loan
              </Button>
            </div>
          </div>
        )}
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
