import { useState } from 'react'
import { PlusIcon, FolderIcon, ListBulletIcon, Squares2X2Icon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import DocumentViewer, { DocumentInfo } from './DocumentViewer'
import DocumentUploader from './DocumentUploader'
import Button from './Button'

interface DocumentListProps {
  documents: DocumentInfo[]
  onUpload?: (file: File) => Promise<void>
  onDelete?: (document: DocumentInfo) => Promise<void>
  onDownload?: (document: DocumentInfo) => void
  isLoading?: boolean
  title?: string
  emptyMessage?: string
  accept?: string
  maxSize?: number
  uploadLabel?: string
  showUpload?: boolean
  showViewToggle?: boolean
  className?: string
}

export default function DocumentList({
  documents,
  onUpload,
  onDelete,
  onDownload,
  isLoading = false,
  title = 'Documents',
  emptyMessage = 'No documents uploaded',
  accept,
  maxSize,
  uploadLabel = 'Upload Document',
  showUpload = true,
  showViewToggle = true,
  className,
}: DocumentListProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [showUploader, setShowUploader] = useState(false)

  const handleUpload = async (file: File) => {
    if (onUpload) {
      await onUpload(file)
      setShowUploader(false)
    }
  }

  const handleDelete = async (document: DocumentInfo) => {
    if (onDelete && window.confirm(`Delete "${document.name}"?`)) {
      await onDelete(document)
    }
  }

  if (isLoading) {
    return (
      <div className={clsx('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <FolderIcon className="h-5 w-5 text-gray-400" />
          {title}
          {documents.length > 0 && (
            <span className="text-gray-400">({documents.length})</span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {showViewToggle && documents.length > 0 && (
            <div className="flex rounded-lg border border-gray-200 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={clsx(
                  'p-1 rounded transition-colors',
                  viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
                )}
              >
                <ListBulletIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={clsx(
                  'p-1 rounded transition-colors',
                  viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
                )}
              >
                <Squares2X2Icon className="h-4 w-4" />
              </button>
            </div>
          )}
          {showUpload && onUpload && !showUploader && (
            <Button
              size="sm"
              onClick={() => setShowUploader(true)}
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </div>

      {/* Upload area */}
      {showUploader && onUpload && (
        <div className="mb-4">
          <DocumentUploader
            onUpload={handleUpload}
            accept={accept}
            maxSize={maxSize}
            label={uploadLabel}
          />
          <button
            type="button"
            onClick={() => setShowUploader(false)}
            className="mt-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Documents list/grid */}
      {documents.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <FolderIcon className="h-10 w-10 text-gray-300 mx-auto" />
          <p className="mt-2 text-sm text-gray-500">{emptyMessage}</p>
          {showUpload && onUpload && !showUploader && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setShowUploader(true)}
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              {uploadLabel}
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc, index) => (
            <DocumentViewer
              key={doc.id || index}
              document={doc}
              onDelete={onDelete ? () => handleDelete(doc) : undefined}
              onDownload={onDownload ? () => onDownload(doc) : undefined}
              showPreview
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1 border border-gray-200 rounded-lg divide-y divide-gray-100">
          {documents.map((doc, index) => (
            <DocumentViewer
              key={doc.id || index}
              document={doc}
              onDelete={onDelete ? () => handleDelete(doc) : undefined}
              onDownload={onDownload ? () => onDownload(doc) : undefined}
              compact
            />
          ))}
        </div>
      )}
    </div>
  )
}
