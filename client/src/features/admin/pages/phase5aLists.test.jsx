import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminService = vi.hoisted(() => ({
  listAdminProducts: vi.fn(),
  listAdminCategories: vi.fn(),
}));
vi.mock('../services/adminService', () => adminService);

const couponService = vi.hoisted(() => ({ listAdminCoupons: vi.fn() }));
vi.mock('../services/couponAdminService', () => couponService);

const bannerService = vi.hoisted(() => ({
  listAdminBanners: vi.fn(),
  swapBannerOrder: vi.fn(),
}));
vi.mock('../services/bannerAdminService', () => bannerService);

const reviewService = vi.hoisted(() => ({ listAdminReviews: vi.fn() }));
vi.mock('../services/reviewAdminService', () => reviewService);

const auditService = vi.hoisted(() => ({ listAuditLog: vi.fn() }));
vi.mock('../services/auditLogService', async (importOriginal) => ({
  ...(await importOriginal()),
  listAuditLog: auditService.listAuditLog,
}));

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));

import AdminReviewsPage from './AdminReviewsPage';
import BannersPage from './BannersPage';
import CategoriesPage from './CategoriesPage';
import CouponsPage from './CouponsPage';
import LogsPage from './LogsPage';
import ProductsPage from './ProductsPage';

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

const mockProduct = {
  id: 'p1',
  title: 'Wireless Keyboard',
  slug: 'wireless-keyboard',
  category: 'Electronics',
  priceMinor: 4999,
  currency: 'USD',
  stock: 12,
  isActive: true,
  image: 'https://example.com/keyboard.jpg',
};

const mockCoupon = {
  id: 'c1',
  code: 'SPRING20',
  type: 'percentage',
  discountPercent: 20,
  minSubtotalMinor: 5000,
  startsAt: '2030-03-01T00:00:00Z',
  expiresAt: '2030-03-31T23:59:59Z',
  usedCount: 5,
  usageLimit: 100,
  isActive: true,
};

const mockCategory = {
  id: 'cat1',
  name: 'Electronics',
  slug: 'electronics',
  sortOrder: 1,
  isActive: true,
};

const mockBanner1 = {
  id: 'b1',
  title: 'Spring Sale',
  badge: 'New',
  subtitle: 'Up to 50% off',
  buttonText: 'Shop now',
  theme: 'indigo',
  imageUrl: null,
  isActive: true,
  sortOrder: 1,
  startsAt: null,
  endsAt: null,
};

const mockBanner2 = {
  id: 'b2',
  title: 'Summer Preview',
  badge: null,
  subtitle: 'Coming soon',
  buttonText: null,
  theme: 'emerald',
  imageUrl: null,
  isActive: true,
  sortOrder: 2,
  startsAt: null,
  endsAt: null,
};

const mockReview = {
  id: 'r1',
  productTitle: 'Wireless Keyboard',
  authorName: 'Alice M.',
  accountEmail: 'alice@example.com',
  title: 'Great feel',
  commentPreview: 'Keys are responsive and quiet',
  rating: 5,
  mediaCount: 2,
  status: 'pending',
  createdAt: '2030-01-01T12:00:00Z',
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('Phase 5A: Products table-to-card', () => {
  it('renders table with explicit ARIA roles (table, rowgroup, row, columnheader, cell) and sr-only thead', async () => {
    adminService.listAdminProducts.mockResolvedValue([mockProduct]);
    renderWithClient(<ProductsPage />);

    const table = await screen.findByRole('table', { name: 'Products' });
    expect(table).toBeInTheDocument();
    expect(table.className).toContain('max-md:block');

    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders.length).toBeGreaterThanOrEqual(5);

    const thead = table.querySelector('thead');
    expect(thead).toHaveAttribute('role', 'rowgroup');
    expect(thead.className).toContain('max-md:sr-only');

    const tbody = table.querySelector('tbody');
    expect(tbody).toHaveAttribute('role', 'rowgroup');
    expect(tbody.className).toContain('max-md:block');
  });

  it('attaches data-label attributes to Category, Price, Stock and Status cells', async () => {
    adminService.listAdminProducts.mockResolvedValue([mockProduct]);
    renderWithClient(<ProductsPage />);

    await screen.findByText('Wireless Keyboard');

    const categoryCell = screen.getByText('Electronics').closest('td');
    expect(categoryCell).toHaveAttribute('data-label', 'Category');
    expect(categoryCell).toHaveAttribute('role', 'cell');

    const priceCell = screen.getByText('$49.99').closest('td');
    expect(priceCell).toHaveAttribute('data-label', 'Price');

    const stockCell = screen.getByText('12').closest('td');
    expect(stockCell).toHaveAttribute('data-label', 'Stock');

    const statusCell = screen.getByText('Active', { selector: 'span' }).closest('td');
    expect(statusCell).toHaveAttribute('data-label', 'Status');
  });

  it('renders exactly one DOM instance per product (no duplicate mobile DOM trees)', async () => {
    adminService.listAdminProducts.mockResolvedValue([mockProduct]);
    renderWithClient(<ProductsPage />);

    await screen.findByText('Wireless Keyboard');
    const titles = screen.getAllByText('Wireless Keyboard');
    expect(titles).toHaveLength(1);
  });
});

