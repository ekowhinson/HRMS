import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  GiftIcon,
  BanknotesIcon,
  PlusIcon,
  DocumentTextIcon,
  CreditCardIcon,
  HeartIcon,
  EyeIcon,
  AcademicCapIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline'
import { benefitsService, type LoanAccount, type BenefitClaim } from '@/services/benefits'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { formatCurrency } from '@/lib/utils'

const loanStatusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  PENDING: 'warning',
  APPROVED: 'info',
  REJECTED: 'danger',
  DISBURSED: 'success',
  ACTIVE: 'success',
  COMPLETED: 'default',
  DEFAULTED: 'danger',
}

const claimStatusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  PAID: 'success',
  CANCELLED: 'default',
}

export default function BenefitsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('loans')
  const [showLoanModal, setShowLoanModal] = useState(false)
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [showFuneralModal, setShowFuneralModal] = useState(false)
  const [showLensModal, setShowLensModal] = useState(false)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)

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
  const [funeralForm, setFuneralForm] = useState({
    grant_type: '',
    deceased_name: '',
    relationship: '',
    date_of_death: '',
    grant_amount: '',
  })
  const [lensForm, setLensForm] = useState({
    benefit: '',
    expense_date: '',
    claimed_amount: '',
    optical_provider: '',
    description: '',
  })
  const [subscriptionForm, setSubscriptionForm] = useState({
    subscription_type: '',
    professional_body: '',
    membership_number: '',
    subscription_period_start: '',
    subscription_period_end: '',
    claimed_amount: '',
  })

  // Pagination state
  const [loansPage, setLoansPage] = useState(1)
  const [claimsPage, setClaimsPage] = useState(1)
  const pageSize = 10

  // Queries
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

  // NHIA Benefit Queries
  const { data: funeralGrantTypes } = useQuery({
    queryKey: ['funeral-grant-types'],
    queryFn: benefitsService.getFuneralGrantTypes,
  })

  const { data: funeralEligibility } = useQuery({
    queryKey: ['funeral-eligibility'],
    queryFn: benefitsService.getFuneralGrantEligibility,
  })

  const { data: funeralClaims, isLoading: funeralLoading } = useQuery({
    queryKey: ['my-funeral-claims'],
    queryFn: benefitsService.getMyFuneralGrantClaims,
  })

  const { data: medicalLensBenefits } = useQuery({
    queryKey: ['medical-lens-benefits'],
    queryFn: benefitsService.getMedicalLensBenefits,
  })

  const { data: lensEligibility } = useQuery({
    queryKey: ['lens-eligibility'],
    queryFn: benefitsService.getMedicalLensEligibility,
  })

  const { data: lensClaims, isLoading: lensLoading } = useQuery({
    queryKey: ['my-lens-claims'],
    queryFn: benefitsService.getMyMedicalLensClaims,
  })

  const { data: subscriptionTypes } = useQuery({
    queryKey: ['subscription-types'],
    queryFn: benefitsService.getProfessionalSubscriptionTypes,
  })

  const { data: subscriptionEligibility } = useQuery({
    queryKey: ['subscription-eligibility'],
    queryFn: benefitsService.getProfessionalSubscriptionEligibility,
  })

  const { data: mySubscriptions, isLoading: subscriptionsLoading } = useQuery({
    queryKey: ['my-subscriptions'],
    queryFn: () => benefitsService.getMyProfessionalSubscriptions(),
  })

  // Third-party deductions
  const { data: myDeductions, isLoading: deductionsLoading } = useQuery({
    queryKey: ['my-third-party-deductions'],
    queryFn: benefitsService.getMyThirdPartyDeductions,
  })

  // Mutations
  const applyLoanMutation = useMutation({
    mutationFn: benefitsService.applyLoan,
    onSuccess: () => {
      toast.success('Loan application submitted')
      queryClient.invalidateQueries({ queryKey: ['my-loans'] })
      setShowLoanModal(false)
      setLoanForm({ loan_type: '', amount_requested: '', purpose: '', repayment_months: '' })
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
      setClaimForm({ benefit_type: '', amount: '', description: '' })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit claim')
    },
  })

  const submitFuneralClaimMutation = useMutation({
    mutationFn: benefitsService.createFuneralGrantClaim,
    onSuccess: () => {
      toast.success('Funeral grant claim submitted')
      queryClient.invalidateQueries({ queryKey: ['my-funeral-claims'] })
      setShowFuneralModal(false)
      setFuneralForm({ grant_type: '', deceased_name: '', relationship: '', date_of_death: '', grant_amount: '' })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit funeral grant claim')
    },
  })

  const submitLensClaimMutation = useMutation({
    mutationFn: benefitsService.createMedicalLensClaim,
    onSuccess: () => {
      toast.success('Medical lens claim submitted')
      queryClient.invalidateQueries({ queryKey: ['my-lens-claims'] })
      setShowLensModal(false)
      setLensForm({ benefit: '', expense_date: '', claimed_amount: '', optical_provider: '', description: '' })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit medical lens claim')
    },
  })

  const submitSubscriptionMutation = useMutation({
    mutationFn: benefitsService.createProfessionalSubscription,
    onSuccess: () => {
      toast.success('Professional subscription claim submitted')
      queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] })
      setShowSubscriptionModal(false)
      setSubscriptionForm({
        subscription_type: '', professional_body: '', membership_number: '',
        subscription_period_start: '', subscription_period_end: '', claimed_amount: ''
      })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit subscription claim')
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

  const handleFuneralSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitFuneralClaimMutation.mutate({
      grant_type: funeralForm.grant_type,
      deceased_name: funeralForm.deceased_name,
      relationship: funeralForm.relationship,
      date_of_death: funeralForm.date_of_death,
      grant_amount: parseFloat(funeralForm.grant_amount),
    })
  }

  const handleLensSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitLensClaimMutation.mutate({
      benefit: lensForm.benefit,
      expense_date: lensForm.expense_date,
      claimed_amount: parseFloat(lensForm.claimed_amount),
      optical_provider: lensForm.optical_provider,
      description: lensForm.description,
    })
  }

  const handleSubscriptionSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitSubscriptionMutation.mutate({
      subscription_type: subscriptionForm.subscription_type,
      professional_body: subscriptionForm.professional_body,
      membership_number: subscriptionForm.membership_number,
      subscription_period_start: subscriptionForm.subscription_period_start,
      subscription_period_end: subscriptionForm.subscription_period_end,
      claimed_amount: parseFloat(subscriptionForm.claimed_amount),
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
          <p className="text-xs text-gray-500">Balance: {formatCurrency(loan.outstanding_balance)}</p>
        </div>
      ),
    },
    {
      key: 'interest',
      header: 'Interest Rate',
      render: (loan: LoanAccount) => <span className="text-sm text-gray-700">{loan.interest_rate}%</span>,
    },
    {
      key: 'monthly',
      header: 'Monthly Payment',
      render: (loan: LoanAccount) => (
        <span className="text-sm text-gray-700">{formatCurrency(loan.monthly_installment)}</span>
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
        <span className="text-sm text-gray-700">{formatCurrency(claim.claimed_amount)}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (claim: BenefitClaim) => (
        <span className="text-sm text-gray-700">
          {new Date(claim.claim_date).toLocaleDateString()}
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
      if (loan.status === 'ACTIVE' || loan.status === 'DISBURSED') {
        acc.total += loan.principal_amount
        acc.outstanding += loan.outstanding_balance
        acc.monthly += loan.monthly_installment
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
            Manage your loans, benefit claims, and third-party deductions
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="loans">
            <CreditCardIcon className="h-4 w-4 mr-2" />
            Loans
          </TabsTrigger>
          <TabsTrigger value="benefits">
            <GiftIcon className="h-4 w-4 mr-2" />
            Benefits
          </TabsTrigger>
          <TabsTrigger value="nhia">
            <HeartIcon className="h-4 w-4 mr-2" />
            NHIA Benefits
          </TabsTrigger>
          <TabsTrigger value="deductions">
            <BuildingOfficeIcon className="h-4 w-4 mr-2" />
            Third-Party
          </TabsTrigger>
        </TabsList>

        {/* Loans Tab */}
        <TabsContent value="loans" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowLoanModal(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Apply for Loan
              </Button>
            </div>

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
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(loanSummary.total)}</p>
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
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(loanSummary.outstanding)}</p>
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
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(loanSummary.monthly)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

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
          </div>
        </TabsContent>

        {/* Benefits Tab */}
        <TabsContent value="benefits" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowClaimModal(true)}>
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                New Claim
              </Button>
            </div>

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
          </div>
        </TabsContent>

        {/* NHIA Benefits Tab */}
        <TabsContent value="nhia" className="mt-4">
          <div className="space-y-6">
            {/* Funeral Grants */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center">
                    <HeartIcon className="h-5 w-5 mr-2 text-gray-500" />
                    Funeral Grants
                  </CardTitle>
                  <Button size="sm" onClick={() => setShowFuneralModal(true)}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Claim
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Eligibility Summary */}
                {funeralEligibility && funeralEligibility.length > 0 && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Eligibility Status</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {funeralEligibility.map((item: any) => (
                        <div key={item.beneficiary_type} className="text-center p-2 bg-white rounded border">
                          <p className="text-xs text-gray-500">{item.beneficiary_type_display}</p>
                          <p className="text-sm font-medium">{formatCurrency(item.grant_amount)}</p>
                          <Badge variant={item.is_eligible ? 'success' : 'default'} className="mt-1">
                            {item.remaining} remaining
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Claims Table */}
                <Table
                  data={funeralClaims || []}
                  columns={[
                    { key: 'claim_number', header: 'Claim #', render: (c: any) => c.claim_number },
                    { key: 'deceased_name', header: 'Deceased', render: (c: any) => c.deceased_name },
                    { key: 'relationship', header: 'Relationship', render: (c: any) => c.relationship },
                    { key: 'amount', header: 'Amount', render: (c: any) => formatCurrency(c.grant_amount) },
                    { key: 'status', header: 'Status', render: (c: any) => <Badge variant={claimStatusColors[c.status] || 'default'}>{c.status}</Badge> },
                  ]}
                  isLoading={funeralLoading}
                  emptyMessage="No funeral grant claims"
                />
              </CardContent>
            </Card>

            {/* Medical Lens */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center">
                    <EyeIcon className="h-5 w-5 mr-2 text-gray-500" />
                    Medical Lens Benefit
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setShowLensModal(true)}
                    disabled={!lensEligibility?.is_eligible}
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Claim
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {lensEligibility && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Maximum Amount: <span className="font-medium">{formatCurrency(lensEligibility.max_amount)}</span></p>
                      <p className="text-sm text-gray-600">Eligible every {lensEligibility.eligibility_period_months} months</p>
                    </div>
                    <Badge variant={lensEligibility.is_eligible ? 'success' : 'warning'}>
                      {lensEligibility.is_eligible ? 'Eligible' : `Next eligible: ${lensEligibility.next_eligible_date || 'N/A'}`}
                    </Badge>
                  </div>
                )}

                <Table
                  data={lensClaims || []}
                  columns={[
                    { key: 'claim_number', header: 'Claim #', render: (c: any) => c.claim_number },
                    { key: 'expense_date', header: 'Expense Date', render: (c: any) => new Date(c.expense_date).toLocaleDateString() },
                    { key: 'optical_provider', header: 'Provider', render: (c: any) => c.optical_provider || '-' },
                    { key: 'amount', header: 'Amount', render: (c: any) => formatCurrency(c.claimed_amount) },
                    { key: 'status', header: 'Status', render: (c: any) => <Badge variant={claimStatusColors[c.status] || 'default'}>{c.status}</Badge> },
                  ]}
                  isLoading={lensLoading}
                  emptyMessage="No medical lens claims"
                />
              </CardContent>
            </Card>

            {/* Professional Subscriptions */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center">
                    <AcademicCapIcon className="h-5 w-5 mr-2 text-gray-500" />
                    Professional Subscriptions
                  </CardTitle>
                  <Button size="sm" onClick={() => setShowSubscriptionModal(true)}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Claim
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {subscriptionEligibility && subscriptionEligibility.length > 0 && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Subscription Types</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {subscriptionEligibility.map((item: any) => (
                        <div key={item.subscription_type_id} className="p-2 bg-white rounded border">
                          <p className="text-sm font-medium">{item.subscription_type}</p>
                          <p className="text-xs text-gray-500">Max: {formatCurrency(item.max_annual_amount)}/year</p>
                          <Badge variant={item.is_eligible ? 'success' : 'warning'} className="mt-1">
                            {item.is_eligible ? 'Available' : 'Claimed'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Table
                  data={mySubscriptions || []}
                  columns={[
                    { key: 'claim_number', header: 'Claim #', render: (c: any) => c.claim_number },
                    { key: 'professional_body', header: 'Professional Body', render: (c: any) => c.professional_body },
                    { key: 'claim_year', header: 'Year', render: (c: any) => c.claim_year },
                    { key: 'amount', header: 'Amount', render: (c: any) => formatCurrency(c.claimed_amount) },
                    { key: 'status', header: 'Status', render: (c: any) => <Badge variant={claimStatusColors[c.status] || 'default'}>{c.status}</Badge> },
                  ]}
                  isLoading={subscriptionsLoading}
                  emptyMessage="No professional subscription claims"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Third-Party Deductions Tab */}
        <TabsContent value="deductions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BuildingOfficeIcon className="h-5 w-5 mr-2 text-gray-500" />
                Third-Party Deductions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                View deductions made to third-party organizations (Credit Unions, Student Loans, Rent, etc.)
              </p>
              <Table
                data={myDeductions || []}
                columns={[
                  { key: 'lender_name', header: 'Organization', render: (d: any) => d.lender_name || d.lender },
                  { key: 'deduction_type', header: 'Type', render: (d: any) => d.deduction_type_display || d.deduction_type },
                  { key: 'amount', header: 'Amount', render: (d: any) => d.deduction_amount ? formatCurrency(d.deduction_amount) : `${d.deduction_percentage}%` },
                  { key: 'outstanding', header: 'Outstanding', render: (d: any) => d.outstanding_balance ? formatCurrency(d.outstanding_balance) : '-' },
                  { key: 'status', header: 'Status', render: (d: any) => <Badge variant={d.status === 'ACTIVE' ? 'success' : 'default'}>{d.status}</Badge> },
                ]}
                isLoading={deductionsLoading}
                emptyMessage="No third-party deductions"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Apply for Loan Modal */}
      <Modal isOpen={showLoanModal} onClose={() => setShowLoanModal(false)} title="Apply for Loan">
        <form onSubmit={handleLoanSubmit} className="space-y-4">
          <Select
            label="Loan Type"
            value={loanForm.loan_type}
            onChange={(e) => setLoanForm({ ...loanForm, loan_type: e.target.value })}
            options={loanTypes?.map((lt: any) => ({ value: lt.id, label: `${lt.name} (${lt.interest_rate}% interest)` })) || []}
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
            <Button type="button" variant="outline" onClick={() => setShowLoanModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={applyLoanMutation.isPending}>Submit Application</Button>
          </div>
        </form>
      </Modal>

      {/* Submit Benefit Claim Modal */}
      <Modal isOpen={showClaimModal} onClose={() => setShowClaimModal(false)} title="Submit Benefit Claim">
        <form onSubmit={handleClaimSubmit} className="space-y-4">
          <Select
            label="Benefit Type"
            value={claimForm.benefit_type}
            onChange={(e) => setClaimForm({ ...claimForm, benefit_type: e.target.value })}
            options={benefitTypes?.map((bt: any) => ({ value: bt.id, label: bt.name })) || []}
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
            <Button type="button" variant="outline" onClick={() => setShowClaimModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={submitClaimMutation.isPending}>Submit Claim</Button>
          </div>
        </form>
      </Modal>

      {/* Funeral Grant Claim Modal */}
      <Modal isOpen={showFuneralModal} onClose={() => setShowFuneralModal(false)} title="Funeral Grant Claim">
        <form onSubmit={handleFuneralSubmit} className="space-y-4">
          <Select
            label="Grant Type"
            value={funeralForm.grant_type}
            onChange={(e) => {
              const selected = funeralGrantTypes?.find((t: any) => t.id === e.target.value)
              setFuneralForm({
                ...funeralForm,
                grant_type: e.target.value,
                grant_amount: selected?.grant_amount?.toString() || '',
              })
            }}
            options={funeralGrantTypes?.filter((t: any) => t.is_active).map((t: any) => ({
              value: t.id,
              label: `${t.beneficiary_type_display} - ${formatCurrency(t.grant_amount)}`
            })) || []}
            placeholder="Select beneficiary type"
          />
          <Input
            label="Deceased Name"
            value={funeralForm.deceased_name}
            onChange={(e) => setFuneralForm({ ...funeralForm, deceased_name: e.target.value })}
            required
          />
          <Input
            label="Relationship"
            value={funeralForm.relationship}
            onChange={(e) => setFuneralForm({ ...funeralForm, relationship: e.target.value })}
            placeholder="e.g., Spouse, Child, Parent"
            required
          />
          <Input
            label="Date of Death"
            type="date"
            value={funeralForm.date_of_death}
            onChange={(e) => setFuneralForm({ ...funeralForm, date_of_death: e.target.value })}
            required
          />
          <Input
            label="Grant Amount (GHS)"
            type="number"
            value={funeralForm.grant_amount}
            onChange={(e) => setFuneralForm({ ...funeralForm, grant_amount: e.target.value })}
            disabled
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowFuneralModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={submitFuneralClaimMutation.isPending}>Submit Claim</Button>
          </div>
        </form>
      </Modal>

      {/* Medical Lens Claim Modal */}
      <Modal isOpen={showLensModal} onClose={() => setShowLensModal(false)} title="Medical Lens Claim">
        <form onSubmit={handleLensSubmit} className="space-y-4">
          <Select
            label="Benefit"
            value={lensForm.benefit}
            onChange={(e) => setLensForm({ ...lensForm, benefit: e.target.value })}
            options={medicalLensBenefits?.filter((b: any) => b.is_active).map((b: any) => ({
              value: b.id,
              label: `${b.name} - Max ${formatCurrency(b.max_amount)}`
            })) || []}
            placeholder="Select benefit"
          />
          <Input
            label="Expense Date"
            type="date"
            value={lensForm.expense_date}
            onChange={(e) => setLensForm({ ...lensForm, expense_date: e.target.value })}
            required
          />
          <Input
            label="Amount Claimed (GHS)"
            type="number"
            min="0"
            step="0.01"
            value={lensForm.claimed_amount}
            onChange={(e) => setLensForm({ ...lensForm, claimed_amount: e.target.value })}
            required
          />
          <Input
            label="Optical Provider"
            value={lensForm.optical_provider}
            onChange={(e) => setLensForm({ ...lensForm, optical_provider: e.target.value })}
            placeholder="Name of optical provider"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              rows={2}
              value={lensForm.description}
              onChange={(e) => setLensForm({ ...lensForm, description: e.target.value })}
              placeholder="Describe the expense..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowLensModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={submitLensClaimMutation.isPending}>Submit Claim</Button>
          </div>
        </form>
      </Modal>

      {/* Professional Subscription Modal */}
      <Modal isOpen={showSubscriptionModal} onClose={() => setShowSubscriptionModal(false)} title="Professional Subscription Claim">
        <form onSubmit={handleSubscriptionSubmit} className="space-y-4">
          <Select
            label="Subscription Type"
            value={subscriptionForm.subscription_type}
            onChange={(e) => setSubscriptionForm({ ...subscriptionForm, subscription_type: e.target.value })}
            options={subscriptionTypes?.filter((t: any) => t.is_active).map((t: any) => ({
              value: t.id,
              label: `${t.name} - Max ${formatCurrency(t.max_annual_amount)}`
            })) || []}
            placeholder="Select subscription type"
          />
          <Input
            label="Professional Body"
            value={subscriptionForm.professional_body}
            onChange={(e) => setSubscriptionForm({ ...subscriptionForm, professional_body: e.target.value })}
            placeholder="e.g., Ghana Medical Association"
            required
          />
          <Input
            label="Membership Number"
            value={subscriptionForm.membership_number}
            onChange={(e) => setSubscriptionForm({ ...subscriptionForm, membership_number: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Period Start"
              type="date"
              value={subscriptionForm.subscription_period_start}
              onChange={(e) => setSubscriptionForm({ ...subscriptionForm, subscription_period_start: e.target.value })}
              required
            />
            <Input
              label="Period End"
              type="date"
              value={subscriptionForm.subscription_period_end}
              onChange={(e) => setSubscriptionForm({ ...subscriptionForm, subscription_period_end: e.target.value })}
              required
            />
          </div>
          <Input
            label="Amount Claimed (GHS)"
            type="number"
            min="0"
            step="0.01"
            value={subscriptionForm.claimed_amount}
            onChange={(e) => setSubscriptionForm({ ...subscriptionForm, claimed_amount: e.target.value })}
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowSubscriptionModal(false)}>Cancel</Button>
            <Button type="submit" isLoading={submitSubscriptionMutation.isPending}>Submit Claim</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
