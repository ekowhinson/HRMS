import api from '@/lib/api'
import type { PaginatedResponse } from '@/types'

// ==================== Types ====================

export type AnnouncementPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
export type AnnouncementStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'

export interface Announcement {
  id: string
  title: string
  content: string
  summary: string
  priority: AnnouncementPriority
  priority_display: string
  status: AnnouncementStatus
  status_display: string
  category: string
  author: string | null
  author_name: string
  publish_at: string | null
  expires_at: string | null
  is_pinned: boolean
  requires_acknowledgement: boolean
  allow_comments: boolean
  views_count: number
  acknowledgements_count: number
  targets: AnnouncementTarget[]
  attachments: AnnouncementAttachment[]
  is_read: boolean
  is_acknowledged: boolean
  created_at: string
  updated_at: string
}

export interface AnnouncementTarget {
  id: string
  announcement: string
  target_type: string
  target_type_display: string
  department: string | null
  department_name: string
  grade: string | null
  grade_name: string
  location: string | null
  location_name: string
  employee: string | null
  employee_name: string
}

export interface AnnouncementAttachment {
  id: string
  announcement: string
  file_name: string
  file_size: number
  mime_type: string
  description: string
  download_url: string
  created_at: string
}

export interface AnnouncementFilters {
  status?: string
  priority?: string
  category?: string
  is_pinned?: boolean
  search?: string
  page?: number
}

// ==================== Service ====================

export const announcementsService = {
  // ==================== Announcements ====================

  getAnnouncements: async (filters: AnnouncementFilters = {}): Promise<PaginatedResponse<Announcement>> => {
    const response = await api.get('/core/announcements/', { params: filters })
    return response.data
  },

  getAnnouncement: async (id: string): Promise<Announcement> => {
    const response = await api.get(`/core/announcements/${id}/`)
    return response.data
  },

  createAnnouncement: async (data: {
    title: string
    content: string
    summary?: string
    priority?: AnnouncementPriority
    category?: string
    publish_at?: string
    expires_at?: string
    is_pinned?: boolean
    requires_acknowledgement?: boolean
    allow_comments?: boolean
  }): Promise<Announcement> => {
    const response = await api.post('/core/announcements/', data)
    return response.data
  },

  updateAnnouncement: async (id: string, data: Partial<Announcement>): Promise<Announcement> => {
    const response = await api.patch(`/core/announcements/${id}/`, data)
    return response.data
  },

  deleteAnnouncement: async (id: string): Promise<void> => {
    await api.delete(`/core/announcements/${id}/`)
  },

  // Get announcements for current user
  getMyAnnouncements: async (): Promise<Announcement[]> => {
    const response = await api.get('/core/announcements/my_announcements/')
    return response.data
  },

  // Get active/published announcements
  getActiveAnnouncements: async (): Promise<Announcement[]> => {
    const response = await api.get('/core/announcements/active/')
    return response.data
  },

  // Publish announcement
  publishAnnouncement: async (id: string): Promise<Announcement> => {
    const response = await api.post(`/core/announcements/${id}/publish/`)
    return response.data
  },

  // Archive announcement
  archiveAnnouncement: async (id: string): Promise<Announcement> => {
    const response = await api.post(`/core/announcements/${id}/archive/`)
    return response.data
  },

  // Mark as read
  markAsRead: async (id: string): Promise<void> => {
    await api.post(`/core/announcements/${id}/mark_read/`)
  },

  // Acknowledge announcement
  acknowledge: async (id: string): Promise<void> => {
    await api.post(`/core/announcements/${id}/acknowledge/`)
  },

  // Get unread count
  getUnreadCount: async (): Promise<{ count: number }> => {
    const response = await api.get('/core/announcements/unread_count/')
    return response.data
  },

  // ==================== Targets ====================

  addTarget: async (announcementId: string, data: {
    target_type: string
    department?: string
    grade?: string
    location?: string
    employee?: string
  }): Promise<AnnouncementTarget> => {
    const response = await api.post('/core/announcement-targets/', {
      announcement: announcementId,
      ...data
    })
    return response.data
  },

  removeTarget: async (id: string): Promise<void> => {
    await api.delete(`/core/announcement-targets/${id}/`)
  },

  // ==================== Attachments ====================

  uploadAttachment: async (announcementId: string, file: File, description?: string): Promise<AnnouncementAttachment> => {
    const formData = new FormData()
    formData.append('announcement', announcementId)
    formData.append('file', file)
    if (description) {
      formData.append('description', description)
    }
    const response = await api.post('/core/announcement-attachments/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  deleteAttachment: async (id: string): Promise<void> => {
    await api.delete(`/core/announcement-attachments/${id}/`)
  },

  downloadAttachment: async (id: string): Promise<Blob> => {
    const response = await api.get(`/core/announcement-attachments/${id}/download/`, {
      responseType: 'blob'
    })
    return response.data
  },
}
