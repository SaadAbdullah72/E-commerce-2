import { ChartBar } from 'lucide-react';
import { Link } from 'react-router-dom';

import EmptyState from '@/shared/ui/EmptyState';

/**
 * A horizontal bar per row, drawn with plain CSS. The numbers are written out as text, so the
 * chart can be read without seeing the bars. Rows are expected biggest first; each bar is sized
 * against the biggest one.
 *
 * @param {object} props
 * @param {{ id: string, label: string, value: number, extra?: string, href?: string }[]} props.rows `href` turns the name into a link
 * @param {string} props.emptyText
 */
export default function HBarChart({ rows, emptyText }) {
  if (rows.length === 0) return <EmptyState icon={ChartBar} message={emptyText} />;
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id}>
          <div className="mb-1 flex items-start justify-between gap-3 text-sm">
            <span className="line-clamp-2 min-w-0 font-semibold text-gray-800">
              {row.href ? (
                <Link to={row.href} className="rounded hover:text-blue-700 hover:underline">
                  {row.label}
                </Link>
              ) : (
                row.label
              )}
            </span>
            <span className="shrink-0 text-right text-xs text-gray-600">
              <span className="text-sm font-bold tabular-nums text-gray-900">{row.value}</span>
              {row.extra ? <span> {row.extra}</span> : null}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
            <div
              className="h-full rounded-full bg-blue-600 transition-[width] duration-150"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
