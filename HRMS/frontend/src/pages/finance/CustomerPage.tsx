import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { financeService } from '@/services/finance'
import type { Customer, CustomerInvoice, Payment, Account } from '@/services/finance'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { formatCurrency, formatDate } from '@/lib/utils'

interface CustomerFormData {
  code: string
  name: string
  payment_terms_days: string
  default_revenue_account: string
  contact_person: string
  contact_email: string
  contact_phone: string
  address: string
  is_active: boolean
}

const defaultFormData: CustomerFormData = {
  code: '',
  name: '',
  payment_terms_days: '30',
  default_revenue_account: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  is_active: true,
}

function invoiceStatusVariant(status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'PAID': return 'success'
    case 'PARTIALLY_PAID': return 'info'
    case 'APPROVED':
    case 'PENDING': return 'warning'
    case 'CANCELLED': return 'danger'
    default: return 'default'
  }
}

export default function CustomerPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')

  // Modal/detail states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState<CustomerFormData>(defaultFormData)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Queries
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['customers', page, search],
    queryFn: () => financeService.getCustomers({ page, search: search || undefined }),
  })

  const { data: accountsData } = useQuery({
    queryKey: ['finance-revenue-accounts'],
    queryFn: () => financeService.getAccounts({ account_type: 'REVENUE', is_active: true, page_size: 1000 }),
  })

  const { data: customerInvoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['customer-invoices', selectedCustomer?.id],
    queryFn: () => financeService.getCustomerInvoices({ customer: selectedCustomer!.id, page_size: 100 }),
    enabled: !!selectedCustomer,
  })

  const { data: customerPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['customer-payments', selectedCustomer?.id],
    queryFn: () => financeService.getPayments({ customer: selectedCustomer!.id, page_size: 100 }),
    enabled: !!selectedCustomer,
  })

  const accountOptions = useMemo(() => {
    const accs = accountsData?.results || []
    return [
      { value: '', label: 'None' },
      ...accs.map((a: Account) => ({ value: a.id, label: `${a.code} - ${a.name}` })),
    ]
  }, [accountsData])

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<Customer>) => financeService.createCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      closeForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Customer> }) =>
      financeService.updateCustomer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeService.deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setDeleteConfirm(null)
      if (selectedCustomer?.id === deleteConfirm?.id) setSelectedCustomer(null)
    },
  })

  const openCreateForm = () => {
    setEditingCustomer(null)
    setFormData(defaultFormData)
    setFormErrors({})
    setIsFormOpen(true)
  }

  const openEditForm = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      code: customer.code,
      name: customer.name,
      payment_terms_days: String(customer.payment_terms_days),
      default_revenue_account: customer.default_revenue_account || '',
      contact_person: customer.contact_person || '',
      contact_email: customer.contact_email || '',
      contact_phone: customer.contact_phone || '',
      address: customer.address || '',
      is_active: customer.is_active,
    })
    setFormErrors({})
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingCustomer(null)
    setFormData(defaultFormData)
    setFormErrors({})
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.code.trim()) errors.code = 'Customer code is required'
    if (!formData.name.trim()) errors.name = 'Customer name is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: Partial<Customer> = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      payment_terms_days: parseInt(formData.payment_terms_days) || 30,
      default_revenue_account: formData.default_revenue_account || undefined,
      contact_person: formData.contact_person.trim() || undefined,
      contact_email: formData.contact_email.trim() || undefined,
      contact_phone: formData.contact_phone.trim() || undefined,
      address: formData.address.trim() || undefined,
      is_active: formData.is_active,
    }

    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending
  const saveError = createMutation.error || updateMutation.error

  const customers = data?.results || []
  const totalItems = data?.count || 0
  const totalPages = Math.ceil(totalItems / pageSize)

  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (c: Customer) => (
        <span className="text-sm font-mono text-gray-600">{c.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (c: Customer) => (
        <button
          onClick={() => setSelectedCustomer(c)}
          className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
        >
          {c.name}
        </button>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (c: Customer) => (
        <div>
          {c.contact_person && <p className="text-sm text-gray-700">{c.contact_person}</p>}
          {c.contact_email && <p className="text-xs text-gray-500">{c.contact_email}</p>}
        </div>
      ),
    },
    {
      key: 'payment_terms',
      header: 'Terms',
      render: (c: Customer) => (
        <span className="text-sm text-gray-700">{c.payment_terms_days} days</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c: Customer) => (
        <Badge variant={c.is_active ? 'success' : 'default'} size="sm" dot>
          {c.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (c: Customer) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEditForm(c)}
            className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteConfirm(c)}
            className="p-1.5 rounded-md text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Customers"
        subtitle="Manage customer records and track receivables"
        breadcrumbs={[
          { label: 'Finance', href: '/finance' },
          { label: 'Customers' },
        ]}
        actions={
          <Button
            size="sm"
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={openCreateForm}
          >
            Add Customer
          </Button>
        }
      />

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="search"
              placeholder="Search customers by code, name, or contact..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer List */}
        <div className={selectedCustomer ? 'lg:col-span-1' : 'lg:col-span-3'}>
          <Card>
            {isError ? (
              <EmptyState
                type="error"
                title="Failed to load customers"
                description={(error as any)?.message || 'An error occurred.'}
                action={{ label: 'Try Again', onClick: () => refetch() }}
              />
            ) : isLoading ? (
              <div className="p-4">
                <SkeletonTable rows={5} columns={selectedCustomer ? 3 : 6} showHeader />
              </div>
            ) : customers.length === 0 ? (
              <EmptyState
                type="data"
                title="No customers found"
                description={
                  search
                    ? 'Try adjusting your search.'
                    : 'Add your first customer to start managing receivables.'
                }
                action={
                  search
                    ? { label: 'Clear Search', onClick: () => setSearch('') }
                    : { label: 'Add Customer', onClick: openCreateForm }
                }
              />
            ) : selectedCustomer ? (
              <div className="divide-y divide-gray-100">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCustomer(c)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                      selectedCustomer.id === c.id ? 'bg-primary-50 border-l-2 border-l-primary-500' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.code}</p>
                  </button>
                ))}
                {totalPages > 1 && (
                  <TablePagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    onPageChange={setPage}
                  />
                )}
              </div>
            ) : (
              <>
                <Table data={customers} columns={columns} striped />
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
        </div>

        {/* Customer Detail Panel */}
        {selectedCustomer && (
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                      <UserGroupIcon className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <CardTitle>{selectedCustomer.name}</CardTitle>
                      <p className="text-sm text-gray-500">{selectedCustomer.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedCustomer.is_active ? 'success' : 'default'} size="sm" dot>
                      {selectedCustomer.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => openEditForm(selectedCustomer)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="details">
                  <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="invoices">Invoices</TabsTrigger>
                    <TabsTrigger value="payments">Payments</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-gray-500">Payment Terms</p>
                        <p className="text-sm text-gray-900">{selectedCustomer.payment_terms_days} days</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Default Revenue Account</p>
                        <p className="text-sm text-gray-900">{selectedCustomer.default_revenue_account_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Contact Person</p>
                        <p className="text-sm text-gray-900">{selectedCustomer.contact_person || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="text-sm text-gray-900">{selectedCustomer.contact_email || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="text-sm text-gray-900">{selectedCustomer.contact_phone || '-'}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs text-gray-500">Address</p>
                        <p className="text-sm text-gray-900">{selectedCustomer.address || '-'}</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="invoices">
                    {invoicesLoading ? (
                      <SkeletonTable rows={3} columns={5} showHeader />
                    ) : (customerInvoices?.results || []).length === 0 ? (
                      <EmptyState type="data" title="No invoices" description="No invoices found for this customer." compact />
                    ) : (
                      <div className="overflow-x-auto border border-gray-200 rounded-lg mt-4">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Invoice #</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Date</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Due Date</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Amount</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Paid</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                            {(customerInvoices?.results || []).map((inv: CustomerInvoice) => (
                              <tr key={inv.id}>
                                <td className="px-4 py-2 text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">{formatDate(inv.invoice_date)}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">{formatDate(inv.due_date)}</td>
                                <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                                  {formatCurrency(Number(inv.total_amount))}
                                </td>
                                <td className="px-4 py-2 text-sm text-right text-gray-700">
                                  {formatCurrency(Number(inv.paid_amount))}
                                </td>
                                <td className="px-4 py-2">
                                  <Badge variant={invoiceStatusVariant(inv.status)} size="xs" dot>
                                    {inv.status.replace(/_/g, ' ')}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="payments">
                    {paymentsLoading ? (
                      <SkeletonTable rows={3} columns={4} showHeader />
                    ) : (customerPayments?.results || []).length === 0 ? (
                      <EmptyState type="data" title="No payments" description="No payments received from this customer." compact />
                    ) : (
                      <div className="overflow-x-auto border border-gray-200 rounded-lg mt-4">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Payment #</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Date</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Method</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Amount</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Reference</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                            {(customerPayments?.results || []).map((pmt: Payment) => (
                              <tr key={pmt.id}>
                                <td className="px-4 py-2 text-sm font-medium text-gray-900">{pmt.payment_number}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">{formatDate(pmt.payment_date)}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">{pmt.payment_method.replace(/_/g, ' ')}</td>
                                <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                                  {formatCurrency(Number(pmt.amount))}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600">{pmt.reference || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Create/Edit Customer Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
              {(saveError as any)?.response?.data?.detail ||
                (saveError as any)?.response?.data?.code?.[0] ||
                'An error occurred while saving.'}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Customer Code"
              value={formData.code}
              onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
              error={formErrors.code}
              required
              placeholder="e.g., C001"
            />
            <Input
              label="Customer Name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              error={formErrors.name}
              required
              placeholder="Company or individual name"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Payment Terms (Days)"
              type="number"
              min="0"
              value={formData.payment_terms_days}
              onChange={(e) => setFormData((prev) => ({ ...prev, payment_terms_days: e.target.value }))}
            />
            <Select
              label="Default Revenue Account"
              value={formData.default_revenue_account}
              onChange={(e) => setFormData((prev) => ({ ...prev, default_revenue_account: e.target.value }))}
              options={accountOptions}
              placeholder="Select account"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Contact Person"
              value={formData.contact_person}
              onChange={(e) => setFormData((prev) => ({ ...prev, contact_person: e.target.value }))}
              placeholder="Full name"
            />
            <Input
              label="Email"
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData((prev) => ({ ...prev, contact_email: e.target.value }))}
              placeholder="email@example.com"
            />
            <Input
              label="Phone"
              value={formData.contact_phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, contact_phone: e.target.value }))}
              placeholder="+233..."
            />
          </div>

          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="Full mailing address"
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="outline" type="button" onClick={closeForm}>Cancel</Button>
            <Button type="submit" isLoading={isSaving}>
              {editingCustomer ? 'Update Customer' : 'Add Customer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Customer"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete customer{' '}
          <span className="font-semibold">{deleteConfirm?.name}</span>?
        </p>
        {deleteMutation.error && (
          <div className="mt-3 p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
            {(deleteMutation.error as any)?.response?.data?.detail || 'Cannot delete this customer.'}
          </div>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button
            variant="danger"
            isLoading={deleteMutation.isPending}
            onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}
