const WIDTH = 300;
const HEIGHT = 90;
const GAP = 2;

const shortDay = (day) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/**
 * A column per day, drawn as an SVG. Every bar carries its own tooltip text, and the whole
 * chart has a written summary for screen readers.
 *
 * @param {object} props
 * @param {{ day: string, count: number }[]} props.points oldest first
 * @param {string} props.unit e.g. "sign-ups"
 */
export default function ColumnChart({ points, unit }) {
  if (points.length === 0) return null;

  const total = points.reduce((sum, point) => sum + point.count, 0);
  const max = Math.max(...points.map((point) => point.count), 1);
  const slot = WIDTH / points.length;
  const first = shortDay(points[0].day);
  const last = shortDay(points[points.length - 1].day);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${total} ${unit} between ${first} and ${last}`}
        className="h-32 w-full text-blue-600"
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          y1={HEIGHT - 0.5}
          x2={WIDTH}
          y2={HEIGHT - 0.5}
          stroke="currentColor"
          className="text-gray-200"
          strokeWidth="1"
        />
        {points.map((point, index) => {
          const height = point.count === 0 ? 0 : Math.max((point.count / max) * (HEIGHT - 6), 2);
          return (
            <rect
              key={point.day}
              x={index * slot + GAP / 2}
              y={HEIGHT - height}
              width={Math.max(slot - GAP, 1)}
              height={height}
              rx="1"
              fill="currentColor"
            >
              <title>{`${shortDay(point.day)}: ${point.count} ${unit}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[11px] text-gray-400">
        <span>{first}</span>
        <span>{last}</span>
      </figcaption>
    </figure>
  );
}
