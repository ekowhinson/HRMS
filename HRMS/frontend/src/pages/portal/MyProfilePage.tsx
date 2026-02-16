import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  HomeIcon,
  IdentificationIcon,
  CameraIcon,
  PencilIcon,
} from '@heroicons/react/24/outline'
import { portalService } from '@/services/portal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'

type TabType = 'personal' | 'contact' | 'emergency' | 'bank'

export default function MyProfilePage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('personal')
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, string>>({})

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['my-profile'],
    queryFn: portalService.getMyProfile,
    retry: false,
  })

  const { data: emergencyContacts } = useQuery({
    queryKey: ['my-emergency-contacts'],
    queryFn: portalService.getMyEmergencyContacts,
    enabled: activeTab === 'emergency' && !!profile,
    retry: false,
  })

  const { data: bankAccounts } = useQuery({
    queryKey: ['my-bank-accounts'],
    queryFn: portalService.getMyBankAccounts,
    enabled: activeTab === 'bank' && !!profile,
    retry: false,
  })

  const updateMutation = useMutation({
    mutationFn: portalService.updateMyProfile,
    onSuccess: () => {
      toast.success('Profile updated successfully')
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      setIsEditing(false)
      setEditData({})
    },
    onError: () => {
      toast.error('Failed to update profile')
    },
  })

  const handleStartEdit = () => {
    if (profile) {
      setEditData({
        mobile_phone: profile.mobile_phone || '',
        home_phone: profile.home_phone || '',
        personal_email: profile.personal_email || '',
        residential_address: profile.residential_address || '',
        residential_city: profile.residential_city || '',
        postal_address: profile.postal_address || '',
        digital_address: profile.digital_address || '',
        blood_group: profile.blood_group || '',
      })
      setIsEditing(true)
    }
  }

  const handleSave = () => {
    updateMutation.mutate(editData)
  }

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: UserIcon },
    { id: 'contact', label: 'Contact', icon: PhoneIcon },
    { id: 'emergency', label: 'Emergency Contacts', icon: IdentificationIcon },
    { id: 'bank', label: 'Bank Details', icon: HomeIcon },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!profile || isError) {
    return (
      <div className="text-center py-12">
        <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">No Employee Profile</h3>
        <p className="mt-1 text-sm text-gray-500">
          Your account is not linked to an employee profile.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Please contact HR to set up your employee record.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and manage your personal information
          </p>
        </div>
        {activeTab === 'contact' && !isEditing && (
          <Button onClick={handleStartEdit}>
            <PencilIcon className="h-4 w-4 mr-2" />
            Edit Contact Info
          </Button>
        )}
      </div>

      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar
                firstName={profile.first_name}
                lastName={profile.last_name}
                src={profile.photo}
                size="xl"
              />
              <button className="absolute bottom-0 right-0 p-1.5 bg-primary-600 rounded-full text-white hover:bg-primary-700">
                <CameraIcon className="h-4 w-4" />
              </button>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{profile.full_name}</h2>
              <p className="text-gray-600">{profile.position_title}</p>
              <p className="text-sm text-gray-500">{profile.department_name}</p>
              {profile.organization_name && (
                <p className="text-sm text-gray-500">{profile.organization_name}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="info">{profile.employee_number}</Badge>
                <Badge variant={profile.status === 'ACTIVE' ? 'success' : 'warning'}>
                  {profile.status}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm
                ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'personal' && (
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{profile.full_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {profile.date_of_birth
                    ? new Date(profile.date_of_birth).toLocaleDateString()
                    : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Gender</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {profile.gender === 'M' ? 'Male' : profile.gender === 'F' ? 'Female' : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Marital Status</dt>
                <dd className="mt-1 text-sm text-gray-900">{profile.marital_status || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Nationality</dt>
                <dd className="mt-1 text-sm text-gray-900">{profile.nationality || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Blood Group</dt>
                <dd className="mt-1 text-sm text-gray-900">{profile.blood_group || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Ghana Card Number</dt>
                <dd className="mt-1 text-sm text-gray-900">{profile.ghana_card_number || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">SSNIT Number</dt>
                <dd className="mt-1 text-sm text-gray-900">{profile.ssnit_number || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">TIN Number</dt>
                <dd className="mt-1 text-sm text-gray-900">{profile.tin_number || '-'}</dd>
              </div>
            </dl>

            <div className="mt-8 pt-6 border-t">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Employment Details</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Employee Number</dt>
                  <dd className="mt-1 text-sm text-gray-900">{profile.employee_number}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Organization</dt>
                  <dd className="mt-1 text-sm text-gray-900">{profile.organization_name || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Department</dt>
                  <dd className="mt-1 text-sm text-gray-900">{profile.department_name || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Position</dt>
                  <dd className="mt-1 text-sm text-gray-900">{profile.position_title || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Grade</dt>
                  <dd className="mt-1 text-sm text-gray-900">{profile.grade_name || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Supervisor</dt>
                  <dd className="mt-1 text-sm text-gray-900">{profile.supervisor_name || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Employment Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">{profile.employment_type || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Date of Joining</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {profile.date_of_joining
                      ? new Date(profile.date_of_joining).toLocaleDateString()
                      : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Years of Service</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {profile.years_of_service?.toFixed(1) || '-'} years
                  </dd>
                </div>
              </dl>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'contact' && (
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Mobile Phone"
                    value={editData.mobile_phone}
                    onChange={(e) =>
                      setEditData({ ...editData, mobile_phone: e.target.value })
                    }
                  />
                  <Input
                    label="Home Phone"
                    value={editData.home_phone}
                    onChange={(e) =>
                      setEditData({ ...editData, home_phone: e.target.value })
                    }
                  />
                  <Input
                    label="Personal Email"
                    type="email"
                    value={editData.personal_email}
                    onChange={(e) =>
                      setEditData({ ...editData, personal_email: e.target.value })
                    }
                  />
                  <Input
                    label="Digital Address"
                    value={editData.digital_address}
                    onChange={(e) =>
                      setEditData({ ...editData, digital_address: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Residential Address
                  </label>
                  <textarea
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] transition-colors duration-150 sm:text-sm"
                    rows={2}
                    value={editData.residential_address}
                    onChange={(e) =>
                      setEditData({ ...editData, residential_address: e.target.value })
                    }
                  />
                </div>
                <Input
                  label="City"
                  value={editData.residential_city}
                  onChange={(e) =>
                    setEditData({ ...editData, residential_city: e.target.value })
                  }
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Address
                  </label>
                  <textarea
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] transition-colors duration-150 sm:text-sm"
                    rows={2}
                    value={editData.postal_address}
                    onChange={(e) =>
                      setEditData({ ...editData, postal_address: e.target.value })
                    }
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false)
                      setEditData({})
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave} isLoading={updateMutation.isPending}>
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Work Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{profile.work_email || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Personal Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{profile.personal_email || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Mobile Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">{profile.mobile_phone || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Home Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">{profile.home_phone || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Work Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">{profile.work_phone || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Digital Address</dt>
                  <dd className="mt-1 text-sm text-gray-900">{profile.digital_address || '-'}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Residential Address</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {profile.residential_address || '-'}
                    {profile.residential_city && `, ${profile.residential_city}`}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Postal Address</dt>
                  <dd className="mt-1 text-sm text-gray-900">{profile.postal_address || '-'}</dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'emergency' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Emergency Contacts</CardTitle>
            <Button size="sm">Add Contact</Button>
          </CardHeader>
          <CardContent>
            {emergencyContacts && emergencyContacts.length > 0 ? (
              <div className="space-y-4">
                {emergencyContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-4 border rounded-md flex items-start justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {contact.name}
                        {contact.is_primary && (
                          <Badge variant="info" className="ml-2">
                            Primary
                          </Badge>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">{contact.relationship}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        <PhoneIcon className="inline h-4 w-4 mr-1" />
                        {contact.phone_primary}
                        {contact.phone_secondary && ` / ${contact.phone_secondary}`}
                      </p>
                      {contact.email && (
                        <p className="text-sm text-gray-600">
                          <EnvelopeIcon className="inline h-4 w-4 mr-1" />
                          {contact.email}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm">
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">
                No emergency contacts added yet
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'bank' && (
        <Card>
          <CardHeader>
            <CardTitle>Bank Details</CardTitle>
          </CardHeader>
          <CardContent>
            {bankAccounts && bankAccounts.length > 0 ? (
              <div className="space-y-4">
                {bankAccounts.map((account) => (
                  <div key={account.id} className="p-4 border rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {account.bank_name}
                          {account.is_primary && (
                            <Badge variant="success" className="ml-2">
                              Primary
                            </Badge>
                          )}
                        </p>
                        {account.branch_name && (
                          <p className="text-sm text-gray-500">{account.branch_name}</p>
                        )}
                      </div>
                      {account.is_verified && (
                        <Badge variant="success">Verified</Badge>
                      )}
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-xs text-gray-500">Account Name</dt>
                        <dd className="text-sm text-gray-900">{account.account_name}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">Account Number</dt>
                        <dd className="text-sm text-gray-900">
                          {'*'.repeat(account.account_number.length - 4) +
                            account.account_number.slice(-4)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">Account Type</dt>
                        <dd className="text-sm text-gray-900">{account.account_type}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">
                No bank accounts on file
              </p>
            )}
            <p className="mt-4 text-xs text-gray-500">
              To update bank details, please contact HR.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
