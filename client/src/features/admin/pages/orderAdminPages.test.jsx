import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  listAdminOrders: vi.fn(),
  getAdminOrder: vi.fn(),
  updateAdminOrder: vi.fn(),
  getOrderStats: vi.fn(),
}));
vi.mock('../services/orderAdminService', () => service);
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));

import AdminOrderDetailPage from './AdminOrderDetailPage';
import AdminOrdersPage from './AdminOrdersPage';

const ID = '11111111-1111-4111-8111-111111111111';
const AT = '2030-01-01T10:00:00Z';

function renderPage(ui, path = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/orders" element={ui} />
          <Route path="/admin/orders/:id" element={ui} />
          <Route path="/" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const summary = (n, overrides = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  orderNumber: `SY-${n}`,
  status: 'paid',
  currency: 'USD',
  totalMinor: 2500,
  customerName: `Customer ${n}`,
  customerEmail: `c${n}@example.com`,
  paymentIssue: null,
  trackingNumber: null,
  createdAt: AT,
  ...overrides,
});

beforeEach(() => vi.resetAllMocks());

describe('AdminOrdersPage', () => {
  it('lists orders with number, customer, total, status and date', async () => {
    service.listAdminOrders.mockResolvedValue({
      orders: [summary(1), summary(2, { status: 'shipped', totalMinor: 999 })],
      nextCursor: null,
    });
    renderPage(<AdminOrdersPage />);

    const list = await screen.findByRole('list');
    expect(within(list).getByText('SY-1')).toBeInTheDocument();
    expect(within(list).getByText(/Customer 1 · c1@example.com/)).toBeInTheDocument();
    expect(within(list).getByText('$25.00')).toBeInTheDocument();
    expect(within(list).getByText('$9.99')).toBeInTheDocument();
    expect(within(list).getByText('Paid')).toBeInTheDocument();
    expect(within(list).getByText('Shipped')).toBeInTheDocument();
    expect(screen.getByText('End of the list')).toBeInTheDocument();
    expect(within(list).getAllByRole('link')[0]).toHaveAttribute(
      'href',
      `/admin/orders/${summary(1).id}`,
    );
  });

  it('shows the "Needs refund" badge only on orders with a payment problem', async () => {
    service.listAdminOrders.mockResolvedValue({
      orders: [summary(1), summary(2, { status: 'cancelled', paymentIssue: 'paid_after_cancel' })],
      nextCursor: null,
    });
    renderPage(<AdminOrdersPage />);

    const list = await screen.findByRole('list');
    const rows = within(list).getAllByRole('listitem');
    expect(within(rows[0]).queryByText('Needs refund')).not.toBeInTheDocument();
    const badge = within(rows[1]).getByText('Needs refund');
    expect(badge.closest('span')).toHaveAttribute(
      'title',
      'Payment issue detected. Admin action required.',
    );
  });

  it('loads the next page from the cursor, and stops at the end', async () => {
    const user = userEvent.setup();
    const cursor = { createdAt: AT, id: summary(1).id };
    service.listAdminOrders
      .mockResolvedValueOnce({ orders: [summary(1)], nextCursor: cursor })
      .mockResolvedValueOnce({ orders: [summary(2)], nextCursor: null });
    renderPage(<AdminOrdersPage />);

    await screen.findByText('SY-1');
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('SY-2')).toBeInTheDocument();
    expect(screen.getByText('SY-1')).toBeInTheDocument();
    expect(service.listAdminOrders).toHaveBeenLastCalledWith(expect.objectContaining({ cursor }));
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(screen.getByText('End of the list')).toBeInTheDocument();
  });

  it('the "To ship" chip, status filter, needs-refund chip and search narrow the list', async () => {
    const user = userEvent.setup();
    service.listAdminOrders.mockResolvedValue({ orders: [summary(1)], nextCursor: null });
    renderPage(<AdminOrdersPage />);
    await screen.findByText('SY-1');
    expect(service.listAdminOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: '', needsRefund: false, search: '' }),
    );

    await user.click(screen.getByRole('button', { name: 'To ship' }));
    expect(screen.getByRole('button', { name: 'To ship' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toHaveValue('paid');
    await screen.findByText('SY-1');
    expect(service.listAdminOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'paid' }),
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'shipped');
    expect(screen.getByRole('button', { name: 'To ship' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.click(screen.getByRole('button', { name: 'Needs refund' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search orders' }), '  SY-77 {Enter}');
    await screen.findByText('SY-1');
    expect(service.listAdminOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'shipped', needsRefund: true, search: 'SY-77' }),
    );

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await screen.findByText('SY-1');
    expect(service.listAdminOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: '', needsRefund: false, search: '' }),
    );
  });

  it('says so when nothing matches', async () => {
    const user = userEvent.setup();
    service.listAdminOrders.mockResolvedValue({ orders: [], nextCursor: null });
    renderPage(<AdminOrdersPage />);
    expect(await screen.findByText('No orders yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Needs refund' }));
    expect(await screen.findByText('No orders match these filters.')).toBeInTheDocument();
  });

  it('shows an error with retry when the list fails', async () => {
    const user = userEvent.setup();
    service.listAdminOrders.mockRejectedValueOnce(new Error('x'));
    renderPage(<AdminOrdersPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load the orders/i);

    service.listAdminOrders.mockResolvedValue({ orders: [summary(1)], nextCursor: null });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('SY-1')).toBeInTheDocument();
  });
});

