import { focusRing } from '@/shared/design/tokens';

const TONES = {
  neutral: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  blue: 'text-blue-700 hover:bg-blue-50',
  red: 'text-red-700 hover:bg-red-50',
  green: 'text-green-700 hover:bg-green-50',
};

/** The classes of a small square icon button (36px, 44px on a phone). */
export const iconActionClass = (tone = 'neutral') =>
  `inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors duration-150 max-md:h-11 max-md:w-11 ${TONES[tone]} ${focusRing}`;