describe('Phase 5A: Coupons table-to-card', () => {
  it('renders table with data-labels (Discount, Minimum order, Valid, Used, Status) and explicit ARIA roles', async () => {
    couponService.listAdminCoupons.mockResolvedValue([mockCoupon]);
    renderWithClient(<CouponsPage />);

    const table = await screen.findByRole('table', { name: 'Coupons' });
    expect(table).toBeInTheDocument();
    expect(table.className).toContain('max-md:block');

    const cells = screen.getAllByRole('cell');
    const discountCell = cells.find((cell) => cell.getAttribute('data-label') === 'Discount');
    expect(discountCell).toBeDefined();

    const minOrderCell = cells.find((cell) => cell.getAttribute('data-label') === 'Minimum order');
    expect(minOrderCell).toBeDefined();
    expect(minOrderCell).toHaveTextContent('$50.00');

    const validCell = cells.find((cell) => cell.getAttribute('data-label') === 'Valid');
    expect(validCell).toBeDefined();
    expect(validCell.className).toContain('md:whitespace-nowrap');

    const usedCell = cells.find((cell) => cell.getAttribute('data-label') === 'Used');
    expect(usedCell).toBeDefined();

    const statusCell = cells.find((cell) => cell.getAttribute('data-label') === 'Status');
    expect(statusCell).toBeDefined();
  });

  it('places code and copy button in titleCell and renders actions in card footer', async () => {
    couponService.listAdminCoupons.mockResolvedValue([mockCoupon]);
    renderWithClient(<CouponsPage />);

    await screen.findByText('SPRING20');
    expect(screen.getByRole('button', { name: 'Copy SPRING20' })).toBeInTheDocument();

    const actionsCell = screen.getByRole('link', { name: 'Edit SPRING20' }).closest('td');
    expect(actionsCell).toHaveAttribute('role', 'cell');
    expect(actionsCell.className).toContain('max-md:border-t');
  });
});

