import api from '@/lib/api'
import type { PaginatedResponse } from '@/types'

// ==================== Types ====================

export type AnnouncementPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
export type AnnouncementStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'

export interface Announcement {
  id: string
  title: string
  slug: string
  content: string
  summary: string
  priority: AnnouncementPriority
  status: AnnouncementStatus
  category: string
  is_company_wide: boolean
  publish_date: string | null
  expiry_date: string | null
  pin_to_top: boolean
  show_on_dashboard: boolean
  requires_acknowledgement: boolean
  allow_comments: boolean
  published_at: string | null
  published_by: string | null
  published_by_name: string
  banner_url: string | null
  read_count: number
  read_stats: {
    total_read: number
    acknowledged: number
    target_count: number
    read_percentage: number
  }
  targets: AnnouncementTarget[]
  attachments: AnnouncementAttachment[]
  is_read: boolean
  is_acknowledged: boolean
  created_by: string | null
  created_by_name: string
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

  getAnnouncement: async (slug: string): Promise<Announcement> => {
    const response = await api.get(`/core/announcements/${slug}/`)
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

  updateAnnouncement: async (slug: string, data: Partial<Announcement>): Promise<Announcement> => {
    const response = await api.patch(`/core/announcements/${slug}/`, data)
    return response.data
  },

  deleteAnnouncement: async (slug: string): Promise<void> => {
    await api.delete(`/core/announcements/${slug}/`)
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
  publishAnnouncement: async (slug: string): Promise<Announcement> => {
    const response = await api.post(`/core/announcements/${slug}/publish/`)
    return response.data
  },

  // Archive announcement
  archiveAnnouncement: async (slug: string): Promise<Announcement> => {
    const response = await api.post(`/core/announcements/${slug}/archive/`)
    return response.data
  },

  // Mark as read
  markAsRead: async (slug: string): Promise<void> => {
    await api.post(`/core/announcements/${slug}/mark_read/`)
  },

  // Acknowledge announcement
  acknowledge: async (slug: string): Promise<void> => {
    await api.post(`/core/announcements/${slug}/acknowledge/`)
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
