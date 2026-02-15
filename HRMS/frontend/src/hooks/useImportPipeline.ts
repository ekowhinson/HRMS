/**
 * Import pipeline state machine hook.
 *
 * Manages the wizard flow: upload → mapping → preview → execution → complete.
 * Each step is driven by React Query mutations/queries so the UI stays in sync
 * with the server without manual cache invalidation.
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import {
  analyzeImport,
  generatePreview,
  confirmImport,
  getImportProgress,
  getImportSession,
  getEntityTypes,
  type ImportEntityType,
  type ColumnMapping,
  type AnalyzeResponse,
  type PreviewResponse,
  type ConfirmResponse,
  type ImportSession,
  type ProgressResponse,
} from '@/services/import'

// ── Step definitions ────────────────────────────────────────────────────────

export type ImportStep = 'upload' | 'mapping' | 'preview' | 'execution' | 'complete'

export const IMPORT_STEPS: { id: ImportStep; name: string }[] = [
  { id: 'upload', name: 'Upload & Analyze' },
  { id: 'mapping', name: 'Column Mapping' },
  { id: 'preview', name: 'Preview' },
  { id: 'execution', name: 'Import' },
  { id: 'complete', name: 'Complete' },
]

// ── Hook ────────────────────────────────────────────────────────────────────

export function useImportPipeline() {
  const queryClient = useQueryClient()

  // Wizard state
  const [step, setStep] = useState<ImportStep>('upload')
  const [analyzeData, setAnalyzeData] = useState<AnalyzeResponse | null>(null)
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null)
  const [confirmData, setConfirmData] = useState<ConfirmResponse | null>(null)
  const [editedMapping, setEditedMapping] = useState<ColumnMapping>({})

  // Derived IDs
  const sessionId = analyzeData?.session_id ?? confirmData?.session_id ?? null

  // ── Queries ─────────────────────────────────────────────────────────────

  const entityTypesQuery = useQuery({
    queryKey: ['import-entity-types'],
    queryFn: getEntityTypes,
    staleTime: 5 * 60 * 1000,
  })

  const progressQuery = useQuery<ProgressResponse>({
    queryKey: ['import-progress', sessionId],
    queryFn: () => getImportProgress(sessionId!),
    enabled: step === 'execution' && !!sessionId,
    refetchInterval: (query) => {
      const data = query.state.data as ProgressResponse | undefined
      if (!data) return 2000
      if (data.status === 'COMPLETED' || data.status === 'FAILED') return false
      return 2000
    },
  })

  const sessionQuery = useQuery<ImportSession>({
    queryKey: ['import-session', sessionId],
    queryFn: () => getImportSession(sessionId!),
    enabled: step === 'complete' && !!sessionId,
  })

  // Transition to complete when execution finishes
  if (
    step === 'execution' &&
    progressQuery.data &&
    (progressQuery.data.status === 'COMPLETED' || progressQuery.data.status === 'FAILED')
  ) {
    setStep('complete')
  }

  // ── Mutations ───────────────────────────────────────────────────────────

  const analyzeMutation = useMutation({
    mutationFn: ({
      attachmentId,
      entityType,
    }: {
      attachmentId: string
      entityType?: ImportEntityType
    }) => analyzeImport(attachmentId, entityType),
    onSuccess: (data) => {
      setAnalyzeData(data)
      setEditedMapping({ ...data.column_mapping })
      setStep('mapping')
      toast.success('File analyzed successfully')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to analyze file')
    },
  })

  const previewMutation = useMutation({
    mutationFn: ({
      confirmedMapping,
      importParams,
    }: {
      confirmedMapping?: ColumnMapping
      importParams?: Record<string, any>
    }) => generatePreview(sessionId!, confirmedMapping, importParams),
    onSuccess: (data) => {
      setPreviewData(data)
      setStep('preview')
      toast.success('Preview generated')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to generate preview')
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () => confirmImport(sessionId!),
    onSuccess: (data) => {
      setConfirmData(data)
      setStep('execution')
      toast.success('Import started')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to start import')
    },
  })

  // ── Actions ─────────────────────────────────────────────────────────────

  const analyze = useCallback(
    (attachmentId: string, entityType?: ImportEntityType) => {
      analyzeMutation.mutate({ attachmentId, entityType })
    },
    [analyzeMutation],
  )

  const submitMapping = useCallback(
    (importParams?: Record<string, any>) => {
      previewMutation.mutate({ confirmedMapping: editedMapping, importParams })
    },
    [previewMutation, editedMapping],
  )

  const confirm = useCallback(() => {
    confirmMutation.mutate()
  }, [confirmMutation])

  const reset = useCallback(() => {
    setStep('upload')
    setAnalyzeData(null)
    setPreviewData(null)
    setConfirmData(null)
    setEditedMapping({})
    queryClient.removeQueries({ queryKey: ['import-progress'] })
    queryClient.removeQueries({ queryKey: ['import-session'] })
  }, [queryClient])

  const goBack = useCallback(() => {
    if (step === 'mapping') setStep('upload')
    else if (step === 'preview') setStep('mapping')
  }, [step])

  return {
    // State
    step,
    analyzeData,
    previewData,
    confirmData,
    editedMapping,
    sessionId,

    // Queries
    entityTypes: entityTypesQuery.data ?? [],
    entityTypesLoading: entityTypesQuery.isLoading,
    progress: progressQuery.data ?? null,
    session: sessionQuery.data ?? null,
    sessionLoading: sessionQuery.isLoading,

    // Loading flags
    isAnalyzing: analyzeMutation.isPending,
    isPreviewing: previewMutation.isPending,
    isConfirming: confirmMutation.isPending,

    // Actions
    analyze,
    setEditedMapping,
    submitMapping,
    confirm,
    reset,
    goBack,
  }
}
