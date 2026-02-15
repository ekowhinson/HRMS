/**
 * Step 4 + 5: Execution progress bar, then completion summary.
 *
 * While executing, polls progress from Redis and shows a live bar.
 * On complete/failed, shows final stats and lets user start a new import.
 */

import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/Card'
import type { ProgressResponse, ImportSession } from '@/services/import'
import type { ImportStep } from '@/hooks/useImportPipeline'

interface ExecutionStepProps {
  step: ImportStep
  progress: ProgressResponse | null
  session: ImportSession | null
  onReset: () => void
}

export default function ExecutionStep({
  step,
  progress,
  session,
  onReset,
}: ExecutionStepProps) {
  const isComplete = step === 'complete'
  const isFailed = progress?.status === 'FAILED' || session?.status === 'FAILED'
  const pct = progress?.progress?.percentage ?? 0

  // Use session data for final counts when available, else progress
  const created = session?.rows_created ?? progress?.rows_created ?? 0
  const updated = session?.rows_updated ?? progress?.rows_updated ?? 0
  const errored = session?.rows_errored ?? progress?.rows_errored ?? 0

  return (
    <div className="space-y-6">
      {/* Progress card */}
      {!isComplete && (
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-500" />
                </span>
                Importing...
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>
                  {progress?.progress?.processed ?? 0} / {progress?.progress?.total ?? '...'} rows
                </span>
                <span className="font-medium">{Math.round(pct)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completion card */}
      {isComplete && (
        <>
          {/* Status banner */}
          <div
            className={cn(
              'rounded-lg p-6 flex items-center gap-4',
              isFailed ? 'bg-danger-50 border border-danger-200' : 'bg-success-50 border border-success-200',
            )}
          >
            {isFailed ? (
              <XCircleIcon className="w-10 h-10 text-danger-500 flex-shrink-0" />
            ) : (
              <CheckCircleIcon className="w-10 h-10 text-success-500 flex-shrink-0" />
            )}
            <div>
              <h3 className={cn('text-lg font-semibold', isFailed ? 'text-danger-800' : 'text-success-800')}>
                {isFailed ? 'Import Failed' : 'Import Completed'}
              </h3>
              <p className={cn('text-sm mt-0.5', isFailed ? 'text-danger-600' : 'text-success-600')}>
                {isFailed
                  ? (progress?.progress?.error || 'An error occurred during import.')
                  : `Successfully processed ${created + updated} records.`}
              </p>
            </div>
          </div>

          {/* Result stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard title="Created" value={created} variant="success" />
            <StatCard title="Updated" value={updated} variant="primary" />
            <StatCard title="Errors" value={errored} variant={errored > 0 ? 'danger' : 'default'} />
          </div>

          {/* Action */}
          <Card>
            <CardFooter>
              <div className="flex justify-end w-full">
                <Button
                  onClick={onReset}
                  leftIcon={<ArrowPathIcon className="w-4 h-4" />}
                >
                  New Import
                </Button>
              </div>
            </CardFooter>
          </Card>
        </>
      )}
    </div>
  )
}
