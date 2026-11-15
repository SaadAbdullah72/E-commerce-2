import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ supabase }));

import { getCatalogStats } from './analyticsService';
import { AUDIT_PAGE_SIZE, cleanSearch, listAuditLog } from './auditLogService';

function fakeQuery(result) {
  const calls = [];
  const query = new Proxy(
    {},
    {
      get(_target, name) {
        if (name === 'calls') return calls;
        if (name === 'then')
          return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
        return (...args) => {
          calls.push([name, args]);
          return query;
        };
      },
    },
  );
  return query;
}
const callsOf = (query, name) => query.calls.filter(([method]) => method === name);

beforeEach(() => vi.resetAllMocks());

const row = (id, overrides = {}) => ({
  id,
  created_at: '2030-01-01T10:00:00Z',
  actor_id: 'u1',
  actor_email: 'admin@example.com',
  action: 'update',
  table_name: 'products',
  record_id: 'p1',
  record_label: 'Earbuds',
  summary: 'Updated product "Earbuds" (price_minor)',
  changes: { price_minor: { from: 1, to: 2 } },
  ...overrides,
});

describe('cleanSearch', () => {
  it('removes characters that could change the meaning of a filter', () => {
    expect(cleanSearch('a,b(c)%d_e*f"g\'h.i:j')).toBe('a b c d e f g h i j');
    expect(cleanSearch('  many   spaces  ')).toBe('many spaces');
    expect(cleanSearch('x'.repeat(100))).toHaveLength(60);
    expect(cleanSearch(null)).toBe('');
  });
});

describe('listAuditLog', () => {
  it('reads the log newest first, one page at a time, and never writes', async () => {
    const query = fakeQuery({ data: [row(5), row(4)], error: null });
    supabase.from.mockReturnValue(query);

    const result = await listAuditLog();

    expect(supabase.from).toHaveBeenCalledWith('admin_audit_log');
    expect(callsOf(query, 'order')[0][1]).toEqual(['id', { ascending: false }]);
    expect(callsOf(query, 'limit')[0][1]).toEqual([AUDIT_PAGE_SIZE]);
    for (const write of ['insert', 'update', 'delete', 'upsert']) {
      expect(callsOf(query, write)).toHaveLength(0);
    }
    expect(result.entries[0]).toMatchObject({
      id: 5,
      actorEmail: 'admin@example.com',
      table: 'products',
      summary: expect.stringContaining('Earbuds'),
    });
    expect(result.nextBefore).toBeNull(); // fewer than a full page: nothing more to load
  });

  it('offers the next page only after a full page, keyed by the last id', async () => {
    const full = Array.from({ length: AUDIT_PAGE_SIZE }, (_, i) => row(100 - i));
    supabase.from.mockReturnValue(fakeQuery({ data: full, error: null }));
    const result = await listAuditLog();
    expect(result.nextBefore).toBe(100 - (AUDIT_PAGE_SIZE - 1));

    const next = fakeQuery({ data: [], error: null });
    supabase.from.mockReturnValue(next);
    await listAuditLog({ before: 51 });
    expect(callsOf(next, 'lt')[0][1]).toEqual(['id', 51]);
  });

  it('applies the filters, ignoring values that are not allowed', async () => {
    const query = fakeQuery({ data: [], error: null });
    supabase.from.mockReturnValue(query);

    await listAuditLog({ table: 'coupons', action: 'delete', search: 'Spring, sale' });

    expect(callsOf(query, 'eq')).toEqual([
      ['eq', ['table_name', 'coupons']],
      ['eq', ['action', 'delete']],
    ]);
    expect(callsOf(query, 'or')[0][1][0]).toBe(
      'summary.ilike.%Spring sale%,actor_email.ilike.%Spring sale%',
    );

    const bad = fakeQuery({ data: [], error: null });
    supabase.from.mockReturnValue(bad);
    await listAuditLog({ table: 'auth.users', action: 'drop', search: '' });
    expect(callsOf(bad, 'eq')).toHaveLength(0);
    expect(callsOf(bad, 'or')).toHaveLength(0);
  });

  it('throws a friendly error, never database text', async () => {
    supabase.from.mockReturnValue(fakeQuery({ data: null, error: { message: 'secret detail' } }));
    await expect(listAuditLog()).rejects.toThrow(/couldn.t load the activity log/i);
    await expect(listAuditLog()).rejects.not.toThrow(/secret detail/);
  });
});

describe('getCatalogStats', () => {
  const raw = {
    products: { total: 1, active: 1, inactive: 0 },
    stock: { out_of_stock: 0, low: 0, healthy: 1 },
    inventory_value_minor: 500,
    customers: 3,
    by_category: [],
    signups_30d: [],
  };

  it('calls the database function and shapes the result', async () => {
    supabase.rpc.mockResolvedValue({ data: raw, error: null });
    const stats = await getCatalogStats();
    expect(supabase.rpc).toHaveBeenCalledWith('admin_catalog_stats');
    expect(stats.customers).toBe(3);
    expect(stats.inventoryValueMinor).toBe(500);
  });

  it('fails with a friendly error on a database error or a malformed result', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Admins only' } });
    await expect(getCatalogStats()).rejects.toThrow(/couldn.t load the analytics/i);
    supabase.rpc.mockResolvedValue({ data: { ...raw, customers: null }, error: null });
    await expect(getCatalogStats()).rejects.toThrow(/couldn.t load the analytics/i);
  });
});
