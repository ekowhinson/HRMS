import { useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  backupService,
  RESTORE_STATUS_CONFIG,
  BACKUP_MODULES,
  type TenantRestore,
  type RestoreStatus,
} from '@/services/backup'

// ==================== Utility Functions ====================

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '--'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(startStr: string | null, endStr: string | null): string {
  if (!startStr) return '--'
  const start = new Date(startStr).getTime()
  const end = endStr ? new Date(endStr).getTime() : Date.now()
  const diffSecs = Math.floor((end - start) / 1000)
  if (diffSecs < 60) return `${diffSecs}s`
  const mins = Math.floor(diffSecs / 60)
  const secs = diffSecs % 60
  if (mins < 60) return `${mins}m ${secs}s`
  const hours = Math.floor(mins / 60)
  const remainMins = mins % 60
  return `${hours}h ${remainMins}m`
}

function getModuleLabel(moduleKey: string): string {
  return BACKUP_MODULES.find((m) => m.value === moduleKey)?.label || moduleKey
}

// ==================== Module Status Types ====================

type ModuleState = 'completed' | 'in_progress' | 'waiting' | 'failed'

interface ModuleProgress {
  key: string
  label: string
  state: ModuleState
  restored: number
  total: number | null
  skipped: number
}

function getModuleState(
  _moduleKey: string,
  restore: TenantRestore,
  currentModuleIndex: number,
  moduleIndex: number
): ModuleState {
  if (restore.status === 'COMPLETED') return 'completed'
  if (restore.status === 'FAILED' || restore.status === 'ROLLED_BACK') {
    if (moduleIndex < currentModuleIndex) return 'completed'
    if (moduleIndex === currentModuleIndex) return 'failed'
    return 'waiting'
  }

  if (moduleIndex < currentModuleIndex) return 'completed'
  if (moduleIndex === currentModuleIndex) return 'in_progress'
  return 'waiting'
}

// ==================== Module Progress Item ====================

function ModuleProgressItem({ module }: { module: ModuleProgress }) {
  const stateConfig: Record<ModuleState, { icon: typeof CheckCircleIcon; color: string; bgColor: string }> = {
    completed: {
      icon: CheckCircleIcon,
      color: 'text-success-600',
      bgColor: 'bg-success-50',
    },
    in_progress: {
      icon: ArrowPathIcon,
      color: 'text-info-600',
      bgColor: 'bg-info-50',
    },
    waiting: {
      icon: ClockIcon,
      color: 'text-gray-400',
      bgColor: 'bg-gray-50',
    },
    failed: {
      icon: XCircleIcon,
      color: 'text-danger-600',
      bgColor: 'bg-danger-50',
    },
  }

  const config = stateConfig[module.state]
  const Icon = config.icon

  return (
    <div className={`flex items-center gap-4 px-4 py-3 rounded-md ${config.bgColor}`}>
      <div className="flex-shrink-0">
        <Icon
          className={`h-5 w-5 ${config.color} ${module.state === 'in_progress' ? 'animate-spin' : ''}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className={`text-sm font-medium ${module.state === 'waiting' ? 'text-gray-500' : 'text-gray-900'}`}>
            {module.label}
          </p>
          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
            {module.state === 'completed' && (
              <>{module.restored.toLocaleString()} records restored</>
            )}
            {module.state === 'in_progress' && module.total !== null && (
              <>{module.restored.toLocaleString()}/{module.total.toLocaleString()} records...</>
            )}
            {module.state === 'in_progress' && module.total === null && (
              <>{module.restored.toLocaleString()} records...</>
            )}
            {module.state === 'waiting' && 'waiting'}
            {module.state === 'failed' && (
              <span className="text-danger-600">{module.restored.toLocaleString()} records before failure</span>
            )}
          </span>
        </div>
        {module.skipped > 0 && (
          <p className="text-xs text-gray-400 mt-0.5">
            {module.skipped.toLocaleString()} skipped
          </p>
        )}
      </div>
    </div>
  )
}

// ==================== Progress Bar ====================

function ProgressBar({ percent, status }: { percent: number; status: RestoreStatus }) {
  const barColor = status === 'FAILED' || status === 'ROLLED_BACK'
    ? 'bg-danger-500'
    : status === 'COMPLETED'
    ? 'bg-success-500'
    : 'bg-primary-600'

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Progress</span>
        <span className="text-sm font-bold text-gray-900">{percent}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor} ${
            status === 'IN_PROGRESS' || status === 'PRE_BACKUP' ? 'animate-pulse' : ''
          }`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  )
}

// ==================== Loading State ====================

function RestoreProgressSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Skeleton variant="custom" width={32} height={32} rounded="md" />
        <div className="space-y-2 flex-1">
          <Skeleton variant="title" width="60%" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
      <Skeleton variant="custom" height={12} rounded="full" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="custom" height={52} rounded="lg" />
        ))}
      </div>
    </div>
  )
}

