import { supabase } from '@/lib/supabase/client';

import { isUuid } from '../../checkout/services/checkoutService';
import { friendlyReviewError } from '../lib/reviewErrors';

export const REVIEWS_PAGE_SIZE = 10;

/** created_at exactly as the database prints it, e.g. 2026-11-16T15:09:13.32076+00:00 */
const DB_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

// Named columns only: user_id and order_id are never readable from a browser.
const LIST_COLUMNS =
  'id, rating, title, comment, author_name, media_count, is_verified_purchase, created_at, review_media(id, media_type, url, width, height, duration_seconds, position)';

const LIST_FAILED = "We couldn't load the reviews. Please try again.";
const EMPTY_SUMMARY = { average: 0, count: 0, stars: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };

const toMedia = (row) => ({
  id: row.id,
  type: row.media_type,
  url: row.url,
  width: row.width,
  height: row.height,
  durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
  position: row.position,
});
const byPosition = (a, b) => a.position - b.position;

/**
 * One page of approved reviews of a product, newest first, optionally only one star rating.
 * Pages are chained by (created_at, id) so reviews arriving while someone reads never shift rows.
 *
 * @param {string} productId
 * @param {{ rating?: number | null, cursor?: { createdAt: string, id: string } | null }} [options]
 */
export async function listProductReviews(productId, { rating = null, cursor = null } = {}) {
  if (!isUuid(productId)) return { reviews: [], nextCursor: null };

  let query = supabase
    .from('reviews')
    .select(LIST_COLUMNS)
    .eq('product_id', productId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(REVIEWS_PAGE_SIZE + 1); // one extra tells us whether there is another page

  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) query = query.eq('rating', rating);
  if (cursor) {
    if (!DB_TIMESTAMP.test(cursor.createdAt) || !isUuid(cursor.id)) throw new Error(LIST_FAILED);
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(LIST_FAILED);

  const rows = data ?? [];
  const page = rows.slice(0, REVIEWS_PAGE_SIZE);
  const last = page[page.length - 1];
  return {
    reviews: page.map((row) => ({
      id: row.id,
      rating: row.rating,
      title: row.title,
      comment: row.comment,
      authorName: row.author_name,
      verified: row.is_verified_purchase === true,
      createdAt: row.created_at,
      media: (row.review_media ?? []).map(toMedia).sort(byPosition),
    })),
    nextCursor:
      rows.length > REVIEWS_PAGE_SIZE && last ? { createdAt: last.created_at, id: last.id } : null,
  };
}

/** Average, count and the number of reviews per star, for approved reviews only. */
export async function getReviewSummary(productId) {
  if (!isUuid(productId)) return EMPTY_SUMMARY;
  const { data, error } = await supabase.rpc('product_review_summary', { p_product_id: productId });
  if (error || !data || typeof data.count !== 'number') {
    throw new Error("We couldn't load the rating summary.");
  }
  return {
    average: Number(data.average),
    count: data.count,
    stars: {
      5: data.stars?.[5] ?? 0,
      4: data.stars?.[4] ?? 0,
      3: data.stars?.[3] ?? 0,
      2: data.stars?.[2] ?? 0,
      1: data.stars?.[1] ?? 0,
    },
  };
}

/**
 * May this customer review this product, and what have they already written (in any status)?
 * Only for a signed-in customer.
 *
 * @returns {Promise<{ eligible: boolean, reason: string | null, review: null | {
 *   id: string, rating: number, title: string | null, comment: string | null,
 *   status: 'pending' | 'approved' | 'rejected', authorName: string, createdAt: string,
 *   media: { id: string, type: 'photo' | 'video', url: string, publicId: string, width: number | null,
 *   height: number | null, durationSeconds: number | null, bytes: number }[] } }>}
 */
export async function getMyReviewState(productId) {
  if (!isUuid(productId)) return { eligible: false, reason: 'not_purchased', review: null };
  const { data, error } = await supabase.rpc('my_review_state', { p_product_id: productId });
  if (error || !data) throw new Error("We couldn't check your review. Please try again.");

  const review = data.review
    ? {
        id: data.review.id,
        rating: data.review.rating,
        title: data.review.title,
        comment: data.review.comment,
        status: data.review.status,
        authorName: data.review.author_name,
        createdAt: data.review.created_at,
        media: (data.review.media ?? []).map((item) => ({
          ...toMedia(item),
          publicId: item.public_id,
          bytes: item.bytes,
        })),
      }
    : null;
  return { eligible: data.eligible === true, reason: data.reason ?? null, review };
}

const mediaPayload = (media) =>
  media.map((item) => ({
    media_type: item.type,
    url: item.url,
    public_id: item.publicId,
    width: item.width ?? null,
    height: item.height ?? null,
    duration_seconds: item.durationSeconds ?? null,
    bytes: item.bytes,
  }));

/**
 * Send a new review. It starts "pending" and appears to others once an admin approves it.
 * `id` is made by the browser first because the uploaded files already sit in a folder named after it.
 */
export async function submitReview({ id, productId, rating, title, comment, media }) {
  const { data, error } = await supabase.rpc('submit_review', {
    p_review_id: id,
    p_product_id: productId,
    p_rating: rating,
    p_title: title.trim() || null,
    p_comment: comment.trim() || null,
    p_media: mediaPayload(media),
  });
  if (error) throw new Error(friendlyReviewError(error));
  return data;
}

/** Edit your own review. It goes back to "pending". `media` is the complete new list. */
export async function editReview({ id, rating, title, comment, media }) {
  const { data, error } = await supabase.rpc('edit_my_review', {
    p_review_id: id,
    p_rating: rating,
    p_title: title.trim() || null,
    p_comment: comment.trim() || null,
    p_media: mediaPayload(media),
  });
  if (error) throw new Error(friendlyReviewError(error));
  return data;
}

export async function deleteMyReview(reviewId) {
  const { data, error } = await supabase.rpc('delete_my_review', { p_review_id: reviewId });
  if (error) throw new Error(friendlyReviewError(error));
  return data;
}

/**
 * Ask the server to remove unused files from Cloudinary. It works from a database queue, so
 * nothing is sent from here. It is housekeeping: it never throws, and a miss is retried later.
 */
export async function requestReviewCleanup() {
  try {
    await supabase.functions.invoke('delete-assets', { body: {} });
  } catch {
    // The queue keeps the files until the next attempt.
  }
}
