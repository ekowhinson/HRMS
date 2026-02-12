import { Link } from 'react-router-dom'
import {
  UsersIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

const reportCards = [
  {
    title: 'Employee Master',
    description: 'Complete employee directory with search, filter, and export capabilities.',
    href: '/hr-reports/employee-master',
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
]

export default function HRReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">HR Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Interactive reports and analytics for HR data
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportCards.map((card) => (
          <Link
            key={card.href}
            to={card.href}
            className="group block bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-gray-300 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className={`${card.bgLight} p-3 rounded-lg group-hover:scale-105 transition-transform`}>
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
    </div>
  )
}
