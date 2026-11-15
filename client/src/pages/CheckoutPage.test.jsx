import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cart = vi.hoisted(() => ({ value: {} }));
const service = vi.hoisted(() => ({
  startCheckout: vi.fn(),
  validateCoupon: vi.fn(),
  redirectToCheckout: vi.fn(),
}));
vi.mock('../context/CartContext', () => ({ useCart: () => cart.value }));
vi.mock('../features/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../features/checkout/services/checkoutService', () => service);

import { CheckoutError } from '../features/checkout/lib/checkoutErrors';
import { saveShipping } from '../features/checkout/lib/shippingStorage';
import CheckoutPage from './CheckoutPage';

const LAMP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const line = {
  key: `${LAMP}|M|Red`,
  productId: LAMP,
  size: 'M',
  color: 'Red',
  variant: 'Red / M',
  quantity: 2,
  title: 'Desk lamp',
  image: null,
  currency: 'USD',
  unitPriceMinor: 1000,
  lineTotalMinor: 2000,
};

const SHIPPING = {
  fullName: 'Sam Lee',
  email: 'sam@example.com',
  phone: '+10000000000',
  address: '1 Test Street',
  state: 'Lagos State',
  city: 'City Central / Metropolis',
  courier: 'Shipbubble',
  notes: '',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/checkout']}>
      <Routes>
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/shipping" element={<p>Shipping step</p>} />
        <Route path="/" element={<p>Home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  saveShipping(SHIPPING, 'u1');
  cart.value = {
    selectedCart: [line],
    subtotalMinor: 2000,
    isCartLoading: false,
    refetchCart: vi.fn(),
    setIsCartOpen: vi.fn(),
  };
});

