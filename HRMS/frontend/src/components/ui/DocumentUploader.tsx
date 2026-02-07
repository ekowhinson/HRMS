import { useState, useCallback, useRef } from 'react'
import { CloudArrowUpIcon, XMarkIcon, DocumentIcon, PhotoIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export interface DocumentInfo {
  id?: string
  name: string
  size: number
  type: string
  checksum?: string
  url?: string
  is_image?: boolean
  is_pdf?: boolean
}

interface DocumentUploaderProps {
  onUpload: (file: File) => Promise<void>
  accept?: string
  maxSize?: number // in bytes, default 10MB
  multiple?: boolean
  disabled?: boolean
  existingFile?: DocumentInfo | null
  onDelete?: () => Promise<void>
  label?: string
  hint?: string
  className?: string
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024 // 10MB
const DEFAULT_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif'

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function isPreviewable(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf'
}

export default function DocumentUploader({
  onUpload,
  accept = DEFAULT_ACCEPT,
  maxSize = DEFAULT_MAX_SIZE,
  multiple = false,
  disabled = false,
  existingFile,
  onDelete,
  label = 'Upload Document',
  hint,
  className,
}: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    // Check size
    if (file.size > maxSize) {
      return `File size exceeds ${formatFileSize(maxSize)} limit`
    }

    // Check type
    if (accept) {
      const acceptedTypes = accept.split(',').map(t => t.trim().toLowerCase())
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
      const fileMime = file.type.toLowerCase()

      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExt === type
        }
        if (type.includes('*')) {
          return fileMime.startsWith(type.replace('*', ''))
        }
        return fileMime === type
      })

      if (!isAccepted) {
        return `File type not accepted. Allowed: ${accept}`
      }
    }

    return null
  }, [accept, maxSize])

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    const validationError = validateFile(file)

    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setIsUploading(true)

    try {
      await onUpload(file)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }, [onUpload, validateFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (!disabled) {
      handleFiles(e.dataTransfer.files)
    }
  }, [disabled, handleFiles])

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }, [disabled])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    // Reset input so same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [handleFiles])

  const handleDelete = useCallback(async () => {
    if (onDelete) {
      setIsUploading(true)
      try {
        await onDelete()
      } catch (err: any) {
        setError(err.message || 'Delete failed')
      } finally {
        setIsUploading(false)
      }
    }
  }, [onDelete])

  // If there's an existing file, show it
  if (existingFile) {
    return (
      <div className={clsx('relative', className)}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {label}
          </label>
        )}
        <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
          {existingFile.is_image && existingFile.url ? (
            <img
              src={existingFile.url}
              alt={existingFile.name}
              className="h-16 w-16 object-cover rounded"
            />
          ) : (
            <div className="h-16 w-16 flex items-center justify-center bg-gray-200 rounded">
              {existingFile.is_pdf ? (
                <DocumentIcon className="h-8 w-8 text-red-500" />
              ) : (
                <DocumentIcon className="h-8 w-8 text-gray-500" />
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {existingFile.name}
            </p>
            <p className="text-xs text-gray-500">
              {formatFileSize(existingFile.size)} • {existingFile.type}
            </p>
          </div>
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isUploading}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          'relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer',
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400 bg-white',
          disabled && 'opacity-50 cursor-not-allowed',
          isUploading && 'pointer-events-none'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          disabled={disabled || isUploading}
          className="sr-only"
        />

        {isUploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full" />
            <p className="mt-3 text-sm text-gray-600">Uploading...</p>
          </div>
        ) : (
          <>
            <CloudArrowUpIcon className="h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm text-gray-600">
              <span className="font-medium text-primary-600">Click to upload</span>
              {' '}or drag and drop
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {hint || `Max ${formatFileSize(maxSize)}`}
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
