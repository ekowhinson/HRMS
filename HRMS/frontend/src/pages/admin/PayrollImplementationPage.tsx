import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  CloudArrowUpIcon,
  MagnifyingGlassIcon,
  CpuChipIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  BanknotesIcon,
  UserGroupIcon,
  CalculatorIcon,
  ClipboardDocumentListIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import {
  payrollSetupService,
  type PayrollUploadResponse,
  type PayrollProgress,
  type PayrollResults,
} from '@/services/payrollImplementation'

type WizardStep = 'upload' | 'analyze' | 'processing' | 'complete'

const STEPS = [
  { id: 'upload' as const, name: 'Upload Files', icon: CloudArrowUpIcon },
  { id: 'analyze' as const, name: 'Review Analysis', icon: MagnifyingGlassIcon },
  { id: 'processing' as const, name: 'Processing', icon: CpuChipIcon },
  { id: 'complete' as const, name: 'Complete', icon: CheckCircleIcon },
]

const PHASES = [
  { name: 'Update Employee Data', icon: UserGroupIcon, description: 'Grades, NIA numbers, bank accounts' },
  { name: 'Seed Payroll Configuration', icon: CalculatorIcon, description: 'Tax brackets, SSNIT rates' },
  { name: 'Create Pay Components', icon: DocumentTextIcon, description: '16 earnings & deduction types' },
  { name: 'Create Employee Salaries', icon: BanknotesIcon, description: 'Salary records from notch amounts' },
  { name: 'Create Transactions', icon: ClipboardDocumentListIcon, description: 'Grade-based & individual transactions' },
]

export default function PayrollImplementationPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload')
  const [allowancesFile, setAllowancesFile] = useState<File | null>(null)
  const [staffDataFile, setStaffDataFile] = useState<File | null>(null)
  const [taskId, setTaskId] = useState<string>('')
  const [analysisData, setAnalysisData] = useState<PayrollUploadResponse | null>(null)
  const [finalResults, setFinalResults] = useState<PayrollResults | null>(null)

  // Progress polling
  const { data: progress } = useQuery({
    queryKey: ['payroll-setup-progress', taskId],
    queryFn: () => payrollSetupService.getProgress(taskId),
    enabled: currentStep === 'processing' && !!taskId,
    refetchInterval: (query) => {
      const data = query.state.data as PayrollProgress | undefined
      if (data?.status === 'completed' || data?.status === 'failed') return false
      return 2000
    },
  })

  // Handle progress completion
  useEffect(() => {
    if (progress?.status === 'completed' && currentStep === 'processing') {
      setFinalResults(progress.results)
      setCurrentStep('complete')
    }
  }, [progress?.status, currentStep, progress?.results])

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!allowancesFile || !staffDataFile) throw new Error('Both files required')
      return payrollSetupService.upload(allowancesFile, staffDataFile)
    },
    onSuccess: (data) => {
      setTaskId(data.task_id)
      setAnalysisData(data)
      setCurrentStep('analyze')
      toast.success('Files analyzed successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to analyze files')
    },
  })

  // Execute mutation
  const executeMutation = useMutation({
    mutationFn: () => payrollSetupService.execute(taskId),
    onSuccess: (data) => {
      if (data.status === 'completed') {
        setFinalResults(data.results || null)
        setCurrentStep('complete')
        toast.success('Payroll setup completed!')
      } else if (data.status === 'failed') {
        toast.error(data.error || 'Execution failed')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to execute payroll setup')
    },
  })

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: () => payrollSetupService.reset(),
    onSuccess: (data) => {
      toast.success(data.message || 'Payroll data cleared')
      setCurrentStep('upload')
      setAllowancesFile(null)
      setStaffDataFile(null)
      setTaskId('')
      setAnalysisData(null)
      setFinalResults(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to reset')
    },
  })

  const handleExecute = () => {
    setCurrentStep('processing')
    executeMutation.mutate()
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'allowances' | 'staff') => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      toast.error('Please select an Excel file (.xlsx or .xls)')
      return
    }
    if (type === 'allowances') setAllowancesFile(file)
    else setStaffDataFile(file)
  }, [])

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payroll Implementation Wizard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure payroll from Excel files: pay components, tax config, employee salaries, and transactions
        </p>
      </div>

      {/* Step Indicator */}
      <div className="border-b border-gray-200">
        <nav className="flex">
          {STEPS.map((step, index) => {
            const isCurrent = step.id === currentStep
            const isComplete = index < currentStepIndex
            return (
              <div key={step.id} className="flex-1 relative">
                <div className={`flex items-center justify-center py-4 border-b-2 transition-colors ${
                  isCurrent ? 'border-primary-500 text-primary-600' :
                  isComplete ? 'border-green-500 text-green-600' :
                  'border-transparent text-gray-400'
                }`}>
                  <step.icon className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium hidden sm:inline">{step.name}</span>
                </div>
              </div>
            )
          })}
        </nav>
      </div>

      {/* Step Content */}
      {currentStep === 'upload' && (
        <UploadStep
          allowancesFile={allowancesFile}
          staffDataFile={staffDataFile}
          onFileChange={handleFileChange}
          onAnalyze={() => uploadMutation.mutate()}
          isLoading={uploadMutation.isPending}
        />
      )}

      {currentStep === 'analyze' && analysisData && (
        <AnalysisStep
          data={analysisData}
          onExecute={handleExecute}
          onBack={() => setCurrentStep('upload')}
          isLoading={executeMutation.isPending}
        />
      )}

      {currentStep === 'processing' && (
        <ProcessingStep progress={progress || null} />
      )}

      {currentStep === 'complete' && finalResults && (
        <CompleteStep
          results={finalResults}
          onReset={() => resetMutation.mutate()}
          isResetting={resetMutation.isPending}
          onNavigate={(path) => navigate(path)}
        />
      )}
    </div>
  )
}

