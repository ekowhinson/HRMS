import { useState, useEffect, useRef } from 'react'
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
  TrashIcon,
  LockClosedIcon,
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
    action: 'compute' | 'approve' | 'pay' | 'cancel' | 'bank_files' | 'payslips' | 'reset_draft' | 'delete' | 'close_period'
    runId?: string
    periodId?: string
    title?: string
    message?: string
  } | null>(null)

  // Progress tracking state
  const [computingRunId, setComputingRunId] = useState<string | null>(null)
  const [progress, setProgress] = useState<{
    status: string
    total: number
    processed: number
    percentage: number
    current_employee: string
  } | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll for progress when computing
  useEffect(() => {
    if (computingRunId) {
      const pollProgress = async () => {
        try {
          const result = await payrollService.getComputeProgress(computingRunId)
          if (result.success && result.data) {
            // Only update progress if we're actually computing (status is 'computing')
            // This prevents stale cache data from closing the modal prematurely
            if (result.data.status === 'computing') {
              setProgress(result.data)
            }
          }
        } catch (error) {
          console.error('Error fetching progress:', error)
        }
      }

      // Start polling after a short delay to let backend start computing
      const startTimeout = setTimeout(() => {
        pollProgress()
        progressIntervalRef.current = setInterval(pollProgress, 500)
      }, 300)

      return () => {
        clearTimeout(startTimeout)
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
          progressIntervalRef.current = null
        }
      }
    }
  }, [computingRunId])

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
    mutationFn: (runId: string) => {
      // Close confirm modal and start progress tracking
      setShowConfirmModal(null)
      setComputingRunId(runId)
      setProgress({ status: 'starting', total: 0, processed: 0, percentage: 0, current_employee: '' })
      return payrollService.computePayroll(runId)
    },
    onSettled: () => {
      // Clean up polling when mutation completes (success or error)
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      setComputingRunId(null)
      setProgress(null)
    },
    onSuccess: (data) => {
      toast.success(`Payroll computed: ${data.data?.total_employees || 0} employees processed`)
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] })
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

  const deleteMutation = useMutation({
    mutationFn: (runId: string) => payrollService.deletePayrollRun(runId),
    onSuccess: () => {
      toast.success('Payroll run deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] })
      setShowConfirmModal(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete payroll run')
    },
  })

  const closePeriodMutation = useMutation({
    mutationFn: (periodId: string) => payrollService.closePeriod(periodId),
    onSuccess: (data) => {
      toast.success(data.message || 'Period closed successfully')
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] })
      setShowConfirmModal(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to close period')
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
      case 'delete':
        if (showConfirmModal.runId) deleteMutation.mutate(showConfirmModal.runId)
        break
      case 'close_period':
        if (showConfirmModal.periodId) closePeriodMutation.mutate(showConfirmModal.periodId)
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
    deleteMutation.isPending ||
    closePeriodMutation.isPending

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
                      <>
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
                        <Button
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() =>
                            setShowConfirmModal({
                              action: 'delete',
                              runId: run.id,
                              title: 'Delete Payroll Run',
                              message: 'Are you sure you want to delete this payroll run? This action cannot be undone.'
                            })
                          }
                        >
                          <TrashIcon className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </>
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
                    {status === 'PAID' && (
                      <Button
                        variant="outline"
                        className="text-orange-600 border-orange-300 hover:bg-orange-50"
                        onClick={() =>
                          setShowConfirmModal({
                            action: 'close_period',
                            periodId: typeof run.payroll_period === 'object' ? run.payroll_period.id : run.payroll_period,
                            title: 'Close Payroll Period',
                            message: `This will close the period "${run.period_name}". Closed periods can only be reopened from Payroll Setup. Are you sure?`
                          })
                        }
                      >
                        <LockClosedIcon className="h-4 w-4 mr-2" />
                        Close Period
                      </Button>
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

      {/* Payroll Computation Progress Modal - Stunning Design */}
      {computeMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Animated Background Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-purple-900/90 to-slate-900/95 backdrop-blur-sm" />

          {/* Floating Particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-white/20 rounded-full animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 3}s`,
                }}
              />
            ))}
          </div>

          {/* Main Modal Card */}
          <div className="relative w-full max-w-lg mx-4 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
            {/* Animated Gradient Border */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-20 animate-pulse" />

            {/* Content Container */}
            <div className="relative p-8">
              {/* Header with Glow */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-600 shadow-lg shadow-purple-500/30 mb-4">
                  <CalculatorIcon className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">Computing Payroll</h2>
                <p className="text-white/60 text-sm">Processing employee salaries</p>
              </div>

              {/* Circular Progress Indicator */}
              <div className="flex justify-center mb-8">
                <div className="relative w-48 h-48">
                  {/* Outer Glow Ring */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 opacity-20 blur-xl animate-pulse" />

                  {/* Background Circle */}
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="8"
                    />
                    {/* Animated Progress Arc */}
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="url(#progressGradient)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(progress?.percentage || 0) * 2.64} 264`}
                      className="transition-all duration-500 ease-out"
                      style={{
                        filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.8))',
                      }}
                    />
                    <defs>
                      <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="50%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                  </svg>

                  {/* Center Content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {progress?.percentage || 0}%
                    </span>
                    <span className="text-white/50 text-sm mt-1">Complete</span>
                  </div>

                  {/* Orbiting Dot */}
                  <div
                    className="absolute w-4 h-4 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full shadow-lg shadow-purple-500/50"
                    style={{
                      top: '50%',
                      left: '50%',
                      transform: `rotate(${(progress?.percentage || 0) * 3.6 - 90}deg) translateX(76px) translateY(-50%)`,
                      transition: 'transform 0.5s ease-out',
                    }}
                  />
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl opacity-0 group-hover:opacity-100 blur transition-opacity duration-300" />
                  <div className="relative bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10 hover:border-cyan-500/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                        <CheckIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-white">{progress?.processed || 0}</p>
                        <p className="text-cyan-300/80 text-sm">Processed</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl opacity-0 group-hover:opacity-100 blur transition-opacity duration-300" />
                  <div className="relative bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10 hover:border-purple-500/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                        <BanknotesIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-white">{progress?.total || 0}</p>
                        <p className="text-purple-300/80 text-sm">Total</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Employee Processing */}
              {progress?.current_employee && (
                <div className="relative overflow-hidden bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10 mb-6">
                  {/* Animated Shimmer */}
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                  <div className="relative flex items-center gap-4">
                    {/* Animated Avatar Placeholder */}
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 p-0.5">
                        <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center">
                          <span className="text-lg font-bold text-white">
                            {progress.current_employee.charAt(0)}
                          </span>
                        </div>
                      </div>
                      {/* Pulse Ring */}
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 animate-ping opacity-30" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Currently Processing</p>
                      <p className="text-white font-semibold truncate">{progress.current_employee}</p>
                    </div>

                    {/* Processing Indicator */}
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500"
                          style={{
                            animation: 'bounce 1s infinite',
                            animationDelay: `${i * 0.15}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Wave Progress Bar */}
              <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress?.percentage || 0}%` }}
                >
                  {/* Animated Shine */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_1.5s_infinite]" />
                </div>
              </div>

              {/* Status Text */}
              <div className="flex items-center justify-center gap-3 mt-6">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-emerald-500" />
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping" />
                </div>
                <span className="text-white/70 text-sm font-medium">
                  {progress?.status === 'starting'
                    ? 'Initializing payroll engine...'
                    : progress?.status === 'completed'
                    ? '✨ Computation complete!'
                    : 'Crunching numbers...'}
                </span>
              </div>
            </div>

            {/* Bottom Glow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 blur-sm" />
          </div>
        </div>
      )}
    </div>
  )
}
