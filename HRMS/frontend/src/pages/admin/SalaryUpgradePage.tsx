import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  UsersIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChevronUpDownIcon,
} from '@heroicons/react/24/outline'
import { salaryUpgradeService } from '@/services/salaryUpgrade'
import type { UpgradeRequestFilters, SalaryUpgradePreview, SalaryUpgradeRequest } from '@/services/salaryUpgrade'
import { employeeService } from '@/services/employees'
import { payrollSetupService } from '@/services/payrollSetup'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { TablePagination } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { formatCurrency, formatDate } from '@/lib/utils'

const statusColors: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

const reasonOptions = [
  { value: 'PROMOTION', label: 'Promotion' },
  { value: 'GRADE_UPGRADE', label: 'Grade Upgrade' },
  { value: 'NOTCH_INCREMENT', label: 'Notch Increment' },
  { value: 'SALARY_REVISION', label: 'Salary Revision' },
  { value: 'OTHER', label: 'Other' },
]

export default function SalaryUpgradePage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [filters, setFilters] = useState<UpgradeRequestFilters>({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState<'individual' | 'bulk' | null>(null)
  const [rejectTarget, setRejectTarget] = useState<SalaryUpgradeRequest | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  // Create form state
  const [createForm, setCreateForm] = useState({
    employee: '',
    reason: '',
    new_band: '',
    new_level: '',
    new_notch: '',
    new_grade: '',
    new_position: '',
    effective_from: '',
    description: '',
  })

  // Bulk form state
  const [bulkForm, setBulkForm] = useState({
    all_active: false,
    division: '',
    directorate: '',
    department: '',
    grade: '',
    region: '',
    district: '',
    work_location: '',
    staff_category: '',
    reason: '',
    new_band: '',
    new_level: '',
    new_notch: '',
    new_grade: '',
    new_position: '',
    effective_from: '',
    description: '',
  })

  // Preview state
  const [preview, setPreview] = useState<SalaryUpgradePreview | null>(null)

  // Fetch upgrade requests
  const { data: requestsData, isLoading } = useQuery({
    queryKey: ['salary-upgrade-requests', filters, page],
    queryFn: () => salaryUpgradeService.getRequests({ ...filters, page }),
  })

  const requests = requestsData?.results || []
  const totalItems = requestsData?.count || 0
  const totalPages = Math.ceil(totalItems / pageSize)

  // Fetch employees for selector
  const { data: employeesData } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => employeeService.getAll({ page: 1 }),
  })
  const employees = employeesData?.results || []

  // Fetch salary bands/levels/notches for cascading selectors
  const { data: salaryBands } = useQuery({
    queryKey: ['salary-bands'],
    queryFn: () => payrollSetupService.getSalaryBands(),
    enabled: showCreateModal || showBulkModal,
  })

  const { data: salaryLevels } = useQuery({
    queryKey: ['salary-levels', createForm.new_band || bulkForm.new_band],
    queryFn: () => payrollSetupService.getSalaryLevels(createForm.new_band || bulkForm.new_band || undefined),
    enabled: !!(createForm.new_band || bulkForm.new_band),
  })

  const { data: salaryNotches } = useQuery({
    queryKey: ['salary-notches', createForm.new_level || bulkForm.new_level],
    queryFn: () => payrollSetupService.getSalaryNotches(createForm.new_level || bulkForm.new_level || undefined),
    enabled: !!(createForm.new_level || bulkForm.new_level),
  })

  // Fetch grades and positions for promotion reasons
  const { data: jobGrades } = useQuery({
    queryKey: ['grades'],
    queryFn: () => employeeService.getGrades(),
    enabled: showCreateModal || showBulkModal,
  })

  const { data: jobPositions } = useQuery({
    queryKey: ['positions'],
    queryFn: () => employeeService.getPositions(),
    enabled: showCreateModal || showBulkModal,
  })

  // Filter options for bulk modal
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

  // Derive stats
  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'PENDING').length
    const approved = requests.filter((r) => r.status === 'APPROVED').length
    const rejected = requests.filter((r) => r.status === 'REJECTED').length
    return { pending, approved, rejected }
  }, [requests])

  // Mutations
  const createMutation = useMutation({
    mutationFn: salaryUpgradeService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-upgrade-requests'] })
      toast.success('Upgrade request submitted for approval')
      setShowCreateModal(false)
      setShowConfirmModal(false)
      setPendingSubmit(null)
      resetCreateForm()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Failed to create upgrade request')
      setShowConfirmModal(false)
      setPendingSubmit(null)
    },
  })

  const bulkMutation = useMutation({
    mutationFn: salaryUpgradeService.bulkCreate,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['salary-upgrade-requests'] })
      const msg = `${result.count} upgrade request(s) submitted for approval` +
        (result.skipped > 0 ? `. ${result.skipped} skipped.` : '') +
        (result.errors.length > 0 ? ` ${result.errors.length} error(s).` : '')
      toast.success(msg)
      setShowBulkModal(false)
      setShowConfirmModal(false)
      setPendingSubmit(null)
      resetBulkForm()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Bulk request failed')
      setShowConfirmModal(false)
      setPendingSubmit(null)
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => salaryUpgradeService.approve(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['salary-upgrade-requests'] })
      toast.success(`Upgrade approved for ${result.employee_name}`)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to approve')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      salaryUpgradeService.reject(id, reason),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['salary-upgrade-requests'] })
      toast.success(`Upgrade rejected for ${result.employee_name}`)
      setShowRejectModal(false)
      setRejectTarget(null)
      setRejectionReason('')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to reject')
    },
  })

  const previewMutation = useMutation({
    mutationFn: salaryUpgradeService.preview,
    onSuccess: (data) => setPreview(data),
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to load preview')
      setPreview(null)
    },
  })

  // Auto-preview when employee + notch are selected
  const handlePreview = () => {
    if (!createForm.employee || !createForm.new_notch) return
    previewMutation.mutate({
      employee: createForm.employee,
      new_notch: createForm.new_notch,
      new_grade: createForm.new_grade || undefined,
      new_position: createForm.new_position || undefined,
    })
  }

  const resetCreateForm = () => {
    setCreateForm({
      employee: '', reason: '', new_band: '', new_level: '', new_notch: '',
      new_grade: '', new_position: '', effective_from: '', description: '',
    })
    setPreview(null)
  }

  const resetBulkForm = () => {
    setBulkForm({
      all_active: false, division: '', directorate: '', department: '',
      grade: '', region: '', district: '', work_location: '', staff_category: '',
      reason: '', new_band: '', new_level: '', new_notch: '',
      new_grade: '', new_position: '', effective_from: '', description: '',
    })
  }

  const handleCreateSubmit = () => {
    setPendingSubmit('individual')
    setShowConfirmModal(true)
  }

  const handleBulkSubmit = () => {
    setPendingSubmit('bulk')
    setShowConfirmModal(true)
  }

  const handleConfirm = () => {
    if (pendingSubmit === 'individual') {
      createMutation.mutate({
        employee: createForm.employee,
        new_notch: createForm.new_notch,
        new_grade: createForm.new_grade || undefined,
        new_position: createForm.new_position || undefined,
        reason: createForm.reason,
        effective_from: createForm.effective_from,
        description: createForm.description,
      })
    } else if (pendingSubmit === 'bulk') {
      const data: any = {
        new_notch: bulkForm.new_notch,
        reason: bulkForm.reason,
        effective_from: bulkForm.effective_from,
        description: bulkForm.description,
      }
      if (bulkForm.new_grade) data.new_grade = bulkForm.new_grade
      if (bulkForm.new_position) data.new_position = bulkForm.new_position
      if (bulkForm.all_active) data.all_active = true
      if (bulkForm.division) data.division = bulkForm.division
      if (bulkForm.directorate) data.directorate = bulkForm.directorate
      if (bulkForm.department) data.department = bulkForm.department
      if (bulkForm.grade) data.grade = bulkForm.grade
      if (bulkForm.region) data.region = bulkForm.region
      if (bulkForm.district) data.district = bulkForm.district
      if (bulkForm.work_location) data.work_location = bulkForm.work_location
      if (bulkForm.staff_category) data.staff_category = bulkForm.staff_category
      bulkMutation.mutate(data)
    }
  }

  const handleApprove = (item: SalaryUpgradeRequest) => {
    approveMutation.mutate(item.id)
  }

  const handleRejectOpen = (item: SalaryUpgradeRequest) => {
    setRejectTarget(item)
    setRejectionReason('')
    setShowRejectModal(true)
  }

  const handleRejectConfirm = () => {
    if (!rejectTarget || !rejectionReason.trim()) return
    rejectMutation.mutate({ id: rejectTarget.id, reason: rejectionReason.trim() })
  }

  // Whether to show grade/position selectors
  const showGradeSelector = (reason: string) => ['PROMOTION', 'GRADE_UPGRADE'].includes(reason)
  const showPositionSelector = (reason: string) => reason === 'PROMOTION'

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-primary-700 rounded-lg p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Salary Upgrades</h1>
            <p className="text-sm text-white/70 mt-1">Process notch increments, grade changes, and promotions</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowBulkModal(true)}
              className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-white bg-white/20 hover:bg-white/30 border border-white/20 rounded-lg transition-colors"
            >
              <UsersIcon className="h-4 w-4 mr-2" />
              Bulk Upgrade
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-white bg-white/20 hover:bg-white/30 border border-white/20 rounded-lg transition-colors"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              New Upgrade
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg shadow-xs border-l-4 border-l-slate-500 p-5">
          <div className="bg-slate-100 rounded-lg p-2 w-fit mb-3">
            <ChevronUpDownIcon className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{totalItems}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Requests</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-xs border-l-4 border-l-amber-500 p-5">
          <div className="bg-amber-100 rounded-lg p-2 w-fit mb-3">
            <ClockIcon className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{stats.pending}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pending</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-xs border-l-4 border-l-green-500 p-5">
          <div className="bg-green-100 rounded-lg p-2 w-fit mb-3">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{stats.approved}</p>
          <p className="text-xs text-gray-500 mt-0.5">Approved</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-xs border-l-4 border-l-red-500 p-5">
          <div className="bg-red-100 rounded-lg p-2 w-fit mb-3">
            <XCircleIcon className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{stats.rejected}</p>
          <p className="text-xs text-gray-500 mt-0.5">Rejected</p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <FunnelIcon className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Filters</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by employee name, number, or reference..."
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
                { value: 'PENDING', label: 'Pending' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'REJECTED', label: 'Rejected' },
              ]}
            />
            <Input
              type="date"
              value={filters.date_from || ''}
              onChange={(e) => { setFilters({ ...filters, date_from: e.target.value }); setPage(1) }}
              placeholder="From Date"
            />
            <Input
              type="date"
              value={filters.date_to || ''}
              onChange={(e) => { setFilters({ ...filters, date_to: e.target.value }); setPage(1) }}
              placeholder="To Date"
            />
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Upgrade Requests</CardTitle>
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
            <div className="text-center py-16 space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-lg">
                <ArrowTrendingUpIcon className="h-10 w-10 text-gray-300" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-400">No upgrade requests found</p>
                <p className="text-sm text-gray-400 mt-1">Submit a new upgrade request to get started</p>
              </div>
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                New Upgrade
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Grade</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Position</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Old Salary</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">New Salary</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Diff</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Effective</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((item, index) => (
                    <tr
                      key={item.id}
                      className={`border-b border-gray-100 hover:bg-primary-50/50 transition-colors duration-150 ${
                        index % 2 === 1 ? 'bg-gray-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs text-gray-600">{item.reference_number}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-gray-900">{item.employee_name}</div>
                        <div className="text-xs text-gray-400">{item.employee_number}</div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600">
                        {item.reason_display}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600">
                        {item.current_grade_name && item.new_grade_name && item.current_grade_name !== item.new_grade_name ? (
                          <span>{item.current_grade_name} <span className="text-primary-600 font-medium">&rarr;</span> {item.new_grade_name}</span>
                        ) : (
                          <span>{item.new_grade_name || item.current_grade_name || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600">
                        {item.current_position_title && item.new_position_title && item.current_position_title !== item.new_position_title ? (
                          <span>{item.current_position_title} <span className="text-primary-600 font-medium">&rarr;</span> {item.new_position_title}</span>
                        ) : (
                          <span>{item.new_position_title || item.current_position_title || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right text-gray-600">
                        {formatCurrency(item.current_salary)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-gray-900">
                        {formatCurrency(item.new_notch_amount)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {item.salary_diff !== 0 ? (
                          <span className={`font-semibold ${item.salary_diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.salary_diff > 0 ? '+' : ''}{formatCurrency(item.salary_diff)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600">
                        {formatDate(item.effective_from)}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={statusColors[item.status] || 'default'} size="sm">
                          {item.status_display}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {item.status === 'PENDING' ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleApprove(item)}
                              disabled={approveMutation.isPending}
                              className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-md transition-colors disabled:opacity-50"
                              title="Approve"
                            >
                              <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectOpen(item)}
                              className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
                              title="Reject"
                            >
                              <XCircleIcon className="h-3.5 w-3.5 mr-1" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {item.approved_by_name ? `by ${item.approved_by_name}` : '—'}
                          </span>
                        )}
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

      {/* ─── Create Individual Upgrade Modal ─── */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); resetCreateForm() }}
        title="New Salary Upgrade"
        size="lg"
      >
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Employee Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
            <select
              value={createForm.employee}
              onChange={(e) => {
                setCreateForm({ ...createForm, employee: e.target.value })
                setPreview(null)
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select employee...</option>
              {employees.map((emp: any) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employee_number} — {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <Select
              value={createForm.reason}
              onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value, new_grade: '', new_position: '' })}
              options={[{ value: '', label: 'Select reason...' }, ...reasonOptions]}
            />
          </div>

          {/* Grade Selector (for PROMOTION / GRADE_UPGRADE) */}
          {showGradeSelector(createForm.reason) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Job Grade</label>
              <select
                value={createForm.new_grade}
                onChange={(e) => setCreateForm({ ...createForm, new_grade: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select grade...</option>
                {(jobGrades || []).map((g: any) => (
                  <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Position Selector (for PROMOTION) */}
          {showPositionSelector(createForm.reason) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Job Position</label>
              <select
                value={createForm.new_position}
                onChange={(e) => setCreateForm({ ...createForm, new_position: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select position...</option>
                {(jobPositions || []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Cascading Notch Selectors */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Band *</label>
              <select
                value={createForm.new_band}
                onChange={(e) => setCreateForm({ ...createForm, new_band: e.target.value, new_level: '', new_notch: '' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select band...</option>
                {(salaryBands || []).map((b: any) => (
                  <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Level *</label>
              <select
                value={createForm.new_level}
                onChange={(e) => setCreateForm({ ...createForm, new_level: e.target.value, new_notch: '' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                disabled={!createForm.new_band}
              >
                <option value="">Select level...</option>
                {(salaryLevels || []).map((l: any) => (
                  <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Notch *</label>
              <select
                value={createForm.new_notch}
                onChange={(e) => {
                  setCreateForm({ ...createForm, new_notch: e.target.value })
                  setPreview(null)
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                disabled={!createForm.new_level}
              >
                <option value="">Select notch...</option>
                {(salaryNotches || []).map((n: any) => (
                  <option key={n.id} value={n.id}>{n.code} — {n.name} ({formatCurrency(n.amount)})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview Button */}
          {createForm.employee && createForm.new_notch && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePreview}
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending ? 'Loading preview...' : 'Preview Change'}
            </Button>
          )}

          {/* Preview Panel */}
          {preview && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Preview</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Current</p>
                  <p className="font-medium text-gray-900">
                    {preview.current_band} / {preview.current_level} / {preview.current_notch}
                  </p>
                  <p className="text-lg font-bold text-gray-700">{formatCurrency(preview.current_amount)}</p>
                  {preview.current_grade && (
                    <p className="text-xs text-gray-500 mt-1">Grade: {preview.current_grade}</p>
                  )}
                  {preview.current_position && (
                    <p className="text-xs text-gray-500">Position: {preview.current_position}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">New</p>
                  <p className="font-medium text-primary-700">
                    {preview.new_band} / {preview.new_level} / {preview.new_notch}
                  </p>
                  <p className="text-lg font-bold text-primary-700">{formatCurrency(preview.new_amount)}</p>
                  {preview.new_grade && preview.new_grade !== preview.current_grade && (
                    <p className="text-xs text-primary-600 mt-1">Grade: {preview.new_grade}</p>
                  )}
                  {preview.new_position && preview.new_position !== preview.current_position && (
                    <p className="text-xs text-primary-600">Position: {preview.new_position}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                <span className={`text-sm font-bold ${preview.salary_diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {preview.salary_diff >= 0 ? '+' : ''}{formatCurrency(preview.salary_diff)} / month
                </span>
                {preview.processing_period && (
                  <span className="text-xs text-gray-500">
                    Processing Period: {preview.processing_period}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Effective From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Effective From *</label>
            <Input
              type="date"
              value={createForm.effective_from}
              onChange={(e) => setCreateForm({ ...createForm, effective_from: e.target.value })}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Optional description..."
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
            <Button variant="secondary" onClick={() => { setShowCreateModal(false); resetCreateForm() }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!createForm.employee || !createForm.new_notch || !createForm.reason || !createForm.effective_from || createMutation.isPending}
              onClick={handleCreateSubmit}
            >
              {createMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Bulk Upgrade Modal ─── */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => { setShowBulkModal(false); resetBulkForm() }}
        title="Bulk Salary Upgrade"
        size="lg"
      >
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Employee Selection */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={bulkForm.all_active}
                onChange={(e) => setBulkForm({ ...bulkForm, all_active: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              All active employees
            </label>
          </div>

          {!bulkForm.all_active && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Division</label>
                <select
                  value={bulkForm.division}
                  onChange={(e) => setBulkForm({ ...bulkForm, division: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All</option>
                  {(divisions || []).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Directorate</label>
                <select
                  value={bulkForm.directorate}
                  onChange={(e) => setBulkForm({ ...bulkForm, directorate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All</option>
                  {(directorates || []).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                <select
                  value={bulkForm.department}
                  onChange={(e) => setBulkForm({ ...bulkForm, department: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All</option>
                  {(departments || []).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Grade</label>
                <select
                  value={bulkForm.grade}
                  onChange={(e) => setBulkForm({ ...bulkForm, grade: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All</option>
                  {(jobGrades || []).map((g: any) => (
                    <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Region</label>
                <select
                  value={bulkForm.region}
                  onChange={(e) => setBulkForm({ ...bulkForm, region: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All</option>
                  {(regions || []).map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">District</label>
                <select
                  value={bulkForm.district}
                  onChange={(e) => setBulkForm({ ...bulkForm, district: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All</option>
                  {(districts || []).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                <select
                  value={bulkForm.work_location}
                  onChange={(e) => setBulkForm({ ...bulkForm, work_location: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All</option>
                  {(locations || []).map((l: any) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Staff Category</label>
                <select
                  value={bulkForm.staff_category}
                  onChange={(e) => setBulkForm({ ...bulkForm, staff_category: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All</option>
                  {(staffCategories || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <Select
              value={bulkForm.reason}
              onChange={(e) => setBulkForm({ ...bulkForm, reason: e.target.value, new_grade: '', new_position: '' })}
              options={[{ value: '', label: 'Select reason...' }, ...reasonOptions]}
            />
          </div>

          {/* Grade (for PROMOTION / GRADE_UPGRADE) */}
          {showGradeSelector(bulkForm.reason) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Job Grade</label>
              <select
                value={bulkForm.new_grade}
                onChange={(e) => setBulkForm({ ...bulkForm, new_grade: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select grade...</option>
                {(jobGrades || []).map((g: any) => (
                  <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Position (for PROMOTION) */}
          {showPositionSelector(bulkForm.reason) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Job Position</label>
              <select
                value={bulkForm.new_position}
                onChange={(e) => setBulkForm({ ...bulkForm, new_position: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select position...</option>
                {(jobPositions || []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Cascading Notch Selectors */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Band *</label>
              <select
                value={bulkForm.new_band}
                onChange={(e) => setBulkForm({ ...bulkForm, new_band: e.target.value, new_level: '', new_notch: '' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select band...</option>
                {(salaryBands || []).map((b: any) => (
                  <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Level *</label>
              <select
                value={bulkForm.new_level}
                onChange={(e) => setBulkForm({ ...bulkForm, new_level: e.target.value, new_notch: '' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                disabled={!bulkForm.new_band}
              >
                <option value="">Select level...</option>
                {(salaryLevels || []).map((l: any) => (
                  <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Notch *</label>
              <select
                value={bulkForm.new_notch}
                onChange={(e) => setBulkForm({ ...bulkForm, new_notch: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                disabled={!bulkForm.new_level}
              >
                <option value="">Select notch...</option>
                {(salaryNotches || []).map((n: any) => (
                  <option key={n.id} value={n.id}>{n.code} — {n.name} ({formatCurrency(n.amount)})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Effective From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Effective From *</label>
            <Input
              type="date"
              value={bulkForm.effective_from}
              onChange={(e) => setBulkForm({ ...bulkForm, effective_from: e.target.value })}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={bulkForm.description}
              onChange={(e) => setBulkForm({ ...bulkForm, description: e.target.value })}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Optional description..."
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
            <Button variant="secondary" onClick={() => { setShowBulkModal(false); resetBulkForm() }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!bulkForm.new_notch || !bulkForm.reason || !bulkForm.effective_from || bulkMutation.isPending}
              onClick={handleBulkSubmit}
            >
              {bulkMutation.isPending ? 'Submitting...' : 'Submit Bulk for Approval'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Confirm Modal ─── */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => { setShowConfirmModal(false); setPendingSubmit(null) }}
        title="Confirm Submission"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {pendingSubmit === 'individual'
              ? 'This will create a salary upgrade request that requires approval before taking effect.'
              : 'This will create bulk salary upgrade requests that each require approval before taking effect.'}
          </p>
          {pendingSubmit === 'individual' && preview && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p><strong>{preview.employee_name}</strong></p>
              <p className="text-gray-600">{formatCurrency(preview.current_amount)} &rarr; {formatCurrency(preview.new_amount)}</p>
              <p className={`font-semibold ${preview.salary_diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {preview.salary_diff >= 0 ? '+' : ''}{formatCurrency(preview.salary_diff)} / month
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setShowConfirmModal(false); setPendingSubmit(null) }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={createMutation.isPending || bulkMutation.isPending}
            >
              {createMutation.isPending || bulkMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Reject Modal ─── */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectTarget(null); setRejectionReason('') }}
        title="Reject Upgrade Request"
        size="sm"
      >
        <div className="space-y-4">
          {rejectTarget && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-medium">{rejectTarget.employee_name}</p>
              <p className="text-xs text-gray-500">{rejectTarget.reference_number}</p>
              <p className="text-gray-600 mt-1">
                {formatCurrency(rejectTarget.current_salary)} &rarr; {formatCurrency(rejectTarget.new_notch_amount)}
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason *</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Explain why this request is being rejected..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setShowRejectModal(false); setRejectTarget(null); setRejectionReason('') }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
              onClick={handleRejectConfirm}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
