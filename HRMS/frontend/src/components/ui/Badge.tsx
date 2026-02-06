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
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
  pulse?: boolean;
  outline?: boolean;
  className?: string;
}

const variantStyles = {
  default: {
    solid: 'bg-gray-100 text-gray-700',
    outline: 'border border-gray-300 text-gray-700 bg-transparent',
    dot: 'bg-gray-500',
  },
  success: {
    solid: 'bg-success-100 text-success-700',
    outline: 'border border-success-300 text-success-700 bg-transparent',
    dot: 'bg-success-500',
  },
  warning: {
    solid: 'bg-warning-100 text-warning-700',
    outline: 'border border-warning-300 text-warning-700 bg-transparent',
    dot: 'bg-warning-500',
  },
  danger: {
    solid: 'bg-danger-100 text-danger-700',
    outline: 'border border-danger-300 text-danger-700 bg-transparent',
    dot: 'bg-danger-500',
  },
  info: {
    solid: 'bg-info-100 text-info-700',
    outline: 'border border-info-300 text-info-700 bg-transparent',
    dot: 'bg-info-500',
  },
};

const sizeStyles = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  pulse = false,
  outline = false,
  className,
}: BadgeProps) {
  const style = variantStyles[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        'transition-colors duration-200',
        outline ? style.outline : style.solid,
        sizeStyles[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
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
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
  pulse?: boolean;
  outline?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  category = 'general',
  size = 'sm',
  dot = false,
  pulse,
  outline = false,
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
  className,
}: {
  count: number;
  max?: number;
  variant?: StatusVariant;
  className?: string;
}) {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count;
  const style = variantStyles[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1',
        'text-[10px] font-bold rounded-full',
        style.solid,
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
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {children}
    </div>
  );
}
