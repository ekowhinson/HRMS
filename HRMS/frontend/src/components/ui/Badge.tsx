import { cn } from '@/lib/utils';
import {
  getStatusVariant,
  formatStatus,
  type StatusCategory,
  type StatusVariant,
} from '@/lib/status';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: StatusVariant;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  dot?: boolean;
  pulse?: boolean;
  outline?: boolean;
  gradient?: boolean;
  glow?: boolean;
  className?: string;
}

const variantStyles = {
  default: {
    solid: 'bg-gray-100 text-gray-700',
    outline: 'border border-gray-200 text-gray-700 bg-gray-50/50',
    gradient: 'bg-gradient-to-r from-gray-500 to-gray-600 text-white',
    dot: 'bg-gray-500',
    glow: 'shadow-gray-500/30',
  },
  success: {
    solid: 'bg-success-100 text-success-700',
    outline: 'border border-success-200 text-success-700 bg-success-50/50',
    gradient: 'bg-gradient-to-r from-success-500 to-success-600 text-white',
    dot: 'bg-success-500',
    glow: 'shadow-success-500/30',
  },
  warning: {
    solid: 'bg-warning-100 text-warning-700',
    outline: 'border border-warning-200 text-warning-700 bg-warning-50/50',
    gradient: 'bg-gradient-to-r from-warning-500 to-warning-600 text-white',
    dot: 'bg-warning-500',
    glow: 'shadow-warning-500/30',
  },
  danger: {
    solid: 'bg-danger-100 text-danger-700',
    outline: 'border border-danger-200 text-danger-700 bg-danger-50/50',
    gradient: 'bg-gradient-to-r from-danger-500 to-danger-600 text-white',
    dot: 'bg-danger-500',
    glow: 'shadow-danger-500/30',
  },
  info: {
    solid: 'bg-info-100 text-info-700',
    outline: 'border border-info-200 text-info-700 bg-info-50/50',
    gradient: 'bg-gradient-to-r from-info-500 to-info-600 text-white',
    dot: 'bg-info-500',
    glow: 'shadow-info-500/30',
  },
};

const sizeStyles = {
  xs: 'px-2 py-0.5 text-[10px]',
  sm: 'px-2.5 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-3.5 py-1.5 text-sm',
};

const dotSizes = {
  xs: 'w-1 h-1',
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2 h-2',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  pulse = false,
  outline = false,
  gradient = false,
  glow = false,
  className,
}: BadgeProps) {
  const style = variantStyles[variant];

  const variantClass = gradient ? style.gradient : outline ? style.outline : style.solid;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold rounded-full',
        'transition-all duration-300',
        variantClass,
        sizeStyles[size],
        glow && `shadow-md ${style.glow}`,
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'rounded-full flex-shrink-0',
            dotSizes[size],
            style.dot,
            pulse && 'animate-pulse'
          )}
        />
      )}
      {children}
    </span>
  );
}

// Status-aware badge that auto-maps status strings to variants
export interface StatusBadgeProps {
  status: string;
  category?: StatusCategory;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  dot?: boolean;
  pulse?: boolean;
  outline?: boolean;
  gradient?: boolean;
  glow?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  category = 'general',
  size = 'sm',
  dot = false,
  pulse,
  outline = false,
  gradient = false,
  glow = false,
  className,
}: StatusBadgeProps) {
  const variant = getStatusVariant(status, category);

  // Auto-pulse for pending statuses
  const shouldPulse = pulse !== undefined ? pulse : status?.toUpperCase() === 'PENDING';

  return (
    <Badge
      variant={variant}
      size={size}
      dot={dot}
      pulse={shouldPulse}
      outline={outline}
      gradient={gradient}
      glow={glow}
      className={className}
    >
      {formatStatus(status)}
    </Badge>
  );
}

// Dot-only indicator (no text)
export function StatusDot({
  status,
  category = 'general',
  size = 'md',
  pulse,
  className,
}: {
  status: string;
  category?: StatusCategory;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}) {
  const variant = getStatusVariant(status, category);
  const style = variantStyles[variant];
  const shouldPulse = pulse !== undefined ? pulse : status?.toUpperCase() === 'PENDING';

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  return (
    <span
      className={cn(
        'inline-block rounded-full',
        style.dot,
        sizeClasses[size],
        shouldPulse && 'animate-pulse',
        className
      )}
      title={formatStatus(status)}
    />
  );
}

// Count badge (for notifications, etc.)
export function CountBadge({
  count,
  max = 99,
  variant = 'danger',
  size = 'sm',
  glow = false,
  className,
}: {
  count: number;
  max?: number;
  variant?: StatusVariant;
  size?: 'sm' | 'md';
  glow?: boolean;
  className?: string;
}) {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count;
  const style = variantStyles[variant];

  const sizeClasses = {
    sm: 'min-w-[18px] h-[18px] text-[10px]',
    md: 'min-w-[22px] h-[22px] text-xs',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center px-1.5',
        'font-bold rounded-full',
        style.gradient,
        sizeClasses[size],
        glow && `shadow-md ${style.glow}`,
        className
      )}
    >
      {displayCount}
    </span>
  );
}

// Badge group for displaying multiple badges
export function BadgeGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  );
}

// Pill badge for tags
export function PillBadge({
  children,
  color = 'gray',
  removable = false,
  onRemove,
  className,
}: {
  children: React.ReactNode;
  color?: 'gray' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
}) {
  const colorClasses = {
    gray: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    primary: 'bg-primary-100 text-primary-700 hover:bg-primary-200',
    success: 'bg-success-100 text-success-700 hover:bg-success-200',
    warning: 'bg-warning-100 text-warning-700 hover:bg-warning-200',
    danger: 'bg-danger-100 text-danger-700 hover:bg-danger-200',
    info: 'bg-info-100 text-info-700 hover:bg-info-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium',
        'transition-colors duration-200',
        colorClasses[color],
        className
      )}
    >
      {children}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-black/10 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}
