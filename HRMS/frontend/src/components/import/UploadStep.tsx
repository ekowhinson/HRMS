/**
 * Step 1: Upload a file and trigger AI analysis.
 *
 * Uses the existing /assistant/upload/ endpoint to upload the file,
 * then calls analyzeImport with the returned attachment ID.
 */

import { useState, useRef, useCallback } from 'react'
import {
  CloudArrowUpIcon,
  DocumentArrowUpIcon,
  TableCellsIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import type { ImportEntityType, EntityTypeInfo } from '@/services/import'

interface UploadStepProps {
  entityTypes: EntityTypeInfo[]
  entityTypesLoading: boolean
  isAnalyzing: boolean
  onAnalyze: (attachmentId: string, entityType?: ImportEntityType) => void
}

const ACCEPT = '.csv,.xlsx,.xls'

export default function UploadStep({
  entityTypes,
  entityTypesLoading,
  isAnalyzing,
  onAnalyze,
}: UploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [entityType, setEntityType] = useState<ImportEntityType | ''>('')
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleFileSelect = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      toast.error('Please select a CSV or Excel file')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File must be under 20 MB')
      return
    }
    setSelectedFile(file)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [handleFileSelect],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect],
  )

  const handleSubmit = useCallback(async () => {
    if (!selectedFile) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const { data } = await api.post('/assistant/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const attachmentId = data.id
      onAnalyze(attachmentId, entityType || undefined)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }, [selectedFile, entityType, onAnalyze])

  const isBusy = isUploading || isAnalyzing

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => !isBusy && fileInputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors',
          dragActive
            ? 'border-primary-500 bg-primary-50'
            : selectedFile
              ? 'border-primary-300 bg-primary-50/50'
              : 'border-gray-300 hover:border-gray-400 bg-white',
          isBusy && 'pointer-events-none opacity-60',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ACCEPT}
          onChange={handleInputChange}
        />

        {selectedFile ? (
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-lg bg-primary-100">
              <TableCellsIcon className="w-8 h-8 text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSelectedFile(null) }}
              className="text-xs text-gray-500 hover:text-danger-600 flex items-center gap-1"
            >
              <XMarkIcon className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-lg bg-gray-100">
              <CloudArrowUpIcon className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                Drag & drop your file here, or <span className="text-primary-600">browse</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">CSV, XLSX, or XLS up to 20 MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Entity type selector */}
      <Card>
        <CardContent className="py-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Import type
            <span className="text-gray-400 font-normal ml-1">(optional — AI auto-detects)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEntityType('')}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                entityType === ''
                  ? 'bg-primary-50 border-primary-300 text-primary-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              Auto-detect
            </button>
            {entityTypesLoading ? (
              <span className="text-sm text-gray-400 py-1.5">Loading...</span>
            ) : (
              entityTypes.map((et) => (
                <button
                  key={et.type}
                  type="button"
                  onClick={() => setEntityType(et.type)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                    entityType === et.type
                      ? 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
                  )}
                >
                  {et.label}
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!selectedFile || isBusy}
          isLoading={isBusy}
          leftIcon={<DocumentArrowUpIcon className="w-4 h-4" />}
        >
          {isAnalyzing ? 'Analyzing...' : isUploading ? 'Uploading...' : 'Upload & Analyze'}
        </Button>
      </div>
    </div>
  )
}
