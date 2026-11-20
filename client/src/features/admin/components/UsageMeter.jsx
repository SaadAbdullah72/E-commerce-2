/**
 * "3 / 10" with a bar under it. With no limit it says "unlimited" and draws no bar.
 *
 * @param {{ used: number, limit: number | null }} props
 */
export default function UsageMeter({ used, limit }) {
  const hasLimit = limit !== null && limit !== undefined;
  const share = hasLimit && limit > 0 ? Math.min(used / limit, 1) : 0;
  const full = hasLimit && used >= limit;
  return (
    <div className="w-24">
      <span className="tabular-nums text-gray-700">
        {used} / {limit ?? 'unlimited'}
      </span>
      {hasLimit && (
        <div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full ${full ? 'bg-red-600' : 'bg-blue-600'}`}
            style={{ width: `${share * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
