import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { Cog6ToothIcon, PlusIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'
import { getSetupUrl, getFieldSetupConfig } from '@/lib/field-setup-config'
import Tooltip from './Tooltip'

export interface SelectOption {
  value: string
  label: string
}

export interface LinkedSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Field key matching FIELD_SETUP_CONFIG (e.g., 'department', 'bank') */
  fieldKey: string
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
  /** Show the setup link icon (default: true) */
  showSetupLink?: boolean
  /** Show "Add New" link instead of settings icon */
  showAddNew?: boolean
  /** Loading state */
  isLoading?: boolean
}

const LinkedSelect = forwardRef<HTMLSelectElement, LinkedSelectProps>(
  (
    {
      className,
      fieldKey,
      label,
      error,
      options,
      placeholder,
      showSetupLink = true,
      showAddNew = false,
      isLoading = false,
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const config = getFieldSetupConfig(fieldKey)
    const setupUrl = getSetupUrl(fieldKey)

    return (
      <div className="w-full">
        {label && (
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor={selectId} className="block text-sm font-medium text-gray-700">
              {label}
            </label>
            {showSetupLink && config && (
              <Tooltip content={config.setupLabel} position="left">
                <Link
                  to={setupUrl}
                  className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {showAddNew ? (
                    <>
                      <PlusIcon className="h-3.5 w-3.5" />
                      <span>Add</span>
                    </>
                  ) : (
                    <Cog6ToothIcon className="h-4 w-4" />
                  )}
                </Link>
              </Tooltip>
            )}
          </div>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'block w-full px-3 py-2.5 border rounded-lg shadow-sm',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
              'hover:border-gray-400',
              'sm:text-sm bg-white',
              'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
              error
                ? 'border-danger-500 text-danger-900 focus:ring-danger-500/20 focus:border-danger-500'
                : 'border-gray-300',
              isLoading && 'animate-pulse bg-gray-100',
              className
            )}
            disabled={isLoading || props.disabled}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {isLoading ? 'Loading...' : placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {isLoading && (
            <div className="absolute inset-y-0 right-8 flex items-center pointer-events-none">
              <div className="h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        {error && <p className="mt-1.5 text-sm text-danger-600">{error}</p>}
        {!error && options.length === 0 && !isLoading && config && (
          <p className="mt-1.5 text-sm text-gray-500">
            No options available.{' '}
            <Link to={setupUrl} className="text-primary-600 hover:text-primary-700 underline">
              Add one in setup
            </Link>
          </p>
        )}
      </div>
    )
  }
)

LinkedSelect.displayName = 'LinkedSelect'

export default LinkedSelect
