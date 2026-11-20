/**
 * A row of toggle buttons for filtering a list (one chosen at a time). Each chip is a real
 * button with `aria-pressed`, so keyboard and screen-reader users can use it.
 *
 * @param {object} props
 * @param {string} props.label names the group for screen readers ("Filter by status")
 * @param {{ value: string, label: string, count?: number }[]} props.options
 * @param {string} props.value the chosen option's value
 * @param {(value: string) => void} props.onChange
 */
export default function FilterChips({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 max-md:min-h-11 ${
              selected
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={`text-xs tabular-nums ${selected ? 'text-blue-100' : 'text-gray-500'}`}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
