import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '../../lib/utils';
import { chartColors } from '../../lib/design-tokens';

export interface AreaChartDataPoint {
  name: string;
  value: number;
  value2?: number;
  [key: string]: string | number | undefined;
}

export interface AreaChartCardProps {
  title: string;
  subtitle?: string;
  data: AreaChartDataPoint[];
  dataKey?: string;
  dataKey2?: string;
  color?: string;
  color2?: string;
  height?: number;
  showGrid?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  gradient?: boolean;
  className?: string;
  valueFormatter?: (value: number) => string;
}

export function AreaChartCard({
  title,
  subtitle,
  data,
  dataKey = 'value',
  dataKey2,
  color = chartColors.primary,
  color2 = chartColors.secondary,
  height = 250,
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  gradient = true,
  className,
  valueFormatter = (value) => value.toLocaleString(),
}: AreaChartCardProps) {
  const gradientId = `areaGradient-${dataKey}`;
  const gradientId2 = `areaGradient-${dataKey2}`;

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
          <AreaChart
            data={data}
            margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
              {dataKey2 && (
                <linearGradient id={gradientId2} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color2} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color2} stopOpacity={0} />
                </linearGradient>
              )}
            </defs>

            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                vertical={false}
              />
            )}

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

            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                padding: '8px 12px',
              }}
              labelStyle={{ color: '#374151', fontWeight: 600, marginBottom: 4 }}
              formatter={(value: number) => [valueFormatter(value), dataKey]}
            />

            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={gradient ? `url(#${gradientId})` : color}
              fillOpacity={gradient ? 1 : 0.3}
            />

            {dataKey2 && (
              <Area
                type="monotone"
                dataKey={dataKey2}
                stroke={color2}
                strokeWidth={2}
                fill={gradient ? `url(#${gradientId2})` : color2}
                fillOpacity={gradient ? 1 : 0.3}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default AreaChartCard;
