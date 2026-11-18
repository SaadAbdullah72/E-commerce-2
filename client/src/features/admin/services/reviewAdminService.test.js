import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ supabase }));

import {
  ADMIN_REVIEWS_PAGE_SIZE,
  countPendingReviews,
  deleteReview,
  friendlyReviewAdminError,
  getAdminReview,
  listAdminReviews,
  listReviewAudit,
  moderateReview,
  removeReviewMedia,
} from './reviewAdminService';

const ID = '11111111-1111-4111-8111-111111111111';
const AT = '2030-01-01T10:00:00.12345+00:00';

function fakeQuery(result) {
  const calls = [];
  const query = new Proxy(
    {},
    {
      get(_target, name) {
        if (name === 'calls') return calls;
        if (name === 'then') return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
        return (...args) => {
          calls.push([name, args]);
          return query;
        };
      },
    },
  );
  return query;
}

const item = (n) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  product_id: ID,
  product_title: 'Earbuds',
  author_name: 'Sam L.',
  account_email: 's@example.com',
  rating: 4,
  title: null,
  comment_preview: 'Nice',
  media_count: 2,
  status: 'pending',
  created_at: AT,
});

beforeEach(() => vi.resetAllMocks());

describe('listAdminReviews', () => {
  it('starts on pending and sends every filter as an argument, with the page size', async () => {
    supabase.rpc.mockResolvedValue({ data: { items: [item(1)], has_more: false }, error: null });
    const page = await listAdminReviews({ rating: 5, hasMedia: true, search: '  earbuds  ' });
    expect(supabase.rpc).toHaveBeenCalledWith('admin_list_reviews', {
      p_status: 'pending',
      p_rating: 5,
      p_has_media: true,
      p_search: 'earbuds',
      p_before_created: null,
      p_before_id: null,
      p_limit: ADMIN_REVIEWS_PAGE_SIZE,
    });
    expect(page.reviews[0]).toMatchObject({ productTitle: 'Earbuds', mediaCount: 2, accountEmail: 's@example.com' });
    expect(page.nextCursor).toBeNull();
  });

  it('sends "all statuses" as null and drops values that are not valid', async () => {
    supabase.rpc.mockResolvedValue({ data: { items: [], has_more: false }, error: null });
    await listAdminReviews({ status: '', rating: 9, hasMedia: 'yes', search: '' });
    expect(supabase.rpc.mock.calls[0][1]).toMatchObject({
      p_status: null,
      p_rating: null,
      p_has_media: null,
      p_search: null,
    });
  });

  it('gives a cursor from the last row only when the database says there is more', async () => {
    supabase.rpc.mockResolvedValue({ data: { items: [item(1), item(2)], has_more: true }, error: null });
    const page = await listAdminReviews();
    expect(page.nextCursor).toEqual({ createdAt: AT, id: item(2).id });
  });

  it('sends the cursor back to the database', async () => {
    supabase.rpc.mockResolvedValue({ data: { items: [], has_more: false }, error: null });
    await listAdminReviews({ cursor: { createdAt: AT, id: ID } });
    expect(supabase.rpc.mock.calls[0][1]).toMatchObject({ p_before_created: AT, p_before_id: ID });
  });

  it('refuses a cursor id that is not a uuid, and a bad answer', async () => {
    await expect(listAdminReviews({ cursor: { createdAt: AT, id: 'x' } })).rejects.toThrow();
    supabase.rpc.mockResolvedValue({ data: { nope: 1 }, error: null });
    await expect(listAdminReviews()).rejects.toThrow(/couldn't load the reviews/);
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(listAdminReviews()).rejects.toThrow(/couldn't load the reviews/);
  });
});

describe('getAdminReview', () => {
  it('reshapes one review with its files', async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        id: ID, product_id: ID, product_title: 'Earbuds', product_slug: 'earbuds', user_id: ID,
        account_email: 's@example.com', author_name: 'Sam L.', order_id: ID, order_number: 'SY-1',
        rating: 5, title: 'T', comment: 'C', status: 'pending', media_count: 1,
        is_verified_purchase: true, moderated_at: null, created_at: AT, updated_at: AT,
        media: [{ id: ID, media_type: 'video', url: 'u', public_id: 'p', width: null, height: null, duration_seconds: '8.00', bytes: 5, position: 0 }],
      },
      error: null,
    });
    const review = await getAdminReview(ID);
    expect(review).toMatchObject({ orderNumber: 'SY-1', verified: true, accountEmail: 's@example.com' });
    expect(review.media[0]).toMatchObject({ type: 'video', durationSeconds: 8, publicId: 'p' });
  });

  it('answers null for a missing review or an id that is not a uuid', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    expect(await getAdminReview(ID)).toBeNull();
    expect(await getAdminReview('nope')).toBeNull();
  });

  it('throws when loading fails', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(getAdminReview(ID)).rejects.toThrow(/couldn't load this review/);
  });
});

