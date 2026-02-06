import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  accentColor?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  gradient?: boolean;
  onClick?: () => void;
}

export function Card({
  children,
  className,
  hoverable = false,
  accentColor,
  gradient = false,
  onClick,
}: CardProps) {
  const accentClasses = {
    primary: 'border-t-4 border-t-primary-500',
    success: 'border-t-4 border-t-success-500',
    warning: 'border-t-4 border-t-warning-500',
    danger: 'border-t-4 border-t-danger-500',
    info: 'border-t-4 border-t-info-500',
  };

  const gradientClasses = {
    primary: 'bg-gradient-to-br from-primary-50 to-white',
    success: 'bg-gradient-to-br from-success-50 to-white',
    warning: 'bg-gradient-to-br from-warning-50 to-white',
    danger: 'bg-gradient-to-br from-danger-50 to-white',
    info: 'bg-gradient-to-br from-info-50 to-white',
  };

  return (
    <div
      className={cn(
        'rounded-xl shadow-card border border-gray-200/60 overflow-hidden',
        'transition-all duration-200',
        gradient && accentColor ? gradientClasses[accentColor] : 'bg-white',
        accentColor && !gradient && accentClasses[accentColor],
        hoverable && 'hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer',
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
    <div className={cn('px-6 py-4 border-b border-gray-200/60', className)}>
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
        'px-6 py-4 bg-gray-50/50 border-t border-gray-200/60',
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
        'bg-white rounded-lg shadow-sm border border-gray-200/60 p-4',
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// Stat card variant for KPI displays
export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' };
  className?: string;
}) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between">
        {icon && (
          <div className="p-2.5 bg-primary-100 rounded-lg text-primary-600">
            {icon}
          </div>
        )}
        {trend && (
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
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
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
      </div>
    </Card>
  );
}
