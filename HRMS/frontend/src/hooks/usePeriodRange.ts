import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

interface PayrollPeriodOption {
  id: string
  name: string
  year: number
  month: number
  start_date: string
  end_date: string
  status: string
}

export function usePeriodRange() {
  const [fromPeriod, setFromPeriod] = useState('')
  const [toPeriod, setToPeriod] = useState('')

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ['payroll-periods-list'],
    queryFn: async () => {
      const response = await api.get('/payroll/periods/', { params: { page_size: 100 } })
      const results = response.data?.results || response.data || []
      return results as PayrollPeriodOption[]
    },
  })

  // Sort periods chronologically (newest first for dropdown display)
  const sortedPeriods = [...periods].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    return b.month - a.month
  })

  const periodOptions = sortedPeriods.map((p) => ({
    value: p.id,
    label: p.name,
  }))

  return {
    fromPeriod,
    setFromPeriod,
    toPeriod,
    setToPeriod,
    periods: sortedPeriods,
    periodOptions,
    isLoading,
  }
}
