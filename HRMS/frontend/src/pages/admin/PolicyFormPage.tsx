import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeftIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { policyService, type Policy, type PolicyCategory } from '@/services/policies'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'

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

export default function PolicyFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = !!id

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
      toast.error(error.response?.data?.detail || 'Failed to create policy')
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
      toast.error(error.response?.data?.detail || 'Failed to update policy')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.code || !formData.category || !formData.content) {
      toast.error('Please fill in all required fields')
      return
    }

    const submitData = {
      ...formData,
      effective_date: formData.effective_date || null,
      review_date: formData.review_date || null,
      expiry_date: formData.expiry_date || null,
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
                <Textarea
                  label="Content (Markdown supported)"
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  placeholder="Full policy content..."
                  rows={15}
                  required
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
