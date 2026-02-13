import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ShieldCheckIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  UsersIcon,
  LockClosedIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline'
import { roleService, permissionService, type Role, type Permission } from '@/services/users'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import api from '@/lib/api'

export default function RoleManagementPage() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    level: 50,
    district: '' as string | null,
    permissions: [] as string[],
  })

  // Fetch roles
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => roleService.getRoles(),
  })

  // Fetch permissions grouped by module
  const { data: permissionsByModule } = useQuery({
    queryKey: ['permissions-by-module'],
    queryFn: () => permissionService.getPermissionsByModule(),
  })

  // Fetch districts for dropdown
  const { data: districts } = useQuery({
    queryKey: ['districts'],
    queryFn: async () => {
      const response = await api.get('/organization/districts/')
      return response.data.results || response.data
    },
  })

  // Create role mutation
  const createMutation = useMutation({
    mutationFn: roleService.createRole,
    onSuccess: () => {
      toast.success('Role created successfully')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setShowCreateModal(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create role')
    },
  })

  // Update role mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{
      name: string
      description: string
      level: number
      district: string | null
      is_active: boolean
      permissions: string[]
    }> }) =>
      roleService.updateRole(id, data),
    onSuccess: () => {
      toast.success('Role updated successfully')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setShowEditModal(false)
      setShowPermissionsModal(false)
      setSelectedRole(null)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update role')
    },
  })

  // Delete role mutation
  const deleteMutation = useMutation({
    mutationFn: roleService.deleteRole,
    onSuccess: () => {
      toast.success('Role deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setShowDeleteModal(false)
      setSelectedRole(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete role')
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      level: 50,
      district: '',
      permissions: [],
    })
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.code) {
      toast.error('Name and code are required')
      return
    }
    createMutation.mutate({
      ...formData,
      district: formData.district || null,
    })
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRole) return
    updateMutation.mutate({
      id: selectedRole.id,
      data: {
        name: formData.name,
        description: formData.description,
        level: formData.level,
        district: formData.district || null,
      },
    })
  }

  const handlePermissionsSubmit = () => {
    if (!selectedRole) return
    updateMutation.mutate({
      id: selectedRole.id,
      data: {
        permissions: formData.permissions,
      },
    })
  }

  const openEditModal = (role: Role) => {
    setSelectedRole(role)
    setFormData({
      name: role.name,
      code: role.code,
      description: role.description || '',
      level: role.level || 50,
      district: role.district || '',
      permissions: role.permissions?.map((p) => p.id) || [],
    })
    setShowEditModal(true)
  }

  const openPermissionsModal = (role: Role) => {
    setSelectedRole(role)
    setFormData((prev) => ({
      ...prev,
      permissions: role.permissions?.map((p) => p.id) || [],
    }))
    setShowPermissionsModal(true)
  }

  const openDeleteModal = (role: Role) => {
    setSelectedRole(role)
    setShowDeleteModal(true)
  }

  const togglePermission = (permissionId: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter((id) => id !== permissionId)
        : [...prev.permissions, permissionId],
    }))
  }

  const toggleModulePermissions = (modulePermissions: Permission[]) => {
    const modulePermissionIds = modulePermissions.map((p) => p.id)
    const allSelected = modulePermissionIds.every((id) =>
      formData.permissions.includes(id)
    )

    if (allSelected) {
      // Remove all module permissions
      setFormData((prev) => ({
        ...prev,
        permissions: prev.permissions.filter(
          (id) => !modulePermissionIds.includes(id)
        ),
      }))
    } else {
      // Add all module permissions
      setFormData((prev) => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...modulePermissionIds])],
      }))
    }
  }

  // Stats
  const totalRoles = roles?.length || 0
  const systemRoles = roles?.filter((r: Role) => r.is_system_role).length || 0
  const customRoles = totalRoles - systemRoles
  const activeRoles = roles?.filter((r: Role) => r.is_active).length || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
          <p className="text-sm text-gray-500">
            Configure roles and their permissions
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShieldCheckIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Roles</p>
                <p className="text-2xl font-bold">{totalRoles}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <LockClosedIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">System Roles</p>
                <p className="text-2xl font-bold">{systemRoles}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <ShieldCheckIcon className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Custom Roles</p>
                <p className="text-2xl font-bold">{customRoles}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <UsersIcon className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Roles</p>
                <p className="text-2xl font-bold">{activeRoles}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rolesLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : roles && roles.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      District
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Permissions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Users
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {roles.map((role: Role) => (
                    <tr key={role.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="font-medium text-gray-900">{role.name}</p>
                          {role.description && (
                            <p className="text-sm text-gray-500 truncate max-w-xs">
                              {role.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {role.code}
                        </code>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {role.level}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {role.district_name ? (
                          <div className="flex items-center gap-1">
                            <MapPinIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-700">{role.district_name}</span>
                            {role.region_name && (
                              <span className="text-xs text-gray-500">({role.region_name})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">All Districts</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={role.is_system_role ? 'info' : 'default'}>
                          {role.is_system_role ? 'System' : 'Custom'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => openPermissionsModal(role)}
                          className="text-sm text-primary-600 hover:text-primary-800"
                        >
                          {role.permissions_count || role.permissions?.length || 0}{' '}
                          permissions
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {role.users_count || 0} users
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={role.is_active ? 'success' : 'default'}>
                          {role.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(role)}
                            disabled={role.is_system_role}
                            title={
                              role.is_system_role
                                ? 'System roles cannot be edited'
                                : 'Edit role'
                            }
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteModal(role)}
                            disabled={role.is_system_role}
                            title={
                              role.is_system_role
                                ? 'System roles cannot be deleted'
                                : 'Delete role'
                            }
                          >
                            <TrashIcon className="h-4 w-4 text-danger-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <ShieldCheckIcon className="h-12 w-12 mb-2" />
              <p>No roles found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Role Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          resetForm()
        }}
        title="Create New Role"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Role Name"
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, name: e.target.value })
            }
            placeholder="e.g., Department Manager"
            required
          />
          <Input
            label="Role Code"
            value={formData.code}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, code: e.target.value.toUpperCase() })
            }
            placeholder="e.g., DEPT_MANAGER"
            required
          />
          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Describe the role's purpose..."
            rows={3}
          />
          <Input
            label="Level"
            type="number"
            value={formData.level}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, level: parseInt(e.target.value) || 50 })
            }
            min={1}
            max={100}
          />
          <p className="text-xs text-gray-500">
            Level determines role hierarchy. Higher values = higher authority.
          </p>
          <Select
            label="District (Optional)"
            value={formData.district || ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setFormData({ ...formData, district: e.target.value || null })
            }
            options={[
              { value: '', label: 'All Districts (Global Role)' },
              ...(districts || []).map((d: { id: string; name: string; region?: { name: string } }) => ({
                value: d.id,
                label: d.region ? `${d.name} (${d.region.name})` : d.name,
              })),
            ]}
          />
          <p className="text-xs text-gray-500">
            Assign a district to limit this role to a specific location.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateModal(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Role
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedRole(null)
          resetForm()
        }}
        title="Edit Role"
        size="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Role Name"
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, name: e.target.value })
            }
            placeholder="e.g., Department Manager"
            required
          />
          <Input
            label="Role Code"
            value={formData.code}
            disabled
            className="bg-gray-100"
          />
          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Describe the role's purpose..."
            rows={3}
          />
          <Input
            label="Level"
            type="number"
            value={formData.level}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, level: parseInt(e.target.value) || 50 })
            }
            min={1}
            max={100}
          />
          <Select
            label="District (Optional)"
            value={formData.district || ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setFormData({ ...formData, district: e.target.value || null })
            }
            options={[
              { value: '', label: 'All Districts (Global Role)' },
              ...(districts || []).map((d: { id: string; name: string; region?: { name: string } }) => ({
                value: d.id,
                label: d.region ? `${d.name} (${d.region.name})` : d.name,
              })),
            ]}
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowEditModal(false)
                setSelectedRole(null)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Permissions Modal */}
      <Modal
        isOpen={showPermissionsModal}
        onClose={() => {
          setShowPermissionsModal(false)
          setSelectedRole(null)
        }}
        title={`Manage Permissions - ${selectedRole?.name}`}
        size="lg"
      >
        <div className="space-y-6">
          {permissionsByModule &&
            Object.entries(permissionsByModule).map(([module, permissions]) => {
              const modulePermissions = permissions as Permission[]
              const selectedCount = modulePermissions.filter((p) =>
                formData.permissions.includes(p.id)
              ).length
              const allSelected = selectedCount === modulePermissions.length

              return (
                <div key={module} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium text-gray-900 capitalize">
                        {module.replace(/_/g, ' ')}
                      </h4>
                      <Badge variant="default">
                        {selectedCount}/{modulePermissions.length}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleModulePermissions(modulePermissions)}
                      className="text-sm text-primary-600 hover:text-primary-800"
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {modulePermissions.map((permission) => (
                      <label
                        key={permission.id}
                        className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <div className="pt-0.5">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission.id)}
                            onChange={() => togglePermission(permission.id)}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {permission.name}
                          </p>
                          {permission.description && (
                            <p className="text-xs text-gray-500">
                              {permission.description}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowPermissionsModal(false)
                setSelectedRole(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePermissionsSubmit}
              isLoading={updateMutation.isPending}
              disabled={selectedRole?.is_system_role}
            >
              Save Permissions
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setSelectedRole(null)
        }}
        title="Delete Role"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-danger-50 rounded-lg">
            <TrashIcon className="h-8 w-8 text-danger-600" />
            <div>
              <p className="font-medium text-danger-800">
                Delete "{selectedRole?.name}"?
              </p>
              <p className="text-sm text-danger-600">
                This action cannot be undone. All users with this role will lose
                these permissions.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false)
                setSelectedRole(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => selectedRole && deleteMutation.mutate(selectedRole.id)}
              isLoading={deleteMutation.isPending}
            >
              Delete Role
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
