import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CurrencyDollarIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  CalculatorIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { inventoryService } from '@/services/inventory'
import type {
  AssetDepreciation,
  AssetDepreciationFilters,
  Asset,
  ItemCategory,
} from '@/services/inventory'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatsCard } from '@/components/ui/StatsCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Table, { TablePagination } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonTable, SkeletonStatsCard } from '@/components/ui/Skeleton'

const formatCurrency = (value: number) =>
  Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function AssetDepreciationPage() {
  const [activeTab, setActiveTab] = useState('schedule')
  const [filters, setFilters] = useState<AssetDepreciationFilters>({
    fiscal_period: '',
    asset: undefined,
    category: undefined,
    page: 1,
    page_size: 15,
  })

  // Queries
  const { data: depreciationsData, isLoading: loadingDepreciations } = useQuery({
    queryKey: ['asset-depreciations-all', filters],
    queryFn: () => inventoryService.getDepreciations(filters),
  })

  const { data: assetsData, isLoading: loadingAssets } = useQuery({
    queryKey: ['inventory-assets-for-depreciation'],
    queryFn: () => inventoryService.getAssets({ status: 'ACTIVE', page_size: 500 }),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['inventory-categories-asset'],
    queryFn: () => inventoryService.getCategories({ is_asset_category: true }),
  })

  const depreciations = depreciationsData?.results || []
  const totalDepreciations = depreciationsData?.count || 0
  const totalDepPages = Math.ceil(totalDepreciations / (filters.page_size || 15))

  const allAssets = assetsData?.results || []
  const categoryOptions = categories.map((c: ItemCategory) => ({ value: c.id, label: c.name }))
  const assetOptions = allAssets.map((a: Asset) => ({
    value: a.id,
    label: `${a.asset_number} - ${a.name}`,
  }))

  // Compute summary stats from active assets
  const summaryStats = useMemo(() => {
    const totalAssets = allAssets.length
    const totalAcquisitionCost = allAssets.reduce(
      (sum: number, a: Asset) => sum + Number(a.acquisition_cost),
      0
    )
    const totalAccumulated = allAssets.reduce(
      (sum: number, a: Asset) => sum + Number(a.accumulated_depreciation),
      0
    )
    const totalCurrentValue = allAssets.reduce(
      (sum: number, a: Asset) => sum + Number(a.current_value),
      0
    )
    const totalMonthlyDepreciation = allAssets.reduce(
      (sum: number, a: Asset) => sum + Number(a.monthly_depreciation),
      0
    )
    return { totalAssets, totalAcquisitionCost, totalAccumulated, totalCurrentValue, totalMonthlyDepreciation }
  }, [allAssets])

  // Compute category summary
  const categorySummary = useMemo(() => {
    const grouping: Record<
      string,
      {
        id: string
        category_name: string
        count: number
        acquisition_cost: number
        accumulated_depreciation: number
        current_value: number
        monthly_depreciation: number
      }
    > = {}

    allAssets.forEach((asset: Asset) => {
      const catKey = asset.category || 'uncategorized'
      const catName = asset.category_name || 'Uncategorized'
      if (!grouping[catKey]) {
        grouping[catKey] = {
          id: catKey,
          category_name: catName,
          count: 0,
          acquisition_cost: 0,
          accumulated_depreciation: 0,
          current_value: 0,
          monthly_depreciation: 0,
        }
      }
      grouping[catKey].count += 1
      grouping[catKey].acquisition_cost += Number(asset.acquisition_cost)
      grouping[catKey].accumulated_depreciation += Number(asset.accumulated_depreciation)
      grouping[catKey].current_value += Number(asset.current_value)
      grouping[catKey].monthly_depreciation += Number(asset.monthly_depreciation)
    })

    return Object.values(grouping).sort((a, b) => b.acquisition_cost - a.acquisition_cost)
  }, [allAssets])

  // Depreciation schedule per asset
  const assetSchedule = useMemo(() => {
    return allAssets.map((asset: Asset) => {
      const depreciableAmount = Number(asset.acquisition_cost) - Number(asset.salvage_value)
      const monthlyDep = Number(asset.monthly_depreciation)
      const accumulated = Number(asset.accumulated_depreciation)
      const remainingValue = Number(asset.current_value) - Number(asset.salvage_value)
      const remainingMonths = monthlyDep > 0 ? Math.ceil(remainingValue / monthlyDep) : 0
      const percentDepreciated =
        depreciableAmount > 0 ? (accumulated / depreciableAmount) * 100 : 0

      return {
        ...asset,
        depreciableAmount,
        remainingMonths,
        percentDepreciated: Math.min(percentDepreciated, 100),
      }
    })
  }, [allAssets])

  // Depreciation history columns
  const depreciationColumns = [
    {
      key: 'asset',
      header: 'Asset',
      render: (d: AssetDepreciation) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{d.asset_name}</p>
          <p className="text-xs font-mono text-gray-500">{d.asset_number}</p>
        </div>
      ),
    },
    {
      key: 'fiscal_period',
      header: 'Period',
      render: (d: AssetDepreciation) => (
        <span className="text-sm font-medium text-gray-900">{d.fiscal_period}</span>
      ),
    },
    {
      key: 'depreciation_amount',
      header: 'Depreciation',
      render: (d: AssetDepreciation) => (
        <span className="text-sm text-gray-700">{formatCurrency(d.depreciation_amount)}</span>
      ),
    },
    {
      key: 'accumulated',
      header: 'Accumulated',
      render: (d: AssetDepreciation) => (
        <span className="text-sm font-medium text-gray-900">
          {formatCurrency(d.accumulated_depreciation)}
        </span>
      ),
    },
    {
      key: 'book_value',
      header: 'Book Value',
      render: (d: AssetDepreciation) => (
        <span className="text-sm font-medium text-gray-900">{formatCurrency(d.book_value)}</span>
      ),
    },
    {
      key: 'journal',
      header: 'Journal Entry',
      render: (d: AssetDepreciation) => (
        <span className="text-sm text-gray-500">{d.journal_entry || '-'}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (d: AssetDepreciation) => (
        <span className="text-sm text-gray-500">
          {new Date(d.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ]

  // Schedule columns
  const scheduleColumns = [
    {
      key: 'asset_number',
      header: 'Asset #',
      render: (asset: (typeof assetSchedule)[0]) => (
        <span className="text-sm font-mono font-medium text-gray-900">{asset.asset_number}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (asset: (typeof assetSchedule)[0]) => (
        <span className="text-sm font-medium text-gray-900">{asset.name}</span>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (asset: (typeof assetSchedule)[0]) => (
        <Badge variant="default" size="xs">
          {asset.depreciation_method.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'acquisition_cost',
      header: 'Acquisition',
      render: (asset: (typeof assetSchedule)[0]) => (
        <span className="text-sm text-gray-700">{formatCurrency(asset.acquisition_cost)}</span>
      ),
    },
    {
      key: 'depreciable',
      header: 'Depreciable Amt',
      render: (asset: (typeof assetSchedule)[0]) => (
        <span className="text-sm text-gray-700">{formatCurrency(asset.depreciableAmount)}</span>
      ),
    },
    {
      key: 'monthly',
      header: 'Monthly',
      render: (asset: (typeof assetSchedule)[0]) => (
        <span className="text-sm text-gray-700">{formatCurrency(asset.monthly_depreciation)}</span>
      ),
    },
    {
      key: 'accumulated',
      header: 'Accumulated',
      render: (asset: (typeof assetSchedule)[0]) => (
        <span className="text-sm font-medium text-gray-900">
          {formatCurrency(asset.accumulated_depreciation)}
        </span>
      ),
    },
    {
      key: 'book_value',
      header: 'Book Value',
      render: (asset: (typeof assetSchedule)[0]) => (
        <span className="text-sm font-medium text-gray-900">{formatCurrency(asset.current_value)}</span>
      ),
    },
    {
      key: 'progress',
      header: '% Depreciated',
      render: (asset: (typeof assetSchedule)[0]) => (
        <div className="flex items-center gap-2 min-w-[120px]">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                asset.percentDepreciated >= 90
                  ? 'bg-red-500'
                  : asset.percentDepreciated >= 60
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${asset.percentDepreciated}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-10 text-right">
            {asset.percentDepreciated.toFixed(0)}%
          </span>
        </div>
      ),
    },
    {
      key: 'remaining',
      header: 'Remaining (mo.)',
      render: (asset: (typeof assetSchedule)[0]) => (
        <span className="text-sm text-gray-700">{asset.remainingMonths}</span>
      ),
    },
  ]

  // Category summary columns
  const categoryColumns = [
    {
      key: 'category',
      header: 'Category',
      render: (row: (typeof categorySummary)[0]) => (
        <span className="text-sm font-medium text-gray-900">{row.category_name}</span>
      ),
    },
    {
      key: 'count',
      header: 'Assets',
      render: (row: (typeof categorySummary)[0]) => (
        <span className="text-sm font-semibold text-gray-900">{row.count}</span>
      ),
    },
    {
      key: 'acquisition',
      header: 'Acquisition Cost',
      render: (row: (typeof categorySummary)[0]) => (
        <span className="text-sm text-gray-700">{formatCurrency(row.acquisition_cost)}</span>
      ),
    },
    {
      key: 'accumulated',
      header: 'Accum. Depreciation',
      render: (row: (typeof categorySummary)[0]) => (
        <span className="text-sm text-gray-700">{formatCurrency(row.accumulated_depreciation)}</span>
      ),
    },
    {
      key: 'current',
      header: 'Current Value',
      render: (row: (typeof categorySummary)[0]) => (
        <span className="text-sm font-medium text-gray-900">{formatCurrency(row.current_value)}</span>
      ),
    },
    {
      key: 'monthly',
      header: 'Monthly Depr.',
      render: (row: (typeof categorySummary)[0]) => (
        <span className="text-sm text-gray-700">{formatCurrency(row.monthly_depreciation)}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Depreciation"
        subtitle="View depreciation schedules, run history, and category summaries"
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {loadingAssets ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonStatsCard key={i} />)
        ) : (
          <>
            <StatsCard
              title="Active Assets"
              value={summaryStats.totalAssets}
              variant="primary"
              icon={<ChartBarIcon className="h-5 w-5" />}
            />
            <StatsCard
              title="Acquisition Cost"
              value={formatCurrency(summaryStats.totalAcquisitionCost)}
              variant="info"
              icon={<CurrencyDollarIcon className="h-5 w-5" />}
            />
            <StatsCard
              title="Current Book Value"
              value={formatCurrency(summaryStats.totalCurrentValue)}
              variant="success"
              icon={<CurrencyDollarIcon className="h-5 w-5" />}
            />
            <StatsCard
              title="Total Depreciation"
              value={formatCurrency(summaryStats.totalAccumulated)}
              variant="warning"
              icon={<CurrencyDollarIcon className="h-5 w-5" />}
            />
            <StatsCard
              title="Monthly Expense"
              value={formatCurrency(summaryStats.totalMonthlyDepreciation)}
              variant="danger"
              icon={<CalendarDaysIcon className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="schedule">
            <CalculatorIcon className="h-4 w-4 mr-1" />
            Depreciation Schedule
          </TabsTrigger>
          <TabsTrigger value="history">
            <CalendarDaysIcon className="h-4 w-4 mr-1" />
            Depreciation History
          </TabsTrigger>
          <TabsTrigger value="category">
            <ChartBarIcon className="h-4 w-4 mr-1" />
            Summary by Category
          </TabsTrigger>
        </TabsList>

        {/* Depreciation Schedule Tab */}
        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalculatorIcon className="h-5 w-5 text-gray-500" />
                Active Asset Depreciation Schedule
              </CardTitle>
            </CardHeader>
            {loadingAssets ? (
              <SkeletonTable />
            ) : assetSchedule.length === 0 ? (
              <EmptyState
                type="data"
                title="No active assets"
                description="Register assets to see their depreciation schedule."
                compact
              />
            ) : (
              <Table data={assetSchedule} columns={scheduleColumns} />
            )}
          </Card>
        </TabsContent>

        {/* Depreciation History Tab */}
        <TabsContent value="history">
          {/* Filters */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:w-64">
                  <Select
                    options={[{ value: '', label: 'All Assets' }, ...assetOptions]}
                    value={filters.asset || ''}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        asset: e.target.value || undefined,
                        page: 1,
                      }))
                    }
                    placeholder="Filter by Asset"
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Input
                    placeholder="Fiscal Period (e.g., 2026-01)"
                    value={filters.fiscal_period || ''}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        fiscal_period: e.target.value || undefined,
                        page: 1,
                      }))
                    }
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Select
                    options={[{ value: '', label: 'All Categories' }, ...categoryOptions]}
                    value={filters.category || ''}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        category: e.target.value || undefined,
                        page: 1,
                      }))
                    }
                    placeholder="Category"
                  />
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setFilters({ page: 1, page_size: 15 })}
                >
                  <ArrowPathIcon className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            {loadingDepreciations ? (
              <SkeletonTable />
            ) : depreciations.length === 0 ? (
              <EmptyState
                type="data"
                title="No depreciation records found"
                description="Depreciation records will appear here after the monthly depreciation run."
                compact
              />
            ) : (
              <>
                <Table data={depreciations} columns={depreciationColumns} />
                {totalDepPages > 1 && (
                  <TablePagination
                    currentPage={filters.page || 1}
                    totalPages={totalDepPages}
                    totalItems={totalDepreciations}
                    pageSize={filters.page_size || 15}
                    onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
                  />
                )}
              </>
            )}
          </Card>
        </TabsContent>

        {/* Category Summary Tab */}
        <TabsContent value="category">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5 text-gray-500" />
                Depreciation Summary by Category
              </CardTitle>
            </CardHeader>
            {loadingAssets ? (
              <SkeletonTable />
            ) : categorySummary.length === 0 ? (
              <EmptyState
                type="data"
                title="No category data"
                description="Category summaries will appear once assets are registered."
                compact
              />
            ) : (
              <>
                <Table data={categorySummary} columns={categoryColumns} />
                {/* Totals row */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                  <div className="flex flex-wrap gap-6 text-sm">
                    <div>
                      <span className="text-gray-500">Total Categories: </span>
                      <span className="font-semibold text-gray-900">{categorySummary.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Assets: </span>
                      <span className="font-semibold text-gray-900">
                        {categorySummary.reduce((sum, c) => sum + c.count, 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Acquisition: </span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(
                          categorySummary.reduce((sum, c) => sum + c.acquisition_cost, 0)
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Current Value: </span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(
                          categorySummary.reduce((sum, c) => sum + c.current_value, 0)
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Monthly: </span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(
                          categorySummary.reduce((sum, c) => sum + c.monthly_depreciation, 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
