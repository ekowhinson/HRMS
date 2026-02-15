/**
 * Step 2: Review and adjust AI-proposed column mapping.
 *
 * Shows source columns on the left, target field dropdowns on the right.
 * User can adjust any mapping before proceeding to preview.
 */

import { useMemo } from 'react'
import {
  ArrowRightIcon,
  ArrowLeftIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card'
import type { AnalyzeResponse, ColumnMapping } from '@/services/import'

interface MappingStepProps {
  analyzeData: AnalyzeResponse
  editedMapping: ColumnMapping
  onMappingChange: (mapping: ColumnMapping) => void
  onSubmit: (importParams?: Record<string, any>) => void
  onBack: () => void
  isPreviewing: boolean
}

export default function MappingStep({
  analyzeData,
  editedMapping,
  onMappingChange,
  onSubmit,
  onBack,
  isPreviewing,
}: MappingStepProps) {
  const { source_columns, target_schema, sample_data, entity_type, total_rows } = analyzeData

  const targetFields = useMemo(
    () => Object.entries(target_schema).map(([field, description]) => ({ field, description })),
    [target_schema],
  )

  const mappedCount = Object.values(editedMapping).filter(Boolean).length

  const handleFieldChange = (sourceCol: string, targetField: string | null) => {
    onMappingChange({ ...editedMapping, [sourceCol]: targetField })
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant="info">
          {entity_type.replace(/_/g, ' ')}
        </Badge>
        <span className="text-gray-500">
          {total_rows} rows &middot; {source_columns.length} columns &middot;{' '}
          <span className="font-medium text-primary-700">{mappedCount}</span> mapped
        </span>
        <div className="flex items-center gap-1 text-gray-400 ml-auto">
          <SparklesIcon className="w-4 h-4" />
          <span className="text-xs">AI-suggested mapping</span>
        </div>
      </div>

      {/* Mapping table */}
      <Card>
        <CardHeader>
          <CardTitle>Column Mapping</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/3">
                    Source Column
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/3">
                    Target Field
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Sample Values
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {source_columns.map((col) => {
                  const mapped = editedMapping[col] ?? null

                  return (
                    <tr key={col} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {col}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400">
                        <ArrowRightIcon className="w-4 h-4 mx-auto" />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={mapped ?? ''}
                          onChange={(e) =>
                            handleFieldChange(col, e.target.value || null)
                          }
                          className={cn(
                            'block w-full rounded-md border text-sm py-1.5 px-2',
                            'focus:border-primary-500 focus:ring-primary-500',
                            mapped ? 'border-primary-300 bg-primary-50/50' : 'border-gray-300',
                          )}
                        >
                          <option value="">— skip —</option>
                          {targetFields.map((tf) => (
                            <option key={tf.field} value={tf.field}>
                              {tf.field} — {tf.description}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                        {sample_data
                          .slice(0, 3)
                          .map((row) => row[col] ?? '—')
                          .join(', ')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
        <CardFooter>
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              onClick={onBack}
              leftIcon={<ArrowLeftIcon className="w-4 h-4" />}
            >
              Back
            </Button>
            <Button
              onClick={() => onSubmit()}
              disabled={mappedCount === 0 || isPreviewing}
              isLoading={isPreviewing}
            >
              Generate Preview
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
