import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  PencilSquareIcon,
  ClockIcon,
  GlobeAltIcon,
  LockClosedIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'
import {
  PageHeader,
  Button,
  Card,
  CardContent,
  Badge,
  Modal,
  EmptyState,
  Skeleton,
} from '@/components/ui'
import { DropdownMenu } from '@/components/ui/Dropdown'
import { TablePagination } from '@/components/ui/Table'
import { useClientPagination } from '@/hooks/useClientPagination'
import reportBuilderService, { type ReportDefinition } from '@/services/reportBuilder'

type ViewFilter = 'all' | 'mine' | 'public'

export default function SavedReportsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [deleteTarget, setDeleteTarget] = useState<ReportDefinition | null>(null)

  // ==================== Queries ====================

  const {
    data: reports = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['report-builder', 'saved'],
    queryFn: () => reportBuilderService.listSavedReports(),
  })

  // ==================== Mutations ====================

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportBuilderService.deleteSavedReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-builder', 'saved'] })
      setDeleteTarget(null)
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => reportBuilderService.duplicateSavedReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-builder', 'saved'] })
    },
  })

  // ==================== Filtering ====================

  const filteredReports = useMemo(() => {
    let result = reports

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.data_source.toLowerCase().includes(q)
      )
    }

    if (viewFilter === 'public') {
      result = result.filter((r) => r.is_public)
    } else if (viewFilter === 'mine') {
      result = result.filter((r) => !r.is_public)
    }

    return result
  }, [reports, search, viewFilter])

  // ==================== Pagination ====================

  const { paged: paginatedReports, currentPage: page, totalPages: totalReportPages, totalItems: totalReportItems, pageSize, setCurrentPage: setPage, setPageSize, resetPage } = useClientPagination(filteredReports, 12)

  // Reset page when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { resetPage() }, [search, viewFilter])

  // ==================== Helpers ====================

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getDataSourceLabel = (key: string) => {
    // Extract a readable name from dot-notation key
    const parts = key.split('.')
    return parts[parts.length - 1]
      ?.replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()) || key
  }

  // ==================== Render ====================

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Saved Reports"
        subtitle="Manage and run your saved report definitions"
        breadcrumbs={[
          { label: 'Reports', href: '/reports' },
          { label: 'Saved Reports' },
        ]}
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<PlusIcon className="w-4 h-4" />}
            onClick={() => navigate('/reports/builder')}
          >
            New Report
          </Button>
        }
      />

      {/* Search and filter bar */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports..."
            className="block w-full pl-10 pr-4 py-2 rounded-md border border-gray-300 bg-gray-50 text-sm placeholder-gray-400 focus:bg-white focus:border-[#0969da] focus:outline-none focus:ring-1 focus:ring-[#0969da] hover:border-gray-400"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-md">
          {([
            { value: 'all', label: 'All' },
            { value: 'mine', label: 'Private' },
            { value: 'public', label: 'Public' },
          ] as { value: ViewFilter; label: string }[]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setViewFilter(opt.value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                viewFilter === opt.value
                  ? 'bg-white text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton height={20} width="60%" />
                  <Skeleton height={14} />
                  <Skeleton height={14} width="80%" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton height={24} width={60} rounded="full" />
                    <Skeleton height={24} width={80} rounded="full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <EmptyState
          type="error"
          title="Failed to load reports"
          description="We could not retrieve your saved reports. Please try again."
          action={{
            label: 'Retry',
            onClick: () => queryClient.invalidateQueries({ queryKey: ['report-builder', 'saved'] }),
          }}
        />
      )}

      {/* Empty */}
      {!isLoading && !isError && reports.length === 0 && (
        <EmptyState
          type="data"
          title="No saved reports"
          description="Build and save your first custom report to see it here."
          action={{
            label: 'Create Report',
            onClick: () => navigate('/reports/builder'),
          }}
        />
      )}

      {/* Filtered empty */}
      {!isLoading && !isError && reports.length > 0 && filteredReports.length === 0 && (
        <EmptyState
          type="search"
          title="No matching reports"
          description="Try adjusting your search or filter."
          action={{
            label: 'Clear Filters',
            onClick: () => {
              setSearch('')
              setViewFilter('all')
            },
          }}
        />
      )}

      {/* Report cards */}
      {!isLoading && filteredReports.length > 0 && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedReports.map((report) => (
            <Card
              key={report.id}
              hoverable
              onClick={() => navigate(`/reports/view/${report.id}`)}
              className="group"
            >
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors">
                      {report.name}
                    </h3>
                    {report.description && (
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                        {report.description}
                      </p>
                    )}
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      items={[
                        {
                          label: 'Run Report',
                          icon: <PlayIcon className="w-4 h-4" />,
                          onClick: () => navigate(`/reports/view/${report.id}`),
                        },
                        {
                          label: 'Edit in Builder',
                          icon: <PencilSquareIcon className="w-4 h-4" />,
                          onClick: () => navigate(`/reports/builder?edit=${report.id}`),
                        },
                        {
                          label: 'Duplicate',
                          icon: <DocumentDuplicateIcon className="w-4 h-4" />,
                          onClick: () => duplicateMutation.mutate(report.id),
                        },
                        { label: '', divider: true },
                        {
                          label: 'Delete',
                          icon: <TrashIcon className="w-4 h-4" />,
                          danger: true,
                          onClick: () => setDeleteTarget(report),
                        },
                      ]}
                    />
                  </div>
                </div>

                {/* Metadata */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="info" size="xs">
                    <FunnelIcon className="w-3 h-3 mr-0.5" />
                    {getDataSourceLabel(report.data_source)}
                  </Badge>
                  <Badge variant="default" size="xs">
                    {report.columns.length} columns
                  </Badge>
                  {report.is_public ? (
                    <Badge variant="success" size="xs">
                      <GlobeAltIcon className="w-3 h-3 mr-0.5" />
                      Public
                    </Badge>
                  ) : (
                    <Badge variant="default" size="xs">
                      <LockClosedIcon className="w-3 h-3 mr-0.5" />
                      Private
                    </Badge>
                  )}
                </div>

                {/* Stats row */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <ClockIcon className="w-3.5 h-3.5" />
                    <span>Last run: {formatDate(report.last_run_at)}</span>
                  </div>
                  <span>
                    {report.run_count} run{report.run_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {totalReportPages > 1 && (
          <TablePagination
            currentPage={page}
            totalPages={totalReportPages}
            totalItems={totalReportItems}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
        </>
      )}

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Report"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>? This
            action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              isLoading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
