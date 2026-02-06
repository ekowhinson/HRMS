import { AreaChart, Area, ResponsiveContainer, Line, LineChart } from 'recharts';
import { cn } from '../../lib/utils';
import { chartColors } from '../../lib/design-tokens';

export interface SparklineDataPoint {
  value: number;
}

export interface SparklineChartProps {
  data: number[] | SparklineDataPoint[];
  color?: string;
  type?: 'area' | 'line';
  width?: number;
  height?: number;
  gradient?: boolean;
  strokeWidth?: number;
  className?: string;
}

export function SparklineChart({
  data,
  color = chartColors.primary,
  type = 'area',
  width = 100,
  height = 32,
  gradient = true,
  strokeWidth = 2,
  className,
}: SparklineChartProps) {
  // Normalize data to array of objects
  const chartData = data.map((item) =>
    typeof item === 'number' ? { value: item } : item
  );

  if (chartData.length < 2) {
    return null;
  }

  const gradientId = `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={cn('inline-flex', className)} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        {type === 'area' ? (
          <AreaChart data={chartData}>
            {gradient && (
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={strokeWidth}
              fill={gradient ? `url(#${gradientId})` : color}
              fillOpacity={gradient ? 1 : 0.1}
              isAnimationActive={false}
            />
          </AreaChart>
        ) : (
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={strokeWidth}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// Trend sparkline with indicator
export function TrendSparkline({
  data,
  trendValue: _trendValue,
  trendDirection,
  color,
  width = 80,
  height = 24,
  className,
}: {
  data: number[];
  trendValue?: number;
  trendDirection?: 'up' | 'down' | 'neutral';
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  // Determine trend direction from data if not provided
  const direction =
    trendDirection ||
    (data.length >= 2
      ? data[data.length - 1] > data[0]
        ? 'up'
        : data[data.length - 1] < data[0]
        ? 'down'
        : 'neutral'
      : 'neutral');

  const defaultColor =
    color ||
    (direction === 'up'
      ? chartColors.primary
      : direction === 'down'
      ? '#ef4444'
      : '#6b7280');

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <SparklineChart
        data={data}
        color={defaultColor}
        width={width}
        height={height}
        type="line"
        gradient={false}
      />
    </div>
  );
}

export default SparklineChart;
