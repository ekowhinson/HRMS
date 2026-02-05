import { cn } from '@/lib/utils'

interface Column<T> {
  key: string
  header: string
  render?: (item: T) => React.ReactNode
  className?: string
}

interface TableProps<T> {
  data: T[]
  columns: Column<T>[]
  isLoading?: boolean
  emptyMessage?: string
  className?: string
  onRowClick?: (item: T) => void
}

export default function Table<T extends { id?: string }>({
  data,
  columns,
  isLoading = false,
  emptyMessage = 'No data found',
  className,
  onRowClick,
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item, index) => (
            <tr
              key={item.id || index}
              className={cn(
                'hover:bg-gray-50 transition-colors',
                onRowClick && 'cursor-pointer'
              )}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-6 py-4 whitespace-nowrap text-sm text-gray-900',
                    column.className
                  )}
                >
                  {column.render ? column.render(item) : (item as any)[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Also export the basic table building blocks for flexibility
interface BasicTableProps {
  children: React.ReactNode
  className?: string
}

export function TableRoot({ children, className }: BasicTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('min-w-full divide-y divide-gray-200', className)}>
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ children, className }: BasicTableProps) {
  return <thead className={cn('bg-gray-50', className)}>{children}</thead>
}

export function TableBody({ children, className }: BasicTableProps) {
  return <tbody className={cn('bg-white divide-y divide-gray-200', className)}>{children}</tbody>
}

export function TableRow({ children, className }: BasicTableProps) {
  return <tr className={cn('hover:bg-gray-50', className)}>{children}</tr>
}

export function TableHead({ children, className }: BasicTableProps) {
  return (
    <th
      className={cn(
        'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
        className
      )}
    >
      {children}
    </th>
  )
}

export function TableCell({ children, className }: BasicTableProps) {
  return (
    <td className={cn('px-6 py-4 whitespace-nowrap text-sm text-gray-900', className)}>
      {children}
    </td>
  )
}
