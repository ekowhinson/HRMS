import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  PaperClipIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline'
import { policyService, type Policy, type PolicyCategory } from '@/services/policies'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const typeOptions = [
  { value: 'POLICY', label: 'Policy' },
  { value: 'SOP', label: 'Standard Operating Procedure' },
  { value: 'GUIDELINE', label: 'Guideline' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'CIRCULAR', label: 'Circular' },
  { value: 'MEMO', label: 'Memo' },
]

const statusOptions = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
]

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data URL prefix (e.g. "data:application/pdf;base64,")
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PolicyFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = !!id
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState<{
    title: string
    code: string
    category: string
    policy_type: 'POLICY' | 'SOP' | 'GUIDELINE' | 'MANUAL' | 'CIRCULAR' | 'MEMO'
    summary: string
    content: string
    version: string
    version_notes: string
    status: 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED'
    effective_date: string
    review_date: string
    expiry_date: string
    requires_acknowledgement: boolean
    acknowledgement_deadline_days: number
    applies_to_all: boolean
  }>({
    title: '',
    code: '',
    category: '',
    policy_type: 'POLICY',
    summary: '',
    content: '',
    version: '1.0',
    version_notes: '',
    status: 'DRAFT',
    effective_date: '',
    review_date: '',
    expiry_date: '',
    requires_acknowledgement: true,
    acknowledgement_deadline_days: 14,
    applies_to_all: true,
  })

  // Attachment state
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [existingAttachment, setExistingAttachment] = useState<{
    name: string
    type: string
    size: number
  } | null>(null)
  const [removeAttachment, setRemoveAttachment] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // Fetch existing policy if editing
  const { data: existingPolicy, isLoading: isLoadingPolicy } = useQuery({
    queryKey: ['policy', id],
    queryFn: () => policyService.getPolicy(id!),
    enabled: isEditing,
  })

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['policy-categories'],
    queryFn: () => policyService.getCategories(),
  })

  // Populate form when editing
  useEffect(() => {
    if (existingPolicy) {
      setFormData({
        title: existingPolicy.title || '',
        code: existingPolicy.code || '',
        category: existingPolicy.category || '',
        policy_type: existingPolicy.policy_type || 'POLICY',
        summary: existingPolicy.summary || '',
        content: existingPolicy.content || '',
        version: existingPolicy.version || '1.0',
        version_notes: existingPolicy.version_notes || '',
        status: existingPolicy.status || 'DRAFT',
        effective_date: existingPolicy.effective_date || '',
        review_date: existingPolicy.review_date || '',
        expiry_date: existingPolicy.expiry_date || '',
        requires_acknowledgement: existingPolicy.requires_acknowledgement ?? true,
        acknowledgement_deadline_days: existingPolicy.acknowledgement_deadline_days || 14,
        applies_to_all: existingPolicy.applies_to_all ?? true,
      })
      if (existingPolicy.has_attachment && existingPolicy.attachment_name) {
        setExistingAttachment({
          name: existingPolicy.attachment_name,
          type: existingPolicy.attachment_type || '',
          size: existingPolicy.attachment_size || 0,
        })
      }
    }
  }, [existingPolicy])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: policyService.createPolicy,
    onSuccess: (data) => {
      toast.success('Policy created successfully')
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      navigate(`/admin/policies/${data.id}`)
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
        || error.response?.data?.non_field_errors?.[0]
        || 'Failed to create policy'
      toast.error(detail)
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<Policy>) => policyService.updatePolicy(id!, data),
    onSuccess: () => {
      toast.success('Policy updated successfully')
      queryClient.invalidateQueries({ queryKey: ['policies'] })
      queryClient.invalidateQueries({ queryKey: ['policy', id] })
      navigate(`/admin/policies/${id}`)
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
        || error.response?.data?.non_field_errors?.[0]
        || 'Failed to update policy'
      toast.error(detail)
    },
  })

  const validateFile = (file: File): boolean => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Accepted: PDF, DOCX, PNG, JPG, GIF, WebP')
      return false
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File is too large. Maximum size is 10MB.')
      return false
    }
    return true
  }

  const handleFileSelect = (file: File) => {
    if (!validateFile(file)) return
    setAttachmentFile(file)
    setRemoveAttachment(false)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleRemoveAttachment = () => {
    setAttachmentFile(null)
    setRemoveAttachment(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.code || !formData.category) {
      toast.error('Please fill in all required fields')
      return
    }

    // On create: require content or attachment
    const hasContent = formData.content.trim().length > 0
    const hasNewAttachment = !!attachmentFile

    if (!isEditing && !hasContent && !hasNewAttachment) {
      toast.error('Please provide either policy content or upload an attachment.')
      return
    }

    const submitData: Record<string, any> = {
      ...formData,
      effective_date: formData.effective_date || null,
      review_date: formData.review_date || null,
      expiry_date: formData.expiry_date || null,
    }

    // Handle attachment
    if (hasNewAttachment) {
      submitData.attachment_data = await fileToBase64(attachmentFile!)
      submitData.attachment_name = attachmentFile!.name
      submitData.attachment_type = attachmentFile!.type
    } else if (removeAttachment && isEditing) {
      // Send empty string to signal removal
      submitData.attachment_data = ''
      submitData.attachment_name = ''
      submitData.attachment_type = ''
    }

    if (isEditing) {
      updateMutation.mutate(submitData)
    } else {
      createMutation.mutate(submitData)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const categoryOptions = [
    { value: '', label: 'Select a category...' },
    ...(categories?.map((c: PolicyCategory) => ({
      value: c.id,
      label: c.name,
    })) || []),
  ]

  // Determine current attachment display
  const currentAttachmentName = attachmentFile
    ? attachmentFile.name
    : (!removeAttachment && existingAttachment)
      ? existingAttachment.name
      : null

  const currentAttachmentSize = attachmentFile
    ? attachmentFile.size
    : (!removeAttachment && existingAttachment)
      ? existingAttachment.size
      : null

  if (isEditing && isLoadingPolicy) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/admin/policies')}>
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Policy' : 'Create New Policy'}
          </h1>
          <p className="text-sm text-gray-500">
            {isEditing ? 'Update policy details' : 'Add a new policy or SOP'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DocumentTextIcon className="h-5 w-5 mr-2 text-primary-500" />
                  Policy Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Policy Code"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    placeholder="e.g., HR-POL-001"
                    required
                  />
                  <Select
                    label="Category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    options={categoryOptions}
                    required
                  />
                </div>
                <Input
                  label="Title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Policy title"
                  required
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Type"
                    name="policy_type"
                    value={formData.policy_type}
                    onChange={handleChange}
                    options={typeOptions}
                    required
                  />
                  <Select
                    label="Status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    options={statusOptions}
                  />
                </div>
                <Textarea
                  label="Summary"
                  name="summary"
                  value={formData.summary}
                  onChange={handleChange}
                  placeholder="Brief summary of the policy..."
                  rows={2}
                />
                <div>
                  <Textarea
                    label="Content (Markdown supported)"
                    name="content"
                    value={formData.content}
                    onChange={handleChange}
                    placeholder="Full policy content..."
                    rows={15}
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Optional if uploading a document attachment
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Attachment Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PaperClipIcon className="h-5 w-5 mr-2 text-primary-500" />
                  Document Attachment
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentAttachmentName ? (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <PaperClipIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">
                          {currentAttachmentName}
                        </p>
                        {currentAttachmentSize != null && (
                          <p className="text-xs text-gray-400">
                            {formatFileSize(currentAttachmentSize)}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      isDragOver
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                    }`}
                  >
                    <ArrowUpTrayIcon className={`h-8 w-8 mb-2 ${isDragOver ? 'text-primary-500' : 'text-gray-400'}`} />
                    <p className="text-sm font-medium text-gray-600">
                      Drop a file here or click to browse
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      PDF, DOCX, PNG, JPG, GIF, WebP — max 10MB
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,image/png,image/jpeg,image/gif,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(file)
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Version & Dates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Version"
                    name="version"
                    value={formData.version}
                    onChange={handleChange}
                    placeholder="1.0"
                  />
                  <div></div>
                </div>
                <Textarea
                  label="Version Notes"
                  name="version_notes"
                  value={formData.version_notes}
                  onChange={handleChange}
                  placeholder="What changed..."
                  rows={2}
                />
                <Input
                  label="Effective Date"
                  name="effective_date"
                  type="date"
                  value={formData.effective_date}
                  onChange={handleChange}
                />
                <Input
                  label="Review Date"
                  name="review_date"
                  type="date"
                  value={formData.review_date}
                  onChange={handleChange}
                />
                <Input
                  label="Expiry Date"
                  name="expiry_date"
                  type="date"
                  value={formData.expiry_date}
                  onChange={handleChange}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Acknowledgement Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="requires_acknowledgement"
                    name="requires_acknowledgement"
                    checked={formData.requires_acknowledgement}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        requires_acknowledgement: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="requires_acknowledgement"
                    className="ml-2 text-sm text-gray-700"
                  >
                    Requires staff acknowledgement
                  </label>
                </div>
                {formData.requires_acknowledgement && (
                  <Input
                    label="Deadline (days)"
                    name="acknowledgement_deadline_days"
                    type="number"
                    value={formData.acknowledgement_deadline_days}
                    onChange={handleChange}
                    min={1}
                  />
                )}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="applies_to_all"
                    name="applies_to_all"
                    checked={formData.applies_to_all}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        applies_to_all: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="applies_to_all" className="ml-2 text-sm text-gray-700">
                    Applies to all employees
                  </label>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/admin/policies')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                isLoading={createMutation.isPending || updateMutation.isPending}
              >
                {isEditing ? 'Update Policy' : 'Create Policy'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
