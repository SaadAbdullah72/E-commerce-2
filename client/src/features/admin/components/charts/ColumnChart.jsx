import { ChartColumn } from 'lucide-react';
import { useState } from 'react';

import EmptyState from '@/shared/ui/EmptyState';

import { niceScale, shortDay } from '../../lib/chartScale';

const SLOT = 10; // each day is 10 units wide in the drawing; the bar is 8 of them
const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

/**
 * One value per day. Bars by default; a line when there are only a few days with data
 * (`lineBelow`), because a couple of lone bars look odd.
 *
 * The bars and the line are an SVG; the numbers (axis, average, tooltip) are plain HTML on top,
 * because text inside a stretched SVG would be stretched too. Nothing is hover-only: the total,
 * the daily average and the best day are written out above the chart, every bar has a `<title>`,
 * and the whole chart has a text summary for screen readers.
 *
 * @param {object} props
 * @param {{ day: string, count: number, extra?: string }[]} props.points oldest first; `extra` is a second line in the tooltip
 * @param {string} props.unit e.g. "sign-ups" or "in revenue"
 * @param {(value: number) => string} [props.formatValue] how a value is written (money, for example)
 * @param {(value: number) => string} [props.formatTick] a short version for the axis
 * @param {boolean} [props.integer] counts: the axis uses whole numbers
 * @param {number} [props.lineBelow] draw a line when fewer than this many days have data (0 = always bars)
 * @param {string} [props.emptyText] shown when there is nothing to draw
 */
