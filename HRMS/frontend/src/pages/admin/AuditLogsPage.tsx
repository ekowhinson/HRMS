import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ShieldCheckIcon,
  FunnelIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { TablePagination } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { userService, type AuthenticationLog } from '@/services/users'
import { auditService, type AuditLogEntry, type AuditLogParams } from '@/services/audit'

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// ==================== Action badge config ====================

const actionBadgeConfig: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info' | 'default' }> = {
  CREATE: { variant: 'success' },
  UPDATE: { variant: 'info' },
  DELETE: { variant: 'danger' },
}

const eventTypeConfig: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info' | 'default'; icon: typeof CheckCircleIcon }> = {
  LOGIN_SUCCESS: { variant: 'success', icon: CheckCircleIcon },
  LOGIN_FAILED: { variant: 'danger', icon: XCircleIcon },
  LOGOUT: { variant: 'default', icon: CheckCircleIcon },
  PASSWORD_CHANGED: { variant: 'info', icon: ShieldCheckIcon },
  PASSWORD_RESET: { variant: 'warning', icon: ExclamationTriangleIcon },
  ACCOUNT_LOCKED: { variant: 'danger', icon: XCircleIcon },
  ACCOUNT_UNLOCKED: { variant: 'success', icon: CheckCircleIcon },
  TOKEN_REFRESH: { variant: 'default', icon: CheckCircleIcon },
  TWO_FACTOR_SETUP: { variant: 'info', icon: ShieldCheckIcon },
  TWO_FACTOR_VERIFIED: { variant: 'success', icon: ShieldCheckIcon },
  TWO_FACTOR_FAILED: { variant: 'danger', icon: XCircleIcon },
}

// ==================== Changes Diff Component (mini-table) ====================

