import { useState } from 'react'
import type { ExportFormat } from '@/services/reports'

/**
 * Encapsulates the loading state and try/finally pattern for report exports.
 * Each page passes its own export function (with current filters captured via closure).
 */
export function useExport(exportFn: (format: ExportFormat) => Promise<void>) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async (format: ExportFormat) => {
    setExporting(true)
    try {
      await exportFn(format)
    } finally {
      setExporting(false)
    }
  }

  return { exporting, handleExport }
}
