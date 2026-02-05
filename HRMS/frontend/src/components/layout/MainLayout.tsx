import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  HomeIcon,
  UsersIcon,
  CalendarIcon,
  BanknotesIcon,
  GiftIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  BuildingOfficeIcon,
  ClipboardDocumentCheckIcon,
  CalculatorIcon,
  CreditCardIcon,
  CurrencyDollarIcon,
  DocumentPlusIcon,
  DocumentArrowUpIcon,
  AdjustmentsHorizontalIcon,
  WrenchScrewdriverIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  UserCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/features/auth/store'
import Avatar from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  name: string
  icon: React.ComponentType<{ className?: string }>
  items: NavItem[]
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Employees', href: '/employees', icon: UsersIcon },
  { name: 'Leave', href: '/leave', icon: CalendarIcon },
  { name: 'Payroll', href: '/payroll', icon: BanknotesIcon },
  { name: 'Benefits', href: '/benefits', icon: GiftIcon },
  { name: 'Reports', href: '/reports', icon: ChartBarIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
]

const selfServiceNavigation: NavItem[] = [
  { name: 'My Profile', href: '/my-profile', icon: UserCircleIcon },
  { name: 'My Leave', href: '/my-leave', icon: ClockIcon },
]

const adminNavigation: NavItem[] = [
  { name: 'Leave Approvals', href: '/admin/leave-approvals', icon: ClipboardDocumentCheckIcon },
  { name: 'Loan Management', href: '/admin/loans', icon: CreditCardIcon },
  { name: 'Process Payroll', href: '/admin/payroll', icon: CalculatorIcon },
  { name: 'Employee Transactions', href: '/admin/employee-transactions', icon: DocumentPlusIcon },
  { name: 'Data Import', href: '/admin/data-import', icon: DocumentArrowUpIcon },
]

const setupSections: NavSection[] = [
  {
    name: 'Payroll Setup',
    icon: BanknotesIcon,
    items: [
      { name: 'Banks', href: '/admin/payroll-setup?tab=banks', icon: BuildingOfficeIcon },
      { name: 'Bank Branches', href: '/admin/payroll-setup?tab=branches', icon: BuildingOfficeIcon },
      { name: 'Staff Categories', href: '/admin/payroll-setup?tab=categories', icon: UserGroupIcon },
      { name: 'Salary Bands', href: '/admin/payroll-setup?tab=bands', icon: BanknotesIcon },
      { name: 'Salary Levels', href: '/admin/payroll-setup?tab=levels', icon: BanknotesIcon },
      { name: 'Salary Notches', href: '/admin/payroll-setup?tab=notches', icon: BanknotesIcon },
      { name: 'Transaction Types', href: '/admin/transaction-types', icon: CurrencyDollarIcon },
      { name: 'Tax Configuration', href: '/admin/tax-configuration', icon: AdjustmentsHorizontalIcon },
    ],
  },
  {
    name: 'HR Setup',
    icon: UserGroupIcon,
    items: [
      { name: 'Divisions', href: '/admin/organization?tab=divisions', icon: BuildingOfficeIcon },
      { name: 'Directorates', href: '/admin/organization?tab=directorates', icon: BuildingOfficeIcon },
      { name: 'Departments', href: '/admin/organization?tab=departments', icon: BuildingOfficeIcon },
      { name: 'Job Positions', href: '/admin/organization?tab=positions', icon: UserGroupIcon },
      { name: 'Job Grades', href: '/admin/organization?tab=grades', icon: UserGroupIcon },
      { name: 'Leave Types', href: '/admin/leave-types', icon: CalendarDaysIcon },
      { name: 'Leave Plan Calendar', href: '/admin/leave-calendar', icon: CalendarIcon },
    ],
  },
]

interface MainLayoutProps {
  children: React.ReactNode
}

function NavLink({
  item,
  isActive,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  onClick?: () => void
}) {
  return (
    <Link
      to={item.href}
      className={cn(
        'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
        isActive
          ? 'bg-primary-50 text-primary-700'
          : 'text-gray-700 hover:bg-gray-100'
      )}
      onClick={onClick}
    >
      <item.icon className="mr-3 h-5 w-5" />
      {item.name}
    </Link>
  )
}

function SubNavLink({
  item,
  isActive,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  onClick?: () => void
}) {
  return (
    <Link
      to={item.href}
      className={cn(
        'flex items-center pl-10 pr-3 py-2 text-sm font-medium rounded-lg transition-colors',
        isActive
          ? 'bg-primary-50 text-primary-700'
          : 'text-gray-600 hover:bg-gray-100'
      )}
      onClick={onClick}
    >
      <item.icon className="mr-3 h-4 w-4" />
      {item.name}
    </Link>
  )
}

