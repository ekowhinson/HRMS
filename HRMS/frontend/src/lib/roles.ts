/**
 * Centralized role definitions for access control.
 * Single source of truth — update here when new roles are added.
 */

/** Roles that grant access to HR features (employees, leave, organization, HR reports) */
export const HR_ROLES = [
  'HR', 'HR_ADMIN', 'HR_MANAGER', 'HR_OFFICER', 'HR_DIRECTOR',
  'ADMIN', 'SUPERUSER', 'ORG_ADMIN', 'SUPER_ADMIN',
] as const

/** Roles that grant access to Payroll features (payroll processing, reports, setup) */
export const PAYROLL_ROLES = [
  'PAYROLL_ADMIN', 'PAYROLL_MANAGER', 'PAYROLL_OFFICER', 'PAYROLL_DATA_ENTRY',
  'ADMIN', 'SUPERUSER', 'SUPER_ADMIN',
] as const

/** Roles that grant access to Finance features (chart of accounts, journal entries, reports) */
export const FINANCE_ROLES = [
  'ACCOUNTANT', 'AP_CLERK', 'BUDGET_OFFICER', 'CFO',
  'FINANCE_DIRECTOR', 'FINANCE_MANAGER',
  'ADMIN', 'SUPERUSER', 'SUPER_ADMIN',
] as const

/** Roles that grant access to Procurement features */
export const PROCUREMENT_ROLES = [
  'PROCUREMENT_MANAGER', 'PROCUREMENT_OFFICER',
  'ADMIN', 'SUPERUSER', 'SUPER_ADMIN',
] as const

/** Roles that grant access to Inventory & Assets features */
export const INVENTORY_ROLES = [
  'STORES_MANAGER', 'STORES_OFFICER', 'ASSET_MANAGER',
  'ADMIN', 'SUPERUSER', 'SUPER_ADMIN',
] as const

/** Roles that grant access to Projects features */
export const PROJECT_ROLES = [
  'PROJECT_MANAGER',
  'ADMIN', 'SUPERUSER', 'SUPER_ADMIN',
] as const

/** Roles that grant access to Manufacturing features */
export const MANUFACTURING_ROLES = [
  'MANUFACTURING_MANAGER', 'PRODUCTION_SUPERVISOR', 'QUALITY_INSPECTOR',
  'ADMIN', 'SUPERUSER', 'SUPER_ADMIN',
] as const

/** Roles that grant access to system administration (user management, settings, audit logs) */
export const SYSTEM_ADMIN_ROLES = [
  'ADMIN', 'SUPERUSER', 'SUPER_ADMIN', 'ORG_ADMIN',
] as const

/** Helper: check if any user role matches a role list */
export function hasRole(userRoles: string[], allowedRoles: readonly string[]): boolean {
  return userRoles.some((role) => allowedRoles.includes(role))
}
