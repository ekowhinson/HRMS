import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MegaphoneIcon,
  DocumentTextIcon,
  CalendarIcon,
  UserCircleIcon,
  ClipboardDocumentCheckIcon,
  DocumentPlusIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/features/auth/store'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import Badge, { CountBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import Modal from '@/components/ui/Modal'
import { announcementsService, type Announcement } from '@/services/announcements'
import { policyService, type Policy } from '@/services/policies'

// Priority badge mapping
const priorityConfig: Record<string, { variant: 'danger' | 'warning' | 'info' | 'default'; label: string }> = {
  URGENT: { variant: 'danger', label: 'Urgent' },
  HIGH: { variant: 'warning', label: 'High' },
  NORMAL: { variant: 'info', label: 'Normal' },
  LOW: { variant: 'default', label: 'Low' },
}

// Policy type badge mapping
const policyTypeConfig: Record<string, { variant: 'info' | 'default' | 'success' | 'warning'; label: string }> = {
  POLICY: { variant: 'info', label: 'Policy' },
  SOP: { variant: 'success', label: 'SOP' },
  GUIDELINE: { variant: 'default', label: 'Guideline' },
  MANUAL: { variant: 'warning', label: 'Manual' },
  CIRCULAR: { variant: 'info', label: 'Circular' },
  MEMO: { variant: 'default', label: 'Memo' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function SelfServiceDashboard() {
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)

  // Fetch announcements
  const { data: announcements = [], isLoading: loadingAnnouncements } = useQuery({
    queryKey: ['my-announcements'],
    queryFn: () => announcementsService.getMyAnnouncements(),
  })

  // Fetch unread count
  const { data: unreadData } = useQuery({
    queryKey: ['announcements-unread-count'],
    queryFn: () => announcementsService.getUnreadCount(),
  })

  // Fetch pending policies
  const { data: pendingPolicies = [], isLoading: loadingPending } = useQuery({
    queryKey: ['my-pending-policies'],
    queryFn: () => policyService.getMyPendingPolicies(),
  })

  // Fetch all policies
  const { data: allPoliciesData, isLoading: loadingPolicies } = useQuery({
    queryKey: ['all-policies'],
    queryFn: () => policyService.getPolicies({ status: 'PUBLISHED', active_only: true }),
  })
  const allPolicies = allPoliciesData?.results ?? []

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: (id: string) => announcementsService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-announcements'] })
      queryClient.invalidateQueries({ queryKey: ['announcements-unread-count'] })
    },
  })

  // Acknowledge announcement mutation
  const ackAnnouncementMutation = useMutation({
    mutationFn: (id: string) => announcementsService.acknowledge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-announcements'] })
    },
  })

  // Acknowledge policy mutation
  const ackPolicyMutation = useMutation({
    mutationFn: (id: string) => policyService.acknowledgePolicy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-pending-policies'] })
      queryClient.invalidateQueries({ queryKey: ['all-policies'] })
    },
  })

  // Download policy attachment
  const handleDownloadAttachment = async (policy: Policy) => {
    try {
      const blob = await policyService.downloadAttachment(policy.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = policy.attachment_name || `${policy.code}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch {
      // silently fail - could add toast here
    }
  }

  // Open announcement detail
  const handleOpenAnnouncement = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement)
    if (!announcement.is_read) {
      markReadMutation.mutate(announcement.id)
    }
  }

  // Sort announcements: pinned first, then by date
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const unreadCount = unreadData?.count ?? 0
  const firstName = user?.first_name || 'there'

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here's what's happening in your organization
          </p>
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-lg border border-primary-200">
            <MegaphoneIcon className="h-5 w-5 text-primary-600" />
            <span className="text-sm font-medium text-primary-700">
              {unreadCount} unread announcement{unreadCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Announcements Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <MegaphoneIcon className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Announcements</h2>
                <p className="text-sm text-gray-500">Company news and updates</p>
              </div>
            </div>
            {unreadCount > 0 && <CountBadge count={unreadCount} variant="danger" />}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingAnnouncements ? (
            <div className="p-6 text-center text-sm text-gray-500">Loading announcements...</div>
          ) : sortedAnnouncements.length === 0 ? (
            <div className="p-8 text-center">
              <InformationCircleIcon className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No announcements at this time</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sortedAnnouncements.map((announcement) => {
                const priority = priorityConfig[announcement.priority] || priorityConfig.NORMAL
                return (
                  <div
                    key={announcement.id}
                    className={`px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !announcement.is_read ? 'bg-primary-50/30' : ''
                    }`}
                    onClick={() => handleOpenAnnouncement(announcement)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {announcement.is_pinned && (
                            <span className="text-xs font-medium text-primary-600 bg-primary-100 px-2 py-0.5 rounded">
                              Pinned
                            </span>
                          )}
                          <Badge variant={priority.variant} size="xs">
                            {priority.label}
                          </Badge>
                          {announcement.category && (
                            <span className="text-xs text-gray-400">{announcement.category}</span>
                          )}
                          {!announcement.is_read && (
                            <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {announcement.title}
                        </h3>
                        {announcement.summary && (
                          <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                            {announcement.summary}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400">
                          {formatDate(announcement.created_at)}
                        </span>
                        {announcement.requires_acknowledgement && !announcement.is_acknowledged && (
                          <Badge variant="warning" size="xs" dot pulse>
                            Needs Ack
                          </Badge>
                        )}
                        {announcement.is_acknowledged && (
                          <Badge variant="success" size="xs">
                            Acknowledged
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Policies Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info-100 rounded-lg">
              <DocumentTextIcon className="h-5 w-5 text-info-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Company Policies</h2>
              <p className="text-sm text-gray-500">Policies, SOPs, and guidelines</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="pending">
            <div className="px-6 pt-2">
              <TabsList>
                <TabsTrigger value="pending">
                  Pending Acknowledgement
                  {pendingPolicies.length > 0 && (
                    <CountBadge count={pendingPolicies.length} variant="warning" size="sm" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="all">All Policies</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="pending" className="mt-0">
              {loadingPending ? (
                <div className="p-6 text-center text-sm text-gray-500">Loading policies...</div>
              ) : pendingPolicies.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircleIcon className="mx-auto h-10 w-10 text-success-300" />
                  <p className="mt-2 text-sm text-gray-500">
                    All caught up! No policies pending acknowledgement.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {pendingPolicies.map((policy) => (
                    <PolicyRow
                      key={policy.id}
                      policy={policy}
                      showAcknowledge
                      onAcknowledge={() => ackPolicyMutation.mutate(policy.id)}
                      onDownload={() => handleDownloadAttachment(policy)}
                      isAcknowledging={ackPolicyMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="all" className="mt-0">
              {loadingPolicies ? (
                <div className="p-6 text-center text-sm text-gray-500">Loading policies...</div>
              ) : allPolicies.length === 0 ? (
                <div className="p-8 text-center">
                  <InformationCircleIcon className="mx-auto h-10 w-10 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">No published policies found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {allPolicies.map((policy) => (
                    <PolicyRow
                      key={policy.id}
                      policy={policy}
                      showAcknowledge={policy.requires_acknowledgement && !policy.user_acknowledged}
                      onAcknowledge={() => ackPolicyMutation.mutate(policy.id)}
                      onDownload={() => handleDownloadAttachment(policy)}
                      isAcknowledging={ackPolicyMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Links</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickLink
            to="/my-leave"
            icon={<CalendarIcon className="h-5 w-5" />}
            label="My Leave"
          />
          <QuickLink
            to="/my-profile"
            icon={<UserCircleIcon className="h-5 w-5" />}
            label="My Profile"
          />
          <QuickLink
            to="/my-service-requests"
            icon={<ClipboardDocumentCheckIcon className="h-5 w-5" />}
            label="Service Requests"
          />
          <QuickLink
            to="/my-data-updates"
            icon={<DocumentPlusIcon className="h-5 w-5" />}
            label="Data Updates"
          />
        </div>
      </div>

      {/* Announcement Detail Modal */}
      <Modal
        isOpen={!!selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
        title={selectedAnnouncement?.title}
        size="lg"
      >
        {selectedAnnouncement && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={
                  (priorityConfig[selectedAnnouncement.priority] || priorityConfig.NORMAL).variant
                }
                size="sm"
              >
                {(priorityConfig[selectedAnnouncement.priority] || priorityConfig.NORMAL).label}
              </Badge>
              {selectedAnnouncement.category && (
                <Badge variant="default" size="sm">
                  {selectedAnnouncement.category}
                </Badge>
              )}
              <span className="text-xs text-gray-400">
                {formatDate(selectedAnnouncement.created_at)}
              </span>
              {selectedAnnouncement.author_name && (
                <span className="text-xs text-gray-400">
                  by {selectedAnnouncement.author_name}
                </span>
              )}
            </div>

            <div
              className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content }}
            />

            {selectedAnnouncement.attachments?.length > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Attachments</p>
                <div className="space-y-2">
                  {selectedAnnouncement.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.download_url}
                      className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      {att.file_name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {selectedAnnouncement.requires_acknowledgement &&
              !selectedAnnouncement.is_acknowledged && (
                <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-warning-600">
                    <ExclamationTriangleIcon className="h-5 w-5" />
                    <span>This announcement requires your acknowledgement</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      ackAnnouncementMutation.mutate(selectedAnnouncement.id)
                      setSelectedAnnouncement(null)
                    }}
                    isLoading={ackAnnouncementMutation.isPending}
                    leftIcon={<CheckCircleIcon className="h-4 w-4" />}
                  >
                    Acknowledge
                  </Button>
                </div>
              )}

            {selectedAnnouncement.is_acknowledged && (
              <div className="border-t border-gray-200 pt-4">
                <Badge variant="success" size="sm" dot>
                  You have acknowledged this announcement
                </Badge>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

// Policy row component
function PolicyRow({
  policy,
  showAcknowledge,
  onAcknowledge,
  onDownload,
  isAcknowledging,
}: {
  policy: Policy
  showAcknowledge: boolean
  onAcknowledge: () => void
  onDownload: () => void
  isAcknowledging: boolean
}) {
  const typeConfig = policyTypeConfig[policy.policy_type] || policyTypeConfig.POLICY

  return (
    <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={typeConfig.variant} size="xs">
              {typeConfig.label}
            </Badge>
            <span className="text-xs text-gray-400">{policy.code}</span>
            {policy.category_name && (
              <span className="text-xs text-gray-400">{policy.category_name}</span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-gray-900">{policy.title}</h3>
          {policy.summary && (
            <p className="mt-1 text-sm text-gray-500 line-clamp-2">{policy.summary}</p>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
            <span>v{policy.version}</span>
            {policy.effective_date && <span>Effective: {formatDate(policy.effective_date)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {policy.has_attachment && (
            <Button
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation()
                onDownload()
              }}
              leftIcon={<ArrowDownTrayIcon className="h-3.5 w-3.5" />}
            >
              Download
            </Button>
          )}
          {showAcknowledge && (
            <Button
              variant="primary"
              size="xs"
              onClick={(e) => {
                e.stopPropagation()
                onAcknowledge()
              }}
              isLoading={isAcknowledging}
              leftIcon={<CheckCircleIcon className="h-3.5 w-3.5" />}
            >
              Acknowledge
            </Button>
          )}
          {policy.user_acknowledged && (
            <Badge variant="success" size="xs">
              Acknowledged
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

// Quick link card
function QuickLink({
  to,
  icon,
  label,
}: {
  to: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 shadow-xs hover:shadow-sm hover:border-gray-300 transition-all group"
    >
      <div className="p-2 bg-gray-100 rounded-lg text-gray-600 group-hover:bg-primary-100 group-hover:text-primary-600 transition-colors">
        {icon}
      </div>
      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{label}</span>
      <ChevronRightIcon className="ml-auto h-4 w-4 text-gray-300 group-hover:text-gray-500" />
    </Link>
  )
}
