import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SparklesIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  BatchJob,
  ImportBatch,
  TARGET_MODEL_LABELS,
  TargetModel,
} from '@/services/imports'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'

interface BatchAnalysisProps {
  batch: ImportBatch
  onJobUpdate?: (jobId: string, targetModel: TargetModel) => void
  editable?: boolean
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const variant =
    confidence >= 0.7 ? 'success' : confidence >= 0.5 ? 'warning' : 'danger'
  return (
    <Badge variant={variant} size="sm">
      {Math.round(confidence * 100)}% match
    </Badge>
  )
}


function JobCard({
  job,
  index,
  onTargetModelChange,
  editable,
}: {
  job: BatchJob
  index: number
  onTargetModelChange?: (targetModel: TargetModel) => void
  editable?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const targetModelOptions = Object.entries(TARGET_MODEL_LABELS).map(
    ([value, label]) => ({
      value,
      label,
    })
  )

  const matchedCount = Object.keys(job.column_mapping).length
  const totalColumns = job.headers.length

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          'p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50',
          expanded && 'border-b bg-gray-50'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-8 h-8 bg-primary-100 text-primary-700 rounded-full font-medium text-sm">
            {index + 1}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900">{job.filename}</p>
              <ConfidenceBadge confidence={job.detection_confidence} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">
                {job.total_rows.toLocaleString()} rows
              </span>
              <span className="text-gray-300">•</span>
              <span className="text-sm text-gray-500">
                {matchedCount}/{totalColumns} columns mapped
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {editable ? (
            <div className="w-48" onClick={(e) => e.stopPropagation()}>
              <Select
                value={job.target_model}
                onChange={(e) => onTargetModelChange?.(e.target.value as TargetModel)}
                options={targetModelOptions}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ArrowRightIcon className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-gray-900">
                {TARGET_MODEL_LABELS[job.target_model as TargetModel] || job.target_model}
              </span>
            </div>
          )}
          {expanded ? (
            <ChevronUpIcon className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* Column mappings */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Column Mappings
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {job.headers.map((header) => {
                const mapping = job.column_mapping[header]

                return (
                  <div
                    key={header}
                    className={cn(
                      'px-3 py-2 rounded text-sm',
                      mapping ? 'bg-green-50' : 'bg-gray-50'
                    )}
                  >
                    <p className="font-medium text-gray-700 truncate" title={header}>
                      {header}
                    </p>
                    {mapping ? (
                      <p className="text-green-700 truncate" title={mapping}>
                        → {mapping}
                      </p>
                    ) : (
                      <p className="text-gray-400 italic">Not mapped</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sample data preview */}
          {job.sample_data.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Sample Data (first 3 rows)
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      {job.headers.slice(0, 6).map((header) => (
                        <th
                          key={header}
                          className="px-3 py-2 text-left font-medium text-gray-700"
                        >
                          {header}
                        </th>
                      ))}
                      {job.headers.length > 6 && (
                        <th className="px-3 py-2 text-left font-medium text-gray-500">
                          +{job.headers.length - 6} more
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {job.sample_data.slice(0, 3).map((row, i) => (
                      <tr key={i} className="border-t">
                        {row.slice(0, 6).map((cell, j) => (
                          <td
                            key={j}
                            className="px-3 py-2 text-gray-600 truncate max-w-[150px]"
                            title={String(cell)}
                          >
                            {cell || <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                        {row.length > 6 && <td className="px-3 py-2 text-gray-400">...</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BatchAnalysis({
  batch,
  onJobUpdate,
  editable = true,
}: BatchAnalysisProps) {
  const jobs = [...batch.jobs].sort((a, b) => a.processing_order - b.processing_order)

  // Check for warnings
  const lowConfidenceJobs = jobs.filter((j) => j.detection_confidence < 0.5)
  const hasWarnings = lowConfidenceJobs.length > 0

  return (
    <div className="space-y-6">
      {/* AI Analysis header */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg border border-primary-100">
        <div className="p-2 bg-primary-100 rounded-lg">
          <SparklesIcon className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900">AI Analysis Complete</h3>
          <p className="text-sm text-gray-600">
            Detected {jobs.length} data type{jobs.length !== 1 ? 's' : ''} with automatic
            column mapping. Review and adjust if needed.
          </p>
        </div>
      </div>

      {/* Warnings */}
      {hasWarnings && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-700">
              <p className="font-medium">Low confidence detections</p>
              <p className="mt-1">
                {lowConfidenceJobs.length} file{lowConfidenceJobs.length !== 1 ? 's have' : ' has'}{' '}
                low confidence ({'<'}50%). Please verify the detected types are correct.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Processing order info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium">Processing Order</p>
            <p className="mt-1">
              Files will be imported in the order shown below. Setup data (departments,
              grades, banks) is imported first, followed by main records (employees),
              then related data (bank accounts, transactions).
            </p>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-gray-900">{batch.file_count}</p>
          <p className="text-sm text-gray-500">Files</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-gray-900">
            {batch.total_rows.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">Total Rows</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-gray-900">
            {new Set(jobs.map((j) => j.target_model)).size}
          </p>
          <p className="text-sm text-gray-500">Data Types</p>
        </div>
      </div>

      {/* Jobs list */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700">Files to Import</h3>
        {jobs.map((job, index) => (
          <JobCard
            key={job.id}
            job={job}
            index={index}
            editable={editable}
            onTargetModelChange={(targetModel) => onJobUpdate?.(job.id, targetModel)}
          />
        ))}
      </div>
    </div>
  )
}
