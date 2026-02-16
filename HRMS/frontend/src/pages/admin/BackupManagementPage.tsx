import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  CircleStackIcon,
  ClockIcon,
  ServerStackIcon,
  CalendarDaysIcon,
  ArrowDownTrayIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  LockClosedIcon,
  LockOpenIcon,
  TrashIcon,
  PlusIcon,
  PlayIcon,
  PencilIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { Card, CardContent } from '@/components/ui/Card'
import { StatsCard } from '@/components/ui/StatsCard'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonStatsCard, SkeletonTable } from '@/components/ui/Skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { DropdownMenu } from '@/components/ui/Dropdown'
import {
  backupService,
  BACKUP_MODULES,
  BACKUP_STATUS_CONFIG,
  RESTORE_STATUS_CONFIG,
  SCHEDULE_TYPE_LABELS,
  type TenantBackup,
  type BackupSchedule,
  type BackupType,
  type RestoreType,
  type RestoreMode,
  type ScheduleType,
  type VerifyResult,
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

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '--'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFutureTime(dateStr: string | null): string {
  if (!dateStr) return '--'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  if (diffMs < 0) return 'Overdue'
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  if (diffHours < 1) return `In ${diffMins}m`
  if (diffHours < 24) return `In ${diffHours}h ${diffMins}m`
  const diffDays = Math.floor(diffHours / 24)
  return `In ${diffDays}d`
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '--'
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return `${mins}m ${secs}s`
  const hours = Math.floor(mins / 60)
  const remainMins = mins % 60
  return `${hours}h ${remainMins}m`
}

// ==================== Create Backup Modal ====================

function CreateBackupModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [backupType, setBackupType] = useState<BackupType>('FULL')
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [retentionDays, setRetentionDays] = useState(30)

  const createMutation = useMutation({
    mutationFn: () =>
      backupService.createBackup({
        name,
        description,
        backup_type: backupType,
        modules_included: backupType === 'SELECTIVE' ? selectedModules : undefined,
        retention_days: retentionDays,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      handleClose()
    },
  })

  function handleClose() {
    setName('')
    setDescription('')
    setBackupType('FULL')
    setSelectedModules([])
    setRetentionDays(30)
    onClose()
  }

  function toggleModule(mod: string) {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Backup" size="lg">
      <div className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Backup Name</label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:outline-none hover:border-gray-400"
            placeholder="e.g., Monthly Full Backup"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea
            className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:outline-none hover:border-gray-400 resize-y"
            rows={2}
            placeholder="Optional description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Backup Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Backup Type</label>
          <div className="flex gap-4">
            {(['FULL', 'SELECTIVE'] as const).map((type) => (
              <label
                key={type}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-md border cursor-pointer transition-colors ${
                  backupType === type
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="backupType"
                  value={type}
                  checked={backupType === type}
                  onChange={() => setBackupType(type)}
                  className="text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                />
                <div>
                  <span className="text-sm font-medium">{type === 'FULL' ? 'Full Backup' : 'Selective Backup'}</span>
                  <p className="text-xs text-gray-500">
                    {type === 'FULL' ? 'All modules and data' : 'Choose specific modules'}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Module Selection (Selective only) */}
        {backupType === 'SELECTIVE' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Modules</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BACKUP_MODULES.map((mod) => (
                <label
                  key={mod.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm transition-colors ${
                    selectedModules.includes(mod.value)
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedModules.includes(mod.value)}
                    onChange={() => toggleModule(mod.value)}
                    className="rounded text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                  />
                  {mod.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Retention Days */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Retention Period (days)</label>
          <input
            type="number"
            className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:outline-none hover:border-gray-400"
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            min={1}
            max={365}
          />
          <p className="mt-1 text-xs text-gray-500">
            Backup will automatically expire after {retentionDays} day{retentionDays !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Error */}
        {createMutation.isError && (
          <div className="rounded-md bg-danger-50 border border-danger-200 p-3">
            <p className="text-sm text-danger-700">
              {(createMutation.error as any)?.response?.data?.detail || 'Failed to create backup. Please try again.'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => createMutation.mutate()}
            isLoading={createMutation.isPending}
            disabled={!name.trim() || (backupType === 'SELECTIVE' && selectedModules.length === 0)}
          >
            Create Backup
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ==================== Restore Modal ====================

function RestoreModal({
  isOpen,
  onClose,
  backup,
}: {
  isOpen: boolean
  onClose: () => void
  backup: TenantBackup | null
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [restoreType, setRestoreType] = useState<RestoreType>('FULL')
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('SKIP_EXISTING')
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [confirmText, setConfirmText] = useState('')

  const restoreMutation = useMutation({
    mutationFn: () => {
      if (!backup) throw new Error('No backup selected')
      return backupService.initiateRestore(backup.id, {
        restore_type: restoreType,
        modules_restored: restoreType === 'SELECTIVE' ? selectedModules : undefined,
        restore_mode: restoreMode,
      })
    },
    onSuccess: (restore) => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      queryClient.invalidateQueries({ queryKey: ['restores'] })
      handleClose()
      navigate(`/admin/backup/restore/${restore.id}`)
    },
  })

  function handleClose() {
    setRestoreType('FULL')
    setRestoreMode('SKIP_EXISTING')
    setSelectedModules([])
    setConfirmText('')
    onClose()
  }

  function toggleModule(mod: string) {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    )
  }

  if (!backup) return null

  const isOverwrite = restoreMode === 'OVERWRITE'
  const canRestore = isOverwrite ? confirmText === 'RESTORE' : true

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Restore from Backup" size="lg">
      <div className="space-y-5">
        {/* Backup Info */}
        <div className="rounded-md bg-gray-50 border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <CircleStackIcon className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">{backup.name}</p>
              <p className="text-xs text-gray-500">
                {backup.backup_number} -- {formatDateTime(backup.completed_at)} -- {formatFileSize(backup.file_size_bytes)}
              </p>
            </div>
          </div>
        </div>

        {/* Restore Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Restore Type</label>
          <div className="flex gap-4">
            {(['FULL', 'SELECTIVE'] as const).map((type) => (
              <label
                key={type}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-md border cursor-pointer transition-colors ${
                  restoreType === type
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="restoreType"
                  value={type}
                  checked={restoreType === type}
                  onChange={() => setRestoreType(type)}
                  className="text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                />
                <span className="text-sm font-medium">{type === 'FULL' ? 'Full Restore' : 'Selective Restore'}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Module Selection (Selective only) */}
        {restoreType === 'SELECTIVE' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Modules to Restore</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {backup.modules_included.map((mod) => (
                <label
                  key={mod}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm transition-colors ${
                    selectedModules.includes(mod)
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedModules.includes(mod)}
                    onChange={() => toggleModule(mod)}
                    className="rounded text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                  />
                  {BACKUP_MODULES.find((m) => m.value === mod)?.label || mod}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Restore Mode */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Restore Mode</label>
          <div className="space-y-2">
            {([
              { value: 'SKIP_EXISTING' as RestoreMode, label: 'Skip Existing', desc: 'Only restore records that do not already exist' },
              { value: 'MERGE' as RestoreMode, label: 'Merge', desc: 'Update existing records and add new ones' },
              { value: 'OVERWRITE' as RestoreMode, label: 'Overwrite', desc: 'Replace all data with backup data (destructive)' },
            ]).map((mode) => (
              <label
                key={mode.value}
                className={`flex items-start gap-3 px-4 py-3 rounded-md border cursor-pointer transition-colors ${
                  restoreMode === mode.value
                    ? mode.value === 'OVERWRITE'
                      ? 'border-danger-500 bg-danger-50'
                      : 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="restoreMode"
                  value={mode.value}
                  checked={restoreMode === mode.value}
                  onChange={() => setRestoreMode(mode.value)}
                  className={`mt-0.5 ${mode.value === 'OVERWRITE' ? 'text-danger-600 focus:ring-1 focus:ring-danger-500' : 'text-primary-600 focus:ring-1 focus:ring-[#0969da]'}`}
                />
                <div>
                  <span className={`text-sm font-medium ${mode.value === 'OVERWRITE' ? 'text-danger-700' : ''}`}>
                    {mode.label}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">{mode.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Overwrite Warning */}
        {isOverwrite && (
          <div className="rounded-md bg-danger-50 border border-danger-200 p-4 space-y-3">
            <div className="flex gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-danger-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-danger-700">
                  Destructive Operation Warning
                </p>
                <p className="text-xs text-danger-600 mt-1">
                  Overwrite mode will permanently replace all existing data with the backup data.
                  A safety backup will be created automatically before the restore begins.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-danger-700 mb-1">
                Type RESTORE to confirm
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-danger-300 px-3 py-2 text-sm focus:ring-1 focus:ring-danger-500 focus:border-danger-500 focus:outline-none bg-white"
                placeholder="RESTORE"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {restoreMutation.isError && (
          <div className="rounded-md bg-danger-50 border border-danger-200 p-3">
            <p className="text-sm text-danger-700">
              {(restoreMutation.error as any)?.response?.data?.detail || 'Failed to initiate restore. Please try again.'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant={isOverwrite ? 'danger' : 'primary'}
            onClick={() => restoreMutation.mutate()}
            isLoading={restoreMutation.isPending}
            disabled={!canRestore || (restoreType === 'SELECTIVE' && selectedModules.length === 0)}
          >
            {isOverwrite ? 'Overwrite & Restore' : 'Start Restore'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ==================== Verify Modal ====================

function VerifyModal({
  isOpen,
  onClose,
  backup,
}: {
  isOpen: boolean
  onClose: () => void
  backup: TenantBackup | null
}) {
  const verifyMutation = useMutation({
    mutationFn: () => {
      if (!backup) throw new Error('No backup selected')
      return backupService.verifyBackup(backup.id)
    },
  })

  const result = verifyMutation.data as VerifyResult | undefined

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Verify Backup Integrity" size="md">
      <div className="space-y-4">
        {/* Backup Info */}
        {backup && (
          <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
            <p className="text-sm font-medium text-gray-900">{backup.name}</p>
            <p className="text-xs text-gray-500">{backup.backup_number}</p>
          </div>
        )}

        {/* Verify Button */}
        {!verifyMutation.isSuccess && !verifyMutation.isPending && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 mb-4">
              Run an integrity check to verify the backup file is complete and not corrupted.
            </p>
            <Button
              variant="primary"
              onClick={() => verifyMutation.mutate()}
              leftIcon={<ShieldCheckIcon className="h-4 w-4" />}
            >
              Run Verification
            </Button>
          </div>
        )}

        {/* Loading */}
        {verifyMutation.isPending && (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
            <p className="text-sm text-gray-600">Verifying backup integrity...</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-3">
            <div className={`flex items-center gap-2 p-3 rounded-md ${result.is_valid ? 'bg-success-50 border border-success-200' : 'bg-danger-50 border border-danger-200'}`}>
              {result.is_valid ? (
                <CheckCircleIcon className="h-5 w-5 text-success-600" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-danger-600" />
              )}
              <span className={`text-sm font-medium ${result.is_valid ? 'text-success-700' : 'text-danger-700'}`}>
                {result.is_valid ? 'Backup verification passed' : 'Backup verification failed'}
              </span>
            </div>

            {result.checks && result.checks.length > 0 && (
              <div className="space-y-1">
                {result.checks.map((check, index) => (
                  <div key={index} className="flex items-start gap-2 py-1.5 px-2 text-sm">
                    {check.passed ? (
                      <CheckCircleIcon className="h-4 w-4 text-success-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircleIcon className="h-4 w-4 text-danger-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-medium text-gray-700">{check.name}</span>
                      <p className="text-xs text-gray-500">{check.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {verifyMutation.isError && (
          <div className="rounded-md bg-danger-50 border border-danger-200 p-3">
            <p className="text-sm text-danger-700">
              {(verifyMutation.error as any)?.response?.data?.detail || 'Verification failed. Please try again.'}
            </p>
          </div>
        )}

        {/* Close */}
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ==================== Schedule Modal ====================

function ScheduleModal({
  isOpen,
  onClose,
  schedule,
}: {
  isOpen: boolean
  onClose: () => void
  schedule: BackupSchedule | null
}) {
  const queryClient = useQueryClient()
  const isEdit = !!schedule

  const [name, setName] = useState(schedule?.name || '')
  const [scheduleType, setScheduleType] = useState<ScheduleType>(schedule?.schedule_type || 'DAILY')
  const [backupType, setBackupType] = useState<'FULL' | 'SELECTIVE'>(schedule?.backup_type || 'FULL')
  const [selectedModules, setSelectedModules] = useState<string[]>(schedule?.modules_included || [])
  const [retentionDays, setRetentionDays] = useState(schedule?.retention_days || 30)
  const [maxBackups, setMaxBackups] = useState(schedule?.max_backups || 10)
  const [timeHour, setTimeHour] = useState(schedule?.schedule_config?.hour ?? 2)
  const [timeMinute, setTimeMinute] = useState(schedule?.schedule_config?.minute ?? 0)
  const [dayOfWeek, setDayOfWeek] = useState(schedule?.schedule_config?.day_of_week ?? 0)
  const [dayOfMonth, setDayOfMonth] = useState(schedule?.schedule_config?.day_of_month ?? 1)
  const [isActive, setIsActive] = useState(schedule?.is_active ?? true)

  const createMutation = useMutation({
    mutationFn: () => {
      const config: Record<string, any> = { hour: timeHour, minute: timeMinute }
      if (scheduleType === 'WEEKLY') config.day_of_week = dayOfWeek
      if (scheduleType === 'MONTHLY') config.day_of_month = dayOfMonth

      const data = {
        name,
        schedule_type: scheduleType,
        schedule_config: config,
        backup_type: backupType,
        modules_included: backupType === 'SELECTIVE' ? selectedModules : undefined,
        retention_days: retentionDays,
        max_backups: maxBackups,
        is_active: isActive,
      }

      if (isEdit && schedule) {
        return backupService.updateSchedule(schedule.id, data)
      }
      return backupService.createSchedule(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-schedules'] })
      onClose()
    },
  })

  function toggleModule(mod: string) {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    )
  }

  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Schedule' : 'Create Backup Schedule'} size="lg">
      <div className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Schedule Name</label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:outline-none hover:border-gray-400"
            placeholder="e.g., Nightly Full Backup"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Schedule Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
          <div className="flex gap-3">
            {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((type) => (
              <label
                key={type}
                className={`flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer text-sm transition-colors ${
                  scheduleType === type
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="scheduleType"
                  value={type}
                  checked={scheduleType === type}
                  onChange={() => setScheduleType(type)}
                  className="text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                />
                {SCHEDULE_TYPE_LABELS[type]}
              </label>
            ))}
          </div>
        </div>

        {/* Time Configuration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Hour</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:outline-none hover:border-gray-400"
              value={timeHour}
              onChange={(e) => setTimeHour(Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Minute</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:outline-none hover:border-gray-400"
              value={timeMinute}
              onChange={(e) => setTimeMinute(Number(e.target.value))}
            >
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>
                  :{String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Day of Week (Weekly) */}
        {scheduleType === 'WEEKLY' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Day of Week</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:outline-none hover:border-gray-400"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
            >
              {weekDays.map((day, i) => (
                <option key={i} value={i}>
                  {day}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Day of Month (Monthly) */}
        {scheduleType === 'MONTHLY' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Day of Month</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:outline-none hover:border-gray-400"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Number(e.target.value))}
            >
              {Array.from({ length: 28 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Backup Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Backup Type</label>
          <div className="flex gap-4">
            {(['FULL', 'SELECTIVE'] as const).map((type) => (
              <label
                key={type}
                className={`flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer text-sm transition-colors ${
                  backupType === type
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="schedBackupType"
                  value={type}
                  checked={backupType === type}
                  onChange={() => setBackupType(type)}
                  className="text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                />
                {type === 'FULL' ? 'Full' : 'Selective'}
              </label>
            ))}
          </div>
        </div>

        {/* Module Selection */}
        {backupType === 'SELECTIVE' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Modules</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BACKUP_MODULES.map((mod) => (
                <label
                  key={mod.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm transition-colors ${
                    selectedModules.includes(mod.value)
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedModules.includes(mod.value)}
                    onChange={() => toggleModule(mod.value)}
                    className="rounded text-primary-600 focus:ring-1 focus:ring-[#0969da]"
                  />
                  {mod.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Retention & Max */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Retention (days)</label>
            <input
              type="number"
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:outline-none hover:border-gray-400"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              min={1}
              max={365}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Backups</label>
            <input
              type="number"
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:outline-none hover:border-gray-400"
              value={maxBackups}
              onChange={(e) => setMaxBackups(Number(e.target.value))}
              min={1}
              max={100}
            />
          </div>
        </div>

        {/* Active Toggle */}
        <div className="flex items-center justify-between px-4 py-3 rounded-md bg-gray-50 border border-gray-200">
          <div>
            <p className="text-sm font-medium text-gray-700">Active</p>
            <p className="text-xs text-gray-500">Enable or disable this schedule</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:ring-offset-2 ${
              isActive ? 'bg-primary-600' : 'bg-gray-200'
            }`}
            onClick={() => setIsActive(!isActive)}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isActive ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Error */}
        {createMutation.isError && (
          <div className="rounded-md bg-danger-50 border border-danger-200 p-3">
            <p className="text-sm text-danger-700">
              {(createMutation.error as any)?.response?.data?.detail || 'Failed to save schedule. Please try again.'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => createMutation.mutate()}
            isLoading={createMutation.isPending}
            disabled={!name.trim() || (backupType === 'SELECTIVE' && selectedModules.length === 0)}
          >
            {isEdit ? 'Update Schedule' : 'Create Schedule'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ==================== Backups Tab ====================

function BackupsTab() {
  const queryClient = useQueryClient()
  const [restoreBackup, setRestoreBackup] = useState<TenantBackup | null>(null)
  const [verifyBackup, setVerifyBackup] = useState<TenantBackup | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: () => backupService.listBackups(),
  })

  const backups = data?.results ?? []

  const lockMutation = useMutation({
    mutationFn: (backup: TenantBackup) =>
      backup.is_locked ? backupService.unlockBackup(backup.id) : backupService.lockBackup(backup.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => backupService.deleteBackup(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
  })

  async function handleDownload(backup: TenantBackup) {
    try {
      const blob = await backupService.downloadBackup(backup.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${backup.backup_number}.${backup.file_format || 'json'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // Error handled silently - download failures are visible to user
    }
  }

  function getRowActions(backup: TenantBackup) {
    const items = []

    if (backup.status === 'COMPLETED') {
      items.push({
        label: 'Download',
        icon: <ArrowDownTrayIcon className="h-4 w-4" />,
        onClick: () => handleDownload(backup),
      })
      items.push({
        label: 'Verify Integrity',
        icon: <ShieldCheckIcon className="h-4 w-4" />,
        onClick: () => setVerifyBackup(backup),
      })
      items.push({
        label: 'Restore from Backup',
        icon: <ArrowPathIcon className="h-4 w-4" />,
        onClick: () => setRestoreBackup(backup),
      })
      items.push({ label: '', divider: true })
      items.push({
        label: backup.is_locked ? 'Unlock' : 'Lock',
        icon: backup.is_locked ? <LockOpenIcon className="h-4 w-4" /> : <LockClosedIcon className="h-4 w-4" />,
        onClick: () => lockMutation.mutate(backup),
      })
    }

    if (!backup.is_locked && backup.status !== 'IN_PROGRESS') {
      items.push({
        label: 'Delete',
        icon: <TrashIcon className="h-4 w-4" />,
        danger: true,
        onClick: () => {
          if (window.confirm(`Are you sure you want to delete backup "${backup.name}"?`)) {
            deleteMutation.mutate(backup.id)
          }
        },
      })
    }

    return items
  }

  if (isLoading) {
    return <SkeletonTable rows={5} columns={7} />
  }

  if (backups.length === 0) {
    return (
      <Card>
        <EmptyState
          type="data"
          title="No backups yet"
          description="Create your first backup to protect your organization's data."
        />
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3">Backup #</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Size</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {backups.map((backup) => {
                  const statusCfg = BACKUP_STATUS_CONFIG[backup.status]
                  return (
                    <tr key={backup.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          {backup.is_locked && (
                            <LockClosedIcon className="h-3.5 w-3.5 text-warning-500" title="Locked" />
                          )}
                          <span className="font-mono text-xs text-gray-600">{backup.backup_number}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{backup.name}</p>
                          {backup.description && (
                            <p className="text-xs text-gray-500 truncate max-w-xs">{backup.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant="default" size="xs">
                          {backup.backup_type}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-gray-600">
                        {formatFileSize(backup.file_size_bytes)}
                      </td>
                      <td className="px-6 py-3">
                        <Badge
                          variant={statusCfg.variant}
                          size="xs"
                          dot={backup.status === 'IN_PROGRESS'}
                          pulse={backup.status === 'IN_PROGRESS'}
                        >
                          <span className={backup.status === 'EXPIRED' ? 'line-through' : ''}>
                            {statusCfg.label}
                          </span>
                        </Badge>
                        {backup.status === 'IN_PROGRESS' && (
                          <span className="ml-2 text-xs text-gray-500">{backup.progress_percent}%</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-500 whitespace-nowrap">
                        <div>{formatRelativeTime(backup.completed_at || backup.created_at)}</div>
                        {backup.duration_seconds && (
                          <div className="text-gray-400">Duration: {formatDuration(backup.duration_seconds)}</div>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {getRowActions(backup).length > 0 && (
                          <DropdownMenu items={getRowActions(backup)} />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <RestoreModal
        isOpen={!!restoreBackup}
        onClose={() => setRestoreBackup(null)}
        backup={restoreBackup}
      />
      <VerifyModal
        isOpen={!!verifyBackup}
        onClose={() => setVerifyBackup(null)}
        backup={verifyBackup}
      />
    </>
  )
}

// ==================== Restore History Tab ====================

function RestoreHistoryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['restores'],
    queryFn: () => backupService.listRestores(),
  })

  const restores = data?.results ?? []

  if (isLoading) {
    return <SkeletonTable rows={5} columns={6} />
  }

  if (restores.length === 0) {
    return (
      <Card>
        <EmptyState
          type="data"
          title="No restore history"
          description="Restore operations will appear here once you restore data from a backup."
        />
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3">Restore #</th>
                <th className="px-6 py-3">Backup</th>
                <th className="px-6 py-3">Type / Mode</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Records</th>
                <th className="px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {restores.map((restore) => {
                const statusCfg = RESTORE_STATUS_CONFIG[restore.status]
                return (
                  <tr key={restore.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-mono text-xs text-gray-600">
                      {restore.restore_number}
                    </td>
                    <td className="px-6 py-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {restore.backup_detail?.name || '--'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {restore.backup_detail?.backup_number || restore.backup}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-1">
                        <Badge variant="default" size="xs">{restore.restore_type}</Badge>
                        <span className="text-xs text-gray-500">{restore.restore_mode}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <Badge
                        variant={statusCfg.variant}
                        size="xs"
                        dot={restore.status === 'IN_PROGRESS' || restore.status === 'PRE_BACKUP'}
                        pulse={restore.status === 'IN_PROGRESS' || restore.status === 'PRE_BACKUP'}
                      >
                        {statusCfg.label}
                      </Badge>
                      {(restore.status === 'IN_PROGRESS' || restore.status === 'PRE_BACKUP') && (
                        <span className="ml-2 text-xs text-gray-500">{restore.progress_percent}%</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-600">
                      <div>Restored: {restore.total_restored.toLocaleString()}</div>
                      {restore.total_skipped > 0 && (
                        <div className="text-gray-400">Skipped: {restore.total_skipped.toLocaleString()}</div>
                      )}
                      {restore.total_failed > 0 && (
                        <div className="text-danger-500">Failed: {restore.total_failed.toLocaleString()}</div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatRelativeTime(restore.completed_at || restore.started_at || restore.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== Schedules Tab ====================

function SchedulesTab() {
  const queryClient = useQueryClient()
  const [scheduleModal, setScheduleModal] = useState<{ open: boolean; schedule: BackupSchedule | null }>({
    open: false,
    schedule: null,
  })

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['backup-schedules'],
    queryFn: () => backupService.listSchedules(),
  })

  const toggleMutation = useMutation({
    mutationFn: (schedule: BackupSchedule) =>
      backupService.updateSchedule(schedule.id, { is_active: !schedule.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backup-schedules'] }),
  })

  const runNowMutation = useMutation({
    mutationFn: (id: string) => backupService.runScheduleNow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      queryClient.invalidateQueries({ queryKey: ['backup-schedules'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => backupService.deleteSchedule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backup-schedules'] }),
  })

  function getScheduleDescription(schedule: BackupSchedule): string {
    const config = schedule.schedule_config || {}
    const time = `${String(config.hour ?? 0).padStart(2, '0')}:${String(config.minute ?? 0).padStart(2, '0')}`
    const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    switch (schedule.schedule_type) {
      case 'DAILY':
        return `Every day at ${time}`
      case 'WEEKLY':
        return `Every ${weekDays[config.day_of_week ?? 0]} at ${time}`
      case 'MONTHLY':
        return `Day ${config.day_of_month ?? 1} of every month at ${time}`
      default:
        return schedule.schedule_type
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonStatsCard key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="primary"
          size="sm"
          leftIcon={<PlusIcon className="h-4 w-4" />}
          onClick={() => setScheduleModal({ open: true, schedule: null })}
        >
          Create Schedule
        </Button>
      </div>

      {schedules.length === 0 ? (
        <Card>
          <EmptyState
            type="data"
            title="No backup schedules"
            description="Create an automated backup schedule to keep your data safe."
            action={{
              label: 'Create Schedule',
              onClick: () => setScheduleModal({ open: true, schedule: null }),
            }}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schedules.map((schedule) => (
            <Card key={schedule.id} className="relative">
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-md ${schedule.is_active ? 'bg-primary-100' : 'bg-gray-100'}`}>
                      <CalendarDaysIcon className={`h-5 w-5 ${schedule.is_active ? 'text-primary-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{schedule.name}</h3>
                      <p className="text-xs text-gray-500">{getScheduleDescription(schedule)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Active Toggle */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={schedule.is_active}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:ring-offset-2 ${
                        schedule.is_active ? 'bg-primary-600' : 'bg-gray-200'
                      }`}
                      onClick={() => toggleMutation.mutate(schedule)}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          schedule.is_active ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>

                    <DropdownMenu
                      items={[
                        {
                          label: 'Edit',
                          icon: <PencilIcon className="h-4 w-4" />,
                          onClick: () => setScheduleModal({ open: true, schedule }),
                        },
                        {
                          label: 'Run Now',
                          icon: <PlayIcon className="h-4 w-4" />,
                          onClick: () => runNowMutation.mutate(schedule.id),
                        },
                        { label: '', divider: true },
                        {
                          label: 'Delete',
                          icon: <TrashIcon className="h-4 w-4" />,
                          danger: true,
                          onClick: () => {
                            if (window.confirm(`Delete schedule "${schedule.name}"?`)) {
                              deleteMutation.mutate(schedule.id)
                            }
                          },
                        },
                      ]}
                    />
                  </div>
                </div>

                {/* Details */}
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <span className="ml-1 font-medium text-gray-700">{schedule.backup_type}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Retention:</span>
                    <span className="ml-1 font-medium text-gray-700">{schedule.retention_days}d</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Last Run:</span>
                    <span className="ml-1 font-medium text-gray-700">
                      {formatRelativeTime(schedule.last_run_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Next Run:</span>
                    <span className="ml-1 font-medium text-gray-700">
                      {schedule.is_active ? formatFutureTime(schedule.next_run_at) : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Last Status */}
                {schedule.last_status && (
                  <div className="mt-3">
                    <Badge
                      variant={
                        schedule.last_status === 'COMPLETED'
                          ? 'success'
                          : schedule.last_status === 'FAILED'
                          ? 'danger'
                          : 'default'
                      }
                      size="xs"
                    >
                      Last: {schedule.last_status}
                    </Badge>
                  </div>
                )}

                {/* Modules */}
                {schedule.modules_included && schedule.modules_included.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {schedule.modules_included.map((mod) => (
                      <span
                        key={mod}
                        className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600"
                      >
                        {BACKUP_MODULES.find((m) => m.value === mod)?.label || mod}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ScheduleModal
        isOpen={scheduleModal.open}
        onClose={() => setScheduleModal({ open: false, schedule: null })}
        schedule={scheduleModal.schedule}
      />
    </div>
  )
}

// ==================== Main Page ====================

export default function BackupManagementPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: backupsData, isLoading: backupsLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: () => backupService.listBackups(),
  })

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['backup-schedules'],
    queryFn: () => backupService.listSchedules(),
  })

  const backups = backupsData?.results ?? []

  // Compute stats
  const stats = useMemo(() => {
    const totalBackups = backupsData?.count ?? backups.length
    const totalSize = backups.reduce((sum, b) => sum + (b.file_size_bytes ?? 0), 0)
    const completedBackups = backups.filter((b) => b.status === 'COMPLETED')
    const lastBackup = completedBackups.length > 0
      ? completedBackups.sort((a, b) =>
          new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime()
        )[0]
      : null

    const activeSchedules = schedules.filter((s) => s.is_active)
    const nextScheduled = activeSchedules
      .filter((s) => s.next_run_at)
      .sort((a, b) => new Date(a.next_run_at!).getTime() - new Date(b.next_run_at!).getTime())[0]

    return { totalBackups, totalSize, lastBackup, nextScheduled }
  }, [backups, backupsData, schedules])

  const isStatsLoading = backupsLoading || schedulesLoading

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Backup & Restore</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage data backups, restore operations, and automated schedules
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<PlusIcon className="h-4 w-4" />}
          onClick={() => setShowCreateModal(true)}
        >
          Create Backup
        </Button>
      </div>

      {/* Quick Stats */}
      {isStatsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStatsCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Backups"
            value={stats.totalBackups}
            icon={<CircleStackIcon className="h-5 w-5" />}
            variant="primary"
          />
          <StatsCard
            title="Last Backup"
            value={formatRelativeTime(stats.lastBackup?.completed_at || null)}
            icon={<ClockIcon className="h-5 w-5" />}
            variant="info"
          />
          <StatsCard
            title="Total Size"
            value={formatFileSize(stats.totalSize)}
            icon={<ServerStackIcon className="h-5 w-5" />}
            variant="default"
          />
          <StatsCard
            title="Next Scheduled"
            value={stats.nextScheduled ? formatFutureTime(stats.nextScheduled.next_run_at) : 'None'}
            icon={<CalendarDaysIcon className="h-5 w-5" />}
            variant="success"
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="backups">
        <TabsList>
          <TabsTrigger
            value="backups"
            icon={<CircleStackIcon className="h-4 w-4" />}
          >
            Backups
          </TabsTrigger>
          <TabsTrigger
            value="restores"
            icon={<ArrowPathIcon className="h-4 w-4" />}
          >
            Restore History
          </TabsTrigger>
          <TabsTrigger
            value="schedules"
            icon={<CalendarDaysIcon className="h-4 w-4" />}
          >
            Schedules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backups">
          <BackupsTab />
        </TabsContent>

        <TabsContent value="restores">
          <RestoreHistoryTab />
        </TabsContent>

        <TabsContent value="schedules">
          <SchedulesTab />
        </TabsContent>
      </Tabs>

      {/* Create Backup Modal */}
      <CreateBackupModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  )
}
