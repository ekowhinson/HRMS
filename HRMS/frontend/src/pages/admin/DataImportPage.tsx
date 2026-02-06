import { useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  DocumentArrowUpIcon,
  TableCellsIcon,
  CheckCircleIcon,
  PlayIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  XMarkIcon,
  InformationCircleIcon,
  SparklesIcon,
  FolderPlusIcon,
} from '@heroicons/react/24/outline'
import {
  importService,
  batchImportService,
  ImportJob,
  ImportBatch,
  ValidationResult,
  TargetModel,
  TARGET_MODEL_LABELS,
} from '@/services/imports'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import FileUploader from '@/components/import/FileUploader'
import ColumnMapper from '@/components/import/ColumnMapper'
import ImportPreview from '@/components/import/ImportPreview'
import ImportProgress from '@/components/import/ImportProgress'
import MultiFileUploader from '@/components/import/MultiFileUploader'
import BatchAnalysis from '@/components/import/BatchAnalysis'
import BatchProgress from '@/components/import/BatchProgress'

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete'
type BatchStep = 'upload' | 'analysis' | 'importing' | 'complete'

const STEPS: { id: Step; name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'upload', name: 'Upload File', icon: DocumentArrowUpIcon },
  { id: 'mapping', name: 'Map Columns', icon: TableCellsIcon },
  { id: 'preview', name: 'Preview', icon: CheckCircleIcon },
  { id: 'importing', name: 'Import', icon: PlayIcon },
]

const BATCH_STEPS: { id: BatchStep; name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'upload', name: 'Upload Files', icon: FolderPlusIcon },
  { id: 'analysis', name: 'AI Analysis', icon: SparklesIcon },
  { id: 'importing', name: 'Import', icon: PlayIcon },
]

