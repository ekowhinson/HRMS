import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  BuildingOfficeIcon,
  BuildingOffice2Icon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UsersIcon,
  BriefcaseIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline'
import { employeeService } from '@/services/employees'
import api from '@/lib/api'
import { Card } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Table, { TablePagination } from '@/components/ui/Table'
import { useClientPagination } from '@/hooks/useClientPagination'

type TabType = 'divisions' | 'directorates' | 'departments' | 'positions' | 'grades'

const validTabs: TabType[] = ['divisions', 'directorates', 'departments', 'positions', 'grades']

interface Division {
  id: string
  code: string
  name: string
  short_name?: string
  description?: string
  directorate_count?: number
}

interface Directorate {
  id: string
  code: string
  name: string
  short_name?: string
  division?: string
  division_name?: string
  description?: string
  department_count?: number
}

interface Department {
  id: string
  code: string
  name: string
  description?: string
  directorate?: string
  directorate_name?: string
  parent?: string
  parent_name?: string
  head_name?: string
  employee_count?: number
}

interface Position {
  id: string
  code: string
  title: string
  department?: string
  department_name?: string
  grade?: string
  grade_name?: string
  employee_count?: number
}

interface Grade {
  id: string
  code: string
  name: string
  level: number
  min_salary: number
  max_salary: number
  salary_band?: string
  salary_band_name?: string
  salary_band_code?: string
  salary_level?: string
  salary_level_name?: string
  salary_level_code?: string
}

interface SalaryBand {
  id: string
  code: string
  name: string
}

interface SalaryLevel {
  id: string
  code: string
  name: string
  band: string
  band_code?: string
}

