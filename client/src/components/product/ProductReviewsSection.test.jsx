import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ value: {} }));
vi.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: () => auth.value }));
const service = vi.hoisted(() => ({
  listProductReviews: vi.fn(),
  getReviewSummary: vi.fn(),
  getMyReviewState: vi.fn(),
  submitReview: vi.fn(),
  editReview: vi.fn(),
  deleteMyReview: vi.fn(),
  requestReviewCleanup: vi.fn(),
}));
vi.mock('@/features/reviews/services/reviewService', () => service);
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));

import ProductReviewsSection from './ProductReviewsSection';

const PRODUCT = '11111111-1111-4111-8111-111111111111';
const FAKE = [/Huzaifa/i, /Verified Buyer/i, /TRK-/i, /\[cite/i];

const review = (n, overrides = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  rating: 5,
  title: `Title ${n}`,
  comment: `Comment ${n}`,
  authorName: `Buyer ${n}`,
  verified: true,
  createdAt: '2030-01-01T10:00:00Z',
  media: [],
  ...overrides,
});
const summary = (count = 0) => ({
  average: count ? 4.5 : 0,
  count,
  stars: { 5: count, 4: 0, 3: 0, 2: 0, 1: 0 },
});
const mine = (overrides = {}) => ({
  id: '99999999-9999-4999-8999-999999999999',
  rating: 4,
  title: 'Mine',
  comment: 'My words',
  status: 'pending',
  authorName: 'Me M.',
  createdAt: '2030-01-02T10:00:00Z',
  media: [],
  ...overrides,
});

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProductReviewsSection productId={PRODUCT} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  auth.value = { user: null };
  service.listProductReviews.mockResolvedValue({ reviews: [], nextCursor: null });
  service.getReviewSummary.mockResolvedValue(summary(0));
  service.getMyReviewState.mockResolvedValue({ eligible: false, reason: 'not_purchased', review: null });
});

describe('ProductReviewsSection: visitors and non-buyers', () => {
  it('says "No reviews yet." with no form, no invitation and no fake labels', async () => {
    const { container } = renderSection();
    expect(await screen.findByText('No reviews yet.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Customer Reviews (0)' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/be the first/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /write a review/i })).not.toBeInTheDocument();
    for (const pattern of FAKE) expect(container).not.toHaveTextContent(pattern);
    expect(service.getMyReviewState).not.toHaveBeenCalled(); // not signed in: nothing asked
  });

  it('hides the rating summary when there are no reviews', async () => {
    renderSection();
    await screen.findByText('No reviews yet.');
    expect(screen.queryByRole('list', { name: 'Reviews by rating' })).not.toBeInTheDocument();
    expect(screen.queryByText('/ 5.0')).not.toBeInTheDocument();
  });

  it('shows a skeleton while the reviews load', () => {
    service.listProductReviews.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(screen.getByRole('status', { name: 'Loading reviews' })).toBeInTheDocument();
  });

  it('shows real reviews with the summary, and a Verified Purchase badge', async () => {
    service.getReviewSummary.mockResolvedValue(summary(2));
    service.listProductReviews.mockResolvedValue({ reviews: [review(1), review(2)], nextCursor: null });
    renderSection();
    expect(await screen.findByText('Comment 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Customer Reviews (2)' })).toBeInTheDocument();
    expect(screen.getByText('4.5', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getAllByText('Verified Purchase')).toHaveLength(2);
    expect(screen.queryByText('No reviews yet.')).not.toBeInTheDocument();
  });

  it('filters by a star when its bar is clicked, and asks again for only that rating', async () => {
    service.getReviewSummary.mockResolvedValue(summary(2));
    service.listProductReviews.mockResolvedValue({ reviews: [review(1)], nextCursor: null });
    renderSection();
    await screen.findByText('Comment 1');

    service.listProductReviews.mockResolvedValue({ reviews: [], nextCursor: null });
    await userEvent.click(screen.getByRole('button', { name: '5 stars: 2 reviews' }));
    expect(await screen.findByText('No 5-star reviews yet.')).toBeInTheDocument();
    expect(service.listProductReviews).toHaveBeenLastCalledWith(PRODUCT, { rating: 5, cursor: null });

    service.listProductReviews.mockResolvedValue({ reviews: [review(1)], nextCursor: null });
    await userEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(await screen.findByText('Comment 1')).toBeInTheDocument();
  });

  it('loads the next page on request', async () => {
    service.listProductReviews
      .mockResolvedValueOnce({ reviews: [review(1)], nextCursor: { createdAt: 'x', id: 'y' } })
      .mockResolvedValueOnce({ reviews: [review(2)], nextCursor: null });
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Load more reviews' }));
    expect(await screen.findByText('Comment 2')).toBeInTheDocument();
    expect(screen.getByText('Comment 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more reviews' })).not.toBeInTheDocument();
  });

  it('says so when the reviews cannot load, and retries', async () => {
    service.listProductReviews.mockRejectedValueOnce(new Error('x'));
    renderSection();
    expect(await screen.findByText(/couldn't load the reviews/)).toBeInTheDocument();
    service.listProductReviews.mockResolvedValue({ reviews: [review(1)], nextCursor: null });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Comment 1')).toBeInTheDocument();
  });
});

