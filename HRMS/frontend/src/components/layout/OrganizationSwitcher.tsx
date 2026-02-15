import { useState, useRef, useEffect } from 'react'
import { ChevronUpDownIcon, BuildingOffice2Icon, CheckIcon } from '@heroicons/react/20/solid'
import { useAuthStore } from '@/features/auth/store'
import api from '@/lib/api'
import toast from 'react-hot-toast'

export default function OrganizationSwitcher() {
  const { user, activeOrganization, setActiveOrganization, setTokens, setUser } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const organizations = user?.organizations || []

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const canSwitch = organizations.length > 1

  async function switchOrg(orgId: string) {
    if (orgId === activeOrganization?.id || switching) return
    setSwitching(true)
    try {
      const res = await api.post('/auth/switch-organization/', { organization_id: orgId })
      const { access, refresh, user: updatedUser } = res.data
      setTokens({ access, refresh })
      setUser(updatedUser)
      setActiveOrganization(updatedUser.active_organization || null)
      setOpen(false)
      toast.success('Organization switched successfully')
      window.location.reload()
    } catch (err: any) {
      const message =
        err.response?.data?.organization_id?.[0] ||
        err.response?.data?.detail ||
        'Failed to switch organization'
      toast.error(message)
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => canSwitch && setOpen(!open)}
        className={`flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors ${canSwitch ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
        disabled={switching}
      >
        {switching ? (
          <svg className="h-4 w-4 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <BuildingOffice2Icon className="h-4 w-4 text-gray-400" />
        )}
        <span className="hidden md:inline max-w-[160px] truncate">
          {activeOrganization?.name || 'Select Organization'}
        </span>
        {canSwitch && <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-64 rounded-md border border-gray-200 bg-white shadow-lg z-50">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Switch Organization</p>
          </div>
          <ul className="max-h-60 overflow-auto py-1">
            {organizations.map((org) => (
              <li key={org.id}>
                <button
                  type="button"
                  onClick={() => switchOrg(org.id)}
                  disabled={switching}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <BuildingOffice2Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <span className="block truncate">{org.name}</span>
                    {org.code && (
                      <span className="block text-xs text-gray-400 truncate">{org.code}</span>
                    )}
                  </div>
                  {org.id === activeOrganization?.id && (
                    <CheckIcon className="h-4 w-4 text-primary-600 flex-shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
