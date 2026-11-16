import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  listOrders: vi.fn(),
  getOrderDetail: vi.fn(),
  cancelMyOrder: vi.fn(),
}));
vi.mock('../services/orderService', () => service);
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));

import MyOrdersPage from './MyOrdersPage';
import OrderDetailPage from './OrderDetailPage';

const ID = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';

const listOrder = (overrides = {}) => ({
  id: ID,
  orderNumber: 'SY-001001',
  status: 'paid',
  currency: 'USD',
  totalMinor: 2480,
  createdAt: '2030-01-01T10:00:00.123456+00:00',
  expiresAt: '2030-01-01T10:31:00+00:00',
  cancelReason: null,
  items: [{ title: 'Desk lamp', imageUrl: null, quantity: 2 }],
  itemCount: 2,
  ...overrides,
});

const detail = (overrides = {}) => ({
  id: ID,
  orderNumber: 'SY-001001',
  status: 'paid',
  currency: 'USD',
  subtotalMinor: 2000,
  discountMinor: 200,
  deliveryFeeMinor: 480,
  totalMinor: 2280,
  couponCode: 'SAVE10',
  trackingNumber: null,
  createdAt: '2030-01-01T10:00:00+00:00',
  paidAt: '2030-01-01T10:05:00+00:00',
  shippedAt: null,
  deliveredAt: null,
  cancelledAt: null,
  expiresAt: '2030-01-01T10:31:00+00:00',
  cancelReason: null,
  shipping: {
    name: 'Sam Lee',
    address: '1 Test Street',
    city: 'City Central',
    state: 'Lagos State',
    phone: '+10000000000',
    courier: 'Shipbubble',
  },
  items: [
    {
      productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Desk lamp',
      imageUrl: null,
      size: 'M',
      color: 'Red',
      unitPriceMinor: 1000,
      quantity: 2,
      lineTotalMinor: 2000,
    },
  ],
  ...overrides,
});

function renderAt(route) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/orders" element={<MyOrdersPage />} />
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
          <Route path="/" element={<p>Home</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  service.listOrders.mockReset();
  service.getOrderDetail.mockReset();
  service.cancelMyOrder.mockReset();
});

