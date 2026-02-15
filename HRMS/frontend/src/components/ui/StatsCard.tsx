import React from 'react';
import { cn } from '../../lib/utils';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  MinusIcon,
} from '@heroicons/react/24/solid';

export interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label?: string;
    direction?: 'up' | 'down' | 'neutral';
  };
  sparkline?: number[];
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
  onClick?: () => void;
}

const variantStyles = {
  default: {
    icon: 'bg-gray-100 text-gray-600',
    accent: 'bg-gray-500',
  },
  primary: {
    icon: 'bg-primary-100 text-primary-600',
    accent: 'bg-primary-500',
  },
  success: {
    icon: 'bg-success-100 text-success-600',
    accent: 'bg-success-500',
  },
  warning: {
    icon: 'bg-warning-100 text-warning-600',
    accent: 'bg-warning-500',
  },
  danger: {
    icon: 'bg-danger-100 text-danger-600',
    accent: 'bg-danger-500',
  },
  info: {
    icon: 'bg-info-100 text-info-600',
    accent: 'bg-info-500',
  },
};

function MiniSparkline({ data, color = '#22c55e' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const width = 80;
  const height = 32;
  const padding = 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  // Create area path
  const areaPoints = [
    `${padding},${height - padding}`,
    ...points,
    `${width - padding},${height - padding}`,
  ];
  const areaD = `M ${areaPoints.join(' L ')} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={areaD}
        fill={`url(#gradient-${color.replace('#', '')})`}
      />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrendIndicator({ value, direction }: { value: number; direction?: 'up' | 'down' | 'neutral' }) {
  const actualDirection = direction || (value > 0 ? 'up' : value < 0 ? 'down' : 'neutral');
  const displayValue = Math.abs(value);

  const trendConfig = {
    up: {
      icon: ArrowUpIcon,
      color: 'text-success-600',
      bg: 'bg-success-50',
    },
    down: {
      icon: ArrowDownIcon,
      color: 'text-danger-600',
      bg: 'bg-danger-50',
    },
    neutral: {
      icon: MinusIcon,
      color: 'text-gray-500',
      bg: 'bg-gray-100',
    },
  };

  const config = trendConfig[actualDirection];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium',
        config.bg,
        config.color
      )}
    >
      <Icon className="w-3 h-3" />
      {displayValue > 0 && `${displayValue}%`}
    </span>
  );
}

export function StatsCard({
  title,
  value,
  icon,
  trend,
  sparkline,
  variant = 'default',
  className,
  onClick,
}: StatsCardProps) {
  const styles = variantStyles[variant];

  const sparklineColor = {
    default: '#6b7280',
    primary: '#16a34a',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
  }[variant];

  return (
    <div
      className={cn(
        'bg-white rounded-md border border-gray-200 p-5 relative overflow-hidden',
        onClick && 'cursor-pointer hover:border-gray-300',
        className
      )}
      onClick={onClick}
    >
      <div className="relative">
        {/* Header with icon and title */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {icon && (
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  styles.icon
                )}
              >
                {icon}
              </div>
            )}
            <span className="text-sm font-medium text-gray-500">{title}</span>
          </div>
          {trend && (
            <TrendIndicator value={trend.value} direction={trend.direction} />
          )}
        </div>

        {/* Value */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            {trend?.label && (
              <p className="text-xs text-gray-500 mt-1">{trend.label}</p>
            )}
          </div>

          {/* Sparkline */}
          {sparkline && sparkline.length > 0 && (
            <div className="flex-shrink-0">
              <MiniSparkline data={sparkline} color={sparklineColor} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StatsCard;
