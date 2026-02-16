import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import PortalLayout from '@/components/layout/PortalLayout'
import { applicantPortalService, getPortalToken } from '@/services/applicantPortal'
import type { PortalDocument } from '@/services/applicantPortal'
import {
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  DocumentTextIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  SkeletonListItem,
} from '@/components/ui'
import type { StatusVariant } from '@/lib/status'

const statusVariant: Record<string, StatusVariant> = {
  PENDING: 'warning',
  UPLOADED: 'info',
  VERIFIED: 'success',
  REJECTED: 'danger',
}

const statusIcon: Record<string, React.ReactNode> = {
  PENDING: <ClockIcon className="h-5 w-5 text-yellow-600" />,
  UPLOADED: <DocumentTextIcon className="h-5 w-5 text-blue-600" />,
  VERIFIED: <CheckCircleIcon className="h-5 w-5 text-green-600" />,
  REJECTED: <ExclamationCircleIcon className="h-5 w-5 text-red-600" />,
}

export default function PortalDocumentsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const token = getPortalToken()

  const { data: documents = [], isLoading } = useQuery<PortalDocument[]>({
    queryKey: ['portal-documents'],
    queryFn: applicantPortalService.getDocuments,
    enabled: !!token,
  })

  if (!token) {
    navigate('/portal/login')
    return null
  }

  const uploadedCount = documents.filter((d) => d.status !== 'PENDING').length
  const totalCount = documents.length

  return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Onboarding Documents</h1>
            <p className="text-gray-600 text-sm mt-1">
              Upload the required documents for your onboarding process.
            </p>
          </div>
          {totalCount > 0 && (
            <span className="text-sm text-gray-600">
              {uploadedCount} / {totalCount} completed
            </span>
          )}
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(uploadedCount / totalCount) * 100}%` }}
            />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonListItem key={i} />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            type="documents"
            title="No documents required yet"
            description="Documents will appear here once you accept a job offer."
          />
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onUploadSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['portal-documents'] })
                  queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] })
                }}
              />
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  )
}

function DocumentCard({
  document: doc,
  onUploadSuccess,
}: {
  document: PortalDocument
  onUploadSuccess: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const icon = statusIcon[doc.status] || statusIcon.PENDING

  const canUpload = doc.status === 'PENDING' || doc.status === 'REJECTED'

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit')
      return
    }

    try {
      await applicantPortalService.uploadDocument(doc.document_type, file)
      toast.success(`${doc.document_type_display} uploaded successfully`)
      onUploadSuccess()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to upload document')
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Card className={doc.status === 'REJECTED' ? 'border-red-200' : undefined}>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {icon}
            <div>
              <h3 className="font-medium text-gray-900">{doc.document_type_display}</h3>
              {doc.file_name && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {doc.file_name}
                  {doc.file_size && ` (${(doc.file_size / 1024).toFixed(0)} KB)`}
                </p>
              )}
              {doc.updated_at && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Updated: {new Date(doc.updated_at).toLocaleDateString()}
                </p>
              )}
              {doc.status === 'REJECTED' && doc.rejection_reason && (
                <p className="text-sm text-red-600 mt-1">
                  Rejected: {doc.rejection_reason}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={statusVariant[doc.status] || 'default'} size="sm">
              {doc.status_display}
            </Badge>

            {canUpload && (
              <label className="inline-flex">
                <span className="inline-flex items-center justify-center font-medium rounded-md transition-colors duration-150 bg-primary-600 text-white hover:bg-primary-700 px-3.5 py-2 text-sm gap-1.5 cursor-pointer">
                  {doc.status === 'REJECTED' ? (
                    <ArrowPathIcon className="h-4 w-4" />
                  ) : (
                    <DocumentArrowUpIcon className="h-4 w-4" />
                  )}
                  {doc.status === 'REJECTED' ? 'Re-upload' : 'Upload'}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleUpload}
                />
              </label>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