describe('My orders', () => {
  it('shows the empty state with a way back to shopping', async () => {
    service.listOrders.mockResolvedValue({ orders: [], nextCursor: null });
    const { container } = renderAt('/orders');

    expect(await screen.findByRole('heading', { name: 'No orders yet' })).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/SY-\d+/);
    await userEvent.click(screen.getByRole('button', { name: 'Start shopping' }));
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('lists orders with a status badge, items, total and a link to the details', async () => {
    service.listOrders.mockResolvedValue({
      orders: [
        listOrder(),
        listOrder({ id: ID2, orderNumber: 'SY-001002', status: 'delivered', itemCount: 1 }),
      ],
      nextCursor: null,
    });
    renderAt('/orders');

    const cards = await screen.findAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('SY-001001')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Paid')).toBeInTheDocument();
    expect(within(cards[0]).getByText(/2 items/)).toBeInTheDocument();
    expect(within(cards[0]).getByText('$24.80')).toBeInTheDocument();
    expect(within(cards[0]).getByRole('link', { name: 'View details' })).toHaveAttribute(
      'href',
      `/orders/${ID}`,
    );
    expect(within(cards[1]).getByText('Delivered')).toBeInTheDocument();
    expect(within(cards[1]).getByText(/1 item\b/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('only an unpaid order says "Awaiting payment" and offers Cancel', async () => {
    service.listOrders.mockResolvedValue({
      orders: [
        listOrder({ status: 'pending_payment' }),
        listOrder({ id: ID2, orderNumber: 'SY-001002', status: 'paid' }),
      ],
      nextCursor: null,
    });
    renderAt('/orders');

    const [unpaid, paid] = await screen.findAllByRole('listitem');
    expect(within(unpaid).getByText('Awaiting payment')).toBeInTheDocument();
    expect(within(unpaid).getByText(/Not paid yet/)).toBeInTheDocument();
    expect(within(unpaid).getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
    expect(within(paid).queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });

  it('shows why a cancelled order was cancelled', async () => {
    service.listOrders.mockResolvedValue({
      orders: [listOrder({ status: 'cancelled', cancelReason: 'expired' })],
      nextCursor: null,
    });
    renderAt('/orders');
    expect(await screen.findByText('The payment was not completed in time.')).toBeInTheDocument();
  });

  it('loads the next page with the cursor, appends it, and hides the button at the end', async () => {
    const cursor = { createdAt: '2030-01-01T10:00:00.123456+00:00', id: ID };
    service.listOrders
      .mockResolvedValueOnce({ orders: [listOrder()], nextCursor: cursor })
      .mockResolvedValueOnce({
        orders: [listOrder({ id: ID2, orderNumber: 'SY-001002' })],
        nextCursor: null,
      });
    renderAt('/orders');

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('SY-001002')).toBeInTheDocument();
    expect(screen.getByText('SY-001001')).toBeInTheDocument(); // the first page is still there
    expect(service.listOrders).toHaveBeenNthCalledWith(1, null);
    expect(service.listOrders).toHaveBeenNthCalledWith(2, cursor);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('keeps the orders and says so when the next page fails', async () => {
    service.listOrders
      .mockResolvedValueOnce({
        orders: [listOrder()],
        nextCursor: { createdAt: '2030-01-01T10:00:00+00:00', id: ID },
      })
      .mockRejectedValueOnce(new Error('x'));
    renderAt('/orders');

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't load more orders");
    expect(screen.getByText('SY-001001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeEnabled(); // can try again
  });

  it('shows a friendly error with a retry when the list cannot load', async () => {
    service.listOrders.mockRejectedValueOnce(new Error('secret db detail'));
    const { container } = renderAt('/orders');

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load your orders.");
    expect(container).not.toHaveTextContent('secret db detail');

    service.listOrders.mockResolvedValue({ orders: [listOrder()], nextCursor: null });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('SY-001001')).toBeInTheDocument();
  });

  describe('cancelling', () => {
    const unpaid = () =>
      service.listOrders.mockResolvedValue({
        orders: [listOrder({ status: 'pending_payment' })],
        nextCursor: null,
      });

    it('asks first, and "Cancel" in the box keeps the order', async () => {
      unpaid();
      renderAt('/orders');
      await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));

      const dialog = screen.getByRole('alertdialog');
      expect(within(dialog).getByText('Cancel this order?')).toBeInTheDocument();
      expect(service.cancelMyOrder).not.toHaveBeenCalled();

      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(service.cancelMyOrder).not.toHaveBeenCalled();
    });

    it('confirming cancels the order and refreshes the list', async () => {
      unpaid();
      service.cancelMyOrder.mockResolvedValue(true);
      renderAt('/orders');
      await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));

      service.listOrders.mockResolvedValue({
        orders: [listOrder({ status: 'cancelled', cancelReason: 'customer' })],
        nextCursor: null,
      });
      await userEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel order' }),
      );

      expect(service.cancelMyOrder.mock.calls[0][0]).toBe(ID);
      expect(await screen.findByText('You cancelled this order.')).toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
    });

    it('explains when the order could not be cancelled (for example it was just paid)', async () => {
      unpaid();
      service.cancelMyOrder.mockResolvedValue(false);
      renderAt('/orders');
      await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
      await userEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel order' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent('can no longer be cancelled');
    });

    it('shows a friendly error when cancelling fails, and blocks a double click', async () => {
      unpaid();
      let fail;
      service.cancelMyOrder.mockReturnValue(new Promise((_, reject) => (fail = reject)));
      renderAt('/orders');
      await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
      const confirm = within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Cancel order',
      });
      await userEvent.click(confirm);

      const working = await screen.findByRole('button', { name: 'Working...' });
      expect(working).toBeDisabled();

      fail(new Error("We couldn't cancel the order."));
      expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't cancel the order.");
      expect(service.cancelMyOrder).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Order detail', () => {
  it('shows a paid order: paid time, timeline, items, totals, address, courier', async () => {
    service.getOrderDetail.mockResolvedValue(detail());
    renderAt(`/orders/${ID}`);

    expect(await screen.findByRole('heading', { name: 'Order SY-001001' })).toBeInTheDocument();
    expect(service.getOrderDetail).toHaveBeenCalledWith(ID);
    expect(screen.getByText('Paid', { selector: 'span.rounded-full' })).toBeInTheDocument();

    const timeline = screen.getByRole('list', { name: 'Order status' });
    const steps = within(timeline).getAllByRole('listitem');
    expect(steps.map((step) => step.textContent)).toEqual([
      expect.stringContaining('Order placed (done)'),
      expect.stringMatching(/Paid \(done\)Jan 1, 2030/),
      expect.stringContaining('Shipped (not yet)'),
      expect.stringContaining('Delivered (not yet)'),
    ]);

    expect(screen.getByText('Desk lamp')).toBeInTheDocument();
    expect(screen.getByText('Total paid')).toBeInTheDocument();
    expect(screen.getByText('$22.80')).toBeInTheDocument();
    expect(screen.getByText('1 Test Street')).toBeInTheDocument();
    expect(screen.getByText(/Courier:/).parentElement).toHaveTextContent('Shipbubble');
    expect(screen.getByText(/tracking number will appear here/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });

  it('shows the tracking number once there is one', async () => {
    service.getOrderDetail.mockResolvedValue(
      detail({
        status: 'shipped',
        trackingNumber: 'TRK123',
        shippedAt: '2030-01-02T09:00:00+00:00',
      }),
    );
    renderAt(`/orders/${ID}`);
    expect(await screen.findByText('TRK123')).toBeInTheDocument();
    expect(screen.queryByText(/will appear here/)).not.toBeInTheDocument();
  });

  it('an unpaid order says when it expires and offers Cancel', async () => {
    service.getOrderDetail.mockResolvedValue(
      detail({
        status: 'pending_payment',
        paidAt: null,
        expiresAt: '2999-06-01T10:31:00+00:00',
      }),
    );
    renderAt(`/orders/${ID}`);

    expect(await screen.findByText('This order has not been paid.')).toBeInTheDocument();
    expect(screen.getByText(/This order will expire on .*2999/)).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument(); // not "Total paid"
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
  });

  it('an unpaid order past its time says it is about to be cancelled', async () => {
    service.getOrderDetail.mockResolvedValue(
      detail({ status: 'pending_payment', paidAt: null, expiresAt: '2000-01-01T00:00:00+00:00' }),
    );
    renderAt(`/orders/${ID}`);
    expect(await screen.findByText(/payment time has run out/)).toBeInTheDocument();
    expect(screen.queryByText(/will expire on/)).not.toBeInTheDocument();
  });

  it('a cancelled order shows when and why', async () => {
    service.getOrderDetail.mockResolvedValue(
      detail({
        status: 'cancelled',
        paidAt: null,
        cancelledAt: '2030-01-01T10:20:00+00:00',
        cancelReason: 'customer',
      }),
    );
    renderAt(`/orders/${ID}`);

    expect(await screen.findByText(/Cancelled on .*2030/)).toBeInTheDocument();
    expect(screen.getByText('You cancelled this order.')).toBeInTheDocument();
    const steps = within(screen.getByRole('list', { name: 'Order status' })).getAllByRole(
      'listitem',
    );
    expect(steps).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });

  it('cancelling from the detail page refreshes it', async () => {
    service.getOrderDetail.mockResolvedValue(
      detail({ status: 'pending_payment', paidAt: null, expiresAt: '2999-06-01T10:31:00+00:00' }),
    );
    service.cancelMyOrder.mockResolvedValue(true);
    renderAt(`/orders/${ID}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));

    service.getOrderDetail.mockResolvedValue(
      detail({
        status: 'cancelled',
        paidAt: null,
        cancelledAt: '2030-01-01T10:20:00+00:00',
        cancelReason: 'customer',
      }),
    );
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel order' }),
    );

    expect(await screen.findByText(/Cancelled on/)).toBeInTheDocument();
  });

  it('says "not found" for a missing order, and for an id that is not a uuid', async () => {
    service.getOrderDetail.mockResolvedValue(null);
    const first = renderAt(`/orders/${ID}`);
    expect(
      await screen.findByRole('heading', { name: "We couldn't find that order" }),
    ).toBeInTheDocument();
    first.unmount();

    renderAt('/orders/not-a-uuid');
    expect(
      await screen.findByRole('heading', { name: "We couldn't find that order" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(service.getOrderDetail).toHaveBeenCalledTimes(1)); // only the first
  });

  it('shows a friendly error with a retry when the order cannot load', async () => {
    service.getOrderDetail.mockRejectedValueOnce(new Error('secret'));
    const { container } = renderAt(`/orders/${ID}`);
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load this order.");
    expect(container).not.toHaveTextContent('secret');

    service.getOrderDetail.mockResolvedValue(detail());
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Order SY-001001' })).toBeInTheDocument();
  });

  it('links back to My orders', async () => {
    service.getOrderDetail.mockResolvedValue(detail());
    renderAt(`/orders/${ID}`);
    expect(await screen.findByRole('link', { name: /My orders/ })).toHaveAttribute(
      'href',
      '/orders',
    );
  });
});
