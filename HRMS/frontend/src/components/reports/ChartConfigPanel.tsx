import { cn } from '@/lib/utils'
import {
  ChartBarIcon,
  ChartPieIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline'
import type { ChartConfig, ReportColumn } from '@/services/reportBuilder'

// Custom line chart icon since heroicons doesn't have one
function LineChartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 17l4-4 4 4 4-8 6 4"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18" />
    </svg>
  )
}

type ViewMode = 'table' | 'bar' | 'line' | 'pie'

interface ChartConfigPanelProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  chartConfig: ChartConfig | null
  onChartConfigChange: (config: ChartConfig | null) => void
  columns: ReportColumn[]
  className?: string
}

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
  {
    value: 'table',
    label: 'Table',
    icon: <TableCellsIcon className="w-4 h-4" />,
  },
  {
    value: 'bar',
    label: 'Bar',
    icon: <ChartBarIcon className="w-4 h-4" />,
  },
  {
    value: 'line',
    label: 'Line',
    icon: <LineChartIcon className="w-4 h-4" />,
  },
  {
    value: 'pie',
    label: 'Pie',
    icon: <ChartPieIcon className="w-4 h-4" />,
  },
]

export default function ChartConfigPanel({
  viewMode,
  onViewModeChange,
  chartConfig,
  onChartConfigChange,
  columns,
  className,
}: ChartConfigPanelProps) {
  const handleViewChange = (mode: ViewMode) => {
    onViewModeChange(mode)
    if (mode === 'table') {
      onChartConfigChange(null)
    } else {
      const xField = columns[0]?.field || ''
      const yField = columns[1]?.field || columns[0]?.field || ''
      onChartConfigChange({
        type: mode as 'bar' | 'line' | 'pie',
        x_axis: chartConfig?.x_axis || xField,
        y_axis: chartConfig?.y_axis || yField,
      })
    }
  }

  const updateChartConfig = (patch: Partial<ChartConfig>) => {
    if (!chartConfig) return
    onChartConfigChange({ ...chartConfig, ...patch })
  }

  const fieldOptions = columns.map((col) => ({
    value: col.field,
    label: col.label || col.field,
  }))

  const selectClass =
    'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

  return (
    <div className={cn('space-y-4', className)}>
      {/* View mode selector */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Visualization
        </label>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleViewChange(opt.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex-1 justify-center',
                viewMode === opt.value
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              )}
            >
              {opt.icon}
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Axis configuration - only visible for chart modes */}
      {viewMode !== 'table' && chartConfig && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              {viewMode === 'pie' ? 'Category (Labels)' : 'X-Axis'}
            </label>
            <select
              value={chartConfig.x_axis}
              onChange={(e) => updateChartConfig({ x_axis: e.target.value })}
              className={selectClass}
            >
              <option value="">Select field...</option>
              {fieldOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              {viewMode === 'pie' ? 'Values' : 'Y-Axis'}
            </label>
            <select
              value={chartConfig.y_axis}
              onChange={(e) => updateChartConfig({ y_axis: e.target.value })}
              className={selectClass}
            >
              <option value="">Select field...</option>
              {fieldOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
