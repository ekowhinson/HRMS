import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { chartColors } from '@/lib/design-tokens'

export interface LineConfig {
  dataKey: string
  name: string
  color?: string
  strokeWidth?: number
  dot?: boolean
}

export interface LineChartCardProps {
  title: string
  subtitle?: string
  data: Record<string, any>[]
  lines: LineConfig[]
  height?: number
  valueFormatter?: (value: number) => string
  showGrid?: boolean
  showLegend?: boolean
  className?: string
}

export function LineChartCard({
  title,
  subtitle,
  data,
  lines,
  height = 300,
  valueFormatter = (v) => v.toLocaleString(),
  showGrid = true,
  showLegend = true,
  className,
}: LineChartCardProps) {
  if (data.length === 0) {
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200/60 p-6', className)}>
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center justify-center h-48 text-gray-400">
          No data available
        </div>
      </div>
    )
  }

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200/60 p-6', className)}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            )}
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              tickFormatter={valueFormatter}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              formatter={(value: number, name: string) => [valueFormatter(value), name]}
            />
            {showLegend && (
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
              />
            )}
            {lines.map((line, index) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name}
                stroke={line.color || chartColors.palette[index % chartColors.palette.length]}
                strokeWidth={line.strokeWidth || 2}
                dot={line.dot !== false ? { r: 3 } : false}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default LineChartCard
