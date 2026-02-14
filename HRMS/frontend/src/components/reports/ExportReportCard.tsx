import { useState } from 'react'
import toast from 'react-hot-toast'
import {
  DocumentArrowDownIcon,
  TableCellsIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import type { ExportFormat } from '@/services/reports'

interface ExportReportCardProps {
  name: string
  description: string
  icon: React.ForwardRefExoticComponent<any>
  exportFn: (format: ExportFormat) => Promise<void>
}

export default function ExportReportCard({
  name,
  description,
  icon: Icon,
  exportFn,
}: ExportReportCardProps) {
  const [isGenerating, setIsGenerating] = useState<ExportFormat | null>(null)

  const handleExport = async (format: ExportFormat) => {
    setIsGenerating(format)
    try {
      await exportFn(format)
      toast.success(`${name} downloaded as ${format.toUpperCase()}!`)
    } catch (error: any) {
      toast.error(error.message || error.response?.data?.error || 'Failed to generate report')
    } finally {
      setIsGenerating(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start gap-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <Icon className="h-6 w-6 text-gray-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900">{name}</h3>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="text-xs text-gray-400 mr-1">Export:</span>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
          onClick={() => handleExport('csv')}
          disabled={isGenerating !== null}
        >
          {isGenerating === 'csv' ? (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <DocumentArrowDownIcon className="h-3.5 w-3.5 text-green-600" />
          )}
          CSV
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
          onClick={() => handleExport('excel')}
          disabled={isGenerating !== null}
        >
          {isGenerating === 'excel' ? (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <TableCellsIcon className="h-3.5 w-3.5 text-green-700" />
          )}
          Excel
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
          onClick={() => handleExport('pdf')}
          disabled={isGenerating !== null}
        >
          {isGenerating === 'pdf' ? (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <DocumentTextIcon className="h-3.5 w-3.5 text-red-600" />
          )}
          PDF
        </button>
      </div>
    </div>
  )
}
