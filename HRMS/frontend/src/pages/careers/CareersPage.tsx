import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import PortalLayout from '@/components/layout/PortalLayout'
import { applicantPortalService, type PublicVacancy } from '@/services/applicantPortal'
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline'

export default function CareersPage() {
  const [search, setSearch] = useState('')

  const { data: vacancies = [], isLoading } = useQuery({
    queryKey: ['public-vacancies'],
    queryFn: applicantPortalService.getPublicVacancies,
  })

  const filtered = vacancies.filter((v: PublicVacancy) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      v.job_title.toLowerCase().includes(q) ||
      v.department_name?.toLowerCase().includes(q) ||
      v.location_name?.toLowerCase().includes(q)
    )
  })

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Career Opportunities</h1>
          <p className="text-gray-600">Find your next role and apply online</p>
        </div>

        {/* Search */}
        <div className="max-w-xl mx-auto">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by job title, department, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading vacancies...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {search ? 'No vacancies match your search.' : 'No vacancies currently available.'}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((vacancy: PublicVacancy) => (
              <div
                key={vacancy.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {vacancy.job_title}
                </h3>

                <div className="space-y-1 text-sm text-gray-600 mb-4">
                  {vacancy.department_name && (
                    <div className="flex items-center gap-2">
                      <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                      {vacancy.department_name}
                    </div>
                  )}
                  {vacancy.location_name && (
                    <div className="flex items-center gap-2">
                      <MapPinIcon className="h-4 w-4 text-gray-400" />
                      {vacancy.location_name}
                    </div>
                  )}
                  {vacancy.employment_type && (
                    <div className="flex items-center gap-2">
                      <BriefcaseIcon className="h-4 w-4 text-gray-400" />
                      {vacancy.employment_type}
                    </div>
                  )}
                  {vacancy.closing_date && (
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-gray-400" />
                      Closes: {new Date(vacancy.closing_date).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {vacancy.show_salary && vacancy.salary_range_min && vacancy.salary_range_max && (
                  <p className="text-sm text-green-700 font-medium mb-3">
                    GHS {Number(vacancy.salary_range_min).toLocaleString()} - {Number(vacancy.salary_range_max).toLocaleString()}
                  </p>
                )}

                <p className="text-sm text-gray-500 line-clamp-3 mb-4">
                  {vacancy.job_description?.substring(0, 150)}
                  {vacancy.job_description && vacancy.job_description.length > 150 ? '...' : ''}
                </p>

                <Link
                  to={`/careers/apply/${vacancy.vacancy_number?.toLowerCase()}`}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  View & Apply
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  )
}
