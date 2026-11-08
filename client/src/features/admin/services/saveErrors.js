/**
 * Turn a database error into a message that is safe and useful to show.
 * Raw database text is never shown to the user.
 *
 * @param {{ code?: string, message?: string, details?: string } | null | undefined} error
 * @param {string} what e.g. "product"
 */
export function friendlySaveError(error, what) {
  const text = `${error?.message ?? ''} ${error?.details ?? ''}`;

  switch (error?.code) {
    case '23505':
      return /slug/i.test(text)
        ? 'That slug is already taken. Choose a different one.'
        : `A ${what} with these details already exists.`;
    case '42501':
      return `You do not have permission to change this ${what}.`;
    case 'P0002':
      return `This ${what} no longer exists. Reload the page.`;
    case '23503':
      return 'Choose a valid category and deal tags.';
    case '23514':
      return 'The database rejected some values. Check the prices, stock, colours and images.';
    case '22023':
    case '22P02':
      return 'Some of the data is not valid. Check the form and try again.';
    default:
      return `We could not save the ${what}. Please try again.`;
  }
}
