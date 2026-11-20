import { TrendingDown, TrendingUp } from 'lucide-react';

import { valueTone } from '@/shared/design/tokens';

/**
 * One number on the overview. It has its own loading and error state, so a failed query shows
 * an error (never a made-up 0).
 *
 * @param {object} props
 * @param {string} props.label
 * @param {{ data?: number | string, isPending: boolean, isError: boolean, refetch: () => void }} [props.query]
 * @param {string} [props.note] shown instead of a number when there is no query yet
 * @param {'default' | 'warning' | 'danger' | 'success' | 'info'} [props.tone] colour of the number
 * @param {import('react').ComponentType<{ size?: number, 'aria-hidden'?: boolean }>} [props.icon] a muted lucide icon, top right
 * @param {{ text: string, direction: 'up' | 'down' }} [props.trend] e.g. "12% from last week"
 */
export default function StatCard({ label, query, note, tone = 'default', icon: Icon, trend }) {
  let body;
  if (!query) {
    body = (
      <>
        <p className="text-3xl font-bold text-gray-300">&mdash;</p>
        <p className="mt-1 text-xs text-gray-500">{note}</p>
      </>
    );
  } else if (query.isPending) {
    body = (
      <div
        role="status"
        aria-label={`Loading ${label}`}
        className="h-9 w-24 animate-pulse rounded-lg bg-gray-100"
      />
    );
  } else if (query.isError) {
    body = (
      <p role="alert" className="text-xs text-red-700">
        Couldn&apos;t load.{' '}
        <button
          type="button"
          onClick={() => query.refetch()}
          className="cursor-pointer font-bold underline"
        >
          Retry
        </button>
      </p>
    );
  } else {
    body = (
      <p className={`text-3xl font-bold tabular-nums ${valueTone[tone] ?? valueTone.default}`}>
        {typeof query.data === 'number' ? query.data.toLocaleString() : query.data}
      </p>
    );
  }

  const TrendIcon = trend?.direction === 'down' ? TrendingDown : TrendingUp;

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      {Icon && (
        <Icon
          size={18}
          className="absolute right-4 top-4 text-gray-400 sm:right-6 sm:top-6"
          aria-hidden="true"
        />
      )}
      <h3 className="mb-2 pr-8 text-xs font-semibold text-gray-600">{label}</h3>
      {body}
      {trend && query && !query.isPending && !query.isError && (
        <p
          className={`mt-2 flex items-center gap-1 text-xs font-medium ${
            trend.direction === 'down' ? 'text-red-700' : 'text-green-700'
          }`}
        >
          <TrendIcon size={14} aria-hidden="true" />
          {trend.text}
        </p>
      )}
    </div>
  );
}
