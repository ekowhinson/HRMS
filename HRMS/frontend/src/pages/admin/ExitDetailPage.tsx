import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentCheckIcon,
  UserIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ChatBubbleLeftRightIcon,
  ArchiveBoxIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import { exitService, type ExitClearance, type AssetReturn } from '@/services/exits'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  SUBMITTED: 'info',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  REJECTED: 'danger',
  IN_PROGRESS: 'info',
  CLEARANCE: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
  WITHDRAWN: 'default',
}

export default function ExitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [showClearanceModal, setShowClearanceModal] = useState(false)
  const [showAssetModal, setShowAssetModal] = useState(false)
  const [selectedClearance, setSelectedClearance] = useState<ExitClearance | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<AssetReturn | null>(null)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve')
  const [approvalComments, setApprovalComments] = useState('')
  const [actualLastDay, setActualLastDay] = useState('')

  // Clearance form state
  const [clearanceForm, setClearanceForm] = useState({
    comments: '',
    outstanding_items: '',
    conditions: '',
    amount_owed: 0,
    amount_due: 0,
  })

  // Asset form state
  const [assetForm, setAssetForm] = useState({
    asset_name: '',
    asset_type: '',
    asset_tag: '',
    description: '',
  })

  // Asset return form state
  const [assetReturnForm, setAssetReturnForm] = useState({
    status: 'RETURNED' as AssetReturn['status'],
    condition_notes: '',
    deduction_amount: 0,
  })

  // Fetch exit request
  const { data: exitRequest, isLoading } = useQuery({
    queryKey: ['exit-request', id],
    queryFn: () => exitService.getExitRequest(id!),
    enabled: !!id,
  })

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: () => exitService.submitExitRequest(id!),
    onSuccess: () => {
      toast.success('Exit request submitted for approval')
      queryClient.invalidateQueries({ queryKey: ['exit-request', id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to submit request')
    },
  })

  // Approve/Reject mutation
  const approveMutation = useMutation({
    mutationFn: ({ action, comments, lastDay }: { action: 'approve' | 'reject'; comments: string; lastDay?: string }) =>
      exitService.approveExitRequest(id!, action, comments, lastDay),
    onSuccess: () => {
      toast.success(approvalAction === 'approve' ? 'Exit request approved' : 'Exit request rejected')
      queryClient.invalidateQueries({ queryKey: ['exit-request', id] })
      setShowApprovalModal(false)
      setApprovalComments('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to process request')
    },
  })

  // Complete mutation
  const completeMutation = useMutation({
    mutationFn: () => exitService.completeExitRequest(id!),
    onSuccess: () => {
      toast.success('Exit completed successfully')
      queryClient.invalidateQueries({ queryKey: ['exit-request', id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to complete exit')
    },
  })

  // Withdraw mutation
  const withdrawMutation = useMutation({
    mutationFn: () => exitService.withdrawExitRequest(id!),
    onSuccess: () => {
      toast.success('Exit request withdrawn')
      queryClient.invalidateQueries({ queryKey: ['exit-request', id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to withdraw request')
    },
  })

  // Clear clearance mutation
  const clearMutation = useMutation({
    mutationFn: ({ clearanceId, data }: { clearanceId: string; data: typeof clearanceForm }) =>
      exitService.clearClearance(clearanceId, data),
    onSuccess: () => {
      toast.success('Clearance completed')
      queryClient.invalidateQueries({ queryKey: ['exit-request', id] })
      setShowClearanceModal(false)
      setClearanceForm({ comments: '', outstanding_items: '', conditions: '', amount_owed: 0, amount_due: 0 })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to clear')
    },
  })

  // Add asset mutation
  const addAssetMutation = useMutation({
    mutationFn: (data: typeof assetForm) =>
      exitService.createAssetReturn({ ...data, exit_request: id! }),
    onSuccess: () => {
      toast.success('Asset added')
      queryClient.invalidateQueries({ queryKey: ['exit-request', id] })
      setShowAssetModal(false)
      setAssetForm({ asset_name: '', asset_type: '', asset_tag: '', description: '' })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to add asset')
    },
  })

  // Process asset return mutation
  const processAssetMutation = useMutation({
    mutationFn: ({ assetId, status, notes, deduction }: { assetId: string; status: AssetReturn['status']; notes: string; deduction: number }) =>
      exitService.processAssetReturn(assetId, status, notes, deduction),
    onSuccess: () => {
      toast.success('Asset return processed')
      queryClient.invalidateQueries({ queryKey: ['exit-request', id] })
      setSelectedAsset(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to process return')
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!exitRequest) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Exit request not found</p>
        <Button variant="outline" onClick={() => navigate('/admin/exits')} className="mt-4">
          Back to Exits
        </Button>
      </div>
    )
  }

  const canSubmit = exitRequest.status === 'DRAFT'
  const canApprove = exitRequest.status === 'SUBMITTED' || exitRequest.status === 'PENDING_APPROVAL'
  const canComplete = (exitRequest.status === 'IN_PROGRESS' || exitRequest.status === 'CLEARANCE') &&
    exitRequest.is_clearance_complete
  const canWithdraw = !['COMPLETED', 'CANCELLED', 'WITHDRAWN'].includes(exitRequest.status)

  const assetStatusOptions = [
    { value: 'RETURNED', label: 'Returned' },
    { value: 'DAMAGED', label: 'Returned Damaged' },
    { value: 'LOST', label: 'Lost/Missing' },
    { value: 'WRITTEN_OFF', label: 'Written Off' },
    { value: 'PURCHASED', label: 'Purchased by Employee' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/exits')}>
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{exitRequest.request_number}</h1>
              <Badge variant={statusColors[exitRequest.status]}>{exitRequest.status_display}</Badge>
            </div>
            <p className="text-sm text-gray-500">{exitRequest.exit_type_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canSubmit && (
            <Button onClick={() => submitMutation.mutate()} isLoading={submitMutation.isPending}>
              Submit for Approval
            </Button>
          )}
          {canApprove && (
            <>
              <Button
                variant="success"
                onClick={() => {
                  setApprovalAction('approve')
                  setShowApprovalModal(true)
                }}
              >
                <CheckCircleIcon className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setApprovalAction('reject')
                  setShowApprovalModal(true)
                }}
              >
                <XCircleIcon className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </>
          )}
          {canComplete && (
            <Button
              variant="success"
              onClick={() => completeMutation.mutate()}
              isLoading={completeMutation.isPending}
            >
              <CheckCircleIcon className="h-4 w-4 mr-2" />
              Complete Exit
            </Button>
          )}
          {canWithdraw && (
            <Button variant="outline" onClick={() => withdrawMutation.mutate()} isLoading={withdrawMutation.isPending}>
              Withdraw
            </Button>
          )}
        </div>
      </div>

      {/* Employee & Exit Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <UserIcon className="h-5 w-5 mr-2 text-primary-500" />
              Employee Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium">{exitRequest.employee_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Employee Number</span>
              <span className="font-medium">{exitRequest.employee_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Department</span>
              <span className="font-medium">{exitRequest.department_name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Position</span>
              <span className="font-medium">{exitRequest.position_name || '-'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2 text-primary-500" />
              Exit Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Exit Type</span>
              <span className="font-medium">{exitRequest.exit_type_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Request Date</span>
              <span className="font-medium">
                {new Date(exitRequest.request_date).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Proposed Last Day</span>
              <span className="font-medium">
                {new Date(exitRequest.proposed_last_day).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Actual Last Day</span>
              <span className="font-medium">
                {exitRequest.actual_last_day
                  ? new Date(exitRequest.actual_last_day).toLocaleDateString()
                  : 'Not set'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reason */}
      <Card>
        <CardHeader>
          <CardTitle>Reason for Exit</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 whitespace-pre-wrap">{exitRequest.reason}</p>
          {exitRequest.additional_comments && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500 mb-1">Additional Comments</p>
              <p className="text-gray-700">{exitRequest.additional_comments}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="border-b">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="clearances">
                Clearances ({exitRequest.clearances?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="assets">
                Assets ({exitRequest.asset_returns?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="interview">Exit Interview</TabsTrigger>
              <TabsTrigger value="settlement">Final Settlement</TabsTrigger>
            </TabsList>
          </CardHeader>

          <TabsContent value="overview" className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <ClipboardDocumentCheckIcon className="h-8 w-8 mx-auto mb-2 text-primary-500" />
                  <p className="text-2xl font-bold">
                    {exitRequest.clearances?.filter((c) => c.is_cleared).length || 0}/
                    {exitRequest.clearances?.length || 0}
                  </p>
                  <p className="text-sm text-gray-500">Clearances Completed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <ArchiveBoxIcon className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold">
                    {exitRequest.asset_returns?.filter((a) => a.status !== 'PENDING').length || 0}/
                    {exitRequest.asset_returns?.length || 0}
                  </p>
                  <p className="text-sm text-gray-500">Assets Returned</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <ChatBubbleLeftRightIcon className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-2xl font-bold">
                    {exitRequest.exit_interview?.status === 'COMPLETED' ? 'Done' : 'Pending'}
                  </p>
                  <p className="text-sm text-gray-500">Exit Interview</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="clearances" className="p-6">
            <div className="space-y-4">
              {exitRequest.clearances?.map((clearance) => (
                <div
                  key={clearance.id}
                  className={`p-4 border rounded-md ${clearance.is_cleared ? 'bg-green-50 border-green-200' : 'bg-white'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {clearance.is_cleared ? (
                        <CheckCircleIcon className="h-6 w-6 text-green-500" />
                      ) : (
                        <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                      )}
                      <div>
                        <p className="font-medium">{clearance.department_name}</p>
                        <p className="text-sm text-gray-500">{clearance.department_code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {clearance.is_cleared ? (
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Cleared by</p>
                          <p className="text-sm font-medium">{clearance.cleared_by_name}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(clearance.cleared_at!).toLocaleString()}
                          </p>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedClearance(clearance)
                            setShowClearanceModal(true)
                          }}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                  {clearance.comments && (
                    <p className="mt-2 text-sm text-gray-600 ml-9">{clearance.comments}</p>
                  )}
                  {/* Checklist Items */}
                  {clearance.checklist_items?.length > 0 && (
                    <div className="mt-3 ml-9 space-y-1">
                      {clearance.checklist_items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={item.is_completed}
                            disabled
                            className="h-4 w-4 text-primary-600 rounded"
                          />
                          <span className={item.is_completed ? 'line-through text-gray-400' : ''}>
                            {item.item_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="assets" className="p-6">
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => setShowAssetModal(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Asset
              </Button>
            </div>
            {exitRequest.asset_returns && exitRequest.asset_returns.length > 0 ? (
              <div className="space-y-4">
                {exitRequest.asset_returns.map((asset) => (
                  <div key={asset.id} className="p-4 border rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{asset.asset_name}</p>
                        <p className="text-sm text-gray-500">
                          {asset.asset_type} {asset.asset_tag && `- ${asset.asset_tag}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge
                          variant={
                            asset.status === 'RETURNED'
                              ? 'success'
                              : asset.status === 'PENDING'
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {asset.status_display}
                        </Badge>
                        {asset.status === 'PENDING' && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedAsset(asset)
                              setAssetReturnForm({
                                status: 'RETURNED',
                                condition_notes: '',
                                deduction_amount: 0,
                              })
                            }}
                          >
                            Process Return
                          </Button>
                        )}
                      </div>
                    </div>
                    {asset.deduction_amount > 0 && (
                      <p className="mt-2 text-sm text-red-600">
                        Deduction: GHS {asset.deduction_amount.toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No assets to return</p>
            )}
          </TabsContent>

          <TabsContent value="interview" className="p-6">
            {exitRequest.exit_interview ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={
                      exitRequest.exit_interview.status === 'COMPLETED'
                        ? 'success'
                        : exitRequest.exit_interview.status === 'SCHEDULED'
                          ? 'info'
                          : 'default'
                    }
                  >
                    {exitRequest.exit_interview.status_display}
                  </Badge>
                  {exitRequest.exit_interview.status !== 'COMPLETED' && (
                    <Button size="sm">Conduct Interview</Button>
                  )}
                </div>
                {exitRequest.exit_interview.status === 'COMPLETED' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500">Reason for Leaving</p>
                        <p className="font-medium">{exitRequest.exit_interview.reason_for_leaving || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Would Recommend Employer</p>
                        <p className="font-medium">
                          {exitRequest.exit_interview.would_recommend_employer === null
                            ? '-'
                            : exitRequest.exit_interview.would_recommend_employer
                              ? 'Yes'
                              : 'No'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Would Return</p>
                        <p className="font-medium">
                          {exitRequest.exit_interview.would_return === null
                            ? '-'
                            : exitRequest.exit_interview.would_return
                              ? 'Yes'
                              : 'No'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500">Job Satisfaction</p>
                        <p className="font-medium">{exitRequest.exit_interview.job_satisfaction || '-'}/5</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Management Satisfaction</p>
                        <p className="font-medium">{exitRequest.exit_interview.management_satisfaction || '-'}/5</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Work-Life Balance</p>
                        <p className="font-medium">{exitRequest.exit_interview.work_life_balance || '-'}/5</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">Exit interview not required</p>
            )}
          </TabsContent>

          <TabsContent value="settlement" className="p-6">
            {exitRequest.final_settlement ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={
                      exitRequest.final_settlement.status === 'PAID'
                        ? 'success'
                        : exitRequest.final_settlement.status === 'APPROVED'
                          ? 'info'
                          : 'warning'
                    }
                  >
                    {exitRequest.final_settlement.status_display}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-green-600">Earnings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span>Salary Arrears</span>
                        <span>GHS {exitRequest.final_settlement.salary_arrears.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Leave Encashment</span>
                        <span>GHS {exitRequest.final_settlement.leave_encashment.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Gratuity</span>
                        <span>GHS {exitRequest.final_settlement.gratuity.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bonus</span>
                        <span>GHS {exitRequest.final_settlement.bonus.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Other Earnings</span>
                        <span>GHS {exitRequest.final_settlement.other_earnings.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t font-bold">
                        <span>Gross Settlement</span>
                        <span className="text-green-600">
                          GHS {exitRequest.final_settlement.gross_settlement.toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-600">Deductions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span>Loan Balance</span>
                        <span>GHS {exitRequest.final_settlement.loan_balance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Advance Balance</span>
                        <span>GHS {exitRequest.final_settlement.advance_balance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Asset Deductions</span>
                        <span>GHS {exitRequest.final_settlement.asset_deductions.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax Deductions</span>
                        <span>GHS {exitRequest.final_settlement.tax_deductions.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Other Deductions</span>
                        <span>GHS {exitRequest.final_settlement.other_deductions.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t font-bold">
                        <span>Total Deductions</span>
                        <span className="text-red-600">
                          GHS {exitRequest.final_settlement.total_deductions.toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CurrencyDollarIcon className="h-8 w-8 text-primary-500" />
                        <div>
                          <p className="text-sm text-gray-500">Net Settlement</p>
                          <p className="text-3xl font-bold text-primary-600">
                            GHS {exitRequest.final_settlement.net_settlement.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No settlement record</p>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Approval Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        title={approvalAction === 'approve' ? 'Approve Exit Request' : 'Reject Exit Request'}
        size="md"
      >
        <div className="space-y-4">
          {approvalAction === 'approve' && (
            <Input
              label="Actual Last Working Day"
              type="date"
              value={actualLastDay}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setActualLastDay(e.target.value)}
            />
          )}
          <Textarea
            label="Comments"
            value={approvalComments}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setApprovalComments(e.target.value)}
            placeholder={approvalAction === 'approve' ? 'Approval comments...' : 'Rejection reason...'}
            rows={3}
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowApprovalModal(false)}>
              Cancel
            </Button>
            <Button
              variant={approvalAction === 'approve' ? 'success' : 'danger'}
              onClick={() =>
                approveMutation.mutate({
                  action: approvalAction,
                  comments: approvalComments,
                  lastDay: actualLastDay || undefined,
                })
              }
              isLoading={approveMutation.isPending}
            >
              {approvalAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Clearance Modal */}
      <Modal
        isOpen={showClearanceModal}
        onClose={() => setShowClearanceModal(false)}
        title={`Clear - ${selectedClearance?.department_name}`}
        size="md"
      >
        <div className="space-y-4">
          <Textarea
            label="Comments"
            value={clearanceForm.comments}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setClearanceForm({ ...clearanceForm, comments: e.target.value })}
            placeholder="Clearance comments..."
            rows={2}
          />
          <Textarea
            label="Outstanding Items (if any)"
            value={clearanceForm.outstanding_items}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setClearanceForm({ ...clearanceForm, outstanding_items: e.target.value })}
            placeholder="List any outstanding items..."
            rows={2}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Amount Owed by Employee"
              type="number"
              value={clearanceForm.amount_owed}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClearanceForm({ ...clearanceForm, amount_owed: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="Amount Due to Employee"
              type="number"
              value={clearanceForm.amount_due}
              onChange={(e) => setClearanceForm({ ...clearanceForm, amount_due: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowClearanceModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedClearance &&
                clearMutation.mutate({ clearanceId: selectedClearance.id, data: clearanceForm })
              }
              isLoading={clearMutation.isPending}
            >
              <CheckCircleIcon className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Asset Modal */}
      <Modal
        isOpen={showAssetModal}
        onClose={() => setShowAssetModal(false)}
        title="Add Asset to Return"
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            addAssetMutation.mutate(assetForm)
          }}
          className="space-y-4"
        >
          <Input
            label="Asset Name"
            value={assetForm.asset_name}
            onChange={(e) => setAssetForm({ ...assetForm, asset_name: e.target.value })}
            placeholder="e.g., Laptop"
            required
          />
          <Input
            label="Asset Type"
            value={assetForm.asset_type}
            onChange={(e) => setAssetForm({ ...assetForm, asset_type: e.target.value })}
            placeholder="e.g., Electronics, Furniture"
          />
          <Input
            label="Asset Tag / Serial Number"
            value={assetForm.asset_tag}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAssetForm({ ...assetForm, asset_tag: e.target.value })}
            placeholder="e.g., LAPTOP-001"
          />
          <Textarea
            label="Description"
            value={assetForm.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAssetForm({ ...assetForm, description: e.target.value })}
            placeholder="Additional details..."
            rows={2}
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setShowAssetModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={addAssetMutation.isPending}>
              Add Asset
            </Button>
          </div>
        </form>
      </Modal>

      {/* Process Asset Return Modal */}
      <Modal
        isOpen={!!selectedAsset}
        onClose={() => setSelectedAsset(null)}
        title={`Process Return - ${selectedAsset?.asset_name}`}
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Return Status"
            value={assetReturnForm.status}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAssetReturnForm({ ...assetReturnForm, status: e.target.value as AssetReturn['status'] })}
            options={assetStatusOptions}
          />
          <Textarea
            label="Condition Notes"
            value={assetReturnForm.condition_notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAssetReturnForm({ ...assetReturnForm, condition_notes: e.target.value })}
            placeholder="Describe the condition of the returned asset..."
            rows={2}
          />
          {(assetReturnForm.status === 'DAMAGED' ||
            assetReturnForm.status === 'LOST' ||
            assetReturnForm.status === 'PURCHASED') && (
            <Input
              label="Deduction Amount"
              type="number"
              value={assetReturnForm.deduction_amount}
              onChange={(e) =>
                setAssetReturnForm({ ...assetReturnForm, deduction_amount: parseFloat(e.target.value) || 0 })
              }
            />
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setSelectedAsset(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedAsset &&
                processAssetMutation.mutate({
                  assetId: selectedAsset.id,
                  status: assetReturnForm.status,
                  notes: assetReturnForm.condition_notes,
                  deduction: assetReturnForm.deduction_amount,
                })
              }
              isLoading={processAssetMutation.isPending}
            >
              Process Return
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
