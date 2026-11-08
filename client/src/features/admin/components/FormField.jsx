export const inputClass =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100';

/**
 * A label, the field, an optional hint and the error message, wired together for screen readers.
 * The input itself should use `id={id}` and `aria-describedby` from `describedBy(id, ...)`.
 *
 * @param {object} props
 * @param {string} props.id the id of the input
 * @param {string} props.label
 * @param {string} [props.error]
 * @param {string} [props.hint]
 * @param {import('react').ReactNode} props.children
 */
export default function FormField({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-gray-700">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-[11px] text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[11px] font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