function ChangesDiff({ changes }: { changes: Record<string, { old: unknown; new: unknown }> }) {
  return (
    <table className="text-xs w-full">
      <thead>
        <tr className="text-left text-gray-500">
          <th className="py-1 pr-4 font-medium">Field</th>
          <th className="py-1 pr-4 font-medium">Old Value</th>
          <th className="py-1 font-medium">New Value</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(changes).map(([field, diff]) => (
          <tr key={field} className="border-t border-gray-100">
            <td className="py-1 pr-4 font-medium text-gray-700">{field}</td>
            <td className="py-1 pr-4 text-red-600 line-through">{String(diff.old ?? '—')}</td>
            <td className="py-1 text-green-600">{String(diff.new ?? '—')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ==================== Values Summary Component ====================

function ValuesSummary({ values, label }: { values: Record<string, unknown>; label: string }) {
  return (
    <div className="text-xs">
      <span className="font-medium text-gray-500">{label}:</span>
      <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
        {Object.entries(values).map(([field, value]) => (
          <div key={field} className="flex gap-1">
            <span className="font-medium text-gray-700">{field}:</span>
            <span className="text-gray-600 truncate">{String(value ?? '—')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ==================== Activity Logs Tab ====================

function ActivityLogsTab() {
  const [filters, setFilters] = useState<AuditLogParams>({ page: 1 })
  const [showFilters, setShowFilters] = useState(false)
  const pageSize = 20

  const { data: modelNames = [] } = useQuery({
    queryKey: ['audit-model-names'],
    queryFn: () => auditService.getModelNames(),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => auditService.getAuditLogs(filters),
  })

  const logs = data?.results ?? []
  const totalItems = data?.count ?? 0
  const totalPages = Math.ceil(totalItems / pageSize)

  return (
    <div className="space-y-4">
      {/* Filters toggle */}
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          leftIcon={<FunnelIcon className="h-4 w-4" />}
        >
          Filters
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                <select
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
                  value={filters.action || ''}
                  onChange={(e) =>
                    setFilters({ ...filters, action: e.target.value || undefined, page: 1 })
                  }
                >
                  <option value="">All Actions</option>
                  <option value="CREATE">Create</option>
                  <option value="UPDATE">Update</option>
                  <option value="DELETE">Delete</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Module</label>
                <select
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
                  value={filters.model_name || ''}
                  onChange={(e) =>
                    setFilters({ ...filters, model_name: e.target.value || undefined, page: 1 })
                  }
                >
                  <option value="">All Modules</option>
                  {modelNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  placeholder="Search records..."
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
                  value={filters.search || ''}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value || undefined, page: 1 })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
                  value={filters.timestamp__gte || ''}
                  onChange={(e) =>
                    setFilters({ ...filters, timestamp__gte: e.target.value || undefined, page: 1 })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
                  value={filters.timestamp__lte || ''}
                  onChange={(e) =>
                    setFilters({ ...filters, timestamp__lte: e.target.value || undefined, page: 1 })
                  }
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ page: 1 })}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ClipboardDocumentListIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Activity Logs</h2>
              <p className="text-sm text-gray-500">
                {totalItems} event{totalItems !== 1 ? 's' : ''} found
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-gray-500">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <InformationCircleIcon className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No activity log entries found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3">Timestamp</th>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Action</th>
                    <th className="px-6 py-3">Module</th>
                    <th className="px-6 py-3">Record</th>
                    <th className="px-6 py-3 hidden lg:table-cell">IP Address</th>
                    <th className="px-6 py-3 hidden xl:table-cell">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log: AuditLogEntry) => {
                    const config = actionBadgeConfig[log.action] || { variant: 'default' as const }
                    const hasUpdateChanges = log.action === 'UPDATE' && log.changes && Object.keys(log.changes).length > 0
                    const hasNewValues = log.action === 'CREATE' && log.new_values && Object.keys(log.new_values).length > 0
                    const hasOldValues = log.action === 'DELETE' && log.old_values && Object.keys(log.old_values).length > 0
                    const hasChangeData = hasUpdateChanges || hasNewValues || hasOldValues

                    return (
                      <Fragment key={log.id}>
                        <tr className={`hover:bg-gray-50 ${hasChangeData ? 'border-b-0' : ''}`}>
                          <td className="px-6 py-3 text-xs text-gray-600 whitespace-nowrap">
                            {formatDateTime(log.timestamp)}
                          </td>
                          <td className="px-6 py-3 text-gray-900 font-medium">
                            {log.user_name || log.user_email || 'System'}
                          </td>
                          <td className="px-6 py-3">
                            <Badge variant={config.variant} size="xs">
                              {log.action}
                            </Badge>
                          </td>
                          <td className="px-6 py-3 text-gray-700">
                            {log.model_name}
                          </td>
                          <td className="px-6 py-3 text-gray-500 max-w-xs truncate">
                            {log.object_repr || log.object_id || '—'}
                          </td>
                          <td className="px-6 py-3 text-gray-600 font-mono text-xs hidden lg:table-cell">
                            {log.ip_address || '—'}
                          </td>
                          <td className="px-6 py-3 text-xs text-gray-400 hidden xl:table-cell max-w-xs truncate">
                            {log.user_agent
                              ? log.user_agent.substring(0, 60) +
                                (log.user_agent.length > 60 ? '...' : '')
                              : '—'}
                          </td>
                        </tr>
                        {hasChangeData && (
                          <tr className="bg-gray-50/50">
                            <td colSpan={7} className="px-6 pb-3 pt-0">
                              <div className="rounded-lg border border-gray-200 bg-white p-3">
                                {hasUpdateChanges && <ChangesDiff changes={log.changes!} />}
                                {hasNewValues && <ValuesSummary values={log.new_values!} label="New values" />}
                                {hasOldValues && <ValuesSummary values={log.old_values!} label="Previous values" />}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalItems > 0 && (
        <TablePagination
          currentPage={filters.page || 1}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={(page) => setFilters({ ...filters, page })}
        />
      )}
    </div>
  )
}

// ==================== Security Logs Tab ====================

function SecurityLogsTab() {
  const [filters, setFilters] = useState<{
    event_type?: string
    start_date?: string
    end_date?: string
    page: number
  }>({ page: 1 })
  const [showFilters, setShowFilters] = useState(false)
  const pageSize = 20

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['auth-logs', filters],
    queryFn: () => userService.getAuthLogs(filters),
  })

  return (
    <div className="space-y-4">
      {/* Filters toggle */}
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          leftIcon={<FunnelIcon className="h-4 w-4" />}
        >
          Filters
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Type
                </label>
                <select
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
                  value={filters.event_type || ''}
                  onChange={(e) =>
                    setFilters({ ...filters, event_type: e.target.value || undefined, page: 1 })
                  }
                >
                  <option value="">All Events</option>
                  <option value="LOGIN_SUCCESS">Login Success</option>
                  <option value="LOGIN_FAILED">Login Failed</option>
                  <option value="LOGOUT">Logout</option>
                  <option value="PASSWORD_CHANGED">Password Changed</option>
                  <option value="PASSWORD_RESET">Password Reset</option>
                  <option value="ACCOUNT_LOCKED">Account Locked</option>
                  <option value="ACCOUNT_UNLOCKED">Account Unlocked</option>
                  <option value="TWO_FACTOR_SETUP">2FA Setup</option>
                  <option value="TWO_FACTOR_VERIFIED">2FA Verified</option>
                  <option value="TWO_FACTOR_FAILED">2FA Failed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
                  value={filters.start_date || ''}
                  onChange={(e) =>
                    setFilters({ ...filters, start_date: e.target.value || undefined, page: 1 })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
                  value={filters.end_date || ''}
                  onChange={(e) =>
                    setFilters({ ...filters, end_date: e.target.value || undefined, page: 1 })
                  }
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ page: 1 })}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <ShieldCheckIcon className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Authentication Events</h2>
              <p className="text-sm text-gray-500">
                {logs.length} event{logs.length !== 1 ? 's' : ''} found
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-gray-500">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <InformationCircleIcon className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No security log entries found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3">Timestamp</th>
                    <th className="px-6 py-3">Event</th>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">IP Address</th>
                    <th className="px-6 py-3 hidden lg:table-cell">Location</th>
                    <th className="px-6 py-3 hidden xl:table-cell">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log: AuthenticationLog) => {
                    const config = eventTypeConfig[log.event_type] || {
                      variant: 'default' as const,
                      icon: InformationCircleIcon,
                    }
                    return (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {formatDateTime(log.timestamp)}
                        </td>
                        <td className="px-6 py-3">
                          <Badge variant={config.variant} size="xs">
                            {log.event_type_display || log.event_type}
                          </Badge>
                        </td>
                        <td className="px-6 py-3 text-gray-900 font-medium">
                          {log.email}
                        </td>
                        <td className="px-6 py-3 text-gray-600 font-mono text-xs">
                          {log.ip_address}
                        </td>
                        <td className="px-6 py-3 text-gray-500 hidden lg:table-cell">
                          {log.location || '-'}
                        </td>
                        <td className="px-6 py-3 text-xs text-gray-400 hidden xl:table-cell max-w-xs truncate">
                          {log.user_agent
                            ? log.user_agent.substring(0, 60) +
                              (log.user_agent.length > 60 ? '...' : '')
                            : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {logs.length > 0 && (
        <TablePagination
          currentPage={filters.page}
          totalPages={logs.length < pageSize ? filters.page : filters.page + 1}
          totalItems={logs.length < pageSize ? (filters.page - 1) * pageSize + logs.length : (filters.page) * pageSize + 1}
          pageSize={pageSize}
          onPageChange={(page) => setFilters({ ...filters, page })}
        />
      )}
    </div>
  )
}

// ==================== Main Page ====================

export default function AuditLogsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-gray-500">
          System-wide activity trail and authentication events
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger
            value="activity"
            icon={<ClipboardDocumentListIcon className="h-4 w-4" />}
          >
            Activity Logs
          </TabsTrigger>
          <TabsTrigger
            value="security"
            icon={<ShieldCheckIcon className="h-4 w-4" />}
          >
            Security Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <ActivityLogsTab />
        </TabsContent>

        <TabsContent value="security">
          <SecurityLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
