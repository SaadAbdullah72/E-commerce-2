/**
 * A white card. `interactive` cards lift a little on hover (use it for cards that are links).
 *
 * @param {object} props
 * @param {boolean} [props.interactive]
 * @param {boolean} [props.flush] no padding, for cards that hold a table or a list edge to edge
 * @param {keyof JSX.IntrinsicElements} [props.as]
 */
export function Card({ interactive = false, flush = false, as: Tag = 'div', className = '', children, ...rest }) {
  const padding = flush ? '' : 'p-4 sm:p-6';
  const hover = interactive
    ? 'transition-all duration-150 hover:border-gray-300 hover:shadow-md'
    : '';
  return (
    <Tag
      className={`rounded-xl border border-gray-200 bg-white shadow-sm ${padding} ${hover} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** A card's top part, separated from the body by a line. */
export function CardHeader({ className = '', children, ...rest }) {
  return (
    <div className={`border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** A card's bottom part (usually actions), separated by a line. */
export function CardFooter({ className = '', children, ...rest }) {
  return (
    <div
      className={`flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
