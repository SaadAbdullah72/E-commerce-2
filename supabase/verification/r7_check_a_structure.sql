-- =============================================================================
-- R7 check A: structure (READ-ONLY). Run this after 0012_admin_orders.sql.
--
-- Expected:
--   authenticated_can_select_columns -> TRUE for every column of orders EXCEPT
--                                       stripe_session_id and stripe_payment_intent_id (FALSE).
--   anon_can_select_any_column       -> false
--   authenticated_table_level_select -> false  (the whole-table grant is gone)
--   authenticated_can_write_orders   -> insert false, update false, delete false
--   functions                        -> admin_get_order and admin_update_order are SECURITY DEFINER,
--                                       admin_order_stats is NOT (security_definer false);
--                                       all three: authenticated_can_execute true,
--                                       anon_can_execute false, public_can_execute false
--   other_order_functions_still_ok   -> get_my_order and cancel_my_order: authenticated true
--   payment_issue_index              -> true
--   audit_log_constraints            -> only the "action" check (table_name is not restricted)
-- =============================================================================
select jsonb_pretty(jsonb_build_object(
  'authenticated_can_select_columns', (
    select jsonb_object_agg(a.attname, has_column_privilege('authenticated', 'public.orders', a.attname, 'SELECT')
                            order by a.attname)
      from pg_attribute a
     where a.attrelid = 'public.orders'::regclass and a.attnum > 0 and not a.attisdropped),
  'anon_can_select_any_column', (
    select bool_or(has_column_privilege('anon', 'public.orders', a.attname, 'SELECT'))
      from pg_attribute a
     where a.attrelid = 'public.orders'::regclass and a.attnum > 0 and not a.attisdropped),
  'authenticated_table_level_select', has_table_privilege('authenticated', 'public.orders', 'SELECT'),
  'authenticated_can_write_orders', jsonb_build_object(
    'insert', has_table_privilege('authenticated', 'public.orders', 'INSERT'),
    'update', has_table_privilege('authenticated', 'public.orders', 'UPDATE'),
    'delete', has_table_privilege('authenticated', 'public.orders', 'DELETE')),
  'functions', (
    select jsonb_object_agg(p.proname, jsonb_build_object(
             'security_definer', p.prosecdef,
             'authenticated_can_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
             'anon_can_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
             'public_can_execute', (p.proacl is null or exists (
                select 1 from aclexplode(p.proacl) x where x.grantee = 0 and x.privilege_type = 'EXECUTE'))))
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('admin_get_order', 'admin_update_order', 'admin_order_stats')),
  'other_order_functions_still_ok', (
    select jsonb_object_agg(p.proname, jsonb_build_object(
             'authenticated_can_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE')))
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('get_my_order', 'cancel_my_order', 'place_order')),
  'payment_issue_index', exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'orders_payment_issue_idx'),
  'audit_log_constraints', (
    select jsonb_agg(conname order by conname)
      from pg_constraint
     where conrelid = 'public.admin_audit_log'::regclass and contype = 'c')
)) as r7_check_a;
