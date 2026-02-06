import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { leaveService } from '@/services/leave'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import LeaveCalendar from '@/components/leave/LeaveCalendar'
import type { LeaveCalendarEvent } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Plan',
  PENDING: 'Pending',
  APPROVED: 'Approved',
}

const STATUS_COLORS: Record<string, 'info' | 'warning' | 'success' | 'default'> = {
  DRAFT: 'info',
  PENDING: 'warning',
  APPROVED: 'success',
}

export default function MyLeaveCalendarPage() {
  const today = new Date()
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedEvent, setSelectedEvent] = useState<LeaveCalendarEvent | null>(null)
  const [includePlans, setIncludePlans] = useState(true)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Get start and end of month for API query
  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0)

  const formatDate = (date: Date) => date.toISOString().split('T')[0]

  // Fetch calendar events with plans
  const { data: calendarData, isLoading } = useQuery({
    queryKey: ['leave-calendar', year, month, includePlans],
    queryFn: () =>
      leaveService.getLeaveCalendar({
        start_date: formatDate(startDate),
        end_date: formatDate(endDate),
        include_plans: includePlans,
      }),
    retry: false,
  })

  const events = calendarData?.events || []
  const overlaps = calendarData?.overlaps || {}

  // Count overlaps
  const overlapCount = Object.keys(overlaps).length
  const hasOverlaps = overlapCount > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/my-leave">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leave Plan Calendar</h1>
            <p className="mt-1 text-sm text-gray-500">
              View team leave plans and identify scheduling conflicts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includePlans}
              onChange={(e) => setIncludePlans(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Show Plans & Pending</span>
          </label>
        </div>
      </div>

      {/* Overlap Warning */}
      {hasOverlaps && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-orange-800">
                Leave Overlap Detected
              </h3>
              <p className="mt-1 text-sm text-orange-700">
                {overlapCount} day(s) have multiple employees planning leave.
                Review the calendar to identify potential conflicts.
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <LeaveCalendar
            events={events}
            overlaps={overlaps}
            currentDate={currentDate}
            onNavigate={setCurrentDate}
            onEventClick={setSelectedEvent}
            isLoading={isLoading}
            showLegend={true}
          />
        </CardContent>
      </Card>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedEvent.employee_name}
                </h3>
                <p className="text-sm text-gray-500">{selectedEvent.department_name}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={STATUS_COLORS[selectedEvent.status] || 'default'}>
                  {STATUS_LABELS[selectedEvent.status] || selectedEvent.status}
                </Badge>
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: `${selectedEvent.color}20`,
                    color: selectedEvent.color,
                  }}
                >
                  {selectedEvent.leave_type_name}
                </span>
              </div>
            </div>

            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Request #</dt>
                <dd className="text-sm font-mono text-gray-900">
                  {selectedEvent.request_number}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Start Date</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {new Date(selectedEvent.start_date).toLocaleDateString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">End Date</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {new Date(selectedEvent.end_date).toLocaleDateString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Duration</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {selectedEvent.number_of_days} day(s)
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
