export const inputClass =
  'block w-full min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500';

/**
 * A label, the field, an optional hint and the error message, wired together for screen readers.
 * The input itself should use `id={id}` and `aria-describedby` from `describedBy(id, ...)`.
 * The error uses role="alert" on purpose: a form error is urgent and should be read out at once.
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
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
