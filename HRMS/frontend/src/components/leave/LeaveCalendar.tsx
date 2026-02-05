import { useMemo } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import type { LeaveCalendarEvent } from '@/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Status colors for leave events
const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  DRAFT: { bg: '#EEF2FF', border: '#6366F1', text: '#4F46E5' },      // Indigo for Plan
  PENDING: { bg: '#FEF3C7', border: '#F59E0B', text: '#D97706' },    // Amber for Pending
  APPROVED: { bg: '#D1FAE5', border: '#10B981', text: '#059669' },   // Green for Approved
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Plan',
  PENDING: 'Pending',
  APPROVED: 'Approved',
}

interface LeaveCalendarProps {
  events: LeaveCalendarEvent[]
  overlaps?: Record<string, number>
  currentDate: Date
  onNavigate: (date: Date) => void
  onEventClick?: (event: LeaveCalendarEvent) => void
  isLoading?: boolean
  showLegend?: boolean
}

export default function LeaveCalendar({
  events,
  overlaps = {},
  currentDate,
  onNavigate,
  onEventClick,
  isLoading = false,
  showLegend = true,
}: LeaveCalendarProps) {
  const today = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const formatDate = (date: Date) => date.toISOString().split('T')[0]

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const days: Array<{ date: Date; isCurrentMonth: boolean }> = []
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    // Add days from previous month
    const startPadding = firstDay.getDay()
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i)
      days.push({ date, isCurrentMonth: false })
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }

    // Add days from next month to complete the grid
    const endPadding = 42 - days.length
    for (let i = 1; i <= endPadding; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
    }

    return days
  }, [year, month])

  // Get events for a specific date
  const getEventsForDate = (date: Date): LeaveCalendarEvent[] => {
    if (!events) return []
    const dateStr = formatDate(date)
    return events.filter((event) => {
      return dateStr >= event.start_date && dateStr <= event.end_date
    })
  }

  // Check if a date has overlapping leave
  const getOverlapCount = (date: Date): number => {
    const dateStr = formatDate(date)
    return overlaps[dateStr] || 0
  }

  const navigateMonth = (delta: number) => {
    onNavigate(new Date(year, month + delta, 1))
  }

  const goToToday = () => {
    onNavigate(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  const isToday = (date: Date) => {
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const getEventStyle = (event: LeaveCalendarEvent) => {
    const statusColor = STATUS_COLORS[event.status] || STATUS_COLORS.APPROVED
    // If the event has a leave type color, use it for approved leaves
    if (event.status === 'APPROVED' && event.color) {
      return {
        backgroundColor: `${event.color}20`,
        color: event.color,
        borderLeft: `3px solid ${event.color}`,
      }
    }
    return {
      backgroundColor: statusColor.bg,
      color: statusColor.text,
      borderLeft: `3px solid ${statusColor.border}`,
    }
  }

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 min-w-[160px] text-center">
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={goToToday}>
          Today
        </Button>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          {Object.entries(STATUS_COLORS).map(([status, colors]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: colors.border }}
              />
              <span className="text-sm text-gray-600">
                {STATUS_LABELS[status] || status}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-4">
            <ExclamationTriangleIcon className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-gray-600">Overlap</span>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
        {/* Day Headers */}
        {DAYS.map((day) => (
          <div
            key={day}
            className="bg-gray-50 py-2 text-center text-xs font-medium text-gray-500"
          >
            {day}
          </div>
        ))}

        {/* Calendar Days */}
        {calendarDays.map(({ date, isCurrentMonth }, idx) => {
          const dayEvents = getEventsForDate(date)
          const dayIsToday = isToday(date)
          const overlapCount = getOverlapCount(date)
          const hasOverlap = overlapCount > 1

          return (
            <div
              key={idx}
              className={`
                min-h-[100px] bg-white p-1 relative
                ${!isCurrentMonth ? 'bg-gray-50' : ''}
                ${hasOverlap ? 'ring-2 ring-inset ring-orange-400' : ''}
              `}
            >
              {/* Overlap indicator */}
              {hasOverlap && (
                <div className="absolute top-1 right-1" title={`${overlapCount} people on leave`}>
                  <div className="flex items-center gap-0.5 px-1 py-0.5 bg-orange-100 rounded text-xs text-orange-700">
                    <ExclamationTriangleIcon className="h-3 w-3" />
                    <span>{overlapCount}</span>
                  </div>
                </div>
              )}

              <div
                className={`
                  text-sm font-medium pr-1 mb-1
                  ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-900'}
                  ${dayIsToday ? 'text-primary-600' : ''}
                `}
              >
                <span
                  className={`
                    inline-flex items-center justify-center w-6 h-6 rounded-full
                    ${dayIsToday ? 'bg-primary-600 text-white' : ''}
                  `}
                >
                  {date.getDate()}
                </span>
              </div>

              {/* Events */}
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <button
                    key={event.id}
                    onClick={() => onEventClick?.(event)}
                    className="w-full text-left px-1.5 py-0.5 text-xs rounded truncate transition-opacity hover:opacity-80"
                    style={getEventStyle(event)}
                    title={`${event.employee_name} - ${event.leave_type_name} (${STATUS_LABELS[event.status] || event.status})`}
                  >
                    <span className="font-medium">{event.employee_name}</span>
                    {event.status === 'DRAFT' && (
                      <span className="ml-1 opacity-75">(Plan)</span>
                    )}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-xs text-gray-500 px-1">
                    +{dayEvents.length - 3} more
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      )}
    </div>
  )
}
