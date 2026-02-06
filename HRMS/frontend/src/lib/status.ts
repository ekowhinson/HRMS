// Centralized Status Configuration
// Consolidates status color logic from across the application

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';

export type StatusCategory = 'employment' | 'leave' | 'payroll' | 'loan' | 'general';

// Status configuration by category
export const STATUS_CONFIG: Record<StatusCategory, Record<string, StatusVariant>> = {
  employment: {
    ACTIVE: 'success',
    CONFIRMED: 'success',
    PROBATION: 'warning',
    ON_LEAVE: 'info',
    SUSPENDED: 'danger',
    TERMINATED: 'danger',
    RESIGNED: 'danger',
    RETIRED: 'info',
    PENDING: 'warning',
  },
  leave: {
    APPROVED: 'success',
    PENDING: 'warning',
    REJECTED: 'danger',
    CANCELLED: 'danger',
    IN_PROGRESS: 'info',
    COMPLETED: 'success',
    SCHEDULED: 'info',
  },
  payroll: {
    PAID: 'success',
    PROCESSING: 'info',
    PENDING: 'warning',
    DRAFT: 'default',
    FAILED: 'danger',
    CANCELLED: 'danger',
    COMPLETED: 'success',
  },
  loan: {
    ACTIVE: 'info',
    APPROVED: 'success',
    PENDING: 'warning',
    REJECTED: 'danger',
    COMPLETED: 'success',
    DEFAULTED: 'danger',
    CANCELLED: 'danger',
  },
  general: {
    ACTIVE: 'success',
    APPROVED: 'success',
    PAID: 'success',
    COMPLETED: 'success',
    CONFIRMED: 'success',
    PENDING: 'warning',
    DRAFT: 'default',
    IN_PROGRESS: 'info',
    PROCESSING: 'info',
    ON_LEAVE: 'info',
    PROBATION: 'warning',
    REJECTED: 'danger',
    CANCELLED: 'danger',
    SUSPENDED: 'danger',
    TERMINATED: 'danger',
    FAILED: 'danger',
  },
};

// Color configuration for each variant
export const VARIANT_COLORS = {
  success: {
    bg: 'bg-success-100',
    text: 'text-success-700',
    border: 'border-success-200',
    dot: 'bg-success-500',
    gradient: 'from-success-50 to-success-100',
  },
  warning: {
    bg: 'bg-warning-100',
    text: 'text-warning-700',
    border: 'border-warning-200',
    dot: 'bg-warning-500',
    gradient: 'from-warning-50 to-warning-100',
  },
  danger: {
    bg: 'bg-danger-100',
    text: 'text-danger-700',
    border: 'border-danger-200',
    dot: 'bg-danger-500',
    gradient: 'from-danger-50 to-danger-100',
  },
  info: {
    bg: 'bg-info-100',
    text: 'text-info-700',
    border: 'border-info-200',
    dot: 'bg-info-500',
    gradient: 'from-info-50 to-info-100',
  },
  default: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-200',
    dot: 'bg-gray-500',
    gradient: 'from-gray-50 to-gray-100',
  },
} as const;

/**
 * Get the status variant for a given status string
 * @param status - The status string (e.g., 'ACTIVE', 'PENDING')
 * @param category - Optional category to narrow down the status context
 */
export function getStatusVariant(
  status: string,
  category: StatusCategory = 'general'
): StatusVariant {
  const normalizedStatus = status?.toUpperCase().replace(/\s+/g, '_');

  // First try the specific category
  if (STATUS_CONFIG[category]?.[normalizedStatus]) {
    return STATUS_CONFIG[category][normalizedStatus];
  }

  // Fall back to general category
  if (STATUS_CONFIG.general[normalizedStatus]) {
    return STATUS_CONFIG.general[normalizedStatus];
  }

  // Default
  return 'default';
}

/**
 * Get color classes for a status
 * @param status - The status string
 * @param category - Optional category
 */
export function getStatusColors(
  status: string,
  category: StatusCategory = 'general'
): typeof VARIANT_COLORS[StatusVariant] {
  const variant = getStatusVariant(status, category);
  return VARIANT_COLORS[variant];
}

/**
 * Get combined class string for a badge-style status display
 * @param status - The status string
 * @param category - Optional category
 */
export function getStatusBadgeClasses(
  status: string,
  category: StatusCategory = 'general'
): string {
  const colors = getStatusColors(status, category);
  return `${colors.bg} ${colors.text}`;
}

/**
 * Format a status string for display
 * @param status - The status string
 */
export function formatStatus(status: string): string {
  if (!status) return '';
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Check if a status is considered "active" or positive
 */
export function isActiveStatus(status: string, category: StatusCategory = 'general'): boolean {
  const variant = getStatusVariant(status, category);
  return variant === 'success';
}

/**
 * Check if a status requires attention
 */
export function requiresAttention(status: string, category: StatusCategory = 'general'): boolean {
  const variant = getStatusVariant(status, category);
  return variant === 'warning' || variant === 'danger';
}

// Export individual status groups for specific use cases
export const EMPLOYMENT_STATUSES = Object.keys(STATUS_CONFIG.employment);
export const LEAVE_STATUSES = Object.keys(STATUS_CONFIG.leave);
export const PAYROLL_STATUSES = Object.keys(STATUS_CONFIG.payroll);
export const LOAN_STATUSES = Object.keys(STATUS_CONFIG.loan);
