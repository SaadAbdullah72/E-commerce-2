import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cart = vi.hoisted(() => ({ removePurchasedLines: vi.fn() }));
const service = vi.hoisted(() => ({ getOrder: vi.fn(), cancelOrder: vi.fn() }));
vi.mock('@/context/CartContext', () => ({ useCart: () => cart }));
vi.mock('../services/checkoutService', async (importOriginal) => ({
  ...(await importOriginal()),
  getOrder: service.getOrder,
  cancelOrder: service.cancelOrder,
}));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));

import { loadShipping, saveShipping } from '../lib/shippingStorage';
import OrderCancelledPage from './OrderCancelledPage';
import OrderSuccessPage from './OrderSuccessPage';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const LAMP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const order = (overrides = {}) => ({
  id: ORDER_ID,
  orderNumber: 'SY-001001',
  status: 'paid',
  currency: 'USD',
  subtotalMinor: 2000,
  discountMinor: 200,
  deliveryFeeMinor: 480,
  totalMinor: 2280,
  couponCode: 'SAVE10',
  shipping: {
    name: 'Sam Lee',
    address: '1 Test Street',
    city: 'City Central',
    state: 'Lagos State',
    phone: '+10000000000',
  },
  items: [
    {
      productId: LAMP,
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

let queryClient;
function renderAt(ui, path) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
const success = (query = `?order=${ORDER_ID}`) =>
  renderAt(<OrderSuccessPage />, `/order/success${query}`);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  sessionStorage.clear();
  cart.removePurchasedLines = vi.fn();
});
afterEach(() => vi.useRealTimers());

describe('Order success page', () => {
  it('shows the paid order and then empties exactly the purchased lines from the cart', async () => {
    saveShipping(
      {
        fullName: 'Sam',
        email: 'a@b.co',
        phone: '12345',
        address: '1 Test St',
        state: 'S',
        city: 'C',
      },
      'u1',
    );
    service.getOrder.mockResolvedValue(order());
    success();

    expect(await screen.findByRole('heading', { name: 'Payment received' })).toBeInTheDocument();
    expect(screen.getByText('SY-001001')).toBeInTheDocument();
    expect(screen.getByText('Desk lamp')).toBeInTheDocument();
    expect(screen.getByText('Red / M · Qty 2')).toBeInTheDocument();
    expect(screen.getByText('-$2.00')).toBeInTheDocument();
    expect(screen.getByText('$22.80')).toBeInTheDocument();
    expect(screen.getByText('1 Test Street')).toBeInTheDocument();

    expect(cart.removePurchasedLines).toHaveBeenCalledTimes(1);
    expect(cart.removePurchasedLines).toHaveBeenCalledWith(order().items);
    expect(loadShipping('u1')).toBeNull(); // saved address is gone too
  });

  it('waits for the payment confirmation, keeps the cart, and updates when it arrives', async () => {
    service.getOrder
      .mockResolvedValueOnce(order({ status: 'pending_payment' }))
      .mockResolvedValue(order());
    success();

    expect(await screen.findByText('Confirming your payment…')).toBeInTheDocument();
    expect(cart.removePurchasedLines).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(await screen.findByRole('heading', { name: 'Payment received' })).toBeInTheDocument();
    expect(cart.removePurchasedLines).toHaveBeenCalledTimes(1);
  });

  it('stops waiting after about 30 seconds and says so, without emptying the cart', async () => {
    service.getOrder.mockResolvedValue(order({ status: 'pending_payment' }));
    success();
    expect(await screen.findByText('Confirming your payment…')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(
      await screen.findByRole('heading', { name: 'Your payment is still being confirmed' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/You don't need to pay again/)).toBeInTheDocument();
    expect(cart.removePurchasedLines).not.toHaveBeenCalled();
    const callsAtGiveUp = service.getOrder.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(service.getOrder.mock.calls.length).toBe(callsAtGiveUp); // no more polling
  });

  it('says a cancelled order was not charged and leaves the cart alone', async () => {
    service.getOrder.mockResolvedValue(order({ status: 'cancelled' }));
    success();
    expect(
      await screen.findByRole('heading', { name: 'This order was cancelled' }),
    ).toBeInTheDocument();
    expect(cart.removePurchasedLines).not.toHaveBeenCalled();
  });

  it.each([
    ['an order that does not exist', `?order=${ORDER_ID}`, null],
    ['no order in the address', '', undefined],
    ['a malformed order id', '?order=not-a-uuid', undefined],
  ])('says it cannot find %s', async (_name, query, found) => {
    service.getOrder.mockResolvedValue(found ?? null);
    success(query);
    expect(
      await screen.findByRole('heading', { name: "We couldn't find that order" }),
    ).toBeInTheDocument();
    expect(cart.removePurchasedLines).not.toHaveBeenCalled();
    if (!query.includes(ORDER_ID)) expect(service.getOrder).not.toHaveBeenCalled();
  });

  it('offers a retry and reassurance when the order cannot be loaded', async () => {
    service.getOrder.mockRejectedValue(new Error('boom'));
    success();
    expect(
      await screen.findByRole('heading', { name: "We couldn't load your order" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/If you were charged, your order is safe/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('Order cancelled page', () => {
  const cancelled = (query = `?order=${ORDER_ID}`) =>
    renderAt(<OrderCancelledPage />, `/order/cancelled${query}`);

  it('cancels the unpaid order once and reassures the customer', async () => {
    service.cancelOrder.mockResolvedValue(true);
    cancelled();

    expect(screen.getByRole('heading', { name: 'Payment cancelled' })).toBeInTheDocument();
    expect(
      screen.getByText(/not charged, and your items are still in your cart/),
    ).toBeInTheDocument();
    await vi.waitFor(() => expect(service.cancelOrder).toHaveBeenCalledTimes(1));
    expect(service.cancelOrder.mock.calls[0][0]).toBe(ORDER_ID);
    expect(screen.getByRole('link', { name: 'Back to checkout' })).toHaveAttribute(
      'href',
      '/checkout',
    );
  });

  it('does not call the database for a missing or malformed order id', () => {
    cancelled('');
    cancelled('?order=nope');
    expect(service.cancelOrder).not.toHaveBeenCalled();
  });

  it('tells the customer it will be released on its own if cancelling fails', async () => {
    service.cancelOrder.mockRejectedValue(new Error('x'));
    cancelled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/released automatically/);
  });
});
