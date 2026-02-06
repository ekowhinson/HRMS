import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ClockIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'
import {
  batchImportService,
  ImportStatus,
  TARGET_MODEL_LABELS,
  BATCH_STATUS_LABELS,
  TargetModel,
} from '@/services/imports'
import Badge from '@/components/ui/Badge'

interface BatchProgressProps {
  batchId: string
  onComplete?: (success: boolean) => void
}

const statusIcons: Record<ImportStatus, React.ComponentType<{ className?: string }>> = {
  PENDING: ClockIcon,
  PARSING: ArrowPathIcon,
  MAPPING: ArrowPathIcon,
  VALIDATING: ArrowPathIcon,
  PREVIEW: ClockIcon,
  IMPORTING: ArrowPathIcon,
  COMPLETED: CheckCircleIcon,
  FAILED: XCircleIcon,
  CANCELLED: XCircleIcon,
}

const statusColors: Record<ImportStatus, string> = {
  PENDING: 'text-gray-400',
  PARSING: 'text-blue-500 animate-spin',
  MAPPING: 'text-blue-500 animate-spin',
  VALIDATING: 'text-blue-500 animate-spin',
  PREVIEW: 'text-gray-400',
  IMPORTING: 'text-blue-500 animate-spin',
  COMPLETED: 'text-green-500',
  FAILED: 'text-red-500',
  CANCELLED: 'text-gray-500',
}

export default function BatchProgress({ batchId, onComplete }: BatchProgressProps) {
  const [hasCompleted, setHasCompleted] = useState(false)

  const { data: progress, isLoading } = useQuery({
    queryKey: ['batch-progress', batchId],
    queryFn: () => batchImportService.getProgress(batchId),
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 2000
      const status = data.status
      if (
        status === 'COMPLETED' ||
        status === 'FAILED' ||
        status === 'CANCELLED' ||
        status === 'PARTIAL'
      ) {
        return false
      }
      return 2000
    },
  })

  useEffect(() => {
    if (progress && !hasCompleted) {
      const status = progress.status
      if (
        status === 'COMPLETED' ||
        status === 'FAILED' ||
        status === 'PARTIAL' ||
        status === 'CANCELLED'
      ) {
        setHasCompleted(true)
        onComplete?.(status === 'COMPLETED' || status === 'PARTIAL')
      }
    }
  }, [progress, hasCompleted, onComplete])

  if (isLoading || !progress) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="h-8 w-8 text-primary-500 animate-spin" />
        <span className="ml-3 text-gray-600">Loading progress...</span>
      </div>
    )
  }

  const isComplete =
    progress.status === 'COMPLETED' ||
    progress.status === 'PARTIAL' ||
    progress.status === 'FAILED'
  const isProcessing = progress.status === 'PROCESSING'

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-50 mb-4">
          {isComplete ? (
            progress.status === 'FAILED' ? (
              <XCircleIcon className="h-12 w-12 text-red-500" />
            ) : (
              <CheckCircleIcon className="h-12 w-12 text-green-500" />
            )
          ) : (
            <ArrowPathIcon className="h-12 w-12 text-primary-500 animate-spin" />
          )}
        </div>
        <h3 className="text-lg font-medium text-gray-900">
          {BATCH_STATUS_LABELS[progress.status] || progress.status}
        </h3>
        {isProcessing && (
          <p className="text-sm text-gray-500 mt-1">
            Processing file {progress.files_completed + 1} of {progress.file_count}
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>
            {progress.processed_rows.toLocaleString()} of{' '}
            {progress.total_rows.toLocaleString()} rows
          </span>
          <span>{Math.round(progress.progress_percentage)}%</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-500',
              progress.status === 'FAILED'
                ? 'bg-red-500'
                : progress.status === 'PARTIAL'
                ? 'bg-yellow-500'
                : 'bg-primary-500'
            )}
            style={{ width: `${progress.progress_percentage}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-gray-900">{progress.files_completed}</p>
          <p className="text-xs text-gray-500">Files Done</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-600">
            {progress.success_count.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Records Created</p>
        </div>
        <div className="p-4 bg-red-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-red-600">
            {progress.error_count.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Errors</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-gray-900">{progress.files_failed}</p>
          <p className="text-xs text-gray-500">Files Failed</p>
        </div>
      </div>

      {/* Files list */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h4 className="font-medium text-gray-900">Import Progress by File</h4>
        </div>
        <div className="divide-y max-h-64 overflow-y-auto">
          {progress.files.map((file, index) => {
            const StatusIcon = statusIcons[file.status] || DocumentIcon
            const statusColor = statusColors[file.status] || 'text-gray-400'

            return (
              <div
                key={file.filename}
                className="px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-6 h-6 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                    {index + 1}
                  </div>
                  <StatusIcon className={cn('h-5 w-5', statusColor)} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.filename}</p>
                    <p className="text-xs text-gray-500">
                      {TARGET_MODEL_LABELS[file.target_model as TargetModel] ||
                        file.target_model}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {file.status === 'COMPLETED' || file.status === 'FAILED' ? (
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-green-600">
                        {file.success_count.toLocaleString()} created
                      </span>
                      {file.error_count > 0 && (
                        <span className="text-sm text-red-600">
                          {file.error_count.toLocaleString()} errors
                        </span>
                      )}
                    </div>
                  ) : file.status === 'IMPORTING' ? (
                    <Badge variant="info">Importing...</Badge>
                  ) : (
                    <Badge variant="default">
                      {file.total_rows.toLocaleString()} rows
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Timing */}
      {progress.started_at && (
        <div className="text-center text-sm text-gray-500">
          Started: {new Date(progress.started_at).toLocaleTimeString()}
          {progress.completed_at && (
            <>
              {' '}• Completed: {new Date(progress.completed_at).toLocaleTimeString()}
            </>
          )}
        </div>
      )}
    </div>
  )
}