const detail = (overrides = {}) => ({
  id: ID,
  orderNumber: 'SY-0042',
  status: 'paid',
  cancelReason: null,
  paymentIssue: null,
  currency: 'USD',
  subtotalMinor: 4000,
  discountMinor: 500,
  deliveryFeeMinor: 600,
  totalMinor: 4100,
  couponCode: 'SAVE5',
  accountEmail: 'account@example.com',
  shipping: {
    name: 'Sam Lee',
    email: 'sam@example.com',
    phone: '+1 555 0100',
    address: '1 Test Street',
    state: 'Some State',
    city: 'Some City',
    courier: 'DHL',
    notes: 'Leave at the door',
  },
  trackingNumber: null,
  stripeSessionId: 'cs_test_1',
  stripePaymentIntentId: 'pi_test_1',
  createdAt: '2030-01-01T10:00:00Z',
  paidAt: '2030-01-01T10:05:00Z',
  shippedAt: null,
  deliveredAt: null,
  cancelledAt: null,
  expiresAt: null,
  items: [
    {
      productId: 'p1',
      title: 'Wireless Earbuds',
      imageUrl: null,
      size: 'M',
      color: 'Black',
      unitPriceMinor: 2000,
      quantity: 2,
      lineTotalMinor: 4000,
    },
  ],
  ...overrides,
});

const open = (order) => {
  service.getAdminOrder.mockResolvedValue(order);
  return renderPage(<AdminOrderDetailPage />, `/admin/orders/${ID}`);
};

