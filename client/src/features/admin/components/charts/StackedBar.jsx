const TONES = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-blue-600',
  indigo: 'bg-indigo-500',
  gray: 'bg-gray-400',
};

/**
 * One bar split into parts, plus a legend that spells out every number.
 *
 * @param {object} props
 * @param {{ label: string, value: number, tone: keyof typeof TONES }[]} props.segments
 * @param {string} props.emptyText shown when every part is 0
 */
export default function StackedBar({ segments, emptyText }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return <p className="text-sm text-gray-500">{emptyText}</p>;

  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <div
              key={segment.label}
              className={TONES[segment.tone]}
              style={{ width: `${(segment.value / total) * 100}%` }}
            />
          ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-600">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${TONES[segment.tone]}`}
              aria-hidden="true"
            />
            {segment.label}: <span className="font-bold text-gray-900">{segment.value}</span>
            <span className="text-gray-400">({Math.round((segment.value / total) * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
