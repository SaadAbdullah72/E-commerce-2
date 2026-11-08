import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { productRow } from '@/test/fixtures/catalog';
import { renderWithProviders } from '@/test/renderWithProviders';

const service = vi.hoisted(() => ({ listProductsByIds: vi.fn() }));
vi.mock('@/features/catalog/services/catalogService', () => service);

import { useCart } from '@/context/CartContext';

import CartDrawer from './CartDrawer';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '33333333-3333-4333-8333-333333333333';

const earbudsRow = (overrides) => productRow(overrides);
const lampRow = (overrides) =>
  productRow({
    id: ID_B,
    slug: 'lamp',
    title: 'Desk Lamp',
    price_minor: 2000,
    compare_at_price_minor: null,
    ...overrides,
  });

const storedItem = (overrides = {}) => ({
  productId: ID_A,
  size: null,
  color: null,
  quantity: 1,
  selected: true,
  priceSeenMinor: null,
  ...overrides,
});

function seed(items) {
  window.localStorage.setItem('shopyaro:cart:v2', JSON.stringify({ version: 2, items }));
}

function mockProducts(...rows) {
  // The service returns mapped products; reuse the real mapper through the fixture rows.
  return import('@/features/catalog/lib/mapProduct').then(({ mapProduct }) => {
    service.listProductsByIds.mockResolvedValue(rows.map(mapProduct));
  });
}

function Harness() {
  const { setIsCartOpen, addToCart } = useCart();
  return (
    <>
      <button onClick={() => setIsCartOpen(true)}>open</button>
      <button
        onClick={() =>
          addToCart(
            { id: ID_A, stock: 50, priceMinor: 1299, sizes: ['M', 'L'], colors: [{ name: 'Red' }] },
            1,
            { size: 'M', color: 'Red' },
          )
        }
      >
        add red M
      </button>
      <button
        onClick={() =>
          addToCart(
            { id: ID_A, stock: 50, priceMinor: 1299, sizes: ['M', 'L'], colors: [{ name: 'Red' }] },
            1,
            { size: 'M', color: 'Blue' },
          )
        }
      >
        add blue M
      </button>
      <CartDrawer />
    </>
  );
}

async function openCart(user) {
  renderWithProviders(<Harness />);
  await user.click(screen.getByText('open'));
}

const stored = () => JSON.parse(window.localStorage.getItem('shopyaro:cart:v2')).items;

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
});

describe('CartDrawer', () => {
  it('shows live title and price from the database in money format', async () => {
    seed([storedItem({ quantity: 2 })]);
    await mockProducts(earbudsRow());
    await openCart(userEvent.setup());

    expect(await screen.findByText('Wireless Bluetooth Earbuds Noise Cancelling')).toBeInTheDocument();
    expect(screen.getByText('$12.99 each')).toBeInTheDocument();
    expect(screen.getAllByText('$25.98').length).toBeGreaterThan(0);
  });

  it('ignores a price tampered into local storage', async () => {
    window.localStorage.setItem(
      'shopyaro:cart:v2',
      JSON.stringify({ version: 2, items: [{ ...storedItem(), price: 0.01, priceMinor: 1 }] }),
    );
    await mockProducts(earbudsRow());
    await openCart(userEvent.setup());

    expect(await screen.findByText('$12.99 each')).toBeInTheDocument();
    expect(screen.queryByText(/\$0\.01/)).not.toBeInTheDocument();
  });

  it('shows skeleton rows while loading', async () => {
    seed([storedItem()]);
    service.listProductsByIds.mockReturnValue(new Promise(() => {}));
    await openCart(userEvent.setup());

    expect(screen.getByRole('status', { name: /loading cart item/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /proceed to checkout/i })).toBeDisabled();
  });

  it('shows an error banner with retry and blocks checkout', async () => {
    seed([storedItem()]);
    service.listProductsByIds.mockRejectedValue(new Error('x'));
    const user = userEvent.setup();
    await openCart(user);

    expect(await screen.findByText(/couldn.t load the latest prices/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /proceed to checkout/i })).toBeDisabled();

    service.listProductsByIds.mockResolvedValue([]);
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(service.listProductsByIds).toHaveBeenCalledTimes(2));
  });

  it('flags unavailable and out-of-stock items and keeps them out of the total', async () => {
    seed([storedItem(), storedItem({ productId: ID_B })]);
    await mockProducts(earbudsRow({ stock: 0 }));
    await openCart(userEvent.setup());

    expect(await screen.findByText(/out of stock\. remove it/i)).toBeInTheDocument();
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /proceed to checkout/i })).toBeDisabled();
  });

  it('warns when the price changed and clears the notice on OK', async () => {
    seed([storedItem({ priceSeenMinor: 999 })]);
    await mockProducts(earbudsRow());
    const user = userEvent.setup();
    await openCart(user);

    expect(await screen.findByText(/price changed from \$9\.99/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByText(/price changed/i)).not.toBeInTheDocument();
    expect(stored()[0].priceSeenMinor).toBe(1299);
  });

  it('shows "Only N available" and caps the quantity buttons at stock', async () => {
    seed([storedItem({ quantity: 5 })]);
    await mockProducts(earbudsRow({ stock: 3 }));
    await openCart(userEvent.setup());

    expect(await screen.findByText('Only 3 available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /increase quantity/i })).toBeDisabled();
  });

  it('stops increasing at the 10 per item cap', async () => {
    seed([storedItem({ quantity: 9 })]);
    await mockProducts(earbudsRow({ stock: 500 }));
    const user = userEvent.setup();
    await openCart(user);

    const plus = await screen.findByRole('button', { name: /increase quantity/i });
    await user.click(plus);
    expect(stored()[0].quantity).toBe(10);
    expect(screen.getByRole('button', { name: /increase quantity/i })).toBeDisabled();
  });

  it('removes a line and shows the empty state', async () => {
    seed([storedItem()]);
    await mockProducts(earbudsRow());
    const user = userEvent.setup();
    await openCart(user);

    await user.click(await screen.findByRole('button', { name: /remove item/i }));
    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
    expect(stored()).toEqual([]);
  });

  it('deselecting all drops the subtotal and disables checkout', async () => {
    seed([storedItem({ quantity: 2 }), storedItem({ productId: ID_B })]);
    await mockProducts(earbudsRow(), lampRow());
    const user = userEvent.setup();
    await openCart(user);

    await screen.findByText('Desk Lamp');
    expect(screen.getByText('Selected Subtotal (3 items)')).toBeInTheDocument();
    expect(screen.getByText('$45.98')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /select all/i }));
    expect(screen.getByText('Selected Subtotal (0 items)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /proceed to checkout/i })).toBeDisabled();
  });
});

describe('CartContext variants', () => {
  it('keeps different colours of the same product as separate lines and merges the same one', async () => {
    await mockProducts(earbudsRow({ stock: 50, colors: [{ name: 'Red' }, { name: 'Blue' }] }));
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByText('add red M'));
    await user.click(screen.getByText('add blue M'));
    await user.click(screen.getByText('add red M'));

    await waitFor(() => expect(stored()).toHaveLength(2));
    expect(stored().map((i) => [i.color, i.quantity])).toEqual([
      ['Red', 2],
      ['Blue', 1],
    ]);
    expect(stored()[0]).toHaveProperty('priceSeenMinor', 1299);
    expect(stored()[0]).not.toHaveProperty('price');
  });
});
