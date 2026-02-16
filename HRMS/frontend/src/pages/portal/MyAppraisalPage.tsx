import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ChartBarIcon,
  FlagIcon,
  StarIcon,
  PlusIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import {
  performanceService,
  type Appraisal,
  type Goal,
  type CoreValueAssessment,
} from '@/services/performance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  GOAL_SETTING: 'info',
  GOALS_SUBMITTED: 'info',
  GOALS_APPROVED: 'info',
  IN_PROGRESS: 'warning',
  SELF_ASSESSMENT: 'warning',
  MANAGER_REVIEW: 'warning',
  COMPLETED: 'success',
  ACKNOWLEDGED: 'success',
}

export default function MyAppraisalPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
    key_results: '',
    weight: 20,
    target_date: '',
    self_rating: null as number | null,
    self_comments: '',
  })

  // Fetch my appraisals
  const { data: appraisals, isLoading } = useQuery({
    queryKey: ['my-appraisals'],
    queryFn: performanceService.getMyAppraisals,
  })

  // Get current/active appraisal
  const currentAppraisal = appraisals?.find(
    (a: Appraisal) => !['COMPLETED', 'ACKNOWLEDGED'].includes(a.status)
  ) || appraisals?.[0]

  // Fetch appraisal detail if we have a current appraisal
  const { data: appraisalDetail } = useQuery({
    queryKey: ['appraisal-detail', currentAppraisal?.id],
    queryFn: () => performanceService.getAppraisalDetail(currentAppraisal!.id),
    enabled: !!currentAppraisal?.id,
  })

  // Goal mutations
  const createGoalMutation = useMutation({
    mutationFn: (data: any) =>
      performanceService.createGoal({ ...data, appraisal: currentAppraisal?.id }),
    onSuccess: () => {
      toast.success('Goal added successfully')
      queryClient.invalidateQueries({ queryKey: ['appraisal-detail'] })
      queryClient.invalidateQueries({ queryKey: ['my-appraisals'] })
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
      toast.success('Goal updated')
      queryClient.invalidateQueries({ queryKey: ['appraisal-detail'] })
      handleCloseGoalModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update goal')
    },
  })

  // Update value assessment
  const updateValueMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      performanceService.updateValueAssessment(id, data),
    onSuccess: () => {
      toast.success('Rating saved')
      queryClient.invalidateQueries({ queryKey: ['appraisal-detail'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to save rating')
    },
  })

  // Submit self assessment
  const submitMutation = useMutation({
    mutationFn: () => performanceService.submitSelfAssessment(currentAppraisal!.id),
    onSuccess: () => {
      toast.success('Self assessment submitted for manager review')
      queryClient.invalidateQueries({ queryKey: ['my-appraisals'] })
      queryClient.invalidateQueries({ queryKey: ['appraisal-detail'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit')
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
      })
    } else {
      setEditingGoal(null)
      setGoalForm({
        title: '',
        description: '',
        key_results: '',
        weight: 20,
        target_date: '',
        self_rating: null,
        self_comments: '',
      })
    }
    setShowGoalModal(true)
  }

  const handleCloseGoalModal = () => {
    setShowGoalModal(false)
    setEditingGoal(null)
  }

  const handleSaveGoal = () => {
    if (!goalForm.title) {
      toast.error('Please enter a goal title')
      return
    }

    if (editingGoal) {
      updateGoalMutation.mutate({ goalId: editingGoal.id, data: goalForm })
    } else {
      createGoalMutation.mutate(goalForm)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!currentAppraisal) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Appraisal</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and complete your performance appraisal
          </p>
        </div>
        <Card>
          <CardContent className="py-12">
            <EmptyState
              type="data"
              title="No active appraisal"
              description="You don't have an active appraisal cycle. Contact HR if you believe this is an error."
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  const canSetGoals =
    currentAppraisal.status === 'DRAFT' || currentAppraisal.status === 'GOAL_SETTING'
  const canSelfRate =
    currentAppraisal.status === 'SELF_ASSESSMENT' || currentAppraisal.status === 'IN_PROGRESS'
  const isCompleted = ['COMPLETED', 'ACKNOWLEDGED'].includes(currentAppraisal.status)

  const totalGoalWeight =
    appraisalDetail?.goals?.reduce((sum: number, g: Goal) => sum + (g.weight || 0), 0) || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Appraisal</h1>
          <p className="mt-1 text-sm text-gray-500">
            {currentAppraisal.cycle_name} Performance Review
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={statusColors[currentAppraisal.status] || 'default'} className="text-sm">
            {currentAppraisal.status_display || currentAppraisal.status?.replace('_', ' ')}
          </Badge>
          {canSelfRate && (
            <Button onClick={() => submitMutation.mutate()} isLoading={submitMutation.isPending}>
              <CheckCircleIcon className="h-4 w-4 mr-2" />
              Submit Self Assessment
            </Button>
          )}
        </div>
      </div>

      {/* Progress Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <ClockIcon className="h-8 w-8 mx-auto text-blue-500 mb-2" />
            <p className="text-sm text-gray-500">Status</p>
            <p className="text-lg font-bold text-gray-900">
              {currentAppraisal.status_display || currentAppraisal.status?.replace('_', ' ')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <FlagIcon className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="text-sm text-gray-500">Goals</p>
            <p className="text-lg font-bold text-gray-900">
              {appraisalDetail?.goals?.length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ChartBarIcon className="h-8 w-8 mx-auto text-purple-500 mb-2" />
            <p className="text-sm text-gray-500">Self Rating</p>
            <p className="text-lg font-bold text-gray-900">
              {currentAppraisal.overall_self_rating?.toFixed(1) || '-'}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <StarIcon className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
            <p className="text-sm text-gray-500">Final Score</p>
            <p className="text-lg font-bold text-primary-600">
              {currentAppraisal.overall_final_rating?.toFixed(1) || '-'}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="goals">
            Goals ({appraisalDetail?.goals?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="values">Core Values</TabsTrigger>
          {isCompleted && <TabsTrigger value="results">Results</TabsTrigger>}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Appraisal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Cycle</span>
                  <span className="text-sm font-medium">{currentAppraisal.cycle_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Manager</span>
                  <span className="text-sm font-medium">
                    {currentAppraisal.manager_name || 'Not assigned'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <Badge variant={statusColors[currentAppraisal.status] || 'default'}>
                    {currentAppraisal.status_display}
                  </Badge>
                </div>
                {currentAppraisal.self_assessment_date && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Self Assessment Date</span>
                    <span className="text-sm font-medium">
                      {new Date(currentAppraisal.self_assessment_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>What to do next?</CardTitle>
              </CardHeader>
              <CardContent>
                {canSetGoals && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      Set your performance goals for this appraisal cycle. Your goals should be
                      SMART: Specific, Measurable, Achievable, Relevant, and Time-bound.
                    </p>
                    <Button size="sm" onClick={() => setActiveTab('goals')}>
                      <PlusIcon className="h-4 w-4 mr-1" />
                      Add Goals
                    </Button>
                  </div>
                )}
                {canSelfRate && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      Complete your self-assessment by rating your performance against each goal
                      and core value. Be honest and provide supporting comments.
                    </p>
                    <Button size="sm" onClick={() => setActiveTab('goals')}>
                      Complete Self Assessment
                    </Button>
                  </div>
                )}
                {currentAppraisal.status === 'MANAGER_REVIEW' && (
                  <p className="text-sm text-gray-600">
                    Your self-assessment has been submitted. Please wait for your manager to
                    complete their review.
                  </p>
                )}
                {isCompleted && (
                  <p className="text-sm text-gray-600">
                    Your appraisal has been completed. View your results in the Results tab.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Goals Tab */}
        <TabsContent value="goals">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center">
                <FlagIcon className="h-5 w-5 mr-2 text-primary-500" />
                My Goals
                <span className="ml-2 text-sm font-normal text-gray-500">
                  (Total Weight: {totalGoalWeight}%)
                </span>
              </CardTitle>
              {canSetGoals && (
                <Button size="sm" onClick={() => handleOpenGoalModal()}>
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Goal
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {appraisalDetail?.goals && appraisalDetail.goals.length > 0 ? (
                <div className="space-y-4">
                  {appraisalDetail.goals.map((goal: Goal) => (
                    <div key={goal.id} className="border rounded-md p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{goal.title}</h4>
                            <Badge variant="info">{goal.weight}%</Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                        </div>
                        {(canSetGoals || canSelfRate) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenGoalModal(goal)}
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {/* Progress */}
                      <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-500">Progress</span>
                          <span className="font-medium">{goal.progress_percentage || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full"
                            style={{ width: `${goal.progress_percentage || 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Ratings */}
                      {(goal.self_rating !== null || goal.manager_rating !== null) && (
                        <div className="mt-3 grid grid-cols-3 gap-4 pt-3 border-t">
                          <div>
                            <span className="text-xs text-gray-500">My Rating</span>
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
                            <span className="text-xs text-gray-500">Final</span>
                            <p className="font-medium text-primary-600">
                              {goal.final_rating !== null ? `${goal.final_rating}/5` : '-'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  type="data"
                  title="No goals yet"
                  description={
                    canSetGoals
                      ? 'Add your performance goals to get started.'
                      : 'No goals have been set for this appraisal.'
                  }
                  action={canSetGoals ? { label: 'Add Goal', onClick: () => handleOpenGoalModal() } : undefined}
                />
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
                Core Values Self-Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appraisalDetail?.value_assessments && appraisalDetail.value_assessments.length > 0 ? (
                <div className="space-y-4">
                  {appraisalDetail.value_assessments.map((assessment: CoreValueAssessment) => (
                    <div key={assessment.id} className="border rounded-md p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{assessment.core_value_name}</h4>
                          <p className="text-sm text-gray-500">Code: {assessment.core_value_code}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700 block mb-1">
                            My Rating
                          </label>
                          {canSelfRate ? (
                            <select
                              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] transition-colors duration-150"
                              value={assessment.self_rating || ''}
                              onChange={(e) =>
                                updateValueMutation.mutate({
                                  id: assessment.id,
                                  data: {
                                    self_rating: e.target.value ? parseInt(e.target.value) : null,
                                  },
                                })
                              }
                            >
                              <option value="">Select rating...</option>
                              {[1, 2, 3, 4, 5].map((v) => (
                                <option key={v} value={v}>
                                  {v} -{' '}
                                  {
                                    [
                                      'Poor',
                                      'Below Expectations',
                                      'Meets Expectations',
                                      'Exceeds Expectations',
                                      'Outstanding',
                                    ][v - 1]
                                  }
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-lg font-medium">
                              {assessment.self_rating !== null ? `${assessment.self_rating}/5` : '-'}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 block mb-1">
                            Final Rating
                          </label>
                          <p className="text-lg font-medium text-primary-600">
                            {assessment.final_rating !== null ? `${assessment.final_rating}/5` : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  type="data"
                  title="No value assessments"
                  description="Core value assessments have not been initialized for this appraisal."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        {isCompleted && (
          <TabsContent value="results">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Score Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-md">
                    <span className="text-sm font-medium text-blue-900">Objectives</span>
                    <span className="text-lg font-bold text-blue-600">
                      {currentAppraisal.objectives_final_rating?.toFixed(1) || '-'}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-md">
                    <span className="text-sm font-medium text-green-900">Competencies</span>
                    <span className="text-lg font-bold text-green-600">
                      {currentAppraisal.competencies_final_rating?.toFixed(1) || '-'}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-md">
                    <span className="text-sm font-medium text-purple-900">Core Values</span>
                    <span className="text-lg font-bold text-purple-600">
                      {currentAppraisal.values_final_rating?.toFixed(1) || '-'}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-primary-50 rounded-md border-2 border-primary-200">
                    <span className="text-sm font-bold text-primary-900">FINAL SCORE</span>
                    <span className="text-2xl font-bold text-primary-600">
                      {currentAppraisal.overall_final_rating?.toFixed(1) || '-'}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Manager Feedback</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Strengths</label>
                    <p className="text-sm text-gray-600 mt-1">
                      {appraisalDetail?.strengths || 'No feedback provided'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Areas for Improvement</label>
                    <p className="text-sm text-gray-600 mt-1">
                      {appraisalDetail?.areas_for_improvement || 'No feedback provided'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Development Needs</label>
                    <p className="text-sm text-gray-600 mt-1">
                      {appraisalDetail?.development_needs || 'No feedback provided'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
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
            placeholder="What do you want to achieve?"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] transition-colors duration-150 sm:text-sm"
              rows={3}
              value={goalForm.description}
              onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
              placeholder="Describe your goal in detail..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Key Results</label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] transition-colors duration-150 sm:text-sm"
              rows={2}
              value={goalForm.key_results}
              onChange={(e) => setGoalForm({ ...goalForm, key_results: e.target.value })}
              placeholder="How will you measure success?"
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

          {/* Self Rating (only show during self-assessment) */}
          {canSelfRate && editingGoal && (
            <div className="pt-4 border-t">
              <h4 className="font-medium text-gray-900 mb-3">Self Assessment</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Self Rating (1-5)
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] transition-colors duration-150"
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
                    <option key={v} value={v}>
                      {v} -{' '}
                      {
                        [
                          'Poor',
                          'Below Expectations',
                          'Meets Expectations',
                          'Exceeds Expectations',
                          'Outstanding',
                        ][v - 1]
                      }
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
                <textarea
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] transition-colors duration-150 sm:text-sm"
                  rows={2}
                  value={goalForm.self_comments}
                  onChange={(e) => setGoalForm({ ...goalForm, self_comments: e.target.value })}
                  placeholder="Explain your rating..."
                />
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
    </div>
  )
}
