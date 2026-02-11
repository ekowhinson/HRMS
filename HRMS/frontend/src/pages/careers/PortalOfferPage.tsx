import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import PortalLayout from '@/components/layout/PortalLayout'
import { applicantPortalService, getPortalToken } from '@/services/applicantPortal'
import type { PortalOffer } from '@/services/applicantPortal'
import {
  DocumentArrowDownIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

export default function PortalOfferPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const token = getPortalToken()

  const [acceptanceFile, setAcceptanceFile] = useState<File | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [showDeclineForm, setShowDeclineForm] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isDeclining, setIsDeclining] = useState(false)

  const { data: offer, isLoading, error } = useQuery<PortalOffer>({
    queryKey: ['portal-offer'],
    queryFn: applicantPortalService.getOffer,
    enabled: !!token,
  })

  if (!token) {
    navigate('/portal/login')
    return null
  }

  const handleAccept = async () => {
    setIsAccepting(true)
    try {
      await applicantPortalService.acceptOffer(acceptanceFile || undefined)
      toast.success('Offer accepted! Welcome aboard!')
      queryClient.invalidateQueries({ queryKey: ['portal-offer'] })
      queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] })
      navigate('/portal/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to accept offer')
    } finally {
      setIsAccepting(false)
    }
  }

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      toast.error('Please provide a reason for declining')
      return
    }
    setIsDeclining(true)
    try {
      await applicantPortalService.declineOffer(declineReason)
      toast.success('Offer declined')
      queryClient.invalidateQueries({ queryKey: ['portal-offer'] })
      queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] })
      navigate('/portal/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to decline offer')
    } finally {
      setIsDeclining(false)
    }
  }

  const handleDownloadOfferLetter = () => {
    if (!offer?.offer_letter_base64 || !offer.offer_letter_mime) return
    const byteChars = atob(offer.offer_letter_base64)
    const byteNumbers = new Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: offer.offer_letter_mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = offer.offer_letter_name || 'offer_letter.pdf'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="text-center py-16 text-gray-500">Loading offer details...</div>
      </PortalLayout>
    )
  }

  if (error || !offer) {
    return (
      <PortalLayout>
        <div className="text-center py-16 text-gray-500">
          No offer available.
          <button
            onClick={() => navigate('/portal/dashboard')}
            className="block mx-auto mt-4 px-4 py-2 bg-blue-600 text-white rounded-md text-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </PortalLayout>
    )
  }

  const canRespond = ['SENT', 'APPROVED'].includes(offer.status)

  return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Job Offer</h1>
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-teal-100 text-teal-800">
            {offer.status_display}
          </span>
        </div>

        {/* Offer Details */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Offer Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Offer Number</p>
              <p className="font-medium">{offer.offer_number}</p>
            </div>
            <div>
              <p className="text-gray-500">Position</p>
              <p className="font-medium">{offer.position}</p>
            </div>
            <div>
              <p className="text-gray-500">Department</p>
              <p className="font-medium">{offer.department}</p>
            </div>
            {offer.grade && (
              <div>
                <p className="text-gray-500">Grade</p>
                <p className="font-medium">{offer.grade}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500">Basic Salary</p>
              <p className="font-medium">GHS {Number(offer.basic_salary).toLocaleString()}</p>
            </div>
            {Number(offer.allowances) > 0 && (
              <div>
                <p className="text-gray-500">Allowances</p>
                <p className="font-medium">GHS {Number(offer.allowances).toLocaleString()}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500">Total Compensation</p>
              <p className="font-medium text-green-700">GHS {Number(offer.total_compensation).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500">Proposed Start Date</p>
              <p className="font-medium">{new Date(offer.proposed_start_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-gray-500">Offer Date</p>
              <p className="font-medium">{new Date(offer.offer_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-gray-500">Response Deadline</p>
              <p className="font-medium text-orange-600">{new Date(offer.response_deadline).toLocaleDateString()}</p>
            </div>
          </div>
          {offer.compensation_notes && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-1">Additional Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{offer.compensation_notes}</p>
            </div>
          )}
        </div>

        {/* Offer Letter Download */}
        {offer.has_offer_letter && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Offer Letter</h2>
            <button
              onClick={handleDownloadOfferLetter}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
            >
              <DocumentArrowDownIcon className="h-5 w-5" />
              Download Offer Letter ({offer.offer_letter_name})
            </button>
          </div>
        )}

        {/* Response Actions */}
        {canRespond && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Respond to Offer</h2>

            {/* Accept */}
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5" />
                Accept Offer
              </h3>
              <p className="text-sm text-green-700 mb-3">
                Upload your signed acceptance letter (optional) and confirm acceptance.
              </p>
              <div className="flex items-center gap-3 mb-3">
                <label className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-md cursor-pointer hover:bg-gray-50 border border-gray-300">
                  <DocumentArrowUpIcon className="h-4 w-4" />
                  {acceptanceFile ? acceptanceFile.name : 'Upload Acceptance Letter'}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => setAcceptanceFile(e.target.files?.[0] || null)}
                  />
                </label>
                {acceptanceFile && (
                  <button
                    onClick={() => setAcceptanceFile(null)}
                    className="text-sm text-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>
              <button
                onClick={handleAccept}
                disabled={isAccepting}
                className="px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isAccepting ? 'Processing...' : 'Accept Offer'}
              </button>
            </div>

            {/* Decline */}
            <div className="p-4 bg-red-50 rounded-lg">
              <h3 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                <XCircleIcon className="h-5 w-5" />
                Decline Offer
              </h3>
              {!showDeclineForm ? (
                <button
                  onClick={() => setShowDeclineForm(true)}
                  className="text-sm text-red-600 hover:underline"
                >
                  I want to decline this offer
                </button>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    rows={3}
                    placeholder="Please provide a reason for declining..."
                    className="w-full rounded-md border border-red-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleDecline}
                      disabled={isDeclining}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {isDeclining ? 'Processing...' : 'Confirm Decline'}
                    </button>
                    <button
                      onClick={() => setShowDeclineForm(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  )
}
