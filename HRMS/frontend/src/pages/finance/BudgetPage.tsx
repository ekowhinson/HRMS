import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { financeService } from '@/services/finance'
import type { Budget, BudgetCommitment, FiscalYear, Account } from '@/services/finance'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable, SkeletonStatsCard } from '@/components/ui/Skeleton'
import { StatsCard } from '@/components/ui/StatsCard'
import { BarChartCard, HorizontalProgressBar } from '@/components/charts'
import { formatCurrency } from '@/lib/utils'

const BUDGET_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REVISED', label: 'Revised' },
  { value: 'CLOSED', label: 'Closed' },
]

function budgetStatusVariant(status: string): 'default' | 'success' | 'warning' | 'info' {
  switch (status) {
    case 'APPROVED': return 'success'
    case 'REVISED': return 'warning'
    case 'CLOSED': return 'info'
    default: return 'default'
  }
}

function utilizationColor(pct: number): string {
  if (pct >= 100) return '#ef4444'
  if (pct >= 80) return '#f59e0b'
  return '#22c55e'
}

interface BudgetFormData {
  fiscal_year: string
  account: string
  cost_center: string
  department: string
  original_amount: string
  revised_amount: string
  status: string
}

const defaultBudgetForm: BudgetFormData = {
  fiscal_year: '',
  account: '',
  cost_center: '',
  department: '',
  original_amount: '',
  revised_amount: '',
  status: 'DRAFT',
}

