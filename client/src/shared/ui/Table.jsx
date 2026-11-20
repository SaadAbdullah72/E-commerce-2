/**
 * A table that scrolls sideways on small screens instead of squashing. Pass `maxHeight`
 * (a Tailwind class such as "max-h-[32rem]") to make long tables scroll inside the card with the
 * header row staying in view.
 *
 * @param {object} props
 * @param {string} props.caption describes the table for screen readers (not shown)
 * @param {string} [props.maxHeight]
 */
export function Table({ caption, maxHeight = '', className = '', children, ...rest }) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm ${maxHeight ? `${maxHeight} overflow-y-auto` : ''}`}>
      <table className={`min-w-full border-collapse text-left text-sm ${className}`} {...rest}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function THead({ children, ...rest }) {
  return (
    <thead className="sticky top-0 z-10 bg-gray-50" {...rest}>
      {children}
    </thead>
  );
}

export function TBody({ children, ...rest }) {
  return <tbody {...rest}>{children}</tbody>;
}

/** @param {{ interactive?: boolean } & import('react').HTMLAttributes<HTMLTableRowElement>} props */
export function Tr({ interactive = true, className = '', children, ...rest }) {
  return (
    <tr
      className={`border-b border-gray-100 last:border-b-0 ${interactive ? 'transition-colors duration-150 hover:bg-gray-50' : ''} ${className}`}
      {...rest}
    >
      {children}
    </tr>
  );
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' };

/** @param {{ align?: 'left' | 'right' | 'center' } & import('react').ThHTMLAttributes<HTMLTableCellElement>} props */
export function Th({ align = 'left', className = '', children, ...rest }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-gray-200 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-600 ${ALIGN[align]} ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

/** @param {{ align?: 'left' | 'right' | 'center', numeric?: boolean } & import('react').TdHTMLAttributes<HTMLTableCellElement>} props */
export function Td({ align = 'left', numeric = false, className = '', children, ...rest }) {
  return (
    <td
      className={`px-4 py-3 text-gray-700 ${numeric ? 'tabular-nums' : ''} ${ALIGN[align]} ${className}`}
      {...rest}
    >
      {children}
    </td>
  );
}
