/**
 * Shared loading / error / empty states for admin lists.
 *
 * @param {object} props
 * @param {{ isPending: boolean, isError: boolean, refetch: () => void }} props.query
 * @param {boolean} props.isEmpty
 * @param {string} props.emptyText
 * @param {string} props.label what is loading, for screen readers
 * @param {import('react').ReactNode} props.children shown when there is data
 */
export default function QueryState({ query, isEmpty, emptyText, label, children }) {
  if (query.isPending) {
    return (
      <div role="status" aria-label={`Loading ${label}`} className="space-y-2 p-4">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="h-10 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className="p-6 text-center text-sm text-red-600">
        We couldn&apos;t load the {label}.{' '}
        <button
          type="button"
          onClick={() => query.refetch()}
          className="cursor-pointer font-bold underline"
        >
          Try again
        </button>
      </div>
    );
  }
  if (isEmpty) return <p className="p-6 text-center text-sm text-gray-500">{emptyText}</p>;
  return children;
}
