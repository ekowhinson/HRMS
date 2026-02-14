import { useMemo } from 'react'

export interface Group<T> {
  label: string
  items: T[]
  totals: Record<string, number>
}

export interface GroupByResult<T> {
  groups: Group<T>[]
  grandTotals: Record<string, number>
}

export function useGroupBy<T extends Record<string, any>>(
  data: T[],
  groupByField: string | null,
  numericKeys: string[]
): GroupByResult<T> {
  return useMemo(() => {
    const sumItems = (items: T[]): Record<string, number> => {
      const totals: Record<string, number> = {}
      for (const key of numericKeys) {
        totals[key] = items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0)
      }
      return totals
    }

    const grandTotals = sumItems(data)

    if (!groupByField) {
      return {
        groups: [{ label: '', items: data, totals: grandTotals }],
        grandTotals,
      }
    }

    const groupMap = new Map<string, T[]>()
    for (const item of data) {
      const key = String(item[groupByField] ?? 'Unassigned')
      if (!groupMap.has(key)) {
        groupMap.set(key, [])
      }
      groupMap.get(key)!.push(item)
    }

    const groups: Group<T>[] = Array.from(groupMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, items]) => ({
        label,
        items,
        totals: sumItems(items),
      }))

    return { groups, grandTotals }
  }, [data, groupByField, numericKeys])
}