describe('ProductReviewsSection: signed-in customers', () => {
  beforeEach(() => {
    auth.value = { user: { id: 'user-1' } };
  });

  it('does not invite someone who has not bought the product to write a review', async () => {
    renderSection();
    expect(await screen.findByText('No reviews yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Write a review' })).not.toBeInTheDocument();
    expect(screen.queryByText(/be the first/i)).not.toBeInTheDocument();
  });

  it('shows a skeleton while it checks whether they can review', () => {
    service.getMyReviewState.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(screen.getByRole('status', { name: 'Loading your review' })).toBeInTheDocument();
  });

  it('invites a buyer to be the first, opens the form, and thanks them after sending', async () => {
    service.getMyReviewState.mockResolvedValue({ eligible: true, reason: null, review: null });
    service.submitReview.mockResolvedValue({});
    renderSection();
    expect(await screen.findByText('Be the first to review this product')).toBeInTheDocument();

    service.getMyReviewState.mockResolvedValue({ eligible: false, reason: 'already_reviewed', review: mine() });
    await userEvent.click(screen.getByRole('button', { name: 'Write a review' }));
    await userEvent.click(screen.getByRole('radio', { name: '4 stars' }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit review' }));

    expect(await screen.findByText('Thanks! Your review will appear after approval.')).toBeInTheDocument();
    expect(await screen.findByText('Awaiting approval')).toBeInTheDocument();
    expect(screen.getByText('My words')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Write a review' })).not.toBeInTheDocument();
  });

  it('shows their pending review only to them, with Edit and Delete', async () => {
    service.getMyReviewState.mockResolvedValue({ eligible: false, reason: 'already_reviewed', review: mine() });
    renderSection();
    expect(await screen.findByText('Your review')).toBeInTheDocument();
    expect(screen.getByText('Awaiting approval')).toBeInTheDocument();
    expect(screen.getByText('Only you can see this until an admin approves it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('labels a rejected review "Not approved"', async () => {
    service.getMyReviewState.mockResolvedValue({
      eligible: false,
      reason: 'already_reviewed',
      review: mine({ status: 'rejected' }),
    });
    renderSection();
    expect(await screen.findByText('Not approved')).toBeInTheDocument();
  });

  it('does not show their own approved review twice', async () => {
    const own = mine({ status: 'approved' });
    service.getMyReviewState.mockResolvedValue({ eligible: false, reason: 'already_reviewed', review: own });
    service.getReviewSummary.mockResolvedValue(summary(1));
    service.listProductReviews.mockResolvedValue({
      reviews: [review(1, { id: own.id, comment: 'My words' })],
      nextCursor: null,
    });
    renderSection();
    await screen.findByText('Your review');
    await waitFor(() => expect(service.listProductReviews).toHaveBeenCalled());
    expect(screen.getAllByText('My words')).toHaveLength(1);
  });

  it('edits their review, with the "approval again" warning, and confirms', async () => {
    service.getMyReviewState.mockResolvedValue({
      eligible: false,
      reason: 'already_reviewed',
      review: mine({ status: 'approved' }),
    });
    service.editReview.mockResolvedValue({});
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByText(/Editing sends your review for approval again/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save and send for approval' }));
    expect(await screen.findByText('Thanks! Your changes will appear after approval.')).toBeInTheDocument();
    expect(service.editReview.mock.calls[0][0]).toMatchObject({ id: mine().id, rating: 4, title: 'Mine' });
  });

  it('deletes their review only after they confirm', async () => {
    service.getMyReviewState.mockResolvedValue({ eligible: false, reason: 'already_reviewed', review: mine() });
    service.deleteMyReview.mockResolvedValue({});
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(service.deleteMyReview).not.toHaveBeenCalled();
    service.getMyReviewState.mockResolvedValue({ eligible: true, reason: null, review: null });
    await userEvent.click(screen.getByRole('button', { name: 'Delete review' }));
    expect(await screen.findByText('Your review was deleted.')).toBeInTheDocument();
    expect(service.deleteMyReview.mock.calls[0][0]).toBe(mine().id);
    expect(service.requestReviewCleanup).toHaveBeenCalled();
  });

  it('shows why a delete failed and keeps the review', async () => {
    service.getMyReviewState.mockResolvedValue({ eligible: false, reason: 'already_reviewed', review: mine() });
    service.deleteMyReview.mockRejectedValue(new Error('This review no longer exists. Reload the page.'));
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete review' }));
    expect(await screen.findByText(/no longer exists/)).toBeInTheDocument();
    expect(screen.getByText('My words')).toBeInTheDocument();
  });

  it('says so when the check fails, and tries again', async () => {
    service.getMyReviewState.mockRejectedValueOnce(new Error('x'));
    renderSection();
    expect(await screen.findByText(/couldn't check whether you can review/)).toBeInTheDocument();
    service.getMyReviewState.mockResolvedValue({ eligible: true, reason: null, review: null });
    await userEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0]);
    expect(await screen.findByRole('button', { name: 'Write a review' })).toBeInTheDocument();
  });
});
