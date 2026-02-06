import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  KeyIcon,
  CheckCircleIcon,
  XCircleIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  CloudIcon,
  ServerIcon,
} from '@heroicons/react/24/outline'
import { authProviderService, AuthProviderConfig, AuthProviderType } from '@/services/authProviders'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'

const providerIcons: Record<AuthProviderType, React.ElementType> = {
  LOCAL: KeyIcon,
  LDAP: ServerIcon,
  AZURE_AD: CloudIcon,
}

const providerColors: Record<AuthProviderType, string> = {
  LOCAL: 'bg-blue-100 text-blue-600',
  LDAP: 'bg-green-100 text-green-600',
  AZURE_AD: 'bg-purple-100 text-purple-600',
}

export default function AuthProvidersPage() {
  const queryClient = useQueryClient()
  const [selectedProvider, setSelectedProvider] = useState<AuthProviderConfig | null>(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [configForm, setConfigForm] = useState<Record<string, any>>({})

  const { data: providers, isLoading } = useQuery({
    queryKey: ['admin-auth-providers'],
    queryFn: authProviderService.getAdminProviders,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AuthProviderConfig> }) =>
      authProviderService.updateProvider(id, data),
    onSuccess: () => {
      toast.success('Provider updated successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-auth-providers'] })
      setShowConfigModal(false)
      setSelectedProvider(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update provider')
    },
  })

  const testMutation = useMutation({
    mutationFn: (id: string) => authProviderService.testProvider(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
      queryClient.invalidateQueries({ queryKey: ['admin-auth-providers'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Connection test failed')
    },
  })

  const handleToggleEnabled = (provider: AuthProviderConfig) => {
    updateMutation.mutate({
      id: provider.id,
      data: { is_enabled: !provider.is_enabled },
    })
  }

  const handleSetDefault = (provider: AuthProviderConfig) => {
    if (!provider.is_enabled) {
      toast.error('Enable the provider first before setting as default')
      return
    }
    updateMutation.mutate({
      id: provider.id,
      data: { is_default: true },
    })
  }

  const handleOpenConfig = (provider: AuthProviderConfig) => {
    setSelectedProvider(provider)
    setConfigForm({
      name: provider.name,
      is_enabled: provider.is_enabled,
      auto_provision_users: provider.auto_provision_users,
      auto_link_by_email: provider.auto_link_by_email,
      allowed_domains: provider.allowed_domains.join(', '),
      ...provider.config,
    })
    setShowConfigModal(true)
  }

  const handleSaveConfig = () => {
    if (!selectedProvider) return

    const { name, is_enabled, auto_provision_users, auto_link_by_email, allowed_domains, ...configFields } = configForm

    const data: Partial<AuthProviderConfig> = {
      name,
      is_enabled,
      auto_provision_users,
      auto_link_by_email,
      allowed_domains: allowed_domains ? allowed_domains.split(',').map((d: string) => d.trim()).filter(Boolean) : [],
      config: configFields,
    }

    updateMutation.mutate({ id: selectedProvider.id, data })
  }

  const renderConfigFields = () => {
    if (!selectedProvider) return null

    switch (selectedProvider.provider_type) {
      case 'LOCAL':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                Local authentication uses email and password stored in the database.
                No additional configuration is required.
              </p>
            </div>
            <Input
              label="Minimum Password Length"
              type="number"
              value={configForm.min_password_length || 8}
              onChange={(e) => setConfigForm({ ...configForm, min_password_length: parseInt(e.target.value) })}
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="require_uppercase"
                checked={configForm.require_uppercase ?? true}
                onChange={(e) => setConfigForm({ ...configForm, require_uppercase: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="require_uppercase" className="text-sm text-gray-700">
                Require uppercase letter
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="require_digit"
                checked={configForm.require_digit ?? true}
                onChange={(e) => setConfigForm({ ...configForm, require_digit: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="require_digit" className="text-sm text-gray-700">
                Require digit
              </label>
            </div>
          </div>
        )

      case 'LDAP':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-700">
                Configure LDAP/Active Directory connection settings.
                Use LDAPS (ldaps://) for secure connections.
              </p>
            </div>
            <Input
              label="Server URI"
              placeholder="ldaps://ad.company.com:636"
              value={configForm.server_uri || ''}
              onChange={(e) => setConfigForm({ ...configForm, server_uri: e.target.value })}
            />
            <Input
              label="Bind DN"
              placeholder="CN=ServiceAccount,OU=Service,DC=company,DC=com"
              value={configForm.bind_dn || ''}
              onChange={(e) => setConfigForm({ ...configForm, bind_dn: e.target.value })}
            />
            <Input
              label="Bind Password"
              type="password"
              placeholder="••••••••"
              value={configForm.bind_password || ''}
              onChange={(e) => setConfigForm({ ...configForm, bind_password: e.target.value })}
            />
            <Input
              label="User Search Base"
              placeholder="OU=Users,DC=company,DC=com"
              value={configForm.user_search_base || ''}
              onChange={(e) => setConfigForm({ ...configForm, user_search_base: e.target.value })}
            />
            <Input
              label="User Search Filter"
              placeholder="(sAMAccountName=%(user)s)"
              value={configForm.user_search_filter || '(sAMAccountName=%(user)s)'}
              onChange={(e) => setConfigForm({ ...configForm, user_search_filter: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Email Attribute"
                value={configForm.email_attr || 'mail'}
                onChange={(e) => setConfigForm({ ...configForm, email_attr: e.target.value })}
              />
              <Input
                label="Username Attribute"
                value={configForm.username_attr || 'sAMAccountName'}
                onChange={(e) => setConfigForm({ ...configForm, username_attr: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name Attribute"
                value={configForm.first_name_attr || 'givenName'}
                onChange={(e) => setConfigForm({ ...configForm, first_name_attr: e.target.value })}
              />
              <Input
                label="Last Name Attribute"
                value={configForm.last_name_attr || 'sn'}
                onChange={(e) => setConfigForm({ ...configForm, last_name_attr: e.target.value })}
              />
            </div>
            <Input
              label="CA Certificate Path (optional)"
              placeholder="/etc/ssl/certs/company-ca.crt"
              value={configForm.ca_cert_path || ''}
              onChange={(e) => setConfigForm({ ...configForm, ca_cert_path: e.target.value })}
            />
          </div>
        )

      case 'AZURE_AD':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-700">
                Configure Azure AD App Registration settings.
                Get these values from the Azure Portal.
              </p>
            </div>
            <Input
              label="Tenant ID"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={configForm.tenant_id || ''}
              onChange={(e) => setConfigForm({ ...configForm, tenant_id: e.target.value })}
            />
            <Input
              label="Client ID (Application ID)"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={configForm.client_id || ''}
              onChange={(e) => setConfigForm({ ...configForm, client_id: e.target.value })}
            />
            <Input
              label="Client Secret"
              type="password"
              placeholder="••••••••"
              value={configForm.client_secret || ''}
              onChange={(e) => setConfigForm({ ...configForm, client_secret: e.target.value })}
            />
            <Input
              label="Redirect URI"
              placeholder="https://hrms.company.com/auth/azure/callback"
              value={configForm.redirect_uri || ''}
              onChange={(e) => setConfigForm({ ...configForm, redirect_uri: e.target.value })}
            />
          </div>
        )

      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Authentication Providers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure how users can sign in to the system
          </p>
        </div>
        <ShieldCheckIcon className="h-8 w-8 text-gray-400" />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {providers?.map((provider) => {
          const Icon = providerIcons[provider.provider_type]
          const colorClass = providerColors[provider.provider_type]

          return (
            <Card key={provider.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${colorClass}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{provider.name}</CardTitle>
                      <p className="text-sm text-gray-500">{provider.provider_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {provider.is_default && (
                      <Badge variant="success">Default</Badge>
                    )}
                    <Badge variant={provider.is_enabled ? 'success' : 'default'}>
                      {provider.is_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Connection Status */}
                {provider.provider_type !== 'LOCAL' && provider.last_connection_test && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {provider.last_connection_status ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-red-500" />
                      )}
                      <span className="text-sm">
                        {provider.last_connection_status ? 'Connected' : 'Connection failed'}
                      </span>
                    </div>
                    {provider.last_connection_error && (
                      <p className="mt-1 text-xs text-red-600">{provider.last_connection_error}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      Last tested: {new Date(provider.last_connection_test).toLocaleString()}
                    </p>
                  </div>
                )}

                {/* Stats */}
                <div className="mb-4 text-sm text-gray-600">
                  <p>{provider.users_count} users linked</p>
                  {provider.last_sync_at && (
                    <p className="text-xs text-gray-500">
                      Last sync: {new Date(provider.last_sync_at).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Provisioning Settings */}
                <div className="mb-4 space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    {provider.auto_provision_users ? (
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircleIcon className="h-4 w-4 text-gray-400" />
                    )}
                    <span>Auto-provision users</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {provider.auto_link_by_email ? (
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircleIcon className="h-4 w-4 text-gray-400" />
                    )}
                    <span>Link by email</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={provider.is_enabled ? 'outline' : 'primary'}
                    onClick={() => handleToggleEnabled(provider)}
                    disabled={updateMutation.isPending}
                  >
                    {provider.is_enabled ? 'Disable' : 'Enable'}
                  </Button>

                  {!provider.is_default && provider.is_enabled && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetDefault(provider)}
                      disabled={updateMutation.isPending}
                    >
                      Set Default
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenConfig(provider)}
                  >
                    <Cog6ToothIcon className="h-4 w-4 mr-1" />
                    Configure
                  </Button>

                  {provider.provider_type !== 'LOCAL' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testMutation.mutate(provider.id)}
                      disabled={testMutation.isPending}
                    >
                      <ArrowPathIcon className={`h-4 w-4 mr-1 ${testMutation.isPending ? 'animate-spin' : ''}`} />
                      Test
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Configuration Modal */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => {
          setShowConfigModal(false)
          setSelectedProvider(null)
        }}
        title={`Configure ${selectedProvider?.name || 'Provider'}`}
        size="lg"
      >
        <div className="space-y-6">
          {/* Common Settings */}
          <div className="space-y-4">
            <Input
              label="Display Name"
              value={configForm.name || ''}
              onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
            />

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_enabled"
                  checked={configForm.is_enabled ?? false}
                  onChange={(e) => setConfigForm({ ...configForm, is_enabled: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="is_enabled" className="text-sm text-gray-700">
                  Enabled
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_provision_users"
                  checked={configForm.auto_provision_users ?? true}
                  onChange={(e) => setConfigForm({ ...configForm, auto_provision_users: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="auto_provision_users" className="text-sm text-gray-700">
                  Auto-provision users
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_link_by_email"
                  checked={configForm.auto_link_by_email ?? true}
                  onChange={(e) => setConfigForm({ ...configForm, auto_link_by_email: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="auto_link_by_email" className="text-sm text-gray-700">
                  Link by email
                </label>
              </div>
            </div>

            <Input
              label="Allowed Domains (comma-separated, leave empty for all)"
              placeholder="company.com, subsidiary.com"
              value={configForm.allowed_domains || ''}
              onChange={(e) => setConfigForm({ ...configForm, allowed_domains: e.target.value })}
            />
          </div>

          {/* Provider-specific Settings */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-4">
              {selectedProvider?.provider_type} Settings
            </h3>
            {renderConfigFields()}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowConfigModal(false)
                setSelectedProvider(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfig}
              isLoading={updateMutation.isPending}
            >
              Save Configuration
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
