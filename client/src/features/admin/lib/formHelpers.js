/** The aria-describedby value for an input that sits in a FormField. */
export function describedBy(id, { error, hint } = {}) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}