function CollapsibleSection({
  section,
  isOpen,
  onToggle,
  location,
  onLinkClick,
}: {
  section: NavSection
  isOpen: boolean
  onToggle: () => void
  location: { pathname: string }
  onLinkClick?: () => void
}) {
  const hasActiveItem = section.items.some((item) =>
    location.pathname.startsWith(item.href)
  )

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors',
          hasActiveItem
            ? 'bg-primary-50/50 text-primary-700'
            : 'text-gray-700 hover:bg-gray-100'
        )}
      >
        <div className="flex items-center">
          <section.icon className="mr-3 h-5 w-5" />
          {section.name}
        </div>
        {isOpen ? (
          <ChevronDownIcon className="h-4 w-4" />
        ) : (
          <ChevronRightIcon className="h-4 w-4" />
        )}
      </button>
      {isOpen && (
        <div className="mt-1 space-y-1">
          {section.items.map((item) => (
            <SubNavLink
              key={item.name}
              item={item}
              isActive={location.pathname.startsWith(item.href)}
              onClick={onLinkClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Roles that grant access to HR/Admin features
const HR_ADMIN_ROLES = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN', 'SUPERUSER']

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'Payroll Setup': true,
    'HR Setup': true,
  })
  const location = useLocation()
  const { user, logout } = useAuthStore()

  // Check if user has HR/Admin access
  const userRoles = user?.roles?.map((r: any) => r.code || r.name || r) || []
  const isHROrAdmin = user?.is_staff || user?.is_superuser ||
    userRoles.some((role: string) => HR_ADMIN_ROLES.includes(role.toUpperCase()))

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  const toggleSection = (sectionName: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }))
  }

  const SidebarContent = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <>
      {/* Self-Service Section - Always visible */}
      <div className="mb-4">
        <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Self Service
        </p>
        <div className="space-y-1">
          {selfServiceNavigation.map((item) => (
            <NavLink
              key={item.name}
              item={item}
              isActive={location.pathname.startsWith(item.href)}
              onClick={onLinkClick}
            />
          ))}
        </div>
      </div>

      {/* HR Management - Only for HR/Admin users */}
      {isHROrAdmin && (
        <div className="pt-4 border-t">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            HR Management
          </p>
          <div className="space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                item={item}
                isActive={location.pathname.startsWith(item.href)}
                onClick={onLinkClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Admin Section - Only for HR/Admin users */}
      {isHROrAdmin && (
        <div className="pt-4 mt-4 border-t">
          <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Administration
          </p>
          <div className="mt-2 space-y-1">
            {adminNavigation.map((item) => (
              <NavLink
                key={item.name}
                item={item}
                isActive={location.pathname.startsWith(item.href)}
                onClick={onLinkClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Setup Section - Only for HR/Admin users */}
      {isHROrAdmin && (
        <div className="pt-4 mt-4 border-t">
          <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <WrenchScrewdriverIcon className="h-3.5 w-3.5" />
            Setup
          </p>
          <div className="mt-2 space-y-1">
            {setupSections.map((section) => (
              <CollapsibleSection
                key={section.name}
                section={section}
                isOpen={openSections[section.name] ?? false}
                onToggle={() => toggleSection(section.name)}
                location={location}
                onLinkClick={onLinkClick}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          sidebarOpen ? 'block' : 'hidden'
        )}
      >
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex-shrink-0 flex h-16 items-center justify-between px-4 border-b">
            <span className="text-xl font-bold text-primary-600">NHIA HRMS</span>
            <button onClick={() => setSidebarOpen(false)}>
              <XMarkIcon className="h-6 w-6 text-gray-500" />
            </button>
          </div>
          <nav className="flex-1 min-h-0 px-2 py-4 space-y-1 overflow-y-auto scrollbar-thin">
            <SidebarContent onLinkClick={() => setSidebarOpen(false)} />
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col h-full bg-white border-r overflow-hidden">
          <div className="flex-shrink-0 flex h-16 items-center px-6 border-b">
            <span className="text-xl font-bold text-primary-600">NHIA HRMS</span>
          </div>
          <nav className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
            <SidebarContent />
          </nav>
          <div className="flex-shrink-0 border-t p-4">
            <div className="flex items-center">
              <Avatar
                firstName={user?.first_name}
                lastName={user?.last_name}
                size="sm"
              />
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                title="Logout"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b bg-white px-4 lg:px-8">
          <button
            type="button"
            className="lg:hidden -m-2.5 p-2.5 text-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <div className="flex flex-1 justify-end gap-x-4">
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Add notification bell, search, etc. here */}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
