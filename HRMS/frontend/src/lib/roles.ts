/**
 * Centralized role definitions for access control.
 * Single source of truth — update here when new roles are added.
 */

/** Roles that grant access to HR/Admin features (employees, leave, organization, HR reports) */
export const HR_ROLES = [
  'HR', 'HR_ADMIN', 'HR_MANAGER', 'HR_OFFICER', 'HR_DIRECTOR',
  'ADMIN', 'SUPERUSER',
] as const

/** Roles that grant access to Payroll features (payroll processing, reports, setup) */
export const PAYROLL_ROLES = [
  'PAYROLL_ADMIN', 'PAYROLL_MANAGER', 'PAYROLL_OFFICER', 'PAYROLL_DATA_ENTRY',
  'ADMIN', 'SUPERUSER',
] as const

/** Roles that grant access to system administration (user management, settings, audit logs) */
export const SYSTEM_ADMIN_ROLES = [
  'ADMIN', 'SUPERUSER',
] as const
