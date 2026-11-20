/**
 * A log grouped by day: each group has a date heading and a list of entries. An entry can carry
 * extra detail that opens on demand.
 *
 * @param {object} props
 * @param {{
 *   label: string,
 *   items: {
 *     id: string,
 *     time: string,
 *     icon?: import('react').ComponentType<{ size?: number, 'aria-hidden'?: boolean }>,
 *     title: import('react').ReactNode,
 *     meta?: string,
 *     details?: import('react').ReactNode,
 *   }[],
 * }[]} props.groups
 * @param {string} [props.detailsLabel] text of the control that opens an entry's detail
 */
export default function Timeline({ groups, detailsLabel = 'Show changes' }) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-600">
            {group.label}
          </h3>
          <ol className="space-y-1 border-l border-gray-200 pl-4">
            {group.items.map((item, index) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.id}
                  className={`relative rounded-lg px-3 py-2.5 ${index % 2 === 0 ? 'bg-gray-50/70' : ''}`}
                >
                  <span
                    className="absolute -left-[1.6rem] top-3 flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500"
                    aria-hidden="true"
                  >
                    {Icon ? <Icon size={12} aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />}
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <time className="text-xs tabular-nums text-gray-500">{item.time}</time>
                    <span className="text-sm text-gray-900">{item.title}</span>
                  </div>
                  {item.meta && <p className="mt-0.5 text-xs text-gray-500">{item.meta}</p>}
                  {item.details && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        {detailsLabel}
                      </summary>
                      <div className="mt-2 text-sm text-gray-700">{item.details}</div>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
