import { useCallback, useState } from 'react'
import {
  XMarkIcon,
  DocumentIcon,
  TableCellsIcon,
  FolderPlusIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

interface MultiFileUploaderProps {
  onFilesSelect: (files: File[]) => void
  selectedFiles: File[]
  onRemoveFile: (index: number) => void
  onClearAll: () => void
  disabled?: boolean
  maxFiles?: number
}

const FILE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  csv: TableCellsIcon,
  xlsx: TableCellsIcon,
  xls: TableCellsIcon,
  txt: DocumentIcon,
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

export default function MultiFileUploader({
  onFilesSelect,
  selectedFiles,
  onRemoveFile,
  onClearAll,
  disabled = false,
  maxFiles = 20,
}: MultiFileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFiles = useCallback(
    (files: File[]): File[] => {
      setError(null)
      const validFiles: File[] = []
      const errors: string[] = []

      const validExtensions = ['csv', 'xlsx', 'xls', 'txt']
      const maxSize = 10 * 1024 * 1024 // 10MB per file

      for (const file of files) {
        const ext = getFileExtension(file.name)

        if (!validExtensions.includes(ext)) {
          errors.push(`${file.name}: Invalid type (${ext})`)
          continue
        }

        if (file.size > maxSize) {
          errors.push(`${file.name}: Too large (max 10MB)`)
          continue
        }

        // Check for duplicates
        if (selectedFiles.some((f) => f.name === file.name)) {
          errors.push(`${file.name}: Already added`)
          continue
        }

        validFiles.push(file)
      }

      if (selectedFiles.length + validFiles.length > maxFiles) {
        const canAdd = maxFiles - selectedFiles.length
        errors.push(`Maximum ${maxFiles} files allowed. Only adding first ${canAdd}.`)
        validFiles.splice(canAdd)
      }

      if (errors.length > 0) {
        setError(errors.join('; '))
      }

      return validFiles
    },
    [selectedFiles, maxFiles]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)

      if (disabled) return

      const files = Array.from(e.dataTransfer.files)
      const validFiles = validateFiles(files)
      if (validFiles.length > 0) {
        onFilesSelect([...selectedFiles, ...validFiles])
      }
    },
    [disabled, validateFiles, onFilesSelect, selectedFiles]
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
      const files = Array.from(e.target.files || [])
      const validFiles = validateFiles(files)
      if (validFiles.length > 0) {
        onFilesSelect([...selectedFiles, ...validFiles])
      }
      e.target.value = ''
    },
    [validateFiles, onFilesSelect, selectedFiles]
  )

  const totalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0)

  return (
    <div className="space-y-4">
      {/* Drop zone */}
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
          accept=".csv,.xlsx,.xls,.txt"
          onChange={handleFileInput}
          disabled={disabled}
          multiple
          className="hidden"
          id="multi-file-upload"
        />
        <label
          htmlFor="multi-file-upload"
          className={cn('cursor-pointer', disabled && 'cursor-not-allowed')}
        >
          <FolderPlusIcon
            className={cn(
              'mx-auto h-12 w-12',
              isDragging ? 'text-primary-500' : 'text-gray-400'
            )}
          />
          <p className="mt-4 text-sm font-medium text-gray-900">
            {isDragging ? 'Drop files here' : 'Drag and drop multiple files here'}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            or <span className="text-primary-600 hover:text-primary-500">browse</span> to
            choose files
          </p>
          <p className="mt-3 text-xs text-gray-400">
            Supported formats: CSV, Excel (.xlsx, .xls), TXT
          </p>
          <p className="text-xs text-gray-400">
            Maximum {maxFiles} files, 10MB each
          </p>
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="border rounded-lg divide-y">
          <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium text-gray-900">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
              </span>
              <span className="text-gray-500 ml-2">
                ({formatFileSize(totalSize)} total)
              </span>
            </div>
            {!disabled && (
              <button
                onClick={onClearAll}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {selectedFiles.map((file, index) => {
              const ext = getFileExtension(file.name)
              const FileIcon = FILE_TYPE_ICONS[ext] || DocumentIcon

              return (
                <div
                  key={`${file.name}-${index}`}
                  className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-gray-100 rounded">
                      <FileIcon className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)} &bull; {ext.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  {!disabled && (
                    <button
                      onClick={() => onRemoveFile(index)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
