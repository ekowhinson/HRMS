import React, { forwardRef, useId, useState } from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showCharCount?: boolean;
  maxLength?: number;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      showCharCount = false,
      maxLength,
      resize = 'vertical',
      className,
      id: providedId,
      onChange,
      value,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || (label ? `textarea-${generatedId}` : undefined);
    const [charCount, setCharCount] = useState(
      (value as string)?.length || (defaultValue as string)?.length || 0
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      onChange?.(e);
    };

    const resizeClasses = {
      none: 'resize-none',
      vertical: 'resize-y',
      horizontal: 'resize-x',
      both: 'resize',
    };

    return (
      <div className="w-full">
        {/* Label */}
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
          </label>
        )}

        {/* Textarea */}
        <textarea
          ref={ref}
          id={id}
          maxLength={maxLength}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          className={cn(
            'block w-full px-3 py-2.5 border rounded-md',
            'bg-gray-50 placeholder-gray-400 text-gray-900',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:bg-white',
            'hover:border-gray-400',
            'sm:text-sm',
            resizeClasses[resize],
            error
              ? 'border-danger-500 focus:ring-danger-500 focus:border-danger-500'
              : 'border-gray-300',
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? `${id}-error` : helperText ? `${id}-helper` : undefined
          }
          {...props}
        />

        {/* Footer with error/helper text and character count */}
        <div className="flex justify-between items-start mt-1.5">
          <div className="flex-1">
            {error && (
              <p
                id={`${id}-error`}
                className="text-sm text-danger-600"
                role="alert"
              >
                {error}
              </p>
            )}
            {!error && helperText && (
              <p id={`${id}-helper`} className="text-sm text-gray-500">
                {helperText}
              </p>
            )}
          </div>

          {showCharCount && (
            <span
              className={cn(
                'text-xs ml-2 flex-shrink-0',
                maxLength && charCount >= maxLength
                  ? 'text-danger-600'
                  : maxLength && charCount >= maxLength * 0.9
                  ? 'text-warning-600'
                  : 'text-gray-400'
              )}
            >
              {charCount}
              {maxLength && ` / ${maxLength}`}
            </span>
          )}
        </div>
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
