import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CloudArrowUpIcon,
  SparklesIcon,
  Cog6ToothIcon,
  EyeIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  DocumentArrowDownIcon,
  DocumentPlusIcon,
  PlusIcon,
  TableCellsIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  FileRelationshipDiagram,
  JoinList,
  JoinConfigPanel,
  MergedDataPreview,
} from '@/components/analyzer'
import {
  datasetService,
  type Dataset,
  type JoinConfiguration,
  type JoinConfigInput,
  type MergePreviewResult,
  type AIAnalysis,
} from '@/services/datasets'
import { TARGET_MODEL_LABELS } from '@/services/imports'

// Workflow steps
const STEPS = [
  { id: 'upload', label: 'Upload Files', icon: CloudArrowUpIcon },
  { id: 'analysis', label: 'AI Analysis', icon: SparklesIcon },
  { id: 'configure', label: 'Configure', icon: Cog6ToothIcon },
  { id: 'preview', label: 'Preview', icon: EyeIcon },
  { id: 'complete', label: 'Complete', icon: CheckCircleIcon },
] as const

type StepId = typeof STEPS[number]['id']

export default function DataAnalyzerPage() {
  const navigate = useNavigate()

  // Workflow state
  const [currentStep, setCurrentStep] = useState<StepId>('upload')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data state
  const [files, setFiles] = useState<File[]>([])
  const [datasetName, setDatasetName] = useState('')
  const [description, setDescription] = useState('')
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null)
  const [preview, setPreview] = useState<MergePreviewResult | null>(null)

  // UI state
  const [showJoinPanel, setShowJoinPanel] = useState(false)
  const [editingJoin, setEditingJoin] = useState<JoinConfiguration | null>(null)
  const [selectedTargetModel, setSelectedTargetModel] = useState<string>('')

  // Step navigation
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep)

  const goToStep = (stepId: StepId) => {
    setCurrentStep(stepId)
    setError(null)
  }

  // File handling
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    )
    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles])
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles((prev) => [...prev, ...selectedFiles])
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // Upload and analyze files
  const handleUpload = async () => {
    if (files.length < 2) {
      setError('Please upload at least 2 files to analyze')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await datasetService.upload(files, {
        name: datasetName || 'Untitled Dataset',
        description,
      })

      setDataset(result.dataset)
      setAiAnalysis(result.ai_analysis)
      goToStep('analysis')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload files')
    } finally {
      setIsLoading(false)
    }
  }

  // Configure joins
  const handleSaveJoin = async (joinConfig: JoinConfigInput) => {
    if (!dataset) return

    setIsLoading(true)
    setError(null)

    try {
      const existingJoins = dataset.joins.filter(
        (j) => j.id !== editingJoin?.id
      )
      const allJoins = [
        ...existingJoins.map((j, i) => ({
          left_file_id: j.left_file,
          left_column: j.left_column,
          right_file_id: j.right_file,
          right_column: j.right_column,
          join_type: j.join_type,
          order: i,
        })),
        { ...joinConfig, order: existingJoins.length },
      ]

      const result = await datasetService.configureJoins(dataset.id, allJoins)
      setDataset(result.dataset)
      setShowJoinPanel(false)
      setEditingJoin(null)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to configure joins')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteJoin = async (join: JoinConfiguration) => {
    if (!dataset) return

    setIsLoading(true)
    try {
      const remainingJoins = dataset.joins
        .filter((j) => j.id !== join.id)
        .map((j, i) => ({
          left_file_id: j.left_file,
          left_column: j.left_column,
          right_file_id: j.right_file,
          right_column: j.right_column,
          join_type: j.join_type,
          order: i,
        }))

      const result = await datasetService.configureJoins(dataset.id, remainingJoins)
      setDataset(result.dataset)
      setShowJoinPanel(false)
      setEditingJoin(null)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete join')
    } finally {
      setIsLoading(false)
    }
  }

  // Preview merge
  const handlePreview = async () => {
    if (!dataset) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await datasetService.preview(dataset.id, 100)
      setPreview(result)
      goToStep('preview')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate preview')
    } finally {
      setIsLoading(false)
    }
  }

  // Execute merge
  const handleMerge = async () => {
    if (!dataset) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await datasetService.merge(dataset.id)
      setDataset(result.dataset)
      goToStep('complete')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to merge data')
    } finally {
      setIsLoading(false)
    }
  }

  // Export merged data
  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!dataset) return

    try {
      const blob = await datasetService.export(dataset.id, format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${dataset.name.replace(/\s+/g, '_')}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to export')
    }
  }

  // Use for import
  const handleUseForImport = async () => {
    if (!dataset || !selectedTargetModel) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await datasetService.useForImport(dataset.id, selectedTargetModel)
      navigate(`/admin/data-import?job=${result.import_job.id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create import job')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="AI Data Analyzer"
        subtitle="Combine multiple data files with AI-powered join suggestions"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Data Analyzer' },
        ]}
      />

      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isActive = step.id === currentStep
            const isCompleted = index < currentStepIndex
            const Icon = step.icon

            return (
              <div key={step.id} className="flex items-center flex-1">
                <button
                  onClick={() => isCompleted && goToStep(step.id)}
                  disabled={!isCompleted}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-lg transition-all',
                    isActive && 'text-primary-700 font-medium',
                    isCompleted && 'text-success-600 cursor-pointer hover:bg-success-50',
                    !isActive && !isCompleted && 'text-gray-400 cursor-not-allowed'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center',
                      isActive && 'bg-primary-100 text-primary-600',
                      isCompleted && 'bg-success-100 text-success-600',
                      !isActive && !isCompleted && 'bg-gray-100 text-gray-400'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircleIcon className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className="hidden sm:block text-sm">{step.label}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-2',
                      isCompleted ? 'bg-success-400' : 'bg-gray-200'
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Step content */}
      <div className="mb-8">
        {/* Step 1: Upload */}
        {currentStep === 'upload' && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Files</CardTitle>
              <CardDescription>
                Upload 2 or more files (CSV, Excel) to analyze and merge
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Dataset name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dataset Name
                  </label>
                  <input
                    type="text"
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    placeholder="e.g., Employee Payroll Data"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Drop zone */}
              <div
                onDrop={handleFileDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 hover:bg-primary-50/50 transition-colors cursor-pointer"
              >
                <input
                  type="file"
                  multiple
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <CloudArrowUpIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600 mb-1">
                    Drag & drop files here or <span className="text-primary-600 font-medium">browse</span>
                  </p>
                  <p className="text-sm text-gray-400">Supports CSV, XLSX, XLS (max 10MB each)</p>
                </label>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">
                    Selected Files ({files.length})
                  </h4>
                  <div className="divide-y divide-gray-100">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2"
                      >
                        <div className="flex items-center gap-3">
                          <TableCellsIcon className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                            <p className="text-xs text-gray-500">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleUpload}
                  disabled={files.length < 2}
                  isLoading={isLoading}
                  rightIcon={<ArrowRightIcon className="w-4 h-4" />}
                >
                  Upload & Analyze
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: AI Analysis */}
        {currentStep === 'analysis' && dataset && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Analysis Results */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-primary-500" />
                  <CardTitle>AI Analysis</CardTitle>
                </div>
                <CardDescription>
                  {aiAnalysis?.mode === 'rule-based'
                    ? 'Analyzed using pattern matching'
                    : 'Analyzed using AI to find relationships'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Files analyzed */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Files Analyzed</h4>
                  <div className="space-y-2">
                    {dataset.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <TableCellsIcon className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.file_name}</p>
                            <p className="text-xs text-gray-500">
                              {file.row_count} rows, {file.headers.length} columns
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">{file.alias}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Warnings */}
                {aiAnalysis?.warnings && aiAnalysis.warnings.length > 0 && (
                  <div className="bg-warning-50 border border-warning-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-warning-800 mb-1">Warnings</h4>
                    <ul className="text-sm text-warning-700 space-y-1">
                      {aiAnalysis.warnings.map((w, i) => (
                        <li key={i}>- {w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations */}
                {aiAnalysis?.recommendations && aiAnalysis.recommendations.length > 0 && (
                  <div className="bg-info-50 border border-info-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-info-800 mb-1">Recommendations</h4>
                    <ul className="text-sm text-info-700 space-y-1">
                      {aiAnalysis.recommendations.map((r, i) => (
                        <li key={i}>- {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Suggested Joins */}
            <Card>
              <CardHeader>
                <CardTitle>Suggested Joins</CardTitle>
                <CardDescription>
                  {dataset.joins.length > 0
                    ? `${dataset.joins.length} join(s) suggested`
                    : 'No automatic joins found'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <JoinList
                  joins={dataset.joins}
                  onEdit={(join) => {
                    setEditingJoin(join)
                    setShowJoinPanel(true)
                  }}
                />

                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => goToStep('configure')}
                    rightIcon={<ArrowRightIcon className="w-4 h-4" />}
                  >
                    Continue to Configure
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Configure */}
        {currentStep === 'configure' && dataset && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Relationship Diagram */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>File Relationships</CardTitle>
                  <CardDescription>
                    Visual representation of joins between files
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FileRelationshipDiagram
                    files={dataset.files}
                    joins={dataset.joins}
                    onSelectJoin={(join) => {
                      setEditingJoin(join)
                      setShowJoinPanel(true)
                    }}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Join Configuration */}
            <div>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Joins</CardTitle>
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<PlusIcon className="w-4 h-4" />}
                      onClick={() => {
                        setEditingJoin(null)
                        setShowJoinPanel(true)
                      }}
                    >
                      Add Join
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <JoinList
                    joins={dataset.joins}
                    onEdit={(join) => {
                      setEditingJoin(join)
                      setShowJoinPanel(true)
                    }}
                    onDelete={handleDeleteJoin}
                  />
                </CardContent>
              </Card>

              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handlePreview}
                  disabled={dataset.joins.length === 0}
                  isLoading={isLoading}
                  rightIcon={<ArrowRightIcon className="w-4 h-4" />}
                >
                  Preview Merge
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Preview */}
        {currentStep === 'preview' && dataset && (
          <Card>
            <CardHeader>
              <CardTitle>Merged Data Preview</CardTitle>
              <CardDescription>
                Review the merged data before finalizing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MergedDataPreview preview={preview} isLoading={isLoading} />

              <div className="mt-6 flex justify-between">
                <Button
                  variant="secondary"
                  leftIcon={<ArrowLeftIcon className="w-4 h-4" />}
                  onClick={() => goToStep('configure')}
                >
                  Back to Configure
                </Button>
                <Button
                  onClick={handleMerge}
                  isLoading={isLoading}
                  disabled={!preview?.success}
                  rightIcon={<ArrowRightIcon className="w-4 h-4" />}
                >
                  Merge & Save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Complete */}
        {currentStep === 'complete' && dataset && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success-100 flex items-center justify-center">
              <CheckCircleIcon className="w-10 h-10 text-success-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Dataset Merged Successfully</h2>
            <p className="text-gray-600 mb-8">
              Your dataset "{dataset.name}" has been merged with {dataset.merged_row_count.toLocaleString()} rows.
            </p>

            <div className="max-w-md mx-auto space-y-4">
              {/* Export options */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Export Data</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      fullWidth
                      leftIcon={<DocumentArrowDownIcon className="w-4 h-4" />}
                      onClick={() => handleExport('csv')}
                    >
                      Download CSV
                    </Button>
                    <Button
                      variant="secondary"
                      fullWidth
                      leftIcon={<DocumentArrowDownIcon className="w-4 h-4" />}
                      onClick={() => handleExport('xlsx')}
                    >
                      Download Excel
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Use for import */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Use for Import</h3>
                  <div className="space-y-3">
                    <select
                      value={selectedTargetModel}
                      onChange={(e) => setSelectedTargetModel(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Select target model...</option>
                      {Object.entries(TARGET_MODEL_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <Button
                      fullWidth
                      disabled={!selectedTargetModel}
                      isLoading={isLoading}
                      leftIcon={<DocumentPlusIcon className="w-4 h-4" />}
                      onClick={handleUseForImport}
                    >
                      Create Import Job
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* New analysis */}
              <Button
                variant="ghost"
                fullWidth
                onClick={() => {
                  setFiles([])
                  setDataset(null)
                  setAiAnalysis(null)
                  setPreview(null)
                  setDatasetName('')
                  setDescription('')
                  goToStep('upload')
                }}
              >
                Start New Analysis
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Join Config Panel Modal */}
      {showJoinPanel && dataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <JoinConfigPanel
            files={dataset.files}
            existingJoin={editingJoin || undefined}
            onSave={handleSaveJoin}
            onClose={() => {
              setShowJoinPanel(false)
              setEditingJoin(null)
            }}
            onDelete={editingJoin ? () => handleDeleteJoin(editingJoin) : undefined}
          />
        </div>
      )}
    </div>
  )
}
