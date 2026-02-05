import { useState } from 'react'
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { ImportJob, ValidationResult } from '@/services/imports'

interface ImportPreviewProps {
  job: ImportJob
  validation: ValidationResult | null
  onDownloadErrors?: () => void
  disabled?: boolean
}

const PAGE_SIZE = 50

export default function ImportPreview({
  job,
  validation,
  onDownloadErrors,
  disabled = false,
}: ImportPreviewProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [showOnlyErrors, setShowOnlyErrors] = useState(false)

  // Filter sample transformations if showing only errors
  const displayData = validation?.sample_transformations || []
  const filteredData = showOnlyErrors
    ? displayData.filter((row) => Object.values(row).some((cell) => cell.error))
    : displayData

  // Pagination
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE)
  const paginatedData = filteredData.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  // Count errors and warnings
  const errorCount = validation?.errors?.length || 0
  const warningCount = validation?.warnings?.length || 0
  const totalRows = job.total_rows || displayData.length

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-600">Total Rows</p>
          <p className="text-2xl font-bold text-blue-700">{totalRows.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm text-green-600">Valid Rows</p>
          <p className="text-2xl font-bold text-green-700">
            {(totalRows - errorCount).toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-red-50 rounded-lg">
          <p className="text-sm text-red-600">Errors</p>
          <p className="text-2xl font-bold text-red-700">{errorCount.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-yellow-50 rounded-lg">
          <p className="text-sm text-yellow-600">Warnings</p>
          <p className="text-2xl font-bold text-yellow-700">
            {warningCount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Validation status */}
      {validation && (
        <div
          className={cn(
            'p-4 rounded-lg border',
            validation.is_valid
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          )}
        >
          <div className="flex items-center gap-3">
            {validation.is_valid ? (
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            ) : (
              <XCircleIcon className="h-6 w-6 text-red-600" />
            )}
            <div>
              <p
                className={cn(
                  'font-medium',
                  validation.is_valid ? 'text-green-800' : 'text-red-800'
                )}
              >
                {validation.is_valid
                  ? 'Validation passed! Ready to import.'
                  : 'Validation failed. Please fix errors before importing.'}
              </p>
              {validation.errors.length > 0 && (
                <p className="text-sm text-red-700 mt-1">
                  {validation.errors.length} error(s) found
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error list */}
      {validation && validation.errors.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-red-50 px-4 py-3 border-b flex items-center justify-between">
            <h4 className="text-sm font-medium text-red-800">Validation Errors</h4>
            {onDownloadErrors && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDownloadErrors}
                disabled={disabled}
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
                Download Error Report
              </Button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto">
            <ul className="divide-y divide-red-100">
              {validation.errors.slice(0, 10).map((error, index) => (
                <li key={index} className="px-4 py-2 text-sm text-red-700">
                  {error}
                </li>
              ))}
              {validation.errors.length > 10 && (
                <li className="px-4 py-2 text-sm text-red-600 italic">
                  ...and {validation.errors.length - 10} more errors
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Warnings */}
      {validation && validation.warnings.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-yellow-50 px-4 py-3 border-b">
            <h4 className="text-sm font-medium text-yellow-800">Warnings</h4>
          </div>
          <div className="max-h-32 overflow-y-auto">
            <ul className="divide-y divide-yellow-100">
              {validation.warnings.slice(0, 5).map((warning, index) => (
                <li
                  key={index}
                  className="px-4 py-2 text-sm text-yellow-700 flex items-start gap-2"
                >
                  <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  {warning}
                </li>
              ))}
              {validation.warnings.length > 5 && (
                <li className="px-4 py-2 text-sm text-yellow-600 italic">
                  ...and {validation.warnings.length - 5} more warnings
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Data preview table */}
      {paginatedData.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900">Data Preview</h4>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showOnlyErrors}
                onChange={(e) => {
                  setShowOnlyErrors(e.target.checked)
                  setCurrentPage(1)
                }}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Show only rows with errors
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Row
                  </th>
                  {Object.keys(paginatedData[0] || {}).map((field) => (
                    <th
                      key={field}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    >
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.map((row, rowIndex) => {
                  const actualRowIndex = (currentPage - 1) * PAGE_SIZE + rowIndex + 1
                  const hasError = Object.values(row).some((cell) => cell.error)

                  return (
                    <tr
                      key={rowIndex}
                      className={cn(hasError ? 'bg-red-50' : 'hover:bg-gray-50')}
                    >
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {actualRowIndex}
                        {hasError && (
                          <XCircleIcon className="inline h-4 w-4 text-red-500 ml-1" />
                        )}
                      </td>
                      {Object.entries(row).map(([field, cell]) => (
                        <td key={field} className="px-4 py-2 text-sm">
                          {cell.error ? (
                            <div>
                              <span className="text-red-700 line-through">
                                {cell.original}
                              </span>
                              <Badge variant="danger" className="ml-2">
                                {cell.error}
                              </Badge>
                            </div>
                          ) : cell.transformed !== cell.original ? (
                            <div>
                              <span className="text-gray-400 line-through text-xs">
                                {cell.original}
                              </span>
                              <span className="text-green-700 ml-2">
                                {cell.transformed}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-900">{cell.transformed}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Showing {(currentPage - 1) * PAGE_SIZE + 1} to{' '}
                {Math.min(currentPage * PAGE_SIZE, filteredData.length)} of{' '}
                {filteredData.length} rows
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
