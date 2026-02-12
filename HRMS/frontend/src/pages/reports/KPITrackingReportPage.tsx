import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { reportsService } from '@/services/reports'
import { Card, CardContent } from '@/components/ui/Card'
import { StatsCard } from '@/components/ui/StatsCard'
import { BarChartCard } from '@/components/charts/BarChartCard'
import { PieChartCard } from '@/components/charts/PieChartCard'
import { chartColors } from '@/lib/design-tokens'

export default function KPITrackingReportPage() {
  const { data: perfData, isLoading: loadingPerf } = useQuery({
    queryKey: ['kpi-performance'],
    queryFn: () => reportsService.getPerformanceKPIs(),
  })

  const { data: trainingData, isLoading: loadingTraining } = useQuery({
    queryKey: ['kpi-training'],
    queryFn: () => reportsService.getTrainingKPIs(),
  })

  const { data: recruitData, isLoading: loadingRecruit } = useQuery({
    queryKey: ['kpi-recruitment'],
    queryFn: () => reportsService.getRecruitmentKPIs(),
  })

  const isLoading = loadingPerf || loadingTraining || loadingRecruit

  // Performance KPIs (nested under appraisal_completion and rating_distribution)
  const appraisalCompletion = perfData?.appraisal_completion ?? {}
  const ratingDist = perfData?.rating_distribution ?? {}
  const totalEmployees = appraisalCompletion.total_employees ?? 0
  const completedAppraisals = appraisalCompletion.completed ?? 0
  const appraisalCompletionRate = appraisalCompletion.completion_rate ?? 0
  const avgRating = ratingDist.average_rating ?? 0
  const ratingDistribution: Record<string, number> = ratingDist.distribution ?? {}

  // Training KPIs (nested under completion_rate and cost_per_employee)
  const trainingCompletion = trainingData?.completion_rate ?? {}
  const trainingCost = trainingData?.cost_per_employee ?? {}
  const totalActivities = trainingCompletion.total_activities ?? 0
  const trainingCompletionRate = trainingCompletion.completion_rate ?? 0
  const costPerEmployee = trainingCost.cost_per_employee ?? 0

  // Recruitment KPIs (nested under vacancy_summary, time_to_fill, fte, hiring_rate)
  const vacancySummary = recruitData?.vacancy_summary ?? {}
  const timeToFill = recruitData?.time_to_fill ?? {}
  const fte = recruitData?.fte ?? {}
  const hiringRate = recruitData?.hiring_rate ?? {}
  const openVacancies = vacancySummary.open_vacancies ?? 0
  const totalApplicants = vacancySummary.total_applicants ?? 0
  const avgTimeToFill = timeToFill.average_days ?? 0

  // Rating distribution chart data (convert object to array)
  const ratingChartData = Object.entries(ratingDistribution)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => ({ name, value: count }))

  // Training needs chart data
  const trainingNeeds = trainingData?.training_needs ?? {}
  const needsByStatus: Record<string, number> = trainingNeeds.by_status ?? {}
  const trainingNeedsData = Object.entries(needsByStatus)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => ({ name, value: count }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/hr-reports" className="p-2 rounded-md hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPI Tracking Report</h1>
          <p className="mt-1 text-sm text-gray-500">
            Key performance indicators across Performance, Training, and Recruitment
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Performance Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Performance</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <StatsCard title="Total Employees" value={totalEmployees} variant="primary" />
              <StatsCard title="Completed Appraisals" value={completedAppraisals} variant="success" />
              <StatsCard title="Completion Rate" value={`${Number(appraisalCompletionRate).toFixed(1)}%`} variant="info" />
              <StatsCard title="Average Rating" value={avgRating ? Number(avgRating).toFixed(1) : 'N/A'} variant="warning" />
            </div>
          </div>

          {/* Training Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Training</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <StatsCard title="Total Activities" value={totalActivities} variant="primary" />
              <StatsCard title="Completed" value={trainingCompletion.completed ?? 0} variant="success" />
              <StatsCard title="Completion Rate" value={`${Number(trainingCompletionRate).toFixed(1)}%`} variant="info" />
              <StatsCard title="Cost per Employee" value={costPerEmployee ? `$${Number(costPerEmployee).toFixed(0)}` : 'N/A'} variant="default" />
            </div>
          </div>

          {/* Recruitment Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Recruitment</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <StatsCard title="Open Vacancies" value={openVacancies} variant="primary" />
              <StatsCard title="Total Applicants" value={totalApplicants} variant="info" />
              <StatsCard title="Avg. Time to Fill (days)" value={avgTimeToFill ? Number(avgTimeToFill).toFixed(0) : 'N/A'} variant="default" />
              <StatsCard title="FTE Count" value={fte.fte ?? hiringRate.average_headcount ?? 'N/A'} variant="warning" />
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {ratingChartData.length > 0 && (
              <BarChartCard
                title="Performance Rating Distribution"
                data={ratingChartData}
                color={chartColors.primary}
              />
            )}
            {trainingNeedsData.length > 0 && (
              <PieChartCard
                title="Training Needs by Status"
                data={trainingNeedsData}
                colors={[...chartColors.palette]}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
