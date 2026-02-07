import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline' | 'gradient';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  glow?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading,
      leftIcon,
      rightIcon,
      fullWidth,
      glow,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = cn(
      'inline-flex items-center justify-center font-medium rounded-xl',
      'transition-all duration-300 ease-smooth',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
      'active:scale-[0.97]'
    );

    const variants = {
      primary: cn(
        'bg-gradient-to-r from-primary-500 to-primary-600 text-white',
        'hover:from-primary-600 hover:to-primary-700 hover:shadow-lg hover:shadow-primary-500/30',
        'focus:ring-primary-500'
      ),
      secondary: cn(
        'bg-white text-gray-700 border border-gray-200',
        'hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm',
        'focus:ring-gray-300'
      ),
      danger: cn(
        'bg-gradient-to-r from-danger-500 to-danger-600 text-white',
        'hover:from-danger-600 hover:to-danger-700 hover:shadow-lg hover:shadow-danger-500/30',
        'focus:ring-danger-500'
      ),
      success: cn(
        'bg-gradient-to-r from-success-500 to-success-600 text-white',
        'hover:from-success-600 hover:to-success-700 hover:shadow-lg hover:shadow-success-500/30',
        'focus:ring-success-500'
      ),
      ghost: cn(
        'text-gray-700 bg-transparent',
        'hover:bg-gray-100',
        'focus:ring-gray-300'
      ),
      outline: cn(
        'bg-transparent text-primary-600 border border-primary-500/50',
        'hover:bg-primary-50 hover:border-primary-500',
        'focus:ring-primary-500'
      ),
      gradient: cn(
        'bg-gradient-to-r from-primary-500 via-accent-500 to-primary-500 text-white',
        'bg-[length:200%_100%] animate-gradient-shift',
        'hover:shadow-lg hover:shadow-accent-500/30',
        'focus:ring-accent-500'
      ),
    };

    const sizes = {
      xs: 'px-2.5 py-1.5 text-xs gap-1',
      sm: 'px-3.5 py-2 text-sm gap-1.5',
      md: 'px-4 py-2.5 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2.5',
    };

    const iconSizes = {
      xs: 'w-3 h-3',
      sm: 'w-3.5 h-3.5',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    };

    const glowStyles = glow ? cn(
      'shadow-lg',
      variant === 'primary' && 'shadow-primary-500/40',
      variant === 'danger' && 'shadow-danger-500/40',
      variant === 'success' && 'shadow-success-500/40',
      variant === 'gradient' && 'shadow-accent-500/40'
    ) : '';

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          glowStyles,
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className={cn('animate-spin', iconSizes[size])}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!isLoading && leftIcon && (
          <span className={cn('flex-shrink-0', iconSizes[size])}>{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && (
          <span className={cn('flex-shrink-0', iconSizes[size])}>{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;

// Button Group for related actions
export function ButtonGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex rounded-xl shadow-sm overflow-hidden',
        '[&>button]:rounded-none',
        '[&>button:first-child]:rounded-l-xl',
        '[&>button:last-child]:rounded-r-xl',
        '[&>button:not(:last-child)]:border-r-0',
        className
      )}
    >
      {children}
    </div>
  );
}

// Icon-only button
export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'leftIcon' | 'rightIcon'> {
  icon: React.ReactNode;
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = 'md', className, ...props }, ref) => {
    const iconButtonSizes = {
      xs: 'p-1.5',
      sm: 'p-2',
      md: 'p-2.5',
      lg: 'p-3',
    };

    return (
      <Button
        ref={ref}
        size={size}
        className={cn(iconButtonSizes[size], className)}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);

IconButton.displayName = 'IconButton';

// Floating Action Button
export interface FABProps extends Omit<ButtonProps, 'children' | 'leftIcon' | 'rightIcon'> {
  icon: React.ReactNode;
  'aria-label': string;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
}

export const FAB = forwardRef<HTMLButtonElement, FABProps>(
  ({ icon, position = 'bottom-right', className, variant = 'gradient', ...props }, ref) => {
    const positionClasses = {
      'bottom-right': 'fixed bottom-6 right-6',
      'bottom-left': 'fixed bottom-6 left-6',
      'bottom-center': 'fixed bottom-6 left-1/2 -translate-x-1/2',
    };

    return (
      <Button
        ref={ref}
        variant={variant}
        glow
        className={cn(
          'p-4 rounded-full shadow-xl',
          'hover:scale-110 hover:shadow-2xl',
          positionClasses[position],
          className
        )}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);

FAB.displayName = 'FAB';
