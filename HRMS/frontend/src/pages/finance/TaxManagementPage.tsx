import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { financeService } from '@/services/finance'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'

// ==================== Types ====================

interface TaxType {
  id: string
  code: string
  name: string
  rate: number | string
  is_compound: boolean
  effective_from: string
  effective_until: string | null
  account: string | null
  account_name?: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

// ==================== Form ====================

interface TaxFormData {
  code: string
  name: string
  rate: string
  is_compound: boolean
  effective_from: string
  effective_until: string
  account: string
}

const defaultFormData: TaxFormData = {
  code: '',
  name: '',
  rate: '',
  is_compound: false,
  effective_from: new Date().toISOString().split('T')[0],
  effective_until: '',
  account: '',
}

// ==================== Component ====================

export default function TaxManagementPage() {
  const queryClient = useQueryClient()

  // List state
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const pageSize = 20

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTax, setEditingTax] = useState<TaxType | null>(null)
  const [formData, setFormData] = useState<TaxFormData>(defaultFormData)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [deleteConfirm, setDeleteConfirm] = useState<TaxType | null>(null)

  // ==================== Queries ====================

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['finance-tax-types', page, search],
    queryFn: () =>
      (financeService as any).getTaxTypes({
        page,
        search: search || undefined,
      }),
  })

  const { data: accountsData } = useQuery({
    queryKey: ['finance-accounts-for-tax'],
    queryFn: () => financeService.getAccounts({ page_size: 500 }),
  })

  const taxTypes: TaxType[] = data?.results || []
  const totalItems = data?.count || 0
  const totalPages = Math.ceil(totalItems / pageSize)

  const accountOptions = [
    { value: '', label: 'None' },
    ...((accountsData?.results || []).map((a: any) => ({
      value: a.id,
      label: `${a.code} - ${a.name}`,
    }))),
  ]

  // ==================== Mutations ====================

  const createMutation = useMutation({
    mutationFn: (data: Partial<TaxType>) => (financeService as any).createTaxType(data),
    onSuccess: () => {
      toast.success('Tax type created successfully')
      queryClient.invalidateQueries({ queryKey: ['finance-tax-types'] })
      closeModal()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to create tax type')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TaxType> }) =>
      (financeService as any).updateTaxType(id, data),
    onSuccess: () => {
      toast.success('Tax type updated successfully')
      queryClient.invalidateQueries({ queryKey: ['finance-tax-types'] })
      closeModal()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to update tax type')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => (financeService as any).deleteTaxType(id),
    onSuccess: () => {
      toast.success('Tax type deleted')
      queryClient.invalidateQueries({ queryKey: ['finance-tax-types'] })
      setDeleteConfirm(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to delete tax type')
    },
  })

  // ==================== Handlers ====================

  const openCreateModal = () => {
    setEditingTax(null)
    setFormData(defaultFormData)
    setFormErrors({})
    setIsModalOpen(true)
  }

  const openEditModal = (tax: TaxType) => {
    setEditingTax(tax)
    setFormData({
      code: tax.code,
      name: tax.name,
      rate: String(tax.rate),
      is_compound: tax.is_compound,
      effective_from: tax.effective_from,
      effective_until: tax.effective_until || '',
      account: tax.account || '',
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingTax(null)
    setFormData(defaultFormData)
    setFormErrors({})
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.code.trim()) errors.code = 'Tax code is required'
    if (!formData.name.trim()) errors.name = 'Tax name is required'
    if (!formData.rate || isNaN(Number(formData.rate)) || Number(formData.rate) < 0)
      errors.rate = 'A valid rate is required'
    if (!formData.effective_from) errors.effective_from = 'Effective from date is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: Partial<TaxType> = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      rate: formData.rate,
      is_compound: formData.is_compound,
      effective_from: formData.effective_from,
      effective_until: formData.effective_until || null,
      account: formData.account || null,
    }

    if (editingTax) {
      updateMutation.mutate({ id: editingTax.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending
  const saveError = createMutation.error || updateMutation.error

  // ==================== Table Columns ====================

  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (tax: TaxType) => (
        <span className="text-sm font-mono font-medium text-gray-900">{tax.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (tax: TaxType) => (
        <span className="text-sm text-gray-900">{tax.name}</span>
      ),
    },
    {
      key: 'rate',
      header: 'Rate (%)',
      render: (tax: TaxType) => (
        <span className="text-sm font-medium text-gray-900">{Number(tax.rate).toFixed(2)}%</span>
      ),
    },
    {
      key: 'is_compound',
      header: 'Compound',
      render: (tax: TaxType) => (
        <Badge variant={tax.is_compound ? 'warning' : 'default'} size="xs">
          {tax.is_compound ? 'Yes' : 'No'}
        </Badge>
      ),
    },
    {
      key: 'effective_from',
      header: 'Effective From',
      render: (tax: TaxType) => (
        <span className="text-sm text-gray-700">
          {tax.effective_from ? new Date(tax.effective_from).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      key: 'effective_until',
      header: 'Effective Until',
      render: (tax: TaxType) => (
        <span className="text-sm text-gray-700">
          {tax.effective_until ? new Date(tax.effective_until).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (tax: TaxType) => (
        <Badge variant={tax.is_active ? 'success' : 'default'} size="xs" dot>
          {tax.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (tax: TaxType) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openEditModal(tax) }}
            className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
            title="Edit"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(tax) }}
            className="p-1.5 rounded-md text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  // ==================== Render ====================

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tax Management"
        subtitle="Configure and manage tax types and rates"
        breadcrumbs={[
          { label: 'Finance', href: '/finance' },
          { label: 'Tax Management' },
        ]}
        actions={
          <Button
            size="sm"
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={openCreateModal}
          >
            Add Tax Type
          </Button>
        }
      />

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search by code or name..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Types Table */}
      <Card>
        {isError ? (
          <EmptyState
            type="error"
            title="Failed to load tax types"
            description={(error as any)?.message || 'An error occurred.'}
            action={{ label: 'Try Again', onClick: () => refetch() }}
          />
        ) : isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} columns={8} showHeader />
          </div>
        ) : taxTypes.length === 0 ? (
          <EmptyState
            type="data"
            title="No tax types found"
            description={
              search
                ? 'Try adjusting your search criteria.'
                : 'Create your first tax type to get started.'
            }
            action={
              search
                ? { label: 'Clear Search', onClick: () => { setSearch(''); setPage(1) } }
                : { label: 'Add Tax Type', onClick: openCreateModal }
            }
          />
        ) : (
          <>
            <Table data={taxTypes} columns={columns} striped />
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

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingTax ? 'Edit Tax Type' : 'Create Tax Type'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-md text-sm text-danger-700">
              {(saveError as any)?.response?.data?.detail ||
                (saveError as any)?.response?.data?.non_field_errors?.[0] ||
                'An error occurred while saving.'}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tax Code"
              value={formData.code}
              onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
              error={formErrors.code}
              required
              placeholder="e.g., VAT"
            />
            <Input
              label="Tax Name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              error={formErrors.name}
              required
              placeholder="e.g., Value Added Tax"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Rate (%)"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={formData.rate}
              onChange={(e) => setFormData((prev) => ({ ...prev, rate: e.target.value }))}
              error={formErrors.rate}
              required
              placeholder="0.00"
            />
            <Select
              label="GL Account"
              value={formData.account}
              onChange={(e) => setFormData((prev) => ({ ...prev, account: e.target.value }))}
              options={accountOptions}
              placeholder="Select account"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Effective From"
              type="date"
              value={formData.effective_from}
              onChange={(e) => setFormData((prev) => ({ ...prev, effective_from: e.target.value }))}
              error={formErrors.effective_from}
              required
            />
            <Input
              label="Effective Until"
              type="date"
              value={formData.effective_until}
              onChange={(e) => setFormData((prev) => ({ ...prev, effective_until: e.target.value }))}
              placeholder="Leave blank for no end date"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_compound}
                onChange={(e) => setFormData((prev) => ({ ...prev, is_compound: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
              />
              <span className="text-sm text-gray-700">Compound Tax (calculated on top of other taxes)</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="outline" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {editingTax ? 'Update Tax Type' : 'Create Tax Type'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Tax Type"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete the tax type{' '}
          <span className="font-semibold">{deleteConfirm?.code} - {deleteConfirm?.name}</span>?
          This action cannot be undone.
        </p>
        {deleteMutation.error && (
          <div className="mt-3 p-3 bg-danger-50 border border-danger-200 rounded-md text-sm text-danger-700">
            {(deleteMutation.error as any)?.response?.data?.detail ||
              'Cannot delete this tax type. It may be in use.'}
          </div>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
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
