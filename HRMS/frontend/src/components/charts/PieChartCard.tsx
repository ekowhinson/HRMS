import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { cn } from '../../lib/utils';
import { chartColors } from '../../lib/design-tokens';

export interface PieChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface PieChartCardProps {
  title: string;
  subtitle?: string;
  data: PieChartDataPoint[];
  colors?: string[];
  donut?: boolean;
  height?: number;
  showLegend?: boolean;
  legendPosition?: 'bottom' | 'right';
  className?: string;
  valueFormatter?: (value: number) => string;
  centerLabel?: {
    value: string | number;
    label: string;
  };
}

const defaultColors = [...chartColors.palette];

export function PieChartCard({
  title,
  subtitle,
  data,
  colors = defaultColors,
  donut = true,
  height = 250,
  showLegend = true,
  legendPosition = 'right',
  className,
  valueFormatter = (value) => value.toLocaleString(),
  centerLabel,
}: PieChartCardProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const renderCenterLabel = () => {
    if (!donut || !centerLabel) return null;

    return (
      <g>
        <text
          x="50%"
          y="45%"
          textAnchor="middle"
          className="fill-gray-900 text-2xl font-bold"
          style={{ fontSize: '24px', fontWeight: 700 }}
        >
          {centerLabel.value}
        </text>
        <text
          x="50%"
          y="58%"
          textAnchor="middle"
          className="fill-gray-500 text-sm"
          style={{ fontSize: '12px' }}
        >
          {centerLabel.label}
        </text>
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = ((data.value / total) * 100).toFixed(1);

      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900">{data.name}</p>
          <p className="text-sm text-gray-600">
            {valueFormatter(data.value)} ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = () => {
    return (
      <div
        className={cn(
          'flex flex-wrap gap-3',
          legendPosition === 'right' ? 'flex-col' : 'justify-center'
        )}
      >
        {data.map((entry, index) => {
          const percentage = ((entry.value / total) * 100).toFixed(1);
          return (
            <div key={entry.name} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color || colors[index % colors.length] }}
              />
              <span className="text-sm text-gray-600 truncate max-w-[120px]">
                {entry.name}
              </span>
              <span className="text-sm font-medium text-gray-900">
                {percentage}%
              </span>
            </div>
          );
        })}
      </div>
    );
  };

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

      {/* Chart with legend */}
      <div
        className={cn(
          'flex',
          legendPosition === 'right' ? 'flex-row gap-6' : 'flex-col gap-4'
        )}
      >
        {/* Pie Chart */}
        <div
          className={cn(legendPosition === 'right' && showLegend ? 'flex-1' : 'w-full')}
          style={{ height }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={donut ? '60%' : 0}
                outerRadius="85%"
                paddingAngle={2}
                dataKey="value"
                animationBegin={0}
                animationDuration={800}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || colors[index % colors.length]}
                    stroke="white"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              {donut && centerLabel && renderCenterLabel()}
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        {showLegend && renderLegend()}
      </div>
    </div>
  );
}

export default PieChartCard;
