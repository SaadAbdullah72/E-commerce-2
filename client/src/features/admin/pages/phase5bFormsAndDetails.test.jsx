import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminLists = vi.hoisted(() => ({
  listAdminCategories: vi.fn(),
  listAdminProducts: vi.fn(),
}));
vi.mock('../services/adminService', () => adminLists);

const productApi = vi.hoisted(() => ({
  getAdminProduct: vi.fn(),
  listAdminDealTags: vi.fn(),
  saveProduct: vi.fn(),
}));
vi.mock('../services/productAdminService', () => productApi);

const couponApi = vi.hoisted(() => ({
  getAdminCoupon: vi.fn(),
  listAdminCoupons: vi.fn(),
  saveCoupon: vi.fn(),
}));
vi.mock('../services/couponAdminService', () => couponApi);

const bannerApi = vi.hoisted(() => ({
  getAdminBanner: vi.fn(),
  listAdminBanners: vi.fn(),
  saveBanner: vi.fn(),
}));
vi.mock('../services/bannerAdminService', () => bannerApi);

const orderApi = vi.hoisted(() => ({
  getAdminOrder: vi.fn(),
  updateAdminOrder: vi.fn(),
}));
vi.mock('../services/orderAdminService', () => orderApi);

const reviewApi = vi.hoisted(() => ({
  getAdminReview: vi.fn(),
  listReviewAudit: vi.fn(),
  moderateReview: vi.fn(),
  deleteReview: vi.fn(),
  removeReviewMedia: vi.fn(),
}));
vi.mock('../services/reviewAdminService', () => reviewApi);

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));

import BannerForm from '../components/BannerForm';
import CategoryForm from '../components/CategoryForm';
import CouponForm from '../components/CouponForm';
import ImageUploader from '../components/ImageUploader';
import ProductForm from '../components/ProductForm';
import TagInput from '../components/TagInput';
import AdminOrderDetailPage from './AdminOrderDetailPage';
import AdminReviewDetailPage from './AdminReviewDetailPage';
import BannerEditPage from './BannerEditPage';
import CouponEditPage from './CouponEditPage';
import ProductEditPage from './ProductEditPage';

function renderWithClient(ui, initialEntries = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const mockCategories = [
  { id: 'cat1', name: 'Electronics', slug: 'electronics', isActive: true, sortOrder: 1 },
];

const mockProductValues = {
  title: 'Wireless Keyboard',
  slug: 'wireless-keyboard',
  description: '',
  categoryId: 'cat1',
  price: '49.99',
  compareAtPrice: '',
  stock: '10',
  sizes: [],
  colors: [],
  dealTagIds: [],
  isActive: true,
  isFlashDeal: false,
  flashEndsAt: '',
  images: [],
};

const mockCouponValues = {
  code: 'SPRING20',
  discountType: 'percentage',
  percentOff: '20',
  amountOff: '',
  minSubtotal: '',
  startsAt: '',
  expiresAt: '',
  usageLimit: '',
  isActive: true,
};

const mockBannerValues = {
  title: 'Spring Sale',
  badge: 'New',
  subtitle: 'Up to 50% off',
  buttonText: 'Shop now',
  buttonLink: '/deals',
  theme: 'indigo',
  image: [],
  isActive: true,
  startsAt: '',
  endsAt: '',
};

const mockOrderDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  orderNumber: 'SY-0042',
  status: 'paid',
  paymentIssue: null,
  cancelReason: null,
  subtotalMinor: 4000,
  deliveryFeeMinor: 500,
  discountMinor: 0,
  couponCode: null,
  totalMinor: 4500,
  currency: 'USD',
  accountEmail: 'customer@example.com',
  shipping: {
    name: 'Customer One',
    email: 'customer@example.com',
    phone: '555-0199',
    address: '123 Main St',
    city: 'Cityville',
    state: 'State',
    courier: 'DHL',
    notes: 'Leave at front porch',
  },
  trackingNumber: null,
  stripeSessionId: 'cs_test_123',
  stripePaymentIntentId: 'pi_test_123',
  createdAt: '2030-01-01T10:00:00Z',
  paidAt: '2030-01-01T10:05:00Z',
  shippedAt: null,
  deliveredAt: null,
  cancelledAt: null,
  expiresAt: null,
  items: [
    {
      productId: 'p1',
      title: 'Wireless Keyboard',
      imageUrl: null,
      size: null,
      color: null,
      unitPriceMinor: 4000,
      quantity: 1,
      lineTotalMinor: 4000,
    },
  ],
};

