import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  ChevronRightIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  UserCircleIcon,
  ClockIcon,
  BellIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  StarIcon,
  AcademicCapIcon,
  ShieldCheckIcon,
  ScaleIcon,
  FlagIcon,
  DocumentTextIcon,
  ArrowRightStartOnRectangleIcon,
  BriefcaseIcon,
  MegaphoneIcon,
  KeyIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store';
import Avatar from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { CountBadge } from '@/components/ui/Badge';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavSection {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

// Self-Service Navigation - Available to all users
const selfServiceNavigation: NavItem[] = [
  { name: 'My Profile', href: '/my-profile', icon: UserCircleIcon },
  { name: 'My Leave', href: '/my-leave', icon: ClockIcon },
  { name: 'Leave Planning', href: '/my-leave/planning', icon: CalendarDaysIcon },
  { name: 'Data Updates', href: '/my-data-updates', icon: DocumentPlusIcon },
  { name: 'Service Requests', href: '/my-service-requests', icon: ClipboardDocumentCheckIcon },
  { name: 'My Appraisal', href: '/my-appraisal', icon: ChartBarIcon },
];

// HR Section - Top level items
const hrNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Employees', href: '/employees', icon: UsersIcon },
  { name: 'Leave Management', href: '/leave', icon: CalendarIcon },
  { name: 'Leave Approvals', href: '/admin/leave-approvals', icon: ClipboardDocumentCheckIcon },
  { name: 'Recruitment', href: '/admin/recruitment', icon: BriefcaseIcon },
  { name: 'Exit Management', href: '/admin/exits', icon: ArrowRightStartOnRectangleIcon },
  { name: 'Appraisals', href: '/admin/appraisals', icon: FlagIcon },
];

// HR Section - Collapsible sub-sections
const hrSections: NavSection[] = [
  {
    name: 'Organization',
    icon: BuildingOfficeIcon,
    items: [
      { name: 'Divisions', href: '/admin/organization?tab=divisions', icon: BuildingOfficeIcon },
      { name: 'Directorates', href: '/admin/organization?tab=directorates', icon: BuildingOfficeIcon },
      { name: 'Departments', href: '/admin/organization?tab=departments', icon: BuildingOfficeIcon },
      { name: 'Job Positions', href: '/admin/organization?tab=positions', icon: UserGroupIcon },
      { name: 'Job Grades', href: '/admin/organization?tab=grades', icon: UserGroupIcon },
    ],
  },
  {
    name: 'Leave Setup',
    icon: CalendarDaysIcon,
    items: [
      { name: 'Leave Types', href: '/admin/leave-types', icon: CalendarDaysIcon },
      { name: 'Leave Plan Calendar', href: '/admin/leave-calendar', icon: CalendarIcon },
    ],
  },
  {
    name: 'Performance',
    icon: ChartBarIcon,
    items: [
      { name: 'Appraisal Cycles', href: '/admin/appraisal-cycles', icon: CalendarDaysIcon },
      { name: 'Competencies', href: '/admin/competencies', icon: AcademicCapIcon },
      { name: 'Core Values', href: '/admin/core-values', icon: StarIcon },
      { name: 'Probation Assessments', href: '/admin/probation-assessments', icon: ShieldCheckIcon },
      { name: 'Training Needs', href: '/admin/training-needs', icon: AcademicCapIcon },
      { name: 'Performance Appeals', href: '/admin/performance-appeals', icon: ScaleIcon },
    ],
  },
];

// Payroll Section - Top level items
const payrollNavigation: NavItem[] = [
  { name: 'Payroll Overview', href: '/payroll', icon: BanknotesIcon },
  { name: 'Process Payroll', href: '/admin/payroll', icon: CalculatorIcon },
  { name: 'Employee Transactions', href: '/admin/employee-transactions', icon: DocumentPlusIcon },
  { name: 'Benefits', href: '/benefits', icon: GiftIcon },
  { name: 'Loan Management', href: '/admin/loans', icon: CreditCardIcon },
  { name: 'Reports', href: '/reports', icon: ChartBarIcon },
];

// Payroll Section - Collapsible sub-sections
const payrollSections: NavSection[] = [
  {
    name: 'Payroll Setup',
    icon: WrenchScrewdriverIcon,
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
    name: 'Payroll Reports',
    icon: ChartBarIcon,
    items: [
      { name: 'All Reports', href: '/reports', icon: ChartBarIcon },
      { name: 'Payroll Journal', href: '/reports/journal', icon: DocumentTextIcon },
      { name: 'Salary Reconciliation', href: '/reports/salary-reconciliation', icon: ScaleIcon },
      { name: 'Period Reconciliation', href: '/reports/reconciliation', icon: ScaleIcon },
      { name: 'Payroll Master', href: '/reports/payroll-master', icon: DocumentTextIcon },
    ],
  },
];

