import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  BriefcaseIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
  DocumentArrowUpIcon,
} from '@heroicons/react/24/outline'
import { recruitmentService } from '@/services/recruitment'
import { Card, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'

interface InternalVacancy {
  id: string
  vacancy_number: string
  job_title: string
  position_name: string
  department_name: string
  location_name: string | null
  job_description: string
  requirements: string
  responsibilities: string
  qualifications: string
  experience_required: string
  skills_required: string
  employment_type: string
  closing_date: string | null
  salary_range_min: number | null
  salary_range_max: number | null
  show_salary: boolean
}

interface InternalApplication {
  id: string
  applicant_number: string
  vacancy_id: string
  vacancy_title: string
  department: string
  status: string
  status_display: string
  application_date: string
  cover_letter: string
  timeline: {
    id: string
    new_status: string
    status_display: string
    changed_at: string
    display_message: string
  }[]
}

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  NEW: 'info',
  SCREENING: 'warning',
  SHORTLISTED: 'success',
  INTERVIEW: 'info',
  ASSESSMENT: 'warning',
  REFERENCE_CHECK: 'warning',
  OFFER: 'success',
  HIRED: 'success',
  REJECTED: 'danger',
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

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const DOC_FORMATS = ['.pdf', '.doc', '.docx']
const CERT_FORMATS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']

function validateFile(file: File, allowedExts: string[]): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" exceeds 10MB. Please select a file smaller than 10MB.`
  }
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  if (!allowedExts.includes(ext)) {
    return `"${file.name}" is not a supported format. Accepted formats: ${allowedExts.join(', ')}`
  }
  return null
}

