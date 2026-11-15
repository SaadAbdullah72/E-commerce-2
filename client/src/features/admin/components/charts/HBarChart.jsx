/**
 * A horizontal bar per row, drawn with plain CSS. The numbers are written out as text, so the
 * chart can be read without seeing the bars.
 *
 * @param {object} props
 * @param {{ id: string, label: string, value: number, extra?: string }[]} props.rows
 * @param {string} props.emptyText
 */
export default function HBarChart({ rows, emptyText }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">{emptyText}</p>;
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.id}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-semibold text-gray-700">{row.label}</span>
            <span className="shrink-0 text-gray-500">
              <span className="font-bold text-gray-900">{row.value}</span>
              {row.extra ? <span> {row.extra}</span> : null}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
