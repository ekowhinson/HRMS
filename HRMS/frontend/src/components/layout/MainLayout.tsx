import { useState } from 'react';
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
    ],
  },
];

interface MainLayoutProps {
  children: React.ReactNode;
}

// HRMS Logo Component
function HRMSLogo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-primary">
        <span className="text-white font-bold text-sm">HR</span>
      </div>
      {!collapsed && (
        <div className="flex flex-col">
          <span className="text-lg font-bold text-gray-900">HRMS</span>
          <span className="text-[10px] text-gray-500 -mt-1 tracking-wide">HR Management</span>
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
        'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
        isActive
          ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-600 pl-2.5'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      )}
      onClick={onClick}
    >
      <item.icon
        className={cn(
          'mr-3 h-5 w-5 flex-shrink-0 transition-colors',
          isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'
        )}
      />
      <span className="flex-1">{item.name}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <CountBadge count={item.badge} variant="warning" />
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
          ? 'bg-primary-50/70 text-primary-700'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
      )}
      onClick={onClick}
    >
      <item.icon
        className={cn(
          'mr-3 h-4 w-4 flex-shrink-0',
          isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
        )}
      />
      {item.name}
    </Link>
  );
}

function SectionDivider({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-6 pb-2">
      {icon && <span className="text-gray-400">{icon}</span>}
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
        {label}
      </span>
      <div className="flex-1 h-px bg-gray-200" />
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
          'group flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
          hasActiveItem
            ? 'bg-primary-50/50 text-primary-700'
            : 'text-gray-600 hover:bg-gray-100'
        )}
      >
        <div className="flex items-center">
          <section.icon
            className={cn(
              'mr-3 h-5 w-5',
              hasActiveItem ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
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
          <ChevronRightIcon className="h-4 w-4 text-gray-400" />
        </span>
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'Organization': false,
    'Leave Setup': false,
    'Performance': false,
    'Payroll Setup': false,
    'Security': false,
  });
  const location = useLocation();
  const { user, logout } = useAuthStore();

  // Check if user has HR/Admin access
  const userRoles = user?.roles?.map((r: any) => r.code || r.name || r) || [];
  const isHROrAdmin =
    user?.is_staff ||
    user?.is_superuser ||
    userRoles.some((role: string) => HR_ADMIN_ROLES.includes(role.toUpperCase()));

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
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden transition-opacity duration-300',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <div
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
        <div
          className={cn(
            'fixed inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl transition-transform duration-300',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex-shrink-0 flex h-16 items-center justify-between px-4 border-b border-gray-200">
            <HRMSLogo />
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 min-h-0">
            <SidebarContent onLinkClick={() => setSidebarOpen(false)} />
          </nav>
          {/* Mobile user section */}
          <div className="flex-shrink-0 border-t border-gray-200 p-4 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <Avatar firstName={user?.first_name} lastName={user?.last_name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
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
        <div className="flex flex-col h-full bg-white border-r border-gray-200">
          <div className="flex-shrink-0 flex h-16 items-center px-5 border-b border-gray-200">
            <HRMSLogo />
          </div>
          <nav className="flex-1 min-h-0">
            <SidebarContent />
          </nav>
          <div className="flex-shrink-0 border-t border-gray-200 p-4 bg-gray-50/30">
            <div className="flex items-center gap-3">
              <Avatar firstName={user?.first_name} lastName={user?.last_name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-gray-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
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
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-4 lg:px-8">
          <button
            type="button"
            className="lg:hidden -m-2 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          {/* Search (placeholder) */}
          <div className="hidden sm:flex flex-1 max-w-md">
            <div className="relative w-full">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                placeholder="Search employees, records..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-500 transition-all"
              />
            </div>
          </div>

          <div className="flex flex-1 justify-end gap-2">
            {/* Notification button */}
            <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <BellIcon className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full" />
            </button>

            {/* Mobile avatar */}
            <div className="lg:hidden">
              <Avatar firstName={user?.first_name} lastName={user?.last_name} size="sm" />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