export default function BudgetPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [formData, setFormData] = useState<BudgetFormData>(defaultBudgetForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [deleteConfirm, setDeleteConfirm] = useState<Budget | null>(null)

  // Commitment sub-section
  const [showCommitments, setShowCommitments] = useState<string | null>(null)

  // Queries
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['budgets', page, search, yearFilter, statusFilter],
    queryFn: () =>
      financeService.getBudgets({
        page,
        search: search || undefined,
        fiscal_year: yearFilter || undefined,
        status: statusFilter || undefined,
      }),
  })

  const { data: yearsData } = useQuery({
    queryKey: ['finance-fiscal-years'],
    queryFn: () => financeService.getFiscalYears({ page_size: 100 }),
  })

  const { data: accountsData } = useQuery({
    queryKey: ['finance-accounts-for-budget'],
    queryFn: () => financeService.getAccounts({ is_header: false, is_active: true, page_size: 1000 }),
  })

  const { data: commitmentsData, isLoading: commitmentsLoading } = useQuery({
    queryKey: ['budget-commitments', showCommitments],
    queryFn: () => financeService.getBudgetCommitments({ budget: showCommitments!, page_size: 100 }),
    enabled: !!showCommitments,
  })

  const yearOptions = useMemo(() => {
    const years = yearsData?.results || []
    return [
      { value: '', label: 'All Years' },
      ...years.map((y: FiscalYear) => ({ value: y.id, label: y.name })),
    ]
  }, [yearsData])

  const yearOptionsForForm = useMemo(() => {
    const years = yearsData?.results || []
    return years.map((y: FiscalYear) => ({ value: y.id, label: y.name }))
  }, [yearsData])

  const accountOptions = useMemo(() => {
    const accs = accountsData?.results || []
    return accs.map((a: Account) => ({ value: a.id, label: `${a.code} - ${a.name}` }))
  }, [accountsData])

  // Summary stats
  const budgets = data?.results || []
  const totalItems = data?.count || 0
  const totalPages = Math.ceil(totalItems / pageSize)

  const summaryStats = useMemo(() => {
    const totalOriginal = budgets.reduce((sum, b) => sum + Number(b.original_amount || 0), 0)
    const totalRevised = budgets.reduce((sum, b) => sum + Number(b.revised_amount || 0), 0)
    const totalActual = budgets.reduce((sum, b) => sum + Number(b.actual_amount || 0), 0)
    const avgUtilization = budgets.length > 0
      ? budgets.reduce((sum, b) => sum + (b.utilization_pct || 0), 0) / budgets.length
      : 0
    return { totalOriginal, totalRevised, totalActual, avgUtilization }
  }, [budgets])

  // Chart data for top budgets by utilization
  const chartData = useMemo(() => {
    return budgets
      .filter((b) => b.utilization_pct !== undefined)
      .sort((a, b) => (b.utilization_pct || 0) - (a.utilization_pct || 0))
      .slice(0, 8)
      .map((b) => ({
        name: b.account_name || b.account_code || 'Unknown',
        value: b.utilization_pct || 0,
        color: utilizationColor(b.utilization_pct || 0),
      }))
  }, [budgets])

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<Budget>) => financeService.createBudget(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Budget> }) =>
      financeService.updateBudget(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeService.deleteBudget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      setDeleteConfirm(null)
    },
  })

  const openCreateModal = () => {
    setEditingBudget(null)
    setFormData(defaultBudgetForm)
    setFormErrors({})
    setIsModalOpen(true)
  }

  const openEditModal = (budget: Budget) => {
    setEditingBudget(budget)
    setFormData({
      fiscal_year: budget.fiscal_year,
      account: budget.account,
      cost_center: budget.cost_center || '',
      department: budget.department || '',
      original_amount: String(budget.original_amount),
      revised_amount: String(budget.revised_amount),
      status: budget.status,
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingBudget(null)
    setFormData(defaultBudgetForm)
    setFormErrors({})
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.fiscal_year) errors.fiscal_year = 'Fiscal year is required'
    if (!formData.account) errors.account = 'Account is required'
    if (!formData.original_amount || isNaN(Number(formData.original_amount)))
      errors.original_amount = 'Valid amount is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: Partial<Budget> = {
      fiscal_year: formData.fiscal_year,
      account: formData.account,
      cost_center: formData.cost_center || undefined,
      department: formData.department || undefined,
      original_amount: formData.original_amount,
      revised_amount: formData.revised_amount || formData.original_amount,
      status: formData.status as Budget['status'],
    }

    if (editingBudget) {
      updateMutation.mutate({ id: editingBudget.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending
  const saveError = createMutation.error || updateMutation.error

  const clearFilters = () => {
    setSearch('')
    setYearFilter('')
    setStatusFilter('')
    setPage(1)
  }

  const columns = [
    {
      key: 'account',
      header: 'Account',
      render: (budget: Budget) => (
        <div>
          <p className="text-sm font-medium text-gray-900">
            {budget.account_code ? `${budget.account_code} - ` : ''}{budget.account_name || 'Unknown'}
          </p>
          {budget.department_name && (
            <p className="text-xs text-gray-500">{budget.department_name}</p>
          )}
        </div>
      ),
    },
    {
      key: 'fiscal_year',
      header: 'Fiscal Year',
      render: (budget: Budget) => (
        <span className="text-sm text-gray-700">{budget.fiscal_year_name || budget.fiscal_year}</span>
      ),
    },
    {
      key: 'original_amount',
      header: 'Original',
      render: (budget: Budget) => (
        <span className="text-sm font-medium text-gray-900">
          {formatCurrency(Number(budget.original_amount))}
        </span>
      ),
    },
    {
      key: 'revised_amount',
      header: 'Revised',
      render: (budget: Budget) => (
        <span className="text-sm font-medium text-gray-900">
          {formatCurrency(Number(budget.revised_amount))}
        </span>
      ),
    },
    {
      key: 'actual',
      header: 'Actual',
      render: (budget: Budget) => (
        <span className="text-sm font-medium text-gray-900">
          {budget.actual_amount !== undefined ? formatCurrency(Number(budget.actual_amount)) : '-'}
        </span>
      ),
    },
    {
      key: 'variance',
      header: 'Variance',
      render: (budget: Budget) => {
        if (budget.variance === undefined) return <span className="text-gray-400">-</span>
        const variance = Number(budget.variance)
        return (
          <span className={`text-sm font-medium ${variance >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
            {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
          </span>
        )
      },
    },
    {
      key: 'utilization',
      header: 'Utilization',
      render: (budget: Budget) => {
        const pct = budget.utilization_pct || 0
        return (
          <div className="w-28">
            <HorizontalProgressBar
              value={pct}
              max={100}
              color={utilizationColor(pct)}
              showValue
              height={6}
            />
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (budget: Budget) => (
        <Badge variant={budgetStatusVariant(budget.status)} size="sm" dot>
          {budget.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (budget: Budget) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowCommitments(showCommitments === budget.id ? null : budget.id)}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded hover:bg-primary-50 transition-colors"
          >
            Commitments
          </button>
          <button
            onClick={() => openEditModal(budget)}
            className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          {budget.status === 'DRAFT' && (
            <button
              onClick={() => setDeleteConfirm(budget)}
              className="p-1.5 rounded-md text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Budget Management"
        subtitle="Plan, track, and manage organizational budgets"
        breadcrumbs={[
          { label: 'Finance', href: '/finance' },
          { label: 'Budgets' },
        ]}
        actions={
          <Button
            size="sm"
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={openCreateModal}
          >
            Create Budget
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
            title="Total Budget"
            value={formatCurrency(summaryStats.totalOriginal)}
            variant="primary"
          />
          <StatsCard
            title="Revised Budget"
            value={formatCurrency(summaryStats.totalRevised)}
            variant="info"
          />
          <StatsCard
            title="Total Actual"
            value={formatCurrency(summaryStats.totalActual)}
            variant="warning"
          />
          <StatsCard
            title="Avg. Utilization"
            value={`${summaryStats.avgUtilization.toFixed(1)}%`}
            variant={summaryStats.avgUtilization > 90 ? 'danger' : 'success'}
          />
        </div>
      )}

      {/* Budget Utilization Chart */}
      {chartData.length > 0 && (
        <BarChartCard
          title="Budget Utilization by Account"
          subtitle="Top accounts by utilization percentage"
          data={chartData}
          height={250}
          layout="horizontal"
          valueFormatter={(v) => `${v.toFixed(1)}%`}
        />
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search budgets..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full lg:w-48">
              <Select
                value={yearFilter}
                onChange={(e) => { setYearFilter(e.target.value); setPage(1) }}
                options={yearOptions}
                placeholder="All Years"
              />
            </div>
            <div className="w-full lg:w-48">
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                options={BUDGET_STATUS_OPTIONS}
                placeholder="All Statuses"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Table */}
      <Card>
        {isError ? (
          <EmptyState
            type="error"
            title="Failed to load budgets"
            description={(error as any)?.message || 'An error occurred.'}
            action={{ label: 'Try Again', onClick: () => refetch() }}
          />
        ) : isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} columns={9} showHeader />
          </div>
        ) : budgets.length === 0 ? (
          <EmptyState
            type="data"
            title="No budgets found"
            description={
              search || yearFilter || statusFilter
                ? 'Try adjusting your filter criteria.'
                : 'Create your first budget to start tracking finances.'
            }
            action={
              search || yearFilter || statusFilter
                ? { label: 'Clear Filters', onClick: clearFilters }
                : { label: 'Create Budget', onClick: openCreateModal }
            }
          />
        ) : (
          <>
            <Table data={budgets} columns={columns} striped />
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

      {/* Commitments Panel */}
      {showCommitments && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Budget Commitments
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowCommitments(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {commitmentsLoading ? (
              <SkeletonTable rows={3} columns={5} showHeader />
            ) : (commitmentsData?.results || []).length === 0 ? (
              <EmptyState
                type="data"
                title="No commitments"
                description="No budget commitments have been recorded yet."
                compact
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Source</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Reference</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Amount</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {(commitmentsData?.results || []).map((c: BudgetCommitment) => (
                      <tr key={c.id}>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {new Date(c.commitment_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700">{c.source}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{c.source_reference}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                          {formatCurrency(Number(c.amount))}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <Badge variant="default" size="xs">{c.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingBudget ? 'Edit Budget' : 'Create Budget'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
              {(saveError as any)?.response?.data?.detail ||
                (saveError as any)?.response?.data?.non_field_errors?.[0] ||
                'An error occurred while saving.'}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Fiscal Year"
              value={formData.fiscal_year}
              onChange={(e) => setFormData((prev) => ({ ...prev, fiscal_year: e.target.value }))}
              options={yearOptionsForForm}
              error={formErrors.fiscal_year}
              required
              placeholder="Select year"
            />
            <Select
              label="Account"
              value={formData.account}
              onChange={(e) => setFormData((prev) => ({ ...prev, account: e.target.value }))}
              options={accountOptions}
              error={formErrors.account}
              required
              placeholder="Select account"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Department"
              value={formData.department}
              onChange={(e) => setFormData((prev) => ({ ...prev, department: e.target.value }))}
              placeholder="Department ID or name"
            />
            <Input
              label="Cost Center"
              value={formData.cost_center}
              onChange={(e) => setFormData((prev) => ({ ...prev, cost_center: e.target.value }))}
              placeholder="Cost center"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Original Amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.original_amount}
              onChange={(e) => setFormData((prev) => ({ ...prev, original_amount: e.target.value }))}
              error={formErrors.original_amount}
              required
              placeholder="0.00"
            />
            <Input
              label="Revised Amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.revised_amount}
              onChange={(e) => setFormData((prev) => ({ ...prev, revised_amount: e.target.value }))}
              placeholder="0.00 (defaults to original)"
            />
          </div>

          {editingBudget && (
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
              options={BUDGET_STATUS_OPTIONS.filter((o) => o.value !== '')}
            />
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="outline" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {editingBudget ? 'Update Budget' : 'Create Budget'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Budget"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this budget for{' '}
          <span className="font-semibold">{deleteConfirm?.account_name || 'this account'}</span>?
        </p>
        {deleteMutation.error && (
          <div className="mt-3 p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
            {(deleteMutation.error as any)?.response?.data?.detail || 'Cannot delete this budget.'}
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
