import { DocumentIcon, ArrowDownTrayIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { formatFileSize } from './DocumentUploader'
import Button from './Button'

export interface DocumentInfo {
  id?: string
  name: string
  size: number
  type: string
  checksum?: string
  url?: string
  is_image?: boolean
  is_pdf?: boolean
  is_document?: boolean
}

interface DocumentViewerProps {
  document: DocumentInfo
  onDownload?: () => void
  onDelete?: () => void
  onPreview?: () => void
  showPreview?: boolean
  showDelete?: boolean
  showDownload?: boolean
  compact?: boolean
  className?: string
}

function getFileIcon(document: DocumentInfo) {
  if (document.is_image) {
    return (
      <div className="h-10 w-10 rounded bg-blue-100 flex items-center justify-center">
        <DocumentIcon className="h-5 w-5 text-blue-600" />
      </div>
    )
  }
  if (document.is_pdf) {
    return (
      <div className="h-10 w-10 rounded bg-red-100 flex items-center justify-center">
        <DocumentIcon className="h-5 w-5 text-red-600" />
      </div>
    )
  }
  if (document.type?.includes('word') || document.type?.includes('document')) {
    return (
      <div className="h-10 w-10 rounded bg-blue-100 flex items-center justify-center">
        <DocumentIcon className="h-5 w-5 text-blue-600" />
      </div>
    )
  }
  if (document.type?.includes('excel') || document.type?.includes('spreadsheet')) {
    return (
      <div className="h-10 w-10 rounded bg-green-100 flex items-center justify-center">
        <DocumentIcon className="h-5 w-5 text-green-600" />
      </div>
    )
  }
  return (
    <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
      <DocumentIcon className="h-5 w-5 text-gray-600" />
    </div>
  )
}

function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()?.toUpperCase() || '' : ''
}

export default function DocumentViewer({
  document,
  onDownload,
  onDelete,
  onPreview,
  showPreview = true,
  showDelete = true,
  showDownload = true,
  compact = false,
  className,
}: DocumentViewerProps) {
  const handleDownload = () => {
    if (onDownload) {
      onDownload()
    } else if (document.url) {
      // Create a download link from data URI
      const link = window.document.createElement('a')
      link.href = document.url
      link.download = document.name
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
    }
  }

  const handlePreview = () => {
    if (onPreview) {
      onPreview()
    } else if (document.url) {
      // Open in new tab for preview
      const win = window.open()
      if (win) {
        if (document.is_image) {
          win.document.write(`<img src="${document.url}" style="max-width: 100%; height: auto;">`)
        } else if (document.is_pdf) {
          win.document.write(`<embed src="${document.url}" type="application/pdf" width="100%" height="100%">`)
        } else {
          win.location.href = document.url
        }
      }
    }
  }

  const canPreview = document.is_image || document.is_pdf

  if (compact) {
    return (
      <div className={clsx('flex items-center gap-3 p-2 rounded-md hover:bg-gray-50', className)}>
        {getFileIcon(document)}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{document.name}</p>
          <p className="text-xs text-gray-500">{formatFileSize(document.size)}</p>
        </div>
        <div className="flex items-center gap-1">
          {showPreview && canPreview && (
            <button
              type="button"
              onClick={handlePreview}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
              title="Preview"
            >
              <EyeIcon className="h-4 w-4" />
            </button>
          )}
          {showDownload && (
            <button
              type="button"
              onClick={handleDownload}
              className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors"
              title="Download"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
            </button>
          )}
          {showDelete && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
              title="Delete"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('border border-gray-200 rounded-md overflow-hidden', className)}>
      {/* Preview area */}
      {showPreview && document.url && document.is_image && (
        <div className="bg-gray-100 p-4 flex items-center justify-center">
          <img
            src={document.url}
            alt={document.name}
            className="max-h-48 object-contain rounded"
          />
        </div>
      )}

      {/* File info */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {getFileIcon(document)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate" title={document.name}>
              {document.name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>{formatFileSize(document.size)}</span>
              <span>•</span>
              <span className="uppercase">{getFileExtension(document.name)}</span>
              {document.checksum && (
                <>
                  <span>•</span>
                  <span className="font-mono text-[10px]" title={document.checksum}>
                    {document.checksum.slice(0, 8)}...
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          {showPreview && canPreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
            >
              <EyeIcon className="h-4 w-4 mr-1" />
              Preview
            </Button>
          )}
          {showDownload && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
              Download
            </Button>
          )}
          {showDelete && onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-red-600 hover:bg-red-50 hover:border-red-300"
            >
              <TrashIcon className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
