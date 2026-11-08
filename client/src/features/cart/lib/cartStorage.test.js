import { beforeEach, describe, expect, it } from 'vitest';

import { loadCart, sanitizeItems, saveCart } from './cartStorage';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '33333333-3333-4333-8333-333333333333';

describe('sanitizeItems', () => {
  it('returns [] for anything that is not an array', () => {
    expect(sanitizeItems(null)).toEqual([]);
    expect(sanitizeItems('x')).toEqual([]);
    expect(sanitizeItems({})).toEqual([]);
  });

  it('drops bad ids and bad quantities', () => {
    const result = sanitizeItems([
      { productId: 'prod-1', quantity: 1 },
      { productId: ID_A, quantity: 0 },
      { productId: ID_A, quantity: 1.5 },
      { productId: ID_A, quantity: '2' },
      null,
      { productId: ID_B, quantity: 2 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].productId).toBe(ID_B);
  });

  it('strips unknown fields such as a hand-written price', () => {
    const [item] = sanitizeItems([{ productId: ID_A, quantity: 1, price: 0.01, title: 'x' }]);
    expect(item).not.toHaveProperty('price');
    expect(item).not.toHaveProperty('title');
    expect(Object.keys(item).sort()).toEqual(
      ['color', 'priceSeenMinor', 'productId', 'quantity', 'selected', 'size'].sort(),
    );
  });

  it('caps quantity at 10 and merges duplicate lines', () => {
    const result = sanitizeItems([
      { productId: ID_A, quantity: 99 },
      { productId: ID_B, quantity: 6, size: 'M' },
      { productId: ID_B, quantity: 7, size: 'M' },
    ]);
    expect(result.map((i) => i.quantity)).toEqual([10, 10]);
  });

  it('keeps different variants as separate lines', () => {
    const result = sanitizeItems([
      { productId: ID_A, quantity: 1, color: 'Red' },
      { productId: ID_A, quantity: 1, color: 'Blue' },
    ]);
    expect(result).toHaveLength(2);
  });

  it('limits the number of lines to 50', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      productId: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`,
      quantity: 1,
    }));
    expect(sanitizeItems(many)).toHaveLength(50);
  });

  it('rejects bad option strings and negative remembered prices', () => {
    const [item] = sanitizeItems([
      { productId: ID_A, quantity: 1, size: 'x'.repeat(60), color: 5, priceSeenMinor: -1 },
    ]);
    expect(item).toMatchObject({ size: null, color: null, priceSeenMinor: null });
  });
});

describe('loadCart / saveCart', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trips', () => {
    const items = [
      {
        productId: ID_A,
        size: 'M',
        color: 'Red',
        quantity: 2,
        selected: false,
        priceSeenMinor: 100,
      },
    ];
    saveCart(items);
    expect(JSON.parse(window.localStorage.getItem('shopyaro:cart:v2')).version).toBe(2);
    expect(loadCart()).toEqual(items);
  });

  it('deletes the legacy cart and does not convert it', () => {
    window.localStorage.setItem('shopyaro_cart', JSON.stringify([{ _id: 'prod-1', price: 1 }]));
    expect(loadCart()).toEqual([]);
    expect(window.localStorage.getItem('shopyaro_cart')).toBeNull();
  });

  it('survives corrupt or wrong-version data', () => {
    window.localStorage.setItem('shopyaro:cart:v2', '{not json');
    expect(loadCart()).toEqual([]);
    window.localStorage.setItem('shopyaro:cart:v2', JSON.stringify({ version: 1, items: [] }));
    expect(loadCart()).toEqual([]);
  });
});
