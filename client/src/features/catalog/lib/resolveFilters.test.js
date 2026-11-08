import { describe, expect, it } from 'vitest';

import { resolveFilters } from './resolveFilters';

const categories = [{ id: 'c1', name: 'Electronics' }];
const dealTags = [{ id: 't1', name: 'Lightning Deals' }];

describe('resolveFilters', () => {
  it('has no filters when nothing is selected', () => {
    expect(resolveFilters({ categories, dealTags })).toEqual({ filters: {}, isUnknown: false });
  });

  it('a search keyword wins over a picked label', () => {
    const result = resolveFilters({
      keyword: '  watch ',
      selected: 'Electronics',
      categories,
      dealTags,
    });
    expect(result).toEqual({ filters: { keyword: 'watch' }, isUnknown: false });
  });

  it('matches a category name, ignoring case', () => {
    const result = resolveFilters({ selected: 'electronics', categories, dealTags });
    expect(result.filters).toEqual({ categoryId: 'c1' });
  });

  it('matches a deal tag name, ignoring case', () => {
    const result = resolveFilters({ selected: 'lightning deals', categories, dealTags });
    expect(result.filters).toEqual({ dealTagId: 't1' });
  });

  it('applies the price rule for the Under $5 Store', () => {
    const result = resolveFilters({ selected: 'Under $5 Store', categories, dealTags });
    expect(result.filters).toEqual({ maxPriceMinor: 500 });
  });

  it('flags a label that matches nothing', () => {
    expect(resolveFilters({ selected: 'Nonsense', categories, dealTags })).toEqual({
      filters: {},
      isUnknown: true,
    });
  });
});
