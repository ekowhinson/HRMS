import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { recruitmentService, type Vacancy, type Applicant, type ShortlistCriteria } from '@/services/recruitment'

const statusColors: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'default',
  OPEN: 'success',
  PUBLISHED: 'success',
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

const criteriaTypeOptions = [
  { value: 'EDUCATION', label: 'Education Level' },
  { value: 'EXPERIENCE', label: 'Years of Experience' },
  { value: 'SKILL', label: 'Required Skill' },
  { value: 'QUALIFICATION', label: 'Professional Qualification' },
  { value: 'AGE_RANGE', label: 'Age Range' },
  { value: 'LOCATION', label: 'Location/Region' },
]

const matchTypeOptions: Record<string, { value: string; label: string }[]> = {
  EDUCATION: [
    { value: 'MINIMUM', label: 'Minimum Requirement' },
    { value: 'EXACT', label: 'Exact Match' },
  ],
  EXPERIENCE: [
    { value: 'MINIMUM', label: 'Minimum Years' },
    { value: 'MAXIMUM', label: 'Maximum Years' },
    { value: 'RANGE', label: 'Year Range' },
  ],
  SKILL: [
    { value: 'CONTAINS', label: 'Contains Keyword' },
  ],
  QUALIFICATION: [
    { value: 'CONTAINS', label: 'Contains Keyword' },
    { value: 'EXACT', label: 'Exact Match' },
  ],
  AGE_RANGE: [
    { value: 'RANGE', label: 'Within Range' },
  ],
  LOCATION: [
    { value: 'CONTAINS', label: 'Contains Keyword' },
    { value: 'EXACT', label: 'Exact Match' },
  ],
}

const educationOptions = [
  { value: 'SSCE', label: 'SSCE / High School' },
  { value: 'Certificate', label: 'Certificate' },
  { value: 'Diploma', label: 'Diploma' },
  { value: 'HND', label: 'HND' },
  { value: 'Bachelors', label: "Bachelor's Degree" },
  { value: 'Masters', label: "Master's Degree" },
  { value: 'PhD', label: 'PhD / Doctorate' },
]

interface CriteriaFormData {
  criteria_type: string
  match_type: string
  name: string
  value_text: string
  value_number: string
  value_min: string
  value_max: string
  weight: string
  max_score: string
  is_mandatory: boolean
}

const initialCriteriaForm: CriteriaFormData = {
  criteria_type: 'EDUCATION',
  match_type: 'MINIMUM',
  name: '',
  value_text: '',
  value_number: '',
  value_min: '',
  value_max: '',
  weight: '1.00',
  max_score: '10',
  is_mandatory: false,
}

function getCriteriaDisplayValue(c: ShortlistCriteria): string {
  if (c.criteria_type === 'AGE_RANGE' || (c.match_type === 'RANGE' && c.value_min != null)) {
    return `${c.value_min ?? ''} - ${c.value_max ?? ''}`
  }
  if (c.value_text) return c.value_text
  if (c.value_number != null) return String(c.value_number)
  return '-'
}

