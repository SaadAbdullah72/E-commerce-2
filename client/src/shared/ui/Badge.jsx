import { tones } from '@/shared/design/tokens';

const SIZES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

/**
 * A small pill. The text is never smaller than 12px, and every tone is at least 4.5:1.
 *
 * @param {object} props
 * @param {keyof typeof tones} [props.tone]
 * @param {'sm' | 'md'} [props.size]
 * @param {import('react').ComponentType<{ className?: string, 'aria-hidden'?: boolean }>} [props.icon] a lucide icon, shown before the text
 */
export default function Badge({ tone = 'gray', size = 'sm', icon: Icon, children, className = '', ...rest }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-semibold ${SIZES[size]} ${tones[tone] ?? tones.gray} ${className}`}
      {...rest}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}
