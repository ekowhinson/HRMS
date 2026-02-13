import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  BuildingOffice2Icon,
  PlusIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  KeyIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { TablePagination } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { organizationService, type Organization } from '@/services/organization'
import type { License } from '@/types'

const planColors: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
  enterprise: 'success',
  professional: 'info',
  starter: 'warning',
  trial: 'default',
}

const licenseTypeColors: Record<string, 'success' | 'info' | 'warning' | 'default' | 'danger'> = {
  ENTERPRISE: 'success',
  PREMIUM: 'info',
  STANDARD: 'warning',
  FREE: 'default',
  TRIAL: 'default',
}

const ALL_MODULES = [
  'employees', 'payroll', 'leave', 'benefits', 'performance',
  'recruitment', 'discipline', 'training', 'exits', 'finance',
  'procurement', 'inventory', 'projects',
]

export default function TenantManagementPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [showModulesModal, setShowModulesModal] = useState(false)
  const [showLicenseListModal, setShowLicenseListModal] = useState(false)
  const [showCreateLicenseModal, setShowCreateLicenseModal] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<Organization | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    country: '',
    currency: 'GHS',
    currency_symbol: 'GH\u20B5',
    timezone: 'Africa/Accra',
    email_domain: '',
    phone: '',
    address: '',
    subscription_plan: 'starter',
    max_employees: 50,
    max_users: 10,
  })

  const [selectedModules, setSelectedModules] = useState<string[]>([])

  // License form state
  const [licenseFormData, setLicenseFormData] = useState({
    license_type: 'STANDARD',
    max_users: 10,
    max_employees: 50,
    modules_allowed: [] as string[],
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '',
    notes: '',
  })

  // Query
  const { data: tenantsData, isLoading } = useQuery({
    queryKey: ['tenants', page, pageSize],
    queryFn: () => organizationService.getOrganizations({ page, page_size: pageSize }),
  })

  const tenants = tenantsData?.results || []
  const totalItems = tenantsData?.count || 0
  const totalPages = Math.ceil(totalItems / pageSize)

  // Stats query
  const { data: statsData } = useQuery({
    queryKey: ['tenant-stats', selectedTenant?.id],
    queryFn: () => organizationService.getOrganizationStats(selectedTenant!.id),
    enabled: !!selectedTenant?.id && showStatsModal,
  })

  // Licenses query for selected tenant
  const { data: licenses, isLoading: licensesLoading } = useQuery({
    queryKey: ['licenses', selectedTenant?.id],
    queryFn: () => organizationService.getLicenses(selectedTenant!.id),
    enabled: !!selectedTenant?.id && showLicenseListModal,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<Organization>) => organizationService.createOrganization(data),
    onSuccess: () => {
      toast.success('Tenant created successfully')
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setShowCreateModal(false)
      resetForm()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to create tenant')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Organization> }) =>
      organizationService.updateOrganization(id, data),
    onSuccess: () => {
      toast.success('Tenant updated successfully')
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setShowEditModal(false)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to update tenant')
    },
  })

  const activateMutation = useMutation({
    mutationFn: (id: string) => organizationService.activateOrganization(id),
    onSuccess: () => {
      toast.success('Tenant activated')
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => organizationService.deactivateOrganization(id),
    onSuccess: () => {
      toast.success('Tenant deactivated')
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })

  const setupMutation = useMutation({
    mutationFn: (id: string) => organizationService.setupOrganization(id, { async: true }),
    onSuccess: (data) => {
      if (data.task_id) {
        toast.success('Setup started in background')
      } else {
        toast.success('Setup completed')
      }
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Setup failed')
    },
  })

  const modulesMutation = useMutation({
    mutationFn: ({ id, modules }: { id: string; modules: string[] }) =>
      organizationService.updateModules(id, modules),
    onSuccess: () => {
      toast.success('Modules updated')
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setShowModulesModal(false)
    },
  })

  const createLicenseMutation = useMutation({
    mutationFn: (data: Parameters<typeof organizationService.createLicense>[0]) =>
      organizationService.createLicense(data),
    onSuccess: () => {
      toast.success('License created successfully')
      queryClient.invalidateQueries({ queryKey: ['licenses', selectedTenant?.id] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setShowCreateLicenseModal(false)
      resetLicenseForm()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to create license')
    },
  })

  const activateLicenseMutation = useMutation({
    mutationFn: (id: string) => organizationService.activateLicense(id),
    onSuccess: () => {
      toast.success('License activated')
      queryClient.invalidateQueries({ queryKey: ['licenses', selectedTenant?.id] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })

  const deactivateLicenseMutation = useMutation({
    mutationFn: (id: string) => organizationService.deactivateLicense(id),
    onSuccess: () => {
      toast.success('License deactivated')
      queryClient.invalidateQueries({ queryKey: ['licenses', selectedTenant?.id] })
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      country: '',
      currency: 'GHS',
      currency_symbol: 'GH\u20B5',
      timezone: 'Africa/Accra',
      email_domain: '',
      phone: '',
      address: '',
      subscription_plan: 'starter',
      max_employees: 50,
      max_users: 10,
    })
  }

  const resetLicenseForm = () => {
    setLicenseFormData({
      license_type: 'STANDARD',
      max_users: 10,
      max_employees: 50,
      modules_allowed: [],
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: '',
      notes: '',
    })
  }

  const handleCreate = () => {
    if (!formData.name || !formData.code) {
      toast.error('Name and code are required')
      return
    }
    createMutation.mutate(formData)
  }

  const handleEdit = (tenant: Organization) => {
    setSelectedTenant(tenant)
    setFormData({
      name: tenant.name,
      code: tenant.code,
      country: tenant.country,
      currency: tenant.currency,
      currency_symbol: tenant.currency_symbol,
      timezone: tenant.timezone,
      email_domain: tenant.email_domain || '',
      phone: tenant.phone || '',
      address: tenant.address || '',
      subscription_plan: tenant.subscription_plan,
      max_employees: tenant.max_employees,
      max_users: tenant.max_users,
    })
    setShowEditModal(true)
  }

  const handleUpdate = () => {
    if (!selectedTenant) return
    updateMutation.mutate({ id: selectedTenant.id, data: formData })
  }

  const handleOpenModules = (tenant: Organization) => {
    setSelectedTenant(tenant)
    setSelectedModules(tenant.modules_enabled || [])
    setShowModulesModal(true)
  }

  const handleOpenLicenses = (tenant: Organization) => {
    setSelectedTenant(tenant)
    setShowLicenseListModal(true)
  }

  const handleCreateLicense = () => {
    if (!selectedTenant) return
    createLicenseMutation.mutate({
      organization: selectedTenant.id,
      license_type: licenseFormData.license_type,
      max_users: licenseFormData.max_users,
      max_employees: licenseFormData.max_employees,
      modules_allowed: licenseFormData.modules_allowed,
      valid_from: licenseFormData.valid_from,
      valid_until: licenseFormData.valid_until || null,
      notes: licenseFormData.notes,
    })
  }

  const filteredTenants = search
    ? tenants.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.code.toLowerCase().includes(search.toLowerCase())
      )
    : tenants

  const getLicenseExpiryWarning = (license: License | null | undefined) => {
    if (!license) return null
    if (!license.is_valid && license.is_active) return 'expired'
    if (license.days_remaining !== null && license.days_remaining <= 30) return 'expiring'
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage organizations, subscriptions, and licenses</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateModal(true) }}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Tenant
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <Input
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="max-w-sm"
          />
        </CardContent>
      </Card>

      {/* Tenants Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BuildingOffice2Icon className="h-5 w-5" />
            Organizations ({totalItems})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading tenants...</div>
          ) : filteredTenants.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No tenants found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">License</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Limits</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTenants.map((tenant) => {
                      const license = tenant.active_license
                      const expiryWarning = getLicenseExpiryWarning(license)

                      return (
                        <tr key={tenant.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                                <BuildingOffice2Icon className="h-4 w-4 text-primary-600" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{tenant.name}</div>
                                <div className="text-xs text-gray-500">{tenant.country}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 font-mono">{tenant.code}</td>
                          <td className="px-4 py-3">
                            <Badge variant={planColors[tenant.subscription_plan] || 'default'}>
                              {tenant.subscription_plan}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {license ? (
                              <div>
                                <Badge variant={licenseTypeColors[license.license_type] || 'default'}>
                                  {license.license_type}
                                </Badge>
                                {expiryWarning === 'expired' && (
                                  <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                                    <ExclamationTriangleIcon className="h-3 w-3" />
                                    Expired
                                  </div>
                                )}
                                {expiryWarning === 'expiring' && (
                                  <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                                    <ExclamationTriangleIcon className="h-3 w-3" />
                                    {license.days_remaining}d left
                                  </div>
                                )}
                                {!expiryWarning && license.valid_until && (
                                  <div className="text-xs text-gray-400 mt-0.5">
                                    Until {license.valid_until}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">No license</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div>{tenant.max_employees} employees</div>
                            <div className="text-xs text-gray-400">{tenant.max_users} users</div>
                          </td>
                          <td className="px-4 py-3">
                            {tenant.is_active ? (
                              <Badge variant="success">Active</Badge>
                            ) : (
                              <Badge variant="danger">Inactive</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEdit(tenant)}
                                className="p-1.5 text-gray-400 hover:text-primary-600 rounded"
                                title="Edit"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => { setSelectedTenant(tenant); setShowStatsModal(true) }}
                                className="p-1.5 text-gray-400 hover:text-primary-600 rounded"
                                title="Stats"
                              >
                                <ChartBarIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleOpenLicenses(tenant)}
                                className="p-1.5 text-gray-400 hover:text-amber-600 rounded"
                                title="Manage Licenses"
                              >
                                <KeyIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleOpenModules(tenant)}
                                className="p-1.5 text-gray-400 hover:text-primary-600 rounded"
                                title="Modules"
                              >
                                <Cog6ToothIcon className="h-4 w-4" />
                              </button>
                              {!tenant.setup_completed && (
                                <button
                                  onClick={() => setupMutation.mutate(tenant.id)}
                                  className="p-1.5 text-gray-400 hover:text-green-600 rounded"
                                  title="Run Setup"
                                  disabled={setupMutation.isPending}
                                >
                                  <ArrowPathIcon className={`h-4 w-4 ${setupMutation.isPending ? 'animate-spin' : ''}`} />
                                </button>
                              )}
                              {tenant.is_active ? (
                                <button
                                  onClick={() => deactivateMutation.mutate(tenant.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                                  title="Deactivate"
                                >
                                  <XCircleIcon className="h-4 w-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => activateMutation.mutate(tenant.id)}
                                  className="p-1.5 text-gray-400 hover:text-green-600 rounded"
                                  title="Activate"
                                >
                                  <CheckCircleIcon className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Tenant Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Tenant">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Organization Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              required
              placeholder="e.g. ACME"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Currency"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              />
              <Input
                label="Symbol"
                value={formData.currency_symbol}
                onChange={(e) => setFormData({ ...formData, currency_symbol: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email Domain"
              value={formData.email_domain}
              onChange={(e) => setFormData({ ...formData, email_domain: e.target.value })}
              placeholder="company.com"
            />
            <Input
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Plan"
              value={formData.subscription_plan}
              onChange={(e) => setFormData({ ...formData, subscription_plan: e.target.value })}
              options={[
                { value: 'trial', label: 'Trial' },
                { value: 'starter', label: 'Starter' },
                { value: 'professional', label: 'Professional' },
                { value: 'enterprise', label: 'Enterprise' },
              ]}
            />
            <Input
              label="Max Employees"
              type="number"
              value={formData.max_employees}
              onChange={(e) => setFormData({ ...formData, max_employees: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="Max Users"
              type="number"
              value={formData.max_users}
              onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Tenant'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Tenant Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Tenant">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Organization Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Currency"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              />
              <Input
                label="Symbol"
                value={formData.currency_symbol}
                onChange={(e) => setFormData({ ...formData, currency_symbol: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email Domain"
              value={formData.email_domain}
              onChange={(e) => setFormData({ ...formData, email_domain: e.target.value })}
            />
            <Input
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Plan"
              value={formData.subscription_plan}
              onChange={(e) => setFormData({ ...formData, subscription_plan: e.target.value })}
              options={[
                { value: 'trial', label: 'Trial' },
                { value: 'starter', label: 'Starter' },
                { value: 'professional', label: 'Professional' },
                { value: 'enterprise', label: 'Enterprise' },
              ]}
            />
            <Input
              label="Max Employees"
              type="number"
              value={formData.max_employees}
              onChange={(e) => setFormData({ ...formData, max_employees: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="Max Users"
              type="number"
              value={formData.max_users}
              onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Stats Modal */}
      <Modal isOpen={showStatsModal} onClose={() => setShowStatsModal(false)} title={`Stats: ${selectedTenant?.name || ''}`}>
        {statsData ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600">Employees</div>
                <div className="text-2xl font-bold text-blue-700">{statsData.employee_count}</div>
                <div className="text-xs text-blue-500">of {statsData.max_employees} max ({statsData.employee_utilization}%)</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600">Users</div>
                <div className="text-2xl font-bold text-green-700">{statsData.user_count}</div>
                <div className="text-xs text-green-500">of {statsData.max_users} max ({statsData.user_utilization}%)</div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Employee Utilization</span>
                  <span>{statsData.employee_utilization}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${Math.min(statsData.employee_utilization, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>User Utilization</span>
                  <span>{statsData.user_utilization}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${Math.min(statsData.user_utilization, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">Loading stats...</div>
        )}
      </Modal>

      {/* Modules Modal */}
      <Modal isOpen={showModulesModal} onClose={() => setShowModulesModal(false)} title={`Modules: ${selectedTenant?.name || ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Select which modules are enabled for this tenant.</p>
          <div className="grid grid-cols-2 gap-2">
            {ALL_MODULES.map((mod) => (
              <label key={mod} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedModules.includes(mod)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedModules([...selectedModules, mod])
                    } else {
                      setSelectedModules(selectedModules.filter((m) => m !== mod))
                    }
                  }}
                  className="rounded border-gray-300 text-primary-600"
                />
                <span className="text-sm capitalize">{mod}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowModulesModal(false)}>Cancel</Button>
            <Button
              onClick={() => selectedTenant && modulesMutation.mutate({ id: selectedTenant.id, modules: selectedModules })}
              disabled={modulesMutation.isPending}
            >
              {modulesMutation.isPending ? 'Saving...' : 'Save Modules'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* License List Modal */}
      <Modal
        isOpen={showLicenseListModal}
        onClose={() => setShowLicenseListModal(false)}
        title={`Licenses: ${selectedTenant?.name || ''}`}
      >
        <div className="space-y-4">
          {/* Expiry warning banner */}
          {selectedTenant?.active_license && getLicenseExpiryWarning(selectedTenant.active_license) === 'expired' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700">Active license has expired. Create a new license to continue service.</span>
            </div>
          )}
          {selectedTenant?.active_license && getLicenseExpiryWarning(selectedTenant.active_license) === 'expiring' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <span className="text-sm text-amber-700">
                License expires in {selectedTenant.active_license.days_remaining} days ({selectedTenant.active_license.valid_until}).
              </span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <h4 className="text-sm font-medium text-gray-700">All Licenses</h4>
            <Button
              size="sm"
              onClick={() => {
                resetLicenseForm()
                setShowCreateLicenseModal(true)
              }}
            >
              <PlusIcon className="h-3.5 w-3.5 mr-1" />
              New License
            </Button>
          </div>

          {licensesLoading ? (
            <div className="text-center py-4 text-gray-500">Loading licenses...</div>
          ) : !licenses || licenses.length === 0 ? (
            <div className="text-center py-4 text-gray-500">No licenses found for this organization.</div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {licenses.map((lic: License) => (
                <div
                  key={lic.id}
                  className={`border rounded-lg p-3 ${lic.is_valid ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-700">{lic.license_key}</span>
                        <Badge variant={licenseTypeColors[lic.license_type] || 'default'}>
                          {lic.license_type}
                        </Badge>
                        {lic.is_valid ? (
                          <Badge variant="success">Valid</Badge>
                        ) : (
                          <Badge variant="danger">Invalid</Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                        <div>Users: {lic.max_users} | Employees: {lic.max_employees}</div>
                        <div>
                          From: {lic.valid_from}
                          {lic.valid_until ? ` | Until: ${lic.valid_until}` : ' | No expiry'}
                          {lic.days_remaining !== null && ` (${lic.days_remaining}d remaining)`}
                        </div>
                        {lic.modules_allowed && lic.modules_allowed.length > 0 && (
                          <div>Modules: {lic.modules_allowed.join(', ')}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {lic.is_active ? (
                        <button
                          onClick={() => deactivateLicenseMutation.mutate(lic.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                          title="Deactivate"
                        >
                          <XCircleIcon className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => activateLicenseMutation.mutate(lic.id)}
                          className="p-1 text-gray-400 hover:text-green-600 rounded"
                          title="Activate"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Create License Modal */}
      <Modal
        isOpen={showCreateLicenseModal}
        onClose={() => setShowCreateLicenseModal(false)}
        title={`New License: ${selectedTenant?.name || ''}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Select
              label="License Type"
              value={licenseFormData.license_type}
              onChange={(e) => setLicenseFormData({ ...licenseFormData, license_type: e.target.value })}
              options={[
                { value: 'TRIAL', label: 'Trial' },
                { value: 'FREE', label: 'Free' },
                { value: 'STANDARD', label: 'Standard' },
                { value: 'PREMIUM', label: 'Premium' },
                { value: 'ENTERPRISE', label: 'Enterprise' },
              ]}
            />
            <Input
              label="Max Users"
              type="number"
              value={licenseFormData.max_users}
              onChange={(e) => setLicenseFormData({ ...licenseFormData, max_users: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="Max Employees"
              type="number"
              value={licenseFormData.max_employees}
              onChange={(e) => setLicenseFormData({ ...licenseFormData, max_employees: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Valid From"
              type="date"
              value={licenseFormData.valid_from}
              onChange={(e) => setLicenseFormData({ ...licenseFormData, valid_from: e.target.value })}
            />
            <Input
              label="Valid Until (optional)"
              type="date"
              value={licenseFormData.valid_until}
              onChange={(e) => setLicenseFormData({ ...licenseFormData, valid_until: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Modules Allowed</label>
            <div className="grid grid-cols-3 gap-2">
              {ALL_MODULES.map((mod) => (
                <label key={mod} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={licenseFormData.modules_allowed.includes(mod)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setLicenseFormData({
                          ...licenseFormData,
                          modules_allowed: [...licenseFormData.modules_allowed, mod],
                        })
                      } else {
                        setLicenseFormData({
                          ...licenseFormData,
                          modules_allowed: licenseFormData.modules_allowed.filter((m) => m !== mod),
                        })
                      }
                    }}
                    className="rounded border-gray-300 text-primary-600"
                  />
                  <span className="text-sm capitalize">{mod}</span>
                </label>
              ))}
            </div>
          </div>
          <Input
            label="Notes"
            value={licenseFormData.notes}
            onChange={(e) => setLicenseFormData({ ...licenseFormData, notes: e.target.value })}
            placeholder="Optional admin notes..."
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowCreateLicenseModal(false)}>Cancel</Button>
            <Button onClick={handleCreateLicense} disabled={createLicenseMutation.isPending}>
              {createLicenseMutation.isPending ? 'Creating...' : 'Create License'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
