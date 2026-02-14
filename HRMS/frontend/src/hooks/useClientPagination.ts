import { useState } from 'react'

interface ClientPaginationResult<T> {
  /** Current page of items */
  paged: T[]
  /** Current page number (clamped to valid range) */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  /** Total number of items */
  totalItems: number
  /** Current page size */
  pageSize: number
  /** Navigate to a specific page */
  setCurrentPage: (page: number) => void
  /** Change page size (resets to page 1) */
  setPageSize: (size: number) => void
  /** Reset to page 1 — call this in filter onChange handlers */
  resetPage: () => void
}

/**
 * Manages client-side pagination over a pre-filtered array.
 *
 * Filtering is the caller's responsibility — pass the already-filtered
 * array as `items`. Call `resetPage()` in your filter onChange handlers
 * to return to page 1 when filters change.
 */
export function useClientPagination<T>(
  items: T[],
  initialPageSize = 10,
): ClientPaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)

  const totalPages = Math.ceil(items.length / pageSize)
  const safePage = Math.min(currentPage, Math.max(totalPages, 1))
  const paged = items.slice((safePage - 1) * pageSize, safePage * pageSize)

  const resetPage = () => setCurrentPage(1)

  const setPageSize = (size: number) => {
    setPageSizeState(size)
    setCurrentPage(1)
  }

  return {
    paged,
    currentPage: safePage,
    totalPages,
    totalItems: items.length,
    pageSize,
    setCurrentPage,
    setPageSize,
    resetPage,
  }
}
