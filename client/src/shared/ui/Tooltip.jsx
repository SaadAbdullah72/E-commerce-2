import { cloneElement, useId, useState } from 'react';

/**
 * A short explanation that appears on hover and on keyboard focus (Escape hides it). The child
 * must be a single element that can take focus (a button, a link). It gets `aria-describedby`
 * while the tip is showing.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.content
 * @param {import('react').ReactElement} props.children
 */
export default function Tooltip({ content, children }) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      {cloneElement(children, { 'aria-describedby': open ? id : undefined })}
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-40 mb-2 w-max max-w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal leading-snug text-white shadow-lg"
        >
          {content}
        </span>
      )}
    </span>
  );
}
