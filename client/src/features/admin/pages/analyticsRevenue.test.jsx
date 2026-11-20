import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const statsService = vi.hoisted(() => ({ getCatalogStats: vi.fn() }));
vi.mock('../services/analyticsService', () => statsService);
const orderStatsService = vi.hoisted(() => ({ getOrderStats: vi.fn() }));
vi.mock('../services/orderAdminService', () => orderStatsService);
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));

import AnalyticsPage from './AnalyticsPage';

const CATALOG = {
  products: { total: 2, active: 2, inactive: 0 },
  stock: { outOfStock: 0, low: 0, healthy: 2 },
  inventoryValueMinor: 1000,
  customers: 3,
  byCategory: [],
  signups: [],
};

/** A day string n days before 2030-01-30. */
const dayBack = (n) => new Date(Date.UTC(2030, 0, 30 - n)).toISOString().slice(0, 10);

const stats = (daily, topProducts = [], revenueOverrides = {}) => ({
  today: '2030-01-30',
  byStatus: { pending_payment: 1, paid: 2, shipped: 1, delivered: 4, cancelled: 3 },
  toShip: 2,
  needsRefund: 0,
  revenue: [
    {
      currency: 'USD',
      orders: 7,
      allTimeMinor: 90000,
      last24hMinor: 1000,
      last7dMinor: 5000,
      last30dMinor: 20000,
      averageOrderMinor: 12857,
      ...revenueOverrides,
    },
  ],
  daily,
  topProducts,
});

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const kpi = async (label) =>
  (await screen.findByRole('heading', { name: label, level: 3 })).parentElement;

beforeEach(() => {
  vi.resetAllMocks();
  statsService.getCatalogStats.mockResolvedValue(CATALOG);
});

describe('Analytics: revenue cards', () => {
  it('shows a sparkline on the 24h, 7d and 30d cards, but not on All time', async () => {
    orderStatsService.getOrderStats.mockResolvedValue(
      stats([{ day: dayBack(0), currency: 'USD', orders: 1, revenueMinor: 1000 }]),
    );
    renderPage();
    expect(within(await kpi('Last 24 hours')).getByRole('img', { name: 'Last 7 days, 7 days' })).toBeInTheDocument();
    expect(within(await kpi('Last 7 days')).getByRole('img', { name: 'Last 7 days, 7 days' })).toBeInTheDocument();
    expect(within(await kpi('Last 30 days')).getByRole('img', { name: 'Last 30 days, 30 days' })).toBeInTheDocument();
    expect(within(await kpi('All time')).queryByRole('img')).not.toBeInTheDocument();
  });

  it('the 7-day card says, in words, how it compares with the 7 days before', async () => {
    const daily = [
      ...Array.from({ length: 7 }, (_, i) => ({ day: dayBack(i + 8), currency: 'USD', orders: 1, revenueMinor: 1000 })),
      ...Array.from({ length: 7 }, (_, i) => ({ day: dayBack(i + 1), currency: 'USD', orders: 1, revenueMinor: 1500 })),
      // today (unfinished) must not change the answer
      { day: dayBack(0), currency: 'USD', orders: 1, revenueMinor: 50 },
    ];
    orderStatsService.getOrderStats.mockResolvedValue(stats(daily));
    renderPage();
    const card = await kpi('Last 7 days');
    expect(within(card).getByText('Up 50% vs the 7 days before')).toBeInTheDocument();
    expect(within(card).getByText('Up 50% vs the 7 days before').className).toContain('text-green-700');
    expect(within(card).getByText('Full UTC days, today not counted')).toBeInTheDocument();
  });

  it('a drop is red and says "Down"', async () => {
    const daily = [
      ...Array.from({ length: 7 }, (_, i) => ({ day: dayBack(i + 8), currency: 'USD', orders: 1, revenueMinor: 2000 })),
      ...Array.from({ length: 7 }, (_, i) => ({ day: dayBack(i + 1), currency: 'USD', orders: 1, revenueMinor: 1000 })),
    ];
    orderStatsService.getOrderStats.mockResolvedValue(stats(daily));
    renderPage();
    const text = await within(await kpi('Last 7 days')).findByText('Down 50% vs the 7 days before');
    expect(text.className).toContain('text-red-700');
  });

  it('shows no comparison when there is nothing to compare, and never on the other cards', async () => {
    orderStatsService.getOrderStats.mockResolvedValue(stats([]));
    renderPage();
    for (const label of ['Last 24 hours', 'Last 7 days', 'Last 30 days', 'All time']) {
      expect(within(await kpi(label)).queryByText(/vs the 7 days before|Up from/)).not.toBeInTheDocument();
    }
  });

  it('the revenue heading has an info button that explains gross revenue on hover and focus', async () => {
    orderStatsService.getOrderStats.mockResolvedValue(stats([]));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Revenue (USD)' })).toBeInTheDocument();
    const info = screen.getByRole('button', { name: 'About gross revenue' });
    await userEvent.tab(); // nothing yet: tab order starts elsewhere
    info.focus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/Gross revenue/);
    expect(info).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
    // the written note stays visible for touch screens
    expect(screen.getByText(/Revenue is gross/)).toBeInTheDocument();
  });
});

