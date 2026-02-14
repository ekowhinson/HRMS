import { ReactNode } from 'react'
import type { Group } from '@/hooks/useGroupBy'

interface GroupableTableProps<T> {
  groups: Group<T>[]
  isGrouped: boolean
  groupByLabel: string
  totalColumns: number
  labelColumns?: number
  grandTotals: Record<string, number>
  renderHeaderRow: () => ReactNode
  renderRow: (item: T, index: number) => ReactNode
  renderTotalCells: (totals: Record<string, number>) => ReactNode
  emptyMessage?: string
}

export default function GroupableTable<T>({
  groups,
  isGrouped,
  groupByLabel,
  totalColumns,
  labelColumns = 2,
  grandTotals,
  renderHeaderRow,
  renderRow,
  renderTotalCells,
  emptyMessage = 'No data available.',
}: GroupableTableProps<T>) {
  const allItems = groups.flatMap((g) => g.items)

  if (allItems.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-gray-500">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">{renderHeaderRow()}</thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {groups.map((group, gi) => (
            <GroupSection
              key={group.label || gi}
              group={group}
              groupIndex={gi}
              isGrouped={isGrouped}
              groupByLabel={groupByLabel}
              totalColumns={totalColumns}
              labelColumns={labelColumns}
              renderRow={renderRow}
              renderTotalCells={renderTotalCells}
            />
          ))}
          {/* Grand Total */}
          {isGrouped && (
            <tr className="bg-gray-200 font-bold">
              <td colSpan={labelColumns} className="px-4 py-3 text-sm text-gray-900 uppercase">
                Grand Total
              </td>
              {renderTotalCells(grandTotals)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function GroupSection<T>({
  group,
  groupIndex: _groupIndex,
  isGrouped,
  groupByLabel,
  totalColumns,
  labelColumns,
  renderRow,
  renderTotalCells,
}: {
  group: Group<T>
  groupIndex: number
  isGrouped: boolean
  groupByLabel: string
  totalColumns: number
  labelColumns: number
  renderRow: (item: T, index: number) => ReactNode
  renderTotalCells: (totals: Record<string, number>) => ReactNode
}) {
  return (
    <>
      {/* Group Header */}
      {isGrouped && (
        <tr className="bg-blue-50">
          <td colSpan={totalColumns} className="px-4 py-2 text-sm font-semibold text-blue-800">
            {groupByLabel}: {group.label} ({group.items.length})
          </td>
        </tr>
      )}

      {/* Group Items */}
      {group.items.map((item, idx) => renderRow(item, idx))}

      {/* Group Sub-Total */}
      {isGrouped && (
        <tr className="bg-blue-50/50 font-semibold">
          <td colSpan={labelColumns} className="px-4 py-2 text-sm text-blue-800">
            Sub-Total: {group.label}
          </td>
          {renderTotalCells(group.totals)}
        </tr>
      )}
    </>
  )
}

// Shared helper for sortable column headers
export function SortableHeader({
  label,
  field,
  sortIcon,
  onSort,
  className = '',
}: {
  label: string
  field: string
  sortIcon: 'up' | 'down' | null
  onSort: (field: string) => void
  className?: string
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortIcon === 'up' && <span className="text-blue-600">&#9650;</span>}
        {sortIcon === 'down' && <span className="text-blue-600">&#9660;</span>}
        {!sortIcon && <span className="text-gray-300">&#9650;&#9660;</span>}
      </span>
    </th>
  )
}
