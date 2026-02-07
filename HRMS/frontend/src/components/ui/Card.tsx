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
  gradient = false,
  glass = false,
  glow = false,
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

  const glowClasses = {
    primary: 'shadow-lg shadow-primary-500/10 hover:shadow-xl hover:shadow-primary-500/20',
    success: 'shadow-lg shadow-success-500/10 hover:shadow-xl hover:shadow-success-500/20',
    warning: 'shadow-lg shadow-warning-500/10 hover:shadow-xl hover:shadow-warning-500/20',
    danger: 'shadow-lg shadow-danger-500/10 hover:shadow-xl hover:shadow-danger-500/20',
    info: 'shadow-lg shadow-info-500/10 hover:shadow-xl hover:shadow-info-500/20',
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200/60 overflow-hidden',
        'transition-all duration-300',
        glass ? 'bg-white/80 backdrop-blur-sm shadow-glass' : 'bg-white shadow-card',
        gradient && accentColor ? gradientClasses[accentColor] : '',
        accentColor && !gradient && accentClasses[accentColor],
        glow && accentColor && glowClasses[accentColor],
        hoverable && 'hover:shadow-card-hover hover:-translate-y-1 cursor-pointer',
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
    <div className={cn('px-6 py-4 border-b border-gray-100', className)}>
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
        'px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-50/50 border-t border-gray-100',
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
        'bg-white rounded-xl shadow-sm border border-gray-100 p-4',
        'transition-all duration-300',
        onClick && 'cursor-pointer hover:shadow-lg hover:-translate-y-1',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// Glass card variant for modern look
export function GlassCard({
  children,
  className,
  dark = false,
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
        'rounded-2xl backdrop-blur-xl overflow-hidden',
        'transition-all duration-300',
        dark
          ? 'bg-white/10 border border-white/20 shadow-xl'
          : 'bg-white/80 border border-gray-100 shadow-glass',
        onClick && 'cursor-pointer hover:shadow-lg hover:-translate-y-1',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// Stat card variant for KPI displays with stunning gradient
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
  const variantClasses = {
    default: 'bg-white',
    primary: 'bg-gradient-to-br from-primary-500 to-primary-600 text-white',
    success: 'bg-gradient-to-br from-success-500 to-success-600 text-white',
    warning: 'bg-gradient-to-br from-warning-500 to-warning-600 text-white',
    danger: 'bg-gradient-to-br from-danger-500 to-danger-600 text-white',
    info: 'bg-gradient-to-br from-info-500 to-info-600 text-white',
  };

  const iconClasses = {
    default: 'bg-primary-100 text-primary-600',
    primary: 'bg-white/20 text-white',
    success: 'bg-white/20 text-white',
    warning: 'bg-white/20 text-white',
    danger: 'bg-white/20 text-white',
    info: 'bg-white/20 text-white',
  };

  const isColored = variant !== 'default';

  return (
    <div
      className={cn(
        'relative p-6 rounded-2xl overflow-hidden shadow-lg',
        'transition-all duration-300 hover:shadow-xl hover:-translate-y-1',
        variantClasses[variant],
        className
      )}
    >
      {/* Background glow for colored variants */}
      {isColored && (
        <>
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-white/5 rounded-full blur-xl" />
        </>
      )}

      <div className="relative z-10">
        <div className="flex items-start justify-between">
          {icon && (
            <div className={cn('p-3 rounded-xl', iconClasses[variant])}>
              {icon}
            </div>
          )}
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
                isColored
                  ? 'bg-white/20 text-white'
                  : cn(
                      trend.direction === 'up' && 'bg-success-100 text-success-700',
                      trend.direction === 'down' && 'bg-danger-100 text-danger-700',
                      trend.direction === 'neutral' && 'bg-gray-100 text-gray-700'
                    )
              )}
            >
              {trend.direction === 'up' && '↑'}
              {trend.direction === 'down' && '↓'}
              {trend.value}%
            </span>
          )}
        </div>
        <div className="mt-4">
          <p className={cn(
            'text-sm font-medium',
            isColored ? 'text-white/80' : 'text-gray-500'
          )}>
            {title}
          </p>
          <p className={cn(
            'mt-1 text-3xl font-bold',
            isColored ? 'text-white' : 'text-gray-900'
          )}>
            {value}
          </p>
          {subtitle && (
            <p className={cn(
              'mt-1 text-xs',
              isColored ? 'text-white/60' : 'text-gray-400'
            )}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Feature card with icon and description
export function FeatureCard({
  title,
  description,
  icon,
  gradient,
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
  const gradientClasses = {
    primary: 'from-primary-500 to-primary-600',
    accent: 'from-accent-500 to-accent-600',
    info: 'from-blue-500 to-blue-600',
    warning: 'from-amber-500 to-amber-600',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative p-6 rounded-2xl bg-white border border-gray-100',
        'transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div
        className={cn(
          'inline-flex p-3 rounded-xl text-white',
          gradient ? `bg-gradient-to-br ${gradientClasses[gradient]}` : 'bg-gray-900'
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
