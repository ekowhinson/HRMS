import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { importService, ImportProgress as ImportProgressType, ImportStatus } from '@/services/imports'
import { cn } from '@/lib/utils'

interface ImportProgressProps {
  jobId: string
  onComplete?: (success: boolean, result?: ImportProgressType) => void
}

const STATUS_MESSAGES: Record<ImportStatus, string> = {
  PENDING: 'Waiting to start...',
  PARSING: 'Parsing file...',
  MAPPING: 'Mapping columns...',
  VALIDATING: 'Validating data...',
  PREVIEW: 'Ready for review',
  IMPORTING: 'Importing records...',
  COMPLETED: 'Import completed!',
  FAILED: 'Import failed',
  CANCELLED: 'Import cancelled',
}

export default function ImportProgress({ jobId, onComplete }: ImportProgressProps) {
  const [isComplete, setIsComplete] = useState(false)

  const { data: progress, isLoading } = useQuery({
    queryKey: ['import-progress', jobId],
    queryFn: () => importService.getProgress(jobId),
    refetchInterval: isComplete ? false : 2000, // Poll every 2 seconds while running
    enabled: !!jobId,
  })

  // Track completion
  useEffect(() => {
    if (progress && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(progress.status)) {
      setIsComplete(true)
      onComplete?.(progress.status === 'COMPLETED', progress)
    }
  }, [progress, onComplete])

  if (isLoading || !progress) {
    return (
      <div className="flex items-center justify-center p-8">
        <ArrowPathIcon className="h-8 w-8 text-primary-500 animate-spin" />
      </div>
    )
  }

  const percentage = progress.percentage || 0
  const isRunning = ['IMPORTING', 'PARSING', 'MAPPING', 'VALIDATING'].includes(progress.status)
  const isFailed = progress.status === 'FAILED'
  const isSuccess = progress.status === 'COMPLETED'

  return (
    <div className="space-y-6">
      {/* Status header */}
      <div
        className={cn(
          'p-4 rounded-lg border flex items-center gap-4',
          isSuccess && 'bg-green-50 border-green-200',
          isFailed && 'bg-red-50 border-red-200',
          isRunning && 'bg-blue-50 border-blue-200',
          !isRunning && !isSuccess && !isFailed && 'bg-gray-50 border-gray-200'
        )}
      >
        {isRunning && <ArrowPathIcon className="h-6 w-6 text-blue-600 animate-spin" />}
        {isSuccess && <CheckCircleIcon className="h-6 w-6 text-green-600" />}
        {isFailed && <XCircleIcon className="h-6 w-6 text-red-600" />}
        <div>
          <p
            className={cn(
              'font-medium',
              isSuccess && 'text-green-800',
              isFailed && 'text-red-800',
              isRunning && 'text-blue-800',
              !isRunning && !isSuccess && !isFailed && 'text-gray-800'
            )}
          >
            {STATUS_MESSAGES[progress.status]}
          </p>
          {isRunning && (
            <p className="text-sm text-gray-600 mt-1">
              Processing {progress.processed.toLocaleString()} of{' '}
              {progress.total.toLocaleString()} records
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-600">{Math.round(percentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-primary-600 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-600">Total Records</p>
          <p className="text-2xl font-bold text-blue-700">
            {progress.total.toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Processed</p>
          <p className="text-2xl font-bold text-gray-700">
            {progress.processed.toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm text-green-600">Successful</p>
          <p className="text-2xl font-bold text-green-700">
            {progress.success_count.toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-red-50 rounded-lg">
          <p className="text-sm text-red-600">Errors</p>
          <p className="text-2xl font-bold text-red-700">
            {progress.error_count.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Error list */}
      {progress.errors && progress.errors.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-red-50 px-4 py-3 border-b flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
            <h4 className="text-sm font-medium text-red-800">
              Import Errors ({progress.errors.length})
            </h4>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <ul className="divide-y divide-red-100">
              {progress.errors.slice(0, 20).map((error, index) => (
                <li key={index} className="px-4 py-2 text-sm">
                  {error.row && (
                    <span className="text-red-600 font-medium">Row {error.row}: </span>
                  )}
                  <span className="text-red-700">{error.message}</span>
                  {error.data && (
                    <span className="text-gray-500 ml-2 text-xs">({error.data})</span>
                  )}
                </li>
              ))}
              {progress.errors.length > 20 && (
                <li className="px-4 py-2 text-sm text-red-600 italic">
                  ...and {progress.errors.length - 20} more errors
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Success message */}
      {isSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="h-8 w-8 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Import completed successfully!</p>
              <p className="text-sm text-green-700 mt-1">
                {progress.success_count.toLocaleString()} record(s) imported
                {progress.error_count > 0 && (
                  <span className="text-red-600">
                    , {progress.error_count.toLocaleString()} error(s)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Failed message */}
      {isFailed && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-3">
            <XCircleIcon className="h-8 w-8 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Import failed</p>
              <p className="text-sm text-red-700 mt-1">
                Please review the errors above and try again.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
