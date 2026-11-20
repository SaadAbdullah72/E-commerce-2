import { shortDay } from '../../lib/chartScale';

const WIDTH = 100;
const HEIGHT = 40;

/**
 * A tiny trend line (40px high) for a card. Hovering a day shows its exact value (each day has a
 * `<title>`), and the whole thing has a text name for screen readers.
 *
 * @param {object} props
 * @param {{ day: string, count: number }[]} props.points oldest first
 * @param {(value: number) => string} props.formatValue
 * @param {string} props.label e.g. "Last 7 days" (the text name for screen readers)
 * @param {string} [props.caption] a visible line under the chart, so it is clear what the days are
 */
export default function Sparkline({ points, formatValue, label, caption }) {
  if (points.length < 2) return null;
  const max = Math.max(...points.map((point) => point.count), 1);
  const slot = WIDTH / points.length;
  const coordinates = points.map((point, index) => ({
    x: index * slot + slot / 2,
    y: HEIGHT - 3 - (point.count / max) * (HEIGHT - 6),
  }));
  const line = coordinates.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${coordinates[0].x},${HEIGHT} ${line} ${coordinates[coordinates.length - 1].x},${HEIGHT}`;

  return (
    <>
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}, ${points.length} days`}
      className="h-10 w-full text-blue-600"
    >
      <polygon points={area} className="fill-blue-50" />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {points.map((point, index) => (
        <rect
          key={point.day}
          x={index * slot}
          y="0"
          width={slot}
          height={HEIGHT}
          fill="transparent"
        >
          <title>{`${shortDay(point.day)}: ${formatValue(point.count)}`}</title>
        </rect>
      ))}
    </svg>
    {caption && <p className="mt-1 text-xs text-gray-500">{caption}</p>}
    </>
  );
}
