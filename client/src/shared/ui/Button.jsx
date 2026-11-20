import { LoaderCircle } from 'lucide-react';

import { buttonClass } from './buttonStyles';

/**
 * @param {object} props
 * @param {'primary' | 'secondary' | 'danger' | 'ghost'} [props.variant]
 * @param {'sm' | 'md' | 'lg'} [props.size]
 * @param {boolean} [props.loading] shows a spinner, disables the button and sets aria-busy
 * @param {string} [props.loadingText] what the button says while loading
 * @param {boolean} [props.iconOnly] a square button with only an icon: it MUST have an aria-label
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText = 'Loading...',
  iconOnly = false,
  type = 'button',
  disabled = false,
  className = '',
  children,
  ref,
  ...rest
}) {
  if (iconOnly && import.meta.env.DEV && !rest['aria-label']) {
    console.warn('Button: an icon-only button needs an aria-label.');
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, iconOnly, className })}
      {...rest}
    >
      {loading ? (
        <>
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          {iconOnly ? <span className="sr-only">{loadingText}</span> : loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
