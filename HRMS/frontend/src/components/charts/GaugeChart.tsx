import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

interface GaugeChartProps {
  title: string
  subtitle?: string
  value: number
  maxValue?: number
  thresholds?: { low: number; medium: number }
  colors?: { low: string; medium: string; high: string; background: string }
  height?: number
  label?: string
  className?: string
}

export function GaugeChart({
  title,
  subtitle,
  value,
  maxValue = 100,
  thresholds = { low: 40, medium: 70 },
  colors = {
    low: '#ef4444',
    medium: '#f59e0b',
    high: '#22c55e',
    background: '#e5e7eb',
  },
  height = 180,
  label,
  className,
}: GaugeChartProps) {
  const percentage = Math.min((value / maxValue) * 100, 100)

  const getColor = () => {
    if (percentage < thresholds.low) return colors.low
    if (percentage < thresholds.medium) return colors.medium
    return colors.high
  }

  const data = [
    { value: percentage, fill: getColor() },
    { value: 100 - percentage, fill: colors.background },
  ]

  return (
    <div className={cn('bg-white rounded-md border border-gray-200 p-6', className)}>
      <div className="mb-2">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div style={{ height }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="70%"
              startAngle={180}
              endAngle={0}
              innerRadius="65%"
              outerRadius="100%"
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ top: '15%' }}>
          <span className="text-3xl font-bold text-gray-900">{value.toFixed(1)}%</span>
          {label && <span className="text-sm text-gray-500">{label}</span>}
        </div>
      </div>
    </div>
  )
}

export default GaugeChart
