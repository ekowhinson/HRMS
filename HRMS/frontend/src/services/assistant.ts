import { api } from '@/lib/api'
import { useAuthStore } from '@/features/auth/store'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

export interface ChatRequest {
  message: string
  conversation_id?: string | null
}

export interface StreamChunk {
  type: 'meta' | 'token' | 'done' | 'error'
  content?: string
  conversation_id?: string
}

export interface Conversation {
  id: string
  title: string
  is_archived: boolean
  created_at: string
  updated_at: string
  message_count?: number
  last_message_at?: string | null
}

export interface ConversationDetail extends Conversation {
  messages: Message[]
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

/**
 * Stream chat responses using native fetch (Axios doesn't support ReadableStream).
 */
export async function chatStream(
  request: ChatRequest,
  onChunk: (chunk: StreamChunk) => void,
  onError: (error: string) => void,
  signal?: AbortSignal,
) {
  const state = useAuthStore.getState()
  const token = state.tokens?.access
  const orgId = state.activeOrganization?.id

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (orgId) headers['X-Tenant-ID'] = orgId

  try {
    const response = await fetch(`${API_BASE_URL}/assistant/chat/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal,
    })

    if (!response.ok) {
      const text = await response.text()
      onError(text || `HTTP ${response.status}`)
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      onError('No response stream available')
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Keep the last partial line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const chunk: StreamChunk = JSON.parse(trimmed)
          onChunk(chunk)
        } catch {
          // Skip non-JSON lines
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const chunk: StreamChunk = JSON.parse(buffer.trim())
        onChunk(chunk)
      } catch {
        // Skip
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') return
    onError(err.message || 'Stream connection failed')
  }
}

export async function getConversations(): Promise<Conversation[]> {
  const { data } = await api.get('/assistant/conversations/')
  return data
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  const { data } = await api.get(`/assistant/conversations/${id}/`)
  return data
}

export async function createConversation(title?: string): Promise<Conversation> {
  const { data } = await api.post('/assistant/conversations/', { title })
  return data
}

export async function renameConversation(id: string, title: string): Promise<Conversation> {
  const { data } = await api.patch(`/assistant/conversations/${id}/`, { title })
  return data
}

export async function deleteConversation(id: string): Promise<void> {
  await api.delete(`/assistant/conversations/${id}/`)
}

export async function getHealth() {
  const { data } = await api.get('/assistant/health/')
  return data
}