export default function OrganizationPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // Get initial tab from URL or default to 'divisions'
  const tabFromUrl = searchParams.get('tab') as TabType | null
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'divisions'

  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState<any>(null)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})

  // Filter states
  const [selectedDivision, setSelectedDivision] = useState<string>('')

  // Reset pagination when tab changes
  const handleTabChangeWithReset = (tab: TabType) => {
    resetPage()
    handleTabChange(tab)
  }

  // Sync tab changes to URL
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  // Sync URL changes to tab
  useEffect(() => {
    const urlTab = searchParams.get('tab') as TabType | null
    if (urlTab && validTabs.includes(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab)
    }
  }, [searchParams])

  // Queries
  const { data: divisions = [], isLoading: loadingDivisions } = useQuery({
    queryKey: ['divisions'],
    queryFn: employeeService.getDivisions,
  })

  const { data: directorates = [], isLoading: loadingDirectorates } = useQuery({
    queryKey: ['directorates', selectedDivision],
    queryFn: () => employeeService.getDirectorates(selectedDivision || undefined),
  })

  const { data: departments = [], isLoading: loadingDepts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => employeeService.getDepartments(),
  })

  const { data: positions = [], isLoading: loadingPositions } = useQuery({
    queryKey: ['positions'],
    queryFn: employeeService.getPositions,
  })

  const { data: grades = [], isLoading: loadingGrades } = useQuery({
    queryKey: ['grades'],
    queryFn: employeeService.getGrades,
  })

  // Select the active tab's dataset for shared pagination
  const activeDataset: unknown[] = { divisions, directorates, departments, positions, grades }[activeTab] || []
  const { paged, currentPage, totalPages, totalItems, pageSize, setCurrentPage, resetPage } = useClientPagination(activeDataset, 10)

  // Salary structure queries for grade linking
  const { data: salaryBands = [] } = useQuery({
    queryKey: ['salaryBands'],
    queryFn: async () => {
      const res = await api.get('/payroll/salary-bands/', { params: { page_size: 100 } })
      return res.data.results || res.data || []
    },
  })

  const { data: salaryLevels = [] } = useQuery({
    queryKey: ['salaryLevels'],
    queryFn: async () => {
      const res = await api.get('/payroll/salary-levels/', { params: { page_size: 100 } })
      return res.data.results || res.data || []
    },
  })

  // Division mutations
  const createDivisionMutation = useMutation({
    mutationFn: employeeService.createDivision,
    onSuccess: () => {
      toast.success('Division created')
      queryClient.invalidateQueries({ queryKey: ['divisions'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to create division'),
  })

  const updateDivisionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => employeeService.updateDivision(id, data),
    onSuccess: () => {
      toast.success('Division updated')
      queryClient.invalidateQueries({ queryKey: ['divisions'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to update division'),
  })

  const deleteDivisionMutation = useMutation({
    mutationFn: employeeService.deleteDivision,
    onSuccess: () => {
      toast.success('Division deleted')
      queryClient.invalidateQueries({ queryKey: ['divisions'] })
      setShowDeleteModal(null)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to delete division'),
  })

  // Directorate mutations
  const createDirectorateMutation = useMutation({
    mutationFn: employeeService.createDirectorate,
    onSuccess: () => {
      toast.success('Directorate created')
      queryClient.invalidateQueries({ queryKey: ['directorates'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to create directorate'),
  })

  const updateDirectorateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => employeeService.updateDirectorate(id, data),
    onSuccess: () => {
      toast.success('Directorate updated')
      queryClient.invalidateQueries({ queryKey: ['directorates'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to update directorate'),
  })

  const deleteDirectorateMutation = useMutation({
    mutationFn: employeeService.deleteDirectorate,
    onSuccess: () => {
      toast.success('Directorate deleted')
      queryClient.invalidateQueries({ queryKey: ['directorates'] })
      setShowDeleteModal(null)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to delete directorate'),
  })

  // Department mutations
  const createDepartmentMutation = useMutation({
    mutationFn: employeeService.createDepartment,
    onSuccess: () => {
      toast.success('Department created')
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to create department'),
  })

  const updateDepartmentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => employeeService.updateDepartment(id, data),
    onSuccess: () => {
      toast.success('Department updated')
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to update department'),
  })

  const deleteDepartmentMutation = useMutation({
    mutationFn: employeeService.deleteDepartment,
    onSuccess: () => {
      toast.success('Department deleted')
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      setShowDeleteModal(null)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to delete department'),
  })

  // Position mutations
  const createPositionMutation = useMutation({
    mutationFn: employeeService.createPosition,
    onSuccess: () => {
      toast.success('Position created')
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to create position'),
  })

  const updatePositionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => employeeService.updatePosition(id, data),
    onSuccess: () => {
      toast.success('Position updated')
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to update position'),
  })

  const deletePositionMutation = useMutation({
    mutationFn: employeeService.deletePosition,
    onSuccess: () => {
      toast.success('Position deleted')
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      setShowDeleteModal(null)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to delete position'),
  })

  // Grade mutations
  const createGradeMutation = useMutation({
    mutationFn: employeeService.createGrade,
    onSuccess: () => {
      toast.success('Grade created')
      queryClient.invalidateQueries({ queryKey: ['grades'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to create grade'),
  })

  const updateGradeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => employeeService.updateGrade(id, data),
    onSuccess: () => {
      toast.success('Grade updated')
      queryClient.invalidateQueries({ queryKey: ['grades'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to update grade'),
  })

  const deleteGradeMutation = useMutation({
    mutationFn: employeeService.deleteGrade,
    onSuccess: () => {
      toast.success('Grade deleted')
      queryClient.invalidateQueries({ queryKey: ['grades'] })
      setShowDeleteModal(null)
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to delete grade'),
  })

  const openModal = (item?: any) => {
    if (item) {
      setEditingItem(item)
      setFormData(item)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (activeTab === 'divisions') {
      if (editingItem) {
        updateDivisionMutation.mutate({ id: editingItem.id, data: formData })
      } else {
        createDivisionMutation.mutate(formData)
      }
    } else if (activeTab === 'directorates') {
      if (editingItem) {
        updateDirectorateMutation.mutate({ id: editingItem.id, data: formData })
      } else {
        createDirectorateMutation.mutate(formData)
      }
    } else if (activeTab === 'departments') {
      if (editingItem) {
        updateDepartmentMutation.mutate({ id: editingItem.id, data: formData })
      } else {
        createDepartmentMutation.mutate(formData)
      }
    } else if (activeTab === 'positions') {
      if (editingItem) {
        updatePositionMutation.mutate({ id: editingItem.id, data: formData })
      } else {
        createPositionMutation.mutate(formData)
      }
    } else if (activeTab === 'grades') {
      if (editingItem) {
        updateGradeMutation.mutate({ id: editingItem.id, data: formData })
      } else {
        createGradeMutation.mutate(formData)
      }
    }
  }

  const handleDelete = () => {
    if (!showDeleteModal) return

    if (activeTab === 'divisions') {
      deleteDivisionMutation.mutate(showDeleteModal.id)
    } else if (activeTab === 'directorates') {
      deleteDirectorateMutation.mutate(showDeleteModal.id)
    } else if (activeTab === 'departments') {
      deleteDepartmentMutation.mutate(showDeleteModal.id)
    } else if (activeTab === 'positions') {
      deletePositionMutation.mutate(showDeleteModal.id)
    } else if (activeTab === 'grades') {
      deleteGradeMutation.mutate(showDeleteModal.id)
    }
  }

  // Column definitions
  const divisionColumns = [
    { key: 'code', header: 'Code', render: (d: Division) => <span className="font-mono text-sm">{d.code}</span> },
    { key: 'name', header: 'Name', render: (d: Division) => <span className="font-medium">{d.name}</span> },
    { key: 'short_name', header: 'Short Name', render: (d: Division) => d.short_name || '-' },
    { key: 'directorates', header: 'Directorates', render: (d: Division) => d.directorate_count || 0 },
    {
      key: 'actions', header: '', render: (d: Division) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openModal(d)}><PencilIcon className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(d)}><TrashIcon className="h-4 w-4 text-red-500" /></Button>
        </div>
      )
    },
  ]

  const directorateColumns = [
    { key: 'code', header: 'Code', render: (d: Directorate) => <span className="font-mono text-sm">{d.code}</span> },
    { key: 'name', header: 'Name', render: (d: Directorate) => <span className="font-medium">{d.name}</span> },
    { key: 'division', header: 'Division', render: (d: Directorate) => d.division_name || '-' },
    { key: 'departments', header: 'Departments', render: (d: Directorate) => d.department_count || 0 },
    {
      key: 'actions', header: '', render: (d: Directorate) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openModal(d)}><PencilIcon className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(d)}><TrashIcon className="h-4 w-4 text-red-500" /></Button>
        </div>
      )
    },
  ]

  const departmentColumns = [
    { key: 'code', header: 'Code', render: (d: Department) => <span className="font-mono text-sm">{d.code}</span> },
    { key: 'name', header: 'Name', render: (d: Department) => <span className="font-medium">{d.name}</span> },
    { key: 'directorate', header: 'Directorate', render: (d: Department) => d.directorate_name || '-' },
    { key: 'parent', header: 'Parent', render: (d: Department) => d.parent_name || '-' },
    { key: 'employees', header: 'Employees', render: (d: Department) => d.employee_count || 0 },
    {
      key: 'actions', header: '', render: (d: Department) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openModal(d)}><PencilIcon className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(d)}><TrashIcon className="h-4 w-4 text-red-500" /></Button>
        </div>
      )
    },
  ]

  const positionColumns = [
    { key: 'code', header: 'Code', render: (p: Position) => <span className="font-mono text-sm">{p.code}</span> },
    { key: 'title', header: 'Title', render: (p: Position) => <span className="font-medium">{p.title}</span> },
    { key: 'department', header: 'Department', render: (p: Position) => p.department_name || '-' },
    { key: 'grade', header: 'Grade', render: (p: Position) => p.grade_name || '-' },
    { key: 'employees', header: 'Employees', render: (p: Position) => p.employee_count || 0 },
    {
      key: 'actions', header: '', render: (p: Position) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openModal(p)}><PencilIcon className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(p)}><TrashIcon className="h-4 w-4 text-red-500" /></Button>
        </div>
      )
    },
  ]

  const gradeColumns = [
    { key: 'code', header: 'Code', render: (g: Grade) => <span className="font-mono text-sm">{g.code}</span> },
    { key: 'name', header: 'Name', render: (g: Grade) => <span className="font-medium">{g.name}</span> },
    { key: 'level', header: 'Level', render: (g: Grade) => g.level },
    {
      key: 'salary_band',
      header: 'Salary Band',
      render: (g: Grade) => g.salary_band_name ? (
        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">{g.salary_band_name}</span>
      ) : (
        <span className="text-gray-400">-</span>
      )
    },
    {
      key: 'salary_level',
      header: 'Salary Level',
      render: (g: Grade) => g.salary_level_name ? (
        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">{g.salary_level_name}</span>
      ) : (
        <span className="text-gray-400">-</span>
      )
    },
    {
      key: 'salary',
      header: 'Salary Range',
      render: (g: Grade) => (g.min_salary || g.max_salary) ? (
        <span className="text-sm">GHS {(g.min_salary || 0).toLocaleString()} - {(g.max_salary || 0).toLocaleString()}</span>
      ) : (
        <span className="text-gray-400">-</span>
      )
    },
    {
      key: 'actions', header: '', render: (g: Grade) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openModal(g)}><PencilIcon className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(g)}><TrashIcon className="h-4 w-4 text-red-500" /></Button>
        </div>
      )
    },
  ]

  const tabs = [
    { id: 'divisions', label: 'Divisions', icon: Squares2X2Icon, count: divisions?.length || 0 },
    { id: 'directorates', label: 'Directorates', icon: BuildingOffice2Icon, count: directorates?.length || 0 },
    { id: 'departments', label: 'Departments', icon: BuildingOfficeIcon, count: departments?.length || 0 },
    { id: 'positions', label: 'Job Positions', icon: BriefcaseIcon, count: positions?.length || 0 },
    { id: 'grades', label: 'Job Grades', icon: UsersIcon, count: grades?.length || 0 },
  ]

  const getTabLabel = () => {
    switch (activeTab) {
      case 'divisions': return 'Division'
      case 'directorates': return 'Directorate'
      case 'departments': return 'Department'
      case 'positions': return 'Position'
      case 'grades': return 'Grade'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HR Setup</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage organization structure, positions, and job grades
          </p>
        </div>
        <Button onClick={() => openModal()}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add {getTabLabel()}
        </Button>
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
              <span className="ml-1 px-2 py-0.5 text-xs bg-gray-100 rounded-full">{tab.count}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Filter for Directorates */}
      {activeTab === 'directorates' && divisions.length > 0 && (
        <div className="flex gap-4">
          <Select
            label="Filter by Division"
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            options={[
              { value: '', label: 'All Divisions' },
              ...divisions.map((d: Division) => ({ value: d.id, label: d.name })),
            ]}
            className="w-64"
          />
        </div>
      )}

      {/* Content */}
      <Card>
        {activeTab === 'divisions' && (
          <Table data={paged as Division[]} columns={divisionColumns} isLoading={loadingDivisions} emptyMessage="No divisions found" />
        )}
        {activeTab === 'directorates' && (
          <Table data={paged as Directorate[]} columns={directorateColumns} isLoading={loadingDirectorates} emptyMessage="No directorates found" />
        )}
        {activeTab === 'departments' && (
          <Table data={paged as Department[]} columns={departmentColumns} isLoading={loadingDepts} emptyMessage="No departments found" />
        )}
        {activeTab === 'positions' && (
          <Table data={paged as Position[]} columns={positionColumns} isLoading={loadingPositions} emptyMessage="No positions found" />
        )}
        {activeTab === 'grades' && (
          <Table data={paged as Grade[]} columns={gradeColumns} isLoading={loadingGrades} emptyMessage="No grades found" />
        )}
        {totalItems > pageSize && (
          <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} />
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={closeModal} title={`${editingItem ? 'Edit' : 'Add'} ${getTabLabel()}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'divisions' && (
            <>
              <Input label="Code" value={formData.code || ''} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
              <Input label="Name" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              <Input label="Short Name" value={formData.short_name || ''} onChange={(e) => setFormData({ ...formData, short_name: e.target.value })} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea className="w-full px-3 py-2 border rounded-lg" rows={3} value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
            </>
          )}

          {activeTab === 'directorates' && (
            <>
              <Input label="Code" value={formData.code || ''} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
              <Input label="Name" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              <Select
                label="Division"
                value={formData.division || ''}
                onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                options={[{ value: '', label: 'Select Division' }, ...divisions.map((d: Division) => ({ value: d.id, label: d.name }))]}
                required
              />
              <Input label="Short Name" value={formData.short_name || ''} onChange={(e) => setFormData({ ...formData, short_name: e.target.value })} />
            </>
          )}

          {activeTab === 'departments' && (
            <>
              <Input label="Code" value={formData.code || ''} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
              <Input label="Name" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              <Select
                label="Directorate"
                value={formData.directorate || ''}
                onChange={(e) => setFormData({ ...formData, directorate: e.target.value })}
                options={[{ value: '', label: 'Select Directorate' }, ...directorates.map((d: Directorate) => ({ value: d.id, label: d.name }))]}
              />
              <Select
                label="Parent Department"
                value={formData.parent || ''}
                onChange={(e) => setFormData({ ...formData, parent: e.target.value })}
                options={[{ value: '', label: 'None (Top Level)' }, ...departments.filter((d: Department) => d.id !== editingItem?.id).map((d: Department) => ({ value: d.id, label: d.name }))]}
              />
            </>
          )}

          {activeTab === 'positions' && (
            <>
              <Input label="Code" value={formData.code || ''} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
              <Input label="Title" value={formData.title || ''} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
              <Select
                label="Department"
                value={formData.department || ''}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                options={[{ value: '', label: 'Select Department' }, ...departments.map((d: Department) => ({ value: d.id, label: d.name }))]}
              />
              <Select
                label="Grade"
                value={formData.grade || ''}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                options={[{ value: '', label: 'Select Grade' }, ...grades.map((g: Grade) => ({ value: g.id, label: g.name }))]}
              />
            </>
          )}

          {activeTab === 'grades' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Code" value={formData.code || ''} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
                <Input label="Level" type="number" value={formData.level || ''} onChange={(e) => setFormData({ ...formData, level: e.target.value })} required />
              </div>
              <Input label="Name" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />

              {/* Salary Structure Linking */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Salary Structure Link</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Salary Band"
                    value={formData.salary_band || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary_band: e.target.value || null,
                      salary_level: '' // Clear level when band changes
                    })}
                    options={[
                      { value: '', label: 'Select Salary Band' },
                      ...salaryBands.map((b: SalaryBand) => ({ value: b.id, label: `${b.code} - ${b.name}` }))
                    ]}
                  />
                  <Select
                    label="Salary Level"
                    value={formData.salary_level || ''}
                    onChange={(e) => setFormData({ ...formData, salary_level: e.target.value || null })}
                    options={[
                      { value: '', label: formData.salary_band ? 'Select Salary Level' : 'Select a band first' },
                      ...salaryLevels
                        .filter((l: SalaryLevel) => !formData.salary_band || l.band === formData.salary_band)
                        .map((l: SalaryLevel) => ({ value: l.id, label: `${l.code} - ${l.name}` }))
                    ]}
                  />
                </div>
                {formData.salary_band && (
                  <p className="text-xs text-gray-500 mt-2">
                    Linking a grade to a salary band/level will filter available salary notches in employee forms.
                  </p>
                )}
              </div>

              {/* Salary Range (optional) */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Salary Range (Optional)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Min Salary" type="number" value={formData.min_salary || ''} onChange={(e) => setFormData({ ...formData, min_salary: e.target.value })} />
                  <Input label="Max Salary" type="number" value={formData.max_salary || ''} onChange={(e) => setFormData({ ...formData, max_salary: e.target.value })} />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit">{editingItem ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!showDeleteModal} onClose={() => setShowDeleteModal(null)} title={`Delete ${getTabLabel()}`}>
        <p className="text-gray-600">
          Are you sure you want to delete <strong>{showDeleteModal?.name || showDeleteModal?.title}</strong>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowDeleteModal(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
