import { useState } from 'react';

// Every bar colour keeps its label readable (4.5:1): white on the dark ones, near-black on amber and grey.
const TONES = {
  green: 'bg-green-700 text-white',
  amber: 'bg-amber-400 text-amber-950',
  red: 'bg-red-600 text-white',
  blue: 'bg-blue-600 text-white',
  purple: 'bg-purple-600 text-white',
  indigo: 'bg-purple-600 text-white', // the old name for purple
  gray: 'bg-gray-300 text-gray-900',
};

const LABEL_FROM = 0.15; // a segment wider than this shows its percentage inside

/**
 * One bar split into parts, plus a legend that spells out every number, so nothing depends on
 * seeing colours or hovering. Hovering (or touching) a part also shows its count and share.
 *
 * @param {object} props
 * @param {{ label: string, value: number, tone: keyof typeof TONES }[]} props.segments in the order they should read (for orders: paid, shipped, delivered, cancelled)
 * @param {string} props.emptyText shown when every part is 0
 * @param {string} [props.totalLabel] what is being counted ("orders"), for the "Total: N orders" line
 */
export default function StackedBar({ segments, emptyText, totalLabel }) {
  const [hovered, setHovered] = useState(null);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return <p className="text-sm text-gray-600">{emptyText}</p>;

  const shown = segments.filter((segment) => segment.value > 0);
  const percent = (value) => Math.round((value / total) * 100);

  // where the hovered segment's middle is, as a % of the bar
  let centre = 0;
  let active = null;
  let before = 0;
  for (const segment of shown) {
    if (segment.label === hovered) {
      active = segment;
      centre = ((before + segment.value / 2) / total) * 100;
    }
    before += segment.value;
  }

  return (
    <div onMouseLeave={() => setHovered(null)}>
      <div className="relative">
        <div className="flex h-8 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
          {shown.map((segment) => (
            <div
              key={segment.label}
              className={`flex items-center justify-center text-xs font-semibold tabular-nums transition-opacity duration-150 ${TONES[segment.tone]} ${
                hovered && hovered !== segment.label ? 'opacity-60' : ''
              }`}
              style={{ width: `${(segment.value / total) * 100}%` }}
              onMouseEnter={() => setHovered(segment.label)}
              onTouchStart={() => setHovered(segment.label)}
            >
              {segment.value / total > LABEL_FROM ? `${percent(segment.value)}%` : null}
            </div>
          ))}
        </div>
        {active && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full z-10 mb-2 w-max -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
            style={{ left: `${Math.min(Math.max(centre, 15), 85)}%` }}
          >
            <p className="font-semibold">{active.label}</p>
            <p className="tabular-nums">
              {active.value.toLocaleString()} ({percent(active.value)}%)
            </p>
          </div>
        )}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-600">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${TONES[segment.tone].split(' ')[0]}`}
              aria-hidden="true"
            />
            {segment.label}: <span className="font-bold text-gray-900">{segment.value}</span>
            <span className="text-gray-500">({percent(segment.value)}%)</span>
          </li>
        ))}
      </ul>
      {totalLabel && (
        <p className="mt-2 text-sm text-gray-600">
          Total: <strong className="font-semibold tabular-nums text-gray-900">{total.toLocaleString()}</strong>{' '}
          {totalLabel}
        </p>
      )}
    </div>
  );
}