describe('Checkout page', () => {
  it('goes back to the shipping step when there are no shipping details', () => {
    sessionStorage.clear();
    renderPage();
    expect(screen.getByText('Shipping step')).toBeInTheDocument();
  });

  it('says so when nothing is selected, instead of letting anyone pay', () => {
    cart.value = { ...cart.value, selectedCart: [], subtotalMinor: 0 };
    renderPage();
    expect(screen.getByRole('heading', { name: 'Nothing to pay for' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Pay/ })).not.toBeInTheDocument();
  });

  it('shows the cart, the delivery address and an ESTIMATED total', () => {
    renderPage();
    expect(screen.getByText('Desk lamp')).toBeInTheDocument();
    expect(screen.getByText(/Red \/ M · Qty: 2/)).toBeInTheDocument();
    expect(screen.getByText('1 Test Street')).toBeInTheDocument();
    expect(screen.getByText('Estimated delivery')).toBeInTheDocument();
    expect(screen.getByText('$4.80')).toBeInTheDocument();
    expect(screen.getByText('Estimated total')).toBeInTheDocument();
    expect(screen.getAllByText('$24.80').length).toBeGreaterThan(0); // 20.00 + 4.80
    expect(screen.getByRole('button', { name: 'Pay $24.80' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/shipping');
  });

  it('has no leftover fake payment options', () => {
    const { container } = renderPage();
    expect(container).not.toHaveTextContent(/paystack|squad|cash on delivery|\bCOD\b/i);
    expect(container).not.toHaveTextContent(/Order Placed Successfully/i);
    expect(container.querySelector('input[type="radio"]')).toBeNull();
  });

  describe('coupon', () => {
    it('previews the discount and lowers the estimated total', async () => {
      service.validateCoupon.mockResolvedValue({ ok: true, code: 'SAVE10', discountMinor: 200 });
      renderPage();

      await userEvent.type(screen.getByLabelText('Coupon code'), 'save10');
      await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

      expect(await screen.findByText(/applied: \$2\.00 off/)).toBeInTheDocument();
      expect(service.validateCoupon).toHaveBeenCalledWith('save10', 2000);
      expect(screen.getByText('-$2.00')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pay $22.80' })).toBeInTheDocument();
    });

    it('can be removed again', async () => {
      service.validateCoupon.mockResolvedValue({ ok: true, code: 'SAVE10', discountMinor: 200 });
      renderPage();
      await userEvent.type(screen.getByLabelText('Coupon code'), 'SAVE10');
      await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));

      expect(screen.getByRole('button', { name: 'Pay $24.80' })).toBeInTheDocument();
      expect(screen.getByLabelText('Coupon code')).toBeInTheDocument();
    });

    it('explains a refused coupon, including the minimum spend', async () => {
      service.validateCoupon.mockResolvedValue({
        ok: false,
        reason: 'min_subtotal',
        minSubtotalMinor: 5000,
      });
      renderPage();
      await userEvent.type(screen.getByLabelText('Coupon code'), 'BIG');
      await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Spend at least $50.00 to use this coupon.',
      );
      expect(screen.getByRole('button', { name: 'Pay $24.80' })).toBeInTheDocument();
    });

    it('shows a friendly message when the check itself fails', async () => {
      service.validateCoupon.mockRejectedValue(
        new Error("We couldn't check that coupon. Please try again."),
      );
      renderPage();
      await userEvent.type(screen.getByLabelText('Coupon code'), 'X1X');
      await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
      expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't check that coupon");
    });

    it('does nothing for an empty code', () => {
      renderPage();
      expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    });
  });

  describe('paying', () => {
    it('sends the cart lines, the shipping details and the coupon, then goes to Stripe', async () => {
      service.validateCoupon.mockResolvedValue({ ok: true, code: 'SAVE10', discountMinor: 200 });
      service.startCheckout.mockResolvedValue({
        url: 'https://checkout.stripe.com/c/pay/cs_test_1',
        orderId: 'o1',
        orderNumber: 'SY-1',
      });
      renderPage();
      await userEvent.type(screen.getByLabelText('Coupon code'), 'SAVE10');
      await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Pay $22.80' }));

      await waitFor(() =>
        expect(service.redirectToCheckout).toHaveBeenCalledWith(
          'https://checkout.stripe.com/c/pay/cs_test_1',
        ),
      );
      const args = service.startCheckout.mock.calls[0][0];
      expect(args.couponCode).toBe('SAVE10');
      expect(args.lines).toEqual([line]);
      expect(args.shipping).toMatchObject({ fullName: 'Sam Lee', state: 'Lagos State' });
    });

    it('sends no coupon when none is applied, and blocks a second click while waiting', async () => {
      let release;
      service.startCheckout.mockReturnValue(new Promise((resolve) => (release = resolve)));
      renderPage();
      await userEvent.click(screen.getByRole('button', { name: 'Pay $24.80' }));

      expect(service.startCheckout.mock.calls[0][0].couponCode).toBeNull();
      const busy = screen.getByRole('button', { name: /Taking you to Stripe/ });
      expect(busy).toBeDisabled();
      await userEvent.click(busy);
      expect(service.startCheckout).toHaveBeenCalledTimes(1);

      release({ url: 'https://checkout.stripe.com/x', orderId: 'o1', orderNumber: 'SY-1' });
      await waitFor(() => expect(service.redirectToCheckout).toHaveBeenCalledTimes(1));
    });

    it('names the product, refreshes the cart and offers a way to review it when stock ran out', async () => {
      service.startCheckout.mockRejectedValue(new CheckoutError('insufficient_stock', 'x', LAMP));
      renderPage();
      await userEvent.click(screen.getByRole('button', { name: 'Pay $24.80' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'There is not enough stock left for "Desk lamp". Please review your cart.',
      );
      expect(cart.value.refetchCart).toHaveBeenCalled();
      expect(service.redirectToCheckout).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Pay $24.80' })).toBeEnabled(); // can try again

      await userEvent.click(screen.getByRole('button', { name: 'Review cart' }));
      expect(cart.value.setIsCartOpen).toHaveBeenCalledWith(true);
    });

    it('drops the coupon and says why when the server refuses it', async () => {
      service.validateCoupon.mockResolvedValue({ ok: true, code: 'SAVE10', discountMinor: 200 });
      service.startCheckout.mockRejectedValue(new CheckoutError('coupon_expired'));
      renderPage();
      await userEvent.type(screen.getByLabelText('Coupon code'), 'SAVE10');
      await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Pay $22.80' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('That coupon has expired.');
      expect(screen.getByRole('button', { name: 'Pay $24.80' })).toBeInTheDocument();
    });

    it.each([
      ['too_many_pending', /unpaid orders open/],
      ['amount_too_small', /too small to pay online/],
      ['payment_unavailable', /couldn't start the payment/],
      ['something_else', /Something went wrong/],
    ])('shows a friendly message for %s', async (code, pattern) => {
      service.startCheckout.mockRejectedValue(new CheckoutError(code, 'raw server text'));
      renderPage();
      await userEvent.click(screen.getByRole('button', { name: 'Pay $24.80' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(pattern);
      expect(alert).not.toHaveTextContent('raw server text');
    });
  });
});