describe('Phase 5A: Categories page modernization', () => {
  it('renders PageHeader with "Add category" CTA and Card table container', async () => {
    adminService.listAdminCategories.mockResolvedValue([mockCategory]);
    renderWithClient(<CategoriesPage />);

    expect(screen.getByRole('heading', { name: 'Categories', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add category' })).toBeInTheDocument();
  });

  it('renders responsive table with data-labels (Slug, Order, Status) and explicit ARIA roles', async () => {
    adminService.listAdminCategories.mockResolvedValue([mockCategory]);
    renderWithClient(<CategoriesPage />);

    const table = await screen.findByRole('table', { name: 'Categories' });
    expect(table).toHaveAttribute('role', 'table');
    expect(table.className).toContain('max-md:block');

    const slugCell = screen.getByText('electronics').closest('td');
    expect(slugCell).toHaveAttribute('data-label', 'Slug');

    const orderCell = screen.getByText('1').closest('td');
    expect(orderCell).toHaveAttribute('data-label', 'Order');

    const statusCell = screen.getByText('Active', { selector: 'span' }).closest('td');
    expect(statusCell).toHaveAttribute('data-label', 'Status');
  });

  it('row actions carry exact accessible names (Edit, Deactivate/Restore, Delete)', async () => {
    adminService.listAdminCategories.mockResolvedValue([mockCategory]);
    renderWithClient(<CategoriesPage />);

    await screen.findByText('Electronics');
    expect(screen.getByRole('button', { name: 'Edit Electronics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate Electronics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Electronics' })).toBeInTheDocument();
  });
});

describe('Phase 5A: Banners page polish', () => {
  it('banner tabs render with role="tab", aria-selected and mobile touch targets', async () => {
    bannerService.listAdminBanners.mockResolvedValue([mockBanner1, mockBanner2]);
    renderWithClient(<BannersPage />);

    const tabs = await screen.findAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0].className).toContain('max-md:min-h-11');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('reorder buttons carry accessible names and enforce boundary disabled states', async () => {
    bannerService.listAdminBanners.mockResolvedValue([mockBanner1, mockBanner2]);
    renderWithClient(<BannersPage />);

    await screen.findByText('Spring Sale');
    const moveUp1 = screen.getByRole('button', { name: 'Move Spring Sale up' });
    const moveDown1 = screen.getByRole('button', { name: 'Move Spring Sale down' });
    expect(moveUp1).toBeDisabled();
    expect(moveDown1).not.toBeDisabled();

    const moveDown2 = screen.getByRole('button', { name: 'Move Summer Preview down' });
    expect(moveDown2).toBeDisabled();
  });

  it('NoticeBanner displays status role and dismisses on click', async () => {
    const user = userEvent.setup();
    bannerService.listAdminBanners.mockResolvedValue([mockBanner1]);
    renderWithClient(<BannersPage />, [{ pathname: '/admin/banners', state: { notice: 'Banner added.' } }]);

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Banner added.');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('Phase 5A: Reviews list polish', () => {
  it('filter toolbar renders inside Card with status, rating, media selects and search Input', async () => {
    reviewService.listAdminReviews.mockResolvedValue({
      reviews: [mockReview],
      nextCursor: null,
    });
    renderWithClient(<AdminReviewsPage />);

    expect(screen.getByLabelText('Filter by status')).toHaveValue('pending');
    expect(screen.getByLabelText('Filter by rating')).toHaveValue('');
    expect(screen.getByLabelText('Filter by photos and video')).toHaveValue('any');
    expect(screen.getByLabelText('Search reviews')).toBeInTheDocument();
  });

  it('review rows render relative time with full date in title attribute and correct media badge', async () => {
    reviewService.listAdminReviews.mockResolvedValue({
      reviews: [mockReview],
      nextCursor: null,
    });
    renderWithClient(<AdminReviewsPage />);

    await screen.findByText('Wireless Keyboard');
    expect(screen.getByLabelText('2 files')).toBeInTheDocument();

    const time = screen.getByText('Wireless Keyboard').closest('li').querySelector('time');
    expect(time).toBeInTheDocument();
    expect(time).toHaveAttribute('datetime', '2030-01-01T12:00:00Z');
    expect(time).toHaveAttribute('title');
  });
});

describe('Phase 5A: Activity log polish', () => {
  it('action badges render with semantic tone mappings (insert=green, update=amber, delete=red)', async () => {
    auditService.listAuditLog.mockResolvedValue({
      entries: [
        {
          id: 'l1',
          at: '2030-01-01T12:00:00Z',
          actorEmail: 'admin@example.com',
          action: 'insert',
          table: 'products',
          summary: 'Created product "Keyboard"',
          changes: null,
        },
        {
          id: 'l2',
          at: '2030-01-01T13:00:00Z',
          actorEmail: 'admin@example.com',
          action: 'update',
          table: 'categories',
          summary: 'Updated category "Tech"',
          changes: null,
        },
        {
          id: 'l3',
          at: '2030-01-01T14:00:00Z',
          actorEmail: 'admin@example.com',
          action: 'delete',
          table: 'coupons',
          summary: 'Deleted coupon "OLD"',
          changes: null,
        },
      ],
      nextBefore: null,
    });
    renderWithClient(<LogsPage />);

    await screen.findByText(/Created product "Keyboard"/);
    const createdBadge = screen.getByText('Created', { selector: 'span' });
    expect(createdBadge.className).toContain('text-green-800');

    const updatedBadge = screen.getByText('Updated', { selector: 'span' });
    expect(updatedBadge.className).toContain('text-amber-800');

    const deletedBadge = screen.getByText('Deleted', { selector: 'span' });
    expect(deletedBadge.className).toContain('text-red-800');
  });
});
