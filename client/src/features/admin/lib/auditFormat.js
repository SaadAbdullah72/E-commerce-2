import { formatMoney } from '@/shared/lib/formatMoney';

export const TABLE_LABELS = {
  products: 'Products',
  categories: 'Categories',
  deal_tags: 'Deal tags',
  coupons: 'Coupons',
  site_banners: 'Banners',
  user_roles: 'User roles',
  orders: 'Orders',
};

export const ACTION_LABELS = { insert: 'Created', update: 'Updated', delete: 'Deleted' };
export const ACTION_TONES = { insert: 'green', update: 'amber', delete: 'red' };

const MAX_TEXT = 200;

/** @param {{ actorEmail?: string | null }} entry */
export const actorLabel = (entry) => entry.actorEmail || 'Database';

/** "price_minor" -> "Price", "is_active" -> "Is active" */
export function fieldLabel(field) {
  const text = String(field)
    .replace(/_minor$/, '')
    .replace(/_/g, ' ')
    .trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Make one stored value readable. The result is plain text, never markup. */
export function formatChangeValue(field, value) {
  if (value === null || value === undefined || value === '') return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    return String(field).endsWith('_minor') ? formatMoney(value) || String(value) : String(value);
  }
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
}

/**
 * What to show when a log entry is expanded.
 * - update: each changed field, old value and new value
 * - delete: the row as it was
 * - insert: nothing extra (the summary says what was created)
 *
 * @param {{ action: string, changes: any }} entry
 * @returns {{ kind: 'diff' | 'snapshot' | 'none', rows: { field: string, label: string, from?: string, to?: string, value?: string }[] }}
 */
export function describeChanges(entry) {
  const changes = entry.changes;
  if (!changes || typeof changes !== 'object') return { kind: 'none', rows: [] };

  if (entry.action === 'update') {
    const rows = Object.entries(changes).map(([field, change]) => ({
      field,
      label: fieldLabel(field),
      from: formatChangeValue(field, change?.from),
      to: formatChangeValue(field, change?.to),
    }));
    return { kind: rows.length ? 'diff' : 'none', rows };
  }
  if (entry.action === 'delete') {
    const rows = Object.entries(changes).map(([field, value]) => ({
      field,
      label: fieldLabel(field),
      value: formatChangeValue(field, value),
    }));
    return { kind: rows.length ? 'snapshot' : 'none', rows };
  }
  return { kind: 'none', rows: [] };
}
