import { useMemo } from 'react'
import {
  DocumentIcon,
  LinkIcon,
  ArrowRightIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'
import type { DatasetFile, JoinConfiguration } from '@/services/datasets'
import { JOIN_TYPE_LABELS } from '@/services/datasets'

interface FileRelationshipDiagramProps {
  files: DatasetFile[]
  joins: JoinConfiguration[]
  onSelectJoin?: (join: JoinConfiguration) => void
  onSelectFile?: (file: DatasetFile) => void
  selectedJoinId?: string
}

export function FileRelationshipDiagram({
  files,
  joins,
  onSelectJoin,
  onSelectFile,
  selectedJoinId,
}: FileRelationshipDiagramProps) {
  // Build file positions for layout
  const filePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {}
    const count = files.length
    const radius = 120
    const centerX = 200
    const centerY = 150

    files.forEach((file, index) => {
      const angle = (2 * Math.PI * index) / count - Math.PI / 2
      positions[file.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      }
    })

    return positions
  }, [files])

  // Build join lines
  const joinLines = useMemo(() => {
    return joins.map((join) => {
      const leftPos = filePositions[join.left_file]
      const rightPos = filePositions[join.right_file]

      if (!leftPos || !rightPos) return null

      return {
        join,
        x1: leftPos.x,
        y1: leftPos.y,
        x2: rightPos.x,
        y2: rightPos.y,
        midX: (leftPos.x + rightPos.x) / 2,
        midY: (leftPos.y + rightPos.y) / 2,
      }
    }).filter(Boolean)
  }, [joins, filePositions])

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center text-gray-500">
          <DocumentIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>Upload files to see relationships</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 overflow-hidden">
      <svg
        viewBox="0 0 400 300"
        className="w-full h-64"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid background */}
        <defs>
          <pattern
            id="grid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Join lines */}
        {joinLines.map((line, index) => {
          if (!line) return null
          const isSelected = selectedJoinId === line.join.id

          return (
            <g key={`join-${index}`}>
              {/* Line */}
              <line
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={isSelected ? '#0EA5E9' : '#94A3B8'}
                strokeWidth={isSelected ? 3 : 2}
                strokeDasharray={line.join.join_type === 'inner' ? 'none' : '5,5'}
                className="transition-all cursor-pointer hover:stroke-primary-500"
                onClick={() => onSelectJoin?.(line.join)}
              />

              {/* Join type label */}
              <g
                transform={`translate(${line.midX}, ${line.midY})`}
                className="cursor-pointer"
                onClick={() => onSelectJoin?.(line.join)}
              >
                <rect
                  x="-30"
                  y="-12"
                  width="60"
                  height="24"
                  rx="4"
                  fill={isSelected ? '#0EA5E9' : 'white'}
                  stroke={isSelected ? '#0EA5E9' : '#E5E7EB'}
                  strokeWidth="1"
                />
                <text
                  textAnchor="middle"
                  y="4"
                  className={cn(
                    'text-xs font-medium',
                    isSelected ? 'fill-white' : 'fill-gray-600'
                  )}
                >
                  {JOIN_TYPE_LABELS[line.join.join_type]}
                </text>
              </g>

              {/* Confidence indicator */}
              {line.join.ai_confidence > 0 && (
                <g transform={`translate(${line.midX}, ${line.midY + 20})`}>
                  <text
                    textAnchor="middle"
                    className="text-[10px] fill-gray-400"
                  >
                    {Math.round(line.join.ai_confidence * 100)}% match
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* File nodes */}
        {files.map((file) => {
          const pos = filePositions[file.id]
          if (!pos) return null

          return (
            <g
              key={file.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              className="cursor-pointer"
              onClick={() => onSelectFile?.(file)}
            >
              {/* Node circle */}
              <circle
                r="35"
                fill="white"
                stroke="#E5E7EB"
                strokeWidth="2"
                className="transition-all hover:stroke-primary-500 hover:shadow-lg"
              />

              {/* File icon */}
              <foreignObject x="-12" y="-20" width="24" height="24">
                <TableCellsIcon className="w-6 h-6 text-primary-500" />
              </foreignObject>

              {/* File name */}
              <text
                y="10"
                textAnchor="middle"
                className="text-[10px] font-medium fill-gray-700"
              >
                {(file.alias || file.file_name).slice(0, 12)}
              </text>

              {/* Row count */}
              <text
                y="22"
                textAnchor="middle"
                className="text-[8px] fill-gray-400"
              >
                {file.row_count} rows
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-gray-400" />
          <span>Full join</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-gray-400" style={{ borderStyle: 'dashed' }} />
          <span>Partial join</span>
        </div>
      </div>

      {/* No joins message */}
      {joins.length === 0 && files.length >= 2 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <div className="text-center">
            <LinkIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-500">No joins configured</p>
            <p className="text-xs text-gray-400">Click "Add Join" to connect files</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Compact list view of joins
export function JoinList({
  joins,
  onEdit,
  onDelete,
}: {
  joins: JoinConfiguration[]
  onEdit?: (join: JoinConfiguration) => void
  onDelete?: (join: JoinConfiguration) => void
}) {
  if (joins.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
        <LinkIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm">No joins configured</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {joins.map((join, index) => (
        <div
          key={join.id}
          className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-primary-300 transition-colors"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs flex items-center justify-center font-medium">
              {index + 1}
            </span>

            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="truncate">
                <span className="font-medium text-gray-900">{join.left_file_alias}</span>
                <span className="text-gray-500">.{join.left_column}</span>
              </div>

              <ArrowRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />

              <div className="truncate">
                <span className="font-medium text-gray-900">{join.right_file_alias}</span>
                <span className="text-gray-500">.{join.right_column}</span>
              </div>
            </div>

            <span className={cn(
              'flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium',
              join.join_type === 'inner' ? 'bg-blue-100 text-blue-700' :
              join.join_type === 'left' ? 'bg-green-100 text-green-700' :
              join.join_type === 'right' ? 'bg-orange-100 text-orange-700' :
              'bg-purple-100 text-purple-700'
            )}>
              {JOIN_TYPE_LABELS[join.join_type]}
            </span>

            {join.is_ai_suggested && (
              <span className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700">
                AI {Math.round(join.ai_confidence * 100)}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 ml-2">
            {onEdit && (
              <button
                onClick={() => onEdit(join)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(join)}
                className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default FileRelationshipDiagram
