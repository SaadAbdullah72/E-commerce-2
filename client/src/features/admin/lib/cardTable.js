/**
 * Class strings that turn ONE normal table into a list of cards on a phone (below 768px), with
 * no second copy of the content. The desktop and tablet table is not touched: every class here
 * starts with `max-md:`.
 *
 * How it works on a phone:
 * - the header row is hidden visually (it stays for screen readers),
 * - each row becomes a bordered card,
 * - each cell becomes a "label on the left, value on the right" line. The label comes from the
 *   cell's `data-label` attribute through a CSS pseudo-element, so it is not extra text in the page.
 * - the first cell is the card's title (no label), the actions cell is a footer row.
 *
 * A table whose display is changed can lose its table meaning in some browsers, so the table
 * also carries explicit roles (see `cardTableRoles`).
 */
export const cardTable = {
  table: 'max-md:block max-md:min-w-0',
  head: 'max-md:sr-only',
  body: 'max-md:block max-md:space-y-3 max-md:p-3',
  row: 'max-md:block max-md:rounded-xl max-md:border max-md:border-gray-200 max-md:bg-white max-md:p-3 max-md:shadow-sm max-md:last:border-b',
  cell: 'max-md:flex max-md:items-center max-md:justify-between max-md:gap-3 max-md:px-0 max-md:py-1.5 max-md:text-right max-md:before:shrink-0 max-md:before:text-left max-md:before:text-xs max-md:before:font-semibold max-md:before:text-gray-600 max-md:before:content-[attr(data-label)]',
  titleCell: 'max-md:block max-md:px-0 max-md:pt-0 max-md:pb-2 max-md:text-left max-md:before:hidden',
  actionsCell:
    'max-md:mt-1 max-md:flex max-md:justify-end max-md:border-t max-md:border-gray-100 max-md:px-0 max-md:pt-2 max-md:pb-0 max-md:before:hidden',
};

/** Roles that keep the table meaning when its display is changed (spread onto each element). */
export const cardTableRoles = {
  table: { role: 'table' },
  head: { role: 'rowgroup' },
  body: { role: 'rowgroup' },
  row: { role: 'row' },
  header: { role: 'columnheader' },
  cell: { role: 'cell' },
};
