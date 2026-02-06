import { useState } from 'react'
import { XMarkIcon, LinkIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import Button from '@/components/ui/Button'
import { JoinTypeSelector } from './JoinTypeSelector'
import type {
  DatasetFile,
  JoinConfiguration,
  JoinType,
  JoinConfigInput,
} from '@/services/datasets'
import { RELATIONSHIP_TYPE_LABELS } from '@/services/datasets'

interface JoinConfigPanelProps {
  files: DatasetFile[]
  existingJoin?: JoinConfiguration
  onSave: (join: JoinConfigInput) => void
  onClose: () => void
  onDelete?: () => void
}

export function JoinConfigPanel({
  files,
  existingJoin,
  onSave,
  onClose,
  onDelete,
}: JoinConfigPanelProps) {
  const [leftFileId, setLeftFileId] = useState<string>(
    existingJoin?.left_file || files[0]?.id || ''
  )
  const [leftColumn, setLeftColumn] = useState<string>(
    existingJoin?.left_column || ''
  )
  const [rightFileId, setRightFileId] = useState<string>(
    existingJoin?.right_file || files[1]?.id || ''
  )
  const [rightColumn, setRightColumn] = useState<string>(
    existingJoin?.right_column || ''
  )
  const [joinType, setJoinType] = useState<JoinType>(
    existingJoin?.join_type || 'left'
  )

  const leftFile = files.find((f) => f.id === leftFileId)
  const rightFile = files.find((f) => f.id === rightFileId)

  const canSave = leftFileId && leftColumn && rightFileId && rightColumn && leftFileId !== rightFileId

  const handleSave = () => {
    if (!canSave) return
    onSave({
      left_file_id: leftFileId,
      left_column: leftColumn,
      right_file_id: rightFileId,
      right_column: rightColumn,
      join_type: joinType,
      order: existingJoin?.order || 0,
    })
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900">
            {existingJoin ? 'Edit Join' : 'Configure Join'}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* AI Suggestion Info */}
        {existingJoin?.is_ai_suggested && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-primary-700 bg-primary-100 px-2 py-0.5 rounded">
                AI Suggested
              </span>
              <span className="text-sm font-medium text-primary-800">
                {Math.round(existingJoin.ai_confidence * 100)}% confidence
              </span>
            </div>
            {existingJoin.ai_reasoning && (
              <p className="text-sm text-primary-700">{existingJoin.ai_reasoning}</p>
            )}
            {existingJoin.relationship_type && (
              <p className="text-xs text-primary-600 mt-1">
                Relationship: {RELATIONSHIP_TYPE_LABELS[existingJoin.relationship_type]}
              </p>
            )}
          </div>
        )}

        {/* Left File Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Left File (Primary)
          </label>
          <select
            value={leftFileId}
            onChange={(e) => {
              setLeftFileId(e.target.value)
              setLeftColumn('')
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Select file...</option>
            {files.map((file) => (
              <option key={file.id} value={file.id} disabled={file.id === rightFileId}>
                {file.alias || file.file_name} ({file.row_count} rows)
              </option>
            ))}
          </select>
        </div>

        {/* Left Column Selection */}
        {leftFile && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Left Column (Join Key)
            </label>
            <select
              value={leftColumn}
              onChange={(e) => setLeftColumn(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select column...</option>
              {leftFile.headers.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Arrow Indicator */}
        <div className="flex justify-center py-2">
          <ArrowRightIcon className="w-6 h-6 text-gray-400" />
        </div>

        {/* Right File Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Right File (To Join)
          </label>
          <select
            value={rightFileId}
            onChange={(e) => {
              setRightFileId(e.target.value)
              setRightColumn('')
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Select file...</option>
            {files.map((file) => (
              <option key={file.id} value={file.id} disabled={file.id === leftFileId}>
                {file.alias || file.file_name} ({file.row_count} rows)
              </option>
            ))}
          </select>
        </div>

        {/* Right Column Selection */}
        {rightFile && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Right Column (Join Key)
            </label>
            <select
              value={rightColumn}
              onChange={(e) => setRightColumn(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select column...</option>
              {rightFile.headers.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Join Type Selector */}
        <JoinTypeSelector value={joinType} onChange={setJoinType} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
        <div>
          {onDelete && existingJoin && (
            <Button variant="danger" size="sm" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!canSave}
          >
            {existingJoin ? 'Update' : 'Add Join'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default JoinConfigPanel
