import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  UserCircleIcon,
  KeyIcon,
  BellIcon,
  ShieldCheckIcon,
  BuildingOfficeIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import api from '@/lib/api'
import { useAuthStore } from '@/features/auth/store'
import { authService, type TwoFactorSetupResponse } from '@/services/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'

type SettingsTab = 'profile' | 'password' | 'notifications' | 'security' | 'organization'
type TwoFactorStep = 'choose' | 'verify' | 'backup' | 'enabled'

const methodLabels: Record<string, string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  TOTP: 'Authenticator App',
}

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore()
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'profile'
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)

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

  // 2FA state
  const [twoFactorStep, setTwoFactorStep] = useState<TwoFactorStep>('choose')
  const [selectedMethod, setSelectedMethod] = useState('EMAIL')
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [disablePassword, setDisablePassword] = useState('')
  const [showDisableForm, setShowDisableForm] = useState(false)
  const [copiedBackup, setCopiedBackup] = useState(false)

  // 2FA Policy state (admin)
  const [policyForm, setPolicyForm] = useState({
    tfa_enforcement: 'optional',
    tfa_allowed_methods: ['EMAIL', 'SMS', 'TOTP'] as string[],
    tfa_grace_period_days: 7,
  })

  // Robust admin check matching App.tsx / MainLayout.tsx
  const HR_ADMIN_ROLES = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN', 'SUPERUSER']
  const isAdmin = (() => {
    if (!user) return false
    if (user.is_staff || user.is_superuser) return true
    if (Array.isArray(user.roles)) {
      return user.roles.some((r: any) => {
        const code = (typeof r === 'string' ? r : r?.code || r?.name || '').toUpperCase()
        return HR_ADMIN_ROLES.includes(code)
      })
    }
    // Fallback to legacy role field
    if (user.role) {
      return HR_ADMIN_ROLES.includes(user.role.toUpperCase())
    }
    return false
  })()
  // Employee ID config state
  const [empIdForm, setEmpIdForm] = useState({
    prefix: 'EMP',
    suffix: '',
    next_number: 1,
    increment: 1,
    padding: 4,
    auto_generate: true,
  })

  const empIdConfigQuery = useQuery({
    queryKey: ['employee-id-config'],
    queryFn: async () => {
      const res = await api.get('/core/employee-id-config/')
      return res.data
    },
    enabled: isAdmin && activeTab === 'organization',
  })

  useEffect(() => {
    if (empIdConfigQuery.data) {
      setEmpIdForm({
        prefix: empIdConfigQuery.data.prefix ?? 'EMP',
        suffix: empIdConfigQuery.data.suffix ?? '',
        next_number: empIdConfigQuery.data.next_number ?? 1,
        increment: empIdConfigQuery.data.increment ?? 1,
        padding: empIdConfigQuery.data.padding ?? 4,
        auto_generate: empIdConfigQuery.data.auto_generate ?? true,
      })
    }
  }, [empIdConfigQuery.data])

  const saveEmpIdConfigMutation = useMutation({
    mutationFn: async (data: typeof empIdForm) => {
      const res = await api.put('/core/employee-id-config/', data)
      return res.data
    },
    onSuccess: () => {
      toast.success('Employee ID configuration saved')
      empIdConfigQuery.refetch()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save Employee ID configuration')
    },
  })

  const empIdPreview = (() => {
    const padded = String(empIdForm.next_number).padStart(empIdForm.padding, '0')
    return `${empIdForm.prefix}${padded}${empIdForm.suffix}`
  })()

  const admin2FAPolicyQuery = useQuery({
    queryKey: ['admin-2fa-policy'],
    queryFn: () => authService.getAdmin2FAPolicy(),
    enabled: isAdmin && activeTab === 'organization',
  })

  // User: fetch personal 2FA policy status
  const user2FAPolicyQuery = useQuery({
    queryKey: ['user-2fa-policy'],
    queryFn: () => authService.get2FAPolicy(),
    enabled: activeTab === 'security',
  })

  // Sync admin policy data to form
  useEffect(() => {
    if (admin2FAPolicyQuery.data) {
      setPolicyForm({
        tfa_enforcement: admin2FAPolicyQuery.data.tfa_enforcement,
        tfa_allowed_methods: admin2FAPolicyQuery.data.tfa_allowed_methods,
        tfa_grace_period_days: admin2FAPolicyQuery.data.tfa_grace_period_days,
      })
    }
  }, [admin2FAPolicyQuery.data])

  const updatePolicyMutation = useMutation({
    mutationFn: (data: typeof policyForm) => authService.updateAdmin2FAPolicy(data),
    onSuccess: () => {
      toast.success('2FA policy updated')
      admin2FAPolicyQuery.refetch()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update policy')
    },
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

  // 2FA mutations
  const setup2FAMutation = useMutation({
    mutationFn: (method: string) => authService.setup2FA(method),
    onSuccess: (data) => {
      setSetupData(data)
      setTwoFactorStep('verify')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to initiate 2FA setup')
    },
  })

  const verify2FAMutation = useMutation({
    mutationFn: ({ code, method }: { code: string; method: string }) =>
      authService.verify2FASetup(code, method),
    onSuccess: (data) => {
      setBackupCodes(data.backup_codes)
      setTwoFactorStep('backup')
      updateUser({ two_factor_enabled: true } as any)
      toast.success('Two-factor authentication enabled!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Invalid verification code')
      setVerifyCode('')
    },
  })

  const disable2FAMutation = useMutation({
    mutationFn: (password: string) => authService.disable2FA(password),
    onSuccess: () => {
      updateUser({ two_factor_enabled: false } as any)
      setShowDisableForm(false)
      setDisablePassword('')
      setTwoFactorStep('choose')
      toast.success('Two-factor authentication disabled')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Incorrect password')
    },
  })

  const regenerateBackupMutation = useMutation({
    mutationFn: authService.regenerateBackupCodes,
    onSuccess: (data) => {
      setBackupCodes(data.backup_codes)
      setTwoFactorStep('backup')
      toast.success('Backup codes regenerated')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to regenerate codes')
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

  const handleEnable2FA = () => {
    setup2FAMutation.mutate(selectedMethod)
  }

  const handleVerify2FA = (e: React.FormEvent) => {
    e.preventDefault()
    if (verifyCode.length !== 6) return
    verify2FAMutation.mutate({ code: verifyCode, method: selectedMethod })
  }

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'))
    setCopiedBackup(true)
    toast.success('Backup codes copied to clipboard')
    setTimeout(() => setCopiedBackup(false), 2000)
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: UserCircleIcon },
    { id: 'password', label: 'Password', icon: KeyIcon },
    { id: 'notifications', label: 'Notifications', icon: BellIcon },
    { id: 'security', label: 'Security', icon: ShieldCheckIcon },
  ]

  // Only show org settings for admin users
  if (isAdmin) {
    tabs.push({ id: 'organization', label: 'Organization', icon: BuildingOfficeIcon })
  }

  const is2FAEnabled = (user as any)?.two_factor_enabled

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
                  <div>
                    {/* Policy banner */}
                    {user2FAPolicyQuery.data?.is_required && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4 flex items-start gap-2">
                        <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium">Your organization requires two-factor authentication.</p>
                          {user2FAPolicyQuery.data.grace_deadline && !is2FAEnabled && (
                            <p className="mt-0.5">
                              You have until {new Date(user2FAPolicyQuery.data.grace_deadline).toLocaleDateString()} to set it up.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          Two-Factor Authentication
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                      {is2FAEnabled && (
                        <Badge variant="success">Enabled</Badge>
                      )}
                    </div>

                    {/* 2FA Enabled State */}
                    {is2FAEnabled && twoFactorStep !== 'backup' ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <ShieldCheckIcon className="h-6 w-6 text-green-600" />
                            <div>
                              <p className="text-sm font-medium text-green-900">
                                Two-factor authentication is active
                              </p>
                              <p className="text-sm text-green-700">
                                Method: {methodLabels[(user as any)?.two_factor_method] || 'Email'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => regenerateBackupMutation.mutate()}
                            isLoading={regenerateBackupMutation.isPending}
                          >
                            Regenerate Backup Codes
                          </Button>
                          {user2FAPolicyQuery.data?.is_required ? (
                            <p className="text-xs text-gray-500 self-center">
                              2FA cannot be disabled — required by organization policy.
                            </p>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-danger-600 border-danger-300 hover:bg-danger-50"
                              onClick={() => setShowDisableForm(true)}
                            >
                              Disable 2FA
                            </Button>
                          )}
                        </div>

                        {/* Disable 2FA form */}
                        {showDisableForm && (
                          <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                            <p className="text-sm text-red-800 font-medium">
                              Enter your password to disable two-factor authentication:
                            </p>
                            <Input
                              type="password"
                              placeholder="Your password"
                              value={disablePassword}
                              onChange={(e) => setDisablePassword(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => disable2FAMutation.mutate(disablePassword)}
                                isLoading={disable2FAMutation.isPending}
                                disabled={!disablePassword}
                              >
                                Confirm Disable
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setShowDisableForm(false)
                                  setDisablePassword('')
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : !is2FAEnabled && twoFactorStep === 'choose' ? (
                      /* Method Selection (2FA off) */
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Choose verification method
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                              { value: 'EMAIL', label: 'Email', desc: 'Receive codes via email' },
                              { value: 'SMS', label: 'SMS', desc: 'Receive codes via text message' },
                              { value: 'TOTP', label: 'Authenticator App', desc: 'Google Authenticator, etc.' },
                            ].filter((opt) => {
                              const allowed = user2FAPolicyQuery.data?.allowed_methods
                              return !allowed || allowed.includes(opt.value)
                            }).map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setSelectedMethod(opt.value)}
                                className={`p-3 rounded-lg border-2 text-left transition-all ${
                                  selectedMethod === opt.value
                                    ? 'border-primary-500 bg-primary-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        <Button
                          onClick={handleEnable2FA}
                          isLoading={setup2FAMutation.isPending}
                        >
                          Enable Two-Factor Authentication
                        </Button>
                      </div>
                    ) : twoFactorStep === 'verify' ? (
                      /* Verification Step */
                      <div className="space-y-4">
                        {setupData?.method === 'TOTP' && setupData?.qr_code && (
                          <div className="space-y-3">
                            <p className="text-sm text-gray-700">
                              Scan this QR code with your authenticator app:
                            </p>
                            <div className="flex justify-center">
                              <img
                                src={setupData.qr_code}
                                alt="2FA QR Code"
                                className="w-48 h-48 rounded-lg border"
                              />
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-500 mb-1">Or enter this secret manually:</p>
                              <code className="text-sm bg-gray-100 px-3 py-1 rounded font-mono select-all">
                                {setupData.secret}
                              </code>
                            </div>
                          </div>
                        )}

                        {setupData?.method !== 'TOTP' && (
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800">
                              {setupData?.message || `A verification code has been sent to your ${setupData?.method === 'EMAIL' ? 'email' : 'phone'}.`}
                            </p>
                          </div>
                        )}

                        <form onSubmit={handleVerify2FA} className="space-y-3">
                          <Input
                            label="Verification Code"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="000000"
                            value={verifyCode}
                            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              type="submit"
                              disabled={verifyCode.length !== 6}
                              isLoading={verify2FAMutation.isPending}
                            >
                              Verify & Enable
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setTwoFactorStep('choose')
                                setSetupData(null)
                                setVerifyCode('')
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </form>
                      </div>
                    ) : twoFactorStep === 'backup' ? (
                      /* Backup Codes Display */
                      <div className="space-y-4">
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm font-medium text-amber-900 mb-1">
                            Save your backup codes
                          </p>
                          <p className="text-sm text-amber-700">
                            These codes can be used to access your account if you lose your authentication device.
                            Each code can only be used once. Store them in a safe place.
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 border">
                          <div className="grid grid-cols-2 gap-2">
                            {backupCodes.map((code, i) => (
                              <div
                                key={i}
                                className="text-center font-mono text-sm bg-white px-3 py-2 rounded border"
                              >
                                {code}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={copyBackupCodes}>
                            {copiedBackup ? (
                              <>
                                <CheckIcon className="h-4 w-4 mr-1" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                                Copy Codes
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setTwoFactorStep(is2FAEnabled ? 'enabled' : 'choose')
                              setBackupCodes([])
                            }}
                          >
                            Done
                          </Button>
                        </div>
                      </div>
                    ) : null}
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

                  {/* Employee ID Format */}
                  <div className="border-t pt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-1">
                      Employee ID Format
                    </h4>
                    <p className="text-sm text-gray-500 mb-4">
                      Configure how employee numbers are automatically generated.
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="emp_id_auto_generate"
                          checked={empIdForm.auto_generate}
                          onChange={(e) => setEmpIdForm({ ...empIdForm, auto_generate: e.target.checked })}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <label htmlFor="emp_id_auto_generate" className="text-sm font-medium text-gray-700">
                          Auto-generate employee numbers
                        </label>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                          label="Prefix"
                          value={empIdForm.prefix}
                          onChange={(e) => setEmpIdForm({ ...empIdForm, prefix: e.target.value })}
                          placeholder="e.g. EMP"
                        />
                        <Input
                          label="Suffix"
                          value={empIdForm.suffix}
                          onChange={(e) => setEmpIdForm({ ...empIdForm, suffix: e.target.value })}
                          placeholder="e.g. -GH (optional)"
                        />
                        <Input
                          label="Next Number"
                          type="number"
                          value={empIdForm.next_number}
                          onChange={(e) => setEmpIdForm({ ...empIdForm, next_number: parseInt(e.target.value) || 1 })}
                        />
                        <Input
                          label="Increment"
                          type="number"
                          value={empIdForm.increment}
                          onChange={(e) => setEmpIdForm({ ...empIdForm, increment: parseInt(e.target.value) || 1 })}
                        />
                        <Input
                          label="Padding (digits)"
                          type="number"
                          value={empIdForm.padding}
                          onChange={(e) => setEmpIdForm({ ...empIdForm, padding: parseInt(e.target.value) || 4 })}
                        />
                      </div>

                      {/* Live Preview */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Preview of next employee ID:</p>
                        <p className="text-lg font-mono font-semibold text-primary-700">
                          {empIdPreview}
                        </p>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          onClick={() => saveEmpIdConfigMutation.mutate(empIdForm)}
                          isLoading={saveEmpIdConfigMutation.isPending}
                        >
                          Save Employee ID Format
                        </Button>
                      </div>
                    </div>
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

                  {/* Two-Factor Authentication Policy */}
                  <div className="border-t pt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-4">
                      Two-Factor Authentication Policy
                    </h4>
                    <p className="text-sm text-gray-500 mb-4">
                      Configure organization-wide two-factor authentication requirements.
                    </p>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Enforcement Level
                        </label>
                        <select
                          value={policyForm.tfa_enforcement}
                          onChange={(e) => setPolicyForm({ ...policyForm, tfa_enforcement: e.target.value })}
                          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="optional">Optional</option>
                          <option value="required_admins">Required for admins only</option>
                          <option value="required">Required for all users</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Allowed Methods
                        </label>
                        <div className="flex gap-4">
                          {[
                            { value: 'EMAIL', label: 'Email' },
                            { value: 'SMS', label: 'SMS' },
                            { value: 'TOTP', label: 'Authenticator App' },
                          ].map((method) => (
                            <label key={method.value} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={policyForm.tfa_allowed_methods.includes(method.value)}
                                onChange={(e) => {
                                  const methods = e.target.checked
                                    ? [...policyForm.tfa_allowed_methods, method.value]
                                    : policyForm.tfa_allowed_methods.filter((m) => m !== method.value)
                                  setPolicyForm({ ...policyForm, tfa_allowed_methods: methods })
                                }}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              />
                              <span className="text-sm text-gray-700">{method.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Input
                          label="Grace Period (days)"
                          type="number"
                          value={policyForm.tfa_grace_period_days}
                          onChange={(e) => setPolicyForm({ ...policyForm, tfa_grace_period_days: parseInt(e.target.value) || 0 })}
                          className="max-w-[200px]"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Number of days new users have to set up 2FA after enforcement is enabled.
                        </p>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          onClick={() => updatePolicyMutation.mutate(policyForm)}
                          isLoading={updatePolicyMutation.isPending}
                          disabled={policyForm.tfa_allowed_methods.length === 0}
                        >
                          Save 2FA Policy
                        </Button>
                      </div>
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
