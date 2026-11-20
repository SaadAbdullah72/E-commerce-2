/**
 * Design tokens: the one place where the admin's type, radius, shadow and colour choices live.
 * They are Tailwind class strings (not pixel numbers), because Tailwind's scale is already
 * 4px-based. Spacing: xs 1 (4px), sm 2 (8px), md 4 (16px), lg 6 (24px), xl 8 (32px), 2xl 12 (48px).
 *
 * Colour rule: text on a tinted background uses -700 or -800 (WCAG AA, 4.5:1). The -600 shades
 * only pass on white, so they are used for solid buttons, never for text on a tint.
 */

export const spacing = {
  xs: '1',
  sm: '2',
  md: '4',
  lg: '6',
  xl: '8',
  '2xl': '12',
};

export const type = {
  h1: 'text-2xl font-semibold tracking-tight text-gray-900',
  h2: 'text-lg font-semibold text-gray-900',
  h3: 'text-base font-semibold text-gray-900',
  body: 'text-sm text-gray-700',
  caption: 'text-xs text-gray-500',
  stat: 'text-3xl font-bold tabular-nums',
};

export const radius = {
  control: 'rounded-lg',
  card: 'rounded-xl',
  badge: 'rounded-full',
};

export const shadow = {
  card: 'shadow-sm',
  cardHover: 'hover:shadow-md',
  modal: 'shadow-xl',
  dropdown: 'shadow-lg',
};

export const border = {
  default: 'border border-gray-200',
  hover: 'hover:border-gray-300',
};

/** Keyboard focus ring for components that style their own focus. */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';

/** Tinted badge colours. Every pair is at least 4.5:1. */
export const tones = {
  green: 'bg-green-50 text-green-800 border-green-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-red-50 text-red-800 border-red-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
};

/** Order and review status to badge colour. */
export const statusTone = {
  pending_payment: 'amber',
  paid: 'blue',
  shipped: 'purple',
  delivered: 'green',
  cancelled: 'gray',
  approved: 'green',
  rejected: 'red',
  pending: 'amber',
};

/** Text colour for a number that carries a meaning (on white). */
export const valueTone = {
  default: 'text-gray-900',
  warning: 'text-amber-700',
  danger: 'text-red-700',
  success: 'text-green-700',
  info: 'text-blue-700',
};
