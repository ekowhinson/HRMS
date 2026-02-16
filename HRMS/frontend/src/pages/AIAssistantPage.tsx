import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import {
  SparklesIcon,
  PaperAirplaneIcon,
  PlusIcon,
  TrashIcon,
  StopIcon,
  ChatBubbleLeftRightIcon,
  PaperClipIcon,
  XMarkIcon,
  DocumentTextIcon,
  TableCellsIcon,
  PhotoIcon,
  ChartBarIcon,
  ArrowUpTrayIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'
import {
  chatStream,
  getConversations,
  getConversation,
  deleteConversation,
  uploadFile,
  getPromptTemplates,
  type Message,
  type MessageAttachment,
  type PromptTemplate,
  type StreamChunk,
  type AuditSummary,
} from '@/services/assistant'

const ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  ChartBarIcon,
  ArrowUpTrayIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  TableCellsIcon,
  BanknotesIcon,
  SparklesIcon,
}

const FILE_TYPE_CONFIG: Record<string, { icon: typeof DocumentTextIcon; color: string; bg: string }> = {
  DATA: { icon: TableCellsIcon, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  DOCUMENT: { icon: DocumentTextIcon, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  IMAGE: { icon: PhotoIcon, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
}

const FALLBACK_PROMPTS = [
  'How do I process payroll for a new month?',
  'What are the steps to onboard a new employee?',
  'Explain the leave approval workflow',
  'How do I generate a payroll reconciliation report?',
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileChip({
  attachment,
  onRemove,
  compact,
}: {
  attachment: MessageAttachment
  onRemove?: () => void
  compact?: boolean
}) {
  const config = FILE_TYPE_CONFIG[attachment.file_type] || FILE_TYPE_CONFIG.DOCUMENT
  const Icon = config.icon

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 ${config.bg} ${
        compact ? 'text-xs' : 'text-sm'
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
      <span className="truncate max-w-[150px] font-medium text-gray-700">
        {attachment.file_name}
      </span>
      <span className="text-gray-400 text-xs">{formatFileSize(attachment.file_size)}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 p-0.5 rounded hover:bg-gray-200 transition-colors"
        >
          <XMarkIcon className="h-3.5 w-3.5 text-gray-400" />
        </button>
      )}
    </div>
  )
}

function AttachmentDisplay({ attachments }: { attachments: MessageAttachment[] }) {
  if (!attachments?.length) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {attachments.map((att) => (
        <FileChip key={att.id} attachment={att} compact />
      ))}
    </div>
  )
}

export default function AIAssistantPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [payrollRunId, setPayrollRunId] = useState<string | null>(null)
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ['assistant-conversations'],
    queryFn: getConversations,
  })

  const { data: promptTemplates = [] } = useQuery({
    queryKey: ['assistant-templates'],
    queryFn: getPromptTemplates,
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

  // Handle payroll_run_id from URL params (e.g. navigated from PayrollProcessingPage)
  const payrollAutoSentRef = useRef(false)
  const sendMessageRef = useRef<(msg: string) => void>(() => {})

  const loadConversation = useCallback(async (id: string) => {
    try {
      const detail = await getConversation(id)
      setActiveConversationId(id)
      setMessages(detail.messages)
      setStreamingContent('')
      setPendingAttachments([])
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
    setPendingAttachments([])
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

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''

    setIsUploading(true)
    try {
      const attachment = await uploadFile(file, activeConversationId || undefined)
      setPendingAttachments(prev => [...prev, attachment])
      // If upload created a new conversation, track it
      if (attachment.conversation_id && !activeConversationId) {
        setActiveConversationId(attachment.conversation_id)
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `File upload failed: ${err.message || 'Unknown error'}`,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsUploading(false)
    }
  }, [activeConversationId])

  const removePendingAttachment = useCallback((id: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id))
  }, [])

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isStreaming) return

    const currentAttachments = [...pendingAttachments]
    const attachmentIds = currentAttachments.map(a => a.id)

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText.trim(),
      created_at: new Date().toISOString(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setStreamingContent('')
    setIsStreaming(true)
    setPendingAttachments([])

    const controller = new AbortController()
    abortControllerRef.current = controller

    let fullResponse = ''

    await chatStream(
      {
        message: messageText.trim(),
        conversation_id: activeConversationId,
        attachment_ids: attachmentIds.length > 0 ? attachmentIds : undefined,
        payroll_run_id: payrollRunId,
      },
      (chunk: StreamChunk) => {
        switch (chunk.type) {
          case 'meta':
            if (chunk.conversation_id) {
              setActiveConversationId(chunk.conversation_id)
            }
            if (chunk.audit_summary) {
              setAuditSummary(chunk.audit_summary)
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
  }, [activeConversationId, isStreaming, queryClient, pendingAttachments, payrollRunId])

  // Keep ref in sync for useEffect access
  sendMessageRef.current = sendMessage

  // Auto-send payroll check when navigated from payroll page
  useEffect(() => {
    const runId = searchParams.get('payroll_run_id')
    if (runId && !payrollAutoSentRef.current) {
      payrollAutoSentRef.current = true
      setPayrollRunId(runId)
      setSearchParams({}, { replace: true })
      setTimeout(() => {
        sendMessageRef.current(
          'Analyze this payroll run for consistency. Check the automated audit findings, review the employee details, and identify any anomalies or issues that need attention. Provide a clear summary of what looks correct and what needs review.'
        )
      }, 100)
    }
  }, [searchParams, setSearchParams])

  const handleTemplateClick = useCallback((template: PromptTemplate) => {
    setInputValue(template.prompt_text)
    textareaRef.current?.focus()
  }, [])

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
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50"
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
                  className={`group flex items-center gap-2 px-3 py-2.5 mx-1 rounded-md cursor-pointer transition-colors duration-150 ${
                    activeConversationId === conv.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <ChatBubbleLeftRightIcon className="h-4 w-4 shrink-0 opacity-50" />
                  <span className="flex-1 text-sm truncate">{conv.title}</span>
                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 hover:text-red-600 transition-colors duration-150"
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
        {/* Audit Summary Badges */}
        {auditSummary && (
          <div className="flex items-center gap-3 px-6 py-2.5 bg-white border-b border-gray-200">
            <span className="text-sm font-medium text-gray-600">Payroll Audit:</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {auditSummary.checks_passed}/{auditSummary.total_checks} checks passed
            </span>
            {auditSummary.errors > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {auditSummary.errors} errors
              </span>
            )}
            {auditSummary.warnings > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {auditSummary.warnings} warnings
              </span>
            )}
            {auditSummary.info > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {auditSummary.info} info
              </span>
            )}
            {auditSummary.total_findings === 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                All clear
              </span>
            )}
          </div>
        )}
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            /* Empty State - Welcome Screen with Prompt Templates */
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
                <SparklesIcon className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">HRMS AI Assistant</h2>
              <p className="text-gray-500 mb-8 text-center max-w-md">
                Ask me anything about HR processes, payroll, leave management, or upload files for analysis.
              </p>

              {promptTemplates.length > 0 ? (
                <div className="max-w-2xl w-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {promptTemplates.map((template) => {
                      const IconComp = ICON_MAP[template.icon] || SparklesIcon
                      return (
                        <button
                          key={template.id}
                          onClick={() => handleTemplateClick(template)}
                          className="text-left p-4 rounded-md border border-gray-300 hover:border-blue-300 hover:bg-blue-50 transition-colors duration-150 group"
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <IconComp className="h-4 w-4 text-gray-400 group-hover:text-blue-500" />
                            <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700">
                              {template.name}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {template.description}
                          </p>
                          {template.requires_file && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                              <PaperClipIcon className="h-3 w-3" />
                              <span>Requires file</span>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                  {FALLBACK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-left p-3 rounded-md border border-gray-300 hover:border-blue-300 hover:bg-blue-50 transition-colors duration-150 text-sm text-gray-600 hover:text-blue-700"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
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
                        : 'bg-white border border-gray-300 text-gray-800'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {msg.attachments.map(att => (
                              <div
                                key={att.id}
                                className="inline-flex items-center gap-1 rounded-md bg-blue-500/30 px-2 py-1 text-xs text-blue-100"
                              >
                                {att.file_type === 'IMAGE' ? (
                                  <PhotoIcon className="h-3.5 w-3.5" />
                                ) : att.file_type === 'DATA' ? (
                                  <TableCellsIcon className="h-3.5 w-3.5" />
                                ) : (
                                  <DocumentTextIcon className="h-3.5 w-3.5" />
                                )}
                                <span className="truncate max-w-[120px]">{att.file_name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-2 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <AttachmentDisplay attachments={msg.attachments} />
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming Response */}
              {streamingContent && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-white border border-gray-300 text-gray-800">
                    <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-2 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs">
                      <ReactMarkdown>{streamingContent}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {/* Generating indicator */}
              {isStreaming && !streamingContent && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-4 py-3 bg-white border border-gray-300">
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

        {/* Pending Attachments Bar */}
        {pendingAttachments.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2">
            <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
              {pendingAttachments.map(att => (
                <FileChip
                  key={att.id}
                  attachment={att}
                  onRemove={() => removePendingAttachment(att.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            {/* File upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isStreaming}
              className="shrink-0 p-3 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Attach file"
            >
              {isUploading ? (
                <div className="h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <PaperClipIcon className="h-5 w-5" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.gif,.webp"
              onChange={handleFileSelect}
            />

            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  pendingAttachments.length > 0
                    ? 'Ask about the attached file(s)...'
                    : 'Ask anything about HR, payroll, or any module...'
                }
                rows={1}
                disabled={isStreaming}
                className="w-full resize-none rounded-md border border-gray-300 bg-gray-50 focus:bg-white px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] hover:border-gray-400 disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
            {isStreaming ? (
              <button
                onClick={handleStopGeneration}
                className="shrink-0 p-3 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors duration-150"
                title="Stop generation"
              >
                <StopIcon className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage(inputValue)}
                disabled={!inputValue.trim()}
                className="shrink-0 p-3 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
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
