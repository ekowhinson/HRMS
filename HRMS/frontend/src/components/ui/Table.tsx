import { cn } from '@/lib/utils';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { SkeletonTableRow } from './Skeleton';
import { EmptyState } from './EmptyState';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  width?: string | number;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyType?: 'data' | 'search' | 'employees';
  emptyAction?: { label: string; onClick: () => void };
  className?: string;
  onRowClick?: (item: T) => void;
  striped?: boolean;
  stickyHeader?: boolean;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  selectable?: boolean;
  selectedIds?: Set<string | number>;
  onSelectionChange?: (ids: Set<string | number>) => void;
  getRowId?: (item: T) => string | number;
}

export default function Table<T extends { id?: string | number }>({
  data,
  columns,
  isLoading = false,
  emptyMessage = 'No data found',
  emptyType = 'data',
  emptyAction,
  className,
  onRowClick,
  striped = false,
  stickyHeader = false,
  sortColumn,
  sortDirection,
  onSort,
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange,
  getRowId = (item) => item.id as string | number,
}: TableProps<T>) {
  const handleSelectAll = () => {
    if (!onSelectionChange) return;

    if (selectedIds.size === data.length) {
      onSelectionChange(new Set());
    } else {
      const allIds = new Set(data.map(getRowId));
      onSelectionChange(allIds);
    }
  };

  const handleSelectRow = (item: T, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSelectionChange) return;

    const id = getRowId(item);
    const newSelection = new Set(selectedIds);

    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }

    onSelectionChange(newSelection);
  };

  // Loading state with skeleton rows
  if (isLoading) {
    return (
      <div className={cn('overflow-hidden rounded-md border border-gray-200', className)}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-gray-600',
                    column.className
                  )}
                  style={{ width: column.width }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonTableRow key={i} columns={columns.length + (selectable ? 1 : 0)} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className={cn('overflow-hidden rounded-md border border-gray-200 bg-white', className)}>
        <EmptyState
          type={emptyType}
          title={emptyMessage}
          action={emptyAction}
          compact
        />
      </div>
    );
  }

  const isAllSelected = selectedIds.size === data.length && data.length > 0;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < data.length;

  return (
    <div className={cn('overflow-hidden rounded-md border border-gray-200', className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead
            className={cn(
              'bg-gray-50',
              stickyHeader && 'sticky top-0 z-10'
            )}
          >
            <tr>
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-gray-600',
                    column.sortable && 'cursor-pointer select-none hover:bg-gray-100 transition-colors',
                    column.className
                  )}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && onSort?.(column.key)}
                >
                  <div className="flex items-center gap-1">
                    {column.header}
                    {column.sortable && (
                      <span className="flex flex-col">
                        <ChevronUpIcon
                          className={cn(
                            'w-3 h-3 -mb-1',
                            sortColumn === column.key && sortDirection === 'asc'
                              ? 'text-primary-600'
                              : 'text-gray-400'
                          )}
                        />
                        <ChevronDownIcon
                          className={cn(
                            'w-3 h-3 -mt-1',
                            sortColumn === column.key && sortDirection === 'desc'
                              ? 'text-primary-600'
                              : 'text-gray-400'
                          )}
                        />
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, index) => {
              const rowId = getRowId(item);
              const isSelected = selectedIds.has(rowId);

              return (
                <tr
                  key={rowId || index}
                  className={cn(
                    'transition-colors duration-150',
                    onRowClick && 'cursor-pointer',
                    isSelected
                      ? 'bg-primary-50'
                      : striped && index % 2 === 1
                      ? 'bg-gray-50/50'
                      : 'hover:bg-gray-50/50'
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {selectable && (
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        onClick={(e) => handleSelectRow(item, e)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-4 py-3.5 text-sm text-gray-700',
                        column.className
                      )}
                    >
                      {column.render ? column.render(item) : (item as any)[column.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Basic table building blocks for custom layouts
interface BasicTableProps {
  children: React.ReactNode;
  className?: string;
}

export function TableRoot({ children, className }: BasicTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-gray-200">
      <div className="overflow-x-auto">
        <table className={cn('min-w-full divide-y divide-gray-200', className)}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function TableHeader({ children, className }: BasicTableProps) {
  return (
    <thead className={cn('bg-gray-50', className)}>{children}</thead>
  );
}

export function TableBody({ children, className }: BasicTableProps) {
  return (
    <tbody className={cn('bg-white divide-y divide-gray-200', className)}>
      {children}
    </tbody>
  );
}

export function TableRow({
  children,
  className,
  onClick,
  selected,
  striped,
}: BasicTableProps & {
  onClick?: () => void;
  selected?: boolean;
  striped?: boolean;
}) {
  return (
    <tr
      className={cn(
        'transition-colors duration-150',
        onClick && 'cursor-pointer',
        selected
          ? 'bg-primary-50'
          : striped
          ? 'bg-gray-50/50'
          : 'hover:bg-gray-50/50',
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  children,
  className,
  sortable,
  sorted,
  sortDirection,
  onClick,
}: BasicTableProps & {
  sortable?: boolean;
  sorted?: boolean;
  sortDirection?: 'asc' | 'desc';
  onClick?: () => void;
}) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-left text-xs font-semibold text-gray-600',
        sortable && 'cursor-pointer select-none hover:bg-gray-100 transition-colors',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortable && (
          <span className="flex flex-col">
            <ChevronUpIcon
              className={cn(
                'w-3 h-3 -mb-1',
                sorted && sortDirection === 'asc'
                  ? 'text-primary-600'
                  : 'text-gray-400'
              )}
            />
            <ChevronDownIcon
              className={cn(
                'w-3 h-3 -mt-1',
                sorted && sortDirection === 'desc'
                  ? 'text-primary-600'
                  : 'text-gray-400'
              )}
            />
          </span>
        )}
      </div>
    </th>
  );
}

export function TableCell({ children, className }: BasicTableProps) {
  return (
    <td className={cn('px-4 py-3.5 text-sm text-gray-700', className)}>
      {children}
    </td>
  );
}

// Pagination component
export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className,
}: TablePaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-gray-50/50 border-t border-gray-200',
        className
      )}
    >
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span>
          Showing {startItem} to {endItem} of {totalItems} results
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="block rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* First page button */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          className={cn(
            'px-2 py-1.5 text-sm font-medium rounded-md border transition-colors',
            currentPage <= 1
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          )}
          title="Go to first page"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-md border transition-colors',
            currentPage <= 1
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          )}
        >
          Previous
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={cn(
                  'w-8 h-8 text-sm font-medium rounded-md transition-colors',
                  pageNum === currentPage
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                )}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-md border transition-colors',
            currentPage >= totalPages
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          )}
        >
          Next
        </button>

        {/* Last page button */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          className={cn(
            'px-2 py-1.5 text-sm font-medium rounded-md border transition-colors',
            currentPage >= totalPages
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          )}
          title="Go to last page"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
