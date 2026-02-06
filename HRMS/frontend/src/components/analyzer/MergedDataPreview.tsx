import { useState } from 'react'
import {
  TableCellsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'
import type { MergePreviewResult } from '@/services/datasets'

interface MergedDataPreviewProps {
  preview: MergePreviewResult | null
  isLoading?: boolean
  error?: string
}

export function MergedDataPreview({
  preview,
  isLoading,
  error,
}: MergedDataPreviewProps) {
  const [page, setPage] = useState(0)
  const pageSize = 10

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Generating preview...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg border border-red-200">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center text-gray-500">
          <TableCellsIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>Configure joins and click Preview to see merged data</p>
        </div>
      </div>
    )
  }

  if (!preview.success) {
    return (
      <div className="bg-red-50 rounded-lg border border-red-200 p-4">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="w-6 h-6 text-red-500 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-red-800">Merge Failed</h4>
            <ul className="mt-2 space-y-1">
              {preview.errors.map((err, i) => (
                <li key={i} className="text-sm text-red-700">{err}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(preview.data.length / pageSize)
  const startRow = page * pageSize
  const endRow = Math.min(startRow + pageSize, preview.data.length)
  const visibleData = preview.data.slice(startRow, endRow)

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5 text-success-500" />
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{preview.row_count.toLocaleString()}</span> rows
          </span>
        </div>
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{preview.headers.length}</span> columns
        </div>
        {preview.statistics.files_merged && (
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{preview.statistics.files_merged}</span> files merged
          </div>
        )}

        {/* Warnings */}
        {preview.warnings.length > 0 && (
          <div className="flex items-center gap-2 text-warning-600">
            <ExclamationTriangleIcon className="w-4 h-4" />
            <span className="text-sm">{preview.warnings.length} warning(s)</span>
          </div>
        )}
      </div>

      {/* Warnings detail */}
      {preview.warnings.length > 0 && (
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-warning-800 mb-2">Warnings</h4>
          <ul className="space-y-1">
            {preview.warnings.map((warning, i) => (
              <li key={i} className="text-sm text-warning-700 flex items-start gap-2">
                <span className="text-warning-500">-</span>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Data table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  #
                </th>
                {preview.headers.map((header, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    title={header}
                  >
                    {header.length > 25 ? header.slice(0, 25) + '...' : header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {visibleData.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 text-xs text-gray-400 border-r border-gray-200">
                    {startRow + rowIndex + 1}
                  </td>
                  {row.map((cell, colIndex) => (
                    <td
                      key={colIndex}
                      className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap max-w-xs truncate"
                      title={String(cell ?? '')}
                    >
                      {cell === null || cell === '' ? (
                        <span className="text-gray-300 italic">null</span>
                      ) : (
                        String(cell).length > 30 ? String(cell).slice(0, 30) + '...' : String(cell)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-500">
            Showing {startRow + 1} to {endRow} of {preview.data.length} rows
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className={cn(
                'p-1 rounded hover:bg-gray-200 transition-colors',
                page === 0 && 'opacity-50 cursor-not-allowed'
              )}
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className={cn(
                'p-1 rounded hover:bg-gray-200 transition-colors',
                page >= totalPages - 1 && 'opacity-50 cursor-not-allowed'
              )}
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MergedDataPreview
