import { AlertTriangle, PackageSearch } from 'lucide-react';

/** Grey placeholder cards shown while products load. */
export function ProductGridSkeleton({ count = 8, className = '' }) {
  return (
    <div
      role="status"
      aria-label="Loading products"
      className={`grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 ${className}`}
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="animate-pulse overflow-hidden rounded-xl border border-gray-100 bg-white"
        >
          <div className="aspect-square bg-gray-100" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-4/5 rounded bg-gray-100" />
            <div className="h-3 w-2/5 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} [props.message]
 * @param {() => void} [props.onRetry]
 */
export function CatalogError({ message = "We couldn't load this right now.", onRetry }) {
  return (
    <div role="alert" className="rounded-xl border border-red-100 bg-white p-10 text-center">
      <AlertTriangle size={32} className="mx-auto mb-2 text-red-400" aria-hidden="true" />
      <p className="text-sm font-bold text-gray-800">{message}</p>
      <p className="mt-1 text-xs text-gray-500">Check your connection and try again.</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 cursor-pointer rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.text]
 */
export function CatalogEmpty({ title, text }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-12 text-center">
      <PackageSearch size={36} className="mx-auto mb-2 text-gray-300" aria-hidden="true" />
      <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      {text && <p className="mt-1 text-xs text-gray-500">{text}</p>}
    </div>
  );
}
