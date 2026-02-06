import React from 'react';
import { cn } from '../../lib/utils';
import {
  DocumentMagnifyingGlassIcon,
  UserPlusIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  InboxIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import Button from './Button';

export type EmptyStateType =
  | 'employees'
  | 'leave'
  | 'payroll'
  | 'search'
  | 'documents'
  | 'data'
  | 'error'
  | 'custom';

export interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  compact?: boolean;
}

const presetConfigs: Record<
  EmptyStateType,
  { icon: React.ElementType; title: string; description: string }
> = {
  employees: {
    icon: UserPlusIcon,
    title: 'No employees found',
    description: 'Add your first employee to get started with HR management.',
  },
  leave: {
    icon: CalendarDaysIcon,
    title: 'No leave requests',
    description: 'No leave requests yet. Plan your next break!',
  },
  payroll: {
    icon: CurrencyDollarIcon,
    title: 'No payroll records',
    description: 'Process your first payroll to see records here.',
  },
  search: {
    icon: MagnifyingGlassIcon,
    title: 'No results found',
    description: 'Try adjusting your search or filter criteria.',
  },
  documents: {
    icon: ClipboardDocumentListIcon,
    title: 'No documents',
    description: 'Upload documents to organize and access them here.',
  },
  data: {
    icon: InboxIcon,
    title: 'No data available',
    description: "There's nothing to show here yet.",
  },
  error: {
    icon: ExclamationTriangleIcon,
    title: 'Something went wrong',
    description: 'We encountered an error loading this data. Please try again.',
  },
  custom: {
    icon: DocumentMagnifyingGlassIcon,
    title: 'No items',
    description: 'Nothing to display.',
  },
};

export function EmptyState({
  type = 'data',
  title,
  description,
  icon,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  const config = presetConfigs[type];
  const Icon = config.icon;
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-12 px-6',
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-gray-100',
          compact ? 'w-12 h-12 mb-3' : 'w-16 h-16 mb-4'
        )}
      >
        {icon || (
          <Icon
            className={cn(
              'text-gray-400',
              compact ? 'w-6 h-6' : 'w-8 h-8'
            )}
          />
        )}
      </div>

      {/* Title */}
      <h3
        className={cn(
          'font-semibold text-gray-900',
          compact ? 'text-base mb-1' : 'text-lg mb-2'
        )}
      >
        {displayTitle}
      </h3>

      {/* Description */}
      <p
        className={cn(
          'text-gray-500 max-w-sm',
          compact ? 'text-sm' : 'text-sm'
        )}
      >
        {displayDescription}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className={cn('flex items-center gap-3', compact ? 'mt-4' : 'mt-6')}>
          {action && (
            <Button
              variant={action.variant || 'primary'}
              onClick={action.onClick}
              size={compact ? 'sm' : 'md'}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="ghost"
              onClick={secondaryAction.onClick}
              size={compact ? 'sm' : 'md'}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Inline empty state for smaller containers
export function EmptyStateInline({
  message = 'No data',
  icon,
  className,
}: {
  message?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 py-4 text-sm text-gray-500',
        className
      )}
    >
      {icon || <InboxIcon className="w-4 h-4" />}
      <span>{message}</span>
    </div>
  );
}

// Table-specific empty state
export function TableEmptyState({
  message = 'No records found',
  colSpan = 1,
  action,
}: {
  message?: string;
  colSpan?: number;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center">
        <EmptyState
          type="data"
          title={message}
          description=""
          action={action}
          compact
        />
      </td>
    </tr>
  );
}

export default EmptyState;
