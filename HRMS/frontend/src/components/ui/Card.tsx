import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  accentColor?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  gradient?: boolean;
  glass?: boolean;
  glow?: boolean;
  onClick?: () => void;
}

export function Card({
  children,
  className,
  hoverable = false,
  accentColor,
  gradient: _gradient = false,
  glass: _glass = false,
  glow: _glow = false,
  onClick,
}: CardProps) {
  const accentClasses = {
    primary: 'border-t-4 border-t-primary-500',
    success: 'border-t-4 border-t-success-500',
    warning: 'border-t-4 border-t-warning-500',
    danger: 'border-t-4 border-t-danger-500',
    info: 'border-t-4 border-t-info-500',
  };

  return (
    <div
      className={cn(
        'bg-white rounded-md border border-gray-200 overflow-hidden',
        accentColor && accentClasses[accentColor],
        hoverable && 'hover:border-gray-300 cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardSectionProps) {
  return (
    <div className={cn('px-6 py-4 border-b border-gray-200', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: CardSectionProps) {
  return (
    <h3 className={cn('text-lg font-semibold text-gray-900', className)}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className }: CardSectionProps) {
  return (
    <p className={cn('text-sm text-gray-500 mt-1', className)}>{children}</p>
  );
}

export function CardContent({ children, className }: CardSectionProps) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>;
}

export function CardFooter({ children, className }: CardSectionProps) {
  return (
    <div
      className={cn(
        'px-6 py-4 bg-gray-50 border-t border-gray-200',
        className
      )}
    >
      {children}
    </div>
  );
}

// Compact card variant for smaller displays
export function CompactCard({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        'bg-white rounded-md border border-gray-200 p-4',
        onClick && 'cursor-pointer hover:border-gray-300',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// Glass card variant — now renders as standard Card
export function GlassCard({
  children,
  className,
  dark: _dark = false,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        'bg-white rounded-md border border-gray-200 overflow-hidden',
        onClick && 'cursor-pointer hover:border-gray-300',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// Stat card variant — clean white card with colored left border and icon badge
export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'default',
  className,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}) {
  const borderClasses = {
    default: 'border-l-4 border-l-primary-500',
    primary: 'border-l-4 border-l-primary-500',
    success: 'border-l-4 border-l-success-500',
    warning: 'border-l-4 border-l-warning-500',
    danger: 'border-l-4 border-l-danger-500',
    info: 'border-l-4 border-l-info-500',
  };

  const iconClasses = {
    default: 'bg-primary-100 text-primary-600',
    primary: 'bg-primary-100 text-primary-600',
    success: 'bg-success-100 text-success-600',
    warning: 'bg-warning-100 text-warning-600',
    danger: 'bg-danger-100 text-danger-600',
    info: 'bg-info-100 text-info-600',
  };

  return (
    <div
      className={cn(
        'bg-white p-6 rounded-md border border-gray-200',
        borderClasses[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        {icon && (
          <div className={cn('p-3 rounded-lg', iconClasses[variant])}>
            {icon}
          </div>
        )}
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
              trend.direction === 'up' && 'bg-success-100 text-success-700',
              trend.direction === 'down' && 'bg-danger-100 text-danger-700',
              trend.direction === 'neutral' && 'bg-gray-100 text-gray-700'
            )}
          >
            {trend.direction === 'up' && '↑'}
            {trend.direction === 'down' && '↓'}
            {trend.value}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-gray-500">
          {title}
        </p>
        <p className="mt-1 text-3xl font-bold text-gray-900">
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-xs text-gray-400">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

// Feature card with icon and description
export function FeatureCard({
  title,
  description,
  icon,
  gradient: _gradient,
  onClick,
  className,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient?: 'primary' | 'accent' | 'info' | 'warning';
  onClick?: () => void;
  className?: string;
}) {
  const colorClasses = {
    primary: 'bg-primary-600',
    accent: 'bg-primary-600',
    info: 'bg-info-600',
    warning: 'bg-warning-600',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative p-6 rounded-md bg-white border border-gray-200',
        'hover:border-gray-300',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div
        className={cn(
          'inline-flex p-3 rounded-lg text-white',
          _gradient ? colorClasses[_gradient] : 'bg-gray-900'
        )}
      >
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
        {title}
      </h3>
      <p className="mt-2 text-sm text-gray-500 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
