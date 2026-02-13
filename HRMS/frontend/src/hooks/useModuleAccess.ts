import { useMemo } from 'react'
import { useAuthStore } from '@/features/auth/store'
import { hasModuleAccess } from '@/lib/roles'

/**
 * Hook that determines module access for the current user.
 * Returns a `canAccess(moduleCode)` function.
 *
 * Access granted if:
 *   1. User is staff/superuser (bypass), OR
 *   2. Any of the user's roles includes the module in its `modules` list
 */
export function useModuleAccess() {
  const { user } = useAuthStore()

  const isStaffOrSuper = user?.is_staff || user?.is_superuser || false
  const isSuperuser = user?.is_superuser === true

  const userRoleObjects = useMemo(() => {
    if (!user || !Array.isArray(user.roles)) return []
    return user.roles.map((r: any) => ({
      code: typeof r === 'string' ? r : (r?.code || r?.role_code || ''),
      modules: r?.modules || [],
    }))
  }, [user])

  const canAccess = useMemo(() => {
    if (isStaffOrSuper) return (_moduleCode: string) => true
    return (moduleCode: string) => hasModuleAccess(userRoleObjects, moduleCode)
  }, [isStaffOrSuper, userRoleObjects])

  return { canAccess, isStaffOrSuper, isSuperuser }
}
