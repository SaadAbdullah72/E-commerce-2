import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ account: null, signOut: vi.fn() }));
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    status: 'authenticated',
    isAdmin: true,
    user: { email: 'khaleej.owner@example.com' },
    account: auth.account,
    signOut: auth.signOut,
  }),
}));

const service = vi.hoisted(() => ({
  getCount: vi.fn(),
  listLowStockProducts: vi.fn(),
  listAdminProducts: vi.fn(),
  listAdminCategories: vi.fn(),
}));
vi.mock('./services/adminService', () => service);
const orderService = vi.hoisted(() => ({ getOrderStats: vi.fn(), listAdminOrders: vi.fn() }));
vi.mock('./services/orderAdminService', () => orderService);
const reviewService = vi.hoisted(() => ({ countPendingReviews: vi.fn() }));
vi.mock('./services/reviewAdminService', () => reviewService);
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));

import AdminRoutes from './routes';

function renderAdmin(path = '/admin') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/*" element={<AdminRoutes />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const stats = (overrides = {}) => ({
  today: '2030-01-30',
  byStatus: { pending_payment: 0, paid: 2, shipped: 1, delivered: 4, cancelled: 0 },
  toShip: 2,
  needsRefund: 1,
  revenue: [
    {
      currency: 'USD',
      orders: 7,
      allTimeMinor: 90000,
      last24hMinor: 0,
      last7dMinor: 0,
      last30dMinor: 20000,
      averageOrderMinor: 12857,
    },
  ],
  daily: [],
  topProducts: [],
  ...overrides,
});

const order = (overrides = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  orderNumber: 'SY-1001',
  status: 'paid',
  currency: 'USD',
  totalMinor: 4500,
  customerName: 'Amina Bello',
  customerEmail: 'amina@example.com',
  paymentIssue: null,
  trackingNumber: null,
  createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  auth.account = null;
  service.getCount.mockResolvedValue(3);
  service.listLowStockProducts.mockResolvedValue([]);
  service.listAdminProducts.mockResolvedValue([]);
  service.listAdminCategories.mockResolvedValue([]);
  orderService.listAdminOrders.mockResolvedValue({ orders: [], nextCursor: null });
  orderService.getOrderStats.mockResolvedValue(stats());
  reviewService.countPendingReviews.mockResolvedValue(0);
});

describe('layout', () => {
  it('has a skip link to the main content', () => {
    renderAdmin();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(document.getElementById('main-content')).toBeInTheDocument();
  });

  it('shows a breadcrumb with the section, and a generic word for a child page', async () => {
    renderAdmin('/admin/products/new');
    const crumbs = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Products' })).toHaveAttribute(
      'href',
      '/admin/products',
    );
    expect(within(crumbs).getByText('New')).toHaveAttribute('aria-current', 'page');
  });

  it('has no breadcrumb on the overview', () => {
    renderAdmin('/admin');
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
  });

  it('opens the phone menu, closes it with Escape and keeps the aria-expanded state right', async () => {
    renderAdmin();
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('logs out from the header', async () => {
    renderAdmin();
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('groups the sidebar and marks the current page', async () => {
    renderAdmin('/admin/orders');
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    for (const group of ['Store', 'Catalog', 'Sales', 'Marketing', 'Insights']) {
      expect(within(nav).getByRole('group', { name: group })).toBeInTheDocument();
    }
    const sales = within(nav).getByRole('group', { name: 'Sales' });
    expect(within(sales).getByRole('link', { name: /Orders/ })).toHaveAttribute('aria-current', 'page');
    expect(within(sales).getByRole('link', { name: 'Coupons' })).not.toHaveAttribute('aria-current');
  });

  it('shows the to-ship badge in red and the pending-reviews badge in amber', async () => {
    reviewService.countPendingReviews.mockResolvedValue(4);
    renderAdmin('/admin/orders');
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    expect((await within(nav).findByLabelText('2 to ship')).className).toContain('bg-red-600');
    expect((await within(nav).findByLabelText('4 pending')).className).toContain('text-amber-800');
  });
});

describe('overview', () => {
  it('greets by the profile name, with the date', async () => {
    auth.account = { fullName: 'Noor' };
    renderAdmin();
    expect(await screen.findByText(/Welcome back, Noor ·/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Overview', level: 2 })).toBeInTheDocument();
  });

  it('falls back to the start of the email when there is no profile name', async () => {
    renderAdmin();
    expect(await screen.findByText(/Welcome back, khaleej\.owner ·/)).toBeInTheDocument();
  });

  it('has the two quick actions', async () => {
    renderAdmin();
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: 'View orders' })).toHaveAttribute('href', '/admin/orders');
    expect(within(main).getByRole('link', { name: /Add product/ })).toHaveAttribute(
      'href',
      '/admin/products/new',
    );
  });

  it('the four main cards: red when something is waiting, plain at zero, green revenue', async () => {
    renderAdmin();
    const card = async (label) =>
      (await screen.findByRole('heading', { level: 3, name: label })).closest('div');

    expect(await within(await card('Orders to ship')).findByText('2')).toHaveClass('text-red-700');
    expect(await within(await card('Needs refund')).findByText('1')).toHaveClass('text-red-700');
    expect(await within(await card('Paid orders')).findByText('7')).toHaveClass('text-blue-700');
    expect(await within(await card('Revenue (last 30 days)')).findByText('$200.00')).toHaveClass(
      'text-green-700',
    );
  });

  it('does not use the red colour when nothing is waiting', async () => {
    orderService.getOrderStats.mockResolvedValue(stats({ toShip: 0, needsRefund: 0 }));
    renderAdmin();
    const card = (await screen.findByRole('heading', { level: 3, name: 'Orders to ship' })).closest('div');
    const value = await within(card).findByText('0');
    expect(value).not.toHaveClass('text-red-700');
    expect(value).toHaveClass('text-gray-900');
  });

  it('lists recent orders (at most 5), each linking to the order, with the customer and total', async () => {
    const orders = Array.from({ length: 7 }, (_, index) =>
      order({
        id: `11111111-1111-4111-8111-11111111111${index}`,
        orderNumber: `SY-${1001 + index}`,
        paymentIssue: index === 0 ? 'payment_issue' : null,
      }),
    );
    orderService.listAdminOrders.mockResolvedValue({ orders, nextCursor: null });
    renderAdmin();

    const link = await screen.findByRole('link', { name: /SY-1001/ });
    expect(link).toHaveAttribute('href', '/admin/orders/11111111-1111-4111-8111-111111111110');
    expect(within(link).getByText(/Amina Bello · amina@example.com/)).toBeInTheDocument();
    expect(within(link).getByText('$45.00')).toBeInTheDocument();
    expect(within(link).getByText('2 hours ago')).toHaveAttribute('title');
    expect(within(link).getByText('Needs refund')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /SY-1006/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /SY-1005/ })).toBeInTheDocument();
  });

  it('recent orders: empty state, and an error with Try again', async () => {
    renderAdmin();
    expect(await screen.findByText(/No orders yet\. Orders appear here/)).toBeInTheDocument();
  });

  it('recent orders: a failed load shows an error, not an empty list', async () => {
    orderService.listAdminOrders.mockRejectedValue(new Error('x'));
    renderAdmin();
    expect(await screen.findByText("We couldn't load the recent orders.")).toBeInTheDocument();
    expect(screen.queryByText(/No orders yet\. Orders appear here/)).not.toBeInTheDocument();
  });

  it('needs attention: urgent and pending rows link to the right page', async () => {
    reviewService.countPendingReviews.mockResolvedValue(3);
    renderAdmin();
    expect(await screen.findByRole('link', { name: /2 orders to ship/ })).toHaveAttribute('href', '/admin/orders');
    expect(screen.getByRole('link', { name: /1 order needs a refund/ })).toHaveAttribute('href', '/admin/orders');
    expect(await screen.findByRole('link', { name: /3 reviews waiting for approval/ })).toHaveAttribute(
      'href',
      '/admin/reviews',
    );
  });

  it('needs attention: nothing urgent, no rows, and the stock list says so', async () => {
    orderService.getOrderStats.mockResolvedValue(stats({ toShip: 0, needsRefund: 0 }));
    renderAdmin();
    expect(await screen.findByText('Nothing is out of stock or running low.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /orders? to ship/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /needs? a refund|need a refund/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/waiting for approval/)).not.toBeInTheDocument();
  });

  it('needs attention: when the order numbers cannot load, no urgent row (never a made-up 0)', async () => {
    orderService.getOrderStats.mockRejectedValue(new Error('x'));
    renderAdmin();
    expect(await screen.findByText('Nothing is out of stock or running low.')).toBeInTheDocument();
    expect(screen.queryByText(/orders to ship/)).not.toBeInTheDocument();
  });

  it('has six quick links with counts only where the number is known', async () => {
    reviewService.countPendingReviews.mockResolvedValue(5);
    renderAdmin();
    const section = (await screen.findByRole('heading', { name: 'Quick links' })).closest('section');
    const links = within(section).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/admin/products',
      '/admin/orders',
      '/admin/reviews',
      '/admin/coupons',
      '/admin/banners',
      '/admin/analytics',
    ]);
    expect(await within(section).findByText('3 active')).toBeInTheDocument();
    expect(within(section).getByText('7 in total')).toBeInTheDocument();
    expect(await within(section).findByText('5 pending')).toBeInTheDocument();
    expect(within(links[3]).queryByText(/\d/)).not.toBeInTheDocument();
  });

  it('keeps the catalog cards under "Shop at a glance"', async () => {
    renderAdmin();
    const section = (await screen.findByRole('heading', { name: 'Shop at a glance' })).closest('section');
    for (const label of ['Active products', 'Inactive products', 'Categories', 'Customers', 'Out of stock']) {
      expect(within(section).getByRole('heading', { level: 3, name: label })).toBeInTheDocument();
    }
  });
});
