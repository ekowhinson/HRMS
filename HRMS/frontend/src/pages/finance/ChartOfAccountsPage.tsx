import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { financeService } from '@/services/finance'
import type { Account } from '@/services/finance'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/utils'

const ACCOUNT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'ASSET', label: 'Asset' },
  { value: 'LIABILITY', label: 'Liability' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'REVENUE', label: 'Revenue' },
  { value: 'EXPENSE', label: 'Expense' },
]

const ACCOUNT_TYPE_OPTIONS = ACCOUNT_TYPES.filter((t) => t.value !== '')

const NORMAL_BALANCE_OPTIONS = [
  { value: 'DEBIT', label: 'Debit' },
  { value: 'CREDIT', label: 'Credit' },
]

const CURRENCY_OPTIONS = [
  { value: 'GHS', label: 'GHS - Ghana Cedi' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
]

function accountTypeBadgeVariant(type: string): 'success' | 'info' | 'warning' | 'danger' | 'default' {
  switch (type) {
    case 'ASSET': return 'info'
    case 'LIABILITY': return 'warning'
    case 'EQUITY': return 'success'
    case 'REVENUE': return 'success'
    case 'EXPENSE': return 'danger'
    default: return 'default'
  }
}

interface AccountFormData {
  code: string
  name: string
  account_type: string
  parent: string
  is_header: boolean
  is_active: boolean
  currency: string
  normal_balance: string
}

const defaultFormData: AccountFormData = {
  code: '',
  name: '',
  account_type: '',
  parent: '',
  is_header: false,
  is_active: true,
  currency: 'GHS',
  normal_balance: 'DEBIT',
}

function buildTree(accounts: Account[]): Account[] {
  const map = new Map<string, Account>()
  const roots: Account[] = []

  accounts.forEach((acc) => {
    map.set(acc.id, { ...acc, children: [] })
  })

  accounts.forEach((acc) => {
    const node = map.get(acc.id)!
    if (acc.parent && map.has(acc.parent)) {
      map.get(acc.parent)!.children!.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
}

function flattenTree(nodes: Account[], depth = 0): (Account & { depth: number })[] {
  const result: (Account & { depth: number })[] = []
  nodes.forEach((node) => {
    result.push({ ...node, depth })
    if (node.children && node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1))
    }
  })
  return result
}

function AccountRow({
  account,
  expandedIds,
  onToggle,
  onEdit,
  onDelete,
}: {
  account: Account & { depth: number }
  expandedIds: Set<string>
  onToggle: (id: string) => void
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
}) {
  const hasChildren = account.children && account.children.length > 0
  const isExpanded = expandedIds.has(account.id)

  return (
    <tr className="hover:bg-gray-50/50 transition-colors duration-150">
      <td className="px-4 py-3.5 text-sm">
        <div className="flex items-center" style={{ paddingLeft: `${account.depth * 24}px` }}>
          {hasChildren ? (
            <button
              onClick={() => onToggle(account.id)}
              className="mr-2 p-0.5 rounded hover:bg-gray-200 transition-colors"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRightIcon className="w-4 h-4 text-gray-500" />
              )}
            </button>
          ) : (
            <span className="mr-2 w-5" />
          )}
          <span className="font-mono text-gray-600 mr-3">{account.code}</span>
          <span className={account.is_header ? 'font-semibold text-gray-900' : 'text-gray-700'}>
            {account.name}
          </span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-sm">
        <Badge variant={accountTypeBadgeVariant(account.account_type)} size="xs">
          {account.account_type}
        </Badge>
      </td>
      <td className="px-4 py-3.5 text-sm text-gray-600">
        {account.normal_balance}
      </td>
      <td className="px-4 py-3.5 text-sm text-gray-600">
        {account.currency}
      </td>
      <td className="px-4 py-3.5 text-sm">
        {account.is_header ? (
          <Badge variant="info" size="xs">Header</Badge>
        ) : account.balance !== undefined ? (
          <span className="font-medium text-gray-900">
            {formatCurrency(Number(account.balance), account.currency)}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3.5 text-sm">
        <Badge variant={account.is_active ? 'success' : 'default'} size="xs" dot>
          {account.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </td>
      <td className="px-4 py-3.5 text-sm">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(account)}
            className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
            title="Edit account"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          {!account.is_header && (
            <button
              onClick={() => onDelete(account)}
              className="p-1.5 rounded-md text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
              title="Delete account"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function ChartOfAccountsPage() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [formData, setFormData] = useState<AccountFormData>(defaultFormData)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [deleteConfirm, setDeleteConfirm] = useState<Account | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['finance-accounts', typeFilter],
    queryFn: () => financeService.getAccounts({ account_type: typeFilter || undefined, page_size: 1000 }),
  })

  const accounts = data?.results || []

  const tree = useMemo(() => buildTree(accounts), [accounts])
  const flatList = useMemo(() => flattenTree(tree), [tree])

  const filteredList = useMemo(() => {
    if (!search) return flatList
    const lower = search.toLowerCase()
    return flatList.filter(
      (a) =>
        a.code.toLowerCase().includes(lower) ||
        a.name.toLowerCase().includes(lower)
    )
  }, [flatList, search])

  const visibleList = useMemo(() => {
    if (search) return filteredList
    return filteredList.filter((account) => {
      if (account.depth === 0) return true
      // Check if all ancestors are expanded
      let parent = accounts.find((a) => a.id === account.parent)
      while (parent) {
        if (!expandedIds.has(parent.id)) return false
        parent = accounts.find((a) => a.id === parent!.parent)
      }
      return true
    })
  }, [filteredList, expandedIds, accounts, search])

  const parentOptions = useMemo(() => {
    const headerAccounts = accounts.filter((a) => a.is_header)
    return [
      { value: '', label: 'None (Root Level)' },
      ...headerAccounts.map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` })),
    ]
  }, [accounts])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    const ids = new Set(accounts.filter((a) => a.is_header || (a.children && a.children.length > 0)).map((a) => a.id))
    // Also expand accounts that have children in the flat list
    flatList.forEach((a) => {
      if (a.children && a.children.length > 0) {
        ids.add(a.id)
      }
    })
    setExpandedIds(ids)
  }, [accounts, flatList])

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set())
  }, [])

  const createMutation = useMutation({
    mutationFn: (data: Partial<Account>) => financeService.createAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-accounts'] })
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Account> }) =>
      financeService.updateAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-accounts'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeService.deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-accounts'] })
      setDeleteConfirm(null)
    },
  })

  const openCreateModal = () => {
    setEditingAccount(null)
    setFormData(defaultFormData)
    setFormErrors({})
    setIsModalOpen(true)
  }

  const openEditModal = (account: Account) => {
    setEditingAccount(account)
    setFormData({
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      parent: account.parent || '',
      is_header: account.is_header,
      is_active: account.is_active,
      currency: account.currency,
      normal_balance: account.normal_balance,
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingAccount(null)
    setFormData(defaultFormData)
    setFormErrors({})
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.code.trim()) errors.code = 'Account code is required'
    if (!formData.name.trim()) errors.name = 'Account name is required'
    if (!formData.account_type) errors.account_type = 'Account type is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: Partial<Account> = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      account_type: formData.account_type,
      parent: formData.parent || null,
      is_header: formData.is_header,
      is_active: formData.is_active,
      currency: formData.currency,
      normal_balance: formData.normal_balance as 'DEBIT' | 'CREDIT',
    }

    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending
  const saveError = createMutation.error || updateMutation.error

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Chart of Accounts"
        subtitle="Manage your organization's hierarchical account structure"
        breadcrumbs={[
          { label: 'Finance', href: '/finance' },
          { label: 'Chart of Accounts' },
        ]}
        actions={
          <Button
            size="sm"
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={openCreateModal}
          >
            Add Account
          </Button>
        }
      />

      {/* Filters */}
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
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full lg:w-48">
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                options={ACCOUNT_TYPES}
                placeholder="All Types"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Tree Table */}
      <Card>
        {isError ? (
          <EmptyState
            type="error"
            title="Failed to load accounts"
            description={(error as any)?.message || 'An error occurred while loading the chart of accounts.'}
            action={{ label: 'Try Again', onClick: () => refetch() }}
          />
        ) : isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={8} columns={7} showHeader />
          </div>
        ) : visibleList.length === 0 ? (
          <EmptyState
            type="data"
            title="No accounts found"
            description={
              search || typeFilter
                ? 'Try adjusting your search or filter criteria.'
                : 'Create your first account to set up the chart of accounts.'
            }
            action={
              search || typeFilter
                ? { label: 'Clear Filters', onClick: () => { setSearch(''); setTypeFilter('') } }
                : { label: 'Add Account', onClick: openCreateModal }
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Normal Balance
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Currency
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {visibleList.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    expandedIds={expandedIds}
                    onToggle={toggleExpand}
                    onEdit={openEditModal}
                    onDelete={setDeleteConfirm}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingAccount ? 'Edit Account' : 'Create Account'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
              {(saveError as any)?.response?.data?.detail ||
                (saveError as any)?.response?.data?.non_field_errors?.[0] ||
                'An error occurred while saving the account.'}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Account Code"
              value={formData.code}
              onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
              error={formErrors.code}
              required
              placeholder="e.g., 1000"
            />
            <Input
              label="Account Name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              error={formErrors.name}
              required
              placeholder="e.g., Cash and Cash Equivalents"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Account Type"
              value={formData.account_type}
              onChange={(e) => setFormData((prev) => ({ ...prev, account_type: e.target.value }))}
              options={ACCOUNT_TYPE_OPTIONS}
              error={formErrors.account_type}
              required
              placeholder="Select type"
            />
            <Select
              label="Parent Account"
              value={formData.parent}
              onChange={(e) => setFormData((prev) => ({ ...prev, parent: e.target.value }))}
              options={parentOptions}
              placeholder="None (Root Level)"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Normal Balance"
              value={formData.normal_balance}
              onChange={(e) => setFormData((prev) => ({ ...prev, normal_balance: e.target.value }))}
              options={NORMAL_BALANCE_OPTIONS}
            />
            <Select
              label="Currency"
              value={formData.currency}
              onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value }))}
              options={CURRENCY_OPTIONS}
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_header}
                onChange={(e) => setFormData((prev) => ({ ...prev, is_header: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Header Account (grouping only)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="outline" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {editingAccount ? 'Update Account' : 'Create Account'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Account"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete the account{' '}
          <span className="font-semibold">{deleteConfirm?.code} - {deleteConfirm?.name}</span>?
          This action cannot be undone.
        </p>
        {deleteMutation.error && (
          <div className="mt-3 p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
            {(deleteMutation.error as any)?.response?.data?.detail ||
              'Cannot delete this account. It may have associated transactions.'}
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
