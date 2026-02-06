import React, { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { cn } from '../../lib/utils';
import { ChevronDownIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline';

export interface DropdownItem {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

export interface DropdownProps {
  trigger?: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
  menuClassName?: string;
}

export function Dropdown({
  trigger,
  items,
  align = 'right',
  className,
  menuClassName,
}: DropdownProps) {
  return (
    <Menu as="div" className={cn('relative inline-block text-left', className)}>
      <Menu.Button as={Fragment}>
        {trigger || (
          <button className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors">
            Options
            <ChevronDownIcon className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items
          className={cn(
            'absolute z-50 mt-2 w-56 rounded-lg bg-white shadow-dropdown border border-gray-200 py-1 focus:outline-none',
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            menuClassName
          )}
        >
          {items.map((item, index) => {
            if (item.divider) {
              return <div key={index} className="my-1 h-px bg-gray-200" />;
            }

            return (
              <Menu.Item key={index} disabled={item.disabled}>
                {({ active }) => {
                  const itemClasses = cn(
                    'flex items-center gap-2 w-full px-4 py-2.5 text-sm transition-colors',
                    item.disabled
                      ? 'opacity-50 cursor-not-allowed text-gray-400'
                      : item.danger
                      ? active
                        ? 'bg-danger-50 text-danger-700'
                        : 'text-danger-600'
                      : active
                      ? 'bg-gray-50 text-gray-900'
                      : 'text-gray-700'
                  );

                  if (item.href && !item.disabled) {
                    return (
                      <a href={item.href} className={itemClasses}>
                        {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                        {item.label}
                      </a>
                    );
                  }

                  return (
                    <button
                      type="button"
                      className={itemClasses}
                      onClick={item.onClick}
                      disabled={item.disabled}
                    >
                      {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                      {item.label}
                    </button>
                  );
                }}
              </Menu.Item>
            );
          })}
        </Menu.Items>
      </Transition>
    </Menu>
  );
}

// Icon-only dropdown button (kebab menu)
export function DropdownMenu({
  items,
  align = 'right',
  className,
}: Omit<DropdownProps, 'trigger'>) {
  return (
    <Dropdown
      items={items}
      align={align}
      className={className}
      trigger={
        <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
          <EllipsisVerticalIcon className="w-5 h-5" />
        </button>
      }
    />
  );
}

// Dropdown with custom button
export interface DropdownButtonProps extends DropdownProps {
  buttonText: string;
  buttonIcon?: React.ReactNode;
  buttonVariant?: 'primary' | 'secondary' | 'ghost';
}

export function DropdownButton({
  buttonText,
  buttonIcon,
  buttonVariant = 'secondary',
  items,
  align = 'right',
  className,
}: DropdownButtonProps) {
  const variantStyles = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 border-transparent',
    secondary: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
    ghost: 'bg-transparent text-gray-700 border-transparent hover:bg-gray-100',
  };

  return (
    <Dropdown
      items={items}
      align={align}
      className={className}
      trigger={
        <button
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            variantStyles[buttonVariant]
          )}
        >
          {buttonIcon && <span className="w-4 h-4">{buttonIcon}</span>}
          {buttonText}
          <ChevronDownIcon className="w-4 h-4" />
        </button>
      }
    />
  );
}

export default Dropdown;
