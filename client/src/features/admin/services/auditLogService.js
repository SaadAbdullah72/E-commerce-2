import { supabase } from '@/lib/supabase/client';

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_TABLES = [
  'products',
  'categories',
  'deal_tags',
  'coupons',
  'site_banners',
  'user_roles',
];
export const AUDIT_ACTIONS = ['insert', 'update', 'delete'];

const COLUMNS =
  'id, created_at, actor_id, actor_email, action, table_name, record_id, record_label, summary, changes';

/**
 * The search text goes into a PostgREST filter, where , ( ) and wildcard characters have
 * meaning. Remove them so typed text can only ever be matched literally.
 *
 * @param {string} text
 */
export function cleanSearch(text) {
  return String(text ?? '')
    .replace(/[%_\\*,()"'.:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/**
 * One page of the activity log, newest first. Pages are chained by id ("older than this
 * id"), so new entries arriving while someone reads never shift or repeat rows.
 * Only admins can read this table (row-level security); nobody can write to it from here.
 *
 * @param {{ table?: string, action?: string, search?: string, before?: number | null }} [filters]
 */
export async function listAuditLog({ table = '', action = '', search = '', before = null } = {}) {
  let query = supabase
    .from('admin_audit_log')
    .select(COLUMNS)
    .order('id', { ascending: false })
    .limit(AUDIT_PAGE_SIZE);

  if (AUDIT_TABLES.includes(table)) query = query.eq('table_name', table);
  if (AUDIT_ACTIONS.includes(action)) query = query.eq('action', action);

  const term = cleanSearch(search);
  if (term) {
    query = query.or(`summary.ilike.%${term}%,actor_email.ilike.%${term}%`);
  }
  if (typeof before === 'number') query = query.lt('id', before);

  const { data, error } = await query;
  if (error) throw new Error("We couldn't load the activity log. Please try again.");

  return {
    entries: data.map((row) => ({
      id: row.id,
      at: row.created_at,
      actorId: row.actor_id,
      actorEmail: row.actor_email,
      action: row.action,
      table: row.table_name,
      recordId: row.record_id,
      label: row.record_label,
      summary: row.summary,
      changes: row.changes,
    })),
    nextBefore: data.length === AUDIT_PAGE_SIZE ? data[data.length - 1].id : null,
  };
}
