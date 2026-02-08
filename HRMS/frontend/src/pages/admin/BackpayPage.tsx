import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  CalculatorIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  TrashIcon,
  UsersIcon,
  BoltIcon,
  BanknotesIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { backpayService } from '@/services/backpay'
import type { BackpayFilters, BackpayBulkCreateData, BackpayBulkProcessResult, RetropayDetection } from '@/services/backpay'
import { employeeService } from '@/services/employees'
import { payrollService } from '@/services/payroll'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { TablePagination } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BackpayRequest, BackpayStatus } from '@/types'

const statusColors: Record<BackpayStatus, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'default',
  PREVIEWED: 'info',
  APPROVED: 'success',
  APPLIED: 'success',
  CANCELLED: 'danger',
}

const reasonLabels: Record<string, string> = {
  PROMOTION: 'Promotion',
  UPGRADE: 'Grade/Level Upgrade',
  SALARY_REVISION: 'Salary Revision',
  CORRECTION: 'Payroll Correction',
  DELAYED_INCREMENT: 'Delayed Increment',
  BACKDATED_JOINING: 'Backdated Joining Date',
  OTHER: 'Other',
}

export default function BackpayPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [filters, setFilters] = useState<BackpayFilters>({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<BackpayRequest | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState<{
    action: 'calculate' | 'approve' | 'cancel' | 'delete'
    id: string
    title: string
    message: string
  } | null>(null)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [processingBatchId, setProcessingBatchId] = useState<string | null>(null)
  const [showProcessConfirm, setShowProcessConfirm] = useState(false)
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [bulkDeletePeriod, setBulkDeletePeriod] = useState('')
  const [showApproveAllConfirm, setShowApproveAllConfirm] = useState(false)
  const [showDetectionModal, setShowDetectionModal] = useState(false)
  const [detectionResults, setDetectionResults] = useState<RetropayDetection[] | null>(null)

  // Create form state
  const [createForm, setCreateForm] = useState({
    employee: '',
    reason: '',
    description: '',
    effective_from: '',
    effective_to: '',
    reference_period: '',
  })

  // Bulk form state
  const [bulkForm, setBulkForm] = useState<BackpayBulkCreateData>({
    all_active: false,
    reason: '',
    description: '',
    effective_from: '',
    effective_to: '',
  })

  // Fetch backpay requests
  const { data: requestsData, isLoading } = useQuery({
    queryKey: ['backpay-requests', filters, page],
    queryFn: () => backpayService.getRequests({ ...filters, page }),
  })

  // Fetch employees for selector
  const { data: employeesData } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => employeeService.getAll({ page: 1 }),
  })

  // Fetch payroll periods for filters and selectors
  const { data: payrollPeriods } = useQuery({
    queryKey: ['payroll-periods'],
    queryFn: () => payrollService.getPeriods(),
  })

  const requests = requestsData?.results || []
  const totalItems = requestsData?.count || 0
  const totalPages = Math.ceil(totalItems / pageSize)
  const employees = employeesData?.results || []

  // Derive summary stats from current page data
  const stats = useMemo(() => {
    const draftCount = requests.filter((r) => r.status === 'DRAFT').length
    const previewedCount = requests.filter((r) => r.status === 'PREVIEWED').length
    const approvedCount = requests.filter((r) => r.status === 'APPROVED').length
    const totalNetArrears = requests.reduce((sum, r) => sum + (Number(r.net_arrears) || 0), 0)
    return { draftCount, previewedCount, approvedCount, totalNetArrears }
  }, [requests])

  // Fetch filter options for bulk modal
  const { data: divisions } = useQuery({
    queryKey: ['divisions'],
    queryFn: () => employeeService.getDivisions(),
    enabled: showBulkModal,
  })
  const { data: directorates } = useQuery({
    queryKey: ['directorates'],
    queryFn: () => employeeService.getDirectorates(),
    enabled: showBulkModal,
  })
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => employeeService.getDepartments(),
    enabled: showBulkModal,
  })
  const { data: grades } = useQuery({
    queryKey: ['grades'],
    queryFn: () => employeeService.getGrades(),
    enabled: showBulkModal,
  })
  const { data: regions } = useQuery({
    queryKey: ['regions'],
    queryFn: () => employeeService.getRegions(),
    enabled: showBulkModal,
  })
  const { data: districts } = useQuery({
    queryKey: ['districts'],
    queryFn: () => employeeService.getDistricts(),
    enabled: showBulkModal,
  })
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => employeeService.getLocations(),
    enabled: showBulkModal,
  })
  const { data: staffCategories } = useQuery({
    queryKey: ['staff-categories'],
    queryFn: () => employeeService.getCategories(),
    enabled: showBulkModal,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: backpayService.createRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backpay-requests'] })
      toast.success('Backpay request created')
      setShowCreateModal(false)
      setCreateForm({ employee: '', reason: '', description: '', effective_from: '', effective_to: '', reference_period: '' })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to create request')
    },
  })

  const calculateMutation = useMutation({
    mutationFn: backpayService.calculateRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backpay-requests'] })
      toast.success('Backpay calculated successfully')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Calculation failed')
    },
  })

  const approveMutation = useMutation({
    mutationFn: backpayService.approveRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backpay-requests'] })
      toast.success('Backpay request approved')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Approval failed')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: backpayService.cancelRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backpay-requests'] })
      toast.success('Backpay request cancelled')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Cancellation failed')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: backpayService.deleteRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backpay-requests'] })
      toast.success('Backpay request deleted')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Delete failed')
    },
  })

  const bulkCreateMutation = useMutation({
    mutationFn: backpayService.bulkCreateRequests,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['backpay-requests'] })
      const msg = `Created ${result.count} backpay request(s)` +
        (result.skipped > 0 ? `. ${result.skipped} skipped (overlapping dates).` : '')
      toast.success(msg)
      setShowBulkModal(false)
      setBulkForm({ all_active: false, reason: '', description: '', effective_from: '', effective_to: '' })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Bulk create failed')
    },
  })

  // Bulk delete by period mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: backpayService.bulkDeleteByPeriod,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['backpay-requests'] })
      toast.success(`Deleted ${result.deleted} backpay request(s)`)
      setShowBulkDeleteModal(false)
      setBulkDeletePeriod('')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Bulk delete failed')
    },
  })

  // Bulk approve mutation
  const bulkApproveMutation = useMutation({
    mutationFn: backpayService.bulkApprove,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['backpay-requests'] })
      toast.success(`Approved ${result.approved} backpay request(s)`)
      setShowApproveAllConfirm(false)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Bulk approve failed')
    },
  })

  // Detect retropay mutation
  const detectMutation = useMutation({
    mutationFn: () => backpayService.detectRetropay(),
    onSuccess: (data) => {
      if (data.count === 0) {
        toast.success('No retropay implications detected')
      } else {
        setDetectionResults(data.detections)
        setShowDetectionModal(true)
      }
    },
    onError: () => toast.error('Failed to detect retropay implications'),
  })

  // Auto-create retropay mutation
  const autoCreateMutation = useMutation({
    mutationFn: () => backpayService.autoCreateRetropay(),
    onSuccess: (data) => {
      toast.success(`Created ${data.count} backpay request(s)${data.skipped ? `, ${data.skipped} skipped` : ''}`)
      setShowDetectionModal(false)
      setDetectionResults(null)
      queryClient.invalidateQueries({ queryKey: ['backpay-requests'] })
    },
    onError: () => toast.error('Failed to create retropay requests'),
  })

  // Bulk process mutation
  const bulkProcessMutation = useMutation({
    mutationFn: backpayService.bulkProcess,
    onSuccess: (result) => {
      setProcessingBatchId(result.batch_id)
      setShowProcessConfirm(false)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to start bulk processing')
      setShowProcessConfirm(false)
    },
  })

  // Bulk process progress polling
  const { data: bulkProgress } = useQuery<BackpayBulkProcessResult>({
    queryKey: ['backpay-bulk-progress', processingBatchId],
    queryFn: () => backpayService.getBulkProcessProgress(processingBatchId!),
    enabled: !!processingBatchId,
    refetchInterval: processingBatchId ? 2000 : false,
  })

  // Handle completion of bulk processing
  const completionHandled = useRef(false)
  useEffect(() => {
    if (!processingBatchId || !bulkProgress) return
    if (completionHandled.current) return

    if (bulkProgress.status === 'completed') {
      completionHandled.current = true
      const msg = `Processed ${bulkProgress.total} requests: ${bulkProgress.approved} approved, ${bulkProgress.zero_arrears} with zero arrears` +
        (bulkProgress.errors.length > 0 ? `, ${bulkProgress.errors.length} errors` : '')
      toast.success(msg)
      queryClient.invalidateQueries({ queryKey: ['backpay-requests'] })
      setProcessingBatchId(null)
    } else if (bulkProgress.status === 'failed') {
      completionHandled.current = true
      toast.error('Bulk processing failed')
      setProcessingBatchId(null)
    }
  }, [bulkProgress?.status, processingBatchId])

  // Reset completion flag when a new batch starts
  useEffect(() => {
    if (processingBatchId) {
      completionHandled.current = false
    }
  }, [processingBatchId])

  // Count eligible requests for the Process All button
  const eligibleCount = requests.filter(
    (r) => r.status === 'DRAFT' || r.status === 'PREVIEWED'
  ).length

  // Count approvable requests (PREVIEWED with net_arrears > 0)
  const approvableCount = requests.filter(
    (r) => r.status === 'PREVIEWED' && Number(r.net_arrears) > 0
  ).length

  const handleConfirmAction = () => {
    if (!showConfirmModal) return
    const { action, id } = showConfirmModal
    switch (action) {
      case 'calculate':
        calculateMutation.mutate(id)
        break
      case 'approve':
        approveMutation.mutate(id)
        break
      case 'cancel':
        cancelMutation.mutate(id)
        break
      case 'delete':
        deleteMutation.mutate(id)
        break
    }
    setShowConfirmModal(null)
  }

  const handleViewDetail = async (request: BackpayRequest) => {
    try {
      const detail = await backpayService.getRequest(request.id)
      setSelectedRequest(detail)
      setShowDetailModal(true)
    } catch {
      toast.error('Failed to load request details')
    }
  }

  const getActionButtons = (request: BackpayRequest) => {
    const buttons: React.ReactNode[] = []

    buttons.push(
      <Button key="view" size="sm" variant="ghost" onClick={() => handleViewDetail(request)} className="text-gray-500 hover:text-primary-600">
        <EyeIcon className="h-4 w-4" />
      </Button>
    )

    if (request.status === 'DRAFT') {
      buttons.push(
        <Button
          key="calculate"
          size="sm"
          variant="ghost"
          className="text-gray-500 hover:text-blue-600"
          onClick={() => setShowConfirmModal({
            action: 'calculate', id: request.id,
            title: 'Calculate Backpay',
            message: `Calculate arrears for ${request.employee_name}?`,
          })}
        >
          <CalculatorIcon className="h-4 w-4" />
        </Button>
      )
      buttons.push(
        <Button
          key="delete"
          size="sm"
          variant="ghost"
          className="text-gray-500 hover:text-red-600"
          onClick={() => setShowConfirmModal({
            action: 'delete', id: request.id,
            title: 'Delete Request',
            message: `Delete backpay request ${request.reference_number}?`,
          })}
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      )
    }

    if (request.status === 'PREVIEWED') {
      buttons.push(
        <Button
          key="approve"
          size="sm"
          variant="ghost"
          className="text-gray-500 hover:text-green-600"
          onClick={() => setShowConfirmModal({
            action: 'approve', id: request.id,
            title: 'Approve Backpay',
            message: `Approve ${formatCurrency(request.net_arrears)} arrears for ${request.employee_name}?`,
          })}
        >
          <CheckIcon className="h-4 w-4" />
        </Button>
      )
      buttons.push(
        <Button
          key="cancel"
          size="sm"
          variant="ghost"
          className="text-gray-500 hover:text-amber-600"
          onClick={() => setShowConfirmModal({
            action: 'cancel', id: request.id,
            title: 'Cancel Request',
            message: `Cancel backpay request ${request.reference_number}?`,
          })}
        >
          <XMarkIcon className="h-4 w-4" />
        </Button>
      )
    }

    if (request.status === 'APPROVED') {
      buttons.push(
        <Button
          key="cancel2"
          size="sm"
          variant="ghost"
          className="text-gray-500 hover:text-amber-600"
          onClick={() => setShowConfirmModal({
            action: 'cancel', id: request.id,
            title: 'Cancel Request',
            message: `Cancel approved backpay request ${request.reference_number}?`,
          })}
        >
          <XMarkIcon className="h-4 w-4" />
        </Button>
      )
    }

    if (request.status === 'CANCELLED') {
      buttons.push(
        <Button
          key="delete-cancelled"
          size="sm"
          variant="ghost"
          className="text-gray-500 hover:text-red-600"
          onClick={() => setShowConfirmModal({
            action: 'delete', id: request.id,
            title: 'Delete Request',
            message: `Delete cancelled backpay request ${request.reference_number}?`,
          })}
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      )
    }

    return buttons
  }

  return (
    <div className="space-y-6">
      {/* ── Section 1: Hero Banner ── */}
      <div className="bg-primary-700 rounded-lg p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Backpay Management</h1>
            <p className="text-sm text-white/70 mt-1">Manage retroactive pay adjustments and arrears</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => setShowProcessConfirm(true)}
              disabled={!!processingBatchId || eligibleCount === 0}
            >
              <BoltIcon className="h-4 w-4 mr-2" />
              Process All{eligibleCount > 0 ? ` (${eligibleCount})` : ''}
            </Button>
            <button
              onClick={() => setShowApproveAllConfirm(true)}
              disabled={approvableCount === 0}
              className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-white bg-white/20 hover:bg-white/30 border border-white/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckIcon className="h-4 w-4 mr-2" />
              Approve All{approvableCount > 0 ? ` (${approvableCount})` : ''}
            </button>
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-white bg-white/20 hover:bg-white/30 border border-white/20 rounded-lg transition-colors"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete by Period
            </button>
            <button
              onClick={() => detectMutation.mutate()}
              disabled={detectMutation.isPending}
              className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-white bg-white/20 hover:bg-white/30 border border-white/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
              {detectMutation.isPending ? 'Scanning...' : 'Detect Retropay'}
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-white bg-white/20 hover:bg-white/30 border border-white/20 rounded-lg transition-colors"
            >
              <UsersIcon className="h-4 w-4 mr-2" />
              Bulk / All Staff
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-white bg-white/20 hover:bg-white/30 border border-white/20 rounded-lg transition-colors"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              New Request
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 2: Summary Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Requests */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-xs border-l-4 border-l-slate-500 p-5">
          <div className="bg-slate-100 rounded-lg p-2 w-fit mb-3">
            <DocumentTextIcon className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{totalItems}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Requests</p>
        </div>

        {/* Draft */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-xs border-l-4 border-l-amber-500 p-5">
          <div className="bg-amber-100 rounded-lg p-2 w-fit mb-3">
            <ClockIcon className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{stats.draftCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Draft</p>
        </div>

        {/* Previewed */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-xs border-l-4 border-l-blue-500 p-5">
          <div className="bg-blue-100 rounded-lg p-2 w-fit mb-3">
            <EyeIcon className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{stats.previewedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Previewed</p>
        </div>

        {/* Approved */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-xs border-l-4 border-l-green-500 p-5">
          <div className="bg-green-100 rounded-lg p-2 w-fit mb-3">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{stats.approvedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Approved</p>
        </div>

        {/* Net Arrears Total */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-xs border-l-4 border-l-primary-500 p-5 col-span-2 md:col-span-1">
          <div className="bg-primary-100 rounded-lg p-2 w-fit mb-3">
            <BanknotesIcon className="w-5 h-5 text-primary-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalNetArrears)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Net Arrears (Total)</p>
        </div>
      </div>

      {/* ── Section 4: Bulk Process Progress Bar ── */}
      {processingBatchId && bulkProgress && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">
                Processing backpay requests... {bulkProgress.processed} / {bulkProgress.total} ({bulkProgress.percentage}%)
              </span>
              {bulkProgress.current_employee && (
                <span className="text-xs text-gray-500">
                  Current: {bulkProgress.current_employee}
                </span>
              )}
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className="bg-primary-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${bulkProgress.percentage}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <Badge variant="info" size="sm">Calculated: {bulkProgress.calculated}</Badge>
              <Badge variant="success" size="sm">Approved: {bulkProgress.approved}</Badge>
              <Badge variant="warning" size="sm">Zero Arrears: {bulkProgress.zero_arrears}</Badge>
              {bulkProgress.errors.length > 0 && (
                <Badge variant="danger" size="sm">Errors: {bulkProgress.errors.length}</Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Section 3: Filter Bar — Glass Effect ── */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <FunnelIcon className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Filters</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by employee name or reference..."
                leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
                value={filters.search || ''}
                onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1) }}
              />
            </div>
            <Select
              value={filters.status || ''}
              onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1) }}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'DRAFT', label: 'Draft' },
                { value: 'PREVIEWED', label: 'Previewed' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'APPLIED', label: 'Applied' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
            />
            <Select
              value={filters.reason || ''}
              onChange={(e) => { setFilters({ ...filters, reason: e.target.value }); setPage(1) }}
              options={[
                { value: '', label: 'All Reasons' },
                { value: 'PROMOTION', label: 'Promotion' },
                { value: 'UPGRADE', label: 'Grade/Level Upgrade' },
                { value: 'SALARY_REVISION', label: 'Salary Revision' },
                { value: 'CORRECTION', label: 'Payroll Correction' },
                { value: 'DELAYED_INCREMENT', label: 'Delayed Increment' },
                { value: 'BACKDATED_JOINING', label: 'Backdated Joining' },
                { value: 'OTHER', label: 'Other' },
              ]}
            />
            <Select
              value={filters.payroll_period || ''}
              onChange={(e) => { setFilters({ ...filters, payroll_period: e.target.value }); setPage(1) }}
              options={[
                { value: '', label: 'All Periods' },
                ...(payrollPeriods || []).map((p: any) => ({
                  value: p.id,
                  label: p.name,
                })),
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Section 5: Requests Table — Refined Corporate Style ── */}
      <Card>
        <CardHeader>
          <CardTitle>Backpay Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center gap-3 text-gray-400">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm font-medium">Loading requests...</span>
              </div>
            </div>
          ) : requests.length === 0 ? (
            /* ── Section 6: Illustrated Empty State ── */
            <div className="text-center py-16 space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-lg">
                <BanknotesIcon className="h-10 w-10 text-gray-300" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-400">No backpay requests found</p>
                <p className="text-sm text-gray-400 mt-1">Create a new request or use bulk create to get started</p>
              </div>
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Request
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Period</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payroll Period</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Arrears</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request, index) => (
                    <tr
                      key={request.id}
                      className={`border-b border-gray-100 hover:bg-primary-50/50 transition-colors duration-150 ${
                        index % 2 === 1 ? 'bg-gray-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                          {request.reference_number}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-gray-900">{request.employee_name}</div>
                        <div className="text-xs text-gray-400">{request.employee_number}</div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{reasonLabels[request.reason] || request.reason}</td>
                      <td className="px-4 py-3.5 text-xs text-gray-600">
                        {formatDate(request.effective_from)} - {formatDate(request.effective_to)}
                        <div className="text-gray-400">{request.periods_covered} period(s)</div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600">
                        {request.payroll_period_name || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`font-semibold ${Number(request.net_arrears) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(request.net_arrears)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          variant={statusColors[request.status]}
                          size="sm"
                        >
                          {request.status_display || request.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex gap-1">{getActionButtons(request)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Create Modal ── */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Backpay Request"
      >
        <div className="space-y-4">
          <Select
            label="Employee"
            value={createForm.employee}
            onChange={(e) => setCreateForm({ ...createForm, employee: e.target.value })}
            options={[
              { value: '', label: 'Select Employee' },
              ...employees.map((emp) => ({
                value: emp.id,
                label: `${emp.first_name} ${emp.last_name} (${emp.employee_number})`,
              })),
            ]}
          />
          <Select
            label="Reason"
            value={createForm.reason}
            onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
            options={[
              { value: '', label: 'Select Reason' },
              { value: 'PROMOTION', label: 'Promotion' },
              { value: 'UPGRADE', label: 'Grade/Level Upgrade' },
              { value: 'SALARY_REVISION', label: 'Salary Revision' },
              { value: 'CORRECTION', label: 'Payroll Correction' },
              { value: 'DELAYED_INCREMENT', label: 'Delayed Increment' },
              { value: 'BACKDATED_JOINING', label: 'Backdated Joining Date' },
              { value: 'OTHER', label: 'Other' },
            ]}
          />
          <Input
            label="Effective From"
            type="date"
            value={createForm.effective_from}
            onChange={(e) => setCreateForm({ ...createForm, effective_from: e.target.value })}
          />
          <Input
            label="Effective To"
            type="date"
            value={createForm.effective_to}
            onChange={(e) => setCreateForm({ ...createForm, effective_to: e.target.value })}
          />
          <Select
            label="Reference Period (optional)"
            value={createForm.reference_period}
            onChange={(e) => setCreateForm({ ...createForm, reference_period: e.target.value })}
            options={[
              { value: '', label: 'Use latest salary data' },
              ...(payrollPeriods || []).map((p: any) => ({
                value: p.id,
                label: p.name,
              })),
            ]}
          />
          <p className="text-xs text-gray-400 -mt-2">
            Select a period if the backpay should use salary data from a specific period instead of the latest.
          </p>
          <Input
            label="Description (optional)"
            value={createForm.description}
            onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => createMutation.mutate({
                employee: createForm.employee,
                reason: createForm.reason,
                description: createForm.description || undefined,
                effective_from: createForm.effective_from,
                effective_to: createForm.effective_to,
                reference_period: createForm.reference_period || undefined,
              })}
              disabled={!createForm.employee || !createForm.reason || !createForm.effective_from || !createForm.effective_to}
              isLoading={createMutation.isPending}
            >
              Create Request
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Section 7: Detail Modal — Enhanced Financial Cards ── */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedRequest(null) }}
        title={`Backpay Request ${selectedRequest?.reference_number || ''}`}
        size="lg"
      >
        {selectedRequest && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Employee</p>
                <p className="font-medium">{selectedRequest.employee_name}</p>
                <p className="text-xs text-gray-500">{selectedRequest.employee_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Reason</p>
                <p className="font-medium">{reasonLabels[selectedRequest.reason] || selectedRequest.reason}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Period</p>
                <p className="font-medium">{formatDate(selectedRequest.effective_from)} - {formatDate(selectedRequest.effective_to)}</p>
                <p className="text-xs text-gray-500">{selectedRequest.periods_covered} period(s)</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <Badge
                  variant={statusColors[selectedRequest.status]}
                  size="sm"
                >
                  {selectedRequest.status_display || selectedRequest.status}
                </Badge>
              </div>
              {selectedRequest.payroll_period_name && (
                <div>
                  <p className="text-xs text-gray-500">Payroll Period</p>
                  <p className="font-medium">{selectedRequest.payroll_period_name}</p>
                </div>
              )}
              {selectedRequest.reference_period_name && (
                <div>
                  <p className="text-xs text-gray-500">Reference Period</p>
                  <p className="font-medium">{selectedRequest.reference_period_name}</p>
                </div>
              )}
            </div>

            {/* Financial Summary — Enhanced Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="py-4 text-center border-l-4 border-l-green-500">
                  <p className="text-xs text-gray-500 mb-1">Earnings Arrears</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(selectedRequest.total_arrears_earnings)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center border-l-4 border-l-red-500">
                  <p className="text-xs text-gray-500 mb-1">Deductions Arrears</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(selectedRequest.total_arrears_deductions)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 text-center border-l-4 border-l-primary-500">
                  <p className="text-xs text-gray-500 mb-1">Net Arrears</p>
                  <p className="text-2xl font-bold text-primary-600">
                    {formatCurrency(selectedRequest.net_arrears)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {selectedRequest.description && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Description</p>
                <p className="text-sm">{selectedRequest.description}</p>
              </div>
            )}

            {/* Period Breakdown Table — Refined Style */}
            {selectedRequest.details && selectedRequest.details.length > 0 && (
              <div>
                <h3 className="font-medium mb-3">Period-by-Period Breakdown</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Period</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Component</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Old Amount</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">New Amount</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRequest.details.map((detail, index) => (
                        <tr
                          key={detail.id}
                          className={`border-b border-gray-100 last:border-0 hover:bg-primary-50/50 transition-colors duration-150 ${
                            index % 2 === 1 ? 'bg-gray-50/50' : ''
                          }`}
                        >
                          <td className="px-4 py-2.5 text-xs text-gray-600">{detail.period_name}</td>
                          <td className="px-4 py-2.5 text-gray-700">{detail.component_name}</td>
                          <td className="px-4 py-2.5">
                            <Badge
                              variant={detail.component_type === 'EARNING' ? 'success' : 'danger'}
                              size="xs"
                            >
                              {detail.component_type}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(detail.old_amount)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(detail.new_amount)}</td>
                          <td className="px-4 py-2.5 text-right font-medium">
                            <span className={detail.difference >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatCurrency(detail.difference)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Bulk Create Modal ── */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="Bulk Backpay Request"
        size="lg"
      >
        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={bulkForm.all_active || false}
              onChange={(e) => setBulkForm({
                ...bulkForm,
                all_active: e.target.checked,
                division: undefined,
                directorate: undefined,
                department: undefined,
                grade: undefined,
                region: undefined,
                district: undefined,
                work_location: undefined,
                staff_category: undefined,
              })}
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium">All Active Employees</span>
          </label>

          {!bulkForm.all_active && (
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Division"
                value={bulkForm.division || ''}
                onChange={(e) => setBulkForm({ ...bulkForm, division: e.target.value || undefined })}
                options={[
                  { value: '', label: 'Any Division' },
                  ...(divisions || []).map((d: any) => ({ value: d.id, label: d.name })),
                ]}
              />
              <Select
                label="Directorate"
                value={bulkForm.directorate || ''}
                onChange={(e) => setBulkForm({ ...bulkForm, directorate: e.target.value || undefined })}
                options={[
                  { value: '', label: 'Any Directorate' },
                  ...(directorates || []).map((d: any) => ({ value: d.id, label: d.name })),
                ]}
              />
              <Select
                label="Department"
                value={bulkForm.department || ''}
                onChange={(e) => setBulkForm({ ...bulkForm, department: e.target.value || undefined })}
                options={[
                  { value: '', label: 'Any Department' },
                  ...(departments || []).map((d: any) => ({ value: d.id, label: d.name })),
                ]}
              />
              <Select
                label="Job Grade"
                value={bulkForm.grade || ''}
                onChange={(e) => setBulkForm({ ...bulkForm, grade: e.target.value || undefined })}
                options={[
                  { value: '', label: 'Any Grade' },
                  ...(grades || []).map((g: any) => ({ value: g.id, label: g.name })),
                ]}
              />
              <Select
                label="Region"
                value={bulkForm.region || ''}
                onChange={(e) => setBulkForm({ ...bulkForm, region: e.target.value || undefined })}
                options={[
                  { value: '', label: 'Any Region' },
                  ...(regions || []).map((r: any) => ({ value: r.id, label: r.name })),
                ]}
              />
              <Select
                label="District"
                value={bulkForm.district || ''}
                onChange={(e) => setBulkForm({ ...bulkForm, district: e.target.value || undefined })}
                options={[
                  { value: '', label: 'Any District' },
                  ...(districts || []).map((d: any) => ({ value: d.id, label: d.name })),
                ]}
              />
              <Select
                label="Work Location"
                value={bulkForm.work_location || ''}
                onChange={(e) => setBulkForm({ ...bulkForm, work_location: e.target.value || undefined })}
                options={[
                  { value: '', label: 'Any Location' },
                  ...(locations || []).map((l: any) => ({ value: l.id, label: l.name })),
                ]}
              />
              <Select
                label="Staff Category"
                value={bulkForm.staff_category || ''}
                onChange={(e) => setBulkForm({ ...bulkForm, staff_category: e.target.value || undefined })}
                options={[
                  { value: '', label: 'Any Category' },
                  ...(staffCategories || []).map((c: any) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
          )}

          <Select
            label="Reason"
            value={bulkForm.reason}
            onChange={(e) => setBulkForm({ ...bulkForm, reason: e.target.value })}
            options={[
              { value: '', label: 'Select Reason' },
              { value: 'PROMOTION', label: 'Promotion' },
              { value: 'UPGRADE', label: 'Grade/Level Upgrade' },
              { value: 'SALARY_REVISION', label: 'Salary Revision' },
              { value: 'CORRECTION', label: 'Payroll Correction' },
              { value: 'DELAYED_INCREMENT', label: 'Delayed Increment' },
              { value: 'BACKDATED_JOINING', label: 'Backdated Joining Date' },
              { value: 'OTHER', label: 'Other' },
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Effective From"
              type="date"
              value={bulkForm.effective_from}
              onChange={(e) => setBulkForm({ ...bulkForm, effective_from: e.target.value })}
            />
            <Input
              label="Effective To"
              type="date"
              value={bulkForm.effective_to}
              onChange={(e) => setBulkForm({ ...bulkForm, effective_to: e.target.value })}
            />
          </div>
          <Input
            label="Description (optional)"
            value={bulkForm.description || ''}
            onChange={(e) => setBulkForm({ ...bulkForm, description: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowBulkModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                const payload: BackpayBulkCreateData = {
                  reason: bulkForm.reason,
                  effective_from: bulkForm.effective_from,
                  effective_to: bulkForm.effective_to,
                  description: bulkForm.description || undefined,
                }
                if (bulkForm.all_active) payload.all_active = true
                if (bulkForm.division) payload.division = bulkForm.division
                if (bulkForm.directorate) payload.directorate = bulkForm.directorate
                if (bulkForm.department) payload.department = bulkForm.department
                if (bulkForm.grade) payload.grade = bulkForm.grade
                if (bulkForm.region) payload.region = bulkForm.region
                if (bulkForm.district) payload.district = bulkForm.district
                if (bulkForm.work_location) payload.work_location = bulkForm.work_location
                if (bulkForm.staff_category) payload.staff_category = bulkForm.staff_category
                bulkCreateMutation.mutate(payload)
              }}
              disabled={
                !bulkForm.reason || !bulkForm.effective_from || !bulkForm.effective_to ||
                (!bulkForm.all_active && !bulkForm.division && !bulkForm.directorate &&
                 !bulkForm.department && !bulkForm.grade && !bulkForm.region &&
                 !bulkForm.district && !bulkForm.work_location && !bulkForm.staff_category)
              }
              isLoading={bulkCreateMutation.isPending}
            >
              Create Bulk Requests
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Section 8: Confirm Modal — Subtle Polish ── */}
      <Modal
        isOpen={!!showConfirmModal}
        onClose={() => setShowConfirmModal(null)}
        title={showConfirmModal?.title || 'Confirm'}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            {(showConfirmModal?.action === 'cancel' || showConfirmModal?.action === 'delete') ? (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
              </div>
            ) : (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                {showConfirmModal?.action === 'calculate' ? (
                  <CalculatorIcon className="h-5 w-5 text-primary-600" />
                ) : (
                  <CheckCircleIcon className="h-5 w-5 text-primary-600" />
                )}
              </div>
            )}
            <p className="text-gray-700 pt-2">{showConfirmModal?.message}</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowConfirmModal(null)}>Cancel</Button>
            <Button
              variant={showConfirmModal?.action === 'cancel' || showConfirmModal?.action === 'delete' ? 'danger' : 'primary'}
              onClick={handleConfirmAction}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete by Period Modal ── */}
      <Modal
        isOpen={showBulkDeleteModal}
        onClose={() => { setShowBulkDeleteModal(false); setBulkDeletePeriod('') }}
        title="Delete Backpay Requests by Period"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This will delete all DRAFT and CANCELLED backpay requests for the selected payroll period.
          </p>
          <Select
            label="Payroll Period"
            value={bulkDeletePeriod}
            onChange={(e) => setBulkDeletePeriod(e.target.value)}
            options={[
              { value: '', label: 'Select Period' },
              ...(payrollPeriods || []).map((p: any) => ({
                value: p.id,
                label: p.name,
              })),
            ]}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => { setShowBulkDeleteModal(false); setBulkDeletePeriod('') }}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => bulkDeleteMutation.mutate(bulkDeletePeriod)}
              disabled={!bulkDeletePeriod}
              isLoading={bulkDeleteMutation.isPending}
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete by Period
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Approve All Confirmation Modal ── */}
      <Modal
        isOpen={showApproveAllConfirm}
        onClose={() => setShowApproveAllConfirm(false)}
        title="Approve All Previewed Requests"
      >
        <div className="space-y-4">
          <div className="flex justify-center mb-2">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckIcon className="h-7 w-7 text-green-600" />
            </div>
          </div>
          <p className="text-center text-gray-700">
            This will approve all PREVIEWED backpay requests that have net arrears greater than 0.
          </p>
          {approvableCount > 0 && (
            <p className="text-sm text-center text-gray-500">
              {approvableCount} request(s) will be approved.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowApproveAllConfirm(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => bulkApproveMutation.mutate()}
              isLoading={bulkApproveMutation.isPending}
            >
              <CheckIcon className="h-4 w-4 mr-2" />
              Approve All
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Process All Confirmation Modal — With Bolt Icon ── */}
      <Modal
        isOpen={showProcessConfirm}
        onClose={() => setShowProcessConfirm(false)}
        title="Process All Backpay Requests"
      >
        <div className="space-y-4">
          <div className="flex justify-center mb-2">
            <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
              <BoltIcon className="h-7 w-7 text-primary-600" />
            </div>
          </div>
          <p className="text-center text-gray-700">
            This will calculate and approve all eligible backpay requests.
            The process will run in the background and you can track progress on this page.
          </p>
          <p className="text-sm text-center text-gray-500">
            DRAFT requests will be calculated, then PREVIEWED requests with arrears &gt; 0 will be approved automatically.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowProcessConfirm(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => bulkProcessMutation.mutate()}
              isLoading={bulkProcessMutation.isPending}
            >
              <BoltIcon className="h-4 w-4 mr-2" />
              Start Processing
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Retropay Detection Results Modal ── */}
      <Modal
        isOpen={showDetectionModal}
        onClose={() => { setShowDetectionModal(false); setDetectionResults(null) }}
        title={`Retropay Detection Results (${detectionResults?.length || 0} employees)`}
        size="lg"
      >
        {detectionResults && detectionResults.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              The following employees have backdated changes affecting paid/closed periods.
              Click "Create All" to generate DRAFT backpay requests for all detected employees.
            </p>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Changes</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Affected Periods</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Range</th>
                  </tr>
                </thead>
                <tbody>
                  {detectionResults.map((det, index) => (
                    <tr
                      key={det.employee_id}
                      className={`border-b border-gray-100 hover:bg-primary-50/50 transition-colors duration-150 ${
                        index % 2 === 1 ? 'bg-gray-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{det.employee_name}</div>
                        <div className="text-xs text-gray-400">{det.employee_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {det.changes.map((change, ci) => (
                            <div key={ci} className="text-xs">
                              <Badge
                                variant={
                                  change.type === 'SALARY_CHANGE' ? 'info' :
                                  change.type === 'PROMOTION' ? 'success' :
                                  change.type === 'DEMOTION' ? 'warning' :
                                  change.type === 'TRANSACTION_CHANGE' ? 'default' :
                                  'info'
                                }
                                size="xs"
                              >
                                {change.type.replace('_', ' ')}
                              </Badge>
                              <span className="ml-1 text-gray-600">{change.description}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {det.affected_periods.map((p) => (
                            <div key={p.id} className="text-xs text-gray-600">{p.name}</div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {formatDate(det.earliest_from)} &rarr; {formatDate(det.latest_to)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setShowDetectionModal(false); setDetectionResults(null) }}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => autoCreateMutation.mutate()}
                isLoading={autoCreateMutation.isPending}
              >
                <BoltIcon className="h-4 w-4 mr-2" />
                Create All ({detectionResults.length})
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
