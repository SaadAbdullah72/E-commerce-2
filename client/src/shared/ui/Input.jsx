import { controlClass } from './controlStyles';

/**
 * A text input. The label belongs above it (use FormField, which also wires `aria-describedby`
 * for hints and errors). Icons sit inside the field; the padding is handled here.
 *
 * @param {object} props
 * @param {boolean} [props.invalid] red border and ring; also sets aria-invalid
 * @param {import('react').ReactNode} [props.leadingIcon] a decorative icon at the start
 * @param {import('react').ReactNode} [props.trailingIcon] a decorative icon at the end
 */
export function Input({ invalid = false, leadingIcon, trailingIcon, className = '', ref, ...rest }) {
  const padding = `${leadingIcon ? 'pl-10' : ''} ${trailingIcon ? 'pr-10' : ''}`;
  const field = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`${controlClass({ invalid })} ${padding} ${className}`}
      {...rest}
    />
  );
  if (!leadingIcon && !trailingIcon) return field;

  return (
    <div className="relative">
      {leadingIcon && (
        <span
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-500"
          aria-hidden="true"
        >
          {leadingIcon}
        </span>
      )}
      {field}
      {trailingIcon && (
        <span
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500"
          aria-hidden="true"
        >
          {trailingIcon}
        </span>
      )}
    </div>
  );
}

/** @param {{ invalid?: boolean } & import('react').SelectHTMLAttributes<HTMLSelectElement>} props */
export function Select({ invalid = false, className = '', children, ref, ...rest }) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`${controlClass({ invalid })} ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

/** @param {{ invalid?: boolean } & import('react').TextareaHTMLAttributes<HTMLTextAreaElement>} props */
export function Textarea({ invalid = false, className = '', ref, ...rest }) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`${controlClass({ invalid, multiline: true })} ${className}`}
      {...rest}
    />
  );
}