describe('moderation', () => {
  it('approves or rejects and says whether anything changed', async () => {
    supabase.rpc.mockResolvedValue({ data: { id: ID, status: 'approved', changed: true }, error: null });
    expect(await moderateReview(ID, 'approved')).toEqual({ id: ID, status: 'approved', changed: true });
    expect(supabase.rpc).toHaveBeenCalledWith('admin_moderate_review', { p_review_id: ID, p_status: 'approved' });
    supabase.rpc.mockResolvedValue({ data: { id: ID, status: 'approved', changed: false }, error: null });
    expect((await moderateReview(ID, 'approved')).changed).toBe(false);
  });

  it('deletes a review and removes one file', async () => {
    supabase.rpc.mockResolvedValue({ data: { deleted: true }, error: null });
    await deleteReview(ID);
    expect(supabase.rpc).toHaveBeenCalledWith('admin_delete_review', { p_review_id: ID });
    supabase.rpc.mockResolvedValue({ data: { media_count: 1 }, error: null });
    expect(await removeReviewMedia(ID)).toEqual({ mediaCount: 1 });
    expect(supabase.rpc).toHaveBeenCalledWith('admin_remove_review_media', { p_media_id: ID });
  });

  it('never calls the database with an id that is not a uuid', async () => {
    await expect(moderateReview('x', 'approved')).rejects.toThrow(/no longer exists/);
    await expect(deleteReview('x')).rejects.toThrow(/no longer exists/);
    await expect(removeReviewMedia('x')).rejects.toThrow(/already removed/);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('turns refusals into plain words', async () => {
    expect(friendlyReviewAdminError({ message: 'review_not_found' })).toMatch(/no longer exists/);
    expect(friendlyReviewAdminError({ message: 'media_not_found' })).toMatch(/already removed/);
    expect(friendlyReviewAdminError({ code: '42501', message: 'Admins only' })).toMatch(/permission/);
    expect(friendlyReviewAdminError({ code: 'XX', message: 'relation x' })).toBe(
      'We could not complete that. Please try again.',
    );
    supabase.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Admins only' } });
    await expect(moderateReview(ID, 'approved')).rejects.toThrow(/permission/);
  });
});

describe('history and the pending count', () => {
  it('reads only the log entries of this review', async () => {
    const query = fakeQuery({ data: [{ id: 3, created_at: AT, actor_email: 'a@x', action: 'update', summary: 'Approved', changes: {} }], error: null });
    supabase.from.mockReturnValue(query);
    const entries = await listReviewAudit(ID);
    expect(supabase.from).toHaveBeenCalledWith('admin_audit_log');
    expect(query.calls.filter(([n]) => n === 'eq').map(([, a]) => a)).toEqual([
      ['table_name', 'reviews'],
      ['record_id', ID],
    ]);
    expect(entries[0]).toMatchObject({ summary: 'Approved', actorEmail: 'a@x' });
  });

  it('counts pending reviews, and throws instead of showing a made-up zero', async () => {
    const query = fakeQuery({ count: 7, error: null });
    supabase.from.mockReturnValue(query);
    expect(await countPendingReviews()).toBe(7);
    expect(query.calls.filter(([n]) => n === 'eq')[0][1]).toEqual(['status', 'pending']);
    supabase.from.mockReturnValue(fakeQuery({ count: null, error: { message: 'x' } }));
    await expect(countPendingReviews()).rejects.toThrow();
  });
});
