import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import {
  SparklesIcon,
  PaperAirplaneIcon,
  PlusIcon,
  TrashIcon,
  StopIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'
import {
  chatStream,
  getConversations,
  getConversation,
  deleteConversation,
  type Message,
  type StreamChunk,
} from '@/services/assistant'

const SUGGESTED_PROMPTS = [
  'How do I process payroll for a new month?',
  'What are the steps to onboard a new employee?',
  'Explain the leave approval workflow',
  'How do I generate a payroll reconciliation report?',
]

export default function AIAssistantPage() {
  const queryClient = useQueryClient()
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ['assistant-conversations'],
    queryFn: getConversations,
  })

  // Auto-scroll on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [inputValue])

  const loadConversation = useCallback(async (id: string) => {
    try {
      const detail = await getConversation(id)
      setActiveConversationId(id)
      setMessages(detail.messages)
      setStreamingContent('')
    } catch {
      // Handle error silently
    }
  }, [])

  const handleNewChat = useCallback(() => {
    if (isStreaming) return
    setActiveConversationId(null)
    setMessages([])
    setStreamingContent('')
    setInputValue('')
  }, [isStreaming])

  const handleDeleteConversation = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteConversation(id)
      queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] })
      if (activeConversationId === id) {
        setActiveConversationId(null)
        setMessages([])
      }
    } catch {
      // Handle error silently
    }
  }, [activeConversationId, queryClient])

  const handleStopGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isStreaming) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText.trim(),
      created_at: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setStreamingContent('')
    setIsStreaming(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    let fullResponse = ''

    await chatStream(
      {
        message: messageText.trim(),
        conversation_id: activeConversationId,
      },
      (chunk: StreamChunk) => {
        switch (chunk.type) {
          case 'meta':
            if (chunk.conversation_id) {
              setActiveConversationId(chunk.conversation_id)
            }
            break
          case 'token':
            fullResponse += chunk.content || ''
            setStreamingContent(fullResponse)
            break
          case 'done':
            if (fullResponse) {
              const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: fullResponse,
                created_at: new Date().toISOString(),
              }
              setMessages(prev => [...prev, assistantMessage])
            }
            setStreamingContent('')
            setIsStreaming(false)
            queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] })
            break
          case 'error':
            setStreamingContent('')
            setIsStreaming(false)
            const errorMessage: Message = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `Sorry, an error occurred: ${chunk.content || 'Unknown error'}. Please make sure Ollama is running and try again.`,
              created_at: new Date().toISOString(),
            }
            setMessages(prev => [...prev, errorMessage])
            break
        }
      },
      (error: string) => {
        setStreamingContent('')
        setIsStreaming(false)
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Connection error: ${error}. Please make sure the server is running.`,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, errorMessage])
      },
      controller.signal,
    )

    // If aborted mid-stream, save partial response
    if (controller.signal.aborted && fullResponse) {
      const partialMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullResponse,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, partialMessage])
      setStreamingContent('')
    }
  }, [activeConversationId, isStreaming, queryClient])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  const hasMessages = messages.length > 0 || streamingContent

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50">
      {/* Left Panel - Conversations */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={handleNewChat}
            disabled={isStreaming}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" />
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="p-4 text-center text-sm text-gray-400">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">No conversations yet</div>
          ) : (
            <div className="py-1">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={`group flex items-center gap-2 px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition-colors ${
                    activeConversationId === conv.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <ChatBubbleLeftRightIcon className="h-4 w-4 shrink-0 opacity-50" />
                  <span className="flex-1 text-sm truncate">{conv.title}</span>
                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 hover:text-red-600 transition-all"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center Panel - Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            /* Empty State - Welcome Screen */
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
                <SparklesIcon className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">HRMS AI Assistant</h2>
              <p className="text-gray-500 mb-8 text-center max-w-md">
                Ask me anything about HR processes, payroll, leave management, or any ERP module.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-left p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm text-gray-600 hover:text-blue-700"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="max-w-3xl mx-auto w-full py-6 px-4 space-y-4">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-2 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming Response */}
              {streamingContent && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-white border border-gray-200 text-gray-800">
                    <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-2 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs">
                      <ReactMarkdown>{streamingContent}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {/* Generating indicator */}
              {isStreaming && !streamingContent && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-4 py-3 bg-white border border-gray-200">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="max-w-3xl mx-auto flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about HR, payroll, or any module..."
                rows={1}
                disabled={isStreaming}
                className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            {isStreaming ? (
              <button
                onClick={handleStopGeneration}
                className="shrink-0 p-3 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
                title="Stop generation"
              >
                <StopIcon className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage(inputValue)}
                disabled={!inputValue.trim()}
                className="shrink-0 p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Send message"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">
            AI responses may not always be accurate. Verify important information.
          </p>
        </div>
      </div>
    </div>
  )
}
