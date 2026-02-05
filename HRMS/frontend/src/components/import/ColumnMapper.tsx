import { useState, useMemo } from 'react'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import Select from '@/components/ui/Select'
import { cn } from '@/lib/utils'
import type { ImportJob, FieldDefinition } from '@/services/imports'

interface ColumnMapperProps {
  job: ImportJob
  fieldDefinitions: Record<string, FieldDefinition>
  columnMapping: Record<string, string>
  onMappingChange: (mapping: Record<string, string>) => void
  disabled?: boolean
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600'
  if (confidence >= 0.5) return 'text-yellow-600'
  return 'text-red-600'
}

function getConfidenceIcon(confidence: number) {
  if (confidence >= 0.8) {
    return <CheckCircleIcon className="h-5 w-5 text-green-500" />
  }
  if (confidence >= 0.5) {
    return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
  }
  return <QuestionMarkCircleIcon className="h-5 w-5 text-gray-400" />
}

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

export default function ColumnMapper({
  job,
  fieldDefinitions,
  columnMapping,
  onMappingChange,
  disabled = false,
}: ColumnMapperProps) {
  const [showUnmapped, setShowUnmapped] = useState(false)

  // Create field options for dropdown
  const fieldOptions = useMemo(() => {
    const options = [{ value: '', label: '-- Skip this column --' }]

    Object.entries(fieldDefinitions).forEach(([key, field]) => {
      options.push({
        value: key,
        label: `${field.name}${field.required ? ' *' : ''}`,
      })
    })

    return options
  }, [fieldDefinitions])

  // Get unmapped required fields
  const unmappedRequired = useMemo(() => {
    const mappedFields = new Set(Object.values(columnMapping))
    return Object.entries(fieldDefinitions)
      .filter(([key, field]) => field.required && !mappedFields.has(key))
      .map(([key, field]) => field.name)
  }, [fieldDefinitions, columnMapping])

  // Handle mapping change for a column
  const handleColumnMap = (sourceColumn: string, targetField: string) => {
    const newMapping = { ...columnMapping }
    if (targetField) {
      newMapping[sourceColumn] = targetField
    } else {
      delete newMapping[sourceColumn]
    }
    onMappingChange(newMapping)
  }

  // Filter headers based on showUnmapped
  const displayedHeaders = showUnmapped
    ? job.headers.filter((h) => !columnMapping[h])
    : job.headers

  return (
    <div className="space-y-6">
      {/* Unmapped required fields warning */}
      {unmappedRequired.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Required fields not mapped
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                The following required fields have not been mapped:{' '}
                <span className="font-medium">{unmappedRequired.join(', ')}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Column Mapping</h3>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showUnmapped}
            onChange={(e) => setShowUnmapped(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Show only unmapped columns
        </label>
      </div>

      {/* Column mapping table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Source Column
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-12">
                &nbsp;
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Target Field
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Confidence
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Sample Values
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayedHeaders.map((header, index) => {
              const mappedField = columnMapping[header] || ''
              const confidence = job.mapping_confidence?.[header]
              const sampleValues = job.sample_data?.slice(0, 3).map((row) => row[index]) || []

              return (
                <tr key={header} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900">{header}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ArrowRightIcon className="h-4 w-4 text-gray-400 mx-auto" />
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={mappedField}
                      onChange={(e) => handleColumnMap(header, e.target.value)}
                      options={fieldOptions}
                      disabled={disabled}
                      className="w-full"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {confidence && (
                      <div className="flex items-center gap-2">
                        {getConfidenceIcon(confidence.confidence)}
                        <span
                          className={cn(
                            'text-sm font-medium',
                            getConfidenceColor(confidence.confidence)
                          )}
                        >
                          {formatConfidence(confidence.confidence)}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {sampleValues.slice(0, 3).map((val, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 max-w-[150px] truncate"
                          title={String(val)}
                        >
                          {val || <span className="text-gray-400 italic">empty</span>}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mapping summary */}
      <div className="flex items-center justify-between text-sm text-gray-600 pt-4 border-t">
        <span>
          {Object.keys(columnMapping).length} of {job.headers.length} columns mapped
        </span>
        <span>
          {unmappedRequired.length === 0 ? (
            <span className="text-green-600 flex items-center gap-1">
              <CheckCircleIcon className="h-4 w-4" />
              All required fields mapped
            </span>
          ) : (
            <span className="text-yellow-600">
              {unmappedRequired.length} required field(s) unmapped
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
