import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PlayIcon,
  CheckIcon,
  XMarkIcon,
  DocumentArrowDownIcon,
  BanknotesIcon,
  CalculatorIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { payrollService } from '@/services/payroll'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils'
import type { PayrollRun, PayrollPeriod } from '@/types'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  COMPUTING: 'warning',
  COMPUTED: 'info',
  REVIEWING: 'warning',
  APPROVED: 'success',
  PAID: 'success',
  REJECTED: 'danger',
  REVERSED: 'danger',
}

const statusSteps = ['DRAFT', 'COMPUTED', 'APPROVED', 'PAID']

export default function PayrollProcessingPage() {
  const queryClient = useQueryClient()
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [newRunPeriod, setNewRunPeriod] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState<{
    action: 'compute' | 'approve' | 'pay' | 'cancel' | 'bank_files' | 'payslips' | 'reset_draft' | 'reopen_period'
    runId?: string
    periodId?: string
    title?: string
    message?: string
  } | null>(null)

  const { data: periods } = useQuery({
    queryKey: ['payroll-periods'],
    queryFn: payrollService.getPeriods,
  })

  const { data: runs, isLoading } = useQuery({
    queryKey: ['payroll-runs', selectedPeriod],
    queryFn: () => payrollService.getRuns(selectedPeriod || undefined),
  })

  const createRunMutation = useMutation({
    mutationFn: (periodId: string) => payrollService.createPayrollRun(periodId),
    onSuccess: () => {
      toast.success('Payroll run created')
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] })
      setShowCreateModal(false)
      setNewRunPeriod('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create payroll run')
    },
  })

  const computeMutation = useMutation({
    mutationFn: (runId: string) => payrollService.computePayroll(runId),
    onSuccess: (data) => {
      toast.success(`Payroll computed: ${data.data?.total_employees || 0} employees processed`)
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] })
      setShowConfirmModal(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to compute payroll')
    },
  })

  const approveMutation = useMutation({
    mutationFn: (runId: string) => payrollService.approvePayroll(runId),
    onSuccess: () => {
      toast.success('Payroll approved')
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] })
      setShowConfirmModal(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to approve payroll')
    },
  })

  const processPaymentMutation = useMutation({
    mutationFn: (runId: string) => payrollService.processPayment(runId),
    onSuccess: (data) => {
      toast.success(`Payment processed: ${data.data?.employees_paid || 0} employees paid`)
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] })
      setShowConfirmModal(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to process payment')
    },
  })

  const generateBankFilesMutation = useMutation({
    mutationFn: (runId: string) => payrollService.generateBankFiles(runId),
    onSuccess: (data) => {
      const fileCount = data.data?.files?.length || 0
      toast.success(`Generated ${fileCount} bank file(s)`)
      setShowConfirmModal(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to generate bank files')
    },
  })

  const generatePayslipsMutation = useMutation({
    mutationFn: (runId: string) => payrollService.generatePayslips(runId),
    onSuccess: (data) => {
      const count = data.data?.payslips_count || 0
      toast.success(`Generated ${count} payslip(s)`)
      setShowConfirmModal(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to generate payslips')
    },
  })

  const resetToDraftMutation = useMutation({
    mutationFn: (runId: string) => payrollService.resetToDraft(runId),
    onSuccess: () => {
      toast.success('Payroll run reset to draft')
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] })
      setShowConfirmModal(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to reset payroll')
    },
  })

  const reopenPeriodMutation = useMutation({
    mutationFn: (periodId: string) => payrollService.reopenPeriod(periodId),
    onSuccess: (data) => {
      toast.success(data.message || 'Period reopened successfully')
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] })
      setShowConfirmModal(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to reopen period')
    },
  })

  const handleAction = () => {
    if (!showConfirmModal) return

    switch (showConfirmModal.action) {
      case 'compute':
        if (showConfirmModal.runId) computeMutation.mutate(showConfirmModal.runId)
        break
      case 'approve':
        if (showConfirmModal.runId) approveMutation.mutate(showConfirmModal.runId)
        break
      case 'pay':
        if (showConfirmModal.runId) processPaymentMutation.mutate(showConfirmModal.runId)
        break
      case 'bank_files':
        if (showConfirmModal.runId) generateBankFilesMutation.mutate(showConfirmModal.runId)
        break
      case 'payslips':
        if (showConfirmModal.runId) generatePayslipsMutation.mutate(showConfirmModal.runId)
        break
      case 'reset_draft':
        if (showConfirmModal.runId) resetToDraftMutation.mutate(showConfirmModal.runId)
        break
      case 'reopen_period':
        if (showConfirmModal.periodId) reopenPeriodMutation.mutate(showConfirmModal.periodId)
        break
    }
  }

  const getStepIndex = (status: string) => statusSteps.indexOf(status.toUpperCase())

  const normalizeStatus = (status: string) => status.toUpperCase()

  const openPeriods = periods?.filter((p: PayrollPeriod) =>
    p.status?.toUpperCase() === 'OPEN'
  ) || []

  const isLoading2 = computeMutation.isPending ||
    approveMutation.isPending ||
    processPaymentMutation.isPending ||
    generateBankFilesMutation.isPending ||
    generatePayslipsMutation.isPending ||
    resetToDraftMutation.isPending ||
    reopenPeriodMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Processing</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create and process payroll runs
          </p>
        </div>
        <div className="flex gap-3">
          <Select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            options={[
              { value: '', label: 'All Periods' },
              ...(periods?.map((p: PayrollPeriod) => ({
                value: p.id,
                label: p.name,
              })) || []),
            ]}
          />
          <Button onClick={() => setShowCreateModal(true)}>
            <PlayIcon className="h-4 w-4 mr-2" />
            New Payroll Run
          </Button>
        </div>
      </div>

      {/* Active Payroll Runs */}
      <div className="grid gap-6">
        {isLoading ? (
          <Card>
            <CardContent className="p-8">
              <div className="flex justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
              </div>
            </CardContent>
          </Card>
        ) : runs && runs.length > 0 ? (
          runs.map((run: PayrollRun) => {
            const status = normalizeStatus(run.status)
            return (
              <Card key={run.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-3">
                        <BanknotesIcon className="h-5 w-5 text-gray-500" />
                        {run.period_name || run.run_number}
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        Run #{run.run_number} - {new Date(run.run_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={statusColors[status] || 'default'}>
                      {status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Progress Steps */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between">
                      {statusSteps.map((step, index) => {
                        const currentIndex = getStepIndex(status)
                        const isCompleted = index < currentIndex
                        const isCurrent = index === currentIndex

                        return (
                          <div key={step} className="flex items-center">
                            <div
                              className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                                isCompleted
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : isCurrent
                                  ? 'border-primary-500 text-primary-500'
                                  : 'border-gray-300 text-gray-400'
                              }`}
                            >
                              {isCompleted ? (
                                <CheckIcon className="h-5 w-5" />
                              ) : (
                                <span className="text-sm">{index + 1}</span>
                              )}
                            </div>
                            {index < statusSteps.length - 1 && (
                              <div
                                className={`w-12 sm:w-24 h-1 mx-2 ${
                                  index < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                                }`}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>Draft</span>
                      <span>Computed</span>
                      <span>Approved</span>
                      <span>Paid</span>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600">Employees</p>
                      <p className="text-2xl font-bold text-blue-700">{run.total_employees}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600">Total Gross</p>
                      <p className="text-xl font-bold text-green-700">
                        {formatCurrency(run.total_gross)}
                      </p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-600">Deductions</p>
                      <p className="text-xl font-bold text-red-700">
                        {formatCurrency(run.total_deductions)}
                      </p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-600">Net Pay</p>
                      <p className="text-xl font-bold text-purple-700">
                        {formatCurrency(run.total_net)}
                      </p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <p className="text-sm text-orange-600">PAYE Tax</p>
                      <p className="text-xl font-bold text-orange-700">
                        {formatCurrency(run.total_paye)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3">
                    {status === 'DRAFT' && (
                      <Button
                        onClick={() =>
                          setShowConfirmModal({
                            action: 'compute',
                            runId: run.id,
                            title: 'Compute Payroll',
                            message: 'This will calculate salaries for all eligible employees in this payroll run.'
                          })
                        }
                      >
                        <CalculatorIcon className="h-4 w-4 mr-2" />
                        Compute Payroll
                      </Button>
                    )}
                    {status === 'COMPUTED' && (
                      <>
                        <Button
                          onClick={() =>
                            setShowConfirmModal({
                              action: 'approve',
                              runId: run.id,
                              title: 'Approve Payroll',
                              message: 'This will approve the payroll run for payment processing.'
                            })
                          }
                        >
                          <CheckIcon className="h-4 w-4 mr-2" />
                          Approve Payroll
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setShowConfirmModal({
                              action: 'compute',
                              runId: run.id,
                              title: 'Recompute Payroll',
                              message: 'This will recalculate salaries for all employees. Existing calculations will be replaced.'
                            })
                          }
                        >
                          <ArrowPathIcon className="h-4 w-4 mr-2" />
                          Recompute
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setShowConfirmModal({
                              action: 'reset_draft',
                              runId: run.id,
                              title: 'Reset to Draft',
                              message: 'This will clear all computed data and reset the payroll run to draft status. You will need to recompute.'
                            })
                          }
                        >
                          <XMarkIcon className="h-4 w-4 mr-2" />
                          Reset to Draft
                        </Button>
                      </>
                    )}
                    {status === 'APPROVED' && (
                      <Button
                        onClick={() =>
                          setShowConfirmModal({
                            action: 'pay',
                            runId: run.id,
                            title: 'Process Payment',
                            message: 'This will mark the payroll as paid. Make sure bank transfers have been initiated.'
                          })
                        }
                      >
                        <BanknotesIcon className="h-4 w-4 mr-2" />
                        Process Payment
                      </Button>
                    )}
                    {status === 'REJECTED' && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setShowConfirmModal({
                              action: 'compute',
                              runId: run.id,
                              title: 'Recompute Payroll',
                              message: 'This will recalculate salaries after corrections.'
                            })
                          }
                        >
                          <ArrowPathIcon className="h-4 w-4 mr-2" />
                          Recompute
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setShowConfirmModal({
                              action: 'reset_draft',
                              runId: run.id,
                              title: 'Reset to Draft',
                              message: 'This will clear all data and reset the payroll run to draft status.'
                            })
                          }
                        >
                          <XMarkIcon className="h-4 w-4 mr-2" />
                          Reset to Draft
                        </Button>
                      </>
                    )}
                    {['COMPUTED', 'APPROVED', 'PAID'].includes(status) && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setShowConfirmModal({
                              action: 'bank_files',
                              runId: run.id,
                              title: 'Generate Bank Files',
                              message: 'This will generate CSV bank files for each bank for payment processing.'
                            })
                          }
                        >
                          <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                          Bank Files
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setShowConfirmModal({
                              action: 'payslips',
                              runId: run.id,
                              title: 'Generate Payslips',
                              message: 'This will generate payslips for all employees in this payroll run.'
                            })
                          }
                        >
                          <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                          Payslips
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Additional SSNIT/PAYE Info */}
                  {run.total_employees > 0 && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">SSNIT (Employee)</span>
                        <p className="font-medium">{formatCurrency(run.total_ssnit_employee)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">SSNIT (Employer)</span>
                        <p className="font-medium">{formatCurrency(run.total_ssnit_employer)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Tier 2 (Employer)</span>
                        <p className="font-medium">{formatCurrency(run.total_tier2_employer)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Total Employer Cost</span>
                        <p className="font-medium">{formatCurrency(run.total_employer_cost)}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <ClockIcon className="h-12 w-12 mx-auto text-gray-300" />
              <p className="mt-4 text-gray-500">No payroll runs found</p>
              <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                Create First Payroll Run
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Payroll Run Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setNewRunPeriod('')
        }}
        title="Create New Payroll Run"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a payroll period to create a new run. Only open periods are available.
          </p>
          {openPeriods.length > 0 ? (
            <>
              <Select
                label="Payroll Period"
                value={newRunPeriod}
                onChange={(e) => setNewRunPeriod(e.target.value)}
                options={[
                  { value: '', label: 'Select a period...' },
                  ...openPeriods.map((p: PayrollPeriod) => ({
                    value: p.id,
                    label: p.name,
                  })),
                ]}
              />
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewRunPeriod('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => newRunPeriod && createRunMutation.mutate(newRunPeriod)}
                  isLoading={createRunMutation.isPending}
                  disabled={!newRunPeriod}
                >
                  Create Run
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500">No open payroll periods available.</p>
              <p className="text-sm text-gray-400 mt-1">
                Please create a new payroll period first.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Confirm Action Modal */}
      <Modal
        isOpen={!!showConfirmModal}
        onClose={() => setShowConfirmModal(null)}
        title={showConfirmModal?.title || 'Confirm Action'}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {showConfirmModal?.message}
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowConfirmModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              isLoading={isLoading2}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