export default function ColumnChart({
  points,
  unit,
  formatValue,
  formatTick,
  integer = false,
  lineBelow = 0,
  emptyText = 'No data for this period.',
}) {
  const [hovered, setHovered] = useState(null);

  const total = points.reduce((sum, point) => sum + point.count, 0);
  if (points.length === 0 || total === 0) {
    return <EmptyState icon={ChartColumn} message={emptyText} />;
  }

  const describe = (value) => (formatValue ? formatValue(value) : `${value.toLocaleString()} ${unit}`);
  // the same, always with the unit, for the text read out to screen readers ("$10.00 in revenue")
  const spoken = (value) => (formatValue ? `${formatValue(value)} ${unit}` : describe(value));
  const tick = formatTick ?? ((value) => value.toLocaleString());

  const days = points.length;
  const max = Math.max(...points.map((point) => point.count));
  const bestIndex = points.findIndex((point) => point.count === max);
  const average = total / days;
  const scale = niceScale(max, { integer });
  const percent = (value) => (value / scale.top) * 100;
  const daysWithData = points.filter((point) => point.count > 0).length;
  const asLine = lineBelow > 0 && daysWithData < lineBelow;

  const first = shortDay(points[0].day);
  const last = shortDay(points[days - 1].day);
  const labelEvery = days > 14 ? 4 : days > 7 ? 2 : 1;
  const hover = hovered === null ? null : points[hovered];

  return (
    <figure onMouseLeave={() => setHovered(null)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-sm text-gray-600">
          Daily average <strong className="font-semibold text-gray-900">{describe(Math.round(average))}</strong>
          <span aria-hidden="true"> · </span>
          Best day{' '}
          <strong className="font-semibold text-gray-900">
            {shortDay(points[bestIndex].day)} ({describe(max)})
          </strong>
        </p>
        <p className="text-sm text-gray-600">
          Total <strong className="text-lg font-bold tabular-nums text-gray-900">{describe(total)}</strong>
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative h-48 w-12 shrink-0" aria-hidden="true">
          {scale.ticks.map((value) => (
            <span
              key={value}
              className="absolute right-0 translate-y-1/2 text-xs tabular-nums text-gray-500"
              style={{ bottom: `${percent(value)}%` }}
            >
              {tick(value)}
            </span>
          ))}
        </div>

        <div className="relative h-48 min-w-0 flex-1">
          {scale.ticks.map((value) => (
            <div
              key={value}
              aria-hidden="true"
              className={`absolute inset-x-0 border-t ${value === 0 ? 'border-gray-300' : 'border-gray-100'}`}
              style={{ bottom: `${percent(value)}%` }}
            />
          ))}

          <svg
            viewBox={`0 0 ${days * SLOT} 100`}
            role="img"
            aria-label={`${spoken(total)} between ${first} and ${last}`}
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
          >
            <desc>
              {`${asLine ? 'Line' : 'Column'} chart of ${unit} per day from ${first} to ${last}. Total ${spoken(total)}, best day ${shortDay(points[bestIndex].day)} with ${spoken(max)}.`}
            </desc>
            {asLine ? (
              <polyline
                fill="none"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="stroke-blue-600"
                points={points
                  .map((point, index) => `${index * SLOT + SLOT / 2},${100 - percent(point.count)}`)
                  .join(' ')}
              />
            ) : (
              points.map((point, index) => {
                const empty = point.count === 0;
                // an empty day is a thin grey line (about 2px), never a missing bar
                const height = empty ? 1.1 : Math.max(percent(point.count), 1.5);
                const tone = empty
                  ? 'fill-gray-200'
                  : hovered === index
                    ? 'fill-blue-700'
                    : index === bestIndex
                      ? 'fill-blue-600'
                      : 'fill-blue-400';
                return (
                  <rect
                    key={point.day}
                    x={index * SLOT + 1}
                    y={100 - height}
                    width={SLOT - 2}
                    height={height}
                    className={`${tone} transition-colors duration-150`}
                  >
                    <title>{`${shortDay(point.day)}: ${describe(point.count)}`}</title>
                  </rect>
                );
              })
            )}
          </svg>

          {asLine &&
            points.map((point, index) =>
              point.count > 0 ? (
                <span
                  key={point.day}
                  aria-hidden="true"
                  className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-blue-600 ring-2 ring-white"
                  style={{ left: `${((index + 0.5) / days) * 100}%`, bottom: `${percent(point.count)}%` }}
                />
              ) : null,
            )}

          {average > 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-gray-400"
              style={{ bottom: `${percent(average)}%` }}
            >
              <span className="absolute right-0 -translate-y-full whitespace-nowrap rounded bg-white/90 px-1 text-xs text-gray-600">
                Avg {tick(Math.round(average))}
              </span>
            </div>
          )}

          {/* One hover/touch zone per day. It is not focusable: the numbers are written out above. */}
          <div className="absolute inset-0 flex" aria-hidden="true">
            {points.map((point, index) => (
              <div
                key={point.day}
                className="h-full flex-1"
                onMouseEnter={() => setHovered(index)}
                onTouchStart={() => setHovered(index)}
              />
            ))}
          </div>

          {hover && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute z-10 w-max max-w-48 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
              style={{
                left: `${clamp(((hovered + 0.5) / days) * 100, 14, 86)}%`,
                bottom: `calc(${Math.min(percent(hover.count), 78)}% + 0.75rem)`,
              }}
            >
              <p className="font-semibold">{shortDay(hover.day)}</p>
              <p className="tabular-nums">{describe(hover.count)}</p>
              {hover.extra && <p className="text-gray-300">{hover.extra}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="relative ml-14 mt-1 h-5" aria-hidden="true">
        {points.map((point, index) =>
          index % labelEvery === 0 ? (
            <span
              key={point.day}
              // on a phone every other label goes, so they never run into each other
              className={`absolute -translate-x-1/2 whitespace-nowrap text-xs text-gray-500 ${
                index % (labelEvery * 2) === 0 ? '' : 'max-sm:hidden'
              }`}
              style={{ left: `${((index + 0.5) / days) * 100}%` }}
            >
              {shortDay(point.day)}
            </span>
          ) : null,
        )}
      </div>
    </figure>
  );
}
