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
import {
  Button,
  Input,
  Card,
  CardContent,
  EmptyState,
  SkeletonCard,
} from '@/components/ui'

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
          <Input
            leftIcon={<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />}
            placeholder="Search by job title, department, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            type={search ? 'search' : 'data'}
            title={search ? 'No vacancies match your search' : 'No vacancies currently available'}
            description={search ? 'Try adjusting your search criteria.' : 'Check back later for new openings.'}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((vacancy: PublicVacancy) => (
              <Card key={vacancy.id} hoverable>
                <CardContent>
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

                  <Link to={`/careers/apply/${vacancy.vacancy_number?.toLowerCase()}`}>
                    <Button variant="primary" size="sm">
                      View & Apply
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  )
}
