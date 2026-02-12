import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'
import { financeService } from '@/services/finance'
import type { Payment, Vendor, Customer, OrganizationBankAccount } from '@/services/finance'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import Textarea from '@/components/ui/Textarea'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable, SkeletonStatsCard } from '@/components/ui/Skeleton'
import { StatsCard } from '@/components/ui/StatsCard'
import { formatCurrency, formatDate } from '@/lib/utils'

const PAYMENT_METHOD_OPTIONS = [
  { value: '', label: 'All Methods' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHECK', label: 'Check' },
  { value: 'CASH', label: 'Cash' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'OTHER', label: 'Other' },
]

const PAYMENT_METHOD_FORM_OPTIONS = PAYMENT_METHOD_OPTIONS.filter((o) => o.value !== '')

function paymentMethodBadgeVariant(method: string): 'info' | 'success' | 'warning' | 'default' {
  switch (method) {
    case 'BANK_TRANSFER': return 'info'
    case 'CHECK': return 'warning'
    case 'MOBILE_MONEY': return 'success'
    default: return 'default'
  }
}

interface PaymentFormData {
  payment_date: string
  vendor: string
  customer: string
  amount: string
  payment_method: string
  bank_account: string
  reference: string
  description: string
}

const defaultFormData: PaymentFormData = {
  payment_date: new Date().toISOString().split('T')[0],
  vendor: '',
  customer: '',
  amount: '',
  payment_method: 'BANK_TRANSFER',
  bank_account: '',
  reference: '',
  description: '',
}

export default function PaymentsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [paymentType, setPaymentType] = useState<'vendor' | 'customer'>('vendor')

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState<PaymentFormData>(defaultFormData)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Queries
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['payments', page, search, methodFilter, dateFrom, dateTo],
    queryFn: () =>
      financeService.getPayments({
        page,
        search: search || undefined,
        payment_method: methodFilter || undefined,
        payment_date_after: dateFrom || undefined,
        payment_date_before: dateTo || undefined,
      }),
  })

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors-for-payment'],
    queryFn: () => financeService.getVendors({ is_active: true, page_size: 500 }),
  })

  const { data: customersData } = useQuery({
    queryKey: ['customers-for-payment'],
    queryFn: () => financeService.getCustomers({ is_active: true, page_size: 500 }),
  })

  const { data: bankAccountsData } = useQuery({
    queryKey: ['bank-accounts-for-payment'],
    queryFn: () => financeService.getBankAccounts({ is_active: true, page_size: 100 }),
  })

  const vendorOptions = useMemo(() => {
    const vendors = vendorsData?.results || []
    return [
      { value: '', label: 'None' },
      ...vendors.map((v: Vendor) => ({ value: v.id, label: `${v.code} - ${v.name}` })),
    ]
  }, [vendorsData])

  const customerOptions = useMemo(() => {
    const customers = customersData?.results || []
    return [
      { value: '', label: 'None' },
      ...customers.map((c: Customer) => ({ value: c.id, label: `${c.code} - ${c.name}` })),
    ]
  }, [customersData])

  const bankAccountOptions = useMemo(() => {
    const accounts = bankAccountsData?.results || []
    return [
      { value: '', label: 'None' },
      ...accounts.map((a: OrganizationBankAccount) => ({
        value: a.id,
        label: `${a.bank_name} - ${a.account_number} (${a.currency})`,
      })),
    ]
  }, [bankAccountsData])

  // Summary stats
  const payments = data?.results || []
  const totalItems = data?.count || 0
  const totalPages = Math.ceil(totalItems / pageSize)

  const summaryStats = useMemo(() => {
    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const vendorPayments = payments.filter((p) => p.vendor).length
    const customerPayments = payments.filter((p) => p.customer).length
    return { totalAmount, vendorPayments, customerPayments, total: payments.length }
  }, [payments])

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<Payment>) => financeService.createPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      closeForm()
    },
  })

  const openForm = () => {
    setFormData(defaultFormData)
    setFormErrors({})
    setPaymentType('vendor')
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setFormData(defaultFormData)
    setFormErrors({})
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.payment_date) errors.payment_date = 'Date is required'
    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0)
      errors.amount = 'Valid amount is required'
    if (!formData.payment_method) errors.payment_method = 'Payment method is required'
    if (paymentType === 'vendor' && !formData.vendor) errors.vendor = 'Vendor is required'
    if (paymentType === 'customer' && !formData.customer) errors.customer = 'Customer is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: Partial<Payment> = {
      payment_date: formData.payment_date,
      vendor: paymentType === 'vendor' ? formData.vendor || undefined : undefined,
      customer: paymentType === 'customer' ? formData.customer || undefined : undefined,
      amount: formData.amount,
      payment_method: formData.payment_method as Payment['payment_method'],
      bank_account: formData.bank_account || undefined,
      reference: formData.reference.trim(),
      description: formData.description.trim() || undefined,
    }

    createMutation.mutate(payload)
  }

  const clearFilters = () => {
    setSearch('')
    setMethodFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const columns = [
    {
      key: 'payment_number',
      header: 'Payment #',
      render: (p: Payment) => (
        <span className="text-sm font-medium text-gray-900">{p.payment_number}</span>
      ),
    },
    {
      key: 'payment_date',
      header: 'Date',
      render: (p: Payment) => (
        <span className="text-sm text-gray-700">{formatDate(p.payment_date)}</span>
      ),
    },
    {
      key: 'payee',
      header: 'Payee / Payer',
      render: (p: Payment) => (
        <div>
          <p className="text-sm font-medium text-gray-900">
            {p.vendor_name || p.customer_name || '-'}
          </p>
          <p className="text-xs text-gray-500">
            {p.vendor ? 'Vendor Payment' : p.customer ? 'Customer Receipt' : '-'}
          </p>
        </div>
      ),
    },
    {
      key: 'payment_method',
      header: 'Method',
      render: (p: Payment) => (
        <Badge variant={paymentMethodBadgeVariant(p.payment_method)} size="xs">
          {p.payment_method.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'bank_account',
      header: 'Bank Account',
      render: (p: Payment) => (
        <span className="text-sm text-gray-600">{p.bank_account_name || '-'}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (p: Payment) => (
        <span className="text-sm font-semibold text-gray-900">
          {formatCurrency(Number(p.amount))}
        </span>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (p: Payment) => (
        <span className="text-sm text-gray-600">{p.reference || '-'}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Payments"
        subtitle="Process and track vendor payments and customer receipts"
        breadcrumbs={[
          { label: 'Finance', href: '/finance' },
          { label: 'Payments' },
        ]}
        actions={
          <Button
            size="sm"
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={openForm}
          >
            Record Payment
          </Button>
        }
      />

      {/* Summary Stats */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStatsCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Payments"
            value={summaryStats.total}
            variant="primary"
            icon={<BanknotesIcon className="w-5 h-5" />}
          />
          <StatsCard
            title="Total Amount"
            value={formatCurrency(summaryStats.totalAmount)}
            variant="info"
          />
          <StatsCard
            title="Vendor Payments"
            value={summaryStats.vendorPayments}
            variant="warning"
          />
          <StatsCard
            title="Customer Receipts"
            value={summaryStats.customerPayments}
            variant="success"
          />
        </div>
      )}

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <form onSubmit={(e) => { e.preventDefault(); setPage(1) }} className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search by payment number, payee, or reference..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </form>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-primary-50 border-primary-200' : ''}
              leftIcon={<FunnelIcon className="w-4 h-4" />}
            >
              Filters
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
              <Select
                label="Payment Method"
                value={methodFilter}
                onChange={(e) => { setMethodFilter(e.target.value); setPage(1) }}
                options={PAYMENT_METHOD_OPTIONS}
              />
              <Input
                label="From Date"
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              />
              <Input
                label="To Date"
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              />
              <div className="sm:col-span-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>Clear Filters</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        {isError ? (
          <EmptyState
            type="error"
            title="Failed to load payments"
            description={(error as any)?.message || 'An error occurred.'}
            action={{ label: 'Try Again', onClick: () => refetch() }}
          />
        ) : isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} columns={7} showHeader />
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            type="data"
            title="No payments found"
            description={
              search || methodFilter || dateFrom || dateTo
                ? 'Try adjusting your filters.'
                : 'Record your first payment to get started.'
            }
            action={
              search || methodFilter || dateFrom || dateTo
                ? { label: 'Clear Filters', onClick: clearFilters }
                : { label: 'Record Payment', onClick: openForm }
            }
          />
        ) : (
          <>
            <Table data={payments} columns={columns} striped />
            {totalPages > 1 && (
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </Card>

      {/* Create Payment Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title="Record Payment"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {createMutation.error && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
              {(createMutation.error as any)?.response?.data?.detail ||
                'An error occurred while recording the payment.'}
            </div>
          )}

          {/* Payment Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentType"
                  checked={paymentType === 'vendor'}
                  onChange={() => {
                    setPaymentType('vendor')
                    setFormData((prev) => ({ ...prev, customer: '' }))
                  }}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Vendor Payment (Outgoing)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentType"
                  checked={paymentType === 'customer'}
                  onChange={() => {
                    setPaymentType('customer')
                    setFormData((prev) => ({ ...prev, vendor: '' }))
                  }}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Customer Receipt (Incoming)</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Payment Date"
              type="date"
              value={formData.payment_date}
              onChange={(e) => setFormData((prev) => ({ ...prev, payment_date: e.target.value }))}
              error={formErrors.payment_date}
              required
            />
            <Input
              label="Amount"
              type="number"
              step="0.01"
              min="0.01"
              value={formData.amount}
              onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
              error={formErrors.amount}
              required
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {paymentType === 'vendor' ? (
              <Select
                label="Vendor"
                value={formData.vendor}
                onChange={(e) => setFormData((prev) => ({ ...prev, vendor: e.target.value }))}
                options={vendorOptions}
                error={formErrors.vendor}
                required
                placeholder="Select vendor"
              />
            ) : (
              <Select
                label="Customer"
                value={formData.customer}
                onChange={(e) => setFormData((prev) => ({ ...prev, customer: e.target.value }))}
                options={customerOptions}
                error={formErrors.customer}
                required
                placeholder="Select customer"
              />
            )}
            <Select
              label="Payment Method"
              value={formData.payment_method}
              onChange={(e) => setFormData((prev) => ({ ...prev, payment_method: e.target.value }))}
              options={PAYMENT_METHOD_FORM_OPTIONS}
              error={formErrors.payment_method}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Bank Account"
              value={formData.bank_account}
              onChange={(e) => setFormData((prev) => ({ ...prev, bank_account: e.target.value }))}
              options={bankAccountOptions}
              placeholder="Select bank account"
            />
            <Input
              label="Reference"
              value={formData.reference}
              onChange={(e) => setFormData((prev) => ({ ...prev, reference: e.target.value }))}
              placeholder="Check number, transfer ID, etc."
            />
          </div>

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Optional notes about this payment..."
            rows={2}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="outline" type="button" onClick={closeForm}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Record Payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
