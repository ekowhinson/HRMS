import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import OrganizationSwitcher from './OrganizationSwitcher';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService, type Notification as NotificationType } from '@/services/notifications';
import ActivePeriodIndicator from './ActivePeriodIndicator';
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
  ArrowPathIcon,
  BuildingOfficeIcon,
  BuildingOffice2Icon,
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
  CpuChipIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  InboxStackIcon,
  ArrowTrendingUpIcon,
  DocumentChartBarIcon,
  TruckIcon,
  ArchiveBoxIcon,
  CubeIcon,
  RectangleGroupIcon,
  TableCellsIcon,
  CloudArrowDownIcon,
  WalletIcon,
  PresentationChartBarIcon,
  ClipboardDocumentListIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/features/auth/store';
import Avatar from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { useModuleAccess } from '@/hooks/useModuleAccess';
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
  /** If set, section requires this module access (checked via useModuleAccess) */
  requiredModule?: string;
}

// Self-Service Navigation - Available to all users
const selfServiceNavigation: NavItem[] = [
  { name: 'Home', href: '/self-service', icon: HomeIcon },
  { name: 'My Profile', href: '/my-profile', icon: UserCircleIcon },
  { name: 'My Leave', href: '/my-leave', icon: ClockIcon },
  { name: 'Leave Planning', href: '/my-leave/planning', icon: CalendarDaysIcon },
  { name: 'Data Updates', href: '/my-data-updates', icon: DocumentPlusIcon },
  { name: 'Service Requests', href: '/my-service-requests', icon: ClipboardDocumentCheckIcon },
  { name: 'My Payslips', href: '/my-payslips', icon: BanknotesIcon },
  { name: 'My Loans', href: '/my-loans', icon: CreditCardIcon },
  { name: 'My Appraisal', href: '/my-appraisal', icon: ChartBarIcon },
  { name: 'My Training', href: '/my-training', icon: AcademicCapIcon },
  { name: 'Internal Jobs', href: '/internal-jobs', icon: BriefcaseIcon },
  { name: 'My Disciplinary', href: '/my-disciplinary', icon: ExclamationTriangleIcon },
  { name: 'My Grievances', href: '/my-grievances', icon: ChatBubbleLeftRightIcon },
  { name: 'My Approvals', href: '/my-approvals', icon: InboxStackIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

// HR Section - Top level items
const hrNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Employees', href: '/employees', icon: UsersIcon },
  { name: 'Recruitment', href: '/admin/recruitment', icon: BriefcaseIcon },
  { name: 'Exit Management', href: '/admin/exits', icon: ArrowRightStartOnRectangleIcon },
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
    name: 'Leave Management',
    icon: CalendarIcon,
    items: [
      { name: 'Leave Overview', href: '/leave', icon: CalendarIcon },
      { name: 'Leave Approvals', href: '/admin/leave-approvals', icon: ClipboardDocumentCheckIcon },
      { name: 'Leave Types', href: '/admin/leave-types', icon: CalendarDaysIcon },
      { name: 'Leave Calendar', href: '/admin/leave-calendar', icon: CalendarIcon },
    ],
  },
  {
    name: 'Performance',
    icon: ChartBarIcon,
    items: [
      { name: 'Appraisals', href: '/admin/appraisals', icon: FlagIcon },
      { name: 'Appraisal Cycles', href: '/admin/appraisal-cycles', icon: CalendarDaysIcon },
      { name: 'Competencies', href: '/admin/competencies', icon: AcademicCapIcon },
      { name: 'Core Values', href: '/admin/core-values', icon: StarIcon },
      { name: 'Probation Assessments', href: '/admin/probation-assessments', icon: ShieldCheckIcon },
      { name: 'Performance Appeals', href: '/admin/performance-appeals', icon: ScaleIcon },
    ],
  },
  {
    name: 'Training & Development',
    icon: AcademicCapIcon,
    items: [
      { name: 'Dashboard', href: '/admin/training-dashboard', icon: ChartBarIcon },
      { name: 'Programs', href: '/admin/training-programs', icon: AcademicCapIcon },
      { name: 'Sessions', href: '/admin/training-sessions', icon: CalendarDaysIcon },
      { name: 'Training Needs', href: '/admin/training-needs', icon: FlagIcon },
      { name: 'Development Plans', href: '/admin/development-plans', icon: ArrowTrendingUpIcon },
    ],
  },
  {
    name: 'Discipline & Grievance',
    icon: ScaleIcon,
    items: [
      { name: 'Disciplinary Cases', href: '/admin/disciplinary', icon: ExclamationTriangleIcon },
      { name: 'Grievances', href: '/admin/grievances', icon: ChatBubbleLeftRightIcon },
    ],
  },
  {
    name: 'HR Reports',
    icon: DocumentChartBarIcon,
    items: [
      { name: 'All HR Reports', href: '/hr-reports', icon: DocumentChartBarIcon },
      { name: 'Employee Directory', href: '/hr-reports/employee-directory', icon: UsersIcon },
      { name: 'Headcount', href: '/hr-reports/headcount', icon: ChartBarIcon },
      { name: 'Turnover', href: '/hr-reports/turnover', icon: ArrowTrendingUpIcon },
      { name: 'Demographics', href: '/hr-reports/demographics', icon: UserGroupIcon },
      { name: 'Leave Balance', href: '/hr-reports/leave-balance', icon: CalendarDaysIcon },
      { name: 'Leave Utilization', href: '/hr-reports/leave-utilization', icon: ClockIcon },
      { name: 'Employment History', href: '/hr-reports/employment-history', icon: ClipboardDocumentListIcon },
      { name: 'KPI Tracking', href: '/hr-reports/kpi-tracking', icon: ArrowTrendingUpIcon },
      { name: 'Performance Appraisals', href: '/hr-reports/performance-appraisals', icon: StarIcon },
      { name: 'Training & Development', href: '/hr-reports/training-development', icon: AcademicCapIcon },
    ],
  },
];

