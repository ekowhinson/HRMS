import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  UserCircleIcon,
  KeyIcon,
  BellIcon,
  ShieldCheckIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/features/auth/store'
import { authService } from '@/services/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'

type SettingsTab = 'profile' | 'password' | 'notifications' | 'security' | 'organization'

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })

  const [notifications, setNotifications] = useState({
    email_leave_requests: true,
    email_leave_approvals: true,
    email_payslip: true,
    email_announcements: true,
    push_leave_requests: true,
    push_approvals: false,
  })

  const updateProfileMutation = useMutation({
    mutationFn: authService.updateProfile,
    onSuccess: (data) => {
      updateUser(data)
      toast.success('Profile updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update profile')
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: authService.changePassword,
    onSuccess: () => {
      toast.success('Password changed successfully')
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to change password')
    },
  })

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfileMutation.mutate(profileForm)
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('Passwords do not match')
      return
    }
    if (passwordForm.new_password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    changePasswordMutation.mutate({
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password,
    })
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: UserCircleIcon },
    { id: 'password', label: 'Password', icon: KeyIcon },
    { id: 'notifications', label: 'Notifications', icon: BellIcon },
    { id: 'security', label: 'Security', icon: ShieldCheckIcon },
  ]

  // Only show org settings for admin users
  if (user?.role === 'admin' || user?.role === 'hr_director') {
    tabs.push({ id: 'organization', label: 'Organization', icon: BuildingOfficeIcon })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <tab.icon className="h-5 w-5" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <UserCircleIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Profile Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSubmit} className="space-y-6">
                  <div className="flex items-center gap-6">
                    <Avatar
                      firstName={user?.first_name}
                      lastName={user?.last_name}
                      size="xl"
                    />
                    <div>
                      <Button variant="outline" size="sm">
                        Change Photo
                      </Button>
                      <p className="text-xs text-gray-500 mt-1">
                        JPG, PNG or GIF. Max 2MB.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="First Name"
                      value={profileForm.first_name}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, first_name: e.target.value })
                      }
                      required
                    />
                    <Input
                      label="Last Name"
                      value={profileForm.last_name}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, last_name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <Input
                    label="Email"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, email: e.target.value })
                    }
                    required
                  />

                  <Input
                    label="Phone Number"
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, phone: e.target.value })
                    }
                  />

                  <div className="flex justify-end">
                    <Button type="submit" isLoading={updateProfileMutation.isPending}>
                      Save Changes
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {activeTab === 'password' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <KeyIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Change Password
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-md">
                  <Input
                    label="Current Password"
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, current_password: e.target.value })
                    }
                    required
                  />

                  <Input
                    label="New Password"
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, new_password: e.target.value })
                    }
                    required
                  />

                  <Input
                    label="Confirm New Password"
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, confirm_password: e.target.value })
                    }
                    required
                  />

                  <div className="text-sm text-gray-500">
                    <p className="font-medium">Password requirements:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>At least 8 characters</li>
                      <li>One uppercase letter</li>
                      <li>One lowercase letter</li>
                      <li>One number</li>
                    </ul>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" isLoading={changePasswordMutation.isPending}>
                      Change Password
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BellIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-4">
                      Email Notifications
                    </h4>
                    <div className="space-y-4">
                      {[
                        {
                          key: 'email_leave_requests',
                          label: 'Leave Requests',
                          description: 'Receive email when you have pending leave approvals',
                        },
                        {
                          key: 'email_leave_approvals',
                          label: 'Leave Status Updates',
                          description: 'Receive email when your leave request is approved/rejected',
                        },
                        {
                          key: 'email_payslip',
                          label: 'Payslip Notifications',
                          description: 'Receive email when your payslip is ready',
                        },
                        {
                          key: 'email_announcements',
                          label: 'Announcements',
                          description: 'Receive organization-wide announcements',
                        },
                      ].map((item) => (
                        <div key={item.key} className="flex items-start">
                          <input
                            type="checkbox"
                            id={item.key}
                            checked={notifications[item.key as keyof typeof notifications]}
                            onChange={(e) =>
                              setNotifications({
                                ...notifications,
                                [item.key]: e.target.checked,
                              })
                            }
                            className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <label htmlFor={item.key} className="ml-3">
                            <span className="text-sm font-medium text-gray-900">
                              {item.label}
                            </span>
                            <p className="text-sm text-gray-500">{item.description}</p>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t">
                    <h4 className="text-sm font-medium text-gray-900 mb-4">
                      Push Notifications
                    </h4>
                    <div className="space-y-4">
                      {[
                        {
                          key: 'push_leave_requests',
                          label: 'Leave Requests',
                          description: 'Push notifications for pending approvals',
                        },
                        {
                          key: 'push_approvals',
                          label: 'Approval Updates',
                          description: 'Push notifications for approval status changes',
                        },
                      ].map((item) => (
                        <div key={item.key} className="flex items-start">
                          <input
                            type="checkbox"
                            id={item.key}
                            checked={notifications[item.key as keyof typeof notifications]}
                            onChange={(e) =>
                              setNotifications({
                                ...notifications,
                                [item.key]: e.target.checked,
                              })
                            }
                            className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <label htmlFor={item.key} className="ml-3">
                            <span className="text-sm font-medium text-gray-900">
                              {item.label}
                            </span>
                            <p className="text-sm text-gray-500">{item.description}</p>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button>Save Preferences</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ShieldCheckIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Two-Factor Authentication */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        Two-Factor Authentication
                      </h4>
                      <p className="text-sm text-gray-500 mt-1">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Enable
                    </Button>
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-4">
                      Active Sessions
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Current Session</p>
                          <p className="text-xs text-gray-500">
                            Chrome on Windows - Last active: Now
                          </p>
                        </div>
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                          Active
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="mt-4">
                      Log Out All Other Sessions
                    </Button>
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-4">
                      Login History
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-600">
                        <span>Today, 9:00 AM</span>
                        <span>Chrome - Accra, Ghana</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Yesterday, 5:30 PM</span>
                        <span>Chrome - Accra, Ghana</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Jan 28, 2026, 8:45 AM</span>
                        <span>Firefox - Kumasi, Ghana</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'organization' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BuildingOfficeIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Organization Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Organization Name" value="Your Organization" disabled />
                    <Input label="Country" value="Ghana" disabled />
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-4">
                      Payroll Settings
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input label="Pay Day" type="number" defaultValue="25" />
                      <Input label="Currency" value="GHS" disabled />
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-4">
                      Leave Settings
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Leave Year Start"
                        type="date"
                        defaultValue="2026-01-01"
                      />
                      <Input
                        label="Max Carry Forward Days"
                        type="number"
                        defaultValue="5"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button>Save Settings</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