// ==================== Main Page ====================

export default function RestoreProgressPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: restore, isLoading, isError } = useQuery({
    queryKey: ['restore-progress', id],
    queryFn: () => backupService.getRestore(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data as TenantRestore | undefined
      if (!data) return 3000
      const activeStatuses: RestoreStatus[] = ['PENDING', 'PRE_BACKUP', 'IN_PROGRESS']
      return activeStatuses.includes(data.status) ? 3000 : false
    },
  })

  // Compute module progress from restore data
  const moduleProgress = useMemo<ModuleProgress[]>(() => {
    if (!restore) return []

    const modules = restore.modules_restored || []
    if (modules.length === 0) {
      // If no modules listed, derive from records_restored
      const allModuleKeys = new Set([
        ...Object.keys(restore.records_restored || {}),
        ...Object.keys(restore.records_skipped || {}),
      ])
      return Array.from(allModuleKeys).map((key) => ({
        key,
        label: getModuleLabel(key),
        state: restore.status === 'COMPLETED' ? 'completed' as ModuleState : 'in_progress' as ModuleState,
        restored: restore.records_restored[key] ?? 0,
        total: null,
        skipped: restore.records_skipped[key] ?? 0,
      }))
    }

    // Determine which module is currently being processed
    // The current module is the first one that has records but may not be complete
    let currentModuleIndex = 0
    for (let i = 0; i < modules.length; i++) {
      const restored = restore.records_restored[modules[i]] ?? 0
      if (restored > 0) {
        currentModuleIndex = i
      }
    }

    // If restore is in progress, the current module might be the next one after the last with records
    if (restore.status === 'IN_PROGRESS') {
      let lastWithRecords = -1
      for (let i = modules.length - 1; i >= 0; i--) {
        if ((restore.records_restored[modules[i]] ?? 0) > 0) { lastWithRecords = i; break }
      }
      // Heuristic: if the progress_detail mentions a module, use that
      if (lastWithRecords >= 0) {
        currentModuleIndex = lastWithRecords
      }
    }

    return modules.map((mod, index) => {
      const backupCounts = restore.backup_detail?.record_counts || {}
      return {
        key: mod,
        label: getModuleLabel(mod),
        state: getModuleState(mod, restore, currentModuleIndex, index),
        restored: restore.records_restored[mod] ?? 0,
        total: backupCounts[mod] ?? null,
        skipped: restore.records_skipped[mod] ?? 0,
      }
    })
  }, [restore])

  // Summary stats
  const summaryStats = useMemo(() => {
    if (!restore) return null
    return {
      totalRestored: restore.total_restored,
      totalSkipped: restore.total_skipped,
      totalFailed: restore.total_failed,
      duration: formatDuration(restore.started_at, restore.completed_at),
    }
  }, [restore])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeftIcon className="h-4 w-4" />}
          onClick={() => navigate('/admin/backup')}
        >
          Back to Backups
        </Button>
        <RestoreProgressSkeleton />
      </div>
    )
  }

  if (isError || !restore) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeftIcon className="h-4 w-4" />}
          onClick={() => navigate('/admin/backup')}
        >
          Back to Backups
        </Button>
        <Card>
          <CardContent>
            <div className="flex flex-col items-center py-12 text-center">
              <ExclamationTriangleIcon className="h-12 w-12 text-gray-300 mb-4" />
              <h2 className="text-lg font-semibold text-gray-900">Restore not found</h2>
              <p className="mt-1 text-sm text-gray-500">
                The restore operation you are looking for does not exist or has been removed.
              </p>
              <Link
                to="/admin/backup"
                className="mt-4 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Return to Backup Management
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusCfg = RESTORE_STATUS_CONFIG[restore.status]
  const isActive = ['PENDING', 'PRE_BACKUP', 'IN_PROGRESS'].includes(restore.status)

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<ArrowLeftIcon className="h-4 w-4" />}
        onClick={() => navigate('/admin/backup')}
      >
        Back to Backups
      </Button>

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardContent>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold text-gray-900">
                    Restoring from: {restore.backup_detail?.backup_number || 'Unknown'}
                  </h1>
                  <Badge
                    variant={statusCfg.variant}
                    size="sm"
                    dot={isActive}
                    pulse={isActive}
                  >
                    {statusCfg.label}
                  </Badge>
                </div>
                {restore.backup_detail && (
                  <p className="text-sm text-gray-500 mt-1">
                    {restore.backup_detail.name} -- {formatFileSize(restore.backup_detail.file_size_bytes)}
                  </p>
                )}
              </div>
              <div className="text-right text-xs text-gray-500">
                <div>Restore #{restore.restore_number}</div>
                <div>{restore.restore_type} / {restore.restore_mode}</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <ProgressBar percent={restore.progress_percent} status={restore.status} />
            </div>

            {/* Progress Detail */}
            {restore.progress_detail && (
              <p className="mt-2 text-sm text-gray-600 italic">
                "{restore.progress_detail}"
              </p>
            )}

            {/* Timing Info */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
              {restore.started_at && (
                <div>
                  <span className="font-medium">Started:</span> {formatDateTime(restore.started_at)}
                </div>
              )}
              {restore.completed_at && (
                <div>
                  <span className="font-medium">Completed:</span> {formatDateTime(restore.completed_at)}
                </div>
              )}
              {restore.started_at && (
                <div>
                  <span className="font-medium">Duration:</span> {summaryStats?.duration}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Module Progress */}
        <Card>
          <CardContent>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Module Progress</h2>
            <div className="space-y-2">
              {moduleProgress.length > 0 ? (
                moduleProgress.map((mod) => (
                  <ModuleProgressItem key={mod.key} module={mod} />
                ))
              ) : (
                <div className="py-6 text-center text-sm text-gray-500">
                  {isActive ? 'Preparing restore operation...' : 'No module details available.'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary (when done) */}
        {!isActive && summaryStats && (
          <Card>
            <CardContent>
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Summary</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-md bg-success-50">
                  <div className="text-2xl font-bold text-success-700">
                    {summaryStats.totalRestored.toLocaleString()}
                  </div>
                  <div className="text-xs text-success-600 mt-1">Records Restored</div>
                </div>
                <div className="text-center p-3 rounded-md bg-gray-50">
                  <div className="text-2xl font-bold text-gray-700">
                    {summaryStats.totalSkipped.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Records Skipped</div>
                </div>
                <div className="text-center p-3 rounded-md bg-danger-50">
                  <div className="text-2xl font-bold text-danger-700">
                    {summaryStats.totalFailed.toLocaleString()}
                  </div>
                  <div className="text-xs text-danger-600 mt-1">Records Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message (if failed) */}
        {(restore.status === 'FAILED' || restore.status === 'ROLLED_BACK') && (
          <div className="rounded-md bg-danger-50 border border-danger-200 p-4">
            <div className="flex gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-danger-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-danger-800">
                  {restore.status === 'ROLLED_BACK'
                    ? 'Restore was rolled back'
                    : 'Restore operation failed'}
                </h3>
                <p className="mt-1 text-sm text-danger-700">
                  {restore.progress_detail || 'An unexpected error occurred during the restore process.'}
                </p>
                {restore.status === 'ROLLED_BACK' && (
                  <p className="mt-2 text-xs text-danger-600">
                    All changes have been reverted. Your data is in its original state.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-3 pb-4">
          <Button
            variant="secondary"
            onClick={() => navigate('/admin/backup')}
          >
            Back to Backup Management
          </Button>
        </div>
      </div>
    </div>
  )
}
