import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsService } from '@/services/reports'
import { usePeriodRange } from '@/hooks/usePeriodRange'
import { useExport } from '@/hooks/useExport'
import ExportMenu from '@/components/ui/ExportMenu'
import ContributionStatementLayout from '@/components/reports/ContributionStatementLayout'
import type { StatementColumn, EmployeeStatement } from '@/components/reports/ContributionStatementLayout'

const columns: StatementColumn[] = [
  { key: 'basic', label: 'Basic Salary', format: 'currency' },
  { key: 'taxable', label: 'Taxable Income', format: 'currency' },
  { key: 'paye', label: 'PAYE Tax', format: 'currency' },
]

export default function IncomeTaxStatementPage() {
  const { fromPeriod, setFromPeriod, toPeriod, setToPeriod, periodOptions, isLoading: periodsLoading } = usePeriodRange()
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')

  const { exporting, handleExport } = useExport((format) =>
    reportsService.exportTaxStatement(
      { from_period: fromPeriod, to_period: toPeriod },
      format
    )
  )

  const { data, isLoading } = useQuery({
    queryKey: ['tax-statement', fromPeriod, toPeriod],
    queryFn: () =>
      reportsService.getTaxStatement({
        from_period: fromPeriod,
        to_period: toPeriod,
      }),
    enabled: !!fromPeriod && !!toPeriod,
  })

  const employees: EmployeeStatement[] = data?.employees || []
  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))].sort()

  return (
    <ContributionStatementLayout
      title="Income Tax Statement"
      backLink="/reports"
      breadcrumbs={[
        { label: 'Reports', href: '/reports' },
        { label: 'Income Tax Statement' },
      ]}
      columns={columns}
      employees={employees}
      isLoading={isLoading}
      fromPeriod={fromPeriod}
      toPeriod={toPeriod}
      onFromChange={setFromPeriod}
      onToChange={setToPeriod}
      periodOptions={periodOptions}
      periodsLoading={periodsLoading}
      search={search}
      onSearchChange={setSearch}
      departmentFilter={department}
      onDepartmentChange={setDepartment}
      departments={departments}
      headerRight={<ExportMenu onExport={handleExport} loading={exporting} disabled={!fromPeriod || !toPeriod} />}
    />
  )
}
