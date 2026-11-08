import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    status: 'authenticated',
    isAdmin: true,
    user: { email: 'admin@example.com' },
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

const COUNTS = {
  activeProducts: 8,
  inactiveProducts: 2,
  categories: 4,
  customers: 11,
  outOfStock: 1,
  lowStock: 3,
};

const product = (overrides = {}) => ({
  id: 'p1',
  slug: 'p1',
  title: 'Wireless Earbuds',
  priceMinor: 1299,
  currency: 'USD',
  stock: 40,
  isActive: true,
  category: 'Electronics',
  image: null,
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  service.getCount.mockImplementation((name) => Promise.resolve(COUNTS[name]));
  service.listLowStockProducts.mockResolvedValue([]);
  service.listAdminProducts.mockResolvedValue([]);
  service.listAdminCategories.mockResolvedValue([]);
});

describe('admin layout', () => {
  it('shows the signed-in admin email, working links and greyed-out future sections', () => {
    renderAdmin();

    const nav = screen.getByRole('navigation', { name: 'Admin' });
    expect(within(nav).getByRole('link', { name: 'Products' })).toHaveAttribute(
      'href',
      '/admin/products',
    );
    expect(within(nav).queryByRole('link', { name: /orders/i })).not.toBeInTheDocument();
    expect(within(nav).getByText('Phase 3')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Coupons' })).toHaveAttribute(
      'href',
      '/admin/coupons',
    );
    expect(within(nav).getByRole('link', { name: 'Banners' })).toHaveAttribute(
      'href',
      '/admin/banners',
    );
    expect(within(nav).getByText('Phase 5')).toBeInTheDocument();
    expect(screen.getAllByText('admin@example.com').length).toBeGreaterThan(0);
  });

  it('logs out', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await user.click(screen.getByRole('button', { name: /log out/i }));
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('toggles the mobile menu', async () => {
    const user = userEvent.setup();
    renderAdmin();
    const toggle = screen.getByRole('button', { name: /open menu/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: /close menu/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});

describe('overview', () => {
  it('shows real counts from the database and no invented orders or revenue', async () => {
    renderAdmin();

    const card = async (label) =>
      (await screen.findByRole('heading', { level: 3, name: label })).closest('div');
    expect(await within(await card('Active products')).findByText('8')).toBeInTheDocument();
    expect(await within(await card('Customers')).findByText('11')).toBeInTheDocument();
    expect(await within(await card('Out of stock')).findByText('1')).toBeInTheDocument();
    expect(await within(await card('Low stock (5 or fewer)')).findByText('3')).toBeInTheDocument();

    expect(within(await card('Orders')).getByText(/after Phase 3/)).toBeInTheDocument();
    expect(within(await card('Revenue')).getByText(/after Phase 3/)).toBeInTheDocument();
    expect(screen.queryByText('Huzaifa Javid')).not.toBeInTheDocument();
  });

  it('shows an error with retry for a failed count, never a zero', async () => {
    service.getCount.mockImplementation((name) =>
      name === 'customers' ? Promise.reject(new Error('x')) : Promise.resolve(COUNTS[name]),
    );
    renderAdmin();

    const card = (await screen.findByRole('heading', { level: 3, name: 'Customers' })).closest(
      'div',
    );
    expect(await within(card).findByRole('alert')).toHaveTextContent(/couldn.t load/i);
    expect(within(card).queryByText('0')).not.toBeInTheDocument();
  });

  it('lists the products that need attention', async () => {
    service.listLowStockProducts.mockResolvedValue([
      { id: 'a', slug: 'a', title: 'Sold Out Lamp', stock: 0 },
      { id: 'b', slug: 'b', title: 'Last Few Mugs', stock: 2 },
    ]);
    renderAdmin();

    expect(await screen.findByText('Sold Out Lamp')).toBeInTheDocument();
    expect(screen.getAllByText('Out of stock').length).toBeGreaterThan(0);
    expect(screen.getByText('2 left')).toBeInTheDocument();
  });

  it('says so when nothing needs attention', async () => {
    renderAdmin();
    expect(await screen.findByText(/nothing is out of stock/i)).toBeInTheDocument();
  });
});

describe('products', () => {
  it('lists active and inactive products and filters them', async () => {
    service.listAdminProducts.mockResolvedValue([
      product(),
      product({ id: 'p2', title: 'Old Kettle', isActive: false, stock: 0 }),
    ]);
    const user = userEvent.setup();
    renderAdmin('/admin/products');

    expect(await screen.findByText('Wireless Earbuds')).toBeInTheDocument();
    expect(screen.getByText('Old Kettle')).toBeInTheDocument();
    expect(screen.getAllByText('$12.99')).toHaveLength(2);
    expect(within(screen.getByRole('table')).getByText('Inactive')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'inactive');
    expect(screen.queryByText('Wireless Earbuds')).not.toBeInTheDocument();
    expect(screen.getByText('Old Kettle')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'all');
    await user.type(screen.getByLabelText('Search products'), 'zzz');
    expect(screen.getByText(/no products match/i)).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    service.listAdminProducts.mockRejectedValue(new Error('x'));
    renderAdmin('/admin/products');
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load the products/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('offers add, edit and deactivate, but never a hard delete', async () => {
    service.listAdminProducts.mockResolvedValue([product()]);
    renderAdmin('/admin/products');
    await screen.findByText('Wireless Earbuds');

    expect(screen.getByRole('link', { name: 'Add product' })).toHaveAttribute(
      'href',
      '/admin/products/new',
    );
    expect(screen.getByRole('link', { name: 'Edit Wireless Earbuds' })).toHaveAttribute(
      'href',
      '/admin/products/p1',
    );
    expect(screen.getByRole('button', { name: 'Deactivate Wireless Earbuds' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^delete/i })).not.toBeInTheDocument();
  });
});

describe('categories', () => {
  it('lists categories including inactive ones', async () => {
    service.listAdminCategories.mockResolvedValue([
      { id: 'c1', name: 'Electronics', slug: 'electronics', isActive: true, sortOrder: 1 },
      { id: 'c2', name: 'Retired', slug: 'retired', isActive: false, sortOrder: 2 },
    ]);
    renderAdmin('/admin/categories');

    expect(await screen.findByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Retired')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Inactive')).toBeInTheDocument();
  });
});

describe('placeholders and unknown paths', () => {
  it('shows an honest coming-soon page for orders', () => {
    renderAdmin('/admin/orders');
    expect(screen.getByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    expect(screen.getByText(/coming in phase 3/i)).toBeInTheDocument();
  });

  it('sends unknown admin paths back to the overview', async () => {
    renderAdmin('/admin/nope');
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  });
});
