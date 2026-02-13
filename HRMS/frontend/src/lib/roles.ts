/**
 * Centralized role & module definitions for access control.
 * Single source of truth — update MODULE_DEFINITIONS here when new modules are added.
 */

// ==================== Legacy role lists (kept for backward compatibility) ====================

/** Roles that grant access to HR features (employees, leave, organization, HR reports) */
export const HR_ROLES = [
  'HR', 'HR_ADMIN', 'HR_MANAGER', 'HR_OFFICER', 'HR_DIRECTOR',
  'ADMIN', 'SUPERUSER', 'ORG_ADMIN', 'SUPER_ADMIN',
] as const

/** Roles that grant access to Payroll features (processing, reports, transactions) */
export const PAYROLL_ROLES = [
  'PAYROLL_ADMIN', 'PAYROLL_MANAGER', 'PAYROLL_OFFICER', 'PAYROLL_DATA_ENTRY',
  'ADMIN', 'SUPERUSER', 'SUPER_ADMIN',
] as const

/** Roles that grant access to Payroll setup (periods, banks, salary structure, tax config) */
export const PAYROLL_SETUP_ROLES = [
  'PAYROLL_ADMIN', 'PAYROLL_MANAGER',
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

// ==================== Module-based access (new, data-driven) ====================

/** Single source of truth for available modules (OCP — extend here only) */
export interface ModuleDefinition {
  code: string
  label: string
  description: string
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  { code: 'hr', label: 'HR', description: 'Employees, leave, organization, recruitment, performance, training' },
  { code: 'payroll', label: 'Payroll', description: 'Payroll processing, transactions, reports' },
  { code: 'payroll_setup', label: 'Payroll Setup', description: 'Period setup, banks, salary structure, tax config' },
  { code: 'finance', label: 'Finance', description: 'Chart of accounts, journal entries, budgets, reports' },
  { code: 'procurement', label: 'Procurement', description: 'Requisitions, purchase orders, goods receipt' },
  { code: 'inventory', label: 'Inventory & Assets', description: 'Items, stock, warehouses, fixed assets' },
  { code: 'projects', label: 'Projects', description: 'Projects, timesheets, resources' },
  { code: 'manufacturing', label: 'Manufacturing', description: 'Production, BOM, work orders, quality control' },
  { code: 'administration', label: 'Administration', description: 'User management, roles, audit logs, workflows' },
]

/** Check if any of the user's roles grant access to a specific module */
export function hasModuleAccess(
  userRoles: Array<{ modules?: string[] }>,
  moduleCode: string
): boolean {
  return userRoles.some((role) => role.modules?.includes(moduleCode))
}
