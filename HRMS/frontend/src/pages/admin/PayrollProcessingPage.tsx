import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
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
  ExclamationTriangleIcon,
  ChartBarIcon,
  ListBulletIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline'
import { payrollService } from '@/services/payroll'
import { dashboardService } from '@/services/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import StatsCard from '@/components/ui/StatsCard'
import BarChartCard from '@/components/charts/BarChartCard'
import PieChartCard from '@/components/charts/PieChartCard'
import { chartColors } from '@/lib/design-tokens'
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
  const [activeTab, setActiveTab] = useState<'overview' | 'runs'>('overview')
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
  const computeStartTimeRef = useRef<number | null>(null)

  // Success modal state
  const [computeResult, setComputeResult] = useState<{
    runId: string
    totalEmployees: number
    totalErrors: number
    durationSeconds: number
    totalGross: string
    totalDeductions: string
    totalNet: string
  } | null>(null)

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

  const { data: dashboardData } = useQuery({
    queryKey: ['payroll-dashboard'],
    queryFn: dashboardService.getPayrollDashboard,
  })

  // Prepare chart data from trends
  const trendChartData = useMemo(() => {
    if (!dashboardData?.payroll_trends?.length) return []
    return dashboardData.payroll_trends.map((t) => ({
      name: new Date(t.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      total_gross: t.total_gross || 0,
      total_net: t.total_net || 0,
      total_deductions: t.total_deductions || 0,
      total_employer_cost: t.total_employer_cost || 0,
      employee_count: t.employee_count || 0,
    }))
  }, [dashboardData?.payroll_trends])

  // Gross payments Jan-Dec — use the year from the latest trends data
  const grossByMonthData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const trends = dashboardData?.payroll_trends || []
    // Determine the most recent year present in the data
    const latestYear = trends.length > 0
      ? new Date(trends[trends.length - 1].month).getFullYear()
      : new Date().getFullYear()
    const monthMap = new Map<number, number>()
    trends.forEach((t) => {
      const d = new Date(t.month)
      if (d.getFullYear() === latestYear) {
        monthMap.set(d.getMonth(), (monthMap.get(d.getMonth()) || 0) + (t.total_gross || 0))
      }
    })
    return { year: latestYear, data: months.map((name, i) => ({ name, value: monthMap.get(i) || 0 })) }
  }, [dashboardData?.payroll_trends])

  const deductionBarData = useMemo(() => {
    if (!dashboardData?.deduction_breakdown?.length) return []
    return dashboardData.deduction_breakdown
      .filter((d) => d.amount > 0)
      .map((d) => ({ name: d.name, value: d.amount }))
  }, [dashboardData?.deduction_breakdown])

  // Compute month-over-month trend percentages for stats cards
  const monthTrends = useMemo(() => {
    const trends = dashboardData?.payroll_trends
    if (!trends || trends.length < 2) return { gross: 0, deductions: 0, net: 0, paye: 0 }
    const curr = trends[trends.length - 1]
    const prev = trends[trends.length - 2]
    const pct = (c: number, p: number) => p > 0 ? Math.round(((c - p) / p) * 100) : 0
    return {
      gross: pct(curr.total_gross, prev.total_gross),
      deductions: pct(curr.total_deductions, prev.total_deductions),
      net: pct(curr.total_net, prev.total_net),
      paye: pct(curr.total_paye, prev.total_paye),
    }
  }, [dashboardData?.payroll_trends])

  // Sparkline data from trends
  const sparklines = useMemo(() => {
    const trends = dashboardData?.payroll_trends || []
    return {
      gross: trends.map((t) => t.total_gross || 0),
      deductions: trends.map((t) => t.total_deductions || 0),
      net: trends.map((t) => t.total_net || 0),
      paye: trends.map((t) => t.total_paye || 0),
    }
  }, [dashboardData?.payroll_trends])

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
      computeStartTimeRef.current = Date.now()
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
    onSuccess: (data, runId) => {
      const durationMs = computeStartTimeRef.current ? Date.now() - computeStartTimeRef.current : 0
      computeStartTimeRef.current = null
      const result = data.data
      setComputeResult({
        runId,
        totalEmployees: result?.total_employees || 0,
        totalErrors: result?.errors?.length || 0,
        durationSeconds: Math.round(durationMs / 1000),
        totalGross: result?.total_gross || '0',
        totalDeductions: result?.total_deductions || '0',
        totalNet: result?.total_net || '0',
      })
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
    },
    onError: (error: any) => {
      computeStartTimeRef.current = null
      toast.error(error.response?.data?.error || 'Failed to compute payroll')
    },
  })

  const approveMutation = useMutation({
    mutationFn: (runId: string) => payrollService.approvePayroll(runId),
    onSuccess: () => {
      toast.success('Payroll approved')
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
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
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
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
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
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
      if (data.next_period) {
        toast.success(`${data.next_period.name} is now the active period`)
      }
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

  const ytd = dashboardData?.year_to_date
  const latestPayroll = dashboardData?.latest_payroll

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Processing</h1>
          <p className="mt-1 text-sm text-gray-500">
            Dashboard analytics and payroll run management
          </p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'runs' && (
            <>
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
            </>
          )}
          <Button onClick={() => setShowCreateModal(true)}>
            <PlayIcon className="h-4 w-4 mr-2" />
            New Payroll Run
          </Button>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ChartBarIcon className="h-4 w-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('runs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'runs'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ListBulletIcon className="h-4 w-4" />
          Payroll Runs
        </button>
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* YTD Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Gross Pay (YTD)"
              value={formatCurrency(ytd?.total_gross || 0)}
              icon={<CurrencyDollarIcon className="h-6 w-6" />}
              variant="success"
              sparkline={sparklines.gross}
              trend={{
                value: monthTrends.gross,
                label: 'vs last month',
              }}
            />
            <StatsCard
              title="Deductions (YTD)"
              value={formatCurrency(ytd?.total_deductions || 0)}
              icon={<ArrowTrendingDownIcon className="h-6 w-6" />}
              variant="danger"
              sparkline={sparklines.deductions}
              trend={{
                value: monthTrends.deductions,
                label: 'vs last month',
              }}
            />
            <StatsCard
              title="Net Pay (YTD)"
              value={formatCurrency(ytd?.total_net || 0)}
              icon={<BanknotesIcon className="h-6 w-6" />}
              variant="info"
              sparkline={sparklines.net}
              trend={{
                value: monthTrends.net,
                label: 'vs last month',
              }}
            />
            <StatsCard
              title="PAYE Tax (YTD)"
              value={formatCurrency(ytd?.total_paye || 0)}
              icon={<ArrowTrendingUpIcon className="h-6 w-6" />}
              variant="warning"
              sparkline={sparklines.paye}
              trend={{
                value: monthTrends.paye,
                label: 'vs last month',
              }}
            />
          </div>

          {/* Gross Payments Jan-Dec */}
          <BarChartCard
            title={`Gross Payments — ${grossByMonthData.year}`}
            subtitle="Monthly gross pay from January to December"
            data={grossByMonthData.data}
            color={chartColors.primary}
            height={300}
            valueFormatter={(v) => formatCurrency(v)}
          />

          {/* Charts Row 1: Payroll Trends (grouped bars) + Deduction Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <BarChartCard
                title="Payroll Trends"
                subtitle="Monthly gross, net, and deductions comparison"
                data={trendChartData}
                height={320}
                valueFormatter={(v) => formatCurrency(v)}
                bars={[
                  { dataKey: 'total_gross', name: 'Gross Pay', color: chartColors.primary },
                  { dataKey: 'total_net', name: 'Net Pay', color: chartColors.secondary },
                  { dataKey: 'total_deductions', name: 'Deductions', color: '#ef4444' },
                ]}
              />
            </div>
            <PieChartCard
              title="Deduction Breakdown"
              subtitle="Latest payroll deductions"
              data={deductionBarData}
              donut
              height={280}
              valueFormatter={(v) => formatCurrency(v)}
              centerLabel={deductionBarData.length > 0 ? {
                value: formatCurrency(deductionBarData.reduce((s, d) => s + d.value, 0)),
                label: 'Total',
              } : undefined}
              colors={[...chartColors.palette]}
            />
          </div>

          {/* Charts Row 2: Employees Processed + Cost to Company */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BarChartCard
              title="Employees Processed"
              subtitle="Monthly headcount per payroll run"
              data={trendChartData.map((d) => ({ name: d.name, value: d.employee_count }))}
              color={chartColors.secondary}
              height={280}
            />
            <BarChartCard
              title="Cost to Company"
              subtitle="Total employer cost per month"
              data={trendChartData.map((d) => ({ name: d.name, value: d.total_employer_cost }))}
              color="#8b5cf6"
              height={280}
              valueFormatter={(v) => formatCurrency(v)}
            />
          </div>

          {/* Latest Payroll Summary Card */}
          {latestPayroll && latestPayroll.run_number && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BanknotesIcon className="h-5 w-5 text-gray-500" />
                    Latest Payroll Summary
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusColors[latestPayroll.status] || 'default'}>
                      {latestPayroll.status}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {latestPayroll.period} &middot; Run #{latestPayroll.run_number}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium">Employees</p>
                    <p className="text-lg font-bold text-blue-700">{latestPayroll.total_employees}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-600 font-medium">Gross Pay</p>
                    <p className="text-lg font-bold text-green-700">{formatCurrency(latestPayroll.total_gross)}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-xs text-red-600 font-medium">Total Deductions</p>
                    <p className="text-lg font-bold text-red-700">{formatCurrency(latestPayroll.total_deductions)}</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-purple-600 font-medium">Net Pay</p>
                    <p className="text-lg font-bold text-purple-700">{formatCurrency(latestPayroll.total_net)}</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <p className="text-xs text-orange-600 font-medium">Employer Cost</p>
                    <p className="text-lg font-bold text-orange-700">{formatCurrency(latestPayroll.total_employer_cost)}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">PAYE</span>
                    <p className="font-medium">{formatCurrency(latestPayroll.total_paye)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">SSNIT (Employee)</span>
                    <p className="font-medium">{formatCurrency(latestPayroll.total_ssnit_employee)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">SSNIT (Employer)</span>
                    <p className="font-medium">{formatCurrency(latestPayroll.total_ssnit_employer)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Tier 2 (Employer)</span>
                    <p className="font-medium">{formatCurrency(latestPayroll.total_tier2_employer)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ===== PAYROLL RUNS TAB ===== */}
      {activeTab === 'runs' && (
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
            const periodStatus = run.period_status?.toUpperCase()
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
                    <div className="flex items-center gap-2">
                      <Badge variant={statusColors[status] || 'default'}>
                        {status.replace(/_/g, ' ')}
                      </Badge>
                      {(run.error_count ?? 0) > 0 && (
                        <Link to={`/admin/payroll/runs/${run.id}/errors`}>
                          <Badge variant="danger">
                            {run.error_count} error{run.error_count !== 1 ? 's' : ''}
                          </Badge>
                        </Link>
                      )}
                      {periodStatus === 'CLOSED' && (
                        <Badge variant="default">
                          PERIOD CLOSED
                        </Badge>
                      )}
                    </div>
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
                    {status === 'PAID' && periodStatus === 'OPEN' && (
                      <Button
                        variant="outline"
                        className="text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() =>
                          setShowConfirmModal({
                            action: 'reset_draft',
                            runId: run.id,
                            title: 'Reset to Draft',
                            message: 'This period has been reopened. Resetting will clear all computed data so you can rerun payroll for this period.'
                          })
                        }
                      >
                        <XMarkIcon className="h-4 w-4 mr-2" />
                        Reset to Draft
                      </Button>
                    )}
                    {status === 'PAID' && periodStatus !== 'CLOSED' && (
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
      )}

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

      {/* Payroll Computation Progress Modal */}
      {computeMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Background Overlay */}
          <div className="absolute inset-0 bg-gray-900/50" />

          {/* Main Modal Card */}
          <div className="relative w-full max-w-lg mx-4 bg-white rounded-lg shadow-xl overflow-hidden">
            {/* Content Container */}
            <div className="p-8">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-primary-100 mb-4">
                  <CalculatorIcon className="w-7 h-7 text-primary-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Computing Payroll</h2>
                <p className="text-gray-500 text-sm">Processing employee salaries</p>
              </div>

              {/* Percentage Display */}
              <div className="text-center mb-6">
                <span className="text-4xl font-bold text-gray-900">
                  {progress?.percentage || 0}%
                </span>
                <p className="text-gray-500 text-sm mt-1">Complete</p>
              </div>

              {/* Progress Bar */}
              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden mb-6">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress?.percentage || 0}%` }}
                />
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <CheckIcon className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{progress?.processed || 0}</p>
                      <p className="text-gray-500 text-sm">Processed</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <BanknotesIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{progress?.total || 0}</p>
                      <p className="text-gray-500 text-sm">Total</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Employee Processing */}
              {progress?.current_employee && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary-700">
                        {progress.current_employee.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Currently Processing</p>
                      <p className="text-gray-900 font-medium truncate">{progress.current_employee}</p>
                    </div>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-primary-500"
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

              {/* Status Text */}
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-gray-600 text-sm">
                  {progress?.status === 'starting'
                    ? 'Initializing payroll engine...'
                    : progress?.status === 'completed'
                    ? 'Computation complete!'
                    : 'Processing...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Computation Success Modal */}
      {computeResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-gray-900/50" onClick={() => setComputeResult(null)} />
          <div className="relative w-full max-w-lg mx-4 bg-white rounded-lg shadow-xl overflow-hidden">
            <div className="p-8">
              {/* Success Icon */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                  <CheckIcon className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Payroll Computed Successfully</h2>
                <p className="text-gray-500 text-sm">All employee salaries have been calculated</p>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-blue-700">{computeResult.totalEmployees}</p>
                  <p className="text-blue-600 text-sm mt-1">Employees Processed</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-purple-700">
                    {computeResult.durationSeconds < 60
                      ? `${computeResult.durationSeconds}s`
                      : `${Math.floor(computeResult.durationSeconds / 60)}m ${computeResult.durationSeconds % 60}s`}
                  </p>
                  <p className="text-purple-600 text-sm mt-1">Duration</p>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Total Gross</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(parseFloat(computeResult.totalGross))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Total Deductions</span>
                  <span className="font-semibold text-red-600">{formatCurrency(parseFloat(computeResult.totalDeductions))}</span>
                </div>
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-gray-900 font-medium">Net Pay</span>
                  <span className="text-lg font-bold text-green-700">{formatCurrency(parseFloat(computeResult.totalNet))}</span>
                </div>
              </div>

              {/* Errors Warning */}
              {computeResult.totalErrors > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                  <div className="flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    <p className="text-amber-700 text-sm">
                      {computeResult.totalErrors} employee(s) had errors during computation
                    </p>
                  </div>
                  <Link
                    to={`/admin/payroll/runs/${computeResult.runId}/errors`}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-900 underline"
                    onClick={() => setComputeResult(null)}
                  >
                    View Error Details
                  </Link>
                </div>
              )}

              {/* Close Button */}
              <Button className="w-full" onClick={() => setComputeResult(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