// Administration Section - Top level items
const adminNavigation: NavItem[] = [
  { name: 'Company Policies', href: '/admin/policies', icon: DocumentTextIcon },
  { name: 'Announcements', href: '/admin/announcements', icon: MegaphoneIcon },
  { name: 'Data Import', href: '/admin/data-import', icon: DocumentArrowUpIcon },
  { name: 'Data Analyzer', href: '/admin/data-analyzer', icon: SparklesIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

// Administration Section - Collapsible sub-sections
const adminSections: NavSection[] = [
  {
    name: 'Security',
    icon: LockClosedIcon,
    items: [
      { name: 'User Management', href: '/admin/users', icon: UsersIcon },
      { name: 'Roles & Permissions', href: '/admin/roles', icon: KeyIcon },
      { name: 'Auth Providers', href: '/admin/auth-providers', icon: ShieldCheckIcon },
    ],
  },
];

interface MainLayoutProps {
  children: React.ReactNode;
}

// Stunning HRMS Logo Component with gradient
function HRMSLogo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-xl blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 via-cyan-500 to-purple-500 flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-sm">HR</span>
        </div>
      </div>
      {!collapsed && (
        <div className="flex flex-col">
          <span className="text-lg font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            HRMS
          </span>
          <span className="text-[10px] text-gray-400 -mt-1 tracking-wider uppercase">
            Management
          </span>
        </div>
      )}
    </div>
  );
}

function NavLink({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={item.href}
      className={cn(
        'group relative flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-300',
        isActive
          ? 'text-white'
          : 'text-gray-400 hover:text-white'
      )}
      onClick={onClick}
    >
      {/* Active background with gradient */}
      {isActive && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-purple-500/20 border border-white/10" />
      )}
      {/* Hover background */}
      <div className={cn(
        'absolute inset-0 rounded-xl bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity',
        isActive && 'hidden'
      )} />

      <item.icon
        className={cn(
          'relative mr-3 h-5 w-5 flex-shrink-0 transition-all duration-300',
          isActive
            ? 'text-emerald-400'
            : 'text-gray-500 group-hover:text-emerald-400'
        )}
      />
      <span className="relative flex-1">{item.name}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <CountBadge count={item.badge} variant="warning" />
      )}
      {/* Active indicator */}
      {isActive && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-emerald-400 to-cyan-400 rounded-l-full" />
      )}
    </Link>
  );
}

function SubNavLink({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={item.href}
      className={cn(
        'group flex items-center pl-11 pr-3 py-2 text-sm font-medium rounded-lg transition-all duration-200',
        isActive
          ? 'text-emerald-400 bg-white/5'
          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
      )}
      onClick={onClick}
    >
      <item.icon
        className={cn(
          'mr-3 h-4 w-4 flex-shrink-0 transition-colors',
          isActive ? 'text-emerald-400' : 'text-gray-600 group-hover:text-gray-400'
        )}
      />
      {item.name}
    </Link>
  );
}

function SectionDivider({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-6 pb-2">
      {icon && <span className="text-gray-600">{icon}</span>}
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-gray-700 to-transparent" />
    </div>
  );
}