export default function DataImportPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('single')

  // ==================== SINGLE FILE STATE ====================
  const [currentStep, setCurrentStep] = useState<Step>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [targetModel, setTargetModel] = useState<TargetModel>('employees')
  const [instructions, setInstructions] = useState('')
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null)
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)

  // ==================== BATCH FILE STATE ====================
  const [batchStep, setBatchStep] = useState<BatchStep>('upload')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [batchName, setBatchName] = useState('')
  const [batchInstructions, setBatchInstructions] = useState('')
  const [currentBatch, setCurrentBatch] = useState<ImportBatch | null>(null)
  const [autoCreateDeps, setAutoCreateDeps] = useState(true)
  const [updateExisting, setUpdateExisting] = useState(true)

  // ==================== AI STATUS QUERY ====================
  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => batchImportService.getAIStatus(),
    staleTime: 60000, // Cache for 1 minute
  })

  // ==================== SINGLE FILE QUERIES & MUTATIONS ====================
  const effectiveTargetModel = currentJob?.target_model as TargetModel || targetModel
  const { data: fieldDefinitions } = useQuery({
    queryKey: ['field-definitions', effectiveTargetModel],
    queryFn: () => importService.getFieldDefinitions(effectiveTargetModel),
    enabled: !!effectiveTargetModel && activeTab === 'single',
  })

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!selectedFile) throw new Error('No file selected')
      return importService.upload(selectedFile, targetModel, instructions)
    },
    onSuccess: (job) => {
      setCurrentJob(job)
      setColumnMapping(job.column_mapping || {})
      setCurrentStep('mapping')
      toast.success('File uploaded and parsed successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to upload file')
    },
  })

  const confirmMappingMutation = useMutation({
    mutationFn: () => {
      if (!currentJob) throw new Error('No active job')
      return importService.confirmMapping(currentJob.id, columnMapping)
    },
    onSuccess: (result) => {
      setCurrentJob(result.job)
      setValidation(result.validation)
      setCurrentStep('preview')
      if (result.validation.is_valid) {
        toast.success('Validation passed! Ready to import.')
      } else {
        toast.error('Validation failed. Please review errors.')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to validate mapping')
    },
  })

  const executeMutation = useMutation({
    mutationFn: () => {
      if (!currentJob) throw new Error('No active job')
      return importService.execute(currentJob.id)
    },
    onSuccess: () => {
      setCurrentStep('importing')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to start import')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!currentJob) throw new Error('No active job')
      return importService.cancel(currentJob.id)
    },
    onSuccess: () => {
      toast.success('Import cancelled')
      handleReset()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to cancel import')
    },
  })

  // ==================== BATCH MUTATIONS ====================
  const batchUploadMutation = useMutation({
    mutationFn: () => {
      if (selectedFiles.length === 0) throw new Error('No files selected')
      return batchImportService.upload(selectedFiles, {
        name: batchName || undefined,
        instructions: batchInstructions || undefined,
        auto_create_dependencies: autoCreateDeps,
        update_existing: updateExisting,
      })
    },
    onSuccess: (result) => {
      setCurrentBatch(result.batch)
      setBatchStep('analysis')
      toast.success(`AI analyzed ${result.batch.file_count} files successfully`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to analyze files')
    },
  })

  const batchExecuteMutation = useMutation({
    mutationFn: () => {
      if (!currentBatch) throw new Error('No active batch')
      return batchImportService.execute(currentBatch.id)
    },
    onSuccess: () => {
      setBatchStep('importing')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to start batch import')
    },
  })

  const batchCancelMutation = useMutation({
    mutationFn: () => {
      if (!currentBatch) throw new Error('No active batch')
      return batchImportService.cancel(currentBatch.id)
    },
    onSuccess: () => {
      toast.success('Batch import cancelled')
      handleBatchReset()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to cancel batch')
    },
  })

  // Update job target model
  const updateJobMutation = useMutation({
    mutationFn: ({ jobId, targetModel }: { jobId: string; targetModel: TargetModel }) => {
      if (!currentBatch) throw new Error('No active batch')
      return batchImportService.updateJob(currentBatch.id, jobId, { target_model: targetModel })
    },
    onSuccess: () => {
      if (currentBatch) {
        batchImportService.getBatch(currentBatch.id).then(setCurrentBatch)
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update job')
    },
  })

  // ==================== HANDLERS ====================
  const handleDownloadErrors = useCallback(async () => {
    if (!currentJob) return
    try {
      const blob = await importService.downloadErrors(currentJob.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `import-errors-${currentJob.id}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      toast.error('Failed to download error report')
    }
  }, [currentJob])

  const handleReset = useCallback(() => {
    setCurrentStep('upload')
    setSelectedFile(null)
    setTargetModel('employees')
    setInstructions('')
    setCurrentJob(null)
    setColumnMapping({})
    setValidation(null)
    setShowCancelModal(false)
  }, [])

  const handleBatchReset = useCallback(() => {
    setBatchStep('upload')
    setSelectedFiles([])
    setBatchName('')
    setBatchInstructions('')
    setCurrentBatch(null)
    setAutoCreateDeps(true)
    setUpdateExisting(true)
  }, [])

  const handleImportComplete = useCallback(
    (success: boolean) => {
      if (success) {
        setCurrentStep('complete')
        queryClient.invalidateQueries({ queryKey: ['import-jobs'] })
      }
    },
    [queryClient]
  )

  const handleBatchComplete = useCallback(
    (success: boolean) => {
      if (success) {
        setBatchStep('complete')
        queryClient.invalidateQueries({ queryKey: ['import-batches'] })
      }
    },
    [queryClient]
  )

  const handleJobUpdate = useCallback(
    (jobId: string, targetModel: TargetModel) => {
      updateJobMutation.mutate({ jobId, targetModel })
    },
    [updateJobMutation]
  )

  // ==================== COMPUTED VALUES ====================
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep)
  const batchStepIndex = BATCH_STEPS.findIndex((s) => s.id === batchStep)
  const targetModelOptions = Object.entries(TARGET_MODEL_LABELS).map(([value, label]) => ({
    value,
    label,
  }))

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Import</h1>
          <p className="mt-1 text-sm text-gray-500">
            Import data from CSV or Excel files with AI-powered column detection
          </p>
        </div>
        {((activeTab === 'single' && currentJob && currentStep !== 'complete') ||
          (activeTab === 'batch' && currentBatch && batchStep !== 'complete')) && (
          <Button
            variant="outline"
            onClick={() => {
              if (activeTab === 'single') {
                setShowCancelModal(true)
              } else {
                batchCancelMutation.mutate()
              }
            }}
          >
            <XMarkIcon className="h-4 w-4 mr-2" />
            Cancel Import
          </Button>
        )}
      </div>

      {/* Import type tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(id: string) => {
          setActiveTab(id)
          if (id === 'single') handleReset()
          else handleBatchReset()
        }}
      >
        <TabsList>
          <TabsTrigger value="single" icon={<DocumentArrowUpIcon className="h-4 w-4" />}>
            Single File Import
          </TabsTrigger>
          <TabsTrigger value="batch" icon={<SparklesIcon className="h-4 w-4" />}>
            Multi-File AI Import
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ==================== SINGLE FILE IMPORT ==================== */}
      {activeTab === 'single' && (
        <>
          {/* Progress steps */}
          <div className="border-b">
            <nav className="flex">
              {STEPS.map((step, index) => {
                const isCurrent = step.id === currentStep
                const isComplete = index < currentStepIndex || currentStep === 'complete'
                const isClickable = isComplete && currentStep !== 'importing'

                return (
                  <div
                    key={step.id}
                    className={`flex-1 relative ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={() => {
                      if (isClickable) setCurrentStep(step.id)
                    }}
                  >
                    <div
                      className={`flex items-center justify-center py-4 px-2 border-b-2 transition-colors ${
                        isCurrent
                          ? 'border-primary-500 text-primary-600'
                          : isComplete
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500'
                      }`}
                    >
                      <step.icon className="h-5 w-5 mr-2" />
                      <span className="text-sm font-medium hidden sm:inline">{step.name}</span>
                      <span className="text-sm font-medium sm:hidden">{index + 1}</span>
                    </div>
                  </div>
                )
              })}
            </nav>
          </div>

          {/* Step content */}
          <Card>
            <CardContent className="p-6">
              {/* Step 1: Upload */}
              {currentStep === 'upload' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Import Type
                      </label>
                      <Select
                        value={targetModel}
                        onChange={(e) => setTargetModel(e.target.value as TargetModel)}
                        options={targetModelOptions}
                        disabled={!!currentJob}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Select the type of data you want to import
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Instructions (Optional)
                      </label>
                      <Input
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder="e.g., Skip rows where email is empty"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Provide any special instructions for column mapping
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload File
                    </label>
                    <FileUploader
                      onFileSelect={setSelectedFile}
                      selectedFile={selectedFile}
                      onClear={() => setSelectedFile(null)}
                    />
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-700">
                        <p className="font-medium">Tips for successful imports:</p>
                        <ul className="mt-2 list-disc list-inside space-y-1">
                          <li>Ensure your file has a header row with column names</li>
                          <li>Use consistent date formats (YYYY-MM-DD recommended)</li>
                          <li>Maximum file size: 50MB</li>
                          <li>Maximum records: 10,000 per import</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={() => uploadMutation.mutate()}
                      isLoading={uploadMutation.isPending}
                      disabled={!selectedFile}
                    >
                      <ArrowRightIcon className="h-4 w-4 mr-2" />
                      Continue to Mapping
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Mapping */}
              {currentStep === 'mapping' && currentJob && fieldDefinitions && (
                <div className="space-y-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {currentJob.original_filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {currentJob.total_rows.toLocaleString()} rows detected &bull;{' '}
                          {currentJob.headers.length} columns
                        </p>
                      </div>
                      <span className="text-sm text-gray-600">
                        Importing: {TARGET_MODEL_LABELS[effectiveTargetModel]}
                      </span>
                    </div>
                  </div>

                  <ColumnMapper
                    job={currentJob}
                    fieldDefinitions={fieldDefinitions}
                    columnMapping={columnMapping}
                    onMappingChange={setColumnMapping}
                  />

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep('upload')}>
                      <ArrowLeftIcon className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={() => confirmMappingMutation.mutate()}
                      isLoading={confirmMappingMutation.isPending}
                    >
                      <ArrowRightIcon className="h-4 w-4 mr-2" />
                      Validate & Preview
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Preview */}
              {currentStep === 'preview' && currentJob && (
                <div className="space-y-6">
                  <ImportPreview
                    job={currentJob}
                    validation={validation}
                    onDownloadErrors={handleDownloadErrors}
                  />

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep('mapping')}>
                      <ArrowLeftIcon className="h-4 w-4 mr-2" />
                      Back to Mapping
                    </Button>
                    <Button
                      onClick={() => executeMutation.mutate()}
                      isLoading={executeMutation.isPending}
                      disabled={!validation?.is_valid}
                    >
                      <PlayIcon className="h-4 w-4 mr-2" />
                      Start Import
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Importing */}
              {currentStep === 'importing' && currentJob && (
                <ImportProgress jobId={currentJob.id} onComplete={handleImportComplete} />
              )}

              {/* Step 5: Complete */}
              {currentStep === 'complete' && (
                <div className="text-center py-8">
                  <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">Import Complete!</h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Your data has been successfully imported.
                  </p>
                  <div className="mt-6 flex justify-center gap-4">
                    <Button variant="outline" onClick={handleDownloadErrors}>
                      Download Error Report
                    </Button>
                    <Button onClick={handleReset}>Start New Import</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ==================== MULTI-FILE AI IMPORT ==================== */}
      {activeTab === 'batch' && (
        <>
          {/* Progress steps */}
          <div className="border-b">
            <nav className="flex">
              {BATCH_STEPS.map((step, index) => {
                const isCurrent = step.id === batchStep
                const isComplete = index < batchStepIndex || batchStep === 'complete'

                return (
                  <div key={step.id} className="flex-1 relative cursor-default">
                    <div
                      className={`flex items-center justify-center py-4 px-2 border-b-2 transition-colors ${
                        isCurrent
                          ? 'border-primary-500 text-primary-600'
                          : isComplete
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500'
                      }`}
                    >
                      <step.icon className="h-5 w-5 mr-2" />
                      <span className="text-sm font-medium hidden sm:inline">{step.name}</span>
                      <span className="text-sm font-medium sm:hidden">{index + 1}</span>
                    </div>
                  </div>
                )
              })}
            </nav>
          </div>

          {/* Step content */}
          <Card>
            <CardContent className="p-6">
              {/* Batch Step 1: Upload */}
              {batchStep === 'upload' && (
                <div className="space-y-6">
                  {/* AI feature highlight */}
                  <div className={`p-4 rounded-lg border ${
                    aiStatus?.ai_available
                      ? 'bg-gradient-to-r from-primary-50 to-blue-50 border-primary-100'
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex items-start gap-3">
                      <SparklesIcon className={`h-6 w-6 flex-shrink-0 ${
                        aiStatus?.ai_available ? 'text-primary-600' : 'text-yellow-600'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900">
                            {aiStatus?.ai_available ? 'AI-Powered Multi-File Import' : 'Multi-File Import (Rule-Based)'}
                          </h3>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            aiStatus?.ai_available
                              ? 'bg-primary-100 text-primary-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {aiStatus?.analysis_mode === 'ai' ? 'AI Active' : 'Pattern Matching'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {aiStatus?.ai_available
                            ? 'Upload multiple files at once. Our AI agents will automatically detect the data type in each file, map columns intelligently, and import them in the correct order.'
                            : 'Upload multiple files at once. Files will be analyzed using pattern matching to detect data types and map columns.'}
                        </p>

                        {/* AI Agents List */}
                        {aiStatus?.ai_available && aiStatus.agents.length > 0 && (
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                            {aiStatus.agents.map((agent, index) => (
                              <div key={agent.name} className="flex items-start gap-2 p-2 bg-white/50 rounded">
                                <span className="flex items-center justify-center w-5 h-5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
                                  {index + 1}
                                </span>
                                <div>
                                  <p className="text-xs font-medium text-gray-900">{agent.name}</p>
                                  <p className="text-xs text-gray-500">{agent.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {!aiStatus?.ai_available && (
                          <p className="text-xs text-yellow-700 mt-2">
                            Tip: Configure ANTHROPIC_API_KEY in your environment to enable AI-powered analysis.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Batch Name (Optional)
                      </label>
                      <Input
                        value={batchName}
                        onChange={(e) => setBatchName(e.target.value)}
                        placeholder="e.g., January 2024 Employee Data"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Instructions (Optional)
                      </label>
                      <Input
                        value={batchInstructions}
                        onChange={(e) => setBatchInstructions(e.target.value)}
                        placeholder="e.g., Employees file has staff data"
                      />
                    </div>
                  </div>

                  <div className="flex gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={autoCreateDeps}
                        onChange={(e) => setAutoCreateDeps(e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">
                        Auto-create missing setup data (departments, banks, etc.)
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={updateExisting}
                        onChange={(e) => setUpdateExisting(e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Update existing records</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Files
                    </label>
                    <MultiFileUploader
                      onFilesSelect={setSelectedFiles}
                      selectedFiles={selectedFiles}
                      onRemoveFile={(index) => {
                        setSelectedFiles((files) => files.filter((_, i) => i !== index))
                      }}
                      onClearAll={() => setSelectedFiles([])}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={() => batchUploadMutation.mutate()}
                      isLoading={batchUploadMutation.isPending}
                      disabled={selectedFiles.length === 0}
                    >
                      <SparklesIcon className="h-4 w-4 mr-2" />
                      Analyze Files with AI
                    </Button>
                  </div>
                </div>
              )}

              {/* Batch Step 2: Analysis */}
              {batchStep === 'analysis' && currentBatch && (
                <div className="space-y-6">
                  <BatchAnalysis
                    batch={currentBatch}
                    onJobUpdate={handleJobUpdate}
                    editable={true}
                  />

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={handleBatchReset}>
                      <ArrowLeftIcon className="h-4 w-4 mr-2" />
                      Start Over
                    </Button>
                    <Button
                      onClick={() => batchExecuteMutation.mutate()}
                      isLoading={batchExecuteMutation.isPending}
                    >
                      <PlayIcon className="h-4 w-4 mr-2" />
                      Start Import ({currentBatch.total_rows.toLocaleString()} rows)
                    </Button>
                  </div>
                </div>
              )}

              {/* Batch Step 3: Importing */}
              {batchStep === 'importing' && currentBatch && (
                <BatchProgress batchId={currentBatch.id} onComplete={handleBatchComplete} />
              )}

              {/* Batch Step 4: Complete */}
              {batchStep === 'complete' && (
                <div className="text-center py-8">
                  <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">
                    Batch Import Complete!
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    All files have been processed successfully.
                  </p>
                  <div className="mt-6 flex justify-center gap-4">
                    <Button onClick={handleBatchReset}>Start New Import</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Cancel confirmation modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Import"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to cancel this import? All progress will be lost.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>
              Continue Import
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (currentJob) {
                  cancelMutation.mutate()
                } else {
                  handleReset()
                }
              }}
              isLoading={cancelMutation.isPending}
            >
              Cancel Import
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
