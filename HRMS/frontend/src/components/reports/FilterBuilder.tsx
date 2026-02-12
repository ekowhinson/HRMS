import { useCallback } from 'react'
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import type { FieldInfo, ReportFilter } from '@/services/reportBuilder'
import { OPERATORS_BY_TYPE } from '@/services/reportBuilder'

interface FilterBuilderProps {
  filters: ReportFilter[]
  fields: FieldInfo[]
  onChange: (filters: ReportFilter[]) => void
  className?: string
}

function getFieldType(fields: FieldInfo[], fieldPath: string): string {
  const field = fields.find((f) => f.path === fieldPath)
  return field?.type || 'string'
}

function getFieldChoices(fields: FieldInfo[], fieldPath: string): { value: string; label: string }[] | null {
  const field = fields.find((f) => f.path === fieldPath)
  return field?.choices || null
}

function operatorNeedsValue(operator: string): boolean {
  return !['IS_NULL', 'IS_NOT_NULL'].includes(operator)
}

export default function FilterBuilder({ filters, fields, onChange, className }: FilterBuilderProps) {
  const addFilter = useCallback(() => {
    onChange([
      ...filters,
      { field: '', operator: '=', value: '' },
    ])
  }, [filters, onChange])

  const removeFilter = useCallback(
    (index: number) => {
      const updated = filters.filter((_, i) => i !== index)
      onChange(updated)
    },
    [filters, onChange]
  )

  const updateFilter = useCallback(
    (index: number, patch: Partial<ReportFilter>) => {
      const updated = filters.map((f, i) => {
        if (i !== index) return f
        const newFilter = { ...f, ...patch }

        // Reset operator and value when field changes
        if (patch.field && patch.field !== f.field) {
          const fieldType = getFieldType(fields, patch.field)
          const availableOps = OPERATORS_BY_TYPE[fieldType] || OPERATORS_BY_TYPE['string']
          newFilter.operator = availableOps[0]?.value || '='
          newFilter.value = ''
        }

        // Reset value when operator changes to a type that doesn't need one
        if (patch.operator && !operatorNeedsValue(patch.operator)) {
          newFilter.value = ''
        }

        // When switching to BETWEEN, set value as array
        if (patch.operator === 'BETWEEN' && !Array.isArray(newFilter.value)) {
          newFilter.value = ['', '']
        }

        // When switching to IN operator, set value as array
        if (patch.operator === 'IN' && !Array.isArray(newFilter.value)) {
          newFilter.value = []
        }

        return newFilter
      })
      onChange(updated)
    },
    [filters, fields, onChange]
  )

  const fieldOptions = fields.map((f) => ({
    value: f.path,
    label: f.label,
  }))

  if (fields.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-3', className)}>
      {filters.map((filter, index) => {
        const fieldType = filter.field ? getFieldType(fields, filter.field) : 'string'
        const operators = OPERATORS_BY_TYPE[fieldType] || OPERATORS_BY_TYPE['string']
        const choices = filter.field ? getFieldChoices(fields, filter.field) : null
        const needsValue = operatorNeedsValue(filter.operator)

        return (
          <div key={index} className="flex items-start gap-2">
            {/* Field select */}
            <select
              value={filter.field}
              onChange={(e) => updateFilter(index, { field: e.target.value })}
              className="block w-44 flex-shrink-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Select field...</option>
              {fieldOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Operator select */}
            <select
              value={filter.operator}
              onChange={(e) => updateFilter(index, { operator: e.target.value })}
              disabled={!filter.field}
              className="block w-40 flex-shrink-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              {operators.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            {/* Value input */}
            {needsValue && (
              <div className="flex-1 min-w-0">
                <FilterValueInput
                  fieldType={fieldType}
                  operator={filter.operator}
                  value={filter.value}
                  choices={choices}
                  onChange={(val) => updateFilter(index, { value: val })}
                  disabled={!filter.field}
                />
              </div>
            )}

            {/* Remove button */}
            <button
              type="button"
              onClick={() => removeFilter(index)}
              className="flex-shrink-0 mt-1 p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-md transition-colors"
              aria-label="Remove filter"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        )
      })}

      <Button
        variant="ghost"
        size="sm"
        onClick={addFilter}
        leftIcon={<PlusIcon className="w-4 h-4" />}
      >
        Add filter
      </Button>
    </div>
  )
}

// ==================== Value Input ====================

interface FilterValueInputProps {
  fieldType: string
  operator: string
  value: any
  choices: { value: string; label: string }[] | null
  onChange: (value: any) => void
  disabled: boolean
}

function FilterValueInput({ fieldType, operator, value, choices, onChange, disabled }: FilterValueInputProps) {
  const inputClass =
    'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400'

  // BETWEEN operator: two inputs
  if (operator === 'BETWEEN') {
    const rangeValue = Array.isArray(value) ? value : ['', '']
    const inputType = fieldType === 'date' ? 'date' : 'number'
    return (
      <div className="flex items-center gap-2">
        <input
          type={inputType}
          value={rangeValue[0] || ''}
          onChange={(e) => onChange([e.target.value, rangeValue[1]])}
          placeholder="From"
          disabled={disabled}
          className={inputClass}
        />
        <span className="text-sm text-gray-500 flex-shrink-0">and</span>
        <input
          type={inputType}
          value={rangeValue[1] || ''}
          onChange={(e) => onChange([rangeValue[0], e.target.value])}
          placeholder="To"
          disabled={disabled}
          className={inputClass}
        />
      </div>
    )
  }

  // IN operator with choices: multi-select via checkboxes in a dropdown-like area
  if (operator === 'IN' && choices) {
    const selected = Array.isArray(value) ? value : []
    return (
      <div className="max-h-32 overflow-y-auto rounded-md border border-gray-300 bg-white p-2 space-y-1">
        {choices.map((ch) => (
          <label key={ch.value} className="flex items-center gap-2 px-1 py-0.5 text-sm cursor-pointer hover:bg-gray-50 rounded">
            <input
              type="checkbox"
              checked={selected.includes(ch.value)}
              onChange={(e) => {
                if (e.target.checked) {
                  onChange([...selected, ch.value])
                } else {
                  onChange(selected.filter((v: string) => v !== ch.value))
                }
              }}
              className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-gray-700">{ch.label}</span>
          </label>
        ))}
        {choices.length === 0 && (
          <p className="text-xs text-gray-400 px-1">No options available</p>
        )}
      </div>
    )
  }

  // Choice field with = or != operator: single select dropdown
  if (fieldType === 'choice' && choices) {
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={inputClass}
      >
        <option value="">Select value...</option>
        {choices.map((ch) => (
          <option key={ch.value} value={ch.value}>
            {ch.label}
          </option>
        ))}
      </select>
    )
  }

  // Boolean field
  if (fieldType === 'boolean') {
    return (
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={inputClass}
      >
        <option value="">Select...</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    )
  }

  // Date field
  if (fieldType === 'date') {
    return (
      <input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={inputClass}
      />
    )
  }

  // Number field
  if (fieldType === 'number') {
    return (
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter value..."
        disabled={disabled}
        className={inputClass}
      />
    )
  }

  // Default: text input
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter value..."
      disabled={disabled}
      className={inputClass}
    />
  )
}
