import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  UsersIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ShieldCheckIcon,
  KeyIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  LockOpenIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { TablePagination } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { userService, roleService, userOrganizationService, type User, type Role, type UserRole, type UserOrganization } from '@/services/users'

type ScopeType = 'global' | 'region' | 'department' | 'team'

const statusColors: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  active: 'success',
  inactive: 'danger',
  locked: 'warning',
  unverified: 'info',
}

export default function UserManagementPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showOrgModal, setShowOrgModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    phone_number: '',
    password: '',
    password_confirm: '',
    is_active: true,
    is_staff: false,
  })

  const [roleFormData, setRoleFormData] = useState<{
    role: string
    scope_type: ScopeType
    is_primary: boolean
  }>({
    role: '',
    scope_type: 'global',
    is_primary: false,
  })

  const [orgFormData, setOrgFormData] = useState({
    organization_id: '',
    role: 'member' as 'member' | 'admin' | 'viewer',
    is_default: false,
  })

  // Queries
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', search, statusFilter, roleFilter],
    queryFn: () => userService.getUsers({
      search: search || undefined,
      is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
      role: roleFilter || undefined,
    }),
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => roleService.getRoles({ is_active: true }),
  })

  const { data: allOrganizations = [] } = useQuery({
    queryKey: ['organizations-all'],
    queryFn: () => userOrganizationService.getOrganizations(),
  })

  const { data: userOrgs = [], isLoading: userOrgsLoading } = useQuery({
    queryKey: ['user-organizations', selectedUser?.id],
    queryFn: () => userOrganizationService.getUserOrganizations(selectedUser!.id),
    enabled: !!selectedUser && showOrgModal,
  })

  const users: User[] = usersData?.results || usersData || []
  const paginatedUsers = users.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Mutations
  const createMutation = useMutation({
    mutationFn: userService.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowCreateModal(false)
      resetForm()
      toast.success('User created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create user')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => userService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowEditModal(false)
      setSelectedUser(null)
      toast.success('User updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update user')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: userService.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete user')
    },
  })

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: any }) =>
      userService.assignRole(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowRoleModal(false)
      setRoleFormData({ role: '', scope_type: 'global', is_primary: false })
      toast.success('Role assigned successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to assign role')
    },
  })

  const removeRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      userService.removeRole(userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Role removed successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to remove role')
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: userService.resetPassword,
    onSuccess: () => {
      toast.success('Password reset email sent')
    },
  })

  const unlockAccountMutation = useMutation({
    mutationFn: userService.unlockAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Account unlocked successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to unlock account')
    },
  })

  const addOrgMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { organization_id: string; role: 'member' | 'admin' | 'viewer'; is_default: boolean } }) =>
      userOrganizationService.addUserOrganization(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-organizations', selectedUser?.id] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setOrgFormData({ organization_id: '', role: 'member', is_default: false })
      toast.success('Organization assigned successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to assign organization')
    },
  })

  const removeOrgMutation = useMutation({
    mutationFn: ({ userId, organizationId }: { userId: string; organizationId: string }) =>
      userOrganizationService.removeUserOrganization(userId, organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-organizations', selectedUser?.id] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Organization removed successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to remove organization')
    },
  })

  const resetForm = () => {
    setFormData({
      email: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      phone_number: '',
      password: '',
      password_confirm: '',
      is_active: true,
      is_staff: false,
    })
  }

  const handleCreate = () => {
    if (!formData.email || !formData.first_name || !formData.last_name) {
      toast.error('Please fill in required fields')
      return
    }
    if (formData.password !== formData.password_confirm) {
      toast.error('Passwords do not match')
      return
    }
    createMutation.mutate(formData)
  }

  const handleEdit = (user: User) => {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      first_name: user.first_name,
      middle_name: user.middle_name || '',
      last_name: user.last_name,
      phone_number: user.phone_number || '',
      password: '',
      password_confirm: '',
      is_active: user.is_active,
      is_staff: user.is_staff,
    })
    setShowEditModal(true)
  }

  const handleUpdate = () => {
    if (!selectedUser) return
    updateMutation.mutate({
      id: selectedUser.id,
      data: {
        email: formData.email,
        first_name: formData.first_name,
        middle_name: formData.middle_name || null,
        last_name: formData.last_name,
        phone_number: formData.phone_number || null,
        is_active: formData.is_active,
        is_staff: formData.is_staff,
      },
    })
  }

  const handleDelete = (user: User) => {
    if (confirm(`Are you sure you want to delete ${user.full_name}?`)) {
      deleteMutation.mutate(user.id)
    }
  }

  const handleAssignRole = () => {
    if (!selectedUser || !roleFormData.role) return
    assignRoleMutation.mutate({
      userId: selectedUser.id,
      data: roleFormData,
    })
  }

  const handleRemoveRole = (user: User, userRole: UserRole) => {
    if (confirm(`Remove role ${userRole.role_name} from ${user.full_name}?`)) {
      removeRoleMutation.mutate({ userId: user.id, roleId: userRole.id })
    }
  }

  const handleAssignOrg = () => {
    if (!selectedUser || !orgFormData.organization_id) return
    addOrgMutation.mutate({
      userId: selectedUser.id,
      data: orgFormData,
    })
  }

  const handleRemoveOrg = (org: UserOrganization) => {
    if (!selectedUser) return
    if (confirm(`Remove ${selectedUser.full_name} from ${org.organization.name}?`)) {
      removeOrgMutation.mutate({
        userId: selectedUser.id,
        organizationId: org.organization.id,
      })
    }
  }

  // Filter out organizations the user is already a member of
  const availableOrganizations = allOrganizations.filter(
    (org: { id: string }) => !userOrgs.some((uo: UserOrganization) => uo.organization.id === org.id)
  )

  const getUserStatus = (user: User) => {
    if (!user.is_active) return 'inactive'
    if (
      (user.lockout_until && new Date(user.lockout_until) > new Date()) ||
      user.failed_login_attempts >= 5
    )
      return 'locked'
    if (!user.is_verified) return 'unverified'
    return 'active'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage system users and their roles</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-md">
              <UsersIcon className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Users</p>
              <p className="text-xl font-semibold">{users.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-100 rounded-md">
              <CheckCircleIcon className="h-5 w-5 text-success-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-xl font-semibold">
                {users.filter((u: User) => u.is_active).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-100 rounded-md">
              <ShieldCheckIcon className="h-5 w-5 text-warning-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Admins</p>
              <p className="text-xl font-semibold">
                {users.filter((u: User) => u.is_staff || u.is_superuser).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-md">
              <XCircleIcon className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Inactive</p>
              <p className="text-xl font-semibold">
                {users.filter((u: User) => !u.is_active).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex gap-4 flex-wrap">
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setCurrentPage(1) }}
              className="w-64"
            />
            <Select
              value={statusFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
              options={[
                { value: '', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              className="w-40"
            />
            <Select
              value={roleFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setRoleFilter(e.target.value); setCurrentPage(1) }}
              options={[
                { value: '', label: 'All Roles' },
                ...roles.map((r: Role) => ({ value: r.id, label: r.name })),
              ]}
              className="w-48"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roles</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedUsers.map((user: User) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-primary-700 font-medium">
                              {user.first_name[0]}{user.last_name[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.full_name}</p>
                            {user.employee && (
                              <p className="text-sm text-gray-500">
                                {user.employee.employee_number} • {user.employee.position_title}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{user.email}</p>
                        {user.phone_number && (
                          <p className="text-sm text-gray-500">{user.phone_number}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.is_superuser && (
                            <Badge variant="danger">Super Admin</Badge>
                          )}
                          {user.roles?.slice(0, 2).map((role: UserRole) => (
                            <Badge key={role.id} variant={role.is_primary ? 'info' : 'default'}>
                              {role.role_name}
                            </Badge>
                          ))}
                          {user.roles?.length > 2 && (
                            <Badge variant="default">+{user.roles.length - 2}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusColors[getUserStatus(user)]}>
                          {getUserStatus(user)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {user.last_login_at
                          ? new Date(user.last_login_at).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user)
                              setShowViewModal(true)
                            }}
                          >
                            <EyeIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(user)}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user)
                              setShowRoleModal(true)
                            }}
                            title="Manage Roles"
                          >
                            <ShieldCheckIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user)
                              setShowOrgModal(true)
                            }}
                            title="Manage Organizations"
                          >
                            <BuildingOffice2Icon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resetPasswordMutation.mutate(user.id)}
                          >
                            <KeyIcon className="h-4 w-4" />
                          </Button>
                          {getUserStatus(user) === 'locked' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-warning-600"
                              onClick={() => unlockAccountMutation.mutate(user.id)}
                              title="Unlock account"
                            >
                              <LockOpenIcon className="h-4 w-4" />
                            </Button>
                          )}
                          {!user.is_superuser && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-danger-600"
                              onClick={() => handleDelete(user)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {users.length > pageSize && (
            <TablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(users.length / pageSize)}
              totalItems={users.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          resetForm()
        }}
        title="Create User"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name *"
              value={formData.first_name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, first_name: e.target.value })
              }
            />
            <Input
              label="Last Name *"
              value={formData.last_name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, last_name: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Middle Name"
              value={formData.middle_name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, middle_name: e.target.value })
              }
            />
            <Input
              label="Phone Number"
              value={formData.phone_number}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, phone_number: e.target.value })
              }
            />
          </div>
          <Input
            label="Email *"
            type="email"
            value={formData.email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Password *"
              type="password"
              value={formData.password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
            <Input
              label="Confirm Password *"
              type="password"
              value={formData.password_confirm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, password_confirm: e.target.value })
              }
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Active</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_staff}
                onChange={(e) => setFormData({ ...formData, is_staff: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Staff (Admin Access)</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} isLoading={createMutation.isPending}>
              Create User
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedUser(null)
        }}
        title="Edit User"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name *"
              value={formData.first_name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, first_name: e.target.value })
              }
            />
            <Input
              label="Last Name *"
              value={formData.last_name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, last_name: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Middle Name"
              value={formData.middle_name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, middle_name: e.target.value })
              }
            />
            <Input
              label="Phone Number"
              value={formData.phone_number}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, phone_number: e.target.value })
              }
            />
          </div>
          <Input
            label="Email *"
            type="email"
            value={formData.email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Active</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_staff}
                onChange={(e) => setFormData({ ...formData, is_staff: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Staff (Admin Access)</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} isLoading={updateMutation.isPending}>
              Update User
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Role Modal */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => {
          setShowRoleModal(false)
          setSelectedUser(null)
          setRoleFormData({ role: '', scope_type: 'global', is_primary: false })
        }}
        title={`Manage Roles - ${selectedUser?.full_name}`}
        size="lg"
      >
        {selectedUser && (
          <div className="space-y-6">
            {/* Current Roles */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Current Roles</h4>
              {selectedUser.roles?.length === 0 ? (
                <p className="text-gray-500 text-sm">No roles assigned</p>
              ) : (
                <div className="space-y-2">
                  {selectedUser.roles?.map((userRole: UserRole) => (
                    <div
                      key={userRole.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{userRole.role_name}</p>
                        <p className="text-sm text-gray-500">
                          {userRole.scope_type} • {userRole.is_primary ? 'Primary' : 'Secondary'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger-600"
                        onClick={() => handleRemoveRole(selectedUser, userRole)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Role */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3">Add New Role</h4>
              <div className="space-y-4">
                <Select
                  label="Role"
                  value={roleFormData.role}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setRoleFormData({ ...roleFormData, role: e.target.value })
                  }
                  options={[
                    { value: '', label: 'Select a role...' },
                    ...roles.map((r: Role) => ({ value: r.id, label: r.name })),
                  ]}
                />
                <Select
                  label="Scope"
                  value={roleFormData.scope_type}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setRoleFormData({
                      ...roleFormData,
                      scope_type: e.target.value as ScopeType,
                    })
                  }
                  options={[
                    { value: 'global', label: 'Global (Organization-wide)' },
                    { value: 'department', label: 'Department' },
                    { value: 'region', label: 'Region' },
                    { value: 'team', label: 'Team' },
                  ]}
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={roleFormData.is_primary}
                    onChange={(e) =>
                      setRoleFormData({ ...roleFormData, is_primary: e.target.checked })
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Set as primary role</span>
                </label>
                <Button
                  onClick={handleAssignRole}
                  disabled={!roleFormData.role}
                  isLoading={assignRoleMutation.isPending}
                >
                  Assign Role
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Manage Organizations Modal */}
      <Modal
        isOpen={showOrgModal}
        onClose={() => {
          setShowOrgModal(false)
          setSelectedUser(null)
          setOrgFormData({ organization_id: '', role: 'member', is_default: false })
        }}
        title={`Manage Organizations - ${selectedUser?.full_name}`}
        size="lg"
      >
        {selectedUser && (
          <div className="space-y-6">
            {/* Current Organizations */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Current Organizations</h4>
              {userOrgsLoading ? (
                <p className="text-gray-500 text-sm">Loading...</p>
              ) : userOrgs.length === 0 ? (
                <p className="text-gray-500 text-sm">No organizations assigned</p>
              ) : (
                <div className="space-y-2">
                  {userOrgs.map((uo: UserOrganization) => (
                    <div
                      key={uo.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                    >
                      <div className="flex items-center gap-3">
                        <BuildingOffice2Icon className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{uo.organization.name}</p>
                          <p className="text-sm text-gray-500">
                            {uo.organization.code} &bull; Role: <span className="capitalize">{uo.role}</span>
                            {uo.is_default && (
                              <Badge variant="info" className="ml-2">Default</Badge>
                            )}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger-600"
                        onClick={() => handleRemoveOrg(uo)}
                        isLoading={removeOrgMutation.isPending}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Organization */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3">Add to Organization</h4>
              {availableOrganizations.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  {allOrganizations.length === 0 ? 'No organizations found' : 'User is already a member of all organizations'}
                </p>
              ) : (
                <div className="space-y-4">
                  <Select
                    label="Organization"
                    value={orgFormData.organization_id}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setOrgFormData({ ...orgFormData, organization_id: e.target.value })
                    }
                    options={[
                      { value: '', label: 'Select an organization...' },
                      ...availableOrganizations.map((org: { id: string; name: string; code: string }) => ({
                        value: org.id,
                        label: `${org.name} (${org.code})`,
                      })),
                    ]}
                  />
                  <Select
                    label="Role"
                    value={orgFormData.role}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setOrgFormData({ ...orgFormData, role: e.target.value as 'member' | 'admin' | 'viewer' })
                    }
                    options={[
                      { value: 'member', label: 'Member' },
                      { value: 'admin', label: 'Admin' },
                      { value: 'viewer', label: 'Viewer' },
                    ]}
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={orgFormData.is_default}
                      onChange={(e) =>
                        setOrgFormData({ ...orgFormData, is_default: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">Set as default organization</span>
                  </label>
                  <Button
                    onClick={handleAssignOrg}
                    disabled={!orgFormData.organization_id}
                    isLoading={addOrgMutation.isPending}
                  >
                    <BuildingOffice2Icon className="h-4 w-4 mr-2" />
                    Assign Organization
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* View User Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false)
          setSelectedUser(null)
        }}
        title="User Details"
        size="lg"
      >
        {selectedUser && (
          <div className="space-y-6">
            {/* User Info */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-700 font-bold text-xl">
                  {selectedUser.first_name[0]}{selectedUser.last_name[0]}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold">{selectedUser.full_name}</h3>
                <p className="text-gray-500">{selectedUser.email}</p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{selectedUser.phone_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={statusColors[getUserStatus(selectedUser)]}>
                  {getUserStatus(selectedUser)}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Last Login</p>
                <p className="font-medium">
                  {selectedUser.last_login_at
                    ? new Date(selectedUser.last_login_at).toLocaleString()
                    : 'Never'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Last Login IP</p>
                <p className="font-medium">{selectedUser.last_login_ip || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Two-Factor Auth</p>
                <Badge variant={selectedUser.two_factor_enabled ? 'success' : 'default'}>
                  {selectedUser.two_factor_enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Account Type</p>
                <p className="font-medium">
                  {selectedUser.is_superuser
                    ? 'Super Admin'
                    : selectedUser.is_staff
                    ? 'Staff'
                    : 'Regular User'}
                </p>
              </div>
            </div>

            {/* Employee Info */}
            {selectedUser.employee && (
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-3">Linked Employee</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Employee Number</p>
                    <p className="font-medium">{selectedUser.employee.employee_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Position</p>
                    <p className="font-medium">{selectedUser.employee.position_title}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Department</p>
                    <p className="font-medium">{selectedUser.employee.department_name}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Roles */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3">Assigned Roles</h4>
              {selectedUser.roles?.length === 0 ? (
                <p className="text-gray-500 text-sm">No roles assigned</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedUser.roles?.map((role: UserRole) => (
                    <Badge
                      key={role.id}
                      variant={role.is_primary ? 'info' : 'default'}
                    >
                      {role.role_name}
                      {role.is_primary && ' (Primary)'}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
