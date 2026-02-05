import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon,
  CalculatorIcon,
  InformationCircleIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
} from '@heroicons/react/24/outline'
import { transactionsService } from '@/services/transactions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Table from '@/components/ui/Table'
import { formatCurrency } from '@/lib/utils'
import type { OvertimeBonusTaxConfig, TaxCalculationPreview, TaxBracket } from '@/types'

interface ConfigFormData {
  name: string
  description: string
  overtime_annual_salary_threshold: string
  overtime_basic_percentage_threshold: string
  overtime_rate_below_threshold: string
  overtime_rate_above_threshold: string
  bonus_annual_basic_percentage_threshold: string
  bonus_flat_rate: string
  bonus_excess_to_paye: boolean
  non_resident_overtime_rate: string
  non_resident_bonus_rate: string
  effective_from: string
  effective_to: string
  is_active: boolean
}

const initialFormData: ConfigFormData = {
  name: 'Ghana Tax Configuration',
  description: '',
  overtime_annual_salary_threshold: '18000',
  overtime_basic_percentage_threshold: '50',
  overtime_rate_below_threshold: '5',
  overtime_rate_above_threshold: '10',
  bonus_annual_basic_percentage_threshold: '15',
  bonus_flat_rate: '5',
  bonus_excess_to_paye: true,
  non_resident_overtime_rate: '20',
  non_resident_bonus_rate: '20',
  effective_from: new Date().toISOString().split('T')[0],
  effective_to: '',
  is_active: true,
}

// Ghana PAYE 2024 default brackets
const defaultPAYEBrackets: Array<{
  name: string
  min_amount: number
  max_amount?: number
  rate: number
  cumulative_tax: number
}> = [
  { name: 'First GHS 490', min_amount: 0, max_amount: 490, rate: 0, cumulative_tax: 0 },
  { name: 'Next GHS 110', min_amount: 490, max_amount: 600, rate: 5, cumulative_tax: 0 },
  { name: 'Next GHS 130', min_amount: 600, max_amount: 730, rate: 10, cumulative_tax: 5.5 },
  { name: 'Next GHS 3,166.67', min_amount: 730, max_amount: 3896.67, rate: 17.5, cumulative_tax: 18.5 },
  { name: 'Next GHS 16,000', min_amount: 3896.67, max_amount: 19896.67, rate: 25, cumulative_tax: 572.67 },
  { name: 'Next GHS 30,520', min_amount: 19896.67, max_amount: 50416.67, rate: 30, cumulative_tax: 4572.67 },
  { name: 'Exceeding GHS 50,416.67', min_amount: 50416.67, max_amount: undefined, rate: 35, cumulative_tax: 13728.67 },
]

interface BracketFormData {
  name: string
  min_amount: string
  max_amount: string
  rate: string
  effective_from: string
}

