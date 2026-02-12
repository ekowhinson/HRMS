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

  // Performance KPIs
  const totalAppraisals = perfData?.total_appraisals ?? 0
  const avgRating = perfData?.average_rating ?? 0
  const completedAppraisals = perfData?.completed ?? 0
  const ratingDistribution: { rating: string; count: number }[] = perfData?.rating_distribution || perfData?.by_status || []

  // Training KPIs
  const totalTraining = trainingData?.total_programs ?? trainingData?.total ?? 0
  const completionRate = trainingData?.completion_rate ?? 0
  const trainingByCategory: { category: string; count: number }[] = trainingData?.by_category || []

  // Recruitment KPIs
  const openVacancies = recruitData?.open_vacancies ?? recruitData?.total ?? 0
  const applicationsReceived = recruitData?.applications_received ?? 0
  const avgTimeToFill = recruitData?.avg_time_to_fill ?? 0

  const ratingChartData = ratingDistribution.map((r) => ({
    name: r.rating || (r as any).status || 'Unknown',
    value: r.count,
  }))

  const trainingCategoryData = trainingByCategory.map((t) => ({
    name: t.category || 'Other',
    value: t.count,
  }))

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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatsCard title="Total Appraisals" value={totalAppraisals} variant="primary" />
              <StatsCard title="Average Rating" value={avgRating ? Number(avgRating).toFixed(1) : 'N/A'} variant="info" />
              <StatsCard title="Completed" value={completedAppraisals} variant="success" />
            </div>
          </div>

          {/* Training Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Training</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatsCard title="Training Programs" value={totalTraining} variant="primary" />
              <StatsCard title="Completion Rate" value={`${Number(completionRate).toFixed(0)}%`} variant="info" />
              <StatsCard title="Open Vacancies" value={openVacancies} variant="warning" />
            </div>
          </div>

          {/* Recruitment Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Recruitment</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatsCard title="Open Vacancies" value={openVacancies} variant="primary" />
              <StatsCard title="Applications Received" value={applicationsReceived} variant="info" />
              <StatsCard title="Avg. Time to Fill (days)" value={avgTimeToFill ? Number(avgTimeToFill).toFixed(0) : 'N/A'} variant="default" />
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {ratingChartData.length > 0 && (
              <BarChartCard
                title="Appraisal Status Distribution"
                data={ratingChartData}
                color={chartColors.primary}
              />
            )}
            {trainingCategoryData.length > 0 && (
              <PieChartCard
                title="Training by Category"
                data={trainingCategoryData}
                colors={[...chartColors.palette]}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
