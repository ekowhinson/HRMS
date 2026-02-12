import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { cn } from '../../lib/utils';
import { chartColors } from '../../lib/design-tokens';

export interface BarChartDataPoint {
  name: string;
  value: number;
  color?: string;
  [key: string]: string | number | undefined;
}

export interface BarChartCardProps {
  title: string;
  subtitle?: string;
  data: BarChartDataPoint[];
  dataKey?: string;
  color?: string;
  colors?: string[];
  height?: number;
  layout?: 'horizontal' | 'vertical';
  showGrid?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  barSize?: number;
  radius?: number;
  className?: string;
  valueFormatter?: (value: number) => string;
}

// Default colors from design tokens
// const defaultColors = [...chartColors.palette];

export function BarChartCard({
  title,
  subtitle,
  data,
  dataKey = 'value',
  color = chartColors.primary,
  colors,
  height = 250,
  layout = 'vertical',
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  barSize = 20,
  radius = 4,
  className,
  valueFormatter = (value) => value.toLocaleString(),
}: BarChartCardProps) {
  const isHorizontal = layout === 'horizontal';

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200/60 p-6',
        className
      )}
    >
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={layout}
            margin={
              isHorizontal
                ? { top: 5, right: 30, left: 0, bottom: 5 }
                : { top: 5, right: 5, left: -20, bottom: 5 }
            }
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                horizontal={isHorizontal}
                vertical={!isHorizontal}
              />
            )}

            {isHorizontal ? (
              <>
                {showYAxis && (
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    width={100}
                  />
                )}
                {showXAxis && (
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickFormatter={(value) =>
                      value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
                    }
                  />
                )}
              </>
            ) : (
              <>
                {showXAxis && (
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    dy={10}
                  />
                )}
                {showYAxis && (
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    dx={-10}
                    tickFormatter={(value) =>
                      value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
                    }
                  />
                )}
              </>
            )}

            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                padding: '8px 12px',
              }}
              labelStyle={{ color: '#374151', fontWeight: 600, marginBottom: 4 }}
              formatter={(value: number) => [valueFormatter(value), 'Count']}
              cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
            />

            <Bar
              dataKey={dataKey}
              barSize={barSize}
              radius={[radius, radius, radius, radius]}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.color ||
                    (colors ? colors[index % colors.length] : color)
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Simple horizontal bar for inline display
export function HorizontalProgressBar({
  value,
  max = 100,
  color = chartColors.primary,
  height = 8,
  showValue = false,
  className,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  showValue?: boolean;
  className?: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="flex-1 bg-gray-100 rounded-full overflow-hidden"
        style={{ height }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
      {showValue && (
        <span className="text-sm font-medium text-gray-700 min-w-[40px] text-right">
          {percentage.toFixed(0)}%
        </span>
      )}
    </div>
  );
}

export default BarChartCard;
