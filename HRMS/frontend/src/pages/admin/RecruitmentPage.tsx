import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { TablePagination } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import StatsCard from '@/components/ui/StatsCard'
import { recruitmentService, type Vacancy, type Applicant, type Interview } from '@/services/recruitment'

const statusColors: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  // Vacancy statuses
  DRAFT: 'default',
  OPEN: 'success',
  ON_HOLD: 'warning',
  CLOSED: 'default',
  FILLED: 'info',
  CANCELLED: 'danger',
  // Applicant statuses
  NEW: 'info',
  SCREENING: 'warning',
  SHORTLISTED: 'success',
  INTERVIEW: 'info',
  OFFER: 'success',
  HIRED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'default',
  // Interview statuses
  SCHEDULED: 'info',
  COMPLETED: 'success',
  NO_SHOW: 'danger',
  RESCHEDULED: 'warning',
}

export default function RecruitmentPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'vacancies'

  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [summary, setSummary] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      const summaryData = await recruitmentService.getRecruitmentSummary()
      setSummary(summaryData)

      if (activeTab === 'vacancies') {
        const data = await recruitmentService.getVacancies({ search })
        setVacancies(data.results || [])
      } else if (activeTab === 'applicants') {
        const data = await recruitmentService.getApplicants({ search })
        setApplicants(data.results || [])
      } else if (activeTab === 'interviews') {
        const data = await recruitmentService.getInterviews()
        setInterviews(data.results || [])
      }
    } catch (error) {
      console.error('Error loading recruitment data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab })
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Recruitment</h1>
          <p className="text-gray-500">Manage vacancies, applicants, and interviews</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/recruitment/vacancies/new">
            <Button>Create Vacancy</Button>
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatsCard
            title="Open Vacancies"
            value={summary.vacancies?.open || 0}
          />
          <StatsCard
            title="Total Applicants"
            value={summary.applicants?.total || 0}
          />
          <StatsCard
            title="Interviews This Week"
            value={summary.interviews?.this_week || 0}
          />
          <StatsCard
            title="Pending Offers"
            value={summary.offers?.pending || 0}
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="vacancies">Vacancies</TabsTrigger>
          <TabsTrigger value="applicants">Applicants</TabsTrigger>
          <TabsTrigger value="interviews">Interviews</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
        </TabsList>

        <TabsContent value="vacancies" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Job Vacancies</CardTitle>
                <Input
                  placeholder="Search vacancies..."
                  value={search}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setCurrentPage(1) }}
                  className="w-64"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applications</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Closing Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          Loading...
                        </td>
                      </tr>
                    ) : vacancies.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No vacancies found
                        </td>
                      </tr>
                    ) : (
                      vacancies.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((vacancy) => (
                        <tr key={vacancy.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{vacancy.reference_number}</td>
                          <td className="px-4 py-3">
                            <Link
                              to={`/admin/recruitment/vacancies/${vacancy.id}`}
                              className="text-primary-600 hover:underline"
                            >
                              {vacancy.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3">{vacancy.department_name || '-'}</td>
                          <td className="px-4 py-3">
                            <Badge variant={statusColors[vacancy.status] || 'default'}>
                              {vacancy.status_display || vacancy.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">{vacancy.applications_count || 0}</td>
                          <td className="px-4 py-3">
                            {vacancy.closing_date
                              ? new Date(vacancy.closing_date).toLocaleDateString()
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Link to={`/admin/recruitment/vacancies/${vacancy.id}`}>
                                <Button variant="outline" size="sm">View</Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {vacancies.length > pageSize && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(vacancies.length / pageSize)}
                  totalItems={vacancies.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applicants" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>All Applicants</CardTitle>
                <Input
                  placeholder="Search applicants..."
                  value={search}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setCurrentPage(1) }}
                  className="w-64"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Application #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applied</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          Loading...
                        </td>
                      </tr>
                    ) : applicants.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No applicants found
                        </td>
                      </tr>
                    ) : (
                      applicants.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((applicant) => (
                        <tr key={applicant.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{applicant.application_number}</td>
                          <td className="px-4 py-3">
                            <Link
                              to={`/admin/recruitment/applicants/${applicant.id}`}
                              className="text-primary-600 hover:underline"
                            >
                              {applicant.full_name}
                            </Link>
                            <div className="text-sm text-gray-500">{applicant.email}</div>
                          </td>
                          <td className="px-4 py-3">{applicant.vacancy_title}</td>
                          <td className="px-4 py-3">
                            <Badge variant={statusColors[applicant.status] || 'default'}>
                              {applicant.status_display || applicant.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {new Date(applicant.applied_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            {applicant.shortlist_score
                              ? `${applicant.shortlist_score.toFixed(1)}%`
                              : '-'}
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
              {applicants.length > pageSize && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(applicants.length / pageSize)}
                  totalItems={applicants.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interviews" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Interviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Panel</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          Loading...
                        </td>
                      </tr>
                    ) : interviews.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No interviews scheduled
                        </td>
                      </tr>
                    ) : (
                      interviews.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((interview) => (
                        <tr key={interview.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{interview.applicant_name}</td>
                          <td className="px-4 py-3">{interview.vacancy_title}</td>
                          <td className="px-4 py-3">{interview.interview_type_display}</td>
                          <td className="px-4 py-3">
                            {new Date(interview.scheduled_date).toLocaleDateString()}
                            <br />
                            <span className="text-sm text-gray-500">{interview.scheduled_time}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusColors[interview.status] || 'default'}>
                              {interview.status_display || interview.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {interview.panel_members?.length || 0} members
                          </td>
                          <td className="px-4 py-3">
                            <Link to={`/admin/recruitment/interviews/${interview.id}`}>
                              <Button variant="outline" size="sm">View</Button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {interviews.length > pageSize && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(interviews.length / pageSize)}
                  totalItems={interviews.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Job Offers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 text-center py-8">
                View and manage job offers from the applicant details page.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
