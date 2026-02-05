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
} from '@heroicons/react/24/outline'
import {
  importService,
  ImportJob,
  ValidationResult,
  TargetModel,
  TARGET_MODEL_LABELS,
  FieldDefinition,
} from '@/services/imports'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import FileUploader from '@/components/import/FileUploader'
import ColumnMapper from '@/components/import/ColumnMapper'
import ImportPreview from '@/components/import/ImportPreview'
import ImportProgress from '@/components/import/ImportProgress'

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete'

const STEPS: { id: Step; name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'upload', name: 'Upload File', icon: DocumentArrowUpIcon },
  { id: 'mapping', name: 'Map Columns', icon: TableCellsIcon },
  { id: 'preview', name: 'Preview', icon: CheckCircleIcon },
  { id: 'importing', name: 'Import', icon: PlayIcon },
]

export default function DataImportPage() {
  const queryClient = useQueryClient()

  // Wizard state
  const [currentStep, setCurrentStep] = useState<Step>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [targetModel, setTargetModel] = useState<TargetModel>('employees')
  const [instructions, setInstructions] = useState('')
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null)
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Fetch field definitions for selected target model
  // Use currentJob's target_model if available (after upload), otherwise use state
  const effectiveTargetModel = currentJob?.target_model as TargetModel || targetModel
  const { data: fieldDefinitions } = useQuery({
    queryKey: ['field-definitions', effectiveTargetModel],
    queryFn: () => importService.getFieldDefinitions(effectiveTargetModel),
    enabled: !!effectiveTargetModel,
  })

  // Upload mutation
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

  // Confirm mapping mutation
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

  // Execute import mutation
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

  // Cancel mutation
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

  // Download errors
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

  // Reset wizard
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

  // Handle import completion
  const handleImportComplete = useCallback(
    (success: boolean) => {
      if (success) {
        setCurrentStep('complete')
        queryClient.invalidateQueries({ queryKey: ['import-jobs'] })
      }
    },
    [queryClient]
  )

  // Get current step index
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep)

  // Target model options
  const targetModelOptions = Object.entries(TARGET_MODEL_LABELS).map(([value, label]) => ({
    value,
    label,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Import</h1>
          <p className="mt-1 text-sm text-gray-500">
            Import data from CSV, Excel, or PDF files
          </p>
        </div>
        {currentJob && currentStep !== 'complete' && (
          <Button variant="outline" onClick={() => setShowCancelModal(true)}>
            <XMarkIcon className="h-4 w-4 mr-2" />
            Cancel Import
          </Button>
        )}
      </div>

      {/* Progress steps */}
      <div className="border-b">
        <nav className="flex">
          {STEPS.map((step, index) => {
            const isCurrent = step.id === currentStep
            const isComplete =
              index < currentStepIndex || currentStep === 'complete'
            const isClickable = isComplete && currentStep !== 'importing'

            return (
              <div
                key={step.id}
                className={`flex-1 relative ${
                  isClickable ? 'cursor-pointer' : 'cursor-default'
                }`}
                onClick={() => {
                  if (isClickable) {
                    setCurrentStep(step.id)
                  }
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
                  <span className="text-sm font-medium hidden sm:inline">
                    {step.name}
                  </span>
                  <span className="text-sm font-medium sm:hidden">
                    {index + 1}
                  </span>
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

              {/* Info box */}
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
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Import Complete!
              </h3>
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
