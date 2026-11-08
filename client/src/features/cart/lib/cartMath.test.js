import { describe, expect, it } from 'vitest';

import {
  buildLines,
  clampQuantity,
  countUnits,
  lineTotalMinor,
  maxQuantityFor,
  purchasableSelected,
  subtotalMinor,
} from './cartMath';
import { lineKey } from './lineKey';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '33333333-3333-4333-8333-333333333333';

const product = (overrides = {}) => ({
  id: ID_A,
  slug: 'earbuds',
  title: 'Earbuds',
  images: ['https://example.com/a.jpg'],
  currency: 'USD',
  priceMinor: 1299,
  stock: 50,
  ...overrides,
});

const item = (overrides = {}) => ({
  productId: ID_A,
  size: null,
  color: null,
  quantity: 1,
  selected: true,
  priceSeenMinor: null,
  ...overrides,
});

describe('lineKey', () => {
  it('separates different colours and sizes of the same product', () => {
    expect(lineKey(ID_A, 'M', 'Red')).not.toBe(lineKey(ID_A, 'M', 'Blue'));
    expect(lineKey(ID_A, 'M', 'Red')).not.toBe(lineKey(ID_A, 'L', 'Red'));
    expect(lineKey(ID_A, null, null)).toBe(lineKey(ID_A, undefined, undefined));
  });
});

describe('quantity limits', () => {
  it('caps at 10 and at stock', () => {
    expect(maxQuantityFor(500)).toBe(10);
    expect(maxQuantityFor(3)).toBe(3);
    expect(maxQuantityFor(0)).toBe(0);
    expect(maxQuantityFor(-4)).toBe(0);
  });

  it('clamps into range and returns 0 when nothing is buyable', () => {
    expect(clampQuantity(99, 500)).toBe(10);
    expect(clampQuantity(5, 3)).toBe(3);
    expect(clampQuantity(0, 5)).toBe(1);
    expect(clampQuantity('abc', 5)).toBe(1);
    expect(clampQuantity(2, 0)).toBe(0);
  });
});

describe('money', () => {
  it('uses whole cents with no drift', () => {
    expect(lineTotalMinor(1099, 3)).toBe(3297);
    expect(lineTotalMinor(10, 3)).toBe(30);
  });
});

describe('buildLines', () => {
  it('prices every line from the database product, not from the stored cart', () => {
    const [line] = buildLines(
      [item({ quantity: 2, priceSeenMinor: 1299 })],
      new Map([[ID_A, product()]]),
      'ready',
    );
    expect(line).toMatchObject({
      status: 'ok',
      unitPriceMinor: 1299,
      lineTotalMinor: 2598,
      title: 'Earbuds',
      image: 'https://example.com/a.jpg',
      priceChanged: false,
    });
  });

  it('flags a changed price and remembers the old one', () => {
    const [line] = buildLines(
      [item({ priceSeenMinor: 999 })],
      new Map([[ID_A, product()]]),
      'ready',
    );
    expect(line.priceChanged).toBe(true);
    expect(line.previousPriceMinor).toBe(999);
    expect(line.unitPriceMinor).toBe(1299);
  });

  it('reduces the effective quantity to the available stock', () => {
    const [line] = buildLines(
      [item({ quantity: 8 })],
      new Map([[ID_A, product({ stock: 3 })]]),
      'ready',
    );
    expect(line).toMatchObject({ quantity: 3, requestedQuantity: 8, quantityReduced: true });
    expect(line.lineTotalMinor).toBe(3 * 1299);
  });

  it('marks out of stock, unavailable, loading and error lines as not purchasable', () => {
    const items = [item(), item({ productId: ID_B })];
    const out = buildLines(items, new Map([[ID_A, product({ stock: 0 })]]), 'ready');
    expect(out.map((l) => l.status)).toEqual(['out_of_stock', 'unavailable']);
    expect(buildLines(items, new Map(), 'loading').map((l) => l.status)).toEqual([
      'loading',
      'loading',
    ]);
    expect(buildLines(items, new Map(), 'error').map((l) => l.status)).toEqual(['error', 'error']);
    expect(purchasableSelected(out)).toEqual([]);
  });

  it('builds a readable variant label', () => {
    const [line] = buildLines(
      [item({ color: 'Red', size: 'M' })],
      new Map([[ID_A, product()]]),
      'ready',
    );
    expect(line.variant).toBe('Red / M');
  });

  it('sums only ticked, purchasable lines', () => {
    const lines = buildLines(
      [item({ quantity: 2 }), item({ productId: ID_B, quantity: 1, selected: false })],
      new Map([
        [ID_A, product()],
        [ID_B, product({ id: ID_B, priceMinor: 500 })],
      ]),
      'ready',
    );
    const selected = purchasableSelected(lines);
    expect(selected).toHaveLength(1);
    expect(subtotalMinor(selected)).toBe(2598);
    expect(countUnits(selected)).toBe(2);
  });
});
