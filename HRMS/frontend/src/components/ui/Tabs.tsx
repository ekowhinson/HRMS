import React, { useState, createContext, useContext } from 'react';
import { cn } from '../../lib/utils';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
}

export interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || '');

  const activeTab = value !== undefined ? value : internalValue;
  const setActiveTab = (newValue: string) => {
    if (value === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'pills' | 'underline';
}

export function TabsList({ children, className, variant = 'default' }: TabsListProps) {
  const variantStyles = {
    default: 'border-b border-gray-200',
    pills: 'bg-gray-100 p-1 rounded-lg gap-1',
    underline: 'border-b border-gray-200',
  };

  return (
    <div
      className={cn(
        'flex',
        variantStyles[variant],
        className
      )}
      role="tablist"
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  variant?: 'default' | 'pills' | 'underline';
}

export function TabsTrigger({
  value,
  children,
  className,
  disabled = false,
  icon,
  variant = 'default',
}: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  const baseStyles = 'flex items-center gap-2 font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2';

  const variantStyles = {
    default: cn(
      'px-4 py-2.5 text-sm border-b-2 -mb-px',
      isActive
        ? 'text-primary-600 border-primary-600'
        : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300',
      disabled && 'opacity-50 cursor-not-allowed'
    ),
    pills: cn(
      'px-4 py-2 text-sm rounded-md',
      isActive
        ? 'bg-white text-primary-600 shadow-sm'
        : 'text-gray-600 hover:text-gray-900 hover:bg-white/50',
      disabled && 'opacity-50 cursor-not-allowed'
    ),
    underline: cn(
      'px-4 py-2.5 text-sm border-b-2 -mb-px',
      isActive
        ? 'text-primary-600 border-primary-600'
        : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300',
      disabled && 'opacity-50 cursor-not-allowed'
    ),
  };

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-disabled={disabled}
      disabled={disabled}
      className={cn(baseStyles, variantStyles[variant], className)}
      onClick={() => !disabled && setActiveTab(value)}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
    </button>
  );
}

export interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  forceMount?: boolean;
}

export function TabsContent({
  value,
  children,
  className,
  forceMount = false,
}: TabsContentProps) {
  const { activeTab } = useTabsContext();
  const isActive = activeTab === value;

  if (!isActive && !forceMount) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      hidden={!isActive}
      className={cn(
        'mt-4 focus:outline-none',
        isActive ? 'animate-fade-in' : 'hidden',
        className
      )}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

// Simple tabs component for basic use cases
export interface SimpleTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface SimpleTabsProps {
  tabs: SimpleTab[];
  defaultTab?: string;
  variant?: 'default' | 'pills' | 'underline';
  className?: string;
  contentClassName?: string;
}

export function SimpleTabs({
  tabs,
  defaultTab,
  variant = 'default',
  className,
  contentClassName,
}: SimpleTabsProps) {
  const defaultValue = defaultTab || tabs[0]?.id;

  return (
    <Tabs defaultValue={defaultValue} className={className}>
      <TabsList variant={variant}>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            icon={tab.icon}
            variant={variant}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className={contentClassName}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export default Tabs;
