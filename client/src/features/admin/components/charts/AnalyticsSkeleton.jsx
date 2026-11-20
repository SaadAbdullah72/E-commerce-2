const pulse = 'animate-pulse rounded-lg bg-gray-100';

/** A grey block the size of a KPI card (label, big number, a line). */
function KpiBlock() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className={`${pulse} h-3 w-24`} />
      <div className={`${pulse} mt-3 h-9 w-32`} />
      <div className={`${pulse} mt-3 h-10 w-full`} />
    </div>
  );
}

/** A grey block the size of a chart panel (title, note, the chart area). */
function PanelBlock() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className={`${pulse} h-4 w-40`} />
      <div className={`${pulse} mt-2 h-3 w-56`} />
      <div className={`${pulse} mt-5 h-48 w-full`} />
    </div>
  );
}

/**
 * What the Analytics page looks like while it loads: grey blocks where the KPI cards and chart
 * panels will be, in the same grid, so nothing jumps when the numbers arrive.
 *
 * @param {object} props
 * @param {string} props.label what is loading, for screen readers
 * @param {number} [props.kpis] number of KPI cards (a row of 4 on wide screens)
 * @param {number} [props.panels] number of chart panels (two across on wide screens)
 */
export function AnalyticsSkeleton({ label, kpis = 4, panels = 2 }) {
  return (
    <div role="status" aria-label={`Loading ${label}`} className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: kpis }, (_, index) => (
          <KpiBlock key={index} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: panels }, (_, index) => (
          <PanelBlock key={index} />
        ))}
      </div>
    </div>
  );
}