const mockReviewDetail = {
  id: '22222222-2222-4222-8222-222222222222',
  productId: 'p1',
  productTitle: 'Wireless Keyboard',
  productSlug: 'wireless-keyboard',
  userId: 'u1',
  accountEmail: 'reviewer@example.com',
  authorName: 'Sam L.',
  orderId: '11111111-1111-4111-8111-111111111111',
  orderNumber: 'SY-0042',
  rating: 5,
  title: 'Great keyboard',
  comment: 'Works very well with my setup.',
  verified: true,
  status: 'pending',
  moderatedAt: null,
  createdAt: '2030-01-02T10:00:00Z',
  updatedAt: '2030-01-02T10:00:00Z',
  media: [
    {
      id: 'm1',
      type: 'photo',
      url: 'https://example.com/photo.jpg',
      bytes: 102400,
      width: 800,
      height: 600,
      durationSeconds: null,
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  adminLists.listAdminCategories.mockResolvedValue(mockCategories);
  productApi.listAdminDealTags.mockResolvedValue([]);
  reviewApi.listReviewAudit.mockResolvedValue([]);
});

describe('Phase 5B: Group 1 — Shared Form Components', () => {
  it('TagInput renders chip remove buttons with 44px mobile touch targets and focus rings', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithClient(
      <TagInput id="tags" value={['Electronics', 'Gadgets']} onChange={onChange} />,
    );

    const removeButtons = screen.getAllByRole('button', { name: /^Remove/ });
    expect(removeButtons).toHaveLength(2);
    removeButtons.forEach((btn) => {
      expect(btn.className).toContain('max-md:min-h-11');
      expect(btn.className).toContain('max-md:min-w-11');
      expect(btn.className).toContain('focus-visible:ring-2');
    });

    const input = screen.getByRole('textbox');
    await user.type(input, 'Accessories{enter}');
    expect(onChange).toHaveBeenCalledWith(['Electronics', 'Gadgets', 'Accessories']);
  });

  it('ImageUploader reorder/remove buttons have mobile touch targets and focus rings', () => {
    const images = [
      { url: 'https://example.com/1.jpg', publicId: 'img1', alt: '' },
      { url: 'https://example.com/2.jpg', publicId: 'img2', alt: '' },
    ];
    renderWithClient(<ImageUploader value={images} onChange={vi.fn()} max={8} />);

    const mainBadge = screen.getByText('Main');
    expect(mainBadge.className).toContain('text-xs');
    expect(mainBadge.className).toContain('font-bold');

    const removeButtons = screen.getAllByRole('button', { name: /^Remove image/ });
    removeButtons.forEach((btn) => {
      expect(btn.className).toContain('max-md:min-h-11');
      expect(btn.className).toContain('max-md:min-w-11');
      expect(btn.className).toContain('focus-visible:ring-2');
    });

    const moveButtons = screen.getAllByRole('button', { name: /^Move image/ });
    moveButtons.forEach((btn) => {
      expect(btn.className).toContain('max-md:min-h-11');
      expect(btn.className).toContain('max-md:min-w-11');
      expect(btn.className).toContain('focus-visible:ring-2');
    });

    const helperText = screen.getByText(/JPG, PNG or WebP/i);
    expect(helperText.className).toContain('text-xs');
    expect(helperText.className).toContain('text-gray-500');
  });

  it('CategoryForm Cancel and Save buttons use buttonClass and mobile touch targets', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderWithClient(<CategoryForm onSubmit={vi.fn()} onCancel={onCancel} />);

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelBtn.className).toContain('bg-white');
    expect(cancelBtn.className).toContain('border-gray-300');
    expect(cancelBtn.className).toContain('max-md:min-h-11');

    const saveBtn = screen.getByRole('button', { name: 'Save category' });
    expect(saveBtn.className).toContain('bg-blue-600');
    expect(saveBtn.className).toContain('text-white');
    expect(saveBtn.className).toContain('max-md:min-h-11');

    await user.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('Phase 5B: Group 2 — Admin Forms', () => {
  it('ProductForm Cancel and Submit buttons use buttonClass and mobile touch targets', () => {
    renderWithClient(
      <ProductForm
        initialValues={mockProductValues}
        categories={mockCategories}
        dealTags={[]}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelBtn.className).toContain('bg-white');
    expect(cancelBtn.className).toContain('border-gray-300');
    expect(cancelBtn.className).toContain('max-md:min-h-11');

    const saveBtn = screen.getByRole('button', { name: 'Save product' });
    expect(saveBtn.className).toContain('bg-blue-600');
    expect(saveBtn.className).toContain('text-white');
    expect(saveBtn.className).toContain('max-md:min-h-11');
  });

  it('CouponForm Cancel and Submit buttons use buttonClass and mobile touch targets', () => {
    renderWithClient(
      <CouponForm initialValues={mockCouponValues} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelBtn.className).toContain('bg-white');
    expect(cancelBtn.className).toContain('border-gray-300');
    expect(cancelBtn.className).toContain('max-md:min-h-11');

    const saveBtn = screen.getByRole('button', { name: 'Save coupon' });
    expect(saveBtn.className).toContain('bg-blue-600');
    expect(saveBtn.className).toContain('text-white');
    expect(saveBtn.className).toContain('max-md:min-h-11');
  });

  it('BannerForm Cancel and Submit buttons use buttonClass and mobile touch targets', () => {
    renderWithClient(
      <BannerForm
        kind="hero"
        initialValues={mockBannerValues}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelBtn.className).toContain('bg-white');
    expect(cancelBtn.className).toContain('border-gray-300');
    expect(cancelBtn.className).toContain('max-md:min-h-11');

    const saveBtn = screen.getByRole('button', { name: 'Save' });
    expect(saveBtn.className).toContain('bg-blue-600');
    expect(saveBtn.className).toContain('text-white');
    expect(saveBtn.className).toContain('max-md:min-h-11');
  });
});

describe('Phase 5B: Group 3 — Edit Pages with PageHeader', () => {
  it('ProductEditPage renders PageHeader as semantic h2 with back link', async () => {
    productApi.getAdminProduct.mockResolvedValue({ values: mockProductValues });
    renderWithClient(
      <Routes>
        <Route path="/admin/products/:id/edit" element={<ProductEditPage />} />
      </Routes>,
      ['/admin/products/p1/edit'],
    );

    const heading = await screen.findByRole('heading', { level: 2, name: 'Edit product' });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe('H2');

    const backLink = screen.getByRole('link', { name: /Back to products/i });
    expect(backLink).toHaveAttribute('href', '/admin/products');
  });

  it('CouponEditPage renders PageHeader as semantic h2 for new and existing coupons', async () => {
    couponApi.getAdminCoupon.mockResolvedValue({ values: mockCouponValues });
    const { unmount } = renderWithClient(
      <Routes>
        <Route path="/admin/coupons/:id/edit" element={<CouponEditPage />} />
      </Routes>,
      ['/admin/coupons/c1/edit'],
    );

    const editHeading = await screen.findByRole('heading', { level: 2, name: 'Edit coupon' });
    expect(editHeading).toBeInTheDocument();
    expect(editHeading.tagName).toBe('H2');

    const backLink = screen.getByRole('link', { name: /Back to coupons/i });
    expect(backLink).toHaveAttribute('href', '/admin/coupons');

    unmount();

    renderWithClient(
      <Routes>
        <Route path="/admin/coupons/new" element={<CouponEditPage />} />
      </Routes>,
      ['/admin/coupons/new'],
    );

    const newHeading = await screen.findByRole('heading', { level: 2, name: 'Add coupon' });
    expect(newHeading).toBeInTheDocument();
    expect(newHeading.tagName).toBe('H2');
  });

  it('BannerEditPage renders PageHeader as semantic h2 for new and existing banners', async () => {
    bannerApi.getAdminBanner.mockResolvedValue({ kind: 'hero', values: mockBannerValues });
    const { unmount } = renderWithClient(
      <Routes>
        <Route path="/admin/banners/:id/edit" element={<BannerEditPage />} />
      </Routes>,
      ['/admin/banners/b1/edit'],
    );

    const editHeading = await screen.findByRole('heading', { level: 2, name: 'Edit hero slide' });
    expect(editHeading).toBeInTheDocument();
    expect(editHeading.tagName).toBe('H2');

    const backLink = screen.getByRole('link', { name: /Back to banners/i });
    expect(backLink).toHaveAttribute('href', '/admin/banners');

    unmount();

    renderWithClient(
      <Routes>
        <Route path="/admin/banners/new" element={<BannerEditPage />} />
      </Routes>,
      ['/admin/banners/new?kind=announcement'],
    );

    const newHeading = await screen.findByRole('heading', { level: 2, name: 'Add announcement' });
    expect(newHeading).toBeInTheDocument();
    expect(newHeading.tagName).toBe('H2');
  });
});

describe('Phase 5B: Group 4 — Detail Pages Typography & Controls', () => {
  it('AdminOrderDetailPage renders font-semibold heading and WCAG-compliant timeline text', async () => {
    orderApi.getAdminOrder.mockResolvedValue(mockOrderDetail);
    renderWithClient(
      <Routes>
        <Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} />
      </Routes>,
      ['/admin/orders/11111111-1111-4111-8111-111111111111'],
    );

    const heading = await screen.findByRole('heading', { level: 2, name: 'Order SY-0042' });
    expect(heading.className).toContain('font-semibold');
    expect(heading.className).not.toContain('font-black');

    const pendingStep = screen.getByText('Shipped').closest('p');
    expect(pendingStep.className).toContain('text-gray-500');
  });

  it('AdminOrderDetailPage buttons include focus rings and mobile touch targets', async () => {
    orderApi.getAdminOrder.mockResolvedValue(mockOrderDetail);
    renderWithClient(
      <Routes>
        <Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} />
      </Routes>,
      ['/admin/orders/11111111-1111-4111-8111-111111111111'],
    );

    const copyBtn = await screen.findByRole('button', { name: /Copy the Stripe payment intent/i });
    expect(copyBtn.className).toContain('max-md:min-h-11');
    expect(copyBtn.className).toContain('focus-visible:ring-2');

    const saveTrackingBtn = screen.getByRole('button', { name: 'Save tracking' });
    expect(saveTrackingBtn.className).toContain('max-md:min-h-11');
    expect(saveTrackingBtn.className).toContain('focus-visible:ring-2');

    const shipActionBtn = screen.getByRole('button', { name: 'Mark as shipped' });
    expect(shipActionBtn.className).toContain('max-md:min-h-11');
    expect(shipActionBtn.className).toContain('focus-visible:ring-2');
  });

  it('AdminReviewDetailPage renders font-semibold heading and text-xs badges', async () => {
    reviewApi.getAdminReview.mockResolvedValue(mockReviewDetail);
    renderWithClient(
      <Routes>
        <Route path="/admin/reviews/:id" element={<AdminReviewDetailPage />} />
      </Routes>,
      ['/admin/reviews/22222222-2222-4222-8222-222222222222'],
    );

    const heading = await screen.findByRole('heading', { level: 2, name: 'Review by Sam L.' });
    expect(heading.className).toContain('font-semibold');
    expect(heading.className).not.toContain('font-black');

    const verifiedBadge = screen.getByText('Verified Purchase');
    expect(verifiedBadge.className).toContain('text-xs');
    expect(verifiedBadge.className).toContain('font-bold');
  });

  it('AdminReviewDetailPage moderation action buttons include focus rings and mobile touch targets', async () => {
    reviewApi.getAdminReview.mockResolvedValue(mockReviewDetail);
    renderWithClient(
      <Routes>
        <Route path="/admin/reviews/:id" element={<AdminReviewDetailPage />} />
      </Routes>,
      ['/admin/reviews/22222222-2222-4222-8222-222222222222'],
    );

    const approveBtn = await screen.findByRole('button', { name: 'Approve' });
    expect(approveBtn.className).toContain('max-md:min-h-11');
    expect(approveBtn.className).toContain('focus-visible:ring-2');

    const rejectBtn = screen.getByRole('button', { name: 'Reject' });
    expect(rejectBtn.className).toContain('max-md:min-h-11');
    expect(rejectBtn.className).toContain('focus-visible:ring-2');

    const deleteBtn = screen.getByRole('button', { name: 'Delete' });
    expect(deleteBtn.className).toContain('max-md:min-h-11');
    expect(deleteBtn.className).toContain('focus-visible:ring-2');

    const removePhotoBtn = screen.getByRole('button', { name: 'Remove photo 1' });
    expect(removePhotoBtn.className).toContain('max-md:min-h-11');
    expect(removePhotoBtn.className).toContain('focus-visible:ring-2');
  });
});
