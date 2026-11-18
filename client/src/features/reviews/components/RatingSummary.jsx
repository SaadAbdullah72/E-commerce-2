import { Star } from 'lucide-react';

/**
 * Average, count and one bar per star. A bar is a button: click it to see only those reviews,
 * click it again to see all. Not shown when there are no reviews.
 *
 * @param {{ summary: { average: number, count: number, stars: Record<number, number> },
 *   selected: number | null, onSelect: (rating: number | null) => void }} props
 */
export default function RatingSummary({ summary, selected, onSelect }) {
  if (summary.count === 0) return null;

  return (
    <div className="grid gap-4 border-b border-gray-100 py-4 sm:grid-cols-[auto_1fr] sm:items-center">
      <div className="text-center sm:px-4">
        <p className="text-3xl font-black text-gray-900">{summary.average.toFixed(1)}</p>
        <div className="flex justify-center" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((index) => (
            <Star
              key={index}
              size={14}
              className={
                index <= Math.round(summary.average)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-gray-200'
              }
            />
          ))}
        </div>
        <p className="mt-0.5 text-[11px] text-gray-500">
          {summary.count} {summary.count === 1 ? 'review' : 'reviews'}
        </p>
      </div>

      <ul aria-label="Reviews by rating" className="space-y-1">
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = summary.stars[stars] ?? 0;
          const percent = Math.round((count / summary.count) * 100);
          const active = selected === stars;
          return (
            <li key={stars}>
              <button
                type="button"
                aria-pressed={active}
                disabled={count === 0 && !active}
                aria-label={`${stars} ${stars === 1 ? 'star' : 'stars'}: ${count} ${
                  count === 1 ? 'review' : 'reviews'
                }${active ? ', selected' : ''}`}
                onClick={() => onSelect(active ? null : stars)}
                className={`flex w-full cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-gray-50 disabled:cursor-default disabled:opacity-50 ${
                  active ? 'bg-blue-50 font-bold' : ''
                }`}
              >
                <span className="w-9 text-left text-gray-700">{stars} star</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-amber-400"
                    style={{ width: `${percent}%` }}
                  />
                </span>
                <span className="w-8 text-right text-gray-500">{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
