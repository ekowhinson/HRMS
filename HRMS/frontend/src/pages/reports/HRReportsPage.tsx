import { Link } from 'react-router-dom'
import {
  UsersIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  ClockIcon,
  ClipboardDocumentListIcon,
  StarIcon,
  AcademicCapIcon,
  PresentationChartBarIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline'
import { PageHeader, SectionHeader } from '@/components/ui'
import { reportsService } from '@/services/reports'
import ExportReportCard from '@/components/reports/ExportReportCard'

const reportCards = [
  {
    title: 'Employee Directory',
    description: 'Complete employee directory with search, filter, and export capabilities.',
    href: '/hr-reports/employee-directory',
    icon: UsersIcon,
    color: 'bg-blue-500',
    bgLight: 'bg-blue-50',
  },
  {
    title: 'Headcount',
    description: 'Headcount breakdown by department, grade, employment type, and location.',
    href: '/hr-reports/headcount',
    icon: ChartBarIcon,
    color: 'bg-green-500',
    bgLight: 'bg-green-50',
  },
  {
    title: 'Turnover',
    description: 'Staff turnover rates, exits by month, reason, and department trends.',
    href: '/hr-reports/turnover',
    icon: ArrowTrendingUpIcon,
    color: 'bg-orange-500',
    bgLight: 'bg-orange-50',
  },
  {
    title: 'Demographics',
    description: 'Workforce demographics by gender, marital status, and nationality.',
    href: '/hr-reports/demographics',
    icon: UserGroupIcon,
    color: 'bg-purple-500',
    bgLight: 'bg-purple-50',
  },
  {
    title: 'Leave Balance',
    description: 'Employee leave balances and summary by leave type for the year.',
    href: '/hr-reports/leave-balance',
    icon: CalendarDaysIcon,
    color: 'bg-teal-500',
    bgLight: 'bg-teal-50',
  },
  {
    title: 'Leave Utilization',
    description: 'Leave usage patterns by month, leave type, and department.',
    href: '/hr-reports/leave-utilization',
    icon: ClockIcon,
    color: 'bg-indigo-500',
    bgLight: 'bg-indigo-50',
  },
  {
    title: 'Employment History',
    description: 'Track position, department, and grade changes for individual employees.',
    href: '/hr-reports/employment-history',
    icon: ClipboardDocumentListIcon,
    color: 'bg-cyan-500',
    bgLight: 'bg-cyan-50',
  },
  {
    title: 'KPI Tracking',
    description: 'Key performance indicators across performance, training, and recruitment.',
    href: '/hr-reports/kpi-tracking',
    icon: PresentationChartBarIcon,
    color: 'bg-rose-500',
    bgLight: 'bg-rose-50',
  },
  {
    title: 'Performance Appraisals',
    description: 'Appraisal results by cycle, status, and employee with ratings overview.',
    href: '/hr-reports/performance-appraisals',
    icon: StarIcon,
    color: 'bg-amber-500',
    bgLight: 'bg-amber-50',
  },
  {
    title: 'Training & Development',
    description: 'Training programs, sessions, enrollment stats, and completion metrics.',
    href: '/hr-reports/training-development',
    icon: AcademicCapIcon,
    color: 'bg-emerald-500',
    bgLight: 'bg-emerald-50',
  },
]

export default function HRReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Reports"
        subtitle="Interactive reports and analytics for HR data"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportCards.map((card) => (
          <Link
            key={card.href}
            to={card.href}
            className="group block bg-white rounded-md border border-gray-200 p-6 hover:shadow-md hover:border-gray-300 transition-colors duration-150"
          >
            <div className="flex items-start gap-4">
              <div className={`${card.bgLight} p-3 rounded-md group-hover:scale-105 transition-transform`}>
                <card.icon className={`h-6 w-6 text-gray-700`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
                  {card.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                  {card.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Export */}
      <div>
        <SectionHeader
          title="Quick Export"
          subtitle="Download HR data in CSV, Excel, or PDF format"
          className="mb-4"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ExportReportCard
            name="Employee Master Report"
            description="Complete list of all employees with their details"
            icon={UsersIcon}
            exportFn={(format) => reportsService.exportEmployeeMaster({}, format)}
          />
          <ExportReportCard
            name="Leave Balance Report"
            description="Current leave balances for all employees"
            icon={CalendarDaysIcon}
            exportFn={(format) => reportsService.exportLeaveBalance({}, format)}
          />
          <ExportReportCard
            name="Outstanding Loans Report"
            description="All active loans with balances"
            icon={CreditCardIcon}
            exportFn={(format) => reportsService.exportLoanOutstanding({}, format)}
          />
        </div>
      </div>
    </div>
  )
}
