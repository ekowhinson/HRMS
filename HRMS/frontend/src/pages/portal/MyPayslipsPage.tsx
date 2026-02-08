import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BanknotesIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { TablePagination } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import { payrollService } from '@/services/payroll'
import type { Payslip } from '@/types'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function MyPayslipsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ['my-payslips'],
    queryFn: payrollService.getMyPayslips,
  })

  const handleDownload = async (payslip: Payslip) => {
    setDownloading(payslip.id)
    try {
      await payrollService.downloadMyPayslip(payslip.id)
    } catch {
      // silently fail
    } finally {
      setDownloading(null)
    }
  }

  // Sort all payslips by payment date descending
  const sortedPayslips = useMemo(() =>
    [...payslips].sort(
      (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
    ), [payslips])

  // Filter by period search
  const filteredPayslips = useMemo(() => {
    if (!search.trim()) return sortedPayslips
    const q = search.toLowerCase()
    return sortedPayslips.filter((p) => p.period_name?.toLowerCase().includes(q))
  }, [sortedPayslips, search])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Payslips</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and download your payslip history
        </p>
      </div>

      {/* Summary Stats */}
      {sortedPayslips.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
            <p className="text-sm text-gray-500">Latest Net Pay</p>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(sortedPayslips[0].net_pay)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{sortedPayslips[0].period_name}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
            <p className="text-sm text-gray-500">Latest Gross Pay</p>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(sortedPayslips[0].gross_pay)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{sortedPayslips[0].period_name}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
            <p className="text-sm text-gray-500">Total Payslips</p>
            <p className="text-xl font-bold text-gray-900">{sortedPayslips.length}</p>
          </div>
        </div>
      )}

      {/* Payslips List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <BanknotesIcon className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Payslip History</h2>
                <p className="text-sm text-gray-500">Click on a payslip to view details</p>
              </div>
            </div>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search period..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 w-52"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-gray-500">Loading payslips...</div>
          ) : filteredPayslips.length === 0 ? (
            <div className="p-8 text-center">
              <InformationCircleIcon className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">
                {search.trim() ? `No payslips matching "${search}"` : 'No payslips available yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredPayslips.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((payslip) => {
                const isExpanded = expandedId === payslip.id
                return (
                  <div key={payslip.id}>
                    <div
                      className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : payslip.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <DocumentTextIcon className="h-5 w-5 text-gray-500" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">
                              {payslip.period_name}
                            </h3>
                            <p className="text-xs text-gray-400">
                              Paid: {formatDate(payslip.payment_date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900">
                              {formatCurrency(payslip.net_pay)}
                            </p>
                            <p className="text-xs text-gray-400">Net Pay</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownload(payslip)
                            }}
                            isLoading={downloading === payslip.id}
                            leftIcon={<ArrowDownTrayIcon className="h-3.5 w-3.5" />}
                          >
                            PDF
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="px-6 pb-4 bg-gray-50 border-t border-gray-100">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                          <div>
                            <p className="text-xs text-gray-500">Basic Salary</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatCurrency(payslip.basic_salary)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Gross Pay</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatCurrency(payslip.gross_pay)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Total Deductions</p>
                            <p className="text-sm font-semibold text-danger-600">
                              {formatCurrency(payslip.total_deductions)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Net Pay</p>
                            <p className="text-sm font-bold text-success-600">
                              {formatCurrency(payslip.net_pay)}
                            </p>
                          </div>
                        </div>

                        {/* Statutory Deductions */}
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">PAYE Tax</p>
                            <p className="text-sm text-gray-700">{formatCurrency(payslip.paye_tax)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">SSNIT (Employee)</p>
                            <p className="text-sm text-gray-700">
                              {formatCurrency(payslip.ssnit_employee)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">SSNIT (Employer)</p>
                            <p className="text-sm text-gray-700">
                              {formatCurrency(payslip.ssnit_employer)}
                            </p>
                          </div>
                        </div>

                        {/* Allowances */}
                        {payslip.allowances && payslip.allowances.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs font-medium text-gray-500 mb-2">Allowances</p>
                            <div className="space-y-1">
                              {payslip.allowances.map((a, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span className="text-gray-600">{a.name}</span>
                                  <span className="text-gray-900">{formatCurrency(a.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Other Deductions */}
                        {payslip.other_deductions && payslip.other_deductions.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs font-medium text-gray-500 mb-2">
                              Other Deductions
                            </p>
                            <div className="space-y-1">
                              {payslip.other_deductions.map((d, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span className="text-gray-600">{d.name}</span>
                                  <span className="text-danger-600">
                                    {formatCurrency(d.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mt-4 flex justify-end">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleDownload(payslip)}
                            isLoading={downloading === payslip.id}
                            leftIcon={<ArrowDownTrayIcon className="h-4 w-4" />}
                          >
                            Download Payslip
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {filteredPayslips.length > pageSize && (
            <TablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredPayslips.length / pageSize)}
              totalItems={filteredPayslips.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
