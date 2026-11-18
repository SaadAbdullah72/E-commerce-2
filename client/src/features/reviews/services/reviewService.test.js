import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } }));
vi.mock('@/lib/supabase/client', () => ({ supabase }));

import {
  deleteMyReview,
  editReview,
  getMyReviewState,
  getReviewSummary,
  listProductReviews,
  requestReviewCleanup,
  REVIEWS_PAGE_SIZE,
  submitReview,
} from './reviewService';

const PRODUCT = '11111111-1111-4111-8111-111111111111';
const REVIEW = '22222222-2222-4222-8222-222222222222';

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
const called = (query, name) => query.calls.filter(([method]) => method === name).map(([, args]) => args);

const row = (n, overrides = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  rating: 5,
  title: `Title ${n}`,
  comment: `Comment ${n}`,
  author_name: 'Sam L.',
  media_count: 1,
  is_verified_purchase: true,
  created_at: `2030-01-0${n}T10:00:00.12345+00:00`,
  review_media: [
    { id: 'm2', media_type: 'video', url: 'https://x/v', width: null, height: null, duration_seconds: '12.50', position: 1 },
    { id: 'm1', media_type: 'photo', url: 'https://x/p', width: 800, height: 600, duration_seconds: null, position: 0 },
  ],
  ...overrides,
});

beforeEach(() => vi.resetAllMocks());