// Payroll Section - Top level items
const payrollNavigation: NavItem[] = [
  { name: 'Payroll Overview', href: '/payroll', icon: BanknotesIcon },
  { name: 'Employee Directory', href: '/payroll/employees', icon: UsersIcon },
  { name: 'Payroll Reports', href: '/reports', icon: ChartBarIcon },
];

// Payroll Section - Collapsible sub-sections
const payrollSections: NavSection[] = [
  {
    name: 'Payroll Processing',
    icon: CalculatorIcon,
    items: [
      { name: 'Process Payroll', href: '/admin/payroll', icon: CalculatorIcon },
      { name: 'Backpay', href: '/admin/backpay', icon: ArrowPathIcon },
      { name: 'Salary Upgrades', href: '/admin/salary-upgrades', icon: ArrowTrendingUpIcon },
    ],
  },
  {
    name: 'Transactions',
    icon: CurrencyDollarIcon,
    items: [
      { name: 'Employee Transactions', href: '/admin/employee-transactions', icon: DocumentPlusIcon },
      { name: 'Benefits', href: '/benefits', icon: GiftIcon },
      { name: 'Loan Management', href: '/admin/loans', icon: CreditCardIcon },
    ],
  },
  {
    name: 'Data Loading',
    icon: DocumentArrowUpIcon,
    requiredModule: 'payroll_setup',
    items: [
      { name: 'Payroll Implementation', href: '/admin/payroll-implementation', icon: CpuChipIcon },
      { name: 'Data Import', href: '/admin/data-import', icon: DocumentArrowUpIcon },
    ],
  },
  {
    name: 'Validation',
    icon: ClipboardDocumentCheckIcon,
    requiredModule: 'payroll_setup',
    items: [
      { name: 'Payroll Validation', href: '/admin/payroll-validation', icon: ClipboardDocumentCheckIcon },
    ],
  },
  {
    name: 'Setup',
    icon: WrenchScrewdriverIcon,
    requiredModule: 'payroll_setup',
    items: [
      { name: 'Period Setup', href: '/admin/payroll-setup?tab=settings', icon: CalendarDaysIcon },
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

// Finance Section - Top level items
const financeNavigation: NavItem[] = [
  { name: 'Chart of Accounts', href: '/finance/accounts', icon: TableCellsIcon },
  { name: 'Journal Entries', href: '/finance/journal-entries', icon: DocumentChartBarIcon },
  { name: 'Financial Reports', href: '/finance/reports', icon: PresentationChartBarIcon },
];

// Finance Section - Collapsible sub-sections
const financeSections: NavSection[] = [
  {
    name: 'Budgets',
    icon: WalletIcon,
    items: [
      { name: 'Budget Management', href: '/finance/budgets', icon: WalletIcon },
    ],
  },
  {
    name: 'Accounts Payable',
    icon: CurrencyDollarIcon,
    items: [
      { name: 'Vendors', href: '/finance/vendors', icon: TruckIcon },
      { name: 'Vendor Invoices', href: '/finance/vendor-invoices', icon: DocumentTextIcon },
      { name: 'Payments', href: '/finance/payments', icon: BanknotesIcon },
    ],
  },
  {
    name: 'Accounts Receivable',
    icon: CreditCardIcon,
    items: [
      { name: 'Customers', href: '/finance/customers', icon: UserGroupIcon },
      { name: 'Customer Invoices', href: '/finance/customer-invoices', icon: DocumentTextIcon },
    ],
  },
  {
    name: 'Banking',
    icon: BuildingOfficeIcon,
    items: [
      { name: 'Bank Accounts', href: '/finance/bank-accounts', icon: BuildingOfficeIcon },
      { name: 'Reconciliation', href: '/finance/reconciliation', icon: ArrowPathIcon },
    ],
  },
  {
    name: 'Tax & Adjustments',
    icon: AdjustmentsHorizontalIcon,
    items: [
      { name: 'Tax Management', href: '/finance/tax-management', icon: AdjustmentsHorizontalIcon },
      { name: 'Credit/Debit Notes', href: '/finance/credit-debit-notes', icon: DocumentTextIcon },
    ],
  },
];

// Procurement Section - Top level items
const procurementNavigation: NavItem[] = [
  { name: 'Requisitions', href: '/procurement/requisitions', icon: ClipboardDocumentListIcon },
  { name: 'Purchase Orders', href: '/procurement/purchase-orders', icon: DocumentTextIcon },
  { name: 'Goods Receipt', href: '/procurement/goods-receipt', icon: TruckIcon },
  { name: 'Contracts', href: '/procurement/contracts', icon: DocumentChartBarIcon },
  { name: 'RFQ', href: '/procurement/rfq', icon: DocumentPlusIcon },
];

// Inventory Section - Top level items
const inventoryNavigation: NavItem[] = [
  { name: 'Items', href: '/inventory/items', icon: CubeIcon },
  { name: 'Stock Movements', href: '/inventory/stock', icon: ArrowPathIcon },
  { name: 'Warehouses', href: '/inventory/warehouses', icon: ArchiveBoxIcon },
];

// Inventory Section - Collapsible sub-sections
const inventorySections: NavSection[] = [
  {
    name: 'Fixed Assets',
    icon: RectangleGroupIcon,
    items: [
      { name: 'Asset Register', href: '/inventory/assets', icon: RectangleGroupIcon },
      { name: 'Depreciation', href: '/inventory/depreciation', icon: ArrowTrendingUpIcon },
      { name: 'Asset Disposals', href: '/inventory/asset-disposals', icon: DocumentArrowUpIcon },
    ],
  },
];

// Projects Section - Top level items
const projectsNavigation: NavItem[] = [
  { name: 'Projects', href: '/projects', icon: FolderIcon },
  { name: 'Timesheets', href: '/projects/timesheets', icon: ClockIcon },
  { name: 'Resources', href: '/projects/resources', icon: UserGroupIcon },
];

// Manufacturing Section - Top level items
const manufacturingNavigation: NavItem[] = [
  { name: 'Production Dashboard', href: '/manufacturing/dashboard', icon: PresentationChartBarIcon },
  { name: 'Bill of Materials', href: '/manufacturing/bom', icon: ClipboardDocumentListIcon },
  { name: 'Work Centers', href: '/manufacturing/work-centers', icon: BuildingOfficeIcon },
  { name: 'Work Orders', href: '/manufacturing/work-orders', icon: ClipboardDocumentCheckIcon },
  { name: 'Quality Control', href: '/manufacturing/quality', icon: ShieldCheckIcon },
];

// Administration Section - Top level items
const adminNavigation: NavItem[] = [
  { name: 'Tenants', href: '/admin/tenants', icon: BuildingOffice2Icon },
  { name: 'Approval Workflows', href: '/admin/approval-workflows', icon: ClipboardDocumentCheckIcon },
  { name: 'Company Policies', href: '/admin/policies', icon: DocumentTextIcon },
  { name: 'Announcements', href: '/admin/announcements', icon: MegaphoneIcon },
  { name: 'Report Builder', href: '/reports/builder', icon: PresentationChartBarIcon },
];

// Administration Section - Collapsible sub-sections
const adminSections: NavSection[] = [
  {
    name: 'Backup & Restore',
    icon: CloudArrowDownIcon,
    items: [
      { name: 'Backups', href: '/admin/backups', icon: CloudArrowDownIcon },
    ],
  },
  {
    name: 'Security',
    icon: LockClosedIcon,
    items: [
      { name: 'User Management', href: '/admin/users', icon: UsersIcon },
      { name: 'Roles & Permissions', href: '/admin/roles', icon: KeyIcon },
      { name: 'Auth Providers', href: '/admin/auth-providers', icon: ShieldCheckIcon },
      { name: 'Audit Logs', href: '/admin/audit-logs', icon: ClipboardDocumentCheckIcon },
    ],
  },
];

interface MainLayoutProps {
  children: React.ReactNode;
}

// Clean ERP Logo Component — styled for dark header
function HRMSLogo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-md bg-white/15 flex items-center justify-center">
        <span className="text-white font-bold text-[10px]">ERP</span>
      </div>
      {!collapsed && (
        <div className="flex flex-col">
          <span className="text-base font-bold text-white">
            ERP
          </span>
          <span className="text-[9px] text-header-text-muted -mt-1 tracking-wider uppercase">
            Suite
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
        'group relative flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150',
        isActive
          ? 'bg-gray-100 text-gray-900 font-semibold'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      )}
      onClick={onClick}
    >
      <item.icon
        className={cn(
          'mr-3 h-5 w-5 flex-shrink-0 transition-colors duration-150',
          isActive
            ? 'text-gray-900'
            : 'text-gray-400 group-hover:text-gray-600'
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
        'group flex items-center pl-11 pr-3 py-2 text-sm font-medium rounded-md transition-colors duration-150',
        isActive
          ? 'text-gray-900 bg-gray-100 font-semibold'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      )}
      onClick={onClick}
    >
      <item.icon
        className={cn(
          'mr-3 h-4 w-4 flex-shrink-0 transition-colors',
          isActive ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'
        )}
      />
      {item.name}
    </Link>
  );
}

function SectionDivider({
  label,
  icon,
  onClick,
  isOpen,
}: {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  isOpen?: boolean;
}) {
  if (onClick !== undefined) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 pt-6 pb-2 w-full group cursor-pointer"
      >
        {icon && <span className="text-gray-400">{icon}</span>}
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider group-hover:text-gray-600 transition-colors">
          {label}
        </span>
        <div className="flex-1 h-px bg-gray-200" />
        <span
          className={cn(
            'transition-transform duration-200 text-gray-400',
            isOpen && 'rotate-90'
          )}
        >
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </span>
      </button>
    );
  }

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
          'group flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150',
          hasActiveItem
            ? 'text-gray-900 bg-gray-100 font-semibold'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        )}
      >
        <div className="flex items-center">
          <section.icon
            className={cn(
              'mr-3 h-5 w-5 transition-colors',
              hasActiveItem ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'
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

// Notification Bell Component
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread_count'],
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: 30000,
  });

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => notificationService.getNotifications({ page_size: 10 }),
    enabled: open,
  });

  const unreadCount = unreadData?.count ?? 0;
  const notifications: NotificationType[] = notificationsData?.results ?? [];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkAllRead = async () => {
    await notificationService.markAllRead();
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const handleNotificationClick = async (notification: NotificationType) => {
    if (!notification.is_read) {
      await notificationService.markRead(notification.id);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
    if (notification.link) {
      navigate(notification.link);
    }
    setOpen(false);
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const typeColors: Record<string, string> = {
    INFO: 'bg-blue-100 text-blue-600',
    WARNING: 'bg-yellow-100 text-yellow-600',
    ERROR: 'bg-red-100 text-red-600',
    SUCCESS: 'bg-green-100 text-green-600',
    TASK: 'bg-purple-100 text-purple-600',
    APPROVAL: 'bg-orange-100 text-orange-600',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="relative p-2.5 text-header-text-muted hover:text-white rounded-md transition-colors"
        onClick={() => setOpen(!open)}
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg z-50">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                    !n.is_read && 'bg-blue-50/50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn('mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs flex-shrink-0', typeColors[n.notification_type] || typeColors.INFO)}>
                      {n.notification_type[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm truncate', !n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700')}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <span className="mt-2 h-2 w-2 rounded-full bg-primary-500 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();

  // Combine all collapsible sections for easier lookup
  const allSections = useMemo(() => [...hrSections, ...payrollSections, ...financeSections, ...inventorySections, ...adminSections], []);

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

  // Module access from user roles (data-driven via role.modules field)
  const { canAccess, isSuperuser } = useModuleAccess();

  // Check if a module is enabled for the current tenant via license or modules_enabled
  const isModuleEnabled = (moduleName: string): boolean => {
    // Superusers see everything
    if (isSuperuser) return true;
    // Check active license first
    const license = user?.active_organization?.active_license;
    if (license && license.modules_allowed && license.modules_allowed.length > 0) {
      return license.modules_allowed.includes(moduleName);
    }
    // Fallback to org modules_enabled
    const orgModules = user?.active_organization?.modules_enabled;
    if (orgModules && orgModules.length > 0) {
      return orgModules.includes(moduleName);
    }
    // If no restrictions set, allow all
    return true;
  };

  // Filter admin navigation: only show Tenants to superusers
  const filteredAdminNavigation = adminNavigation.filter(
    (item) => item.href !== '/admin/tenants' || isSuperuser
  );

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

  // Module-level collapse state — all modules open by default
  const MODULE_NAMES = ['Self Service', 'HR', 'Payroll', 'Finance', 'Procurement', 'Inventory', 'Projects', 'Manufacturing', 'Administration'] as const;

  const moduleNavMap = useMemo(() => ({
    'Self Service': selfServiceNavigation,
    'HR': [...hrNavigation, ...hrSections.flatMap(s => s.items)],
    'Payroll': [...payrollNavigation, ...payrollSections.flatMap(s => s.items)],
    'Finance': [...financeNavigation, ...financeSections.flatMap(s => s.items)],
    'Procurement': procurementNavigation,
    'Inventory': [...inventoryNavigation, ...inventorySections.flatMap(s => s.items)],
    'Projects': projectsNavigation,
    'Manufacturing': manufacturingNavigation,
    'Administration': [...adminNavigation, ...adminSections.flatMap(s => s.items)],
  }), []);

  const [openModules, setOpenModules] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    MODULE_NAMES.forEach(name => { initial[name] = true; });
    return initial;
  });

  const toggleModule = (name: string) => {
    setOpenModules(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // Auto-expand module when route changes to an item inside it
  useEffect(() => {
    setOpenModules(prev => {
      const updated = { ...prev };
      let changed = false;
      for (const [moduleName, items] of Object.entries(moduleNavMap)) {
        const hasActive = items.some(item =>
          location.pathname.startsWith(item.href.split('?')[0])
        );
        if (hasActive && !prev[moduleName]) {
          updated[moduleName] = true;
          changed = true;
        }
      }
      return changed ? updated : prev;
    });
  }, [location.pathname, moduleNavMap]);

  const renderSidebarContent = (onLinkClick?: () => void) => (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {/* AI Assistant - First item, available to all */}
        <div className="px-2 pt-2 pb-1">
          <NavLink
            item={{ name: 'AI Assistant', href: '/ai-assistant', icon: SparklesIcon }}
            isActive={location.pathname === '/ai-assistant'}
            onClick={onLinkClick}
          />
        </div>

        {/* Self-Service Section - Always visible */}
        <SectionDivider label="Self Service" onClick={() => toggleModule('Self Service')} isOpen={openModules['Self Service']} />
        <div
          className={cn(
            'overflow-hidden transition-all duration-200',
            openModules['Self Service'] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
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
        </div>

        {/* HR Section - Only for users with hr module access + module enabled */}
        {canAccess('hr') && isModuleEnabled('employees') && (
          <>
            <SectionDivider label="HR" icon={<UsersIcon className="h-3.5 w-3.5" />} onClick={() => toggleModule('HR')} isOpen={openModules['HR']} />
            <div
              className={cn(
                'overflow-hidden transition-all duration-200',
                openModules['HR'] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
              )}
            >
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
            </div>
          </>
        )}

        {/* Payroll Section - For users with payroll module access + module enabled */}
        {canAccess('payroll') && isModuleEnabled('payroll') && (
          <>
            <SectionDivider label="Payroll" icon={<BanknotesIcon className="h-3.5 w-3.5" />} onClick={() => toggleModule('Payroll')} isOpen={openModules['Payroll']} />
            <div
              className={cn(
                'overflow-hidden transition-all duration-200',
                openModules['Payroll'] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
              )}
            >
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
                {payrollSections
                  .filter((section) => !section.requiredModule || canAccess(section.requiredModule))
                  .map((section) => (
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
          </>
        )}

        {/* Finance Section - For users with finance module access + module enabled */}
        {canAccess('finance') && isModuleEnabled('finance') && (
          <>
            <SectionDivider label="Finance" icon={<CurrencyDollarIcon className="h-3.5 w-3.5" />} onClick={() => toggleModule('Finance')} isOpen={openModules['Finance']} />
            <div
              className={cn(
                'overflow-hidden transition-all duration-200',
                openModules['Finance'] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              <div className="px-2 space-y-0.5">
                {financeNavigation.map((item) => (
                  <NavLink
                    key={item.name}
                    item={item}
                    isActive={location.pathname === item.href ||
                      (location.pathname.startsWith(item.href) && item.href !== '/finance/reports')}
                    onClick={onLinkClick}
                  />
                ))}
                {financeSections.map((section) => (
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
          </>
        )}

        {/* Procurement Section */}
        {canAccess('procurement') && isModuleEnabled('procurement') && (
          <>
            <SectionDivider label="Procurement" icon={<TruckIcon className="h-3.5 w-3.5" />} onClick={() => toggleModule('Procurement')} isOpen={openModules['Procurement']} />
            <div
              className={cn(
                'overflow-hidden transition-all duration-200',
                openModules['Procurement'] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              <div className="px-2 space-y-0.5">
                {procurementNavigation.map((item) => (
                  <NavLink
                    key={item.name}
                    item={item}
                    isActive={location.pathname === item.href || location.pathname.startsWith(item.href)}
                    onClick={onLinkClick}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Inventory & Assets Section */}
        {canAccess('inventory') && isModuleEnabled('inventory') && (
          <>
            <SectionDivider label="Inventory" icon={<ArchiveBoxIcon className="h-3.5 w-3.5" />} onClick={() => toggleModule('Inventory')} isOpen={openModules['Inventory']} />
            <div
              className={cn(
                'overflow-hidden transition-all duration-200',
                openModules['Inventory'] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              <div className="px-2 space-y-0.5">
                {inventoryNavigation.map((item) => (
                  <NavLink
                    key={item.name}
                    item={item}
                    isActive={location.pathname === item.href || location.pathname.startsWith(item.href)}
                    onClick={onLinkClick}
                  />
                ))}
                {inventorySections.map((section) => (
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
          </>
        )}

        {/* Projects Section */}
        {canAccess('projects') && isModuleEnabled('projects') && (
          <>
            <SectionDivider label="Projects" icon={<FolderIcon className="h-3.5 w-3.5" />} onClick={() => toggleModule('Projects')} isOpen={openModules['Projects']} />
            <div
              className={cn(
                'overflow-hidden transition-all duration-200',
                openModules['Projects'] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              <div className="px-2 space-y-0.5">
                {projectsNavigation.map((item) => (
                  <NavLink
                    key={item.name}
                    item={item}
                    isActive={location.pathname === item.href ||
                      (item.href !== '/projects' && location.pathname.startsWith(item.href))}
                    onClick={onLinkClick}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Manufacturing Section */}
        {canAccess('manufacturing') && isModuleEnabled('manufacturing') && (
          <>
            <SectionDivider label="Manufacturing" icon={<WrenchScrewdriverIcon className="h-3.5 w-3.5" />} onClick={() => toggleModule('Manufacturing')} isOpen={openModules['Manufacturing']} />
            <div
              className={cn(
                'overflow-hidden transition-all duration-200',
                openModules['Manufacturing'] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              <div className="px-2 space-y-0.5">
                {manufacturingNavigation.map((item) => (
                  <NavLink
                    key={item.name}
                    item={item}
                    isActive={location.pathname === item.href || location.pathname.startsWith(item.href)}
                    onClick={onLinkClick}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Administration Section - Only for users with administration module access */}
        {canAccess('administration') && (
          <>
            <SectionDivider label="Administration" icon={<Cog6ToothIcon className="h-3.5 w-3.5" />} onClick={() => toggleModule('Administration')} isOpen={openModules['Administration']} />
            <div
              className={cn(
                'overflow-hidden transition-all duration-200',
                openModules['Administration'] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              <div className="px-2 space-y-0.5">
                {filteredAdminNavigation.map((item) => (
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
          className="fixed inset-0 bg-black/40"
          onClick={() => setSidebarOpen(false)}
        />
        <div
          className={cn(
            'fixed inset-y-0 left-0 flex w-72 flex-col bg-white transition-transform duration-300',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex-shrink-0 flex h-14 items-center justify-between px-4 border-b border-gray-200 bg-header-bg">
            <HRMSLogo />
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-md text-header-text-muted hover:text-white transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 min-h-0">
            {renderSidebarContent(() => setSidebarOpen(false))}
          </nav>
          {/* Mobile user section */}
          <div className="flex-shrink-0 border-t border-gray-200 p-4">
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
                className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Logout"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar — starts below dark header */}
      <div className="hidden lg:fixed lg:top-14 lg:bottom-0 lg:flex lg:w-64 lg:flex-col bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          <nav className="flex-1 min-h-0">
            {renderSidebarContent()}
          </nav>
          <div className="flex-shrink-0 border-t border-gray-200 p-4">
            <div className="flex items-center gap-3 p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
              <Avatar firstName={user?.first_name} lastName={user?.last_name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
        {/* Dark top header bar (GitHub-style) */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 bg-header-bg px-4 lg:px-6">
          {/* Mobile menu button */}
          <button
            type="button"
            className="lg:hidden -m-2 p-2 text-header-text-muted hover:text-white rounded-md transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          {/* Logo in header (visible on desktop) */}
          <div className="hidden lg:flex items-center">
            <HRMSLogo />
          </div>

          {/* Search */}
          <div className="hidden sm:flex flex-1 max-w-md">
            <div className="relative w-full">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-header-text-muted" />
              <input
                type="search"
                placeholder="Search employees, records..."
                className="w-full pl-10 pr-4 py-1.5 text-sm bg-header-hover text-white placeholder-header-text-muted border border-header-border rounded-md focus:bg-gray-50 focus:text-gray-900 focus:placeholder-gray-400 focus:ring-1 focus:ring-[#0969da] focus:border-[#0969da] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-1 justify-end items-center gap-2">
            {/* Active Payroll Period */}
            {canAccess('payroll') && <ActivePeriodIndicator />}

            {/* Organization Switcher */}
            <OrganizationSwitcher />

            {/* Notification button with dropdown */}
            <NotificationBell />

            {/* Mobile avatar */}
            <div className="lg:hidden">
              <Avatar firstName={user?.first_name} lastName={user?.last_name} size="sm" />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6 min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
