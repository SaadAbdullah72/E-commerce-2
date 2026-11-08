/**
 * Labelled text/email input with a leading icon and an accessible error message.
 *
 * @param {object} props
 * @param {string} props.id
 * @param {string} props.label
 * @param {string} props.value
 * @param {(event: import('react').ChangeEvent<HTMLInputElement>) => void} props.onChange
 * @param {string} [props.type]
 * @param {string} [props.name]
 * @param {string} [props.error]
 * @param {import('react').ComponentType<{ size?: number }>} [props.icon]
 * @param {string} [props.autoComplete]
 * @param {string} [props.placeholder]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.required]
 * @param {number} [props.maxLength]
 * @param {() => void} [props.onBlur]
 */
export default function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  name,
  error,
  icon: Icon,
  autoComplete,
  placeholder,
  disabled = false,
  required = true,
  maxLength,
  onBlur,
}) {
  const messageId = `${id}-message`;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-bold text-gray-700">
        {label}
      </label>

      <div className="relative">
        {Icon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <Icon size={16} aria-hidden="true" />
          </span>
        )}

        <input
          id={id}
          name={name ?? id}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? messageId : undefined}
          className={`w-full rounded-xl border bg-gray-50 py-2.5 pr-4 text-xs text-gray-900 transition focus:ring-2 focus:outline-none disabled:opacity-60 ${
            Icon ? 'pl-9' : 'pl-3'
          } ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
              : 'border-gray-200 focus:border-blue-600 focus:ring-blue-600/20'
          }`}
        />
      </div>

      <div id={messageId} aria-live="polite" className="mt-1 min-h-[1rem] text-[11px]">
        {error && <p className="font-medium text-red-600">{error}</p>}
      </div>
    </div>
  );
}
