import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  ArrowUturnLeftIcon,
  TrashIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import { financeService } from '@/services/finance'
import type { JournalEntry, JournalLine, Account, FiscalPeriod } from '@/services/finance'
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
import { SkeletonTable } from '@/components/ui/Skeleton'
import { formatCurrency, formatDate } from '@/lib/utils'

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'REVERSED', label: 'Reversed' },
]

function statusBadgeVariant(status: string): 'default' | 'success' | 'danger' {
  switch (status) {
    case 'POSTED': return 'success'
    case 'REVERSED': return 'danger'
    default: return 'default'
  }
}

interface JournalLineForm {
  account: string
  description: string
  debit_amount: string
  credit_amount: string
  cost_center: string
  department: string
}

const emptyLine: JournalLineForm = {
  account: '',
  description: '',
  debit_amount: '',
  credit_amount: '',
  cost_center: '',
  department: '',
}

export default function JournalEntryPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [viewEntry, setViewEntry] = useState<JournalEntry | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: 'post' | 'reverse'; entry: JournalEntry } | null>(null)

  // Form state
  const [formDescription, setFormDescription] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formPeriod, setFormPeriod] = useState('')
  const [formSource, setFormSource] = useState('')
  const [formSourceRef, setFormSourceRef] = useState('')
  const [formLines, setFormLines] = useState<JournalLineForm[]>([{ ...emptyLine }, { ...emptyLine }])
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Queries
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['journal-entries', page, search, statusFilter, dateFrom, dateTo],
    queryFn: () =>
      financeService.getJournalEntries({
        page,
        search: search || undefined,
        status: statusFilter || undefined,
        journal_date_after: dateFrom || undefined,
        journal_date_before: dateTo || undefined,
      }),
  })

  const { data: accountsData } = useQuery({
    queryKey: ['finance-accounts-for-select'],
    queryFn: () => financeService.getAccounts({ is_header: false, is_active: true, page_size: 1000 }),
  })

  const { data: periodsData } = useQuery({
    queryKey: ['finance-periods-for-select'],
    queryFn: () => financeService.getFiscalPeriods({ is_closed: false, page_size: 100 }),
  })

  const accountOptions = useMemo(() => {
    const accs = accountsData?.results || []
    return accs.map((a: Account) => ({ value: a.id, label: `${a.code} - ${a.name}` }))
  }, [accountsData])

  const periodOptions = useMemo(() => {
    const periods = periodsData?.results || []
    return periods.map((p: FiscalPeriod) => ({ value: p.id, label: p.name }))
  }, [periodsData])

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<JournalEntry>) => financeService.createJournalEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      closeCreateModal()
    },
  })

  const postMutation = useMutation({
    mutationFn: (id: string) => financeService.postJournalEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      setConfirmAction(null)
    },
  })

  const reverseMutation = useMutation({
    mutationFn: (id: string) => financeService.reverseJournalEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      setConfirmAction(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeService.deleteJournalEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
    },
  })

  // Line management
  const addLine = () => {
    setFormLines((prev) => [...prev, { ...emptyLine }])
  }

  const removeLine = (index: number) => {
    if (formLines.length <= 2) return
    setFormLines((prev) => prev.filter((_, i) => i !== index))
  }

  const updateLine = (index: number, field: keyof JournalLineForm, value: string) => {
    setFormLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line
        const updated = { ...line, [field]: value }
        // Auto-clear opposite amount
        if (field === 'debit_amount' && value) updated.credit_amount = ''
        if (field === 'credit_amount' && value) updated.debit_amount = ''
        return updated
      })
    )
  }

  const totalDebit = formLines.reduce((sum, l) => sum + (parseFloat(l.debit_amount) || 0), 0)
  const totalCredit = formLines.reduce((sum, l) => sum + (parseFloat(l.credit_amount) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  const closeCreateModal = () => {
    setIsCreateOpen(false)
    setFormDescription('')
    setFormDate(new Date().toISOString().split('T')[0])
    setFormPeriod('')
    setFormSource('')
    setFormSourceRef('')
    setFormLines([{ ...emptyLine }, { ...emptyLine }])
    setFormErrors({})
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formDescription.trim()) errors.description = 'Description is required'
    if (!formDate) errors.date = 'Date is required'
    if (!formPeriod) errors.period = 'Fiscal period is required'

    const validLines = formLines.filter(
      (l) => l.account && (parseFloat(l.debit_amount) > 0 || parseFloat(l.credit_amount) > 0)
    )
    if (validLines.length < 2) errors.lines = 'At least 2 lines with amounts are required'
    if (!isBalanced) errors.balance = 'Total debits must equal total credits'

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const lines: Partial<JournalLine>[] = formLines
      .filter((l) => l.account && (parseFloat(l.debit_amount) > 0 || parseFloat(l.credit_amount) > 0))
      .map((l) => ({
        account: l.account,
        description: l.description,
        debit_amount: parseFloat(l.debit_amount) || 0,
        credit_amount: parseFloat(l.credit_amount) || 0,
        cost_center: l.cost_center || undefined,
        department: l.department || undefined,
      }))

    createMutation.mutate({
      journal_date: formDate,
      fiscal_period: formPeriod,
      description: formDescription.trim(),
      source: formSource.trim(),
      source_reference: formSourceRef.trim(),
      lines: lines as JournalLine[],
    })
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const entries = data?.results || []
  const totalItems = data?.count || 0
  const totalPages = Math.ceil(totalItems / pageSize)

  const columns = [
    {
      key: 'entry_number',
      header: 'Entry #',
      render: (entry: JournalEntry) => (
        <button
          onClick={() => setViewEntry(entry)}
          className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
        >
          {entry.entry_number}
        </button>
      ),
    },
    {
      key: 'journal_date',
      header: 'Date',
      render: (entry: JournalEntry) => (
        <span className="text-sm text-gray-700">{formatDate(entry.journal_date)}</span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (entry: JournalEntry) => (
        <span className="text-sm text-gray-700 line-clamp-1">{entry.description}</span>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (entry: JournalEntry) => (
        <span className="text-sm text-gray-500">{entry.source || '-'}</span>
      ),
    },
    {
      key: 'total_debit',
      header: 'Debit',
      render: (entry: JournalEntry) => (
        <span className="text-sm font-medium text-gray-900">
          {formatCurrency(Number(entry.total_debit))}
        </span>
      ),
    },
    {
      key: 'total_credit',
      header: 'Credit',
      render: (entry: JournalEntry) => (
        <span className="text-sm font-medium text-gray-900">
          {formatCurrency(Number(entry.total_credit))}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (entry: JournalEntry) => (
        <Badge variant={statusBadgeVariant(entry.status)} size="sm" dot>
          {entry.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (entry: JournalEntry) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewEntry(entry)}
            className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
            title="View"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          {entry.status === 'DRAFT' && (
            <>
              <button
                onClick={() => setConfirmAction({ type: 'post', entry })}
                className="p-1.5 rounded-md text-gray-400 hover:text-success-600 hover:bg-success-50 transition-colors"
                title="Post"
              >
                <CheckCircleIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteMutation.mutate(entry.id)}
                className="p-1.5 rounded-md text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                title="Delete"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </>
          )}
          {entry.status === 'POSTED' && (
            <button
              onClick={() => setConfirmAction({ type: 'reverse', entry })}
              className="p-1.5 rounded-md text-gray-400 hover:text-warning-600 hover:bg-warning-50 transition-colors"
              title="Reverse"
            >
              <ArrowUturnLeftIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Journal Entries"
        subtitle="Record and manage general ledger journal entries"
        breadcrumbs={[
          { label: 'Finance', href: '/finance' },
          { label: 'Journal Entries' },
        ]}
        actions={
          <Button
            size="sm"
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={() => setIsCreateOpen(true)}
          >
            New Journal Entry
          </Button>
        }
      />

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <form onSubmit={(e) => { e.preventDefault(); setPage(1) }} className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search by entry number or description..."
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
              {(statusFilter || dateFrom || dateTo) && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                  {[statusFilter, dateFrom, dateTo].filter(Boolean).length}
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                options={STATUS_OPTIONS}
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
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Journal Entries Table */}
      <Card>
        {isError ? (
          <EmptyState
            type="error"
            title="Failed to load journal entries"
            description={(error as any)?.message || 'An error occurred.'}
            action={{ label: 'Try Again', onClick: () => refetch() }}
          />
        ) : isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} columns={8} showHeader />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            type="data"
            title="No journal entries found"
            description={
              search || statusFilter || dateFrom || dateTo
                ? 'Try adjusting your search or filter criteria.'
                : 'Create your first journal entry to get started.'
            }
            action={
              search || statusFilter || dateFrom || dateTo
                ? { label: 'Clear Filters', onClick: clearFilters }
                : { label: 'New Journal Entry', onClick: () => setIsCreateOpen(true) }
            }
          />
        ) : (
          <>
            <Table data={entries} columns={columns} striped />
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

      {/* Create Journal Entry Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={closeCreateModal}
        title="New Journal Entry"
        size="xl"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {createMutation.error && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-md text-sm text-danger-700">
              {(createMutation.error as any)?.response?.data?.detail ||
                (createMutation.error as any)?.response?.data?.non_field_errors?.[0] ||
                'An error occurred while creating the journal entry.'}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Journal Date"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              error={formErrors.date}
              required
            />
            <Select
              label="Fiscal Period"
              value={formPeriod}
              onChange={(e) => setFormPeriod(e.target.value)}
              options={periodOptions}
              error={formErrors.period}
              required
              placeholder="Select period"
            />
            <Input
              label="Source"
              value={formSource}
              onChange={(e) => setFormSource(e.target.value)}
              placeholder="e.g., PAYROLL"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Textarea
              label="Description"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              error={formErrors.description}
              required
              rows={2}
              placeholder="Describe this journal entry..."
            />
            <Input
              label="Source Reference"
              value={formSourceRef}
              onChange={(e) => setFormSourceRef(e.target.value)}
              placeholder="e.g., PAY-2026-01"
            />
          </div>

          {/* Journal Lines */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">Journal Lines</h4>
              <Button variant="outline" size="xs" onClick={addLine} type="button">
                <PlusIcon className="w-3.5 h-3.5 mr-1" />
                Add Line
              </Button>
            </div>

            {formErrors.lines && (
              <p className="text-sm text-danger-600 mb-2">{formErrors.lines}</p>
            )}
            {formErrors.balance && (
              <p className="text-sm text-danger-600 mb-2">{formErrors.balance}</p>
            )}

            <div className="overflow-x-auto border border-gray-300 rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Account</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase w-32">Debit</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase w-32">Credit</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {formLines.map((line, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2">
                        <Select
                          value={line.account}
                          onChange={(e) => updateLine(index, 'account', e.target.value)}
                          options={accountOptions}
                          placeholder="Select account"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(index, 'description', e.target.value)}
                          placeholder="Line description"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debit_amount}
                          onChange={(e) => updateLine(index, 'debit_amount', e.target.value)}
                          placeholder="0.00"
                          className="text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.credit_amount}
                          onChange={(e) => updateLine(index, 'credit_amount', e.target.value)}
                          placeholder="0.00"
                          className="text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        {formLines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="p-1 rounded text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-right text-sm font-semibold text-gray-900">
                      Totals
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-semibold text-gray-900">
                      {formatCurrency(totalDebit)}
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-semibold text-gray-900">
                      {formatCurrency(totalCredit)}
                    </td>
                    <td className="px-3 py-2">
                      {totalDebit > 0 && totalCredit > 0 && (
                        isBalanced ? (
                          <CheckCircleIcon className="w-5 h-5 text-success-500" />
                        ) : (
                          <span className="text-xs text-danger-600 font-medium">
                            {formatCurrency(Math.abs(totalDebit - totalCredit))}
                          </span>
                        )
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="outline" type="button" onClick={closeCreateModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending} disabled={!isBalanced}>
              Create Entry
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Journal Entry Modal */}
      <Modal
        isOpen={!!viewEntry}
        onClose={() => setViewEntry(null)}
        title={`Journal Entry: ${viewEntry?.entry_number || ''}`}
        size="xl"
      >
        {viewEntry && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(viewEntry.journal_date)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Period</p>
                <p className="text-sm font-medium text-gray-900">{viewEntry.fiscal_period_name || viewEntry.fiscal_period}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <Badge variant={statusBadgeVariant(viewEntry.status)} size="sm" dot>
                  {viewEntry.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500">Source</p>
                <p className="text-sm font-medium text-gray-900">{viewEntry.source || '-'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">Description</p>
              <p className="text-sm text-gray-700">{viewEntry.description}</p>
            </div>
            {viewEntry.posted_by_name && (
              <div>
                <p className="text-xs text-gray-500">Posted By</p>
                <p className="text-sm text-gray-700">
                  {viewEntry.posted_by_name} on {viewEntry.posted_at ? formatDate(viewEntry.posted_at) : '-'}
                </p>
              </div>
            )}

            {viewEntry.lines && viewEntry.lines.length > 0 && (
              <div className="border border-gray-300 rounded-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Account</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Description</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Debit</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {viewEntry.lines.map((line, i) => (
                      <tr key={line.id || i}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {line.account_code ? `${line.account_code} - ` : ''}{line.account_name || line.account}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">{line.description || '-'}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                          {Number(line.debit_amount) > 0 ? formatCurrency(Number(line.debit_amount)) : '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                          {Number(line.credit_amount) > 0 ? formatCurrency(Number(line.credit_amount)) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={2} className="px-4 py-2 text-right text-sm font-semibold text-gray-900">Totals</td>
                      <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900">
                        {formatCurrency(Number(viewEntry.total_debit))}
                      </td>
                      <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900">
                        {formatCurrency(Number(viewEntry.total_credit))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button variant="outline" onClick={() => setViewEntry(null)}>
                Close
              </Button>
              {viewEntry.status === 'DRAFT' && (
                <Button
                  variant="success"
                  onClick={() => {
                    setViewEntry(null)
                    setConfirmAction({ type: 'post', entry: viewEntry })
                  }}
                  leftIcon={<CheckCircleIcon className="w-4 h-4" />}
                >
                  Post Entry
                </Button>
              )}
              {viewEntry.status === 'POSTED' && (
                <Button
                  variant="danger"
                  onClick={() => {
                    setViewEntry(null)
                    setConfirmAction({ type: 'reverse', entry: viewEntry })
                  }}
                  leftIcon={<ArrowUturnLeftIcon className="w-4 h-4" />}
                >
                  Reverse Entry
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Post/Reverse Confirmation Modal */}
      <Modal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.type === 'post' ? 'Post Journal Entry' : 'Reverse Journal Entry'}
        size="sm"
      >
        {confirmAction && (
          <div>
            <p className="text-sm text-gray-600">
              {confirmAction.type === 'post'
                ? `Are you sure you want to post entry ${confirmAction.entry.entry_number}? Once posted, it will affect account balances.`
                : `Are you sure you want to reverse entry ${confirmAction.entry.entry_number}? A reversing entry will be created.`}
            </p>
            {(postMutation.error || reverseMutation.error) && (
              <div className="mt-3 p-3 bg-danger-50 border border-danger-200 rounded-md text-sm text-danger-700">
                {((postMutation.error || reverseMutation.error) as any)?.response?.data?.detail ||
                  'An error occurred.'}
              </div>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setConfirmAction(null)}>
                Cancel
              </Button>
              <Button
                variant={confirmAction.type === 'post' ? 'success' : 'danger'}
                isLoading={postMutation.isPending || reverseMutation.isPending}
                onClick={() => {
                  if (confirmAction.type === 'post') {
                    postMutation.mutate(confirmAction.entry.id)
                  } else {
                    reverseMutation.mutate(confirmAction.entry.id)
                  }
                }}
              >
                {confirmAction.type === 'post' ? 'Post Entry' : 'Reverse Entry'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
