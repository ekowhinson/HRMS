import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { recruitmentService, type Vacancy, type Applicant, type ShortlistCriteria } from '@/services/recruitment'

const statusColors: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'default',
  OPEN: 'success',
  ON_HOLD: 'warning',
  CLOSED: 'default',
  FILLED: 'info',
  CANCELLED: 'danger',
  NEW: 'info',
  SCREENING: 'warning',
  SHORTLISTED: 'success',
  INTERVIEW: 'info',
  OFFER: 'success',
  HIRED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'default',
}

export default function VacancyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [vacancy, setVacancy] = useState<Vacancy | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [criteria, setCriteria] = useState<ShortlistCriteria[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('details')

  useEffect(() => {
    if (id) {
      loadVacancy()
    }
  }, [id])

  const loadVacancy = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [vacancyData, applicantsData, criteriaData] = await Promise.all([
        recruitmentService.getVacancy(id),
        recruitmentService.getApplicants({ vacancy: id }),
        recruitmentService.getShortlistCriteria(id),
      ])
      setVacancy(vacancyData)
      setApplicants(applicantsData.results || [])
      setCriteria(criteriaData)
    } catch (error) {
      console.error('Error loading vacancy:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async () => {
    if (!id) return
    try {
      await recruitmentService.publishVacancy(id)
      loadVacancy()
    } catch (error) {
      console.error('Error publishing vacancy:', error)
    }
  }

  const handleClose = async () => {
    if (!id) return
    try {
      await recruitmentService.closeVacancy(id)
      loadVacancy()
    } catch (error) {
      console.error('Error closing vacancy:', error)
    }
  }

  const handleRunShortlist = async () => {
    if (!id) return
    try {
      const run = await recruitmentService.createShortlistRun(id)
      await recruitmentService.executeShortlistRun(run.id)
      loadVacancy()
    } catch (error) {
      console.error('Error running shortlist:', error)
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>
  }

  if (!vacancy) {
    return <div className="p-8 text-center">Vacancy not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{vacancy.title}</h1>
            <Badge variant={statusColors[vacancy.status] || 'default'}>
              {vacancy.status_display || vacancy.status}
            </Badge>
          </div>
          <p className="text-gray-500">
            {vacancy.reference_number} | {vacancy.department_name || 'No Department'}
          </p>
        </div>
        <div className="flex gap-2">
          {vacancy.status === 'DRAFT' && (
            <Button onClick={handlePublish}>Publish</Button>
          )}
          {vacancy.status === 'OPEN' && (
            <Button variant="outline" onClick={handleClose}>Close</Button>
          )}
          <Link to={`/admin/recruitment/vacancies/${id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
          <Button variant="outline" onClick={() => navigate('/admin/recruitment')}>
            Back
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="applicants">
            Applicants ({applicants.length})
          </TabsTrigger>
          <TabsTrigger value="shortlisting">Shortlisting</TabsTrigger>
          <TabsTrigger value="urls">Application URLs</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Job Description</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Description</h4>
                  <p className="text-gray-600 whitespace-pre-wrap">{vacancy.description || 'No description'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Requirements</h4>
                  <p className="text-gray-600 whitespace-pre-wrap">{vacancy.requirements || 'No requirements specified'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Responsibilities</h4>
                  <p className="text-gray-600 whitespace-pre-wrap">{vacancy.responsibilities || 'No responsibilities specified'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Qualifications</h4>
                  <p className="text-gray-600 whitespace-pre-wrap">{vacancy.qualifications || 'No qualifications specified'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Job Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Position</span>
                  <span className="font-medium">{vacancy.position_title || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Grade</span>
                  <span className="font-medium">{vacancy.grade_name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Location</span>
                  <span className="font-medium">{vacancy.location_name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Employment Type</span>
                  <span className="font-medium">{vacancy.employment_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Experience</span>
                  <span className="font-medium">
                    {vacancy.experience_years ? `${vacancy.experience_years} years` : '-'}
                  </span>
                </div>
                {vacancy.show_salary && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Salary Range</span>
                    <span className="font-medium">
                      {vacancy.salary_min && vacancy.salary_max
                        ? `GHS ${vacancy.salary_min.toLocaleString()} - ${vacancy.salary_max.toLocaleString()}`
                        : '-'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Openings</span>
                  <span className="font-medium">{vacancy.filled}/{vacancy.openings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Closing Date</span>
                  <span className="font-medium">
                    {vacancy.closing_date
                      ? new Date(vacancy.closing_date).toLocaleDateString()
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Hiring Manager</span>
                  <span className="font-medium">{vacancy.hiring_manager_name || '-'}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="applicants" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Applicants</CardTitle>
                {criteria.length > 0 && (
                  <Button onClick={handleRunShortlist}>Run Shortlist</Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Experience</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applied</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {applicants.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No applicants yet
                        </td>
                      </tr>
                    ) : (
                      applicants.map((applicant) => (
                        <tr key={applicant.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">
                            <Link
                              to={`/admin/recruitment/applicants/${applicant.id}`}
                              className="text-primary-600 hover:underline"
                            >
                              {applicant.full_name}
                            </Link>
                          </td>
                          <td className="px-4 py-3">{applicant.email}</td>
                          <td className="px-4 py-3">
                            {applicant.years_of_experience
                              ? `${applicant.years_of_experience} years`
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusColors[applicant.status] || 'default'}>
                              {applicant.status_display || applicant.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {applicant.shortlist_score
                              ? `${applicant.shortlist_score.toFixed(1)}%`
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            {new Date(applicant.applied_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <Link to={`/admin/recruitment/applicants/${applicant.id}`}>
                              <Button variant="outline" size="sm">View</Button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shortlisting" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Shortlisting Criteria</CardTitle>
                <Button variant="outline" size="sm">Add Criteria</Button>
              </div>
            </CardHeader>
            <CardContent>
              {criteria.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No shortlisting criteria defined. Add criteria to enable automatic shortlisting.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Match Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weight</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Score</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mandatory</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {criteria.map((criterion) => (
                        <tr key={criterion.id}>
                          <td className="px-4 py-3">{criterion.criteria_type_display}</td>
                          <td className="px-4 py-3">{criterion.value}</td>
                          <td className="px-4 py-3">{criterion.match_type}</td>
                          <td className="px-4 py-3">{criterion.weight}</td>
                          <td className="px-4 py-3">{criterion.max_score}</td>
                          <td className="px-4 py-3">
                            {criterion.is_mandatory ? (
                              <Badge variant="danger">Required</Badge>
                            ) : (
                              <Badge variant="default">Optional</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="urls" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Application URLs</CardTitle>
                <Button variant="outline" size="sm">Generate URL</Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 text-center py-8">
                Generate shareable URLs for candidates to apply directly.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
