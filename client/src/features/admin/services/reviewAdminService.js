import { supabase } from '@/lib/supabase/client';

import { isUuid } from '../../checkout/services/checkoutService';

export const ADMIN_REVIEWS_PAGE_SIZE = 25;

const STATUSES = ['pending', 'approved', 'rejected'];
const LIST_FAILED = "We couldn't load the reviews. Please try again.";
const AUDIT_COLUMNS = 'id, created_at, actor_email, action, summary, changes';

/**
 * One page of the moderation queue, newest first. The search text is sent as a function argument
 * (never inside a filter string), so it can only ever be matched literally.
 *
 * @param {{ status?: string, rating?: number | null, hasMedia?: boolean | null, search?: string,
 *   cursor?: { createdAt: string, id: string } | null }} [filters]
 */
export async function listAdminReviews({
  status = 'pending',
  rating = null,
  hasMedia = null,
  search = '',
  cursor = null,
} = {}) {
  if (cursor && !isUuid(cursor.id)) throw new Error(LIST_FAILED);

  const { data, error } = await supabase.rpc('admin_list_reviews', {
    p_status: STATUSES.includes(status) ? status : null,
    p_rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
    p_has_media: typeof hasMedia === 'boolean' ? hasMedia : null,
    p_search: String(search ?? '').trim().slice(0, 100) || null,
    p_before_created: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
    p_limit: ADMIN_REVIEWS_PAGE_SIZE,
  });
  if (error || !data || !Array.isArray(data.items)) throw new Error(LIST_FAILED);

  const items = data.items.map((row) => ({
    id: row.id,
    productId: row.product_id,
    productTitle: row.product_title,
    authorName: row.author_name,
    accountEmail: row.account_email,
    rating: row.rating,
    title: row.title,
    commentPreview: row.comment_preview,
    mediaCount: row.media_count,
    status: row.status,
    createdAt: row.created_at,
  }));
  const last = items[items.length - 1];
  return {
    reviews: items,
    nextCursor: data.has_more && last ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

/** One review with everything a moderator needs. Null when it does not exist. */
export async function getAdminReview(reviewId) {
  if (!isUuid(reviewId)) return null;
  const { data, error } = await supabase.rpc('admin_get_review', { p_review_id: reviewId });
  if (error) throw new Error("We couldn't load this review. Please try again.");
  if (!data) return null;

  return {
    id: data.id,
    productId: data.product_id,
    productTitle: data.product_title,
    productSlug: data.product_slug,
    userId: data.user_id,
    accountEmail: data.account_email,
    authorName: data.author_name,
    orderId: data.order_id,
    orderNumber: data.order_number,
    rating: data.rating,
    title: data.title,
    comment: data.comment,
    status: data.status,
    mediaCount: data.media_count,
    verified: data.is_verified_purchase === true,
    moderatedAt: data.moderated_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    media: (data.media ?? []).map((item) => ({
      id: item.id,
      type: item.media_type,
      url: item.url,
      publicId: item.public_id,
      width: item.width,
      height: item.height,
      durationSeconds: item.duration_seconds === null ? null : Number(item.duration_seconds),
      bytes: item.bytes,
      position: item.position,
    })),
  };
}

/** The Activity log entries about one review, newest first. */
export async function listReviewAudit(reviewId) {
  if (!isUuid(reviewId)) return [];
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select(AUDIT_COLUMNS)
    .eq('table_name', 'reviews')
    .eq('record_id', reviewId)
    .order('id', { ascending: false })
    .limit(20);
  if (error) throw new Error("We couldn't load the history of this review.");
  return (data ?? []).map((row) => ({
    id: row.id,
    at: row.created_at,
    actorEmail: row.actor_email,
    action: row.action,
    summary: row.summary,
  }));
}

/** Reviews waiting for a decision. Used for the sidebar badge. */
export async function countPendingReviews() {
  const { count, error } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error || typeof count !== 'number') throw new Error("We couldn't count pending reviews.");
  return count;
}

/**
 * Words for a refused moderation action. Raw database text is never shown.
 * @param {{ code?: string, message?: string } | null | undefined} error
 */
export function friendlyReviewAdminError(error) {
  if (error?.message === 'review_not_found') return 'This review no longer exists. Reload the page.';
  if (error?.message === 'media_not_found') return 'This file was already removed. Reload the page.';
  if (error?.message === 'invalid_status') return 'That status is not valid.';
  if (error?.code === '42501') return 'You do not have permission to moderate reviews.';
  return 'We could not complete that. Please try again.';
}

/** Approve or reject a review (its photos and video follow it). The database writes the log. */
export async function moderateReview(reviewId, status) {
  if (!isUuid(reviewId)) throw new Error(friendlyReviewAdminError({ message: 'review_not_found' }));
  const { data, error } = await supabase.rpc('admin_moderate_review', {
    p_review_id: reviewId,
    p_status: status,
  });
  if (error) throw new Error(friendlyReviewAdminError(error));
  return { id: data.id, status: data.status, changed: data.changed === true };
}

/** Delete a review and all its media. The files are queued for Cloudinary by the database. */
export async function deleteReview(reviewId) {
  if (!isUuid(reviewId)) throw new Error(friendlyReviewAdminError({ message: 'review_not_found' }));
  const { error } = await supabase.rpc('admin_delete_review', { p_review_id: reviewId });
  if (error) throw new Error(friendlyReviewAdminError(error));
}

/** Remove one photo or video from a review. The review and its other files stay. */
export async function removeReviewMedia(mediaId) {
  if (!isUuid(mediaId)) throw new Error(friendlyReviewAdminError({ message: 'media_not_found' }));
  const { data, error } = await supabase.rpc('admin_remove_review_media', { p_media_id: mediaId });
  if (error) throw new Error(friendlyReviewAdminError(error));
  return { mediaCount: data.media_count };
}
