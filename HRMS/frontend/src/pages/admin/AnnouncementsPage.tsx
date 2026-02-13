import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import { TablePagination } from '@/components/ui/Table'
import { announcementsService, type Announcement, type AnnouncementPriority } from '@/services/announcements'

const priorityColors: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  LOW: 'default',
  NORMAL: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
}

const statusColors: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'default',
  SCHEDULED: 'warning',
  PUBLISHED: 'success',
  ARCHIVED: 'default',
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalItems, setTotalItems] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    priority: 'NORMAL' as AnnouncementPriority,
    category: '',
    is_pinned: false,
    requires_acknowledgement: false,
  })
  const [saving, setSaving] = useState(false)
  const totalPages = Math.ceil(totalItems / pageSize)

  useEffect(() => {
    loadAnnouncements()
  }, [statusFilter, page, pageSize])

  const loadAnnouncements = async () => {
    setLoading(true)
    try {
      const data = await announcementsService.getAnnouncements({
        status: statusFilter || undefined,
        search: search || undefined,
        page,
        page_size: pageSize,
      })
      setAnnouncements(data.results || [])
      setTotalItems(data.count || 0)
    } catch (error) {
      console.error('Error loading announcements:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    loadAnnouncements()
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      await announcementsService.createAnnouncement(formData)
      setShowCreateModal(false)
      setFormData({
        title: '',
        content: '',
        summary: '',
        priority: 'NORMAL',
        category: '',
        is_pinned: false,
        requires_acknowledgement: false,
      })
      loadAnnouncements()
    } catch (error) {
      console.error('Error creating announcement:', error)
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async (slug: string) => {
    try {
      await announcementsService.publishAnnouncement(slug)
      loadAnnouncements()
    } catch (error) {
      console.error('Error publishing announcement:', error)
    }
  }

  const handleArchive = async (slug: string) => {
    try {
      await announcementsService.archiveAnnouncement(slug)
      loadAnnouncements()
    } catch (error) {
      console.error('Error archiving announcement:', error)
    }
  }

  const handleDelete = async (slug: string) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return
    try {
      await announcementsService.deleteAnnouncement(slug)
      loadAnnouncements()
    } catch (error) {
      console.error('Error deleting announcement:', error)
    }
  }

  const viewAnnouncement = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement)
    setShowViewModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Announcements</h1>
          <p className="text-gray-500">Create and manage organization-wide announcements</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>Create Announcement</Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex gap-4">
            <Input
              placeholder="Search announcements..."
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSearch()}
              className="w-64"
            />
            <Select
              value={statusFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-40"
              options={[
                { value: '', label: 'All Status' },
                { value: 'DRAFT', label: 'Draft' },
                { value: 'PUBLISHED', label: 'Published' },
                { value: 'ARCHIVED', label: 'Archived' },
              ]}
            />
            <Button variant="outline" onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Announcements List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-8 text-center">Loading...</CardContent>
          </Card>
        ) : announcements.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No announcements found
            </CardContent>
          </Card>
        ) : (
          announcements.map((announcement) => (
            <Card key={announcement.id} className={announcement.pin_to_top ? 'border-l-4 border-l-primary-500' : ''}>
              <CardContent className="py-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {announcement.pin_to_top && (
                        <span className="text-primary-500" title="Pinned">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v2a2 2 0 01-2 2H7a2 2 0 01-2-2V5zm2 10h6v4a1 1 0 01-1 1H8a1 1 0 01-1-1v-4zm0-8h6V5H7v2z" />
                          </svg>
                        </span>
                      )}
                      <h3
                        className="text-lg font-medium cursor-pointer hover:text-primary-600"
                        onClick={() => viewAnnouncement(announcement)}
                      >
                        {announcement.title}
                      </h3>
                      <Badge variant={priorityColors[announcement.priority]}>
                        {announcement.priority}
                      </Badge>
                      <Badge variant={statusColors[announcement.status]}>
                        {announcement.status}
                      </Badge>
                    </div>
                    <p className="text-gray-600 text-sm mb-2">
                      {announcement.summary || (announcement.content ? announcement.content.substring(0, 150) : '')}
                      {announcement.content && announcement.content.length > 150 && '...'}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>By {announcement.created_by_name}</span>
                      <span>{new Date(announcement.created_at).toLocaleDateString()}</span>
                      <span>{announcement.read_count ?? 0} views</span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {announcement.status === 'DRAFT' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePublish(announcement.slug)}
                      >
                        Publish
                      </Button>
                    )}
                    {announcement.status === 'PUBLISHED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchive(announcement.slug)}
                      >
                        Archive
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(announcement.slug)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <TablePagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Announcement"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <Input
              value={formData.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Announcement title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Summary
            </label>
            <Input
              value={formData.summary}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="Brief summary (optional)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content *
            </label>
            <Textarea
              value={formData.content}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Announcement content"
              rows={6}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <Select
                value={formData.priority}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, priority: e.target.value as AnnouncementPriority })}
                options={[
                  { value: 'LOW', label: 'Low' },
                  { value: 'NORMAL', label: 'Normal' },
                  { value: 'HIGH', label: 'High' },
                  { value: 'URGENT', label: 'Urgent' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <Input
                value={formData.category}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., HR, IT, General"
              />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_pinned}
                onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Pin to top</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.requires_acknowledgement}
                onChange={(e) => setFormData({ ...formData, requires_acknowledgement: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Require acknowledgement</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !formData.title || !formData.content}>
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={selectedAnnouncement?.title || 'Announcement'}
      >
        {selectedAnnouncement && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={priorityColors[selectedAnnouncement.priority]}>
                {selectedAnnouncement.priority}
              </Badge>
              <Badge variant={statusColors[selectedAnnouncement.status]}>
                {selectedAnnouncement.status}
              </Badge>
              {selectedAnnouncement.pin_to_top && (
                <Badge variant="info">Pinned</Badge>
              )}
            </div>
            <div className="text-sm text-gray-500">
              Posted by {selectedAnnouncement.created_by_name} on{' '}
              {new Date(selectedAnnouncement.created_at).toLocaleString()}
            </div>
            <div className="prose max-w-none">
              <div className="whitespace-pre-wrap">{selectedAnnouncement.content}</div>
            </div>
            {selectedAnnouncement.attachments?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Attachments</h4>
                <ul className="space-y-1">
                  {selectedAnnouncement.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <a
                        href={attachment.download_url}
                        className="text-primary-600 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {attachment.file_name}
                      </a>
                      <span className="text-gray-500 text-sm ml-2">
                        ({(attachment.file_size / 1024).toFixed(1)} KB)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
