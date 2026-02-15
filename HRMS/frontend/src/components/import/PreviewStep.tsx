/**
 * Step 3: Show dry-run preview with summary stats and action per row.
 *
 * Displays the preview summary (creates, updates, skips, errors) and lets
 * the user confirm or go back to adjust mappings.
 */

import {
  ArrowLeftIcon,
  CheckIcon,
  PlusIcon,
  PencilSquareIcon,
  ForwardIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/Card'
import type { PreviewResponse, AnalyzeResponse } from '@/services/import'

interface PreviewStepProps {
  analyzeData: AnalyzeResponse
  previewData: PreviewResponse
  isConfirming: boolean
  onConfirm: () => void
  onBack: () => void
}

export default function PreviewStep({
  analyzeData,
  previewData,
  isConfirming,
  onConfirm,
  onBack,
}: PreviewStepProps) {
  const { summary } = previewData
  const hasErrors = summary.errors > 0

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Rows"
          value={summary.total}
          icon={<span className="text-sm font-bold">#</span>}
          variant="info"
        />
        <StatCard
          title="To Create"
          value={summary.to_create}
          icon={<PlusIcon className="w-5 h-5" />}
          variant="success"
        />
        <StatCard
          title="To Update"
          value={summary.to_update}
          icon={<PencilSquareIcon className="w-5 h-5" />}
          variant="primary"
        />
        <StatCard
          title="To Skip"
          value={summary.to_skip}
          icon={<ForwardIcon className="w-5 h-5" />}
          variant="warning"
        />
        <StatCard
          title="Errors"
          value={summary.errors}
          icon={<ExclamationTriangleIcon className="w-5 h-5" />}
          variant={hasErrors ? 'danger' : 'default'}
        />
      </div>

      {/* Warnings */}
      {summary.warnings > 0 && (
        <div className="rounded-md bg-warning-50 border border-warning-200 p-4">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-warning-600 flex-shrink-0" />
            <p className="text-sm text-warning-800">
              {summary.warnings} row{summary.warnings !== 1 && 's'} have warnings.
              They will still be imported but may need manual review.
            </p>
          </div>
        </div>
      )}

      {/* Entity info */}
      <Card>
        <CardHeader>
          <CardTitle>Import Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Entity Type</dt>
              <dd className="mt-0.5 font-medium text-gray-900">
                <Badge variant="info">{analyzeData.entity_type.replace(/_/g, ' ')}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Source File Rows</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{analyzeData.total_rows}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd className="mt-0.5">
                <Badge variant={hasErrors ? 'warning' : 'success'}>
                  {hasErrors ? 'Has Errors' : 'Ready'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Actionable Rows</dt>
              <dd className="mt-0.5 font-medium text-gray-900">
                {summary.to_create + summary.to_update}
              </dd>
            </div>
          </dl>
        </CardContent>
        <CardFooter>
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              onClick={onBack}
              leftIcon={<ArrowLeftIcon className="w-4 h-4" />}
            >
              Back to Mapping
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isConfirming || (summary.to_create + summary.to_update === 0)}
              isLoading={isConfirming}
              variant={hasErrors ? 'outline' : 'primary'}
              leftIcon={<CheckIcon className="w-4 h-4" />}
            >
              {hasErrors ? 'Confirm (with errors)' : 'Confirm Import'}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
