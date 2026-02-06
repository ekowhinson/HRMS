// UI Components Export Index
// Import from '@/components/ui' instead of individual files

// Button
export { default as Button, ButtonGroup, IconButton } from './Button';
export type { ButtonProps, IconButtonProps } from './Button';

// Card
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CompactCard,
  StatCard,
} from './Card';

// Badge
export { default as Badge, StatusBadge, StatusDot, CountBadge, BadgeGroup } from './Badge';
export type { BadgeProps, StatusBadgeProps } from './Badge';

// Table
export {
  default as Table,
  TableRoot,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TablePagination,
} from './Table';
export type { TablePaginationProps } from './Table';

// Input
export { default as Input } from './Input';

// Select
export { default as Select } from './Select';

// LinkedSelect
export { default as LinkedSelect } from './LinkedSelect';
export type { LinkedSelectProps, SelectOption as LinkedSelectOption } from './LinkedSelect';

// Modal
export { default as Modal } from './Modal';

// Avatar
export { default as Avatar } from './Avatar';

// StatsCard
export { StatsCard } from './StatsCard';
export type { StatsCardProps } from './StatsCard';

// Breadcrumb
export { Breadcrumb, BreadcrumbCompact } from './Breadcrumb';
export type { BreadcrumbItem, BreadcrumbProps } from './Breadcrumb';

// PageHeader
export { PageHeader, SimplePageHeader, SectionHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';

// EmptyState
export { EmptyState, EmptyStateInline, TableEmptyState } from './EmptyState';
export type { EmptyStateProps, EmptyStateType } from './EmptyState';

// Skeleton
export {
  Skeleton,
  SkeletonText,
  SkeletonUser,
  SkeletonTableRow,
  SkeletonTable,
  SkeletonStatsCard,
  SkeletonCard,
  SkeletonFormField,
  SkeletonDashboard,
  SkeletonListItem,
} from './Skeleton';
export type { SkeletonProps } from './Skeleton';

// Tabs
export { Tabs, TabsList, TabsTrigger, TabsContent, SimpleTabs } from './Tabs';
export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps, SimpleTab, SimpleTabsProps } from './Tabs';

// Dropdown
export { Dropdown, DropdownMenu, DropdownButton } from './Dropdown';
export type { DropdownItem, DropdownProps, DropdownButtonProps } from './Dropdown';

// Tooltip
export { Tooltip, InfoTooltip, TruncatedText } from './Tooltip';
export type { TooltipProps } from './Tooltip';

// Textarea
export { default as Textarea } from './Textarea';
export type { TextareaProps } from './Textarea';
