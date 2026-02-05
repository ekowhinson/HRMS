import { useCallback, useState } from 'react'
import {
  DocumentArrowUpIcon,
  XMarkIcon,
  DocumentIcon,
  DocumentTextIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

interface FileUploaderProps {
  onFileSelect: (file: File) => void
  selectedFile: File | null
  onClear: () => void
  disabled?: boolean
  accept?: string
}

const FILE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  csv: TableCellsIcon,
  xlsx: TableCellsIcon,
  xls: TableCellsIcon,
  txt: DocumentTextIcon,
  pdf: DocumentIcon,
}

const ACCEPTED_TYPES = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/plain': ['.txt'],
  'application/pdf': ['.pdf'],
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

export default function FileUploader({
  onFileSelect,
  selectedFile,
  onClear,
  disabled = false,
  accept = '.csv,.xlsx,.xls,.txt,.pdf',
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFile = useCallback((file: File): boolean => {
    setError(null)

    // Check file type
    const ext = getFileExtension(file.name)
    const validExtensions = ['csv', 'xlsx', 'xls', 'txt', 'pdf']
    if (!validExtensions.includes(ext)) {
      setError(`Invalid file type. Accepted types: ${validExtensions.join(', ')}`)
      return false
    }

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      setError('File size must be less than 50MB')
      return false
    }

    return true
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)

      if (disabled) return

      const file = e.dataTransfer.files[0]
      if (file && validateFile(file)) {
        onFileSelect(file)
      }
    },
    [disabled, validateFile, onFileSelect]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (!disabled) {
        setIsDragging(true)
      }
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file && validateFile(file)) {
        onFileSelect(file)
      }
      // Reset input so same file can be selected again
      e.target.value = ''
    },
    [validateFile, onFileSelect]
  )

  if (selectedFile) {
    const ext = getFileExtension(selectedFile.name)
    const FileIcon = FILE_TYPE_ICONS[ext] || DocumentIcon

    return (
      <div className="border-2 border-dashed border-green-300 bg-green-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <FileIcon className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">
                {formatFileSize(selectedFile.size)} &bull; {ext.toUpperCase()}
              </p>
            </div>
          </div>
          {!disabled && (
            <button
              onClick={onClear}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileInput}
          disabled={disabled}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className={cn('cursor-pointer', disabled && 'cursor-not-allowed')}
        >
          <DocumentArrowUpIcon
            className={cn(
              'mx-auto h-12 w-12',
              isDragging ? 'text-primary-500' : 'text-gray-400'
            )}
          />
          <p className="mt-4 text-sm font-medium text-gray-900">
            {isDragging ? 'Drop file here' : 'Drag and drop your file here'}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            or <span className="text-primary-600 hover:text-primary-500">browse</span> to
            choose a file
          </p>
          <p className="mt-3 text-xs text-gray-400">
            Supported formats: CSV, Excel (.xlsx, .xls), TXT, PDF
          </p>
          <p className="text-xs text-gray-400">Maximum file size: 50MB</p>
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
