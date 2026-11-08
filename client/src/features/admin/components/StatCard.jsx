/**
 * One number on the overview. It has its own loading and error state, so a failed query shows
 * an error (never a made-up 0).
 *
 * @param {object} props
 * @param {string} props.label
 * @param {{ data?: number, isPending: boolean, isError: boolean, refetch: () => void }} [props.query]
 * @param {string} [props.note] shown instead of a number when there is no query yet
 * @param {'default' | 'warning' | 'danger'} [props.tone]
 */
export default function StatCard({ label, query, note, tone = 'default' }) {
  const valueColor =
    tone === 'danger' ? 'text-red-600' : tone === 'warning' ? 'text-amber-600' : 'text-gray-900';

  let body;
  if (!query) {
    body = (
      <>
        <p className="text-2xl font-black text-gray-300">&mdash;</p>
        <p className="mt-1 text-[11px] text-gray-400">{note}</p>
      </>
    );
  } else if (query.isPending) {
    body = (
      <div
        role="status"
        aria-label={`Loading ${label}`}
        className="h-8 w-16 animate-pulse rounded bg-gray-100"
      />
    );
  } else if (query.isError) {
    body = (
      <p role="alert" className="text-xs text-red-600">
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
    body = <p className={`text-2xl font-black ${valueColor}`}>{query.data.toLocaleString()}</p>;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
      <h3 className="mb-2 text-xs font-semibold text-gray-500">{label}</h3>
      {body}
    </div>
  );
}
