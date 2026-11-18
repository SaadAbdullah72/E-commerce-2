import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const logService = vi.hoisted(() => ({ listAuditLog: vi.fn() }));
const statsService = vi.hoisted(() => ({ getCatalogStats: vi.fn() }));
vi.mock('../services/auditLogService', async (importOriginal) => ({
  ...(await importOriginal()),
  listAuditLog: logService.listAuditLog,
}));
vi.mock('../services/analyticsService', () => statsService);
const orderStatsService = vi.hoisted(() => ({ getOrderStats: vi.fn() }));
vi.mock('../services/orderAdminService', () => orderStatsService);
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));

import AnalyticsPage from './AnalyticsPage';
import LogsPage from './LogsPage';

function renderPage(ui) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const entry = (id, overrides = {}) => ({
  id,
  at: '2030-01-01T10:00:00Z',
  actorId: 'u1',
  actorEmail: 'admin@example.com',
  action: 'update',
  table: 'products',
  recordId: 'p1',
  label: 'Earbuds',
  summary: `Updated product "Earbuds" (price_minor) #${id}`,
  changes: { price_minor: { from: 1000, to: 1200 } },
  ...overrides,
});

beforeEach(() => vi.resetAllMocks());

describe('LogsPage', () => {
  it('lists entries with time, admin, action and summary', async () => {
    logService.listAuditLog.mockResolvedValue({
      entries: [
        entry(2),
        entry(1, { actorEmail: null, action: 'insert', table: 'coupons', changes: null }),
      ],
      nextBefore: null,
    });
    renderPage(<LogsPage />);

    expect(
      await screen.findByText(/Updated product "Earbuds" \(price_minor\) #2/),
    ).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument(); // no signed-in actor
    const list = screen.getByRole('list');
    expect(within(list).getByText('Updated')).toBeInTheDocument();
    expect(within(list).getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('End of the log')).toBeInTheDocument();
  });

  it('expands a row to show before and after, and collapses it again', async () => {
    const user = userEvent.setup();
    logService.listAuditLog.mockResolvedValue({ entries: [entry(2)], nextBefore: null });
    renderPage(<LogsPage />);

    const toggle = await screen.findByRole('button', { name: /Updated product/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('$12.00')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const details = document.getElementById(toggle.getAttribute('aria-controls'));
    expect(within(details).getByText('Price')).toBeInTheDocument();
    expect(within(details).getByText('$10.00')).toBeInTheDocument();
    expect(within(details).getByText('$12.00')).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByText('$12.00')).not.toBeInTheDocument();
  });

  it('shows what a deleted record looked like, and a note when nothing was recorded', async () => {
    const user = userEvent.setup();
    logService.listAuditLog.mockResolvedValue({
      entries: [
        entry(3, { action: 'delete', summary: 'Deleted deal tag "Hot"', changes: { name: 'Hot' } }),
        entry(2, { action: 'insert', summary: 'Created coupon "X"', changes: null }),
      ],
      nextBefore: null,
    });
    renderPage(<LogsPage />);

    await user.click(await screen.findByRole('button', { name: /Deleted deal tag/ }));
    expect(screen.getByText('The record as it was')).toBeInTheDocument();
    expect(screen.getByText('Hot')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Created coupon/ }));
    expect(screen.getByText(/No field-level details were recorded/)).toBeInTheDocument();
  });

  it('shows text from the log as plain text, never as markup', async () => {
    logService.listAuditLog.mockResolvedValue({
      entries: [entry(1, { summary: 'Updated product "<img src=x onerror=alert(1)>"' })],
      nextBefore: null,
    });
    const { container } = renderPage(<LogsPage />);
    expect(await screen.findByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('filters by area and action, searches on submit, and can clear them', async () => {
    const user = userEvent.setup();
    logService.listAuditLog.mockResolvedValue({ entries: [entry(1)], nextBefore: null });
    renderPage(<LogsPage />);
    await screen.findByText(/#1/);

    await user.selectOptions(screen.getByLabelText('Filter by area'), 'coupons');
    await user.selectOptions(screen.getByLabelText('Filter by action'), 'delete');
    await user.type(screen.getByLabelText('Search the log'), 'spring');
    // Typing alone does not search yet.
    expect(logService.listAuditLog).not.toHaveBeenCalledWith(
      expect.objectContaining({ search: 'spring' }),
    );
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await vi.waitFor(() =>
      expect(logService.listAuditLog).toHaveBeenLastCalledWith({
        table: 'coupons',
        action: 'delete',
        search: 'spring',
        before: null,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await vi.waitFor(() =>
      expect(logService.listAuditLog).toHaveBeenLastCalledWith({
        table: '',
        action: '',
        search: '',
        before: null,
      }),
    );
  });

  it('loads more with the id of the last entry, and appends them', async () => {
    const user = userEvent.setup();
    logService.listAuditLog
      .mockResolvedValueOnce({ entries: [entry(10)], nextBefore: 10 })
      .mockResolvedValueOnce({ entries: [entry(9)], nextBefore: null });
    renderPage(<LogsPage />);

    await screen.findByText(/#10/);
    expect(screen.queryByText('End of the log')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText(/#9/)).toBeInTheDocument();
    expect(screen.getByText(/#10/)).toBeInTheDocument();
    expect(logService.listAuditLog).toHaveBeenLastCalledWith(
      expect.objectContaining({ before: 10 }),
    );
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(screen.getByText('End of the log')).toBeInTheDocument();
  });

  it('has clear empty, filtered-empty and error states', async () => {
    const user = userEvent.setup();
    logService.listAuditLog.mockResolvedValue({ entries: [], nextBefore: null });
    renderPage(<LogsPage />);
    expect(await screen.findByText('No changes have been logged yet.')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Filter by action'), 'delete');
    expect(await screen.findByText('No log entries match these filters.')).toBeInTheDocument();
  });

  it('shows an error with a retry when the log cannot load', async () => {
    const user = userEvent.setup();
    logService.listAuditLog.mockRejectedValueOnce(new Error('x'));
    renderPage(<LogsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load the activity log/i);

    logService.listAuditLog.mockResolvedValue({ entries: [entry(1)], nextBefore: null });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/#1/)).toBeInTheDocument();
  });
});

const STATS = {
  products: { total: 12, active: 9, inactive: 3 },
  stock: { outOfStock: 1, low: 2, healthy: 6 },
  inventoryValueMinor: 1234567,
  customers: 21,
  byCategory: [
    { id: 'c1', name: 'Electronics', active: 6, inactive: 1 },
    { id: 'c2', name: 'Home', active: 3, inactive: 0 },
  ],
  signups: [
    { day: '2030-01-01', count: 0 },
    { day: '2030-01-02', count: 4 },
    { day: '2030-01-03', count: 1 },
  ],
};

describe('AnalyticsPage', () => {
  it('shows the real numbers from the database', async () => {
    statsService.getCatalogStats.mockResolvedValue(STATS);
    renderPage(<AnalyticsPage />);

    const kpi = async (label) =>
      (await screen.findByRole('heading', { name: label, level: 3 })).parentElement;

    expect(within(await kpi('Customers')).getByText('21')).toBeInTheDocument();
    expect(within(await kpi('Active products')).getByText('9')).toBeInTheDocument();
    expect(within(await kpi('Active products')).getByText('12 in total')).toBeInTheDocument();
    expect(within(await kpi('Inactive products')).getByText('3')).toBeInTheDocument();
    expect(within(await kpi('Inventory value')).getByText('$12,345.67')).toBeInTheDocument();
  });

  it('draws products per category, the splits and the sign-up chart with readable numbers', async () => {
    statsService.getCatalogStats.mockResolvedValue(STATS);
    renderPage(<AnalyticsPage />);

    const categories = (await screen.findByText('Electronics')).closest('ul');
    expect(within(categories).getByText('(+1 inactive)')).toBeInTheDocument();
    expect(within(categories).getByText('Home')).toBeInTheDocument();

    expect(screen.getByText(/In stock:/)).toBeInTheDocument();
    expect(screen.getByText(/Out of stock:/)).toBeInTheDocument();
    expect(screen.getByText(/Inactive:/)).toBeInTheDocument();

    const chart = screen.getByRole('img', { name: /5 sign-ups between Jan 1 and Jan 3/ });
    expect(chart.querySelectorAll('rect')).toHaveLength(3);
    expect(screen.getByText('Jan 2: 4 sign-ups')).toBeInTheDocument();
  });

  it('shows no revenue block (and no made-up $0) before the first paid order', async () => {
    statsService.getCatalogStats.mockResolvedValue(STATS);
    orderStatsService.getOrderStats.mockResolvedValue({
      today: '2030-01-30',
      byStatus: { pending_payment: 1, paid: 0, shipped: 0, delivered: 0, cancelled: 0 },
      toShip: 0,
      needsRefund: 0,
      revenue: [],
      daily: [],
      topProducts: [],
    });
    renderPage(<AnalyticsPage />);
    await screen.findByText('Electronics');

    expect(await screen.findByText(/No paid orders yet/)).toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('shows real revenue, best sellers and the gross-revenue note', async () => {
    statsService.getCatalogStats.mockResolvedValue(STATS);
    orderStatsService.getOrderStats.mockResolvedValue({
      today: '2030-01-30',
      byStatus: { pending_payment: 0, paid: 2, shipped: 1, delivered: 1, cancelled: 3 },
      toShip: 2,
      needsRefund: 1,
      revenue: [
        {
          currency: 'USD',
          orders: 4,
          allTimeMinor: 40000,
          last24hMinor: 1000,
          last7dMinor: 5000,
          last30dMinor: 20000,
          averageOrderMinor: 10000,
        },
      ],
      daily: [{ day: '2030-01-30', currency: 'USD', orders: 1, revenueMinor: 1000 }],
      topProducts: [
        { productId: 'p1', title: 'Earbuds', currency: 'USD', units: 7, revenueMinor: 70000 },
      ],
    });
    renderPage(<AnalyticsPage />);

    expect(await screen.findByRole('heading', { name: 'Revenue (USD)' })).toBeInTheDocument();
    expect(screen.getByText('$400.00')).toBeInTheDocument(); // all time
    expect(screen.getByText('$100.00')).toBeInTheDocument(); // average order
    expect(screen.getByText('Earbuds')).toBeInTheDocument();
    expect(screen.getByText(/Revenue is gross/)).toHaveTextContent(/Refunds are handled manually/);
    expect(screen.getByRole('img', { name: /\$10\.00 in revenue/ })).toBeInTheDocument();
  });

  it('shows the Electronics catalog numbers even when the order numbers fail', async () => {
    statsService.getCatalogStats.mockResolvedValue(STATS);
    orderStatsService.getOrderStats.mockRejectedValue(new Error('x'));
    renderPage(<AnalyticsPage />);

    expect(await screen.findByText('Electronics')).toBeInTheDocument();
    expect(await screen.findByText(/couldn.t load the order numbers/i)).toBeInTheDocument();
  });

  it('shows an error with a retry when the stats fail, and no invented zeros', async () => {
    const user = userEvent.setup();
    orderStatsService.getOrderStats.mockResolvedValue({
      today: '2030-01-30',
      byStatus: { pending_payment: 0, paid: 0, shipped: 0, delivered: 0, cancelled: 0 },
      toShip: 0,
      needsRefund: 0,
      revenue: [],
      daily: [],
      topProducts: [],
    });
    statsService.getCatalogStats.mockRejectedValueOnce(new Error('x'));
    renderPage(<AnalyticsPage />);

    expect(await screen.findByText(/couldn.t load the analytics/i)).toBeInTheDocument();
    expect(screen.queryByText('Customers')).not.toBeInTheDocument(); // no invented zeros

    statsService.getCatalogStats.mockResolvedValue(STATS);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Electronics')).toBeInTheDocument();
  });

  it('handles a shop with nothing in it without crashing', async () => {
    statsService.getCatalogStats.mockResolvedValue({
      products: { total: 0, active: 0, inactive: 0 },
      stock: { outOfStock: 0, low: 0, healthy: 0 },
      inventoryValueMinor: 0,
      customers: 0,
      byCategory: [],
      signups: [],
    });
    renderPage(<AnalyticsPage />);

    expect(await screen.findByText('No categories yet.')).toBeInTheDocument();
    expect(screen.getByText('No products yet.')).toBeInTheDocument();
    expect(screen.getByText('No active products yet.')).toBeInTheDocument();
  });
});
