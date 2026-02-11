import api from '@/lib/api'

export interface Notification {
  id: string
  title: string
  message: string
  notification_type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS' | 'TASK' | 'APPROVAL'
  is_read: boolean
  read_at: string | null
  link: string | null
  extra_data: Record<string, any> | null
  created_at: string
}

export const notificationService = {
  getNotifications: async (params: { is_read?: boolean; page?: number; page_size?: number } = {}) => {
    const response = await api.get('/core/notifications/', { params })
    return response.data
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    const response = await api.get('/core/notifications/unread_count/')
    return response.data
  },

  markRead: async (id: string): Promise<void> => {
    await api.post(`/core/notifications/${id}/mark_read/`)
  },

  markAllRead: async (): Promise<void> => {
    await api.post('/core/notifications/mark_all_read/')
  },
}
