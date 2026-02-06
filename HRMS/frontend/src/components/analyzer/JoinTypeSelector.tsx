import { cn } from '@/lib/utils'
import {
  JOIN_TYPE_LABELS,
  JOIN_TYPE_DESCRIPTIONS,
  type JoinType,
} from '@/services/datasets'

interface JoinTypeSelectorProps {
  value: JoinType
  onChange: (value: JoinType) => void
  disabled?: boolean
}

const JOIN_TYPE_ICONS: Record<JoinType, React.ReactNode> = {
  inner: (
    <svg viewBox="0 0 80 40" className="w-full h-full">
      <circle cx="25" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="55" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M 40 8 A 16 16 0 0 1 40 32 A 16 16 0 0 1 40 8"
        fill="currentColor"
        fillOpacity="0.3"
      />
    </svg>
  ),
  left: (
    <svg viewBox="0 0 80 40" className="w-full h-full">
      <circle cx="25" cy="20" r="16" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
      <circle cx="55" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  right: (
    <svg viewBox="0 0 80 40" className="w-full h-full">
      <circle cx="25" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="55" cy="20" r="16" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  outer: (
    <svg viewBox="0 0 80 40" className="w-full h-full">
      <circle cx="25" cy="20" r="16" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
      <circle cx="55" cy="20" r="16" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
}

export function JoinTypeSelector({ value, onChange, disabled }: JoinTypeSelectorProps) {
  const joinTypes: JoinType[] = ['left', 'inner', 'right', 'outer']

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Join Type</label>
      <div className="grid grid-cols-2 gap-2">
        {joinTypes.map((type) => (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => onChange(type)}
            className={cn(
              'flex flex-col items-center p-3 rounded-lg border-2 transition-all',
              'hover:bg-gray-50',
              value === type
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 text-gray-600',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="w-16 h-8 mb-2">{JOIN_TYPE_ICONS[type]}</div>
            <span className="text-sm font-medium">{JOIN_TYPE_LABELS[type]}</span>
            <span className="text-xs text-gray-500 text-center mt-1">
              {JOIN_TYPE_DESCRIPTIONS[type]}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default JoinTypeSelector
