import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  CheckIcon,
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
import Textarea from '@/components/ui/Textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { formatCurrency, formatDate } from '@/lib/utils'

// ==================== Types ====================

type NoteStatus = 'DRAFT' | 'APPROVED'
type NoteType = 'CREDIT' | 'DEBIT'

interface CreditDebitNote {
  id: string
  note_number: string
  note_type: NoteType
  amount: number | string
  status: NoteStatus
  invoice: string | null
  invoice_number?: string
  reason: string
  approved_by?: string
  approved_by_name?: string
  created_at: string
  updated_at?: string
}

// ==================== Form ====================

interface NoteFormData {
  note_type: NoteType
  amount: string
  invoice: string
  reason: string
}

const defaultFormData: NoteFormData = {
  note_type: 'CREDIT',
  amount: '',
  invoice: '',
  reason: '',
}

// ==================== Helpers ====================

function statusBadgeVariant(status: NoteStatus): 'default' | 'success' {
  switch (status) {
    case 'DRAFT': return 'default'
    case 'APPROVED': return 'success'
    default: return 'default'
  }
}

// ==================== Component ====================

export default function CreditDebitNotesPage() {
  const queryClient = useQueryClient()

  // Tab state
  const [activeTab, setActiveTab] = useState<NoteType>('CREDIT')

  // List state
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const pageSize = 20

  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState<NoteFormData>(defaultFormData)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // ==================== Queries ====================

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['finance-credit-debit-notes', activeTab, page, search],
    queryFn: () =>
      (financeService as any).getCreditDebitNotes({
        note_type: activeTab,
        page,
        search: search || undefined,
      }),
  })

  const { data: invoicesData } = useQuery({
    queryKey: ['finance-invoices-for-notes'],
    queryFn: () => (financeService as any).getInvoices({ page_size: 500 }),
  })

  const notes: CreditDebitNote[] = data?.results || []
  const totalItems = data?.count || 0
  const totalPages = Math.ceil(totalItems / pageSize)

  const invoiceOptions = [
    { value: '', label: 'None' },
    ...((invoicesData?.results || []).map((inv: any) => ({
      value: inv.id,
      label: `${inv.invoice_number || inv.id} - ${formatCurrency(Number(inv.total_amount || inv.amount || 0))}`,
    }))),
  ]

  // ==================== Mutations ====================

  const createMutation = useMutation({
    mutationFn: (data: Partial<CreditDebitNote>) =>
      (financeService as any).createCreditDebitNote(data),
    onSuccess: () => {
      toast.success('Note created successfully')
      queryClient.invalidateQueries({ queryKey: ['finance-credit-debit-notes'] })
      closeForm()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to create note')
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      (financeService as any).approveCreditDebitNote(id),
    onSuccess: () => {
      toast.success('Note approved')
      queryClient.invalidateQueries({ queryKey: ['finance-credit-debit-notes'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to approve note')
    },
  })

  // ==================== Handlers ====================

  const openForm = () => {
    setFormData({ ...defaultFormData, note_type: activeTab })
    setFormErrors({})
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setFormData(defaultFormData)
    setFormErrors({})
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0)
      errors.amount = 'A valid amount is required'
    if (!formData.reason.trim()) errors.reason = 'Reason is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: Partial<CreditDebitNote> = {
      note_type: formData.note_type,
      amount: formData.amount,
      invoice: formData.invoice || null,
      reason: formData.reason.trim(),
    }

    createMutation.mutate(payload)
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as NoteType)
    setPage(1)
    setSearch('')
  }

  // ==================== Table Columns ====================

  const columns = [
    {
      key: 'note_number',
      header: 'Note #',
      render: (note: CreditDebitNote) => (
        <span className="text-sm font-medium text-primary-600">{note.note_number}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (note: CreditDebitNote) => (
        <span className="text-sm font-semibold text-gray-900">
          {formatCurrency(Number(note.amount))}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (note: CreditDebitNote) => (
        <Badge variant={statusBadgeVariant(note.status)} size="xs" dot>
          {note.status}
        </Badge>
      ),
    },
    {
      key: 'invoice',
      header: 'Linked Invoice',
      render: (note: CreditDebitNote) => (
        <span className="text-sm text-gray-700">{note.invoice_number || '-'}</span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (note: CreditDebitNote) => (
        <span className="text-sm text-gray-700 truncate max-w-xs block">{note.reason || '-'}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (note: CreditDebitNote) => (
        <span className="text-sm text-gray-500">{formatDate(note.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (note: CreditDebitNote) => (
        <div className="flex items-center gap-1">
          {note.status === 'DRAFT' && (
            <Button
              variant="ghost"
              size="xs"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                approveMutation.mutate(note.id)
              }}
              isLoading={approveMutation.isPending}
              title="Approve"
            >
              <CheckIcon className="h-4 w-4 text-success-600" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  // ==================== Render ====================

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Credit & Debit Notes"
        subtitle="Manage credit notes and debit notes linked to invoices"
        breadcrumbs={[
          { label: 'Finance', href: '/finance' },
          { label: 'Credit & Debit Notes' },
        ]}
        actions={
          <Button
            size="sm"
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={openForm}
          >
            Create Note
          </Button>
        }
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="CREDIT">Credit Notes</TabsTrigger>
          <TabsTrigger value="DEBIT">Debit Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="CREDIT">
          {renderNotesContent()}
        </TabsContent>

        <TabsContent value="DEBIT">
          {renderNotesContent()}
        </TabsContent>
      </Tabs>

      {/* Create Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title="Create Note"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {createMutation.error && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
              {(createMutation.error as any)?.response?.data?.detail ||
                'An error occurred while creating the note.'}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Note Type"
              value={formData.note_type}
              onChange={(e) => setFormData((prev) => ({ ...prev, note_type: e.target.value as NoteType }))}
              options={[
                { value: 'CREDIT', label: 'Credit Note' },
                { value: 'DEBIT', label: 'Debit Note' },
              ]}
              required
            />
            <Input
              label="Amount"
              type="number"
              min="0.01"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
              error={formErrors.amount}
              required
              placeholder="0.00"
            />
          </div>

          <Select
            label="Linked Invoice"
            value={formData.invoice}
            onChange={(e) => setFormData((prev) => ({ ...prev, invoice: e.target.value }))}
            options={invoiceOptions}
            placeholder="Select invoice (optional)"
          />

          <Textarea
            label="Reason"
            value={formData.reason}
            onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
            error={formErrors.reason}
            required
            placeholder="Provide the reason for this note..."
            rows={3}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="outline" type="button" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Note
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )

  // ==================== Shared Content Renderer ====================

  function renderNotesContent() {
    return (
      <div className="space-y-4 mt-4">
        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="search"
                placeholder="Search by note number or reason..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Notes Table */}
        <Card>
          {isError ? (
            <EmptyState
              type="error"
              title="Failed to load notes"
              description={(error as any)?.message || 'An error occurred.'}
              action={{ label: 'Try Again', onClick: () => refetch() }}
            />
          ) : isLoading ? (
            <div className="p-4">
              <SkeletonTable rows={5} columns={7} showHeader />
            </div>
          ) : notes.length === 0 ? (
            <EmptyState
              type="data"
              title={`No ${activeTab.toLowerCase()} notes found`}
              description={
                search
                  ? 'Try adjusting your search.'
                  : `Create your first ${activeTab.toLowerCase()} note to get started.`
              }
              action={
                search
                  ? { label: 'Clear Search', onClick: () => { setSearch(''); setPage(1) } }
                  : { label: 'Create Note', onClick: openForm }
              }
            />
          ) : (
            <>
              <Table data={notes} columns={columns} striped />
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
    )
  }
}
