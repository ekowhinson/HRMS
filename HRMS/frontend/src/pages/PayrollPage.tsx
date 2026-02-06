import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BanknotesIcon,
  CalendarIcon,
  DocumentArrowDownIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'
import { payrollService } from '@/services/payroll'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Table, { TablePagination } from '@/components/ui/Table'
import { formatCurrency } from '@/lib/utils'
import type { PayrollRun, Payslip } from '@/types'

const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  draft: 'default',
  processing: 'warning',
  pending_approval: 'info',
  approved: 'success',
  paid: 'success',
  cancelled: 'danger',
}

export default function PayrollPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [expandedPayslip, setExpandedPayslip] = useState<string | null>(null)

  // Pagination state
  const [runsPage, setRunsPage] = useState(1)
  const [payslipsPage, setPayslipsPage] = useState(1)
  const pageSize = 10

  const { data: payrollRuns, isLoading: runsLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => payrollService.getRuns(),
  })

  const { data: myPayslips, isLoading: payslipsLoading } = useQuery({
    queryKey: ['my-payslips'],
    queryFn: payrollService.getMyPayslips,
  })

  const { data: payrollPeriods } = useQuery({
    queryKey: ['payroll-periods'],
    queryFn: payrollService.getPeriods,
  })

  const runColumns = [
    {
      key: 'period',
      header: 'Period',
      render: (run: PayrollRun) => (
        <span className="text-sm font-medium text-gray-900">{run.period_name}</span>
      ),
    },
    {
      key: 'employees',
      header: 'Employees',
      render: (run: PayrollRun) => (
        <span className="text-sm text-gray-700">{run.total_employees}</span>
      ),
    },
    {
      key: 'gross',
      header: 'Total Gross',
      render: (run: PayrollRun) => (
        <span className="text-sm text-gray-700">{formatCurrency(run.total_gross)}</span>
      ),
    },
    {
      key: 'deductions',
      header: 'Total Deductions',
      render: (run: PayrollRun) => (
        <span className="text-sm text-gray-700">{formatCurrency(run.total_deductions)}</span>
      ),
    },
    {
      key: 'net',
      header: 'Total Net',
      render: (run: PayrollRun) => (
        <span className="text-sm font-medium text-gray-900">
          {formatCurrency(run.total_net)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (run: PayrollRun) => (
        <Badge variant={statusColors[run.status] || 'default'}>
          {run.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (_run: PayrollRun) => (
        <Button variant="ghost" size="sm">
          View
        </Button>
      ),
    },
  ]

  const togglePayslipDetails = (id: string) => {
    setExpandedPayslip(expandedPayslip === id ? null : id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="mt-1 text-sm text-gray-500">
            View payroll runs and your payslips
          </p>
        </div>
        <div className="flex gap-3">
          <Select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            options={[
              { value: '', label: 'All Periods' },
              ...(payrollPeriods?.map((p: any) => ({
                value: p.id,
                label: p.name,
              })) || []),
            ]}
          />
        </div>
      </div>

      {/* Payroll Summary Cards */}
      {payrollRuns && payrollRuns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BanknotesIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Latest Gross</p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(payrollRuns[0]?.total_gross || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <BanknotesIcon className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Deductions</p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(payrollRuns[0]?.total_deductions || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <BanknotesIcon className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Net Payable</p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(payrollRuns[0]?.total_net || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <CalendarIcon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Employees Paid</p>
                  <p className="text-lg font-bold text-gray-900">
                    {payrollRuns[0]?.total_employees || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payroll Runs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BanknotesIcon className="h-5 w-5 mr-2 text-gray-500" />
            Payroll Runs
          </CardTitle>
        </CardHeader>
        <Table
          data={(payrollRuns || []).slice((runsPage - 1) * pageSize, runsPage * pageSize)}
          columns={runColumns}
          isLoading={runsLoading}
          emptyMessage="No payroll runs found"
        />
        {payrollRuns && payrollRuns.length > pageSize && (
          <TablePagination
            currentPage={runsPage}
            totalPages={Math.ceil(payrollRuns.length / pageSize)}
            totalItems={payrollRuns.length}
            pageSize={pageSize}
            onPageChange={setRunsPage}
          />
        )}
      </Card>

      {/* My Payslips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DocumentArrowDownIcon className="h-5 w-5 mr-2 text-gray-500" />
            My Payslips
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {payslipsLoading ? (
            <div className="p-6 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : myPayslips && myPayslips.length > 0 ? (
            <div className="divide-y">
              {myPayslips.slice((payslipsPage - 1) * pageSize, payslipsPage * pageSize).map((payslip: Payslip) => (
                <div key={payslip.id} className="p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => togglePayslipDetails(payslip.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <CalendarIcon className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{payslip.period_name}</p>
                        <p className="text-sm text-gray-500">
                          Paid on {new Date(payslip.payment_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          {formatCurrency(payslip.net_pay)}
                        </p>
                        <p className="text-xs text-gray-500">Net Pay</p>
                      </div>
                      <Button variant="ghost" size="sm">
                        {expandedPayslip === payslip.id ? (
                          <ChevronUpIcon className="h-5 w-5" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {expandedPayslip === payslip.id && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Earnings */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-3">Earnings</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Basic Salary</span>
                              <span className="font-medium">
                                {formatCurrency(payslip.basic_salary)}
                              </span>
                            </div>
                            {payslip.allowances?.map((a: any, i: number) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-gray-600">{a.name}</span>
                                <span className="font-medium">{formatCurrency(a.amount)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between text-sm pt-2 border-t font-medium">
                              <span>Gross Pay</span>
                              <span className="text-green-600">
                                {formatCurrency(payslip.gross_pay)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Deductions */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-3">Deductions</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">PAYE (Tax)</span>
                              <span className="font-medium">
                                {formatCurrency(payslip.paye_tax)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">SSNIT (Employee)</span>
                              <span className="font-medium">
                                {formatCurrency(payslip.ssnit_employee)}
                              </span>
                            </div>
                            {payslip.other_deductions?.map((d: any, i: number) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-gray-600">{d.name}</span>
                                <span className="font-medium">{formatCurrency(d.amount)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between text-sm pt-2 border-t font-medium">
                              <span>Total Deductions</span>
                              <span className="text-red-600">
                                {formatCurrency(payslip.total_deductions)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Summary */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-3">Summary</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Gross Pay</span>
                              <span className="font-medium">
                                {formatCurrency(payslip.gross_pay)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Total Deductions</span>
                              <span className="font-medium text-red-600">
                                -{formatCurrency(payslip.total_deductions)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm pt-2 border-t">
                              <span className="font-bold">Net Pay</span>
                              <span className="font-bold text-green-600">
                                {formatCurrency(payslip.net_pay)}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-4"
                            onClick={() => payrollService.downloadPayslip(payslip.id)}
                          >
                            <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                            Download PDF
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">No payslips found</div>
          )}
          {myPayslips && myPayslips.length > pageSize && (
            <TablePagination
              currentPage={payslipsPage}
              totalPages={Math.ceil(myPayslips.length / pageSize)}
              totalItems={myPayslips.length}
              pageSize={pageSize}
              onPageChange={setPayslipsPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
