import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  UserMinusIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  FlagIcon,
} from '@heroicons/react/24/outline'
import { payrollService } from '@/services/payroll'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { TablePagination } from '@/components/ui/Table'
import { formatDate } from '@/lib/utils'

type TabType = 'dashboard' | 'validation' | 'regional' | 'reasons'

const statusColors: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'default',
  IN_PROGRESS: 'info',
  VALIDATED: 'success',
  SUBMITTED: 'warning',
  OVERDUE: 'danger',
}

export default function PayrollValidationPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedValidation, setSelectedValidation] = useState<any>(null)
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [showOpenWindowModal, setShowOpenWindowModal] = useState(false)
  const [flagData, setFlagData] = useState({ employee: '', removal_reason: '', reason_detail: '' })
  const [reasonForm, setReasonForm] = useState({ code: '', name: '', description: '', is_active: true, sort_order: 0 })
  const [editingReasonId, setEditingReasonId] = useState<string | null>(null)
  const [deadline, setDeadline] = useState('')
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [approvalNotes, setApprovalNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [selectedRegionalValidation, setSelectedRegionalValidation] = useState<any>(null)
  // searchTerm state removed - not currently used

  // Fetch periods
  const { data: periods = [] } = useQuery({
    queryKey: ['payroll-periods'],
    queryFn: () => payrollService.getPeriods(),
  })

  // Fetch dashboard
  const { data: dashboard } = useQuery({
    queryKey: ['validation-dashboard', selectedPeriodId],
    queryFn: () => payrollService.getValidationDashboard(selectedPeriodId),
    enabled: !!selectedPeriodId,
  })

  // Fetch validations list
  const { data: validationsData } = useQuery({
    queryKey: ['validations', selectedPeriodId, page, pageSize],
    queryFn: () => payrollService.getValidations(selectedPeriodId || undefined, { page, page_size: pageSize }),
    enabled: !!selectedPeriodId,
  })
  const validations = validationsData?.results || validationsData || []
  const totalValidationItems = validationsData?.count || validations.length
  const totalValidationPages = Math.ceil(totalValidationItems / pageSize)

  // Fetch validation detail
  const { data: validationDetail } = useQuery({
    queryKey: ['validation-detail', selectedValidation?.id],
    queryFn: () => payrollService.getValidation(selectedValidation.id),
    enabled: !!selectedValidation?.id,
  })

  // Fetch removal reasons
  const { data: removalReasons = [] } = useQuery({
    queryKey: ['removal-reasons'],
    queryFn: () => payrollService.getRemovalReasons(),
  })

  // My validations (for district managers)
  const { data: myValidations = [] } = useQuery({
    queryKey: ['my-validations', selectedPeriodId],
    queryFn: () => payrollService.getMyValidations(selectedPeriodId || undefined),
    enabled: activeTab === 'validation',
  })

  // Regional validations (for regional directors)
  const { data: regionalValidations = [] } = useQuery({
    queryKey: ['regional-validations', selectedPeriodId],
    queryFn: () => payrollService.getRegionalValidations(selectedPeriodId),
    enabled: !!selectedPeriodId,
  })

  // Open validation window
  const openWindowMutation = useMutation({
    mutationFn: () => payrollService.openValidationWindow(selectedPeriodId, deadline || undefined),
    onSuccess: (data) => {
      toast.success(data.message || 'Validation window opened')
      queryClient.invalidateQueries({ queryKey: ['validations'] })
      queryClient.invalidateQueries({ queryKey: ['validation-dashboard'] })
      setShowOpenWindowModal(false)
      setDeadline('')
    },
    onError: () => toast.error('Failed to open validation window'),
  })

  // Submit validation
  const submitMutation = useMutation({
    mutationFn: (id: string) => payrollService.submitValidation(id),
    onSuccess: () => {
      toast.success('Validation submitted successfully')
      queryClient.invalidateQueries({ queryKey: ['validations'] })
      queryClient.invalidateQueries({ queryKey: ['validation-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['validation-detail'] })
      queryClient.invalidateQueries({ queryKey: ['my-validations'] })
    },
    onError: () => toast.error('Failed to submit validation'),
  })

  // Flag employee
  const flagMutation = useMutation({
    mutationFn: (data: { validationId: string; payload: any }) =>
      payrollService.flagEmployee(data.validationId, data.payload),
    onSuccess: () => {
      toast.success('Employee flagged for removal')
      queryClient.invalidateQueries({ queryKey: ['validation-detail'] })
      queryClient.invalidateQueries({ queryKey: ['validations'] })
      setShowFlagModal(false)
      setFlagData({ employee: '', removal_reason: '', reason_detail: '' })
    },
    onError: () => toast.error('Failed to flag employee'),
  })

  // Reinstate employee
  const reinstateMutation = useMutation({
    mutationFn: (data: { validationId: string; employeeId: string }) =>
      payrollService.reinstateEmployee(data.validationId, data.employeeId),
    onSuccess: () => {
      toast.success('Employee reinstated')
      queryClient.invalidateQueries({ queryKey: ['validation-detail'] })
      queryClient.invalidateQueries({ queryKey: ['validations'] })
    },
    onError: () => toast.error('Failed to reinstate employee'),
  })

  // Create/Update removal reason
  const saveReasonMutation = useMutation({
    mutationFn: (data: any) =>
      editingReasonId
        ? payrollService.updateRemovalReason(editingReasonId, data)
        : payrollService.createRemovalReason(data),
    onSuccess: () => {
      toast.success(editingReasonId ? 'Reason updated' : 'Reason created')
      queryClient.invalidateQueries({ queryKey: ['removal-reasons'] })
      setShowReasonModal(false)
      setReasonForm({ code: '', name: '', description: '', is_active: true, sort_order: 0 })
      setEditingReasonId(null)
    },
    onError: () => toast.error('Failed to save reason'),
  })

  // Delete removal reason
  const deleteReasonMutation = useMutation({
    mutationFn: (id: string) => payrollService.deleteRemovalReason(id),
    onSuccess: () => {
      toast.success('Reason deleted')
      queryClient.invalidateQueries({ queryKey: ['removal-reasons'] })
    },
    onError: () => toast.error('Failed to delete reason'),
  })

  // Approve validation (Regional Director)
  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      payrollService.approveValidation(id, notes),
    onSuccess: () => {
      toast.success('Validation approved')
      queryClient.invalidateQueries({ queryKey: ['regional-validations'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-validations'] })
      queryClient.invalidateQueries({ queryKey: ['validation-dashboard'] })
      setShowApproveModal(false)
      setSelectedRegionalValidation(null)
      setApprovalNotes('')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to approve'),
  })

  // Reject validation (Regional Director)
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      payrollService.rejectValidation(id, reason),
    onSuccess: () => {
      toast.success('Validation rejected and sent back for review')
      queryClient.invalidateQueries({ queryKey: ['regional-validations'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-validations'] })
      queryClient.invalidateQueries({ queryKey: ['validation-dashboard'] })
      setShowRejectModal(false)
      setSelectedRegionalValidation(null)
      setRejectionReason('')
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to reject'),
  })

  // Set default period to latest
  if (periods.length > 0 && !selectedPeriodId) {
    setSelectedPeriodId(periods[0].id)
  }

  const tabs = [
    { key: 'dashboard' as TabType, label: 'Dashboard', icon: ChartBarIcon },
    { key: 'validation' as TabType, label: 'District Validation', icon: ClipboardDocumentCheckIcon },
    { key: 'regional' as TabType, label: 'Regional Approval', icon: CheckCircleIcon },
    { key: 'reasons' as TabType, label: 'Removal Reasons', icon: FlagIcon },
  ]

  // Combine validations for district tab (my validations + all if admin)
  const districtValidations = activeTab === 'validation'
    ? (myValidations.length > 0 ? myValidations : validations)
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Validation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Verify employee payroll lists before monthly processing
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedPeriodId}
            onChange={(e) => { setSelectedPeriodId(e.target.value); setPage(1); }}
            className="w-48"
            options={[
              { value: '', label: 'Select Period' },
              ...periods.map((p: any) => ({ value: p.id, label: p.name })),
            ]}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors duration-150 ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={() => setShowOpenWindowModal(true)}
              disabled={!selectedPeriodId}
              className="flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Open Validation Window
            </Button>
          </div>

          {/* Stats Cards */}
          {dashboard && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Districts</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{dashboard.total_districts}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Validated</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{dashboard.validated_count}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">{dashboard.pending_count}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Submitted</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{dashboard.submitted_count || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Overdue</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{dashboard.overdue_count}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Flagged</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">{dashboard.total_flagged}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {dashboard && dashboard.total_districts > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Completion</span>
                  <span className="text-sm font-bold text-gray-900">{dashboard.completion_percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-colors duration-150"
                    style={{ width: `${dashboard.completion_percentage}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Validations Table */}
          <Card>
            <CardHeader>
              <CardTitle>District Validations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">District</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Validated</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Flagged</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deadline</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validated By</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {validations.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          {selectedPeriodId ? 'No validations found. Open a validation window to get started.' : 'Select a payroll period'}
                        </td>
                      </tr>
                    ) : (
                      validations.map((v: any) => (
                        <tr key={v.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{v.district_name}</td>
                          <td className="px-4 py-3">
                            <Badge variant={statusColors[v.status] || 'default'}>{v.status_display}</Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-600">{v.total_employees}</td>
                          <td className="px-4 py-3 text-sm text-center text-gray-600">{v.validated_employees}</td>
                          <td className="px-4 py-3 text-sm text-center">
                            {v.flagged_employees > 0 ? (
                              <span className="text-red-600 font-medium">{v.flagged_employees}</span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {v.deadline ? formatDate(v.deadline) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{v.validated_by_name || '-'}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedValidation(v)
                                setActiveTab('validation')
                              }}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          {validations.length > 0 && (
            <TablePagination
              currentPage={page}
              totalPages={totalValidationPages}
              totalItems={totalValidationItems}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          )}
        </div>
      )}

      {/* District Validation Tab */}
      {activeTab === 'validation' && (
        <div className="space-y-6">
          {/* Validation selector or detail view */}
          {!selectedValidation ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Select a district validation to manage employees.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {districtValidations.map((v: any) => (
                  <Card
                    key={v.id}
                    className="cursor-pointer hover:ring-2 hover:ring-primary-500 transition-colors duration-150"
                    onClick={() => setSelectedValidation(v)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{v.district_name}</h3>
                        <Badge variant={statusColors[v.status] || 'default'} className="text-xs">{v.status_display}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{v.total_employees} employees</span>
                        {v.flagged_employees > 0 && (
                          <span className="text-red-600">{v.flagged_employees} flagged</span>
                        )}
                      </div>
                      {v.deadline && (
                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                          <ClockIcon className="h-3 w-3" /> Deadline: {formatDate(v.deadline)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Back button and header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedValidation(null)}>
                    &larr; Back
                  </Button>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedValidation.district_name} - {selectedValidation.period_name}
                  </h2>
                  <Badge variant={statusColors[selectedValidation.status] || 'default'}>
                    {selectedValidation.status_display}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {selectedValidation.status !== 'VALIDATED' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFlagModal(true)}
                        className="flex items-center gap-1"
                      >
                        <UserMinusIcon className="h-4 w-4" />
                        Flag Employee
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => submitMutation.mutate(selectedValidation.id)}
                        disabled={submitMutation.isPending}
                        className="flex items-center gap-1"
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                        Submit Validation
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-gray-500">Total Employees</p>
                    <p className="text-xl font-bold">{selectedValidation.total_employees}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-gray-500">Confirmed</p>
                    <p className="text-xl font-bold text-green-600">
                      {selectedValidation.total_employees - (validationDetail?.flagged_employees || selectedValidation.flagged_employees || 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-gray-500">Flagged</p>
                    <p className="text-xl font-bold text-red-600">
                      {validationDetail?.flagged_employees || selectedValidation.flagged_employees || 0}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Flagged Employees */}
              {validationDetail?.flags && validationDetail.flags.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                      Flagged Employees
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Detail</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {validationDetail.flags.map((flag: any) => (
                            <tr key={flag.id}>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">{flag.employee_name}</td>
                              <td className="px-4 py-2 text-sm text-gray-600">{flag.employee_number}</td>
                              <td className="px-4 py-2 text-sm text-gray-600">{flag.removal_reason_name}</td>
                              <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">{flag.reason_detail || '-'}</td>
                              <td className="px-4 py-2">
                                <Badge variant={flag.status === 'FLAGGED' ? 'danger' : 'success'}>
                                  {flag.status_display}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-right">
                                {flag.status === 'FLAGGED' && selectedValidation.status !== 'VALIDATED' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => reinstateMutation.mutate({
                                      validationId: selectedValidation.id,
                                      employeeId: flag.employee,
                                    })}
                                    disabled={reinstateMutation.isPending}
                                  >
                                    <ArrowPathIcon className="h-4 w-4 mr-1" />
                                    Reinstate
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* Regional Approval Tab */}
      {activeTab === 'regional' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Regional Approval</h2>
            <p className="text-sm text-gray-500 mt-1">
              Review and approve district validations submitted by District Managers
            </p>
          </div>

          {regionalValidations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardDocumentCheckIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {selectedPeriodId ? 'No validations pending regional approval' : 'Select a payroll period'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">District</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Confirmed</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Flagged</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted By</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approved By</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {regionalValidations.map((v: any) => (
                        <tr key={v.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{v.district_name}</td>
                          <td className="px-4 py-3">
                            <Badge variant={statusColors[v.status] || 'default'}>{v.status_display}</Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-600">{v.total_employees}</td>
                          <td className="px-4 py-3 text-sm text-center text-gray-600">{v.validated_employees}</td>
                          <td className="px-4 py-3 text-sm text-center">
                            {v.flagged_employees > 0 ? (
                              <span className="text-red-600 font-medium">{v.flagged_employees}</span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{v.validated_by_name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{v.approved_by_name || '-'}</td>
                          <td className="px-4 py-3 text-right">
                            {v.status === 'SUBMITTED' && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() => {
                                    setSelectedRegionalValidation(v)
                                    setApprovalNotes('')
                                    setShowApproveModal(true)
                                  }}
                                >
                                  <CheckIcon className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => {
                                    setSelectedRegionalValidation(v)
                                    setRejectionReason('')
                                    setShowRejectModal(true)
                                  }}
                                >
                                  <XMarkIcon className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                            {v.status === 'VALIDATED' && (
                              <span className="text-xs text-green-600 font-medium">Approved</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Removal Reasons Tab */}
      {activeTab === 'reasons' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Removal Reason Categories</h2>
            <Button
              onClick={() => {
                setEditingReasonId(null)
                setReasonForm({ code: '', name: '', description: '', is_active: true, sort_order: 0 })
                setShowReasonModal(true)
              }}
              className="flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Add Reason
            </Button>
          </div>

          <Card>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Active</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Order</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {removalReasons.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No removal reasons configured. Add one to get started.
                        </td>
                      </tr>
                    ) : (
                      removalReasons.map((reason: any) => (
                        <tr key={reason.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">{reason.code}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{reason.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{reason.description || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            {reason.is_active ? (
                              <CheckIcon className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <XMarkIcon className="h-5 w-5 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-600">{reason.sort_order}</td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingReasonId(reason.id)
                                setReasonForm({
                                  code: reason.code,
                                  name: reason.name,
                                  description: reason.description || '',
                                  is_active: reason.is_active,
                                  sort_order: reason.sort_order,
                                })
                                setShowReasonModal(true)
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => {
                                if (confirm('Delete this removal reason?')) {
                                  deleteReasonMutation.mutate(reason.id)
                                }
                              }}
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Open Validation Window Modal */}
      <Modal
        isOpen={showOpenWindowModal}
        onClose={() => setShowOpenWindowModal(false)}
        title="Open Validation Window"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This will create validation records for all active districts in the selected period.
            District managers will be able to review and validate their employee lists.
          </p>
          <Input
            label="Deadline (optional)"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowOpenWindowModal(false)}>Cancel</Button>
            <Button
              onClick={() => openWindowMutation.mutate()}
              disabled={openWindowMutation.isPending}
            >
              {openWindowMutation.isPending ? 'Opening...' : 'Open Window'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Flag Employee Modal */}
      <Modal
        isOpen={showFlagModal}
        onClose={() => setShowFlagModal(false)}
        title="Flag Employee for Removal"
      >
        <div className="space-y-4">
          <Input
            label="Employee ID"
            placeholder="Enter employee UUID"
            value={flagData.employee}
            onChange={(e) => setFlagData({ ...flagData, employee: e.target.value })}
          />
          <Select
            label="Removal Reason"
            value={flagData.removal_reason}
            onChange={(e) => setFlagData({ ...flagData, removal_reason: e.target.value })}
            options={[
              { value: '', label: 'Select Reason' },
              ...removalReasons.map((r: any) => ({ value: r.id, label: r.name })),
            ]}
          />
          <Input
            label="Additional Detail (optional)"
            value={flagData.reason_detail}
            onChange={(e) => setFlagData({ ...flagData, reason_detail: e.target.value })}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowFlagModal(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!flagData.employee || !flagData.removal_reason) {
                  toast.error('Employee and removal reason are required')
                  return
                }
                flagMutation.mutate({
                  validationId: selectedValidation?.id,
                  payload: flagData,
                })
              }}
              disabled={flagMutation.isPending}
            >
              {flagMutation.isPending ? 'Flagging...' : 'Flag Employee'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Removal Reason Modal */}
      <Modal
        isOpen={showReasonModal}
        onClose={() => setShowReasonModal(false)}
        title={editingReasonId ? 'Edit Removal Reason' : 'Add Removal Reason'}
      >
        <div className="space-y-4">
          <Input
            label="Code"
            placeholder="e.g., ABANDONMENT"
            value={reasonForm.code}
            onChange={(e) => setReasonForm({ ...reasonForm, code: e.target.value })}
          />
          <Input
            label="Name"
            placeholder="e.g., Abandonment of Post"
            value={reasonForm.name}
            onChange={(e) => setReasonForm({ ...reasonForm, name: e.target.value })}
          />
          <Input
            label="Description"
            placeholder="Description of this removal reason"
            value={reasonForm.description}
            onChange={(e) => setReasonForm({ ...reasonForm, description: e.target.value })}
          />
          <Input
            label="Sort Order"
            type="number"
            value={reasonForm.sort_order}
            onChange={(e) => setReasonForm({ ...reasonForm, sort_order: parseInt(e.target.value) || 0 })}
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={reasonForm.is_active}
              onChange={(e) => setReasonForm({ ...reasonForm, is_active: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-[#0969da]"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowReasonModal(false)}>Cancel</Button>
            <Button
              onClick={() => saveReasonMutation.mutate(reasonForm)}
              disabled={saveReasonMutation.isPending}
            >
              {saveReasonMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approve Validation Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => { setShowApproveModal(false); setSelectedRegionalValidation(null) }}
        title="Approve District Validation"
      >
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-sm text-green-800">
              You are approving the payroll validation for <strong>{selectedRegionalValidation?.district_name}</strong>.
              This confirms that the employee list has been verified and is ready for payroll processing.
            </p>
          </div>
          {selectedRegionalValidation && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-lg font-bold">{selectedRegionalValidation.total_employees}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-xs text-gray-500">Confirmed</p>
                <p className="text-lg font-bold text-green-600">{selectedRegionalValidation.validated_employees}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-xs text-gray-500">Flagged</p>
                <p className="text-lg font-bold text-red-600">{selectedRegionalValidation.flagged_employees}</p>
              </div>
            </div>
          )}
          <Input
            label="Approval Notes (optional)"
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.target.value)}
            placeholder="Any additional notes..."
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setShowApproveModal(false); setSelectedRegionalValidation(null) }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedRegionalValidation) {
                  approveMutation.mutate({ id: selectedRegionalValidation.id, notes: approvalNotes })
                }
              }}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve Validation'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Validation Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setSelectedRegionalValidation(null) }}
        title="Reject District Validation"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800">
              You are rejecting the payroll validation for <strong>{selectedRegionalValidation?.district_name}</strong>.
              This will send it back to the District Manager for correction.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] sm:text-sm bg-gray-50 focus:bg-white hover:border-gray-400 transition-colors duration-150"
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explain why this validation is being rejected..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setShowRejectModal(false); setSelectedRegionalValidation(null) }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!rejectionReason.trim()) {
                  toast.error('A rejection reason is required')
                  return
                }
                if (selectedRegionalValidation) {
                  rejectMutation.mutate({ id: selectedRegionalValidation.id, reason: rejectionReason })
                }
              }}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Validation'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
