/**
 * Grey pulsing rows shown while a list loads (instead of a spinner), so the page does not jump
 * when the data arrives.
 *
 * @param {object} props
 * @param {string} props.label what is loading, for screen readers ("Loading orders")
 * @param {number} [props.rows]
 * @param {number} [props.columns]
 */
export default function TableSkeleton({ label, rows = 5, columns = 4 }) {
  return (
    <div role="status" aria-label={`Loading ${label}`} className="space-y-2 p-4">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-4">
          {Array.from({ length: columns }, (_, column) => (
            <div
              key={column}
              className={`h-10 animate-pulse rounded-lg bg-gray-100 ${column === 0 ? 'flex-[2]' : 'flex-1'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
