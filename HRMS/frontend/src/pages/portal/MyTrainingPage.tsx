import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AcademicCapIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  UserIcon,
  DocumentTextIcon,
  PlusIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import { trainingService } from '@/services/training'
import { Card, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

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

interface TrainingRequest {
  id: string
  title: string
  description: string
  training_type: string
  training_type_display: string
  justification: string
  estimated_cost: string | number | null
  preferred_date: string | null
  status: string
  status_display: string
  review_notes: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
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

const requestStatusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  SUBMITTED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'warning',
}

const trainingTypeOptions = [
  { value: 'TRAINING', label: 'Training' },
  { value: 'CERTIFICATION', label: 'Certification' },
  { value: 'WORKSHOP', label: 'Workshop' },
  { value: 'CONFERENCE', label: 'Conference' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'OTHER', label: 'Other' },
]

const initialFormData = {
  title: '',
  description: '',
  training_type: '',
  justification: '',
  estimated_cost: '',
  preferred_date: '',
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
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [formData, setFormData] = useState(initialFormData)
  const queryClient = useQueryClient()

  const { data: enrollments = [], isLoading } = useQuery<Enrollment[]>({
    queryKey: ['my-enrollments'],
    queryFn: () => trainingService.getMyEnrollments(),
  })

  const { data: trainingRequests = [], isLoading: isLoadingRequests } = useQuery<TrainingRequest[]>({
    queryKey: ['my-training-requests'],
    queryFn: () => trainingService.getMyTrainingRequests(),
  })

  const createRequestMutation = useMutation({
    mutationFn: (data: any) => trainingService.createTrainingRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-training-requests'] })
      toast.success('Training request created successfully')
      setShowRequestModal(false)
      setFormData(initialFormData)
    },
    onError: () => {
      toast.error('Failed to create training request')
    },
  })

  const submitRequestMutation = useMutation({
    mutationFn: (id: string) => trainingService.submitTrainingRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-training-requests'] })
      toast.success('Training request submitted for approval')
    },
    onError: () => {
      toast.error('Failed to submit training request')
    },
  })

  const upcoming = enrollments.filter(isUpcoming)
  const completed = enrollments.filter(isCompleted)
  const certificateCount = enrollments.filter((e) => e.certificate_issued).length

  const filteredEnrollments =
    activeTab === 'upcoming'
      ? upcoming
      : activeTab === 'completed'
        ? completed
        : activeTab === 'all'
          ? enrollments
          : []

  const handleFormChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = {
      title: formData.title,
      description: formData.description,
      training_type: formData.training_type,
      justification: formData.justification,
    }
    if (formData.estimated_cost) {
      payload.estimated_cost = parseFloat(formData.estimated_cost)
    }
    if (formData.preferred_date) {
      payload.preferred_date = formData.preferred_date
    }
    createRequestMutation.mutate(payload)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Training</h1>
          <p className="mt-1 text-sm text-gray-500">
            View your training enrollments and schedule
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<PlusIcon className="h-4 w-4" />}
          onClick={() => setShowRequestModal(true)}
        >
          Request Training
        </Button>
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
          <TabsTrigger value="requests">My Requests ({trainingRequests.length})</TabsTrigger>
        </TabsList>

        {activeTab !== 'requests' ? (
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
        ) : (
          <TabsContent value="requests">
            {isLoadingRequests ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : trainingRequests.length > 0 ? (
              <div className="space-y-4">
                {trainingRequests.map((request) => (
                  <Card key={request.id}>
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-gray-900">
                              {request.title}
                            </h3>
                            <Badge variant={requestStatusColors[request.status] || 'default'}>
                              {request.status_display || request.status}
                            </Badge>
                          </div>
                          {request.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                              {request.description}
                            </p>
                          )}

                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                            <div className="flex items-center gap-1.5">
                              <AcademicCapIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <span>{request.training_type_display || request.training_type}</span>
                            </div>
                            {request.preferred_date && (
                              <div className="flex items-center gap-1.5">
                                <CalendarDaysIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <span>Preferred: {formatDate(request.preferred_date)}</span>
                              </div>
                            )}
                            {request.estimated_cost && (
                              <div className="flex items-center gap-1.5">
                                <CurrencyDollarIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <span>Est. Cost: GHS {Number(request.estimated_cost).toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <ClockIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <span>Created: {formatDate(request.created_at)}</span>
                            </div>
                          </div>

                          {request.justification && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-gray-500">Justification</p>
                              <p className="text-sm text-gray-600 line-clamp-2">{request.justification}</p>
                            </div>
                          )}

                          {request.review_notes && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                              <p className="text-xs font-medium text-gray-500">
                                Review Notes {request.reviewed_by_name && `by ${request.reviewed_by_name}`}
                              </p>
                              <p className="text-gray-600">{request.review_notes}</p>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                          {request.status === 'DRAFT' && (
                            <Button
                              variant="primary"
                              size="sm"
                              isLoading={submitRequestMutation.isPending}
                              onClick={() => submitRequestMutation.mutate(request.id)}
                            >
                              Submit
                            </Button>
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
                    title="No training requests"
                    description="You haven't made any training requests yet. Click 'Request Training' to submit one."
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Request Training Modal */}
      <Modal
        isOpen={showRequestModal}
        onClose={() => {
          setShowRequestModal(false)
          setFormData(initialFormData)
        }}
        title="Request Training"
        description="Submit a training request for approval by your department head."
        size="lg"
      >
        <form onSubmit={handleCreateRequest} className="space-y-4">
          <Input
            label="Title"
            required
            placeholder="e.g. Advanced Project Management Certification"
            value={formData.title}
            onChange={(e) => handleFormChange('title', e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-red-500 ml-0.5">*</span>
            </label>
            <textarea
              required
              rows={3}
              className="block w-full px-4 py-3 border border-gray-200 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 hover:border-gray-300 transition-colors duration-150"
              placeholder="Describe the training program, provider, and what it covers..."
              value={formData.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
            />
          </div>

          <Select
            label="Training Type"
            required
            options={trainingTypeOptions}
            placeholder="Select training type..."
            value={formData.training_type}
            onChange={(e) => handleFormChange('training_type', e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Justification <span className="text-red-500 ml-0.5">*</span>
            </label>
            <textarea
              required
              rows={3}
              className="block w-full px-4 py-3 border border-gray-200 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 hover:border-gray-300 transition-colors duration-150"
              placeholder="Explain why this training is needed and how it will benefit your role..."
              value={formData.justification}
              onChange={(e) => handleFormChange('justification', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Estimated Cost (GHS)"
              type="number"
              placeholder="0.00"
              value={formData.estimated_cost}
              onChange={(e) => handleFormChange('estimated_cost', e.target.value)}
            />

            <Input
              label="Preferred Date"
              type="date"
              value={formData.preferred_date}
              onChange={(e) => handleFormChange('preferred_date', e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowRequestModal(false)
                setFormData(initialFormData)
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createRequestMutation.isPending}
            >
              Create Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
