import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  homeHref?: string;
  className?: string;
  separator?: React.ReactNode;
}

export function Breadcrumb({
  items,
  showHome = true,
  homeHref = '/',
  className,
  separator,
}: BreadcrumbProps) {
  const allItems: BreadcrumbItem[] = showHome
    ? [{ label: 'Home', href: homeHref, icon: <HomeIcon className="w-4 h-4" /> }, ...items]
    : items;

  const SeparatorComponent = separator || (
    <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
  );

  return (
    <nav aria-label="Breadcrumb" className={cn('flex', className)}>
      <ol className="flex items-center gap-2 text-sm">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          const isFirst = index === 0;

          return (
            <li key={index} className="flex items-center gap-2">
              {!isFirst && SeparatorComponent}

              {isLast ? (
                // Current page - not a link
                <span
                  className={cn(
                    'font-medium text-gray-900',
                    'flex items-center gap-1.5'
                  )}
                  aria-current="page"
                >
                  {item.icon}
                  <span className="max-w-[200px] truncate">{item.label}</span>
                </span>
              ) : item.href ? (
                // Link to previous page
                <Link
                  to={item.href}
                  className={cn(
                    'text-gray-500 hover:text-gray-700 transition-colors duration-200',
                    'flex items-center gap-1.5',
                    'hover:underline underline-offset-2'
                  )}
                >
                  {item.icon}
                  <span className="max-w-[150px] truncate">{item.label}</span>
                </Link>
              ) : (
                // No link - just text
                <span className="text-gray-500 flex items-center gap-1.5">
                  {item.icon}
                  <span className="max-w-[150px] truncate">{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Compact breadcrumb for mobile
export function BreadcrumbCompact({
  items,
  className,
}: Pick<BreadcrumbProps, 'items' | 'className'>) {
  if (items.length === 0) return null;

  const lastItem = items[items.length - 1];
  const parentItem = items.length > 1 ? items[items.length - 2] : null;

  return (
    <nav aria-label="Breadcrumb" className={cn('flex', className)}>
      <ol className="flex items-center gap-2 text-sm">
        {parentItem && parentItem.href && (
          <>
            <li>
              <Link
                to={parentItem.href}
                className="text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
              >
                <ChevronRightIcon className="w-4 h-4 rotate-180" />
                <span>{parentItem.label}</span>
              </Link>
            </li>
            <li>
              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
            </li>
          </>
        )}
        <li>
          <span className="font-medium text-gray-900" aria-current="page">
            {lastItem.label}
          </span>
        </li>
      </ol>
    </nav>
  );
}

export default Breadcrumb;
