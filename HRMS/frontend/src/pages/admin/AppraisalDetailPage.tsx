import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  CalculatorIcon,
  ChartBarIcon,
  FlagIcon,
  StarIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline'
import {
  performanceService,
  type Goal,
  type CompetencyAssessment,
  type CoreValueAssessment,
  type AppraisalScores,
} from '@/services/performance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  GOAL_SETTING: 'info',
  GOALS_SUBMITTED: 'info',
  GOALS_APPROVED: 'info',
  IN_PROGRESS: 'warning',
  SELF_ASSESSMENT: 'warning',
  MANAGER_REVIEW: 'warning',
  MEETING: 'warning',
  CALIBRATION: 'warning',
  COMPLETED: 'success',
  ACKNOWLEDGED: 'success',
}

interface GoalFormData {
  title: string
  description: string
  key_results: string
  weight: number
  target_date: string
  self_rating: number | null
  self_comments: string
  manager_rating: number | null
  manager_comments: string
}

const initialGoalForm: GoalFormData = {
  title: '',
  description: '',
  key_results: '',
  weight: 20,
  target_date: '',
  self_rating: null,
  self_comments: '',
  manager_rating: null,
  manager_comments: '',
}

export default function AppraisalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('goals')
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [goalForm, setGoalForm] = useState<GoalFormData>(initialGoalForm)
  const [showScoreModal, setShowScoreModal] = useState(false)
  const [calculatedScores, setCalculatedScores] = useState<AppraisalScores | null>(null)

  // Fetch appraisal detail
  const { data: appraisal, isLoading } = useQuery({
    queryKey: ['appraisal-detail', id],
    queryFn: () => performanceService.getAppraisalDetail(id!),
    enabled: !!id,
  })

  // Goal mutations
  const createGoalMutation = useMutation({
    mutationFn: (data: any) => performanceService.createGoal({ ...data, appraisal: id }),
    onSuccess: () => {
      toast.success('Goal added successfully')
      queryClient.invalidateQueries({ queryKey: ['appraisal-detail', id] })
      handleCloseGoalModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to add goal')
    },
  })

  const updateGoalMutation = useMutation({
    mutationFn: ({ goalId, data }: { goalId: string; data: any }) =>
      performanceService.updateGoal(goalId, data),
    onSuccess: () => {
      toast.success('Goal updated successfully')
      queryClient.invalidateQueries({ queryKey: ['appraisal-detail', id] })
      handleCloseGoalModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update goal')
    },
  })

  const deleteGoalMutation = useMutation({
    mutationFn: performanceService.deleteGoal,
    onSuccess: () => {
      toast.success('Goal deleted')
      queryClient.invalidateQueries({ queryKey: ['appraisal-detail', id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete goal')
    },
  })

  // Value assessment mutation
  const updateValueAssessmentMutation = useMutation({
    mutationFn: ({ assessmentId, data }: { assessmentId: string; data: any }) =>
      performanceService.updateValueAssessment(assessmentId, data),
    onSuccess: () => {
      toast.success('Assessment updated')
      queryClient.invalidateQueries({ queryKey: ['appraisal-detail', id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update assessment')
    },
  })

  // Submit self-assessment
  const submitSelfAssessmentMutation = useMutation({
    mutationFn: () => performanceService.submitSelfAssessment(id!),
    onSuccess: () => {
      toast.success('Self assessment submitted')
      queryClient.invalidateQueries({ queryKey: ['appraisal-detail', id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit self assessment')
    },
  })

  // Complete review
  const completeReviewMutation = useMutation({
    mutationFn: () => performanceService.completeReview(id!),
    onSuccess: () => {
      toast.success('Review completed')
      queryClient.invalidateQueries({ queryKey: ['appraisal-detail', id] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to complete review')
    },
  })

  // Calculate scores
  const calculateScoresMutation = useMutation({
    mutationFn: (save: boolean) => performanceService.calculateAppraisalScores(id!, save),
    onSuccess: (data) => {
      setCalculatedScores(data)
      setShowScoreModal(true)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to calculate scores')
    },
  })

  const handleOpenGoalModal = (goal?: Goal) => {
    if (goal) {
      setEditingGoal(goal)
      setGoalForm({
        title: goal.title,
        description: goal.description,
        key_results: goal.key_results || '',
        weight: goal.weight,
        target_date: goal.target_date || '',
        self_rating: goal.self_rating,
        self_comments: goal.self_comments || '',
        manager_rating: goal.manager_rating,
        manager_comments: goal.manager_comments || '',
      })
    } else {
      setEditingGoal(null)
      setGoalForm(initialGoalForm)
    }
    setShowGoalModal(true)
  }

  const handleCloseGoalModal = () => {
    setShowGoalModal(false)
    setEditingGoal(null)
    setGoalForm(initialGoalForm)
  }

  const handleSaveGoal = () => {
    if (!goalForm.title) {
      toast.error('Please enter a goal title')
      return
    }

    const data = {
      title: goalForm.title,
      description: goalForm.description,
      key_results: goalForm.key_results,
      weight: goalForm.weight,
      target_date: goalForm.target_date || null,
      self_rating: goalForm.self_rating,
      self_comments: goalForm.self_comments,
      manager_rating: goalForm.manager_rating,
      manager_comments: goalForm.manager_comments,
    }

    if (editingGoal) {
      updateGoalMutation.mutate({ goalId: editingGoal.id, data })
    } else {
      createGoalMutation.mutate(data)
    }
  }

  const handleUpdateValueAssessment = (assessment: CoreValueAssessment, field: string, value: any) => {
    updateValueAssessmentMutation.mutate({
      assessmentId: assessment.id,
      data: { [field]: value },
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!appraisal) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Appraisal not found</p>
        <Button variant="outline" onClick={() => navigate('/admin/appraisals')} className="mt-4">
          Back to Appraisals
        </Button>
      </div>
    )
  }

  const totalGoalWeight = appraisal.goals?.reduce((sum, g) => sum + (g.weight || 0), 0) || 0
  const canAddGoal = appraisal.status === 'DRAFT' || appraisal.status === 'GOAL_SETTING'
  const canRateSelf = appraisal.status === 'SELF_ASSESSMENT' || appraisal.status === 'IN_PROGRESS'
  const canRateAsManager = appraisal.status === 'MANAGER_REVIEW'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/appraisals')}>
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <Avatar
            firstName={appraisal.employee_name?.split(' ')[0]}
            lastName={appraisal.employee_name?.split(' ')[1]}
            size="lg"
          />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{appraisal.employee_name}</h1>
            <p className="text-sm text-gray-500">
              {appraisal.position_title} • {appraisal.department_name}
            </p>
            <p className="text-sm text-gray-500">
              Cycle: {appraisal.cycle_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={statusColors[appraisal.status] || 'default'} className="text-sm">
            {appraisal.status_display || appraisal.status?.replace('_', ' ')}
          </Badge>

          <Button
            variant="outline"
            onClick={() => calculateScoresMutation.mutate(false)}
            isLoading={calculateScoresMutation.isPending}
          >
            <CalculatorIcon className="h-4 w-4 mr-2" />
            Calculate Scores
          </Button>

          {canRateSelf && (
            <Button
              onClick={() => submitSelfAssessmentMutation.mutate()}
              isLoading={submitSelfAssessmentMutation.isPending}
            >
              Submit Self Assessment
            </Button>
          )}

          {canRateAsManager && (
            <Button
              onClick={() => completeReviewMutation.mutate()}
              isLoading={completeReviewMutation.isPending}
            >
              Complete Review
            </Button>
          )}
        </div>
      </div>

      {/* Overall Ratings Summary */}
      {(appraisal.overall_self_rating || appraisal.overall_final_rating) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-gray-500">Self Rating</p>
              <p className="text-2xl font-bold text-blue-600">
                {appraisal.overall_self_rating?.toFixed(1) || '-'}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-gray-500">Manager Rating</p>
              <p className="text-2xl font-bold text-green-600">
                {appraisal.overall_manager_rating?.toFixed(1) || '-'}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-gray-500">Final Rating</p>
              <p className="text-2xl font-bold text-primary-600">
                {appraisal.overall_final_rating?.toFixed(1) || '-'}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-gray-500">Status</p>
              {appraisal.overall_final_rating && appraisal.overall_final_rating >= 60 ? (
                <p className="text-lg font-bold text-green-600">Passed</p>
              ) : appraisal.overall_final_rating ? (
                <p className="text-lg font-bold text-red-600">PIP Required</p>
              ) : (
                <p className="text-lg font-bold text-gray-400">Pending</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="goals" className="flex items-center gap-2">
            <FlagIcon className="h-4 w-4" />
            Goals ({appraisal.goals?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="competencies" className="flex items-center gap-2">
            <AcademicCapIcon className="h-4 w-4" />
            Competencies
          </TabsTrigger>
          <TabsTrigger value="values" className="flex items-center gap-2">
            <StarIcon className="h-4 w-4" />
            Core Values
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <ChartBarIcon className="h-4 w-4" />
            Summary
          </TabsTrigger>
        </TabsList>

        {/* Goals Tab */}
        <TabsContent value="goals">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center">
                <FlagIcon className="h-5 w-5 mr-2 text-primary-500" />
                Performance Goals
                <span className="ml-2 text-sm font-normal text-gray-500">
                  (Total Weight: {totalGoalWeight}%)
                </span>
              </CardTitle>
              {canAddGoal && (
                <Button size="sm" onClick={() => handleOpenGoalModal()}>
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Goal
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {appraisal.goals && appraisal.goals.length > 0 ? (
                <div className="space-y-4">
                  {appraisal.goals.map((goal: Goal) => (
                    <div
                      key={goal.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{goal.title}</h4>
                            <Badge variant="info">{goal.weight}%</Badge>
                            <Badge variant={goal.status === 'APPROVED' ? 'success' : 'default'}>
                              {goal.status_display || goal.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                          {goal.key_results && (
                            <p className="text-sm text-gray-500 mt-1">
                              <strong>Key Results:</strong> {goal.key_results}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenGoalModal(goal)}
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </Button>
                          {canAddGoal && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteGoalMutation.mutate(goal.id)}
                            >
                              <TrashIcon className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-500">Progress</span>
                          <span className="font-medium">{goal.progress_percentage || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full transition-all"
                            style={{ width: `${goal.progress_percentage || 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Ratings */}
                      <div className="mt-3 grid grid-cols-3 gap-4 pt-3 border-t">
                        <div>
                          <span className="text-xs text-gray-500">Self Rating</span>
                          <p className="font-medium">
                            {goal.self_rating !== null ? `${goal.self_rating}/5` : '-'}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Manager Rating</span>
                          <p className="font-medium">
                            {goal.manager_rating !== null ? `${goal.manager_rating}/5` : '-'}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Final Rating</span>
                          <p className="font-medium text-primary-600">
                            {goal.final_rating !== null ? `${goal.final_rating}/5` : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FlagIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p>No goals defined yet</p>
                  {canAddGoal && (
                    <Button size="sm" className="mt-3" onClick={() => handleOpenGoalModal()}>
                      Add First Goal
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Competencies Tab */}
        <TabsContent value="competencies">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AcademicCapIcon className="h-5 w-5 mr-2 text-green-500" />
                Competency Assessments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appraisal.competency_assessments && appraisal.competency_assessments.length > 0 ? (
                <div className="space-y-4">
                  {appraisal.competency_assessments.map((assessment: CompetencyAssessment) => (
                    <div key={assessment.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {assessment.competency_name}
                          </h4>
                          <p className="text-sm text-gray-500">
                            Code: {assessment.competency_code}
                          </p>
                        </div>
                        <Badge variant="info">
                          Expected Level: {assessment.expected_level}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-4 pt-3 border-t">
                        <div>
                          <span className="text-xs text-gray-500">Self Rating</span>
                          <p className="font-medium">
                            {assessment.self_rating !== null ? `${assessment.self_rating}/5` : '-'}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Manager Rating</span>
                          <p className="font-medium">
                            {assessment.manager_rating !== null ? `${assessment.manager_rating}/5` : '-'}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Final Rating</span>
                          <p className="font-medium text-primary-600">
                            {assessment.final_rating !== null ? `${assessment.final_rating}/5` : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <AcademicCapIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p>No competency assessments configured</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Core Values Tab */}
        <TabsContent value="values">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <StarIcon className="h-5 w-5 mr-2 text-yellow-500" />
                Core Values Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appraisal.value_assessments && appraisal.value_assessments.length > 0 ? (
                <div className="space-y-4">
                  {appraisal.value_assessments.map((assessment: CoreValueAssessment) => (
                    <div key={assessment.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {assessment.core_value_name}
                          </h4>
                          <p className="text-sm text-gray-500">
                            Code: {assessment.core_value_code}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Self Rating</label>
                          {canRateSelf ? (
                            <select
                              className="w-full px-2 py-1 border rounded text-sm"
                              value={assessment.self_rating || ''}
                              onChange={(e) =>
                                handleUpdateValueAssessment(
                                  assessment,
                                  'self_rating',
                                  e.target.value ? parseInt(e.target.value) : null
                                )
                              }
                            >
                              <option value="">Select...</option>
                              {[1, 2, 3, 4, 5].map((v) => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          ) : (
                            <p className="font-medium">
                              {assessment.self_rating !== null ? `${assessment.self_rating}/5` : '-'}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Manager Rating</label>
                          {canRateAsManager ? (
                            <select
                              className="w-full px-2 py-1 border rounded text-sm"
                              value={assessment.manager_rating || ''}
                              onChange={(e) =>
                                handleUpdateValueAssessment(
                                  assessment,
                                  'manager_rating',
                                  e.target.value ? parseInt(e.target.value) : null
                                )
                              }
                            >
                              <option value="">Select...</option>
                              {[1, 2, 3, 4, 5].map((v) => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          ) : (
                            <p className="font-medium">
                              {assessment.manager_rating !== null ? `${assessment.manager_rating}/5` : '-'}
                            </p>
                          )}
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">Final Rating</span>
                          <p className="font-medium text-primary-600">
                            {assessment.final_rating !== null ? `${assessment.final_rating}/5` : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <StarIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p>No core value assessments configured</p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => performanceService.bulkCreateValueAssessments(id!).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['appraisal-detail', id] })
                      toast.success('Value assessments created')
                    })}
                  >
                    Initialize Value Assessments
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Comments & Feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Strengths</label>
                  <p className="text-sm text-gray-600 mt-1">
                    {appraisal.strengths || 'No strengths documented'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Areas for Improvement</label>
                  <p className="text-sm text-gray-600 mt-1">
                    {appraisal.areas_for_improvement || 'No areas for improvement documented'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Development Needs</label>
                  <p className="text-sm text-gray-600 mt-1">
                    {appraisal.development_needs || 'No development needs documented'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Career Aspirations</label>
                  <p className="text-sm text-gray-600 mt-1">
                    {appraisal.career_aspirations || 'No career aspirations documented'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Score Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-blue-900">Objectives</span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-blue-600">
                        {appraisal.objectives_final_rating?.toFixed(1) || '-'}%
                      </span>
                      {appraisal.weighted_objectives_score && (
                        <span className="text-xs text-blue-500 block">
                          Weighted: {appraisal.weighted_objectives_score.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium text-green-900">Competencies</span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-green-600">
                        {appraisal.competencies_final_rating?.toFixed(1) || '-'}%
                      </span>
                      {appraisal.weighted_competencies_score && (
                        <span className="text-xs text-green-500 block">
                          Weighted: {appraisal.weighted_competencies_score.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm font-medium text-purple-900">Core Values</span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-purple-600">
                        {appraisal.values_final_rating?.toFixed(1) || '-'}%
                      </span>
                      {appraisal.weighted_values_score && (
                        <span className="text-xs text-purple-500 block">
                          Weighted: {appraisal.weighted_values_score.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-4 bg-primary-50 rounded-lg border-2 border-primary-200">
                    <span className="text-sm font-bold text-primary-900">FINAL SCORE</span>
                    <span className="text-2xl font-bold text-primary-600">
                      {appraisal.overall_final_rating?.toFixed(1) || '-'}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Goal Modal */}
      <Modal
        isOpen={showGoalModal}
        onClose={handleCloseGoalModal}
        title={editingGoal ? 'Edit Goal' : 'Add Goal'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Goal Title"
            value={goalForm.title}
            onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
            placeholder="Enter goal title"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              rows={3}
              value={goalForm.description}
              onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
              placeholder="Describe this goal..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Key Results</label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              rows={2}
              value={goalForm.key_results}
              onChange={(e) => setGoalForm({ ...goalForm, key_results: e.target.value })}
              placeholder="How will success be measured?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Weight (%)"
              type="number"
              value={goalForm.weight.toString()}
              onChange={(e) => setGoalForm({ ...goalForm, weight: parseInt(e.target.value) || 0 })}
              min={0}
              max={100}
            />
            <Input
              label="Target Date"
              type="date"
              value={goalForm.target_date}
              onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })}
            />
          </div>

          {/* Rating Section (shown when editing) */}
          {editingGoal && (canRateSelf || canRateAsManager) && (
            <div className="pt-4 border-t">
              <h4 className="font-medium text-gray-900 mb-3">Ratings</h4>
              <div className="grid grid-cols-2 gap-4">
                {canRateSelf && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Self Rating (1-5)
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={goalForm.self_rating || ''}
                      onChange={(e) =>
                        setGoalForm({
                          ...goalForm,
                          self_rating: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">Select rating...</option>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <option key={v} value={v}>{v} - {['Poor', 'Below Expectations', 'Meets Expectations', 'Exceeds Expectations', 'Outstanding'][v-1]}</option>
                      ))}
                    </select>
                  </div>
                )}
                {canRateAsManager && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Manager Rating (1-5)
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={goalForm.manager_rating || ''}
                      onChange={(e) =>
                        setGoalForm({
                          ...goalForm,
                          manager_rating: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">Select rating...</option>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <option key={v} value={v}>{v} - {['Poor', 'Below Expectations', 'Meets Expectations', 'Exceeds Expectations', 'Outstanding'][v-1]}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleCloseGoalModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveGoal}
              isLoading={createGoalMutation.isPending || updateGoalMutation.isPending}
            >
              {editingGoal ? 'Update' : 'Add'} Goal
            </Button>
          </div>
        </div>
      </Modal>

      {/* Score Calculation Modal */}
      <Modal
        isOpen={showScoreModal}
        onClose={() => setShowScoreModal(false)}
        title="Calculated Scores"
        size="md"
      >
        {calculatedScores && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">Objectives Score</p>
                <p className="text-xl font-bold text-blue-600">
                  {calculatedScores.objectives_score?.toFixed(1) || '-'}%
                </p>
                <p className="text-xs text-blue-500">
                  Weighted: {calculatedScores.weighted_objectives?.toFixed(1) || '-'}%
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700">Competencies Score</p>
                <p className="text-xl font-bold text-green-600">
                  {calculatedScores.competencies_score?.toFixed(1) || '-'}%
                </p>
                <p className="text-xs text-green-500">
                  Weighted: {calculatedScores.weighted_competencies?.toFixed(1) || '-'}%
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-700">Values Score</p>
                <p className="text-xl font-bold text-purple-600">
                  {calculatedScores.values_score?.toFixed(1) || '-'}%
                </p>
                <p className="text-xs text-purple-500">
                  Weighted: {calculatedScores.weighted_values?.toFixed(1) || '-'}%
                </p>
              </div>
              <div className="p-3 bg-primary-50 rounded-lg">
                <p className="text-sm text-primary-700">Final Score</p>
                <p className="text-xl font-bold text-primary-600">
                  {calculatedScores.final_score?.toFixed(1) || '-'}%
                </p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Recommendations</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {calculatedScores.passed ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  ) : (
                    <span className="h-5 w-5 rounded-full bg-red-100" />
                  )}
                  <span className={calculatedScores.passed ? 'text-green-700' : 'text-red-700'}>
                    {calculatedScores.passed ? 'Passed' : 'Did not pass'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {calculatedScores.increment_eligible ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  ) : (
                    <span className="h-5 w-5 rounded-full bg-gray-100" />
                  )}
                  <span className={calculatedScores.increment_eligible ? 'text-green-700' : 'text-gray-500'}>
                    Increment Eligible
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {calculatedScores.promotion_eligible ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  ) : (
                    <span className="h-5 w-5 rounded-full bg-gray-100" />
                  )}
                  <span className={calculatedScores.promotion_eligible ? 'text-green-700' : 'text-gray-500'}>
                    Promotion Eligible
                  </span>
                </div>
                {calculatedScores.pip_required && (
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-red-500" />
                    <span className="text-red-700 font-medium">
                      PIP Required
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowScoreModal(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  calculateScoresMutation.mutate(true)
                  setShowScoreModal(false)
                }}
              >
                Save Scores
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
