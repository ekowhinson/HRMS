// Design Tokens for HRMS Application
// Centralized design system values for consistent styling

export const colors = {
  // Primary (Green - HRMS Brand)
  primary: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22',
  },
  // Accent (Violet/Purple)
  accent: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7c3aed',
    800: '#6b21a8',
    900: '#581c87',
    950: '#3b0764',
  },
  // HRMS Brand
  hrms: {
    green: '#006633',
    greenLight: '#16a34a',
    gold: '#FFD700',
    goldDark: '#ca8a04',
    red: '#CE1126',
  },
  // Semantic
  success: {
    50: '#ecfdf5',
    100: '#d1fae5',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
  },
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },
  // Neutrals (GitHub Primer grays)
  gray: {
    50: '#f6f8fa',
    100: '#eaeef2',
    200: '#d0d7de',
    300: '#afb8c1',
    400: '#8c959f',
    500: '#6e7781',
    600: '#57606a',
    700: '#424a53',
    800: '#32383f',
    900: '#24292f',
    950: '#1b1f24',
  },
  // Dark header (GitHub-style top nav)
  header: {
    bg: '#24292f',
    hover: '#32383f',
    text: '#ffffff',
    textMuted: '#8c959f',
    border: '#57606a',
  },
} as const;

export const spacing = {
  0: '0',
  0.5: '0.125rem', // 2px
  1: '0.25rem',    // 4px
  1.5: '0.375rem', // 6px
  2: '0.5rem',     // 8px
  2.5: '0.625rem', // 10px
  3: '0.75rem',    // 12px
  3.5: '0.875rem', // 14px
  4: '1rem',       // 16px
  5: '1.25rem',    // 20px
  6: '1.5rem',     // 24px
  7: '1.75rem',    // 28px
  8: '2rem',       // 32px
  9: '2.25rem',    // 36px
  10: '2.5rem',    // 40px
  11: '2.75rem',   // 44px
  12: '3rem',      // 48px
  14: '3.5rem',    // 56px
  16: '4rem',      // 64px
  18: '4.5rem',    // 72px
  20: '5rem',      // 80px
} as const;

export const typography = {
  fontFamily: {
    sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Noto Sans', 'Helvetica', 'Arial', 'sans-serif'],
    mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
  },
  fontSize: {
    display: ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
    h1: ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
    h2: ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '600' }],
    h3: ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
    h4: ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
    bodyLg: ['1.125rem', { lineHeight: '1.6' }],
    body: ['1rem', { lineHeight: '1.6' }],
    bodySm: ['0.875rem', { lineHeight: '1.5' }],
    caption: ['0.75rem', { lineHeight: '1.4' }],
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const shadows = {
  xs: '0 1px 0 rgba(27,31,36,0.04)',
  sm: '0 1px 0 rgba(27,31,36,0.04)',
  md: '0 3px 6px rgba(140,149,159,0.15)',
  lg: '0 8px 24px rgba(140,149,159,0.2)',
  xl: '0 12px 28px rgba(140,149,159,0.3)',
  '2xl': '0 12px 28px rgba(140,149,159,0.3)',
  card: '0 1px 0 rgba(27,31,36,0.04)',
  cardHover: '0 1px 3px rgba(27,31,36,0.12), 0 1px 0 rgba(27,31,36,0.04)',
  dropdown: '0 8px 24px rgba(140,149,159,0.2)',
  modal: '0 12px 28px rgba(140,149,159,0.3)',
} as const;

export const borderRadius = {
  none: '0',
  sm: '3px',
  default: '6px',
  md: '6px',
  lg: '6px',
  xl: '6px',
  '2xl': '6px',
  '3xl': '6px',
  full: '9999px',
} as const;

export const transitions = {
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    slower: '400ms',
  },
  timing: {
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounceIn: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const zIndex = {
  dropdown: 50,
  sticky: 100,
  overlay: 200,
  modal: 300,
  popover: 400,
  tooltip: 500,
  toast: 600,
} as const;

// Icon sizes
export const iconSizes = {
  xs: '0.75rem',   // 12px
  sm: '1rem',      // 16px
  md: '1.25rem',   // 20px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '2.5rem', // 40px
} as const;

// Avatar sizes
export const avatarSizes = {
  xs: '1.5rem',   // 24px
  sm: '2rem',     // 32px
  md: '2.5rem',   // 40px
  lg: '3rem',     // 48px
  xl: '4rem',     // 64px
  '2xl': '6rem',  // 96px
} as const;

// Chart colors palette
export const chartColors = {
  primary: colors.primary[500],
  secondary: colors.info[500],
  tertiary: colors.info[500],
  quaternary: '#8b5cf6', // purple
  quinary: '#ec4899',    // pink
  palette: [
    colors.primary[500],
    colors.accent[500],
    colors.info[500],
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#f97316',
    '#6366f1',
  ],
} as const;

// Status badge variant mapping
export const statusVariants = {
  success: ['ACTIVE', 'APPROVED', 'PAID', 'COMPLETED', 'CONFIRMED'],
  warning: ['PENDING', 'PROBATION', 'DRAFT', 'PROCESSING'],
  danger: ['REJECTED', 'CANCELLED', 'TERMINATED', 'SUSPENDED', 'FAILED'],
  info: ['ON_LEAVE', 'IN_PROGRESS', 'SCHEDULED'],
  default: ['UNKNOWN'],
} as const;

// Export all tokens as a single object
export const designTokens = {
  colors,
  spacing,
  typography,
  shadows,
  borderRadius,
  transitions,
  breakpoints,
  zIndex,
  iconSizes,
  avatarSizes,
  chartColors,
  statusVariants,
} as const;

export default designTokens;
