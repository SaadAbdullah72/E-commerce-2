const MEDIA_MESSAGES = {
  too_many: 'You can add up to 3 photos and 1 video.',
  size: 'A file is too large. Photos can be up to 5 MB and videos up to 10 MB.',
  type: 'One of your files is not a supported type. Use JPG, PNG or WebP photos and MP4 or WebM videos.',
  duration: 'Videos can be up to 60 seconds.',
};
const MEDIA_FALLBACK =
  'One of your files was not uploaded properly. Remove it, add it again and try once more.';

/**
 * Words for a refused review action. Raw database text is never shown.
 * @param {{ code?: string, message?: string, details?: string } | null | undefined} error
 */
export function friendlyReviewError(error) {
  switch (error?.message) {
    case 'not_purchased':
      return 'Only customers who bought this product can review it.';
    case 'already_reviewed':
      return "You've already reviewed this product. Edit your existing review.";
    case 'rate_limited':
      return 'Too many uploads. Please try again in an hour.';
    case 'product_not_found':
      return 'Product not found.';
    case 'review_not_found':
      return 'This review no longer exists. Reload the page.';
    case 'rating_invalid':
      return 'Please choose a star rating from 1 to 5.';
    case 'text_invalid':
      return error.details === 'title'
        ? 'Your title is too long or has characters that are not allowed.'
        : 'Your comment is too long or has characters that are not allowed.';
    case 'media_invalid':
      return MEDIA_MESSAGES[error.details] ?? MEDIA_FALLBACK;
    case 'not_signed_in':
      return 'Please sign in again to review this product.';
    default:
  }
  if (error?.code === '42501') return 'Please sign in again to review this product.';
  return 'We could not save your review. Please try again.';
}
