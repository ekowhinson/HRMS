import { useState, useMemo, forwardRef } from 'react'
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/20/solid'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, required, value, onChange, onBlur, name, disabled }, _ref) => {
    const [query, setQuery] = useState('')
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')

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
          <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <Combobox
          value={selectedOption}
          onChange={handleChange}
          onClose={() => setQuery('')}
          disabled={disabled}
          immediate
        >
          <div className="relative">
            <ComboboxInput
              id={selectId}
              autoComplete="off"
              className={cn(
                'block w-full px-3 py-2 border rounded-md pr-8',
                'bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:bg-white',
                'hover:border-gray-400 sm:text-sm',
                error
                  ? 'border-danger-500 text-danger-900 focus:ring-danger-500 focus:border-danger-500'
                  : 'border-gray-300',
                disabled && 'bg-gray-100 text-gray-500 cursor-not-allowed',
                className
              )}
              displayValue={(option: SelectOption | null) => option?.label ?? ''}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={onBlur as any}
              placeholder={placeholder || 'Select...'}
            />
            <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
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
        {error && <p className="mt-1 text-sm text-danger-600">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select