export default function InternalJobBoardPage() {
  const [activeTab, setActiveTab] = useState('positions')
  const [search, setSearch] = useState('')
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [selectedVacancy, setSelectedVacancy] = useState<InternalVacancy | null>(null)
  const [coverLetter, setCoverLetter] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null)
  const [certificateFiles, setCertificateFiles] = useState<File[]>([])
  const [employeeData, setEmployeeData] = useState<Record<string, string>>({})
  const queryClient = useQueryClient()

  const { data: vacancies = [], isLoading: loadingVacancies } = useQuery<InternalVacancy[]>({
    queryKey: ['internal-vacancies'],
    queryFn: () => recruitmentService.getInternalVacancies(),
  })

  const { data: applications = [], isLoading: loadingApplications } = useQuery<InternalApplication[]>({
    queryKey: ['internal-applications'],
    queryFn: () => recruitmentService.getMyInternalApplications(),
  })

  const submitMutation = useMutation({
    mutationFn: (vacancyId: string) => {
      const formData = new FormData()
      formData.append('cover_letter', coverLetter)
      if (resumeFile) formData.append('resume', resumeFile)
      if (coverLetterFile) formData.append('cover_letter_file', coverLetterFile)
      certificateFiles.forEach(f => formData.append('certificates', f))
      return recruitmentService.submitInternalApplication(vacancyId, formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-applications'] })
      queryClient.invalidateQueries({ queryKey: ['internal-vacancies'] })
      setApplyModalOpen(false)
      setCoverLetter('')
      setResumeFile(null)
      setCoverLetterFile(null)
      setCertificateFiles([])
      setSelectedVacancy(null)
      setEmployeeData({})
    },
  })

  const handleApplyClick = async (vacancy: InternalVacancy) => {
    setSelectedVacancy(vacancy)
    setCoverLetter('')
    setResumeFile(null)
    setCoverLetterFile(null)
    setCertificateFiles([])
    try {
      const detail = await recruitmentService.getInternalVacancyDetail(vacancy.id)
      setEmployeeData(detail.employee || {})
    } catch {
      setEmployeeData({})
    }
    setApplyModalOpen(true)
  }

  const appliedVacancyIds = new Set(applications.map((a) => a.vacancy_id))

  const filteredVacancies = vacancies.filter((v) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      v.job_title.toLowerCase().includes(q) ||
      v.department_name?.toLowerCase().includes(q) ||
      v.location_name?.toLowerCase().includes(q)
    )
  })

  if (loadingVacancies || loadingApplications) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Internal Job Board</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse and apply for internal vacancies
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <BriefcaseIcon className="h-8 w-8 mx-auto text-blue-500 mb-2" />
            <p className="text-sm text-gray-500">Open Positions</p>
            <p className="text-lg font-bold text-gray-900">{vacancies.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <PaperAirplaneIcon className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="text-sm text-gray-500">My Applications</p>
            <p className="text-lg font-bold text-gray-900">{applications.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircleIcon className="h-8 w-8 mx-auto text-purple-500 mb-2" />
            <p className="text-sm text-gray-500">Shortlisted</p>
            <p className="text-lg font-bold text-gray-900">
              {applications.filter((a) => a.status === 'SHORTLISTED').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="positions">Open Positions ({vacancies.length})</TabsTrigger>
          <TabsTrigger value="applications">My Applications ({applications.length})</TabsTrigger>
        </TabsList>

        {/* Open Positions Tab */}
        <TabsContent value="positions">
          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                placeholder="Search by title, department, or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>

          {filteredVacancies.length > 0 ? (
            <div className="space-y-4">
              {filteredVacancies.map((vacancy) => {
                const alreadyApplied = appliedVacancyIds.has(vacancy.id)
                return (
                  <Card key={vacancy.id}>
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-gray-900">
                              {vacancy.job_title}
                            </h3>
                            <Badge variant="info">{vacancy.employment_type}</Badge>
                          </div>

                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                            <div className="flex items-center gap-1.5">
                              <BuildingOfficeIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <span>{vacancy.department_name}</span>
                            </div>
                            {vacancy.location_name && (
                              <div className="flex items-center gap-1.5">
                                <BriefcaseIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <span>{vacancy.location_name}</span>
                              </div>
                            )}
                            {vacancy.closing_date && (
                              <div className="flex items-center gap-1.5">
                                <CalendarDaysIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <span>Closes: {formatDate(vacancy.closing_date)}</span>
                              </div>
                            )}
                            {vacancy.experience_required && (
                              <div className="flex items-center gap-1.5">
                                <ClockIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <span>{vacancy.experience_required}</span>
                              </div>
                            )}
                          </div>

                          {vacancy.job_description && (
                            <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                              {vacancy.job_description}
                            </p>
                          )}
                        </div>

                        <div className="flex-shrink-0">
                          {alreadyApplied ? (
                            <Badge variant="success">Applied</Badge>
                          ) : (
                            <button
                              onClick={() => handleApplyClick(vacancy)}
                              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors"
                            >
                              Apply
                            </button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <EmptyState
                  type="data"
                  title={search ? 'No matching positions' : 'No open positions'}
                  description={
                    search
                      ? 'Try adjusting your search terms.'
                      : 'There are currently no internal vacancies available. Check back later.'
                  }
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* My Applications Tab */}
        <TabsContent value="applications">
          {applications.length > 0 ? (
            <div className="space-y-4">
              {applications.map((app) => (
                <Card key={app.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-semibold text-gray-900">
                            {app.vacancy_title}
                          </h3>
                          <Badge variant={statusColors[app.status] || 'default'}>
                            {app.status_display}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {app.department} &middot; Applied {formatDate(app.application_date)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Ref: {app.applicant_number}
                        </p>

                        {/* Timeline */}
                        {app.timeline && app.timeline.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                              Status Timeline
                            </p>
                            <div className="space-y-2">
                              {app.timeline.map((entry, idx) => (
                                <div key={entry.id} className="flex items-start gap-3">
                                  <div className="flex flex-col items-center">
                                    <div
                                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                        idx === 0 ? 'bg-primary-500' : 'bg-gray-300'
                                      }`}
                                    />
                                    {idx < app.timeline.length - 1 && (
                                      <div className="w-px h-4 bg-gray-200" />
                                    )}
                                  </div>
                                  <div className="min-w-0 -mt-0.5">
                                    <p className="text-sm text-gray-700">
                                      {entry.display_message}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      {formatDate(entry.changed_at)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
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
                  title="No applications yet"
                  description="You haven't applied for any internal vacancies. Browse open positions to get started."
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Apply Modal */}
      <Modal
        isOpen={applyModalOpen}
        onClose={() => {
          setApplyModalOpen(false)
          setSelectedVacancy(null)
          setCoverLetter('')
          setResumeFile(null)
          setCoverLetterFile(null)
          setCertificateFiles([])
          setEmployeeData({})
        }}
        title={`Apply for ${selectedVacancy?.job_title || ''}`}
      >
        <div className="space-y-4">
          {/* Pre-filled employee info */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Your Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {employeeData.first_name && (
                <div>
                  <span className="text-gray-500">Name:</span>{' '}
                  <span className="font-medium text-gray-900">
                    {employeeData.first_name} {employeeData.middle_name} {employeeData.last_name}
                  </span>
                </div>
              )}
              {employeeData.employee_number && (
                <div>
                  <span className="text-gray-500">Staff No:</span>{' '}
                  <span className="font-medium text-gray-900">{employeeData.employee_number}</span>
                </div>
              )}
              {employeeData.email && (
                <div>
                  <span className="text-gray-500">Email:</span>{' '}
                  <span className="font-medium text-gray-900">{employeeData.email}</span>
                </div>
              )}
              {employeeData.phone && (
                <div>
                  <span className="text-gray-500">Phone:</span>{' '}
                  <span className="font-medium text-gray-900">{employeeData.phone}</span>
                </div>
              )}
              {employeeData.department && (
                <div>
                  <span className="text-gray-500">Department:</span>{' '}
                  <span className="font-medium text-gray-900">{employeeData.department}</span>
                </div>
              )}
              {employeeData.current_position && (
                <div>
                  <span className="text-gray-500">Current Position:</span>{' '}
                  <span className="font-medium text-gray-900">{employeeData.current_position}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              This information is automatically populated from your employee profile.
            </p>
          </div>

          {/* Cover letter */}
          <div>
            <label htmlFor="cover_letter" className="block text-sm font-medium text-gray-700 mb-1">
              Cover Letter / Statement of Interest
            </label>
            <textarea
              id="cover_letter"
              rows={5}
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              placeholder="Explain why you are interested in this position and what makes you a good fit..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500 focus:outline-none resize-none"
            />
          </div>

          {/* File Attachments */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700">Attachments</h4>

            {/* Resume */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Resume/CV</label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded cursor-pointer hover:bg-gray-200">
                  <DocumentArrowUpIcon className="h-3.5 w-3.5" />
                  {resumeFile ? resumeFile.name : 'Choose File'}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const err = validateFile(file, DOC_FORMATS)
                      if (err) { toast.error(err); e.target.value = ''; return }
                      setResumeFile(file)
                    }}
                  />
                </label>
                {resumeFile && (
                  <button type="button" onClick={() => setResumeFile(null)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Accepted: PDF, DOC, DOCX (max 10MB)</p>
            </div>

            {/* Cover Letter File */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cover Letter File (optional)</label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded cursor-pointer hover:bg-gray-200">
                  <DocumentArrowUpIcon className="h-3.5 w-3.5" />
                  {coverLetterFile ? coverLetterFile.name : 'Choose File'}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const err = validateFile(file, DOC_FORMATS)
                      if (err) { toast.error(err); e.target.value = ''; return }
                      setCoverLetterFile(file)
                    }}
                  />
                </label>
                {coverLetterFile && (
                  <button type="button" onClick={() => setCoverLetterFile(null)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Accepted: PDF, DOC, DOCX (max 10MB)</p>
            </div>

            {/* Certificates */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Certificates & Documents (optional)</label>
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded cursor-pointer hover:bg-gray-200 w-fit">
                <DocumentArrowUpIcon className="h-3.5 w-3.5" />
                Add Files
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    const valid: File[] = []
                    for (const file of files) {
                      const err = validateFile(file, CERT_FORMATS)
                      if (err) { toast.error(err); continue }
                      valid.push(file)
                    }
                    if (valid.length > 0) {
                      setCertificateFiles(prev => {
                        const combined = [...prev, ...valid]
                        if (combined.length > 5) {
                          toast.error('Maximum 5 certificate files allowed.')
                        }
                        return combined.slice(0, 5)
                      })
                    }
                    e.target.value = ''
                  }}
                />
              </label>
              {certificateFiles.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {certificateFiles.map((file, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs text-gray-700">
                      <span className="truncate">{file.name}</span>
                      <button type="button" onClick={() => setCertificateFiles(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 text-xs flex-shrink-0">Remove</button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-gray-400 mt-1">Accepted: PDF, DOC, DOCX, JPG, PNG (max 10MB each, up to 5 files)</p>
            </div>
          </div>

          {/* Error display */}
          {submitMutation.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">
                {(submitMutation.error as any)?.response?.data?.error ||
                  'Failed to submit application. Please try again.'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setApplyModalOpen(false)
                setSelectedVacancy(null)
                setCoverLetter('')
                setResumeFile(null)
                setCoverLetterFile(null)
                setCertificateFiles([])
                setEmployeeData({})
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => selectedVacancy && submitMutation.mutate(selectedVacancy.id)}
              disabled={submitMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
