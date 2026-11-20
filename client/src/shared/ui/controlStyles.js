const BASE =
  'block w-full rounded-lg border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500';

/**
 * The classes shared by every text control (input, select, textarea).
 *
 * @param {{ invalid?: boolean, multiline?: boolean }} [options]
 */
export function controlClass({ invalid = false, multiline = false } = {}) {
  const height = multiline ? 'min-h-20 py-2' : 'h-10';
  const colour = invalid
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500';
  return `${BASE} ${height} ${colour}`;
}
