import { useState, useMemo, useCallback } from 'react'

type SortDirection = 'asc' | 'desc'

interface SortState {
  field: string
  direction: SortDirection
}

export function useSortable<T extends Record<string, any>>(
  data: T[],
  defaultField?: string,
  defaultDirection: SortDirection = 'asc'
) {
  const [sort, setSort] = useState<SortState | null>(
    defaultField ? { field: defaultField, direction: defaultDirection } : null
  )

  const toggleSort = useCallback((field: string) => {
    setSort((prev) => {
      if (prev?.field === field) {
        return prev.direction === 'asc'
          ? { field, direction: 'desc' }
          : null
      }
      return { field, direction: 'asc' }
    })
  }, [])

  const sorted = useMemo(() => {
    if (!sort) return data

    return [...data].sort((a, b) => {
      const aVal = a[sort.field]
      const bVal = b[sort.field]

      // Handle nulls
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1

      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.direction === 'asc' ? aVal - bVal : bVal - aVal
      }

      // String comparison
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      const cmp = aStr.localeCompare(bStr)
      return sort.direction === 'asc' ? cmp : -cmp
    })
  }, [data, sort])

  const getSortIcon = useCallback(
    (field: string) => {
      if (sort?.field !== field) return null
      return sort.direction === 'asc' ? 'up' : 'down'
    },
    [sort]
  )

  return { sorted, sort, toggleSort, getSortIcon }
}
