import { describe, expect, it } from 'vitest';

import { actorLabel, describeChanges, fieldLabel, formatChangeValue } from './auditFormat';
import { parseCatalogStats } from './catalogStats';

describe('fieldLabel / formatChangeValue', () => {
  it('turns column names into labels', () => {
    expect(fieldLabel('price_minor')).toBe('Price');
    expect(fieldLabel('is_active')).toBe('Is active');
    expect(fieldLabel('compare_at_price_minor')).toBe('Compare at price');
  });

  it('formats values as readable plain text', () => {
    expect(formatChangeValue('title', null)).toBe('(empty)');
    expect(formatChangeValue('title', '')).toBe('(empty)');
    expect(formatChangeValue('is_active', true)).toBe('Yes');
    expect(formatChangeValue('is_active', false)).toBe('No');
    expect(formatChangeValue('stock', 12)).toBe('12');
    expect(formatChangeValue('price_minor', 1299)).toBe('$12.99');
    expect(formatChangeValue('sizes', ['S', 'M'])).toBe('["S","M"]');
    expect(formatChangeValue('description', 'x'.repeat(300))).toHaveLength(201);
  });
});

describe('describeChanges', () => {
  it('lists before and after for an update', () => {
    const result = describeChanges({
      action: 'update',
      changes: { price_minor: { from: 1000, to: 1200 }, is_active: { from: true, to: false } },
    });
    expect(result.kind).toBe('diff');
    expect(result.rows).toEqual([
      { field: 'price_minor', label: 'Price', from: '$10.00', to: '$12.00' },
      { field: 'is_active', label: 'Is active', from: 'Yes', to: 'No' },
    ]);
  });

  it('shows the removed record for a delete', () => {
    const result = describeChanges({ action: 'delete', changes: { title: 'Old', stock: 0 } });
    expect(result.kind).toBe('snapshot');
    expect(result.rows.map((row) => row.value)).toEqual(['Old', '0']);
  });

  it('has nothing extra for a create, or when nothing was recorded', () => {
    expect(describeChanges({ action: 'insert', changes: null }).kind).toBe('none');
    expect(describeChanges({ action: 'update', changes: null }).kind).toBe('none');
    expect(describeChanges({ action: 'update', changes: {} }).kind).toBe('none');
  });
});

describe('actorLabel', () => {
  it('uses the email, or says the change was made in the database', () => {
    expect(actorLabel({ actorEmail: 'a@b.co' })).toBe('a@b.co');
    expect(actorLabel({ actorEmail: null })).toBe('Database');
  });
});

describe('parseCatalogStats', () => {
  const raw = {
    products: { total: 10, active: 8, inactive: 2 },
    stock: { out_of_stock: 1, low: 2, healthy: 5 },
    inventory_value_minor: 123456,
    customers: 7,
    by_category: [{ id: 'c1', name: 'Electronics', active: 5, inactive: 1 }],
    signups_30d: [{ day: '2030-01-01', count: 2 }],
  };

  it('reshapes the database result', () => {
    expect(parseCatalogStats(raw)).toEqual({
      products: { total: 10, active: 8, inactive: 2 },
      stock: { outOfStock: 1, low: 2, healthy: 5 },
      inventoryValueMinor: 123456,
      customers: 7,
      byCategory: [{ id: 'c1', name: 'Electronics', active: 5, inactive: 1 }],
      signups: [{ day: '2030-01-01', count: 2 }],
    });
  });

  it('accepts real zeros', () => {
    const zero = parseCatalogStats({
      ...raw,
      products: { total: 0, active: 0, inactive: 0 },
      customers: 0,
      inventory_value_minor: 0,
    });
    expect(zero.customers).toBe(0);
  });

  it('throws on a missing or invalid number instead of inventing a zero', () => {
    expect(() => parseCatalogStats(null)).toThrow();
    expect(() => parseCatalogStats({ ...raw, customers: undefined })).toThrow();
    expect(() => parseCatalogStats({ ...raw, customers: 'abc' })).toThrow();
    expect(() => parseCatalogStats({ ...raw, customers: -1 })).toThrow();
    expect(() => parseCatalogStats({ ...raw, products: {} })).toThrow();
    expect(() => parseCatalogStats({ ...raw, inventory_value_minor: null })).toThrow();
  });

  it('treats missing lists as empty', () => {
    const result = parseCatalogStats({ ...raw, by_category: null, signups_30d: undefined });
    expect(result.byCategory).toEqual([]);
    expect(result.signups).toEqual([]);
  });
});