export default function VacancyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [vacancy, setVacancy] = useState<Vacancy | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [criteria, setCriteria] = useState<ShortlistCriteria[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('details')

  // Criteria form state
  const [showCriteriaForm, setShowCriteriaForm] = useState(false)
  const [criteriaForm, setCriteriaForm] = useState<CriteriaFormData>(initialCriteriaForm)
  const [savingCriteria, setSavingCriteria] = useState(false)
  const [runningShortlist, setRunningShortlist] = useState(false)

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
      toast.success('Vacancy published')
      loadVacancy()
    } catch (error) {
      console.error('Error publishing vacancy:', error)
      toast.error('Failed to publish vacancy')
    }
  }

  const handleClose = async () => {
    if (!id) return
    try {
      await recruitmentService.closeVacancy(id)
      toast.success('Vacancy closed')
      loadVacancy()
    } catch (error) {
      console.error('Error closing vacancy:', error)
      toast.error('Failed to close vacancy')
    }
  }

  const handleRunShortlist = async () => {
    if (!id) return
    setRunningShortlist(true)
    try {
      const run = await recruitmentService.createShortlistRun(id)
      await recruitmentService.executeShortlistRun(run.id)
      toast.success(`Shortlist complete: ${run.qualified_count || 0} qualified`)
      loadVacancy()
    } catch (error: any) {
      console.error('Error running shortlist:', error)
      toast.error(error.response?.data?.error || 'Failed to run shortlist')
    } finally {
      setRunningShortlist(false)
    }
  }

  // --- Criteria CRUD ---

  const handleCriteriaTypeChange = (type: string) => {
    const availableMatches = matchTypeOptions[type] || []
    setCriteriaForm((prev) => ({
      ...prev,
      criteria_type: type,
      match_type: availableMatches[0]?.value || 'MINIMUM',
      name: '',
      value_text: '',
      value_number: '',
      value_min: '',
      value_max: '',
    }))
  }

  const getAutoName = (): string => {
    const type = criteriaForm.criteria_type
    const val = criteriaForm.value_text || criteriaForm.value_number || ''
    switch (type) {
      case 'EDUCATION': return `Minimum Education: ${val || '...'}`
      case 'EXPERIENCE': return `Experience: ${criteriaForm.match_type === 'RANGE' ? `${criteriaForm.value_min}-${criteriaForm.value_max} yrs` : `${val} yrs`}`
      case 'SKILL': return `Skill: ${val || '...'}`
      case 'QUALIFICATION': return `Qualification: ${val || '...'}`
      case 'AGE_RANGE': return `Age: ${criteriaForm.value_min}-${criteriaForm.value_max}`
      case 'LOCATION': return `Location: ${val || '...'}`
      default: return val
    }
  }

  const handleSaveCriteria = async () => {
    if (!id) return

    const name = criteriaForm.name || getAutoName()
    if (!name) {
      toast.error('Please fill in the required fields')
      return
    }

    setSavingCriteria(true)
    try {
      const data: Record<string, any> = {
        vacancy: id,
        criteria_type: criteriaForm.criteria_type,
        match_type: criteriaForm.match_type,
        name,
        weight: parseFloat(criteriaForm.weight) || 1,
        max_score: parseInt(criteriaForm.max_score) || 10,
        is_mandatory: criteriaForm.is_mandatory,
        sort_order: criteria.length,
      }

      // Set value fields based on type
      if (['EDUCATION', 'SKILL', 'QUALIFICATION', 'LOCATION'].includes(criteriaForm.criteria_type)) {
        data.value_text = criteriaForm.value_text
      }
      if (['EXPERIENCE'].includes(criteriaForm.criteria_type) && criteriaForm.match_type !== 'RANGE') {
        data.value_number = parseFloat(criteriaForm.value_number) || 0
      }
      if (criteriaForm.match_type === 'RANGE' || criteriaForm.criteria_type === 'AGE_RANGE') {
        data.value_min = parseFloat(criteriaForm.value_min) || 0
        data.value_max = parseFloat(criteriaForm.value_max) || 0
      }

      await recruitmentService.createShortlistCriteria(data as Partial<ShortlistCriteria>)
      toast.success('Criteria added')
      setCriteriaForm(initialCriteriaForm)
      setShowCriteriaForm(false)
      loadVacancy()
    } catch (error: any) {
      const detail = error.response?.data
      if (detail && typeof detail === 'object') {
        const msg = Object.entries(detail)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('; ')
        toast.error(msg)
      } else {
        toast.error('Failed to save criteria')
      }
    } finally {
      setSavingCriteria(false)
    }
  }

  const handleDeleteCriteria = async (criterionId: string) => {
    try {
      await recruitmentService.deleteShortlistCriteria(criterionId)
      toast.success('Criteria removed')
      setCriteria((prev) => prev.filter((c) => c.id !== criterionId))
    } catch (error) {
      toast.error('Failed to delete criteria')
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
          {(vacancy.status === 'DRAFT' || vacancy.status === 'APPROVED') && (
            <Button onClick={handlePublish}>Publish</Button>
          )}
          {(vacancy.status === 'OPEN' || vacancy.status === 'PUBLISHED') && (
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
          <TabsTrigger value="shortlisting">
            Shortlisting ({criteria.length})
          </TabsTrigger>
          <TabsTrigger value="urls">Application URLs</TabsTrigger>
        </TabsList>

        {/* ========== Details Tab ========== */}
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

        {/* ========== Applicants Tab ========== */}
        <TabsContent value="applicants" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Applicants</CardTitle>
                {criteria.length > 0 && (
                  <Button onClick={handleRunShortlist} isLoading={runningShortlist}>
                    Run Shortlist
                  </Button>
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

        {/* ========== Shortlisting Tab ========== */}
        <TabsContent value="shortlisting" className="mt-4 space-y-6">
          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Define shortlisting criteria below. When auto-shortlist is enabled on this vacancy,
              new applicants are automatically scored against these criteria and shortlisted if they
              meet the pass threshold (60%). You can also run a manual shortlist from the Applicants tab.
            </p>
          </div>

          {/* Add Criteria Form */}
          {showCriteriaForm && (
            <Card>
              <CardHeader>
                <CardTitle>Add Shortlisting Criteria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Criteria Type"
                    value={criteriaForm.criteria_type}
                    onChange={(e) => handleCriteriaTypeChange(e.target.value)}
                    options={criteriaTypeOptions}
                  />
                  <Select
                    label="Match Type"
                    value={criteriaForm.match_type}
                    onChange={(e) => setCriteriaForm((prev) => ({ ...prev, match_type: e.target.value }))}
                    options={matchTypeOptions[criteriaForm.criteria_type] || []}
                  />
                </div>

                {/* Type-specific value fields */}
                {criteriaForm.criteria_type === 'EDUCATION' && (
                  <Select
                    label="Required Education Level"
                    value={criteriaForm.value_text}
                    onChange={(e) => setCriteriaForm((prev) => ({ ...prev, value_text: e.target.value }))}
                    options={[{ value: '', label: 'Select education level...' }, ...educationOptions]}
                  />
                )}

                {criteriaForm.criteria_type === 'EXPERIENCE' && criteriaForm.match_type !== 'RANGE' && (
                  <Input
                    label={criteriaForm.match_type === 'MAXIMUM' ? 'Maximum Years' : 'Minimum Years'}
                    type="number"
                    value={criteriaForm.value_number}
                    onChange={(e) => setCriteriaForm((prev) => ({ ...prev, value_number: e.target.value }))}
                    placeholder="e.g., 3"
                    min={0}
                  />
                )}

                {(criteriaForm.match_type === 'RANGE' || criteriaForm.criteria_type === 'AGE_RANGE') && (
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Minimum"
                      type="number"
                      value={criteriaForm.value_min}
                      onChange={(e) => setCriteriaForm((prev) => ({ ...prev, value_min: e.target.value }))}
                      placeholder="Min"
                      min={0}
                    />
                    <Input
                      label="Maximum"
                      type="number"
                      value={criteriaForm.value_max}
                      onChange={(e) => setCriteriaForm((prev) => ({ ...prev, value_max: e.target.value }))}
                      placeholder="Max"
                      min={0}
                    />
                  </div>
                )}

                {['SKILL', 'QUALIFICATION', 'LOCATION'].includes(criteriaForm.criteria_type) && (
                  <Input
                    label={
                      criteriaForm.criteria_type === 'SKILL' ? 'Required Skill / Keyword' :
                      criteriaForm.criteria_type === 'QUALIFICATION' ? 'Qualification / Certification' :
                      'Location / Region'
                    }
                    value={criteriaForm.value_text}
                    onChange={(e) => setCriteriaForm((prev) => ({ ...prev, value_text: e.target.value }))}
                    placeholder={
                      criteriaForm.criteria_type === 'SKILL' ? 'e.g., Python, Project Management' :
                      criteriaForm.criteria_type === 'QUALIFICATION' ? 'e.g., CPA, PMP, ACCA' :
                      'e.g., Accra, Greater Accra'
                    }
                  />
                )}

                <Input
                  label="Criteria Name (auto-generated if empty)"
                  value={criteriaForm.name}
                  onChange={(e) => setCriteriaForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={getAutoName()}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Weight"
                    type="number"
                    value={criteriaForm.weight}
                    onChange={(e) => setCriteriaForm((prev) => ({ ...prev, weight: e.target.value }))}
                    min={0.1}
                    step={0.1}
                  />
                  <Input
                    label="Max Score"
                    type="number"
                    value={criteriaForm.max_score}
                    onChange={(e) => setCriteriaForm((prev) => ({ ...prev, max_score: e.target.value }))}
                    min={1}
                  />
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={criteriaForm.is_mandatory}
                        onChange={(e) => setCriteriaForm((prev) => ({ ...prev, is_mandatory: e.target.checked }))}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Mandatory (failing disqualifies)
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={handleSaveCriteria} isLoading={savingCriteria}>
                    Add Criteria
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCriteriaForm(false)
                      setCriteriaForm(initialCriteriaForm)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Criteria List */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Shortlisting Criteria</CardTitle>
                {!showCriteriaForm && (
                  <Button size="sm" onClick={() => setShowCriteriaForm(true)}>
                    Add Criteria
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {criteria.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">
                    No shortlisting criteria defined. Add criteria to enable automatic shortlisting.
                  </p>
                  {!showCriteriaForm && (
                    <Button variant="outline" onClick={() => setShowCriteriaForm(true)}>
                      Add Your First Criteria
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criteria</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Match</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weight</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Score</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {criteria.map((criterion) => (
                        <tr key={criterion.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{criterion.name}</td>
                          <td className="px-4 py-3">
                            <Badge variant="info">{criterion.criteria_type_display || criterion.criteria_type}</Badge>
                          </td>
                          <td className="px-4 py-3">{getCriteriaDisplayValue(criterion)}</td>
                          <td className="px-4 py-3 text-sm">{criterion.match_type_display || criterion.match_type}</td>
                          <td className="px-4 py-3">{criterion.weight}</td>
                          <td className="px-4 py-3">{criterion.max_score}</td>
                          <td className="px-4 py-3">
                            {criterion.is_mandatory ? (
                              <Badge variant="danger">Required</Badge>
                            ) : (
                              <Badge variant="default">Optional</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteCriteria(criterion.id)}
                            >
                              Remove
                            </Button>
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

        {/* ========== URLs Tab ========== */}
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
