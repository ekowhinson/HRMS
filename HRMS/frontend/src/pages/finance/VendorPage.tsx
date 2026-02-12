import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline'
import { financeService } from '@/services/finance'
import type { Vendor, VendorInvoice, Payment, Account } from '@/services/finance'
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

interface VendorFormData {
  code: string
  name: string
  tax_id: string
  payment_terms_days: string
  default_expense_account: string
  contact_person: string
  contact_email: string
  contact_phone: string
  address: string
  bank_name: string
  bank_branch: string
  bank_account_number: string
  is_active: boolean
}

const defaultFormData: VendorFormData = {
  code: '',
  name: '',
  tax_id: '',
  payment_terms_days: '30',
  default_expense_account: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  bank_name: '',
  bank_branch: '',
  bank_account_number: '',
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

export default function VendorPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')

  // Modal/detail states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [formData, setFormData] = useState<VendorFormData>(defaultFormData)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [deleteConfirm, setDeleteConfirm] = useState<Vendor | null>(null)
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)

  // Queries
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendors', page, search],
    queryFn: () => financeService.getVendors({ page, search: search || undefined }),
  })

  const { data: accountsData } = useQuery({
    queryKey: ['finance-expense-accounts'],
    queryFn: () => financeService.getAccounts({ account_type: 'EXPENSE', is_active: true, page_size: 1000 }),
  })

  const { data: vendorInvoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['vendor-invoices', selectedVendor?.id],
    queryFn: () => financeService.getVendorInvoices({ vendor: selectedVendor!.id, page_size: 100 }),
    enabled: !!selectedVendor,
  })

  const { data: vendorPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['vendor-payments', selectedVendor?.id],
    queryFn: () => financeService.getPayments({ vendor: selectedVendor!.id, page_size: 100 }),
    enabled: !!selectedVendor,
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
    mutationFn: (data: Partial<Vendor>) => financeService.createVendor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      closeForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Vendor> }) =>
      financeService.updateVendor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeService.deleteVendor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      setDeleteConfirm(null)
      if (selectedVendor?.id === deleteConfirm?.id) setSelectedVendor(null)
    },
  })

  const openCreateForm = () => {
    setEditingVendor(null)
    setFormData(defaultFormData)
    setFormErrors({})
    setIsFormOpen(true)
  }

  const openEditForm = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setFormData({
      code: vendor.code,
      name: vendor.name,
      tax_id: vendor.tax_id || '',
      payment_terms_days: String(vendor.payment_terms_days),
      default_expense_account: vendor.default_expense_account || '',
      contact_person: vendor.contact_person || '',
      contact_email: vendor.contact_email || '',
      contact_phone: vendor.contact_phone || '',
      address: vendor.address || '',
      bank_name: vendor.bank_name || '',
      bank_branch: vendor.bank_branch || '',
      bank_account_number: vendor.bank_account_number || '',
      is_active: vendor.is_active,
    })
    setFormErrors({})
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingVendor(null)
    setFormData(defaultFormData)
    setFormErrors({})
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.code.trim()) errors.code = 'Vendor code is required'
    if (!formData.name.trim()) errors.name = 'Vendor name is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: Partial<Vendor> = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      tax_id: formData.tax_id.trim(),
      payment_terms_days: parseInt(formData.payment_terms_days) || 30,
      default_expense_account: formData.default_expense_account || undefined,
      contact_person: formData.contact_person.trim() || undefined,
      contact_email: formData.contact_email.trim() || undefined,
      contact_phone: formData.contact_phone.trim() || undefined,
      address: formData.address.trim() || undefined,
      bank_name: formData.bank_name.trim() || undefined,
      bank_branch: formData.bank_branch.trim() || undefined,
      bank_account_number: formData.bank_account_number.trim() || undefined,
      is_active: formData.is_active,
    }

    if (editingVendor) {
      updateMutation.mutate({ id: editingVendor.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending
  const saveError = createMutation.error || updateMutation.error

  const vendors = data?.results || []
  const totalItems = data?.count || 0
  const totalPages = Math.ceil(totalItems / pageSize)

  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (v: Vendor) => (
        <span className="text-sm font-mono text-gray-600">{v.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (v: Vendor) => (
        <button
          onClick={() => setSelectedVendor(v)}
          className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
        >
          {v.name}
        </button>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (v: Vendor) => (
        <div>
          {v.contact_person && <p className="text-sm text-gray-700">{v.contact_person}</p>}
          {v.contact_email && <p className="text-xs text-gray-500">{v.contact_email}</p>}
        </div>
      ),
    },
    {
      key: 'payment_terms',
      header: 'Terms',
      render: (v: Vendor) => (
        <span className="text-sm text-gray-700">{v.payment_terms_days} days</span>
      ),
    },
    {
      key: 'tax_id',
      header: 'Tax ID',
      render: (v: Vendor) => (
        <span className="text-sm text-gray-600">{v.tax_id || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (v: Vendor) => (
        <Badge variant={v.is_active ? 'success' : 'default'} size="sm" dot>
          {v.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (v: Vendor) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEditForm(v)}
            className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteConfirm(v)}
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
        title="Vendors"
        subtitle="Manage vendor master records and track invoices and payments"
        breadcrumbs={[
          { label: 'Finance', href: '/finance' },
          { label: 'Vendors' },
        ]}
        actions={
          <Button
            size="sm"
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={openCreateForm}
          >
            Add Vendor
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
              placeholder="Search vendors by code, name, or contact..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vendor List */}
        <div className={selectedVendor ? 'lg:col-span-1' : 'lg:col-span-3'}>
          <Card>
            {isError ? (
              <EmptyState
                type="error"
                title="Failed to load vendors"
                description={(error as any)?.message || 'An error occurred.'}
                action={{ label: 'Try Again', onClick: () => refetch() }}
              />
            ) : isLoading ? (
              <div className="p-4">
                <SkeletonTable rows={5} columns={selectedVendor ? 3 : 7} showHeader />
              </div>
            ) : vendors.length === 0 ? (
              <EmptyState
                type="data"
                title="No vendors found"
                description={
                  search
                    ? 'Try adjusting your search.'
                    : 'Add your first vendor to start managing payables.'
                }
                action={
                  search
                    ? { label: 'Clear Search', onClick: () => setSearch('') }
                    : { label: 'Add Vendor', onClick: openCreateForm }
                }
              />
            ) : selectedVendor ? (
              // Compact list when detail is shown
              <div className="divide-y divide-gray-100">
                {vendors.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVendor(v)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                      selectedVendor.id === v.id ? 'bg-primary-50 border-l-2 border-l-primary-500' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900">{v.name}</p>
                    <p className="text-xs text-gray-500">{v.code}</p>
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
                <Table data={vendors} columns={columns} striped />
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

        {/* Vendor Detail Panel */}
        {selectedVendor && (
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                      <BuildingStorefrontIcon className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <CardTitle>{selectedVendor.name}</CardTitle>
                      <p className="text-sm text-gray-500">{selectedVendor.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedVendor.is_active ? 'success' : 'default'} size="sm" dot>
                      {selectedVendor.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => openEditForm(selectedVendor)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedVendor(null)}>
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
                        <p className="text-xs text-gray-500">Tax ID</p>
                        <p className="text-sm text-gray-900">{selectedVendor.tax_id || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Payment Terms</p>
                        <p className="text-sm text-gray-900">{selectedVendor.payment_terms_days} days</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Contact Person</p>
                        <p className="text-sm text-gray-900">{selectedVendor.contact_person || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="text-sm text-gray-900">{selectedVendor.contact_email || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="text-sm text-gray-900">{selectedVendor.contact_phone || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Default Expense Account</p>
                        <p className="text-sm text-gray-900">{selectedVendor.default_expense_account_name || '-'}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs text-gray-500">Address</p>
                        <p className="text-sm text-gray-900">{selectedVendor.address || '-'}</p>
                      </div>
                      {(selectedVendor.bank_name || selectedVendor.bank_account_number) && (
                        <>
                          <div>
                            <p className="text-xs text-gray-500">Bank</p>
                            <p className="text-sm text-gray-900">
                              {selectedVendor.bank_name || '-'}
                              {selectedVendor.bank_branch ? ` (${selectedVendor.bank_branch})` : ''}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Bank Account</p>
                            <p className="text-sm text-gray-900">{selectedVendor.bank_account_number || '-'}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="invoices">
                    {invoicesLoading ? (
                      <SkeletonTable rows={3} columns={5} showHeader />
                    ) : (vendorInvoices?.results || []).length === 0 ? (
                      <EmptyState type="data" title="No invoices" description="No invoices found for this vendor." compact />
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
                            {(vendorInvoices?.results || []).map((inv: VendorInvoice) => (
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
                    ) : (vendorPayments?.results || []).length === 0 ? (
                      <EmptyState type="data" title="No payments" description="No payments found for this vendor." compact />
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
                            {(vendorPayments?.results || []).map((pmt: Payment) => (
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

      {/* Create/Edit Vendor Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingVendor ? 'Edit Vendor' : 'Add Vendor'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
              {(saveError as any)?.response?.data?.detail ||
                (saveError as any)?.response?.data?.code?.[0] ||
                'An error occurred while saving.'}
            </div>
          )}

          <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
            Basic Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Vendor Code"
              value={formData.code}
              onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
              error={formErrors.code}
              required
              placeholder="e.g., V001"
            />
            <Input
              label="Vendor Name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              error={formErrors.name}
              required
              placeholder="Company name"
            />
            <Input
              label="Tax ID"
              value={formData.tax_id}
              onChange={(e) => setFormData((prev) => ({ ...prev, tax_id: e.target.value }))}
              placeholder="Tax identification number"
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
              label="Default Expense Account"
              value={formData.default_expense_account}
              onChange={(e) => setFormData((prev) => ({ ...prev, default_expense_account: e.target.value }))}
              options={accountOptions}
              placeholder="Select account"
            />
          </div>

          <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 pt-2">
            Contact Information
          </h4>
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

          <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 pt-2">
            Bank Details
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Bank Name"
              value={formData.bank_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, bank_name: e.target.value }))}
              placeholder="Bank name"
            />
            <Input
              label="Branch"
              value={formData.bank_branch}
              onChange={(e) => setFormData((prev) => ({ ...prev, bank_branch: e.target.value }))}
              placeholder="Branch name"
            />
            <Input
              label="Account Number"
              value={formData.bank_account_number}
              onChange={(e) => setFormData((prev) => ({ ...prev, bank_account_number: e.target.value }))}
              placeholder="Account number"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-2">
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
              {editingVendor ? 'Update Vendor' : 'Add Vendor'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Vendor"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete vendor{' '}
          <span className="font-semibold">{deleteConfirm?.name}</span>?
          This will remove all associated records.
        </p>
        {deleteMutation.error && (
          <div className="mt-3 p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
            {(deleteMutation.error as any)?.response?.data?.detail || 'Cannot delete this vendor.'}
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
