import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(amount: number, currency = 'GHS'): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

export function formatDate(date: string | Date, format: 'short' | 'long' = 'short'): string {
  const d = new Date(date)
  if (format === 'long') {
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }
  return d.toLocaleDateString('en-GB')
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-GH').format(num)
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    APPROVED: 'bg-green-100 text-green-800',
    PAID: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    DRAFT: 'bg-gray-100 text-gray-800',
    REJECTED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-red-100 text-red-800',
    SUSPENDED: 'bg-orange-100 text-orange-800',
    ON_LEAVE: 'bg-blue-100 text-blue-800',
    PROBATION: 'bg-purple-100 text-purple-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}