/* ─── Upload Step ─────────────────────────────────────────── */

function UploadStep({
  allowancesFile,
  staffDataFile,
  onFileChange,
  onAnalyze,
  isLoading,
}: {
  allowancesFile: File | null
  staffDataFile: File | null
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>, type: 'allowances' | 'staff') => void
  onAnalyze: () => void
  isLoading: boolean
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Payroll Files</h3>
          <p className="text-sm text-gray-500 mb-6">
            Upload the two Excel files that define the payroll structure. The system will analyze them
            and show you a preview before making any changes.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Allowances File */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
              <CloudArrowUpIcon className="h-10 w-10 mx-auto text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">Allowances Structure File</p>
              <p className="text-xs text-gray-500 mb-3">Staff Allowances at all Bands.xlsx</p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => onFileChange(e, 'allowances')}
                />
                <span className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                  Choose File
                </span>
              </label>
              {allowancesFile && (
                <p className="mt-2 text-sm text-green-600 flex items-center justify-center gap-1">
                  <CheckCircleIcon className="h-4 w-4" />
                  {allowancesFile.name}
                </p>
              )}
            </div>

            {/* Staff Data File */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
              <CloudArrowUpIcon className="h-10 w-10 mx-auto text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">Staff Data File</p>
              <p className="text-xs text-gray-500 mb-3">Staff Data for Payroll Implementation.xlsx</p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => onFileChange(e, 'staff')}
                />
                <span className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                  Choose File
                </span>
              </label>
              {staffDataFile && (
                <p className="mt-2 text-sm text-green-600 flex items-center justify-center gap-1">
                  <CheckCircleIcon className="h-4 w-4" />
                  {staffDataFile.name}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={onAnalyze}
              disabled={!allowancesFile || !staffDataFile}
              isLoading={isLoading}
              leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
            >
              Analyze Files
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Analysis Step ───────────────────────────────────────── */

function AnalysisStep({
  data,
  onExecute,
  onBack,
  isLoading,
}: {
  data: PayrollUploadResponse
  onExecute: () => void
  onBack: () => void
  isLoading: boolean
}) {
  const { summary } = data

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Pay Components"
          value={summary.components_to_create}
          icon={<DocumentTextIcon className="h-5 w-5 text-blue-500" />}
        />
        <SummaryCard
          label="Employee Records"
          value={summary.employee_count.toLocaleString()}
          icon={<UserGroupIcon className="h-5 w-5 text-green-500" />}
        />
        <SummaryCard
          label="Tax Brackets"
          value={summary.tax_brackets_to_create}
          icon={<CalculatorIcon className="h-5 w-5 text-orange-500" />}
        />
        <SummaryCard
          label="SSNIT Rates"
          value={summary.ssnit_rates_to_create}
          icon={<BanknotesIcon className="h-5 w-5 text-purple-500" />}
        />
      </div>

      {/* Bands Found */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Allowance Structure Detected</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.bands_found.sort().map((band) => (
              <div key={band} className="border rounded-md p-3">
                <p className="font-medium text-sm text-gray-900">{band}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(summary.band_allowance_types[band] || []).join(', ')}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sheet Breakdown */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Staff Data Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(summary.sheet_counts).map(([sheet, count]) => (
              <div key={sheet} className="text-center p-3 bg-gray-50 rounded-md">
                <p className="text-2xl font-bold text-gray-900">{count.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">{sheet}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Deductions Preview */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Individual Deductions Detected</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-md">
              <p className="text-2xl font-bold text-gray-900">{summary.deduction_counts.provident_fund.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Provident Fund</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-md">
              <p className="text-2xl font-bold text-gray-900">{summary.deduction_counts.unicof.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">UNICOF Members</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-md">
              <p className="text-2xl font-bold text-gray-900">{summary.deduction_counts.pawu.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">PAWU Members</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-md">
              <p className="text-2xl font-bold text-gray-900">{summary.deduction_counts.rent_deduction.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Rent Deductions</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Errors/Warnings */}
      {(summary.errors.length > 0 || summary.warnings.length > 0) && (
        <Card>
          <CardContent className="p-6">
            {summary.errors.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-red-700 mb-2">Errors ({summary.errors.length})</h4>
                <div className="max-h-40 overflow-y-auto bg-red-50 rounded p-3">
                  {summary.errors.slice(0, 20).map((err, i) => (
                    <p key={i} className="text-xs text-red-600">{err}</p>
                  ))}
                </div>
              </div>
            )}
            {summary.warnings.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-amber-700 mb-2">Warnings ({summary.warnings.length})</h4>
                <div className="max-h-40 overflow-y-auto bg-amber-50 rounded p-3">
                  {summary.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-600">{w}</p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back to Upload</Button>
        <Button
          onClick={onExecute}
          isLoading={isLoading}
          leftIcon={<CpuChipIcon className="h-4 w-4" />}
        >
          Execute Payroll Setup
        </Button>
      </div>
    </div>
  )
}

/* ─── Processing Step ─────────────────────────────────────── */

function ProcessingStep({ progress }: { progress: PayrollProgress | null }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Processing Payroll Setup</h3>

          {/* Overall Progress */}
          <div className="mb-8">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Overall Progress</span>
              <span className="font-medium">{progress?.overall_progress || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-primary-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress?.overall_progress || 0}%` }}
              />
            </div>
          </div>

          {/* Phase Timeline */}
          <div className="space-y-4">
            {PHASES.map((phase, idx) => {
              const phaseNum = idx + 1
              const isCurrent = progress?.phase === phaseNum
              const isComplete = (progress?.phase || 0) > phaseNum

              return (
                <div key={idx} className={`flex items-start gap-4 p-3 rounded-lg ${
                  isCurrent ? 'bg-primary-50 border border-primary-200' :
                  isComplete ? 'bg-green-50' : 'bg-gray-50'
                }`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    isCurrent ? 'bg-primary-500 text-white' :
                    isComplete ? 'bg-green-500 text-white' :
                    'bg-gray-300 text-gray-500'
                  }`}>
                    {isComplete ? (
                      <CheckCircleIcon className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-medium">{phaseNum}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium ${
                        isCurrent ? 'text-primary-700' :
                        isComplete ? 'text-green-700' : 'text-gray-500'
                      }`}>
                        {phase.name}
                      </p>
                      {isCurrent && (
                        <span className="text-xs text-primary-600">
                          {progress?.phase_progress || 0}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{phase.description}</p>
                    {isCurrent && (
                      <div className="mt-2 w-full bg-primary-100 rounded-full h-1.5">
                        <div
                          className="bg-primary-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${progress?.phase_progress || 0}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Log */}
          {progress?.log && progress.log.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Activity Log</h4>
              <div className="bg-gray-900 rounded-lg p-4 max-h-48 overflow-y-auto">
                {progress.log.map((entry, i) => (
                  <p key={i} className="text-xs text-green-400 font-mono">{entry}</p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Complete Step ────────────────────────────────────────── */

function CompleteStep({
  results,
  onReset,
  isResetting,
  onNavigate,
}: {
  results: PayrollResults
  onReset: () => void
  isResetting: boolean
  onNavigate: (path: string) => void
}) {
  return (
    <div className="space-y-4">
      {/* Success Banner */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <CheckCircleIcon className="h-12 w-12 mx-auto text-green-500 mb-3" />
        <h3 className="text-lg font-medium text-green-800">Payroll Setup Complete</h3>
        <p className="text-sm text-green-600 mt-1">
          All payroll data has been successfully configured
        </p>
      </div>

      {/* Results Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <ResultCard label="Employees Graded" value={results.employees_graded} />
        <ResultCard label="NIA Numbers Updated" value={results.nia_updated} />
        <ResultCard label="Bank Accounts Updated" value={results.bank_accounts_updated} />
        <ResultCard label="Pay Components Created" value={results.pay_components_created} />
        <ResultCard label="Tax Brackets Created" value={results.tax_brackets_created} />
        <ResultCard label="SSNIT Rates Created" value={results.ssnit_rates_created} />
        <ResultCard label="Employee Salaries Created" value={results.employee_salaries_created} />
        <ResultCard label="Transactions Created" value={results.transactions_created} />
        <ResultCard label="Overtime Config" value={results.overtime_config_created ? 'Created' : 'Exists'} />
      </div>

      {/* Errors */}
      {results.errors.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
              <h4 className="text-sm font-medium text-amber-700">
                {results.errors.length} non-critical errors
              </h4>
            </div>
            <div className="max-h-40 overflow-y-auto bg-amber-50 rounded p-3">
              {results.errors.slice(0, 50).map((err, i) => (
                <p key={i} className="text-xs text-amber-600">{err}</p>
              ))}
              {results.errors.length > 50 && (
                <p className="text-xs text-amber-500 mt-1">
                  ...and {results.errors.length - 50} more
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Actions */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Next Steps</h3>
          <div className="space-y-3">
            <button
              onClick={() => onNavigate('/admin/employee-transactions')}
              className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ClipboardDocumentListIcon className="h-5 w-5 text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">View Employee Transactions</p>
                  <p className="text-xs text-gray-500">Review the created allowances and deductions</p>
                </div>
              </div>
              <ChevronRightIcon className="h-4 w-4 text-gray-400" />
            </button>

            <button
              onClick={() => onNavigate('/admin/payroll')}
              className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <BanknotesIcon className="h-5 w-5 text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">Process Payroll</p>
                  <p className="text-xs text-gray-500">Run payroll processing for the configured period</p>
                </div>
              </div>
              <ChevronRightIcon className="h-4 w-4 text-gray-400" />
            </button>

            <button
              onClick={() => onNavigate('/admin/tax-configuration')}
              className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CalculatorIcon className="h-5 w-5 text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">View Tax Configuration</p>
                  <p className="text-xs text-gray-500">Review PAYE brackets and SSNIT rates</p>
                </div>
              </div>
              <ChevronRightIcon className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Reset */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={onReset}
          isLoading={isResetting}
          leftIcon={<ArrowPathIcon className="h-4 w-4" />}
        >
          Reset & Rerun
        </Button>
      </div>
    </div>
  )
}

/* ─── Helper Components ───────────────────────────────────── */

function SummaryCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function ResultCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border rounded-lg p-4 text-center">
      <p className="text-2xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}
