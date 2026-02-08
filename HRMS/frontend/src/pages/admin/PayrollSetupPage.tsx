import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  BuildingLibraryIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  CurrencyDollarIcon,
  Squares2X2Icon,
  QueueListIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  Cog6ToothIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'
import {
  payrollSetupService,
  Bank,
  BankBranch,
  StaffCategory,
  SalaryBand,
  SalaryLevel,
  SalaryNotch,
  type PayrollPeriod,
} from '@/services/payrollSetup'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Table, { TablePagination } from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'

type TabType = 'settings' | 'banks' | 'branches' | 'categories' | 'bands' | 'levels' | 'notches'

const validTabs: TabType[] = ['settings', 'banks', 'branches', 'categories', 'bands', 'levels', 'notches']

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function PayrollSetupPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // Get initial tab from URL or default to 'settings'
  const tabFromUrl = searchParams.get('tab') as TabType | null
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'settings'

  const [activeTab, setActiveTab] = useState<TabType>(initialTab)

  // Sync URL changes to tab (for browser back/forward)
  useEffect(() => {
    const urlTab = searchParams.get('tab') as TabType | null
    if (urlTab && validTabs.includes(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab)
    }
  }, [searchParams])

  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState<any>(null)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})

  // Filter states
  const [selectedBank, setSelectedBank] = useState<string>('')
  const [selectedBand, setSelectedBand] = useState<string>('')
  const [selectedLevel, setSelectedLevel] = useState<string>('')

  // Create Year state
  const [createYearValue, setCreateYearValue] = useState(new Date().getFullYear())
  const [showCreateYearConfirm, setShowCreateYearConfirm] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Reset pagination when tab changes
  const handleTabChangeWithReset = (tab: TabType) => {
    setCurrentPage(1)
    setSearchParams({ tab })
    setActiveTab(tab)
  }

  // Queries
  const { data: banks = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['banks'],
    queryFn: payrollSetupService.getBanks,
  })

  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['bank-branches', selectedBank],
    queryFn: () => payrollSetupService.getBankBranches(selectedBank || undefined),
  })

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['staff-categories'],
    queryFn: payrollSetupService.getStaffCategories,
  })

  const { data: bands = [], isLoading: loadingBands } = useQuery({
    queryKey: ['salary-bands'],
    queryFn: payrollSetupService.getSalaryBands,
  })

  const { data: levels = [], isLoading: loadingLevels } = useQuery({
    queryKey: ['salary-levels', selectedBand],
    queryFn: () => payrollSetupService.getSalaryLevels(selectedBand || undefined),
  })

  const { data: notches = [], isLoading: loadingNotches } = useQuery({
    queryKey: ['salary-notches', selectedLevel],
    queryFn: () => payrollSetupService.getSalaryNotches(selectedLevel || undefined),
  })

  // Payroll Settings Query
  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ['payroll-settings'],
    queryFn: payrollSetupService.getPayrollSettings,
  })

  // Payroll Periods Query
  const { data: periods = [], isLoading: loadingPeriods } = useQuery({
    queryKey: ['payroll-periods'],
    queryFn: payrollSetupService.getPayrollPeriods,
    enabled: activeTab === 'settings',
  })

  // Mutations
  const createBankMutation = useMutation({
    mutationFn: payrollSetupService.createBank,
    onSuccess: () => {
      toast.success('Bank created')
      queryClient.invalidateQueries({ queryKey: ['banks'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to create bank'),
  })

  const updateBankMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Bank> }) =>
      payrollSetupService.updateBank(id, data),
    onSuccess: () => {
      toast.success('Bank updated')
      queryClient.invalidateQueries({ queryKey: ['banks'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to update bank'),
  })

  const deleteBankMutation = useMutation({
    mutationFn: payrollSetupService.deleteBank,
    onSuccess: () => {
      toast.success('Bank deleted')
      queryClient.invalidateQueries({ queryKey: ['banks'] })
      setShowDeleteModal(null)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to delete bank'),
  })

  const createBranchMutation = useMutation({
    mutationFn: payrollSetupService.createBankBranch,
    onSuccess: () => {
      toast.success('Branch created')
      queryClient.invalidateQueries({ queryKey: ['bank-branches'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to create branch'),
  })

  const updateBranchMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BankBranch> }) =>
      payrollSetupService.updateBankBranch(id, data),
    onSuccess: () => {
      toast.success('Branch updated')
      queryClient.invalidateQueries({ queryKey: ['bank-branches'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to update branch'),
  })

  const deleteBranchMutation = useMutation({
    mutationFn: payrollSetupService.deleteBankBranch,
    onSuccess: () => {
      toast.success('Branch deleted')
      queryClient.invalidateQueries({ queryKey: ['bank-branches'] })
      setShowDeleteModal(null)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to delete branch'),
  })

  const createCategoryMutation = useMutation({
    mutationFn: payrollSetupService.createStaffCategory,
    onSuccess: () => {
      toast.success('Staff category created')
      queryClient.invalidateQueries({ queryKey: ['staff-categories'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to create category'),
  })

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StaffCategory> }) =>
      payrollSetupService.updateStaffCategory(id, data),
    onSuccess: () => {
      toast.success('Staff category updated')
      queryClient.invalidateQueries({ queryKey: ['staff-categories'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to update category'),
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: payrollSetupService.deleteStaffCategory,
    onSuccess: () => {
      toast.success('Staff category deleted')
      queryClient.invalidateQueries({ queryKey: ['staff-categories'] })
      setShowDeleteModal(null)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to delete category'),
  })

  const createBandMutation = useMutation({
    mutationFn: payrollSetupService.createSalaryBand,
    onSuccess: () => {
      toast.success('Salary band created')
      queryClient.invalidateQueries({ queryKey: ['salary-bands'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to create band'),
  })

  const updateBandMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SalaryBand> }) =>
      payrollSetupService.updateSalaryBand(id, data),
    onSuccess: () => {
      toast.success('Salary band updated')
      queryClient.invalidateQueries({ queryKey: ['salary-bands'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to update band'),
  })

  const deleteBandMutation = useMutation({
    mutationFn: payrollSetupService.deleteSalaryBand,
    onSuccess: () => {
      toast.success('Salary band deleted')
      queryClient.invalidateQueries({ queryKey: ['salary-bands'] })
      setShowDeleteModal(null)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to delete band'),
  })

  const createLevelMutation = useMutation({
    mutationFn: payrollSetupService.createSalaryLevel,
    onSuccess: () => {
      toast.success('Salary level created')
      queryClient.invalidateQueries({ queryKey: ['salary-levels'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to create level'),
  })

  const updateLevelMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SalaryLevel> }) =>
      payrollSetupService.updateSalaryLevel(id, data),
    onSuccess: () => {
      toast.success('Salary level updated')
      queryClient.invalidateQueries({ queryKey: ['salary-levels'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to update level'),
  })

  const deleteLevelMutation = useMutation({
    mutationFn: payrollSetupService.deleteSalaryLevel,
    onSuccess: () => {
      toast.success('Salary level deleted')
      queryClient.invalidateQueries({ queryKey: ['salary-levels'] })
      setShowDeleteModal(null)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to delete level'),
  })

  const createNotchMutation = useMutation({
    mutationFn: payrollSetupService.createSalaryNotch,
    onSuccess: () => {
      toast.success('Salary notch created')
      queryClient.invalidateQueries({ queryKey: ['salary-notches'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to create notch'),
  })

  const updateNotchMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SalaryNotch> }) =>
      payrollSetupService.updateSalaryNotch(id, data),
    onSuccess: () => {
      toast.success('Salary notch updated')
      queryClient.invalidateQueries({ queryKey: ['salary-notches'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to update notch'),
  })

  const deleteNotchMutation = useMutation({
    mutationFn: payrollSetupService.deleteSalaryNotch,
    onSuccess: () => {
      toast.success('Salary notch deleted')
      queryClient.invalidateQueries({ queryKey: ['salary-notches'] })
      setShowDeleteModal(null)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to delete notch'),
  })

  // Payroll Settings Mutations
  const setActivePeriodMutation = useMutation({
    mutationFn: payrollSetupService.setActivePeriod,
    onSuccess: () => {
      toast.success('Active period updated')
      queryClient.invalidateQueries({ queryKey: ['payroll-settings'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Failed to set active period'),
  })

  const advancePeriodMutation = useMutation({
    mutationFn: payrollSetupService.advancePeriod,
    onSuccess: () => {
      toast.success('Advanced to next period')
      queryClient.invalidateQueries({ queryKey: ['payroll-settings'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Failed to advance period'),
  })

  const updateSettingsMutation = useMutation({
    mutationFn: payrollSetupService.updatePayrollSettings,
    onSuccess: () => {
      toast.success('Settings updated')
      queryClient.invalidateQueries({ queryKey: ['payroll-settings'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to update settings'),
  })

  const closePeriodMutation = useMutation({
    mutationFn: payrollSetupService.closePeriod,
    onSuccess: () => {
      toast.success('Period closed successfully')
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-settings'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.error || error.response?.data?.detail || 'Failed to close period'),
  })

  const createYearPeriodsMutation = useMutation({
    mutationFn: payrollSetupService.createYearPeriods,
    onSuccess: (data) => {
      toast.success(data.message || `Created ${data.created} periods`)
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-settings'] })
      setShowCreateYearConfirm(false)
    },
    onError: (error: any) => toast.error(error.response?.data?.error || error.response?.data?.detail || 'Failed to create year periods'),
  })

  const createYearCalendarsMutation = useMutation({
    mutationFn: payrollSetupService.createYearCalendars,
    onSuccess: (data) => {
      toast.success(data.message || `Created ${data.created} calendar months`)
      queryClient.invalidateQueries({ queryKey: ['payroll-settings'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.error || error.response?.data?.detail || 'Failed to create calendar months'),
  })

  const openModal = (item?: any) => {
    if (item) {
      setEditingItem(item)
      setFormData({ ...item })
    } else {
      setEditingItem(null)
      setFormData({})
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setFormData({})
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    switch (activeTab) {
      case 'banks':
        if (editingItem) {
          updateBankMutation.mutate({ id: editingItem.id, data: formData })
        } else {
          createBankMutation.mutate(formData)
        }
        break
      case 'branches':
        if (editingItem) {
          updateBranchMutation.mutate({ id: editingItem.id, data: formData })
        } else {
          createBranchMutation.mutate(formData)
        }
        break
      case 'categories':
        if (editingItem) {
          updateCategoryMutation.mutate({ id: editingItem.id, data: formData })
        } else {
          createCategoryMutation.mutate(formData)
        }
        break
      case 'bands':
        if (editingItem) {
          updateBandMutation.mutate({ id: editingItem.id, data: formData })
        } else {
          createBandMutation.mutate(formData)
        }
        break
      case 'levels':
        if (editingItem) {
          updateLevelMutation.mutate({ id: editingItem.id, data: formData })
        } else {
          createLevelMutation.mutate(formData)
        }
        break
      case 'notches':
        if (editingItem) {
          updateNotchMutation.mutate({ id: editingItem.id, data: formData })
        } else {
          createNotchMutation.mutate(formData)
        }
        break
    }
  }

  const handleDelete = () => {
    if (!showDeleteModal) return

    switch (activeTab) {
      case 'banks':
        deleteBankMutation.mutate(showDeleteModal.id)
        break
      case 'branches':
        deleteBranchMutation.mutate(showDeleteModal.id)
        break
      case 'categories':
        deleteCategoryMutation.mutate(showDeleteModal.id)
        break
      case 'bands':
        deleteBandMutation.mutate(showDeleteModal.id)
        break
      case 'levels':
        deleteLevelMutation.mutate(showDeleteModal.id)
        break
      case 'notches':
        deleteNotchMutation.mutate(showDeleteModal.id)
        break
    }
  }

  const tabs = [
    { id: 'settings', label: 'Active Period', icon: Cog6ToothIcon, count: null },
    { id: 'banks', label: 'Banks', icon: BuildingLibraryIcon, count: banks.length },
    { id: 'branches', label: 'Branches', icon: BuildingOffice2Icon, count: branches.length },
    { id: 'categories', label: 'Staff Categories', icon: UserGroupIcon, count: categories.length },
    { id: 'bands', label: 'Salary Bands', icon: CurrencyDollarIcon, count: bands.length },
    { id: 'levels', label: 'Salary Levels', icon: Squares2X2Icon, count: levels.length },
    { id: 'notches', label: 'Salary Notches', icon: QueueListIcon, count: notches.length },
  ]

  const getModalTitle = () => {
    const action = editingItem ? 'Edit' : 'Add'
    switch (activeTab) {
      case 'settings': return 'Payroll Settings'
      case 'banks': return `${action} Bank`
      case 'branches': return `${action} Bank Branch`
      case 'categories': return `${action} Staff Category`
      case 'bands': return `${action} Salary Band`
      case 'levels': return `${action} Salary Level`
      case 'notches': return `${action} Salary Notch`
    }
  }

  const getAddButtonLabel = () => {
    switch (activeTab) {
      case 'settings': return ''
      case 'banks': return 'Add Bank'
      case 'branches': return 'Add Branch'
      case 'categories': return 'Add Category'
      case 'bands': return 'Add Band'
      case 'levels': return 'Add Level'
      case 'notches': return 'Add Notch'
    }
  }

  // Column definitions
  const bankColumns = [
    {
      key: 'code',
      header: 'Code',
      render: (item: Bank) => <span className="font-mono text-sm">{item.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (item: Bank) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'swift_code',
      header: 'SWIFT Code',
      render: (item: Bank) => <span className="text-sm text-gray-600">{item.swift_code || '-'}</span>,
    },
    {
      key: 'branches',
      header: 'Branches',
      render: (item: Bank) => <span className="text-sm">{item.branch_count || 0}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Bank) => (
        <Badge variant={item.is_active ? 'success' : 'danger'}>
          {item.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item: Bank) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openModal(item)}>
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(item)}>
            <TrashIcon className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ]

  const branchColumns = [
    {
      key: 'code',
      header: 'Code',
      render: (item: BankBranch) => <span className="font-mono text-sm">{item.code}</span>,
    },
    {
      key: 'name',
      header: 'Branch Name',
      render: (item: BankBranch) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'bank',
      header: 'Bank',
      render: (item: BankBranch) => <span className="text-sm">{item.bank_name}</span>,
    },
    {
      key: 'city',
      header: 'City',
      render: (item: BankBranch) => <span className="text-sm text-gray-600">{item.city || '-'}</span>,
    },
    {
      key: 'sort_code',
      header: 'Sort Code',
      render: (item: BankBranch) => <span className="font-mono text-sm">{item.sort_code || '-'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: BankBranch) => (
        <Badge variant={item.is_active ? 'success' : 'danger'}>
          {item.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item: BankBranch) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openModal(item)}>
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(item)}>
            <TrashIcon className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ]

  const categoryColumns = [
    {
      key: 'code',
      header: 'Code',
      render: (item: StaffCategory) => <span className="font-mono text-sm">{item.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (item: StaffCategory) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'payroll_group',
      header: 'Payroll Group',
      render: (item: StaffCategory) => <span className="text-sm">{item.payroll_group || '-'}</span>,
    },
    {
      key: 'salary_band',
      header: 'Salary Band',
      render: (item: StaffCategory) => item.salary_band_name ? (
        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
          {item.salary_band_name}
        </span>
      ) : (
        <span className="text-gray-400">-</span>
      ),
    },
    {
      key: 'employees',
      header: 'Employees',
      render: (item: StaffCategory) => <span className="text-sm">{item.employee_count || 0}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: StaffCategory) => (
        <Badge variant={item.is_active ? 'success' : 'danger'}>
          {item.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item: StaffCategory) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openModal(item)}>
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(item)}>
            <TrashIcon className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ]

  const bandColumns = [
    {
      key: 'code',
      header: 'Code',
      render: (item: SalaryBand) => <span className="font-mono text-sm">{item.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (item: SalaryBand) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'salary_range',
      header: 'Salary Range',
      render: (item: SalaryBand) => (
        <span className="text-sm">
          {item.min_salary && item.max_salary
            ? `${formatCurrency(item.min_salary)} - ${formatCurrency(item.max_salary)}`
            : '-'}
        </span>
      ),
    },
    {
      key: 'levels',
      header: 'Levels',
      render: (item: SalaryBand) => <span className="text-sm">{item.level_count || 0}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: SalaryBand) => (
        <Badge variant={item.is_active ? 'success' : 'danger'}>
          {item.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item: SalaryBand) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openModal(item)}>
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(item)}>
            <TrashIcon className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ]

  const levelColumns = [
    {
      key: 'code',
      header: 'Code',
      render: (item: SalaryLevel) => <span className="font-mono text-sm">{item.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (item: SalaryLevel) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'band',
      header: 'Band',
      render: (item: SalaryLevel) => (
        <span className="text-sm">{item.band_name || item.band_code}</span>
      ),
    },
    {
      key: 'salary_range',
      header: 'Salary Range',
      render: (item: SalaryLevel) => (
        <span className="text-sm">
          {item.min_salary && item.max_salary
            ? `${formatCurrency(item.min_salary)} - ${formatCurrency(item.max_salary)}`
            : '-'}
        </span>
      ),
    },
    {
      key: 'notches',
      header: 'Notches',
      render: (item: SalaryLevel) => <span className="text-sm">{item.notch_count || 0}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: SalaryLevel) => (
        <Badge variant={item.is_active ? 'success' : 'danger'}>
          {item.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item: SalaryLevel) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openModal(item)}>
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(item)}>
            <TrashIcon className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ]

  const notchColumns = [
    {
      key: 'code',
      header: 'Code',
      render: (item: SalaryNotch) => (
        <span className="font-mono text-sm">{item.full_code || item.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (item: SalaryNotch) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'level',
      header: 'Level',
      render: (item: SalaryNotch) => (
        <span className="text-sm">{item.level_name || item.level_code}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (item: SalaryNotch) => (
        <span className="font-medium text-green-700">{formatCurrency(item.amount)}</span>
      ),
    },
    {
      key: 'employees',
      header: 'Employees',
      render: (item: SalaryNotch) => <span className="text-sm">{item.employee_count || 0}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: SalaryNotch) => (
        <Badge variant={item.is_active ? 'success' : 'danger'}>
          {item.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item: SalaryNotch) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openModal(item)}>
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(item)}>
            <TrashIcon className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ]

  const isLoading =
    (activeTab === 'settings' && loadingSettings) ||
    (activeTab === 'banks' && loadingBanks) ||
    (activeTab === 'branches' && loadingBranches) ||
    (activeTab === 'categories' && loadingCategories) ||
    (activeTab === 'bands' && loadingBands) ||
    (activeTab === 'levels' && loadingLevels) ||
    (activeTab === 'notches' && loadingNotches)

  const isMutating =
    createBankMutation.isPending || updateBankMutation.isPending ||
    createBranchMutation.isPending || updateBranchMutation.isPending ||
    createCategoryMutation.isPending || updateCategoryMutation.isPending ||
    createBandMutation.isPending || updateBandMutation.isPending ||
    createLevelMutation.isPending || updateLevelMutation.isPending ||
    createNotchMutation.isPending || updateNotchMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Setup</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage banks, staff categories, and salary structure
          </p>
        </div>
        {activeTab !== 'settings' && (
          <Button onClick={() => openModal()}>
            <PlusIcon className="h-4 w-4 mr-2" />
            {getAddButtonLabel()}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChangeWithReset(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
              {tab.count !== null && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      {activeTab === 'branches' && (
        <div className="flex gap-4">
          <Select
            value={selectedBank}
            onChange={(e) => setSelectedBank(e.target.value)}
            options={[
              { value: '', label: 'All Banks' },
              ...banks.map((b) => ({ value: b.id, label: b.name })),
            ]}
            className="w-64"
          />
        </div>
      )}

      {activeTab === 'levels' && (
        <div className="flex gap-4">
          <Select
            value={selectedBand}
            onChange={(e) => setSelectedBand(e.target.value)}
            options={[
              { value: '', label: 'All Bands' },
              ...bands.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` })),
            ]}
            className="w-64"
          />
        </div>
      )}

      {activeTab === 'notches' && (
        <div className="flex gap-4">
          <Select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            options={[
              { value: '', label: 'All Levels' },
              ...levels.map((l) => ({ value: l.id, label: `${l.code} - ${l.name}` })),
            ]}
            className="w-64"
          />
        </div>
      )}

      {/* Settings Content */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Active Period Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CalendarDaysIcon className="h-5 w-5 mr-2 text-primary-600" />
                Active Payroll Period
              </CardTitle>
            </CardHeader>
            <div className="p-6">
              {loadingSettings ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              ) : settingsData?.settings ? (
                <div className="space-y-6">
                  {/* Current Active Period Display */}
                  <div className="bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-primary-600 mb-1">Currently Active Period</p>
                        <p className="text-3xl font-bold text-primary-900">
                          {settingsData.settings.active_calendar_name || 'Not Set'}
                        </p>
                        {settingsData.settings.active_period_name && (
                          <p className="text-sm text-primary-700 mt-1">
                            Period: {settingsData.settings.active_period_name}
                            {settingsData.settings.active_period_status && (
                              <Badge
                                variant={settingsData.settings.active_period_status === 'OPEN' ? 'success' : 'warning'}
                                className="ml-2"
                              >
                                {settingsData.settings.active_period_status}
                              </Badge>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          onClick={() => advancePeriodMutation.mutate()}
                          isLoading={advancePeriodMutation.isPending}
                          disabled={!settingsData.settings.active_calendar}
                        >
                          <ChevronRightIcon className="h-4 w-4 mr-2" />
                          Advance to Next Month
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Period Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Select by Calendar */}
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Set Active Period by Calendar
                      </label>
                      <Select
                        value={settingsData.settings.active_calendar || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            setActivePeriodMutation.mutate({ calendar_id: e.target.value })
                          }
                        }}
                        options={[
                          { value: '', label: 'Select Calendar Month...' },
                          ...(settingsData.available_calendars || []).map((cal) => ({
                            value: cal.id,
                            label: cal.name,
                          })),
                        ]}
                      />
                      <p className="text-xs text-gray-500">
                        Select a calendar month to set as the active payroll period.
                        All new transactions will be linked to this period.
                      </p>
                    </div>

                    {/* Quick Select by Year/Month */}
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Quick Select by Year & Month
                      </label>
                      <div className="flex gap-2">
                        <Select
                          value=""
                          onChange={(e) => {
                            const [year, month] = e.target.value.split('-')
                            if (year && month) {
                              setActivePeriodMutation.mutate({
                                year: parseInt(year),
                                month: parseInt(month),
                              })
                            }
                          }}
                          options={[
                            { value: '', label: 'Select Year-Month...' },
                            ...Array.from({ length: 24 }, (_, i) => {
                              const date = new Date()
                              date.setMonth(date.getMonth() - 12 + i)
                              const year = date.getFullYear()
                              const month = date.getMonth() + 1
                              return {
                                value: `${year}-${month}`,
                                label: `${MONTHS[month - 1]} ${year}`,
                              }
                            }),
                          ]}
                          className="flex-1"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        Quickly jump to a specific month and year.
                      </p>
                    </div>
                  </div>

                  {/* Settings */}
                  <div className="border-t pt-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-4">Additional Settings</h3>
                    <div className="space-y-4">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settingsData.settings.auto_advance_period}
                          onChange={(e) => updateSettingsMutation.mutate({ auto_advance_period: e.target.checked })}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900">Auto-advance Period</span>
                          <p className="text-xs text-gray-500">
                            Automatically advance to the next period when the current one is closed
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Last Updated */}
                  {settingsData.settings.updated_at && (
                    <div className="text-xs text-gray-500 border-t pt-4">
                      Last updated: {new Date(settingsData.settings.updated_at).toLocaleString()}
                      {settingsData.settings.updated_by_name && ` by ${settingsData.settings.updated_by_name}`}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Cog6ToothIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No payroll settings configured</p>
                </div>
              )}
            </div>
          </Card>

          {/* Available Periods Summary */}
          {settingsData?.available_calendars && settingsData.available_calendars.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <CalendarDaysIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Available Calendar Months
                </CardTitle>
              </CardHeader>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {settingsData.available_calendars.slice(0, 12).map((cal) => (
                    <button
                      key={cal.id}
                      onClick={() => setActivePeriodMutation.mutate({ calendar_id: cal.id })}
                      className={`p-3 rounded-lg border text-center transition-colors ${
                        settingsData.settings?.active_calendar === cal.id
                          ? 'bg-primary-100 border-primary-500 text-primary-700'
                          : 'bg-white border-gray-200 hover:border-primary-300 hover:bg-primary-50'
                      }`}
                    >
                      <p className="text-xs text-gray-500">{cal.year}</p>
                      <p className="font-medium">{MONTHS[cal.month - 1]}</p>
                      {settingsData.settings?.active_calendar === cal.id && (
                        <CheckCircleIcon className="h-4 w-4 mx-auto mt-1 text-primary-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Payroll Periods Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <CardTitle className="flex items-center text-base">
                  <CalendarDaysIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Payroll Periods
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={createYearValue}
                    onChange={(e) => setCreateYearValue(parseInt(e.target.value) || new Date().getFullYear())}
                    className="w-24 text-sm"
                    min={2020}
                    max={2030}
                  />
                  <Button
                    size="sm"
                    onClick={() => setShowCreateYearConfirm(true)}
                    disabled={createYearPeriodsMutation.isPending || createYearCalendarsMutation.isPending}
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Create Year
                  </Button>
                </div>
              </div>
            </CardHeader>
            <div className="p-4">
              {loadingPeriods ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-gray-200 rounded" />
                  ))}
                </div>
              ) : periods.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CalendarDaysIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No payroll periods found</p>
                  <p className="text-sm mt-1">Use "Create Year" to generate periods for a year</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date Range</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {[...periods]
                        .sort((a, b) => {
                          if (a.year !== b.year) return b.year - a.year
                          return b.month - a.month
                        })
                        .map((period: PayrollPeriod) => {
                          const statusColors: Record<string, string> = {
                            DRAFT: 'bg-gray-100 text-gray-800',
                            OPEN: 'bg-blue-100 text-blue-800',
                            PROCESSING: 'bg-yellow-100 text-yellow-800',
                            COMPUTED: 'bg-indigo-100 text-indigo-800',
                            APPROVED: 'bg-purple-100 text-purple-800',
                            PAID: 'bg-green-100 text-green-800',
                            CLOSED: 'bg-gray-200 text-gray-600',
                          }
                          const canClose = period.status === 'PAID' || period.status === 'APPROVED'
                          return (
                            <tr key={period.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2">
                                <span className="font-medium text-sm">{period.name}</span>
                                {period.is_supplementary && (
                                  <span className="ml-2 text-xs text-orange-600 font-medium">(Supplementary)</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {period.start_date} to {period.end_date}
                              </td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[period.status] || 'bg-gray-100 text-gray-800'}`}>
                                  {period.status}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right">
                                {canClose && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                    onClick={() => closePeriodMutation.mutate(period.id)}
                                    disabled={closePeriodMutation.isPending}
                                    isLoading={closePeriodMutation.isPending && closePeriodMutation.variables === period.id}
                                  >
                                    <LockClosedIcon className="h-3.5 w-3.5 mr-1" />
                                    Close
                                  </Button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

          {/* Create Year Confirmation Modal */}
          <Modal
            isOpen={showCreateYearConfirm}
            onClose={() => setShowCreateYearConfirm(false)}
            title={`Create Periods for ${createYearValue}`}
          >
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                This will create 12 calendar months and 12 payroll periods for the year <strong>{createYearValue}</strong>.
                Existing months/periods will be skipped.
              </p>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateYearConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    createYearCalendarsMutation.mutate(createYearValue, {
                      onSuccess: () => {
                        createYearPeriodsMutation.mutate(createYearValue)
                      },
                    })
                  }}
                  isLoading={createYearCalendarsMutation.isPending || createYearPeriodsMutation.isPending}
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create Year {createYearValue}
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {/* Table Content for other tabs */}
      {activeTab !== 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              {tabs.find((t) => t.id === activeTab)?.icon &&
                (() => {
                  const IconComponent = tabs.find((t) => t.id === activeTab)!.icon
                  return <IconComponent className="h-5 w-5 mr-2 text-gray-500" />
                })()}
              {tabs.find((t) => t.id === activeTab)?.label}
            </CardTitle>
          </CardHeader>
          {(() => {
            const dataMap: Record<string, any[]> = {
              banks,
              branches,
              categories,
              bands,
              levels,
              notches,
            }
            const columnsMap: Record<string, any[]> = {
              banks: bankColumns,
              branches: branchColumns,
              categories: categoryColumns,
              bands: bandColumns,
              levels: levelColumns,
              notches: notchColumns,
            }
            const data = dataMap[activeTab] || []
            const columns = columnsMap[activeTab]
            return (
              <>
                <Table
                  data={data.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
                  columns={columns}
                  isLoading={isLoading}
                  emptyMessage={`No ${activeTab} found`}
                />
                {data.length > pageSize && (
                  <TablePagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(data.length / pageSize)}
                    totalItems={data.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                  />
                )}
              </>
            )
          })()}
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={closeModal} title={getModalTitle()}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'banks' && (
            <>
              <Input
                label="Code"
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
                disabled={!!editingItem}
              />
              <Input
                label="Name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="Short Name"
                value={formData.short_name || ''}
                onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="SWIFT Code"
                  value={formData.swift_code || ''}
                  onChange={(e) => setFormData({ ...formData, swift_code: e.target.value })}
                />
                <Input
                  label="Sort Code"
                  value={formData.sort_code || ''}
                  onChange={(e) => setFormData({ ...formData, sort_code: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active ?? true}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600"
                />
                <span className="text-sm">Active</span>
              </label>
            </>
          )}

          {activeTab === 'branches' && (
            <>
              <Select
                label="Bank"
                value={formData.bank || ''}
                onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                options={[
                  { value: '', label: 'Select Bank' },
                  ...banks.map((b) => ({ value: b.id, label: b.name })),
                ]}
                required
              />
              <Input
                label="Code"
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
                disabled={!!editingItem}
              />
              <Input
                label="Branch Name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="City"
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
                <Input
                  label="Sort Code"
                  value={formData.sort_code || ''}
                  onChange={(e) => setFormData({ ...formData, sort_code: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active ?? true}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600"
                />
                <span className="text-sm">Active</span>
              </label>
            </>
          )}

          {activeTab === 'categories' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Code"
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  required
                  disabled={!!editingItem}
                />
                <Input
                  label="Sort Order"
                  type="number"
                  value={formData.sort_order || 0}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                />
              </div>
              <Input
                label="Name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="Payroll Group"
                value={formData.payroll_group || ''}
                onChange={(e) => setFormData({ ...formData, payroll_group: e.target.value })}
                placeholder="e.g., Districts Payroll, HQ Payroll"
              />

              {/* Salary Structure Link */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Salary Structure Link</h4>
                <Select
                  label="Default Salary Band"
                  value={formData.salary_band || ''}
                  onChange={(e) => setFormData({ ...formData, salary_band: e.target.value || null })}
                  options={[
                    { value: '', label: 'Select Salary Band (Optional)' },
                    ...bands.map((b: SalaryBand) => ({ value: b.id, label: `${b.code} - ${b.name}` })),
                  ]}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Linking a staff category to a salary band will filter available salary notches when this category is selected.
                </p>
              </div>

              <label className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  checked={formData.is_active ?? true}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600"
                />
                <span className="text-sm">Active</span>
              </label>
            </>
          )}

          {activeTab === 'bands' && (
            <>
              <Input
                label="Code"
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
                disabled={!!editingItem}
              />
              <Input
                label="Name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Min Salary"
                  type="number"
                  step="0.01"
                  value={formData.min_salary || ''}
                  onChange={(e) => setFormData({ ...formData, min_salary: parseFloat(e.target.value) })}
                />
                <Input
                  label="Max Salary"
                  type="number"
                  step="0.01"
                  value={formData.max_salary || ''}
                  onChange={(e) => setFormData({ ...formData, max_salary: parseFloat(e.target.value) })}
                />
              </div>
              <Input
                label="Sort Order"
                type="number"
                value={formData.sort_order || 0}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active ?? true}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600"
                />
                <span className="text-sm">Active</span>
              </label>
            </>
          )}

          {activeTab === 'levels' && (
            <>
              <Select
                label="Salary Band"
                value={formData.band || ''}
                onChange={(e) => setFormData({ ...formData, band: e.target.value })}
                options={[
                  { value: '', label: 'Select Band' },
                  ...bands.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` })),
                ]}
                required
              />
              <Input
                label="Code"
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
                disabled={!!editingItem}
              />
              <Input
                label="Name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Min Salary"
                  type="number"
                  step="0.01"
                  value={formData.min_salary || ''}
                  onChange={(e) => setFormData({ ...formData, min_salary: parseFloat(e.target.value) })}
                />
                <Input
                  label="Max Salary"
                  type="number"
                  step="0.01"
                  value={formData.max_salary || ''}
                  onChange={(e) => setFormData({ ...formData, max_salary: parseFloat(e.target.value) })}
                />
              </div>
              <Input
                label="Sort Order"
                type="number"
                value={formData.sort_order || 0}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active ?? true}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600"
                />
                <span className="text-sm">Active</span>
              </label>
            </>
          )}

          {activeTab === 'notches' && (
            <>
              <Select
                label="Salary Level"
                value={formData.level || ''}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                options={[
                  { value: '', label: 'Select Level' },
                  ...levels.map((l) => ({ value: l.id, label: `${l.code} - ${l.name}` })),
                ]}
                required
              />
              <Input
                label="Code"
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
                disabled={!!editingItem}
              />
              <Input
                label="Name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="Amount (GHS)"
                type="number"
                step="0.01"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                required
              />
              <Input
                label="Sort Order"
                type="number"
                value={formData.sort_order || 0}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active ?? true}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600"
                />
                <span className="text-sm">Active</span>
              </label>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isMutating}>
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteModal}
        onClose={() => setShowDeleteModal(null)}
        title="Confirm Delete"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{showDeleteModal?.name}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowDeleteModal(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isMutating}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
