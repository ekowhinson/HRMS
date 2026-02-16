import { useState, useMemo, forwardRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/20/solid'
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
      required,
      value,
      onChange,
      onBlur,
      name,
      disabled,
    },
    _ref
  ) => {
    const [query, setQuery] = useState('')
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const config = getFieldSetupConfig(fieldKey)
    const setupUrl = getSetupUrl(fieldKey)

    const isDisabled = isLoading || disabled

    const selectedOption = useMemo(
      () => options.find((o) => o.value === String(value ?? '')) || null,
      [options, value]
    )

    const filteredOptions = useMemo(() => {
      if (!query) return options
      const lower = query.toLowerCase()
      return options.filter((o) => o.label.toLowerCase().includes(lower))
    }, [options, query])

    const handleChange = (option: SelectOption | null) => {
      if (onChange) {
        const syntheticEvent = {
          target: { value: option?.value ?? '', name: name ?? '' },
          currentTarget: { value: option?.value ?? '', name: name ?? '' },
        } as unknown as React.ChangeEvent<HTMLSelectElement>
        onChange(syntheticEvent)
      }
    }

    return (
      <div className="w-full">
        {label && (
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor={selectId} className="block text-sm font-medium text-gray-700">
              {label}
              {required && <span className="text-red-500 ml-0.5">*</span>}
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
        <Combobox
          value={selectedOption}
          onChange={handleChange}
          onClose={() => setQuery('')}
          disabled={isDisabled}
          immediate
        >
          <div className="relative">
            <ComboboxInput
              id={selectId}
              autoComplete="off"
              className={cn(
                'block w-full px-3 py-2.5 border rounded-md pr-8',
                'bg-gray-50 transition-colors duration-150',
                'focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:bg-white',
                'hover:border-gray-400',
                'sm:text-sm',
                'disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed',
                error
                  ? 'border-danger-500 text-danger-900 focus:ring-danger-500 focus:border-danger-500'
                  : 'border-gray-300',
                isLoading && 'animate-pulse bg-gray-100',
                className
              )}
              displayValue={(option: SelectOption | null) =>
                isLoading ? '' : (option?.label ?? '')
              }
              onChange={(e) => setQuery(e.target.value)}
              onBlur={onBlur as any}
              placeholder={isLoading ? 'Loading...' : (placeholder || 'Select...')}
            />
            <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
              )}
            </ComboboxButton>
          </div>
          <ComboboxOptions
            anchor="bottom start"
            transition
            className={cn(
              'w-[var(--input-width)] z-50 max-h-60 overflow-auto rounded-md',
              'bg-white py-1 text-sm shadow-dropdown border border-gray-200 focus:outline-none',
              'transition duration-100 ease-out data-[leave]:data-[closed]:opacity-0',
              'empty:invisible',
            )}
          >
            {filteredOptions.length === 0 ? (
              <div className="relative cursor-default select-none px-4 py-2 text-gray-500">
                {query ? 'No results found' : 'No options available'}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <ComboboxOption
                  key={option.value}
                  value={option}
                  className="group relative cursor-pointer select-none py-2 pl-10 pr-4 text-gray-900 data-[focus]:bg-gray-50 data-[focus]:text-gray-900"
                >
                  <span className="block truncate group-data-[selected]:font-semibold">
                    {option.label}
                  </span>
                  <span className="absolute inset-y-0 left-0 hidden items-center pl-3 text-primary-600 group-data-[selected]:flex">
                    <CheckIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                </ComboboxOption>
              ))
            )}
          </ComboboxOptions>
        </Combobox>
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
