import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarDaysIcon } from '@heroicons/react/24/outline'
import { payrollSetupService } from '@/services/payrollSetup'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
}

export default function ActivePeriodIndicator() {
  const { data: payrollSettings } = useQuery({
    queryKey: ['payroll-settings-header'],
    queryFn: () => payrollSetupService.getPayrollSettings(),
    staleTime: 5 * 60 * 1000,
  })

  const periodName = payrollSettings?.settings?.active_period_name
  const periodStatus = payrollSettings?.settings?.active_period_status

  if (!periodName) return null

  return (
    <Link
      to="/admin/payroll-setup?tab=settings"
      className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-50 border border-blue-200 rounded-full hover:bg-blue-100 transition-colors"
    >
      <CalendarDaysIcon className="h-3.5 w-3.5 text-blue-600" />
      <span className="text-blue-700 font-medium">{periodName}</span>
      {periodStatus && (
        <span className={cn(
          'px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase',
          STATUS_STYLES[periodStatus] || 'bg-yellow-100 text-yellow-700'
        )}>
          {periodStatus}
        </span>
      )}
    </Link>
  )
}
