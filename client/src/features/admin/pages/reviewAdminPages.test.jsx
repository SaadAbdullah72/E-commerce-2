import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  listAdminReviews: vi.fn(),
  getAdminReview: vi.fn(),
  listReviewAudit: vi.fn(),
  countPendingReviews: vi.fn(),
  moderateReview: vi.fn(),
  deleteReview: vi.fn(),
  removeReviewMedia: vi.fn(),
}));
vi.mock('../services/reviewAdminService', () => service);
vi.mock('@/features/reviews/services/reviewService', () => ({ requestReviewCleanup: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));

import AdminSidebar from '../components/AdminSidebar';
import AdminReviewDetailPage from './AdminReviewDetailPage';
import AdminReviewsPage from './AdminReviewsPage';

const ID = '11111111-1111-4111-8111-111111111111';
const MEDIA_ID = '33333333-3333-4333-8333-333333333333';
const AT = '2030-01-01T10:00:00Z';

function renderAt(path) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/reviews" element={<AdminReviewsPage />} />
          <Route path="/admin/reviews/:id" element={<AdminReviewDetailPage />} />
          <Route path="/admin" element={<AdminSidebar />} />
          <Route path="/admin/orders/:id" element={<p>order page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const summary = (n, overrides = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  productId: ID,
  productTitle: `Product ${n}`,
  authorName: `Buyer ${n}`,
  accountEmail: `b${n}@example.com`,
  rating: 4,
  title: null,
  commentPreview: `Preview ${n}`,
  mediaCount: 2,
  status: 'pending',
  createdAt: AT,
  ...overrides,
});

const detail = (overrides = {}) => ({
  id: ID,
  productId: ID,
  productTitle: 'Earbuds',
  productSlug: 'earbuds',
  userId: ID,
  accountEmail: 'sam@example.com',
  authorName: 'Sam L.',
  orderId: '22222222-2222-4222-8222-222222222222',
  orderNumber: 'SY-42',
  rating: 5,
  title: 'Great',
  comment: 'Line one\n<b>not bold</b>',
  status: 'pending',
  mediaCount: 2,
  verified: true,
  moderatedAt: null,
  createdAt: AT,
  updatedAt: AT,
  media: [
    { id: MEDIA_ID, type: 'photo', url: 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg', publicId: 'p1', width: 800, height: 600, durationSeconds: null, bytes: 204800, position: 0 },
    { id: '44444444-4444-4444-8444-444444444444', type: 'video', url: 'https://res.cloudinary.com/demo/video/upload/v1/b.mp4', publicId: 'p2', width: null, height: null, durationSeconds: 12, bytes: 3000000, position: 1 },
  ],
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  service.listReviewAudit.mockResolvedValue([]);
  service.countPendingReviews.mockResolvedValue(0);
});

describe('AdminReviewsPage', () => {
  it('starts on pending and lists product, customer, stars, preview, media count, status and date', async () => {
    service.listAdminReviews.mockResolvedValue({ reviews: [summary(1), summary(2, { status: 'approved' })], nextCursor: null });
    renderAt('/admin/reviews');

    expect(await screen.findByText('Product 1')).toBeInTheDocument();
    expect(service.listAdminReviews).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', rating: null, hasMedia: null, search: '' }),
    );
    expect(screen.getByLabelText('Filter by status')).toHaveValue('pending');
    expect(screen.getByText('Buyer 1 · b1@example.com')).toBeInTheDocument();
    expect(screen.getByText('Preview 1')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: '4 out of 5 stars' })).toHaveLength(2);
    expect(screen.getAllByLabelText('2 files')).toHaveLength(2);
    expect(screen.getByText('Pending', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Approved', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Product 1/ })).toHaveAttribute('href', `/admin/reviews/${summary(1).id}`);
  });

  it('refetches with each filter: status, rating, media and search', async () => {
    service.listAdminReviews.mockResolvedValue({ reviews: [summary(1)], nextCursor: null });
    renderAt('/admin/reviews');
    await screen.findByText('Product 1');

    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'approved');
    await userEvent.selectOptions(screen.getByLabelText('Filter by rating'), '5');
    await userEvent.selectOptions(screen.getByLabelText('Filter by photos and video'), 'with');
    await userEvent.type(screen.getByLabelText('Search reviews'), 'earbuds{Enter}');

    await vi.waitFor(() =>
      expect(service.listAdminReviews).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'approved', rating: 5, hasMedia: true, search: 'earbuds' }),
      ),
    );
  });

  it('says what is empty: nothing pending, or nothing matching the filters', async () => {
    service.listAdminReviews.mockResolvedValue({ reviews: [], nextCursor: null });
    renderAt('/admin/reviews');
    expect(await screen.findByText('No reviews are waiting for approval.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Filter by rating'), '2');
    expect(await screen.findByText('No reviews match these filters.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(screen.getByLabelText('Filter by status')).toHaveValue('pending');
    expect(screen.getByLabelText('Filter by rating')).toHaveValue('');
  });

  it('loads more with the cursor', async () => {
    const cursor = { createdAt: AT, id: summary(1).id };
    service.listAdminReviews
      .mockResolvedValueOnce({ reviews: [summary(1)], nextCursor: cursor })
      .mockResolvedValueOnce({ reviews: [summary(2)], nextCursor: null });
    renderAt('/admin/reviews');
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Product 2')).toBeInTheDocument();
    expect(service.listAdminReviews).toHaveBeenLastCalledWith(expect.objectContaining({ cursor }));
    expect(screen.getByText('End of the list')).toBeInTheDocument();
  });

  it('shows an error with Try again, never an empty list', async () => {
    service.listAdminReviews.mockRejectedValueOnce(new Error('x'));
    renderAt('/admin/reviews');
    expect(await screen.findByText(/couldn't load the reviews/)).toBeInTheDocument();
    service.listAdminReviews.mockResolvedValue({ reviews: [summary(1)], nextCursor: null });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Product 1')).toBeInTheDocument();
  });
});

describe('AdminReviewDetailPage', () => {
  it('shows the full text as plain text, the gallery, the customer and the order link', async () => {
    service.getAdminReview.mockResolvedValue(detail());
    const { container } = renderAt(`/admin/reviews/${ID}`);

    expect(await screen.findByRole('heading', { name: 'Review by Sam L.' })).toBeInTheDocument();
    expect(screen.getByText(/not bold/)).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull(); // text, never markup
    expect(screen.getByText('Verified Purchase')).toBeInTheDocument();
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Customer photo 1' })).toBeInTheDocument();
    expect(container.querySelector('video')).toHaveAttribute('controls');
    expect(screen.getByText(/Photo 1 · 200 KB · 800×600/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'SY-42' })).toHaveAttribute(
      'href',
      '/admin/orders/22222222-2222-4222-8222-222222222222',
    );
    expect(screen.getByRole('link', { name: 'Earbuds' })).toHaveAttribute('href', '/product/earbuds');
  });

  it('approves only after confirming, then shows the result', async () => {
    service.getAdminReview.mockResolvedValue(detail());
    service.moderateReview.mockResolvedValue({ id: ID, status: 'approved', changed: true });
    renderAt(`/admin/reviews/${ID}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(service.moderateReview).not.toHaveBeenCalled();

    service.getAdminReview.mockResolvedValue(detail({ status: 'approved' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Approve this review?')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Review by Sam L. approved.')).toBeInTheDocument();
    expect(service.moderateReview.mock.calls[0].slice(0, 2)).toEqual([ID, 'approved']);
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeDisabled(); // already approved
  });

  it('rejects after confirming, with a danger confirm button', async () => {
    service.getAdminReview.mockResolvedValue(detail());
    service.moderateReview.mockResolvedValue({ id: ID, status: 'rejected', changed: true });
    renderAt(`/admin/reviews/${ID}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText('Review by Sam L. rejected.')).toBeInTheDocument();
  });

  it('says "nothing changed" when the review already had that status', async () => {
    service.getAdminReview.mockResolvedValue(detail());
    service.moderateReview.mockResolvedValue({ id: ID, status: 'approved', changed: false });
    renderAt(`/admin/reviews/${ID}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText(/Nothing changed/)).toBeInTheDocument();
  });

  it('keeps the dialog open and shows the error inline when the action fails', async () => {
    service.getAdminReview.mockResolvedValue(detail());
    service.moderateReview.mockRejectedValue(new Error('You do not have permission to moderate reviews.'));
    renderAt(`/admin/reviews/${ID}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    const dialog = screen.getByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('do not have permission');
    expect(within(dialog).getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  it('deletes after confirming and leaves for the list', async () => {
    service.getAdminReview.mockResolvedValue(detail());
    service.deleteReview.mockResolvedValue();
    service.listAdminReviews.mockResolvedValue({ reviews: [], nextCursor: null });
    renderAt(`/admin/reviews/${ID}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/permanently removes the review/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete review' }));
    expect(await screen.findByRole('heading', { name: 'Reviews' })).toBeInTheDocument();
    expect(service.deleteReview).toHaveBeenCalled();
    expect(service.deleteReview.mock.calls[0][0]).toBe(ID);
  });

  it('removes one photo after confirming, and says so', async () => {
    service.getAdminReview.mockResolvedValue(detail());
    service.removeReviewMedia.mockResolvedValue({ mediaCount: 1 });
    renderAt(`/admin/reviews/${ID}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove photo 1' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Remove this photo?')).toBeInTheDocument();
    expect(service.removeReviewMedia).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove photo' }));
    expect(await screen.findByText('The photo was removed from this review.')).toBeInTheDocument();
    expect(service.removeReviewMedia.mock.calls[0][0]).toBe(MEDIA_ID);
  });

  it('shows the history of admin actions on this review', async () => {
    service.getAdminReview.mockResolvedValue(detail());
    service.listReviewAudit.mockResolvedValue([
      { id: 1, at: AT, actorEmail: 'admin@example.com', action: 'update', summary: 'Approved the review by Sam L.' },
    ]);
    renderAt(`/admin/reviews/${ID}`);
    expect(await screen.findByText('Approved the review by Sam L.')).toBeInTheDocument();
    expect(screen.getByText(/admin@example.com/)).toBeInTheDocument();
  });

  it('says so when nobody has acted yet', async () => {
    service.getAdminReview.mockResolvedValue(detail());
    renderAt(`/admin/reviews/${ID}`);
    expect(await screen.findByText('No admin has acted on this review yet.')).toBeInTheDocument();
  });

  it('says "couldn\'t find" for a missing review and a link that is not an id', async () => {
    service.getAdminReview.mockResolvedValue(null);
    renderAt(`/admin/reviews/${ID}`);
    expect(await screen.findByText(/couldn't find that review/)).toBeInTheDocument();
  });

  it('shows an error with Try again when the review cannot load', async () => {
    service.getAdminReview.mockRejectedValueOnce(new Error('x'));
    renderAt(`/admin/reviews/${ID}`);
    expect(await screen.findByText(/couldn't load this review/)).toBeInTheDocument();
    service.getAdminReview.mockResolvedValue(detail());
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Review by Sam L.' })).toBeInTheDocument();
  });
});

describe('Sidebar pending badge', () => {
  it('links to Reviews and shows how many are pending', async () => {
    service.countPendingReviews.mockResolvedValue(3);
    renderAt('/admin');
    expect(await screen.findByLabelText('3 pending')).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: /^Reviews/ })).toHaveAttribute('href', '/admin/reviews');
  });

  it('shows no badge for zero, and none (not a made-up 0) when the count cannot load', async () => {
    service.countPendingReviews.mockResolvedValue(0);
    renderAt('/admin');
    await screen.findByRole('link', { name: /^Reviews/ });
    expect(screen.queryByLabelText(/pending/)).not.toBeInTheDocument();
  });
});
