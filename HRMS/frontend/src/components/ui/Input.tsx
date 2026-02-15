import { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'default' | 'filled' | 'underline';
  showPasswordToggle?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      variant = 'default',
      showPasswordToggle,
      type,
      id,
      required,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    const variantStyles = {
      default: cn(
        'border border-gray-200 bg-gray-50 rounded-md',
        'hover:border-gray-300',
        'focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] focus:bg-white',
        error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500'
      ),
      filled: cn(
        'border-0 bg-gray-100 rounded-md',
        'hover:bg-gray-200/70',
        'focus:bg-white focus:ring-1 focus:ring-[#0969da]',
        error && 'bg-danger-50 focus:ring-danger-500'
      ),
      underline: cn(
        'border-0 border-b-2 border-gray-200 rounded-none bg-transparent px-0',
        'hover:border-gray-400',
        'focus:border-[#0969da]',
        error && 'border-danger-500'
      ),
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative group">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary-500 transition-colors">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            className={cn(
              'block w-full px-4 py-3 placeholder-gray-400',
              'transition-colors duration-150',
              'focus:outline-none',
              'text-sm',
              variantStyles[variant],
              leftIcon && 'pl-11',
              (rightIcon || (isPassword && showPasswordToggle)) && 'pr-11',
              className
            )}
            required={required}
            {...props}
          />
          {(isPassword && showPasswordToggle) && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? (
                <EyeSlashIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          )}
          {rightIcon && !showPasswordToggle && (
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary-500 transition-colors">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-2 text-sm text-danger-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="mt-2 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;

// Search Input with built-in icon
export interface SearchInputProps extends Omit<InputProps, 'leftIcon' | 'type'> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onClear, value, className, ...props }, ref) => {
    return (
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary-500 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={ref}
          type="search"
          value={value}
          className={cn(
            'block w-full pl-11 pr-10 py-2.5 border border-gray-200 bg-gray-50 rounded-md',
            'placeholder-gray-400 text-sm',
            'transition-colors duration-150',
            'focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] focus:bg-white',
            'hover:border-gray-300',
            className
          )}
          {...props}
        />
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