export default function TaxConfigurationPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'overtime-bonus' | 'paye'>('paye')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState<ConfigFormData>(initialFormData)
  const [editingConfig, setEditingConfig] = useState<OvertimeBonusTaxConfig | null>(null)
  const [showCalculator, setShowCalculator] = useState(false)
  const [calcInputs, setCalcInputs] = useState({
    overtime_amount: '1000',
    bonus_amount: '5000',
    basic_salary: '3000',
    annual_salary: '36000',
    is_resident: true,
  })
  const [calcResult, setCalcResult] = useState<TaxCalculationPreview | null>(null)

  // PAYE Brackets state
  const [showBracketModal, setShowBracketModal] = useState(false)
  const [editingBracket, setEditingBracket] = useState<TaxBracket | null>(null)
  const [bracketFormData, setBracketFormData] = useState<BracketFormData>({
    name: '',
    min_amount: '0',
    max_amount: '',
    rate: '0',
    effective_from: new Date().toISOString().split('T')[0],
  })

  // Fetch all configurations
  const { data: configsData, isLoading } = useQuery({
    queryKey: ['tax-configs'],
    queryFn: () => transactionsService.getTaxConfigs(),
  })

  // Fetch active configuration
  const { data: activeConfig } = useQuery({
    queryKey: ['active-tax-config'],
    queryFn: () => transactionsService.getActiveTaxConfig(),
  })

  // Fetch PAYE brackets
  const { data: bracketsData, isLoading: bracketsLoading } = useQuery({
    queryKey: ['paye-brackets'],
    queryFn: () => transactionsService.getActiveTaxBrackets(),
  })

  const configs = configsData?.results || []
  const brackets = bracketsData || []

  const createMutation = useMutation({
    mutationFn: (data: Partial<OvertimeBonusTaxConfig>) => transactionsService.createTaxConfig(data),
    onSuccess: () => {
      toast.success('Tax configuration created')
      queryClient.invalidateQueries({ queryKey: ['tax-configs'] })
      queryClient.invalidateQueries({ queryKey: ['active-tax-config'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create configuration')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<OvertimeBonusTaxConfig> }) =>
      transactionsService.updateTaxConfig(id, data),
    onSuccess: () => {
      toast.success('Tax configuration updated')
      queryClient.invalidateQueries({ queryKey: ['tax-configs'] })
      queryClient.invalidateQueries({ queryKey: ['active-tax-config'] })
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update configuration')
    },
  })

  const activateMutation = useMutation({
    mutationFn: (id: string) => transactionsService.activateTaxConfig(id),
    onSuccess: () => {
      toast.success('Tax configuration activated')
      queryClient.invalidateQueries({ queryKey: ['tax-configs'] })
      queryClient.invalidateQueries({ queryKey: ['active-tax-config'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to activate configuration')
    },
  })

  const calculatePreviewMutation = useMutation({
    mutationFn: () =>
      transactionsService.previewTaxCalculation(
        parseFloat(calcInputs.overtime_amount) || 0,
        parseFloat(calcInputs.bonus_amount) || 0,
        parseFloat(calcInputs.basic_salary) || 0,
        parseFloat(calcInputs.annual_salary) || 0,
        calcInputs.is_resident
      ),
    onSuccess: (data) => {
      setCalcResult(data)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to calculate preview')
    },
  })

  // PAYE Bracket mutations
  const createBracketMutation = useMutation({
    mutationFn: (data: Partial<TaxBracket>) => transactionsService.createTaxBracket(data),
    onSuccess: () => {
      toast.success('Tax bracket created')
      queryClient.invalidateQueries({ queryKey: ['paye-brackets'] })
      handleCloseBracketModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create bracket')
    },
  })

  const updateBracketMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TaxBracket> }) =>
      transactionsService.updateTaxBracket(id, data),
    onSuccess: () => {
      toast.success('Tax bracket updated')
      queryClient.invalidateQueries({ queryKey: ['paye-brackets'] })
      handleCloseBracketModal()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update bracket')
    },
  })

  const deleteBracketMutation = useMutation({
    mutationFn: (id: string) => transactionsService.deleteTaxBracket(id),
    onSuccess: () => {
      toast.success('Tax bracket deleted')
      queryClient.invalidateQueries({ queryKey: ['paye-brackets'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete bracket')
    },
  })

  const bulkUpdateBracketsMutation = useMutation({
    mutationFn: (brackets: Partial<TaxBracket>[]) => transactionsService.bulkUpdateTaxBrackets(brackets),
    onSuccess: () => {
      toast.success('PAYE brackets updated to Ghana 2024 rates')
      queryClient.invalidateQueries({ queryKey: ['paye-brackets'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update brackets')
    },
  })

  const handleOpenCreate = () => {
    setEditingConfig(null)
    setFormData(initialFormData)
    setShowModal(true)
  }

  const handleOpenEdit = (config: OvertimeBonusTaxConfig) => {
    setEditingConfig(config)
    setFormData({
      name: config.name,
      description: config.description || '',
      overtime_annual_salary_threshold: config.overtime_annual_salary_threshold.toString(),
      overtime_basic_percentage_threshold: config.overtime_basic_percentage_threshold.toString(),
      overtime_rate_below_threshold: config.overtime_rate_below_threshold.toString(),
      overtime_rate_above_threshold: config.overtime_rate_above_threshold.toString(),
      bonus_annual_basic_percentage_threshold: config.bonus_annual_basic_percentage_threshold.toString(),
      bonus_flat_rate: config.bonus_flat_rate.toString(),
      bonus_excess_to_paye: config.bonus_excess_to_paye,
      non_resident_overtime_rate: config.non_resident_overtime_rate.toString(),
      non_resident_bonus_rate: config.non_resident_bonus_rate.toString(),
      effective_from: config.effective_from,
      effective_to: config.effective_to || '',
      is_active: config.is_active,
    })
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingConfig(null)
    setFormData(initialFormData)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const data: Partial<OvertimeBonusTaxConfig> = {
      name: formData.name,
      description: formData.description || undefined,
      overtime_annual_salary_threshold: parseFloat(formData.overtime_annual_salary_threshold),
      overtime_basic_percentage_threshold: parseFloat(formData.overtime_basic_percentage_threshold),
      overtime_rate_below_threshold: parseFloat(formData.overtime_rate_below_threshold),
      overtime_rate_above_threshold: parseFloat(formData.overtime_rate_above_threshold),
      bonus_annual_basic_percentage_threshold: parseFloat(formData.bonus_annual_basic_percentage_threshold),
      bonus_flat_rate: parseFloat(formData.bonus_flat_rate),
      bonus_excess_to_paye: formData.bonus_excess_to_paye,
      non_resident_overtime_rate: parseFloat(formData.non_resident_overtime_rate),
      non_resident_bonus_rate: parseFloat(formData.non_resident_bonus_rate),
      effective_from: formData.effective_from,
      effective_to: formData.effective_to || undefined,
      is_active: formData.is_active,
    }

    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  // PAYE Bracket handlers
  const handleOpenCreateBracket = () => {
    setEditingBracket(null)
    setBracketFormData({
      name: '',
      min_amount: '0',
      max_amount: '',
      rate: '0',
      effective_from: new Date().toISOString().split('T')[0],
    })
    setShowBracketModal(true)
  }

  const handleOpenEditBracket = (bracket: TaxBracket) => {
    setEditingBracket(bracket)
    setBracketFormData({
      name: bracket.name,
      min_amount: bracket.min_amount.toString(),
      max_amount: bracket.max_amount?.toString() || '',
      rate: bracket.rate.toString(),
      effective_from: bracket.effective_from,
    })
    setShowBracketModal(true)
  }

  const handleCloseBracketModal = () => {
    setShowBracketModal(false)
    setEditingBracket(null)
  }

  const handleBracketSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const data: Partial<TaxBracket> = {
      name: bracketFormData.name,
      min_amount: parseFloat(bracketFormData.min_amount),
      max_amount: bracketFormData.max_amount ? parseFloat(bracketFormData.max_amount) : undefined,
      rate: parseFloat(bracketFormData.rate),
      effective_from: bracketFormData.effective_from,
      is_active: true,
      order: brackets.length,
    }

    if (editingBracket) {
      updateBracketMutation.mutate({ id: editingBracket.id, data })
    } else {
      createBracketMutation.mutate(data)
    }
  }

  const handleLoadGhanaPAYE = () => {
    const bracketsWithDates = defaultPAYEBrackets.map((b, i) => ({
      ...b,
      effective_from: new Date().toISOString().split('T')[0],
      order: i,
      is_active: true,
    }))
    bulkUpdateBracketsMutation.mutate(bracketsWithDates)
  }

  const bracketColumns = [
    {
      key: 'name',
      header: 'Bracket',
      render: (item: TaxBracket) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'range',
      header: 'Income Range (GHS)',
      render: (item: TaxBracket) => (
        <span>
          {formatCurrency(item.min_amount)} - {item.max_amount ? formatCurrency(item.max_amount) : 'Above'}
        </span>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      render: (item: TaxBracket) => <Badge variant="info">{item.rate}%</Badge>,
    },
    {
      key: 'cumulative',
      header: 'Cumulative Tax',
      render: (item: TaxBracket) => <span>{formatCurrency(item.cumulative_tax)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: TaxBracket) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleOpenEditBracket(item)}
            className="p-1 text-gray-500 hover:text-primary-600"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (confirm('Delete this tax bracket?')) {
                deleteBracketMutation.mutate(item.id)
              }
            }}
            className="p-1 text-gray-500 hover:text-red-600"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Configuration</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure PAYE brackets, overtime, and bonus tax rates for Ghana compliance
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowCalculator(true)}>
            <CalculatorIcon className="h-4 w-4 mr-2" />
            Tax Calculator
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('paye')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'paye'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            PAYE Tax Brackets
          </button>
          <button
            onClick={() => setActiveTab('overtime-bonus')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overtime-bonus'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overtime & Bonus Tax
          </button>
        </nav>
      </div>

      {/* PAYE Tab Content */}
      {activeTab === 'paye' && (
        <div className="space-y-6">
          {/* PAYE Info Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-3">
                <InformationCircleIcon className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-600">
                  <p><strong>Ghana PAYE Tax System:</strong></p>
                  <p className="mt-1">
                    PAYE (Pay As You Earn) is calculated using progressive tax brackets. Each bracket has a threshold
                    and rate. Income is taxed at increasing rates as it moves through higher brackets. The cumulative
                    tax shows the total tax from all previous brackets.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PAYE Brackets */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>PAYE Tax Brackets</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadGhanaPAYE}
                    isLoading={bulkUpdateBracketsMutation.isPending}
                  >
                    Load Ghana 2024 Rates
                  </Button>
                  <Button size="sm" onClick={handleOpenCreateBracket}>
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add Bracket
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table
                data={brackets}
                columns={bracketColumns}
                isLoading={bracketsLoading}
                emptyMessage="No tax brackets configured. Click 'Load Ghana 2024 Rates' to get started."
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Overtime & Bonus Tab Content */}
      {activeTab === 'overtime-bonus' && (
        <div className="space-y-6">
          {/* Active Configuration Summary */}
          {activeConfig && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    Active Configuration
                  </CardTitle>
                  <Badge variant="success">Active</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Overtime Section */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900 border-b pb-2">Overtime Tax Rules</h4>
                    <div className="space-y-2 text-sm">
                      <div className="p-2 bg-green-100 rounded-lg mb-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 font-medium">Qualifying Employment Income:</span>
                          <span className="font-bold text-green-700">{formatCurrency(activeConfig.overtime_annual_salary_threshold)}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Annual salary threshold for preferential overtime rates
                        </p>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Basic % Threshold:</span>
                        <span className="font-medium">{activeConfig.overtime_basic_percentage_threshold}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Rate (Below Threshold):</span>
                        <span className="font-medium text-green-600">{activeConfig.overtime_rate_below_threshold}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Rate (Above Threshold):</span>
                        <span className="font-medium text-amber-600">{activeConfig.overtime_rate_above_threshold}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Bonus Section */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900 border-b pb-2">Bonus Tax Rules</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Annual Basic % Threshold:</span>
                        <span className="font-medium">{activeConfig.bonus_annual_basic_percentage_threshold}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Flat Tax Rate:</span>
                        <span className="font-medium text-green-600">{activeConfig.bonus_flat_rate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Excess to PAYE:</span>
                        <span className="font-medium">{activeConfig.bonus_excess_to_paye ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Non-Resident Section */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900 border-b pb-2">Non-Resident Rates</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Overtime Tax Rate:</span>
                        <span className="font-medium text-red-600">{activeConfig.non_resident_overtime_rate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Bonus Tax Rate:</span>
                        <span className="font-medium text-red-600">{activeConfig.non_resident_bonus_rate}%</span>
                      </div>
                    </div>
                    <div className="pt-3 border-t">
                      <Button size="sm" variant="outline" onClick={() => handleOpenEdit(activeConfig)}>
                        Edit Configuration
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Information Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-3">
                <InformationCircleIcon className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-600 space-y-2">
                  <p><strong>Ghana Overtime Tax Rules (GRA):</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>Qualifying Employment Income:</strong> Employees whose total cash emoluments do not exceed the threshold (default GHS 18,000/year) qualify for preferential overtime rates</li>
                    <li>Overtime up to 50% of monthly basic: 5% tax</li>
                    <li>Overtime exceeding 50% of monthly basic: 10% tax on the excess</li>
                    <li>Employees earning above the Qualifying Employment Income threshold have their overtime added to taxable income and taxed via PAYE</li>
                  </ul>
                  <p className="pt-2"><strong>Ghana Bonus Tax Rules:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Bonus up to 15% of annual basic salary: 5% flat tax</li>
                    <li>Bonus exceeding threshold is added to taxable income for PAYE calculation</li>
                    <li>Non-residents are taxed at a flat 20% on both overtime and bonus</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* All Configurations */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All Configurations</CardTitle>
                <Button size="sm" onClick={handleOpenCreate}>
                  <PlusIcon className="h-4 w-4 mr-1" />
                  New Configuration
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : configs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No configurations found. Create one to get started.</div>
              ) : (
                <div className="space-y-4">
                  {configs.map((config) => (
                    <div
                      key={config.id}
                      className={`p-4 border rounded-lg ${
                        config.is_active ? 'border-green-300 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{config.name}</span>
                            {config.is_active && <Badge variant="success">Active</Badge>}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            Effective: {config.effective_from}
                            {config.effective_to && ` to ${config.effective_to}`}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!config.is_active && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => activateMutation.mutate(config.id)}
                              isLoading={activateMutation.isPending}
                            >
                              Activate
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => handleOpenEdit(config)}>
                            Edit
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create/Edit Overtime/Bonus Config Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingConfig ? 'Edit Tax Configuration' : 'Create Tax Configuration'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Configuration Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Effective From"
              type="date"
              value={formData.effective_from}
              onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <Input
              label="Effective To (Optional)"
              type="date"
              value={formData.effective_to}
              onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
            />
          </div>

          {/* Overtime Configuration */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-4">
            <h4 className="font-medium text-green-800">Overtime Tax Configuration</h4>
            <div className="space-y-4">
              <div>
                <Input
                  label="Qualifying Employment Income (GHS/Year)"
                  type="number"
                  step="0.01"
                  value={formData.overtime_annual_salary_threshold}
                  onChange={(e) => setFormData({ ...formData, overtime_annual_salary_threshold: e.target.value })}
                  required
                />
                <p className="text-xs text-green-600 mt-1">
                  Employees earning up to this amount annually qualify for preferential overtime rates (5%/10%). Higher earners have overtime taxed via PAYE.
                </p>
              </div>
              <Input
                label="Basic Salary % Threshold"
                type="number"
                step="0.01"
                value={formData.overtime_basic_percentage_threshold}
                onChange={(e) => setFormData({ ...formData, overtime_basic_percentage_threshold: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Rate Below Threshold (%)"
                type="number"
                step="0.01"
                value={formData.overtime_rate_below_threshold}
                onChange={(e) => setFormData({ ...formData, overtime_rate_below_threshold: e.target.value })}
                required
              />
              <Input
                label="Rate Above Threshold (%)"
                type="number"
                step="0.01"
                value={formData.overtime_rate_above_threshold}
                onChange={(e) => setFormData({ ...formData, overtime_rate_above_threshold: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Bonus Configuration */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
            <h4 className="font-medium text-blue-800">Bonus Tax Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Annual Basic % Threshold"
                type="number"
                step="0.01"
                value={formData.bonus_annual_basic_percentage_threshold}
                onChange={(e) => setFormData({ ...formData, bonus_annual_basic_percentage_threshold: e.target.value })}
                required
              />
              <Input
                label="Flat Tax Rate (%)"
                type="number"
                step="0.01"
                value={formData.bonus_flat_rate}
                onChange={(e) => setFormData({ ...formData, bonus_flat_rate: e.target.value })}
                required
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.bonus_excess_to_paye}
                onChange={(e) => setFormData({ ...formData, bonus_excess_to_paye: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-blue-700">Add excess bonus to taxable income for PAYE</span>
            </label>
          </div>

          {/* Non-Resident Rates */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-4">
            <h4 className="font-medium text-amber-800">Non-Resident Tax Rates</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Overtime Tax Rate (%)"
                type="number"
                step="0.01"
                value={formData.non_resident_overtime_rate}
                onChange={(e) => setFormData({ ...formData, non_resident_overtime_rate: e.target.value })}
                required
              />
              <Input
                label="Bonus Tax Rate (%)"
                type="number"
                step="0.01"
                value={formData.non_resident_bonus_rate}
                onChange={(e) => setFormData({ ...formData, non_resident_bonus_rate: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Status */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium">Set as Active Configuration</span>
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingConfig ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* PAYE Bracket Modal */}
      <Modal
        isOpen={showBracketModal}
        onClose={handleCloseBracketModal}
        title={editingBracket ? 'Edit Tax Bracket' : 'Add Tax Bracket'}
      >
        <form onSubmit={handleBracketSubmit} className="space-y-4">
          <Input
            label="Bracket Name"
            value={bracketFormData.name}
            onChange={(e) => setBracketFormData({ ...bracketFormData, name: e.target.value })}
            placeholder="e.g., First GHS 490"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Min Amount (GHS)"
              type="number"
              step="0.01"
              value={bracketFormData.min_amount}
              onChange={(e) => setBracketFormData({ ...bracketFormData, min_amount: e.target.value })}
              required
            />
            <Input
              label="Max Amount (GHS)"
              type="number"
              step="0.01"
              value={bracketFormData.max_amount}
              onChange={(e) => setBracketFormData({ ...bracketFormData, max_amount: e.target.value })}
              placeholder="Leave empty for 'Exceeding'"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tax Rate (%)"
              type="number"
              step="0.01"
              value={bracketFormData.rate}
              onChange={(e) => setBracketFormData({ ...bracketFormData, rate: e.target.value })}
              required
            />
            <Input
              label="Effective From"
              type="date"
              value={bracketFormData.effective_from}
              onChange={(e) => setBracketFormData({ ...bracketFormData, effective_from: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleCloseBracketModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createBracketMutation.isPending || updateBracketMutation.isPending}
            >
              {editingBracket ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Tax Calculator Modal */}
      <Modal
        isOpen={showCalculator}
        onClose={() => {
          setShowCalculator(false)
          setCalcResult(null)
        }}
        title="Overtime & Bonus Tax Calculator"
        size="lg"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Overtime Amount (GHS)"
              type="number"
              step="0.01"
              value={calcInputs.overtime_amount}
              onChange={(e) => setCalcInputs({ ...calcInputs, overtime_amount: e.target.value })}
            />
            <Input
              label="Bonus Amount (GHS)"
              type="number"
              step="0.01"
              value={calcInputs.bonus_amount}
              onChange={(e) => setCalcInputs({ ...calcInputs, bonus_amount: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Monthly Basic Salary (GHS)"
              type="number"
              step="0.01"
              value={calcInputs.basic_salary}
              onChange={(e) => setCalcInputs({ ...calcInputs, basic_salary: e.target.value })}
            />
            <Input
              label="Annual Salary (GHS)"
              type="number"
              step="0.01"
              value={calcInputs.annual_salary}
              onChange={(e) => setCalcInputs({ ...calcInputs, annual_salary: e.target.value })}
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={calcInputs.is_resident}
              onChange={(e) => setCalcInputs({ ...calcInputs, is_resident: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm">Ghana Resident</span>
          </label>

          <Button
            onClick={() => calculatePreviewMutation.mutate()}
            isLoading={calculatePreviewMutation.isPending}
            className="w-full"
          >
            <CalculatorIcon className="h-4 w-4 mr-2" />
            Calculate Tax
          </Button>

          {calcResult && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-4">
              <h4 className="font-medium text-gray-900">Calculation Results</h4>

              {/* Overtime Results */}
              <div className="p-3 bg-white rounded border">
                <h5 className="text-sm font-medium text-green-700 mb-2">Overtime Tax</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Overtime Amount:</span>
                    <span>{formatCurrency(parseFloat(calcResult.inputs?.overtime_amount || '0'))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Qualifying Employment Income:</span>
                    <span>{formatCurrency(parseFloat(calcResult.overtime?.salary_threshold || '0'))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Meets Qualifying Income Threshold:</span>
                    <span className={calcResult.overtime?.qualifies_for_preferential_rate ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                      {calcResult.overtime?.qualifies_for_preferential_rate ? 'Yes (Preferential Rates Apply)' : 'No (Taxed via PAYE)'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{calcResult.overtime?.explanation}</div>
                  <div className="flex justify-between font-medium pt-2">
                    <span>Overtime Tax:</span>
                    <span className="text-red-600">{formatCurrency(parseFloat(calcResult.overtime?.overtime_tax || '0'))}</span>
                  </div>
                  {parseFloat(calcResult.overtime?.overtime_to_paye || '0') > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Added to PAYE Taxable:</span>
                      <span>{formatCurrency(parseFloat(calcResult.overtime.overtime_to_paye))}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bonus Results */}
              <div className="p-3 bg-white rounded border">
                <h5 className="text-sm font-medium text-blue-700 mb-2">Bonus Tax</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Bonus Amount:</span>
                    <span>{formatCurrency(parseFloat(calcResult.inputs?.bonus_amount || '0'))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Threshold ({calcResult.config?.bonus_annual_basic_percentage_threshold}% of Annual Basic):</span>
                    <span>{formatCurrency(parseFloat(calcResult.bonus?.threshold_amount || '0'))}</span>
                  </div>
                  <div className="flex justify-between font-medium pt-2">
                    <span>Bonus Tax (at {calcResult.config?.bonus_flat_rate}%):</span>
                    <span className="text-red-600">{formatCurrency(parseFloat(calcResult.bonus?.bonus_tax || '0'))}</span>
                  </div>
                  {parseFloat(calcResult.bonus?.bonus_excess_to_paye || '0') > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Excess Added to PAYE Taxable:</span>
                      <span>{formatCurrency(parseFloat(calcResult.bonus.bonus_excess_to_paye))}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-3 bg-gray-100 rounded border border-gray-300">
                <div className="flex justify-between font-medium">
                  <span>Total PAYE Addition:</span>
                  <span className="text-amber-600">
                    {formatCurrency(
                      parseFloat(calcResult.overtime?.overtime_to_paye || '0') +
                      parseFloat(calcResult.bonus?.bonus_excess_to_paye || '0')
                    )}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  This amount will be added to regular taxable income for PAYE calculation.
                </p>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
