/**
 * Field Setup Configuration
 * Maps form fields to their corresponding setup pages and API endpoints
 */

export interface FieldSetupConfig {
  /** The route to the setup page */
  setupRoute: string
  /** Query parameter for tab selection (if applicable) */
  tabParam?: string
  /** Label for the setup link tooltip */
  setupLabel: string
  /** Query key for React Query */
  queryKey: string
  /** Field to use as option value (typically 'id') */
  valueField: string
  /** Field to use as option label */
  labelField: string
}

export const FIELD_SETUP_CONFIG: Record<string, FieldSetupConfig> = {
  // Organization fields
  department: {
    setupRoute: '/admin/organization',
    tabParam: 'departments',
    setupLabel: 'Manage Departments',
    queryKey: 'departments',
    valueField: 'id',
    labelField: 'name',
  },
  position: {
    setupRoute: '/admin/organization',
    tabParam: 'positions',
    setupLabel: 'Manage Positions',
    queryKey: 'positions',
    valueField: 'id',
    labelField: 'title',
  },
  grade: {
    setupRoute: '/admin/organization',
    tabParam: 'grades',
    setupLabel: 'Manage Grades',
    queryKey: 'grades',
    valueField: 'id',
    labelField: 'name',
  },
  directorate: {
    setupRoute: '/admin/organization',
    tabParam: 'directorates',
    setupLabel: 'Manage Directorates',
    queryKey: 'directorates',
    valueField: 'id',
    labelField: 'name',
  },

  // Payroll setup fields
  bank: {
    setupRoute: '/admin/payroll-setup',
    tabParam: 'banks',
    setupLabel: 'Manage Banks',
    queryKey: 'banks',
    valueField: 'id',
    labelField: 'name',
  },
  bank_branch: {
    setupRoute: '/admin/payroll-setup',
    tabParam: 'branches',
    setupLabel: 'Manage Bank Branches',
    queryKey: 'bankBranches',
    valueField: 'id',
    labelField: 'name',
  },
  staff_category: {
    setupRoute: '/admin/payroll-setup',
    tabParam: 'categories',
    setupLabel: 'Manage Staff Categories',
    queryKey: 'staffCategories',
    valueField: 'id',
    labelField: 'name',
  },
  salary_band: {
    setupRoute: '/admin/payroll-setup',
    tabParam: 'bands',
    setupLabel: 'Manage Salary Bands',
    queryKey: 'salaryBands',
    valueField: 'id',
    labelField: 'name',
  },
  salary_level: {
    setupRoute: '/admin/payroll-setup',
    tabParam: 'levels',
    setupLabel: 'Manage Salary Levels',
    queryKey: 'salaryLevels',
    valueField: 'id',
    labelField: 'name',
  },
  salary_notch: {
    setupRoute: '/admin/payroll-setup',
    tabParam: 'notches',
    setupLabel: 'Manage Salary Notches',
    queryKey: 'salaryNotches',
    valueField: 'id',
    labelField: 'name',
  },

  // Leave management fields
  leave_type: {
    setupRoute: '/admin/leave-types',
    setupLabel: 'Manage Leave Types',
    queryKey: 'leaveTypes',
    valueField: 'id',
    labelField: 'name',
  },

  // Payroll component fields
  payroll_component: {
    setupRoute: '/admin/transaction-types',
    setupLabel: 'Manage Transaction Types',
    queryKey: 'payrollComponents',
    valueField: 'id',
    labelField: 'name',
  },
}

/**
 * Get the full URL for a setup page with tab parameter
 */
export function getSetupUrl(fieldKey: string): string {
  const config = FIELD_SETUP_CONFIG[fieldKey]
  if (!config) return '#'

  if (config.tabParam) {
    return `${config.setupRoute}?tab=${config.tabParam}`
  }
  return config.setupRoute
}

/**
 * Check if a field has setup configuration
 */
export function hasSetupConfig(fieldKey: string): boolean {
  return fieldKey in FIELD_SETUP_CONFIG
}

/**
 * Get setup configuration for a field
 */
export function getFieldSetupConfig(fieldKey: string): FieldSetupConfig | undefined {
  return FIELD_SETUP_CONFIG[fieldKey]
}
