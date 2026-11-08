import { Eye, EyeOff, Lock } from 'lucide-react';
import { useState } from 'react';

/**
 * Labelled password input with an optional show/hide button.
 *
 * Visibility can be controlled by the parent (pass `visible` and `onToggleVisible`)
 * so several fields in one form can share a single eye toggle. Without them the
 * field keeps its own state.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {string} props.label
 * @param {string} props.value
 * @param {(event: import('react').ChangeEvent<HTMLInputElement>) => void} props.onChange
 * @param {string} [props.name]
 * @param {string} [props.error] Message shown in red; also sets aria-invalid.
 * @param {import('react').ReactNode} [props.hint] Non-error message shown under the field.
 * @param {string} [props.autoComplete]
 * @param {string} [props.placeholder]
 * @param {boolean} [props.showToggle] Render the eye button (default false).
 * @param {boolean} [props.visible]
 * @param {() => void} [props.onToggleVisible]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.required]
 * @param {() => void} [props.onBlur]
 */
export default function PasswordField({
  id,
  label,
  value,
  onChange,
  name,
  error,
  hint,
  autoComplete = 'new-password',
  placeholder,
  showToggle = false,
  visible,
  onToggleVisible,
  disabled = false,
  required = true,
  onBlur,
}) {
  const [internalVisible, setInternalVisible] = useState(false);
  const isControlled = typeof visible === 'boolean' && typeof onToggleVisible === 'function';
  const isVisible = isControlled ? visible : internalVisible;
  const toggle = isControlled ? onToggleVisible : () => setInternalVisible((current) => !current);

  const messageId = `${id}-message`;
  const hasMessage = Boolean(error || hint);

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-bold text-gray-700">
        {label}
      </label>

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          <Lock size={16} aria-hidden="true" />
        </span>

        <input
          id={id}
          name={name ?? id}
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          className={`w-full rounded-xl border bg-gray-50 py-2.5 pl-9 text-xs text-gray-900 transition focus:ring-2 focus:outline-none disabled:opacity-60 ${
            showToggle ? 'pr-10' : 'pr-4'
          } ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
              : 'border-gray-200 focus:border-blue-600 focus:ring-blue-600/20'
          }`}
        />

        {showToggle && (
          <button
            type="button"
            onClick={toggle}
            disabled={disabled}
            aria-label={isVisible ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex cursor-pointer items-center rounded-r-xl px-3 text-gray-500 hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:cursor-not-allowed"
          >
            {isVisible ? (
              <EyeOff size={16} aria-hidden="true" />
            ) : (
              <Eye size={16} aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Always rendered so screen readers announce text that appears later. */}
      <div id={messageId} aria-live="polite" className="mt-1 min-h-[1rem] text-[11px]">
        {error ? <p className="font-medium text-red-600">{error}</p> : hint}
      </div>
    </div>
  );
}