describe('AdminOrderDetailPage: what is shown', () => {
  it('shows customer, delivery, items, totals and the Stripe payment id', async () => {
    open(detail());

    expect(await screen.findByRole('heading', { name: 'Order SY-0042' })).toBeInTheDocument();
    expect(screen.getByText('Sam Lee')).toBeInTheDocument();
    expect(screen.getByText('account@example.com')).toBeInTheDocument();
    expect(screen.getByText('+1 555 0100')).toBeInTheDocument();
    expect(screen.getByText('1 Test Street, Some City, Some State')).toBeInTheDocument();
    expect(screen.getByText('Leave at the door')).toBeInTheDocument();
    expect(screen.getByText('Wireless Earbuds')).toBeInTheDocument();
    expect(screen.getByText(/2 × \$20\.00/)).toBeInTheDocument();
    expect(screen.getByText('Discount (SAVE5)')).toBeInTheDocument();
    expect(screen.getByText('$41.00')).toBeInTheDocument();
    expect(screen.getByText('Stripe Payment Intent (for refunds)')).toBeInTheDocument();
    expect(screen.getByText('pi_test_1')).toBeInTheDocument();
  });

  it('shows no refund warning on a normal order', async () => {
    open(detail());
    await screen.findByRole('heading', { name: 'Order SY-0042' });
    expect(screen.queryByText('Needs refund')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns in red when the customer paid after cancellation', async () => {
    open(
      detail({
        status: 'cancelled',
        paymentIssue: 'paid_after_cancel',
        cancelReason: 'customer',
        cancelledAt: '2030-01-01T10:02:00Z',
      }),
    );

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(
      'Customer paid after cancellation. Refund manually in Stripe Dashboard.',
    );
    expect(banner).toHaveAttribute('title', 'Payment issue detected. Admin action required.');
    expect(screen.getAllByText('Needs refund').length).toBeGreaterThan(0);
  });

  it('warns about an amount mismatch too', async () => {
    open(detail({ paymentIssue: 'amount_mismatch', status: 'pending_payment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/amount paid did not match/i);
  });

  it('shows when and why a cancelled order was cancelled, with no action buttons', async () => {
    open(
      detail({
        status: 'cancelled',
        cancelReason: 'expired',
        cancelledAt: '2030-01-01T10:45:00Z',
        stripePaymentIntentId: null,
      }),
    );

    expect(
      await screen.findByText(/Cancelled on .*2030.* \(reason: payment time ran out\)/),
    ).toBeInTheDocument();
    expect(screen.getByText(/It cannot be changed/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark as/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tracking number')).not.toBeInTheDocument();
    expect(screen.getByText(/Not available \(not paid yet\)/)).toBeInTheDocument();
  });

  it('an unpaid order: waiting, no buttons, no tracking field', async () => {
    open(detail({ status: 'pending_payment', paidAt: null, stripePaymentIntentId: null }));
    expect(await screen.findByText(/Waiting for the customer to pay/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark as/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tracking number')).not.toBeInTheDocument();
  });

  it('a delivered order: no status buttons, tracking can still be edited', async () => {
    open(
      detail({
        status: 'delivered',
        shippedAt: '2030-01-02T10:00:00Z',
        deliveredAt: '2030-01-03T10:00:00Z',
        trackingNumber: 'TRK-9',
      }),
    );
    expect(await screen.findByText(/No further steps/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark as/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tracking number')).toHaveValue('TRK-9');
  });

  it('the timeline marks how far the order got', async () => {
    open(detail({ status: 'shipped', shippedAt: '2030-01-02T10:00:00Z' }));
    const timeline = await screen.findByRole('list', { name: 'Order status' });
    expect(within(timeline).getByText('Shipped')).toBeInTheDocument();
    expect(within(timeline).getByText(/Paid/)).toHaveTextContent('(done)');
    expect(within(timeline).getByText(/Delivered/)).toHaveTextContent('(not yet)');
  });

  it('says so when the order does not exist, or the link is malformed', async () => {
    service.getAdminOrder.mockResolvedValue(null);
    const first = renderPage(<AdminOrderDetailPage />, `/admin/orders/${ID}`);
    expect(await screen.findByText(/couldn.t find that order/i)).toBeInTheDocument();
    first.unmount();

    renderPage(<AdminOrderDetailPage />, '/admin/orders/not-a-uuid');
    expect(await screen.findByText(/couldn.t find that order/i)).toBeInTheDocument();
    expect(service.getAdminOrder).toHaveBeenCalledTimes(1);
  });

  it('shows an error with retry when the order cannot be loaded', async () => {
    const user = userEvent.setup();
    service.getAdminOrder.mockRejectedValueOnce(new Error('x'));
    renderPage(<AdminOrderDetailPage />, `/admin/orders/${ID}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load this order/i);

    service.getAdminOrder.mockResolvedValue(detail());
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Order SY-0042' })).toBeInTheDocument();
  });
});

describe('AdminOrderDetailPage: the next step', () => {
  it('offers only "Mark as shipped" on a paid order', async () => {
    open(detail());
    expect(await screen.findByRole('button', { name: 'Mark as shipped' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as delivered' })).not.toBeInTheDocument();
  });

  it('offers only "Mark as delivered" on a shipped order', async () => {
    open(detail({ status: 'shipped', shippedAt: AT }));
    expect(await screen.findByRole('button', { name: 'Mark as delivered' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as shipped' })).not.toBeInTheDocument();
  });

  it('ships with optional tracking, shows the success message and reloads the order', async () => {
    const user = userEvent.setup();
    open(detail());
    service.updateAdminOrder.mockResolvedValue({
      id: ID,
      status: 'shipped',
      trackingNumber: 'TRK-1',
      shippedAt: AT,
      deliveredAt: null,
      changed: true,
    });
    await user.click(await screen.findByRole('button', { name: 'Mark as shipped' }));

    const dialog = screen.getByRole('alertdialog');
    await user.type(within(dialog).getByLabelText(/Tracking number \(optional\)/), '  TRK-1 ');
    service.getAdminOrder.mockResolvedValue(
      detail({ status: 'shipped', shippedAt: AT, trackingNumber: 'TRK-1' }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Mark as shipped' }));

    expect(await screen.findByText('Order SY-0042 marked as shipped.')).toBeInTheDocument();
    expect(service.updateAdminOrder).toHaveBeenCalledWith(ID, {
      status: 'shipped',
      tracking: 'TRK-1',
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // the page reloaded: the next step is now "delivered" and the tracking number shows
    expect(await screen.findByRole('button', { name: 'Mark as delivered' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tracking number')).toHaveValue('TRK-1');
  });

  it('ships without tracking (tracking is optional)', async () => {
    const user = userEvent.setup();
    open(detail());
    service.updateAdminOrder.mockResolvedValue({
      id: ID,
      status: 'shipped',
      trackingNumber: null,
      shippedAt: AT,
      deliveredAt: null,
      changed: true,
    });
    await user.click(await screen.findByRole('button', { name: 'Mark as shipped' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Mark as shipped' }),
    );
    expect(await screen.findByText('Order SY-0042 marked as shipped.')).toBeInTheDocument();
    expect(service.updateAdminOrder).toHaveBeenCalledWith(ID, {
      status: 'shipped',
      tracking: null,
    });
  });

  it('cancelling the dialog changes nothing', async () => {
    const user = userEvent.setup();
    open(detail());
    await user.click(await screen.findByRole('button', { name: 'Mark as shipped' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(service.updateAdminOrder).not.toHaveBeenCalled();
  });

  it('delivers, and shows the success message', async () => {
    const user = userEvent.setup();
    open(detail({ status: 'shipped', shippedAt: AT }));
    service.updateAdminOrder.mockResolvedValue({
      id: ID,
      status: 'delivered',
      trackingNumber: null,
      shippedAt: AT,
      deliveredAt: AT,
      changed: true,
    });
    await user.click(await screen.findByRole('button', { name: 'Mark as delivered' }));
    service.getAdminOrder.mockResolvedValue(
      detail({ status: 'delivered', shippedAt: AT, deliveredAt: AT }),
    );
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Mark as delivered' }),
    );

    expect(await screen.findByText('Order SY-0042 marked as delivered.')).toBeInTheDocument();
    expect(service.updateAdminOrder).toHaveBeenCalledWith(ID, {
      status: 'delivered',
      tracking: null,
    });
    expect(await screen.findByText(/No further steps/)).toBeInTheDocument();
  });

  it('a double click that changed nothing says so instead of claiming success', async () => {
    const user = userEvent.setup();
    open(detail());
    service.updateAdminOrder.mockResolvedValue({
      id: ID,
      status: 'shipped',
      trackingNumber: null,
      shippedAt: AT,
      deliveredAt: null,
      changed: false,
    });
    await user.click(await screen.findByRole('button', { name: 'Mark as shipped' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Mark as shipped' }),
    );
    expect(
      await screen.findByText(/Nothing changed: order SY-0042 is already shipped/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/marked as shipped/)).not.toBeInTheDocument();
  });
});

describe('AdminOrderDetailPage: errors', () => {
  it.each([
    [
      'invalid_transition',
      'This order cannot be moved that way (it is currently "Shipped"). Reload the page to see its latest state.',
    ],
    [
      'invalid_tracking',
      'That tracking number is not valid. Use at most 100 characters, without control characters.',
    ],
    ['order_not_found', 'This order no longer exists. Reload the page.'],
  ])(
    'shows the %s error inside the dialog, keeps it open, and lets the admin retry',
    async (_code, message) => {
      const user = userEvent.setup();
      open(detail());
      service.updateAdminOrder.mockRejectedValueOnce(new Error(message));
      await user.click(await screen.findByRole('button', { name: 'Mark as shipped' }));
      const dialog = screen.getByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Mark as shipped' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      // the order is unchanged and the button works again
      const retry = within(dialog).getByRole('button', { name: 'Mark as shipped' });
      expect(retry).toBeEnabled();

      service.updateAdminOrder.mockResolvedValue({
        id: ID,
        status: 'shipped',
        trackingNumber: null,
        shippedAt: AT,
        deliveredAt: null,
        changed: true,
      });
      await user.click(retry);
      expect(await screen.findByText('Order SY-0042 marked as shipped.')).toBeInTheDocument();
      expect(service.updateAdminOrder).toHaveBeenCalledTimes(2);
    },
  );

  it('refuses a bad tracking number in the ship dialog without calling the server', async () => {
    const user = userEvent.setup();
    open(detail());
    await user.click(await screen.findByRole('button', { name: 'Mark as shipped' }));
    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByLabelText(/Tracking number \(optional\)/));
    await user.paste('x'.repeat(101));
    await user.click(within(dialog).getByRole('button', { name: 'Mark as shipped' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/at most 100 characters/);
    expect(service.updateAdminOrder).not.toHaveBeenCalled();
  });
});

describe('AdminOrderDetailPage: tracking number', () => {
  it('Save stays off until the value changes, then saves it', async () => {
    const user = userEvent.setup();
    open(detail());
    service.updateAdminOrder.mockResolvedValue({
      id: ID,
      status: 'paid',
      trackingNumber: 'TRK-7',
      shippedAt: null,
      deliveredAt: null,
      changed: true,
    });
    const input = await screen.findByLabelText('Tracking number');
    const save = screen.getByRole('button', { name: 'Save tracking' });
    expect(save).toBeDisabled();

    service.getAdminOrder.mockResolvedValue(detail({ trackingNumber: 'TRK-7' }));
    await user.type(input, ' TRK-7 ');
    expect(save).toBeEnabled();
    await user.click(save);

    expect(await screen.findByText('Tracking number saved for order SY-0042.')).toBeInTheDocument();
    expect(service.updateAdminOrder).toHaveBeenCalledWith(ID, { status: null, tracking: 'TRK-7' });
  });

  it('clearing the field and saving removes the tracking number', async () => {
    const user = userEvent.setup();
    open(detail({ trackingNumber: 'TRK-1' }));
    service.updateAdminOrder.mockResolvedValue({
      id: ID,
      status: 'paid',
      trackingNumber: null,
      shippedAt: null,
      deliveredAt: null,
      changed: true,
    });
    const input = await screen.findByLabelText('Tracking number');
    await user.clear(input);
    service.getAdminOrder.mockResolvedValue(detail());
    await user.click(screen.getByRole('button', { name: 'Save tracking' }));

    expect(
      await screen.findByText('Tracking number removed from order SY-0042.'),
    ).toBeInTheDocument();
    expect(service.updateAdminOrder).toHaveBeenCalledWith(ID, { status: null, tracking: '' });
  });

  it('refuses more than 100 characters and control characters while typing', async () => {
    const user = userEvent.setup();
    open(detail());
    const input = await screen.findByLabelText('Tracking number');
    const save = screen.getByRole('button', { name: 'Save tracking' });

    await user.click(input);
    await user.paste('x'.repeat(101));
    expect(await screen.findByText(/at most 100 characters/)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(save).toBeDisabled();

    await user.clear(input);
    await user.click(input);
    await user.paste(`ab${String.fromCharCode(7)}cd`);
    expect(await screen.findByText(/control characters/)).toBeInTheDocument();
    expect(save).toBeDisabled();

    await user.clear(input);
    await user.click(input);
    await user.paste('x'.repeat(100));
    expect(screen.queryByText(/at most 100 characters/)).not.toBeInTheDocument();
    expect(save).toBeEnabled();
    expect(service.updateAdminOrder).not.toHaveBeenCalled();
  });

  it('shows a server refusal under the field and lets the admin retry', async () => {
    const user = userEvent.setup();
    open(detail());
    service.updateAdminOrder.mockRejectedValueOnce(
      new Error('This order no longer exists. Reload the page.'),
    );
    await user.type(await screen.findByLabelText('Tracking number'), 'T1');
    await user.click(screen.getByRole('button', { name: 'Save tracking' }));

    expect(
      await screen.findByText('This order no longer exists. Reload the page.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save tracking' })).toBeEnabled();
  });
});

describe('AdminOrderDetailPage: copying the Stripe id', () => {
  it('copies it and says "Copied!"', async () => {
    const user = userEvent.setup();
    open(detail());
    // userEvent.setup() installs a working clipboard
    await user.click(
      await screen.findByRole('button', { name: /copy the stripe payment intent/i }),
    );

    expect(await screen.findByText('Copied!')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe('pi_test_1');
  });

  it('says so when the browser refuses', async () => {
    const user = userEvent.setup();
    open(detail());
    const button = await screen.findByRole('button', { name: /copy the stripe payment intent/i });
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    await user.click(button);
    expect(await screen.findByText(/Could not copy/)).toBeInTheDocument();
  });
});