describe('Analytics: sparkline captions and loading', () => {
  it('every sparkline says in words what its points are, so the 24h card cannot be read as hourly', async () => {
    orderStatsService.getOrderStats.mockResolvedValue(
      stats([{ day: dayBack(0), currency: 'USD', orders: 1, revenueMinor: 1000 }]),
    );
    renderPage();
    expect(
      await within(await kpi('Last 24 hours')).findByText('Last 7 days, one point per UTC day (not hourly)'),
    ).toBeInTheDocument();
    expect(within(await kpi('Last 7 days')).getByText('Last 7 days, one point per UTC day')).toBeInTheDocument();
    expect(within(await kpi('Last 30 days')).getByText('Last 30 days, one point per UTC day')).toBeInTheDocument();
  });

  it('explains that the chart total and the 30-day card count slightly different windows', async () => {
    orderStatsService.getOrderStats.mockResolvedValue(stats([]));
    renderPage();
    expect(await screen.findByText(/can differ a little from the Last 30 days card/)).toBeInTheDocument();
  });

  it('while loading, shows blocks shaped like the final cards and panels (not plain rows)', async () => {
    statsService.getCatalogStats.mockReturnValue(new Promise(() => {}));
    orderStatsService.getOrderStats.mockReturnValue(new Promise(() => {}));
    renderPage();
    for (const name of ['Loading analytics', 'Loading order numbers']) {
      const skeleton = screen.getByRole('status', { name });
      expect(skeleton.querySelectorAll('.animate-pulse').length).toBeGreaterThan(8);
      // a row of 4 card-shaped blocks, then 2 panels with a tall chart area
      expect(skeleton.children[0].children).toHaveLength(4); // the row of KPI cards
      expect(skeleton.children[1].children).toHaveLength(2); // the two chart panels
      expect(skeleton.querySelectorAll('.h-48')).toHaveLength(2);
    }
  });
});

describe('Analytics: revenue chart', () => {
  it('draws a line when fewer than 5 days had sales, and shows orders in the figures', async () => {
    orderStatsService.getOrderStats.mockResolvedValue(
      stats([
        { day: dayBack(3), currency: 'USD', orders: 2, revenueMinor: 3000 },
        { day: dayBack(0), currency: 'USD', orders: 1, revenueMinor: 1000 },
      ]),
    );
    renderPage();
    const chart = await screen.findByRole('img', { name: /\$40\.00 in revenue between/ });
    expect(chart.querySelector('polyline')).toBeInTheDocument();
    expect(chart.querySelectorAll('rect')).toHaveLength(0);
  });

  it('draws bars when 5 or more days had sales, with a title for every day', async () => {
    const daily = Array.from({ length: 6 }, (_, i) => ({
      day: dayBack(i),
      currency: 'USD',
      orders: 1,
      revenueMinor: 1000 + i * 100,
    }));
    orderStatsService.getOrderStats.mockResolvedValue(stats(daily));
    renderPage();
    const chart = await screen.findByRole('img', { name: /in revenue between Jan 1 and Jan 30/ });
    expect(chart.querySelectorAll('rect')).toHaveLength(30);
    expect(within(chart).getByText('Jan 30: $10.00')).toBeInTheDocument();
  });

  it('shows a friendly message, not a flat chart, when no sales fall in the last 30 days', async () => {
    orderStatsService.getOrderStats.mockResolvedValue(stats([]));
    renderPage();
    expect(await screen.findByText('No sales in the last 30 days.')).toBeInTheDocument();
  });
});

describe('Analytics: best sellers and order status', () => {
  it('best sellers link to the product and say how they are ranked', async () => {
    orderStatsService.getOrderStats.mockResolvedValue(
      stats([], [
        { productId: 'p1', title: 'Earbuds', currency: 'USD', units: 7, revenueMinor: 70000 },
        { productId: 'p2', title: 'Cable', currency: 'USD', units: 3, revenueMinor: 3000 },
      ]),
    );
    renderPage();
    expect(await screen.findByRole('link', { name: 'Earbuds' })).toHaveAttribute('href', '/admin/products/p1');
    expect(screen.getByRole('link', { name: 'Cable' })).toHaveAttribute('href', '/admin/products/p2');
    expect(screen.getByText('Ranked by units sold')).toBeInTheDocument();
  });

  it('with no sales, the best sellers explain when they will appear', async () => {
    orderStatsService.getOrderStats.mockResolvedValue(stats([]));
    renderPage();
    expect(
      await screen.findByText('No sales yet. Once orders start coming in, top products will appear here.'),
    ).toBeInTheDocument();
  });

  it('the status bar has a legend with counts, in the natural order, and a total', async () => {
    orderStatsService.getOrderStats.mockResolvedValue(stats([]));
    renderPage();
    expect(await screen.findByText(/^Total:/, { selector: 'p' })).toBeInTheDocument();
    const legend = screen.getByText(/Awaiting payment:/).closest('ul');
    expect(within(legend).getAllByRole('listitem').map((item) => item.textContent.split(':')[0])).toEqual([
      'Awaiting payment',
      'Paid',
      'Shipped',
      'Delivered',
      'Cancelled',
    ]);
    expect(legend.parentElement).toHaveTextContent('Total: 11 orders');
  });
});
