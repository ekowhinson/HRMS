import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AcademicCapIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  UserIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { trainingService } from '@/services/training'
import { Card, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'

interface Enrollment {
  id: string
  session: string
  session_title: string
  program_name: string
  session_start_date: string
  session_end_date: string
  session_start_time: string | null
  session_end_time: string | null
  session_venue: string
  session_facilitator: string
  session_status: string
  status: string
  status_display: string
  attendance_date: string | null
  score: number | null
  feedback: string
  certificate_issued: boolean
  certificate_date: string | null
  post_training_report: { id: string; status: string; status_display: string } | null
  impact_assessment: { id: string; status: string; status_display: string } | null
  created_at: string
}

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ENROLLED: 'info',
  ATTENDED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
  WITHDRAWN: 'default',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return ''
  const [hours, minutes] = timeStr.split(':')
  const h = parseInt(hours)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}

function isUpcoming(enrollment: Enrollment): boolean {
  if (!enrollment.session_start_date) return false
  const sessionDate = new Date(enrollment.session_start_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return (
    sessionDate >= today &&
    ['ENROLLED'].includes(enrollment.status)
  )
}

function isCompleted(enrollment: Enrollment): boolean {
  return ['COMPLETED', 'ATTENDED'].includes(enrollment.status)
}

export default function MyTrainingPage() {
  const [activeTab, setActiveTab] = useState('upcoming')

  const { data: enrollments = [], isLoading } = useQuery<Enrollment[]>({
    queryKey: ['my-enrollments'],
    queryFn: () => trainingService.getMyEnrollments(),
  })

  const upcoming = enrollments.filter(isUpcoming)
  const completed = enrollments.filter(isCompleted)
  const certificateCount = enrollments.filter((e) => e.certificate_issued).length

  const filteredEnrollments =
    activeTab === 'upcoming'
      ? upcoming
      : activeTab === 'completed'
        ? completed
        : enrollments

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Training</h1>
        <p className="mt-1 text-sm text-gray-500">
          View your training enrollments and schedule
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <AcademicCapIcon className="h-8 w-8 mx-auto text-blue-500 mb-2" />
            <p className="text-sm text-gray-500">Total Enrollments</p>
            <p className="text-lg font-bold text-gray-900">{enrollments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ClockIcon className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
            <p className="text-sm text-gray-500">Upcoming</p>
            <p className="text-lg font-bold text-gray-900">{upcoming.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircleIcon className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="text-sm text-gray-500">Completed</p>
            <p className="text-lg font-bold text-gray-900">{completed.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DocumentTextIcon className="h-8 w-8 mx-auto text-purple-500 mb-2" />
            <p className="text-sm text-gray-500">Certificates</p>
            <p className="text-lg font-bold text-gray-900">{certificateCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          <TabsTrigger value="all">All ({enrollments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {filteredEnrollments.length > 0 ? (
            <div className="space-y-4">
              {filteredEnrollments.map((enrollment) => (
                <Card key={enrollment.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-semibold text-gray-900">
                            {enrollment.session_title}
                          </h3>
                          <Badge variant={statusColors[enrollment.status] || 'default'}>
                            {enrollment.status_display}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {enrollment.program_name}
                        </p>

                        {/* Session Details */}
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <CalendarDaysIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <span>
                              {formatDate(enrollment.session_start_date)}
                              {enrollment.session_end_date &&
                                enrollment.session_end_date !== enrollment.session_start_date &&
                                ` - ${formatDate(enrollment.session_end_date)}`}
                            </span>
                          </div>
                          {(enrollment.session_start_time || enrollment.session_end_time) && (
                            <div className="flex items-center gap-1.5">
                              <ClockIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <span>
                                {formatTime(enrollment.session_start_time)}
                                {enrollment.session_end_time &&
                                  ` - ${formatTime(enrollment.session_end_time)}`}
                              </span>
                            </div>
                          )}
                          {enrollment.session_venue && (
                            <div className="flex items-center gap-1.5">
                              <MapPinIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <span>{enrollment.session_venue}</span>
                            </div>
                          )}
                          {enrollment.session_facilitator && (
                            <div className="flex items-center gap-1.5">
                              <UserIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <span>{enrollment.session_facilitator}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right side badges */}
                      <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                        {enrollment.score !== null && (
                          <Badge variant="info">
                            Score: {enrollment.score}%
                          </Badge>
                        )}
                        {enrollment.certificate_issued && (
                          <Badge variant="success">
                            Certificate Issued
                          </Badge>
                        )}
                        {enrollment.post_training_report && (
                          <Badge variant={enrollment.post_training_report.status === 'REVIEWED' ? 'success' : 'warning'}>
                            Report: {enrollment.post_training_report.status_display}
                          </Badge>
                        )}
                        {enrollment.impact_assessment && (
                          <Badge variant={enrollment.impact_assessment.status === 'SUBMITTED' ? 'success' : 'warning'}>
                            Assessment: {enrollment.impact_assessment.status_display}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <EmptyState
                  type="data"
                  title={
                    activeTab === 'upcoming'
                      ? 'No upcoming training'
                      : activeTab === 'completed'
                        ? 'No completed training'
                        : 'No training enrollments'
                  }
                  description={
                    activeTab === 'upcoming'
                      ? 'You have no upcoming training sessions scheduled.'
                      : activeTab === 'completed'
                        ? "You haven't completed any training sessions yet."
                        : 'You are not enrolled in any training sessions. Contact HR for enrollment.'
                  }
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