function CollapsibleSection({
  section,
  isOpen,
  onToggle,
  location,
  onLinkClick,
}: {
  section: NavSection;
  isOpen: boolean;
  onToggle: () => void;
  location: { pathname: string };
  onLinkClick?: () => void;
}) {
  const hasActiveItem = section.items.some((item) =>
    location.pathname.startsWith(item.href.split('?')[0])
  );

  return (
    <div className="space-y-1">
      <button
        onClick={onToggle}
        className={cn(
          'group flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200',
          hasActiveItem
            ? 'text-emerald-400 bg-white/5'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
        )}
      >
        <div className="flex items-center">
          <section.icon
            className={cn(
              'mr-3 h-5 w-5 transition-colors',
              hasActiveItem ? 'text-emerald-400' : 'text-gray-500 group-hover:text-emerald-400'
            )}
          />
          {section.name}
        </div>
        <span
          className={cn(
            'transition-transform duration-200',
            isOpen && 'rotate-90'
          )}
        >
          <ChevronRightIcon className="h-4 w-4 text-gray-500" />
        </span>
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="space-y-0.5 pb-1">
          {section.items.map((item) => (
            <SubNavLink
              key={item.name}
              item={item}
              isActive={location.pathname.startsWith(item.href.split('?')[0])}
              onClick={onLinkClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Roles that grant access to HR/Admin features
const HR_ADMIN_ROLES = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN', 'SUPERUSER'];

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();

  // Combine all collapsible sections for easier lookup
  const allSections = useMemo(() => [...hrSections, ...payrollSections, ...adminSections], []);

  // Determine which sections should be open based on current path
  const getInitialOpenSections = useMemo(() => {
    const sections: Record<string, boolean> = {};
    allSections.forEach((section) => {
      const hasActiveItem = section.items.some((item) =>
        location.pathname.startsWith(item.href.split('?')[0])
      );
      sections[section.name] = hasActiveItem;
    });
    return sections;
  }, [location.pathname, allSections]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(getInitialOpenSections);

  // Update open sections when path changes
  useEffect(() => {
    setOpenSections((prev) => {
      const updated = { ...prev };
      allSections.forEach((section) => {
        const hasActiveItem = section.items.some((item) =>
          location.pathname.startsWith(item.href.split('?')[0])
        );
        if (hasActiveItem) {
          updated[section.name] = true;
        }
      });
      return updated;
    });
  }, [location.pathname, allSections]);

  // Check if user has HR/Admin access
  const isHROrAdmin = (() => {
    if (!user) return false
    if (user.is_staff || user.is_superuser) return true

    const userRoles: string[] = []
    if (Array.isArray(user.roles)) {
      user.roles.forEach((r: any) => {
        const roleStr = typeof r === 'string' ? r : (r?.code || r?.name || '')
        if (typeof roleStr === 'string' && roleStr) {
          userRoles.push(roleStr.toUpperCase())
        }
      })
    }
    return userRoles.some((role) => HR_ADMIN_ROLES.includes(role))
  })();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const toggleSection = (sectionName: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  const SidebarContent = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {/* Self-Service Section - Always visible */}
        <SectionDivider label="Self Service" />
        <div className="px-2 space-y-0.5">
          {selfServiceNavigation.map((item) => (
            <NavLink
              key={item.name}
              item={item}
              isActive={location.pathname.startsWith(item.href)}
              onClick={onLinkClick}
            />
          ))}
        </div>

        {/* HR Section - Only for HR/Admin users */}
        {isHROrAdmin && (
          <>
            <SectionDivider label="HR" icon={<UsersIcon className="h-3.5 w-3.5" />} />
            <div className="px-2 space-y-0.5">
              {hrNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  item={item}
                  isActive={location.pathname === item.href ||
                    (item.href !== '/dashboard' && location.pathname.startsWith(item.href))}
                  onClick={onLinkClick}
                />
              ))}
              {hrSections.map((section) => (
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
          </>
        )}

        {/* Payroll Section - Only for HR/Admin users */}
        {isHROrAdmin && (
          <>
            <SectionDivider label="Payroll" icon={<BanknotesIcon className="h-3.5 w-3.5" />} />
            <div className="px-2 space-y-0.5">
              {payrollNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  item={item}
                  isActive={location.pathname === item.href ||
                    (item.href !== '/payroll' && location.pathname.startsWith(item.href))}
                  onClick={onLinkClick}
                />
              ))}
              {payrollSections.map((section) => (
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
          </>
        )}

        {/* Administration Section - Only for HR/Admin users */}
        {isHROrAdmin && (
          <>
            <SectionDivider label="Administration" icon={<Cog6ToothIcon className="h-3.5 w-3.5" />} />
            <div className="px-2 space-y-0.5">
              {adminNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  item={item}
                  isActive={location.pathname.startsWith(item.href)}
                  onClick={onLinkClick}
                />
              ))}
              {adminSections.map((section) => (
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
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
      {/* Mobile sidebar */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden transition-opacity duration-300',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <div
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
        <div
          className={cn(
            'fixed inset-y-0 left-0 flex w-72 flex-col transition-transform duration-300',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Sidebar gradient background */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800" />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-purple-500/5" />

          <div className="relative flex-shrink-0 flex h-16 items-center justify-between px-4 border-b border-white/10">
            <HRMSLogo />
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <nav className="relative flex-1 min-h-0">
            <SidebarContent onLinkClick={() => setSidebarOpen(false)} />
          </nav>
          {/* Mobile user section */}
          <div className="relative flex-shrink-0 border-t border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full blur opacity-50" />
                <Avatar firstName={user?.first_name} lastName={user?.last_name} size="sm" className="relative" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Logout"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        {/* Sidebar gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800" />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-purple-500/5" />

        {/* Decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl" />

        <div className="relative flex flex-col h-full">
          <div className="flex-shrink-0 flex h-16 items-center px-5 border-b border-white/10">
            <HRMSLogo />
          </div>
          <nav className="flex-1 min-h-0">
            <SidebarContent />
          </nav>
          <div className="flex-shrink-0 border-t border-white/10 p-4">
            <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full blur opacity-50" />
                <Avatar firstName={user?.first_name} lastName={user?.last_name} size="sm" className="relative" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
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
        {/* Top bar with glassmorphism */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-gray-200/50 bg-white/70 backdrop-blur-xl px-4 lg:px-8">
          <button
            type="button"
            className="lg:hidden -m-2 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          {/* Search with modern styling */}
          <div className="hidden sm:flex flex-1 max-w-md">
            <div className="relative w-full group">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
              <input
                type="search"
                placeholder="Search employees, records..."
                className="relative w-full pl-10 pr-4 py-2.5 text-sm bg-gray-100/80 border-0 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/50 focus:shadow-lg transition-all"
              />
            </div>
          </div>

          <div className="flex flex-1 justify-end gap-2">
            {/* Notification button with glow */}
            <button className="relative p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all group">
              <BellIcon className="h-5 w-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-full">
                <span className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
              </span>
            </button>

            {/* Mobile avatar */}
            <div className="lg:hidden">
              <Avatar firstName={user?.first_name} lastName={user?.last_name} size="sm" />
            </div>
          </div>
        </header>

        {/* Page content with subtle gradient background */}
        <main className="p-4 lg:p-8 min-h-[calc(100vh-4rem)]">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
