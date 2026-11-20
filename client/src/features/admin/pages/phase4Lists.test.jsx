import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const orders = vi.hoisted(() => ({ listAdminOrders: vi.fn(), getOrderStats: vi.fn() }));
vi.mock('../services/orderAdminService', () => orders);
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));

import CopyCodeButton from '../components/CopyCodeButton';
import CouponStats from '../components/coupons/CouponStats';
import StockMeter from '../components/StockMeter';
import UsageMeter from '../components/UsageMeter';
import AdminOrdersPage from './AdminOrdersPage';

const wrap = (ui) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
};

const order = {
  id: '00000000-0000-4000-8000-000000000001',
  orderNumber: 'SY-1',
  status: 'paid',
  currency: 'USD',
  totalMinor: 2500,
  customerName: 'asha khan',
  customerEmail: 'asha@example.com',
  paymentIssue: null,
  trackingNumber: null,
  createdAt: '2030-01-01T10:00:00Z',
};

describe('Orders list: filter chip counts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    orders.listAdminOrders.mockResolvedValue({ orders: [order], nextCursor: null });
  });

  it('shows the cached To ship and Needs refund numbers, and keeps the chips\' names', async () => {
    orders.getOrderStats.mockResolvedValue({
      today: '2030-01-30',
      byStatus: {},
      toShip: 4,
      needsRefund: 1,
      revenue: [],
      daily: [],
      topProducts: [],
    });
    wrap(<AdminOrdersPage />);
    const toShip = await screen.findByRole('button', { name: 'To ship' });
    await waitFor(() => expect(toShip).toHaveAccessibleDescription('4 orders'));
    expect(screen.getByRole('button', { name: 'Needs refund' })).toHaveAccessibleDescription('1 order');
    expect(toShip).toHaveTextContent('To ship4');
  });

  it('shows no number at all when the numbers are not available (never made up)', async () => {
    orders.getOrderStats.mockRejectedValue(new Error('offline'));
    wrap(<AdminOrdersPage />);
    const toShip = await screen.findByRole('button', { name: 'To ship' });
    await screen.findByText('SY-1');
    expect(toShip).toHaveTextContent(/^To ship$/);
    expect(toShip).not.toHaveAttribute('aria-describedby');
  });

  it('a row shows the customer initial, a relative date and the full date as a tooltip', async () => {
    orders.getOrderStats.mockRejectedValue(new Error('offline'));
    wrap(<AdminOrdersPage />);
    const time = (await screen.findByText('SY-1')).closest('a').querySelector('time');
    expect(time).toHaveAttribute('title', expect.stringMatching(/2030/));
    expect(time).toHaveAttribute('datetime', order.createdAt);
    expect(screen.getByText('A')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('StockMeter', () => {
  it('is empty and red when out of stock, amber when low, green otherwise', () => {
    const fill = (stock) => {
      const { container, unmount } = render(<StockMeter stock={stock} />);
      const bar = container.firstChild;
      const result = { state: bar.dataset.stock, width: bar.firstChild.style.width, cls: bar.firstChild.className };
      unmount();
      return result;
    };
    expect(fill(0)).toMatchObject({ state: 'out', width: '0%' });
    expect(fill(0).cls).toContain('bg-red-600');
    expect(fill(3)).toMatchObject({ state: 'low' });
    expect(fill(3).cls).toContain('bg-amber-500');
    expect(fill(10)).toMatchObject({ state: 'ok', width: '50%' });
    expect(fill(10).cls).toContain('bg-green-600');
    expect(fill(500).width).toBe('100%');
  });

  it('is decoration only (hidden from screen readers)', () => {
    const { container } = render(<StockMeter stock={4} />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('UsageMeter', () => {
  it('writes "used / limit" and fills the bar by the share used', () => {
    const { container } = render(<UsageMeter used={3} limit={12} />);
    expect(screen.getByText('3 / 12')).toBeInTheDocument();
    expect(container.querySelector('[style*="width"]').style.width).toBe('25%');
  });

  it('says "unlimited" and draws no bar when there is no limit', () => {
    const { container } = render(<UsageMeter used={5} limit={null} />);
    expect(screen.getByText('5 / unlimited')).toBeInTheDocument();
    expect(container.querySelector('[style*="width"]')).toBeNull();
  });

  it('turns red when the limit is reached', () => {
    const { container } = render(<UsageMeter used={10} limit={10} />);
    expect(container.querySelector('[style*="width"]').className).toContain('bg-red-600');
  });
});

describe('CouponStats', () => {
  const now = new Date('2030-06-01T00:00:00Z');
  const base = { usageLimit: null, usedCount: 0, startsAt: null, expiresAt: null, isActive: true };
  it('counts live, scheduled, paused and expired/used-up coupons from the list it is given', () => {
    const list = [
      { ...base, id: 1 },
      { ...base, id: 2 },
      { ...base, id: 3, startsAt: '2031-01-01T00:00:00Z' },
      { ...base, id: 4, isActive: false },
      { ...base, id: 5, expiresAt: '2029-01-01T00:00:00Z' },
      { ...base, id: 6, usageLimit: 1, usedCount: 1 },
    ];
    render(<CouponStats coupons={list} now={now} />);
    const value = (label) => screen.getByText(label).nextSibling.textContent;
    expect(value('Live now')).toBe('2');
    expect(value('Starting later')).toBe('1');
    expect(value('Paused coupons')).toBe('1');
    expect(value('Expired or used up')).toBe('2');
  });
});

describe('CopyCodeButton', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else delete navigator.clipboard;
  });

  it('copies the code and says "Copied"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<CopyCodeButton code="FRESH10" />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy FRESH10' }));
    expect(writeText).toHaveBeenCalledWith('FRESH10');
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('says "Copy failed" when the browser refuses', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<CopyCodeButton code="FRESH10" />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy FRESH10' }));
    expect(await screen.findByText('Copy failed')).toBeInTheDocument();
  });

  it('says "Copy failed" when there is no clipboard at all', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    render(<CopyCodeButton code="FRESH10" />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy FRESH10' }));
    expect(await screen.findByText('Copy failed')).toBeInTheDocument();
  });

  it('forgets the message after a moment', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<CopyCodeButton code="FRESH10" />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy FRESH10' }));
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(screen.queryByText('Copied')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