describe('listProductReviews', () => {
  it('asks only for approved reviews of this product, newest first, and named columns', async () => {
    const query = fakeQuery({ data: [row(1)], error: null });
    supabase.from.mockReturnValue(query);

    await listProductReviews(PRODUCT);

    expect(supabase.from).toHaveBeenCalledWith('reviews');
    const [columns] = called(query, 'select')[0];
    expect(columns).not.toContain('*,');
    expect(columns).not.toMatch(/user_id|order_id|public_id/);
    expect(called(query, 'eq')).toEqual([
      ['product_id', PRODUCT],
      ['status', 'approved'],
    ]);
    expect(called(query, 'order')).toEqual([
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ]);
    expect(called(query, 'limit')).toEqual([[REVIEWS_PAGE_SIZE + 1]]);
  });

  it('reshapes reviews, puts media in order and reads the video length as a number', async () => {
    supabase.from.mockReturnValue(fakeQuery({ data: [row(1)], error: null }));
    const { reviews, nextCursor } = await listProductReviews(PRODUCT);
    expect(nextCursor).toBeNull();
    expect(reviews[0]).toMatchObject({
      authorName: 'Sam L.',
      verified: true,
      comment: 'Comment 1',
    });
    expect(reviews[0].media.map((item) => item.id)).toEqual(['m1', 'm2']);
    expect(reviews[0].media[1].durationSeconds).toBe(12.5);
  });

  it('filters by one star rating, and ignores a rating that is not 1 to 5', async () => {
    const query = fakeQuery({ data: [], error: null });
    supabase.from.mockReturnValue(query);
    await listProductReviews(PRODUCT, { rating: 4 });
    expect(called(query, 'eq')).toContainEqual(['rating', 4]);

    const other = fakeQuery({ data: [], error: null });
    supabase.from.mockReturnValue(other);
    await listProductReviews(PRODUCT, { rating: 9 });
    expect(called(other, 'eq').some(([name]) => name === 'rating')).toBe(false);
  });

  it('gives a cursor only when one more row than a page came back', async () => {
    const rows = Array.from({ length: REVIEWS_PAGE_SIZE + 1 }, (_v, i) => row(1, { id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` }));
    supabase.from.mockReturnValue(fakeQuery({ data: rows, error: null }));
    const { reviews, nextCursor } = await listProductReviews(PRODUCT);
    expect(reviews).toHaveLength(REVIEWS_PAGE_SIZE);
    expect(nextCursor).toEqual({ createdAt: rows[REVIEWS_PAGE_SIZE - 1].created_at, id: rows[REVIEWS_PAGE_SIZE - 1].id });
  });

  it('chains the next page by (created_at, id)', async () => {
    const query = fakeQuery({ data: [], error: null });
    supabase.from.mockReturnValue(query);
    const cursor = { createdAt: '2030-01-01T10:00:00.12345+00:00', id: REVIEW };
    await listProductReviews(PRODUCT, { cursor });
    expect(called(query, 'or')[0][0]).toBe(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  });

  it('refuses a cursor that is not a database timestamp plus a uuid (filter injection)', async () => {
    supabase.from.mockReturnValue(fakeQuery({ data: [], error: null }));
    await expect(
      listProductReviews(PRODUCT, { cursor: { createdAt: '2030-01-01),id.gt.0', id: REVIEW } }),
    ).rejects.toThrow(/couldn't load the reviews/);
    await expect(
      listProductReviews(PRODUCT, { cursor: { createdAt: '2030-01-01T10:00:00Z', id: 'x),(' } }),
    ).rejects.toThrow(/couldn't load the reviews/);
  });

  it('does not ask the database about an id that is not a uuid', async () => {
    expect(await listProductReviews('nope')).toEqual({ reviews: [], nextCursor: null });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('fails with plain words, not database text', async () => {
    supabase.from.mockReturnValue(fakeQuery({ data: null, error: { message: 'relation x' } }));
    await expect(listProductReviews(PRODUCT)).rejects.toThrow("We couldn't load the reviews. Please try again.");
  });
});

describe('getReviewSummary', () => {
  it('reshapes the answer', async () => {
    supabase.rpc.mockResolvedValue({
      data: { average: '4.5', count: 2, stars: { 5: 1, 4: 1, 3: 0, 2: 0, 1: 0 } },
      error: null,
    });
    expect(await getReviewSummary(PRODUCT)).toEqual({
      average: 4.5,
      count: 2,
      stars: { 5: 1, 4: 1, 3: 0, 2: 0, 1: 0 },
    });
    expect(supabase.rpc).toHaveBeenCalledWith('product_review_summary', { p_product_id: PRODUCT });
  });

  it('throws instead of showing made-up zeros when the answer is wrong', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await expect(getReviewSummary(PRODUCT)).rejects.toThrow();
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(getReviewSummary(PRODUCT)).rejects.toThrow();
  });
});

describe('getMyReviewState', () => {
  it('says a customer who has not bought the product cannot review it', async () => {
    supabase.rpc.mockResolvedValue({ data: { eligible: false, reason: 'not_purchased', review: null }, error: null });
    expect(await getMyReviewState(PRODUCT)).toEqual({ eligible: false, reason: 'not_purchased', review: null });
  });

  it('returns the customer own review with its files, including the public id for editing', async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        eligible: false,
        reason: 'already_reviewed',
        review: {
          id: REVIEW,
          rating: 4,
          title: null,
          comment: 'Nice',
          status: 'pending',
          author_name: 'Sam L.',
          created_at: '2030-01-01T10:00:00Z',
          media: [
            { id: 'm1', media_type: 'photo', url: 'u', public_id: 'p1', width: 1, height: 2, duration_seconds: null, bytes: 99, position: 0 },
          ],
        },
      },
      error: null,
    });
    const state = await getMyReviewState(PRODUCT);
    expect(state.review.status).toBe('pending');
    expect(state.review.media[0]).toMatchObject({ publicId: 'p1', bytes: 99, type: 'photo' });
  });

  it('throws when the check itself fails', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(getMyReviewState(PRODUCT)).rejects.toThrow(/couldn't check/);
  });
});

describe('submitReview / editReview / deleteMyReview', () => {
  const media = [
    { type: 'photo', url: 'u1', publicId: 'p1', width: 1, height: 2, durationSeconds: null, bytes: 10 },
    { type: 'video', url: 'u2', publicId: 'p2', width: null, height: null, durationSeconds: 8, bytes: 20 },
  ];

  it('sends the review with the id made in the browser and the files in the database shape', async () => {
    supabase.rpc.mockResolvedValue({ data: { id: REVIEW, status: 'pending' }, error: null });
    await submitReview({ id: REVIEW, productId: PRODUCT, rating: 5, title: '  Great  ', comment: '', media });
    expect(supabase.rpc).toHaveBeenCalledWith('submit_review', {
      p_review_id: REVIEW,
      p_product_id: PRODUCT,
      p_rating: 5,
      p_title: 'Great',
      p_comment: null,
      p_media: [
        { media_type: 'photo', url: 'u1', public_id: 'p1', width: 1, height: 2, duration_seconds: null, bytes: 10 },
        { media_type: 'video', url: 'u2', public_id: 'p2', width: null, height: null, duration_seconds: 8, bytes: 20 },
      ],
    });
  });

  it('edits with the complete new list of files', async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null });
    await editReview({ id: REVIEW, rating: 3, title: '', comment: 'ok', media: [] });
    expect(supabase.rpc).toHaveBeenCalledWith('edit_my_review', {
      p_review_id: REVIEW,
      p_rating: 3,
      p_title: null,
      p_comment: 'ok',
      p_media: [],
    });
  });

  it.each([
    ['not_purchased', 'Only customers who bought this product can review it.'],
    ['already_reviewed', "You've already reviewed this product. Edit your existing review."],
    ['product_not_found', 'Product not found.'],
  ])('turns %s into the words the customer sees', async (code, text) => {
    supabase.rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: code } });
    await expect(
      submitReview({ id: REVIEW, productId: PRODUCT, rating: 5, title: '', comment: '', media: [] }),
    ).rejects.toThrow(text);
  });

  it('deletes by id and reports a missing review in plain words', async () => {
    supabase.rpc.mockResolvedValue({ data: { deleted: true }, error: null });
    await deleteMyReview(REVIEW);
    expect(supabase.rpc).toHaveBeenCalledWith('delete_my_review', { p_review_id: REVIEW });
    supabase.rpc.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'review_not_found' } });
    await expect(deleteMyReview(REVIEW)).rejects.toThrow(/no longer exists/);
  });
});

describe('requestReviewCleanup', () => {
  it('asks the server to drain its queue and sends no file names', async () => {
    supabase.functions.invoke.mockResolvedValue({});
    await requestReviewCleanup();
    expect(supabase.functions.invoke).toHaveBeenCalledWith('delete-assets', { body: {} });
  });

  it('never throws, even when the call fails', async () => {
    supabase.functions.invoke.mockRejectedValue(new Error('offline'));
    await expect(requestReviewCleanup()).resolves.toBeUndefined();
  });
});
