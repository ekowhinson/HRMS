import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'title' | 'avatar' | 'card' | 'button' | 'custom';
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  animate?: boolean;
}

const roundedClasses = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-md',
  full: 'rounded-full',
};

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  rounded,
  animate = true,
}: SkeletonProps) {
  const baseStyles = cn(
    'bg-gray-200',
    animate && 'animate-pulse',
    rounded ? roundedClasses[rounded] : 'rounded'
  );

  const variantStyles = {
    text: 'h-4 w-full rounded',
    title: 'h-6 w-3/4 rounded',
    avatar: 'rounded-full',
    card: 'rounded-md',
    button: 'h-10 rounded-md',
    custom: '',
  };

  const style: React.CSSProperties = {
    width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
  };

  return (
    <div
      className={cn(baseStyles, variantStyles[variant], className)}
      style={style}
      aria-hidden="true"
    />
  );
}

// Skeleton for text lines
export function SkeletonText({
  lines = 3,
  className,
  lastLineWidth = '75%',
}: {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          width={index === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  );
}

// Skeleton for avatar with text
export function SkeletonUser({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Skeleton variant="avatar" width={40} height={40} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" className="h-3" />
      </div>
    </div>
  );
}

// Skeleton for table row
export function SkeletonTableRow({
  columns = 5,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <tr className={cn('animate-pulse', className)}>
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-4 py-3.5">
          <Skeleton
            variant="text"
            width={index === 0 ? '80%' : index === columns - 1 ? '50%' : '70%'}
          />
        </td>
      ))}
    </tr>
  );
}

// Skeleton for table
export function SkeletonTable({
  rows = 5,
  columns = 5,
  showHeader = true,
  className,
}: {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-md border border-gray-200', className)}>
      <table className="min-w-full divide-y divide-gray-200">
        {showHeader && (
          <thead className="bg-gray-50">
            <tr>
              {Array.from({ length: columns }).map((_, index) => (
                <th key={index} className="px-4 py-3">
                  <Skeleton variant="text" width="70%" className="h-3" />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-gray-100 bg-white">
          {Array.from({ length: rows }).map((_, index) => (
            <SkeletonTableRow key={index} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Skeleton for stats card
export function SkeletonStatsCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-white rounded-md border border-gray-200 p-5 animate-pulse',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Skeleton variant="custom" width={40} height={40} rounded="lg" />
          <Skeleton variant="text" width={80} />
        </div>
        <Skeleton variant="custom" width={50} height={20} rounded="full" />
      </div>
      <Skeleton variant="title" width="50%" className="mb-2" />
      <Skeleton variant="text" width="30%" className="h-3" />
    </div>
  );
}

// Skeleton for card
export function SkeletonCard({
  hasHeader = true,
  lines = 3,
  className,
}: {
  hasHeader?: boolean;
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-white rounded-md border border-gray-200 overflow-hidden animate-pulse',
        className
      )}
    >
      {hasHeader && (
        <div className="px-6 py-4 border-b border-gray-200">
          <Skeleton variant="title" width="40%" />
        </div>
      )}
      <div className="px-6 py-4">
        <SkeletonText lines={lines} />
      </div>
    </div>
  );
}

// Skeleton for form field
export function SkeletonFormField({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-1.5 animate-pulse', className)}>
      <Skeleton variant="text" width={80} className="h-3" />
      <Skeleton variant="custom" height={42} rounded="lg" />
    </div>
  );
}

// Skeleton for dashboard grid
export function SkeletonDashboard({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonStatsCard key={index} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-md border border-gray-200 p-6 animate-pulse">
          <Skeleton variant="title" width="30%" className="mb-4" />
          <Skeleton variant="custom" height={200} rounded="lg" />
        </div>
        <div className="bg-white rounded-md border border-gray-200 p-6 animate-pulse">
          <Skeleton variant="title" width="30%" className="mb-4" />
          <Skeleton variant="custom" height={200} rounded="lg" />
        </div>
      </div>

      {/* Table */}
      <SkeletonTable rows={5} columns={6} />
    </div>
  );
}

// Skeleton for list item
export function SkeletonListItem({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-4 p-4 animate-pulse', className)}>
      <Skeleton variant="avatar" width={48} height={48} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" className="h-3" />
      </div>
      <Skeleton variant="custom" width={80} height={24} rounded="full" />
    </div>
  );
}

export default Skeleton;
