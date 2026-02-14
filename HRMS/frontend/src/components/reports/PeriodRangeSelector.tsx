import Select from '@/components/ui/Select'

interface PeriodRangeSelectorProps {
  fromPeriod: string
  toPeriod: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  periodOptions: { value: string; label: string }[]
  isLoading?: boolean
}

export default function PeriodRangeSelector({
  fromPeriod,
  toPeriod,
  onFromChange,
  onToChange,
  periodOptions,
  isLoading,
}: PeriodRangeSelectorProps) {
  return (
    <>
      <div className="w-48">
        <Select
          label="From Period"
          value={fromPeriod}
          onChange={(e) => onFromChange(e.target.value)}
          disabled={isLoading}
          options={[
            { value: '', label: 'Select period...' },
            ...periodOptions,
          ]}
        />
      </div>
      <div className="w-48">
        <Select
          label="To Period"
          value={toPeriod}
          onChange={(e) => onToChange(e.target.value)}
          disabled={isLoading}
          options={[
            { value: '', label: 'Select period...' },
            ...periodOptions,
          ]}
        />
      </div>
    </>
  )
}
