import { focusRing } from '@/shared/design/tokens';

const BASE = `inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

// max-md:min-h-11 keeps a 44px touch target on phones.
const SIZES = {
  sm: 'h-8 px-3 text-sm max-md:min-h-11',
  md: 'h-10 px-4 text-sm max-md:min-h-11',
  lg: 'h-11 px-6 text-base',
};

const VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-gray-700 hover:bg-gray-100',
};

/**
 * The classes of a button, for things that are not a <button> (a router Link that should look
 * like one, for example).
 *
 * @param {{ variant?: keyof typeof VARIANTS, size?: keyof typeof SIZES, iconOnly?: boolean, className?: string }} [options]
 */
export function buttonClass({ variant = 'primary', size = 'md', iconOnly = false, className = '' } = {}) {
  const shape = iconOnly ? 'aspect-square !px-0' : '';
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${shape} ${className}`.replace(/\s+/g, ' ').trim();
}
