-- =============================================================================
-- R8 cleanup check A (READ-ONLY). Run it BEFORE 0014 to see the starting point, and AFTER 0014
-- to see the result. It changes nothing.
--
-- Expected AFTER 0014:
--   duplicate_index_gone               -> true
--   kept_index_exists                  -> true
--   categories_policies / products_policies -> no "admin_select_all_*" in the list; the
--                                         "admin read all" policy IS in the list
--   profiles_policies                  -> STILL contains admin_select_all_profiles (kept on purpose)
--   admins_can_read_profiles           -> true  (some admin read policy on profiles exists)
--   trigger_functions                  -> every one: anon false, authenticated false, public false
--   other_trigger_functions_still_open -> [] (empty). Anything listed here is a trigger function
--                                         in public that anon/authenticated can still execute.
--   triggers_still_attached            -> every count is 1 or more
-- =============================================================================
select jsonb_pretty(jsonb_build_object(
  'duplicate_index_gone', not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'product_images_product_position_idx'),
  'kept_index_exists', exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'product_images_product_idx'),

  'categories_policies', (select coalesce(jsonb_agg(policyname order by policyname), '[]'::jsonb)
                            from pg_policies where schemaname = 'public' and tablename = 'categories'
                             and cmd = 'SELECT'),
  'products_policies', (select coalesce(jsonb_agg(policyname order by policyname), '[]'::jsonb)
                          from pg_policies where schemaname = 'public' and tablename = 'products'
                           and cmd = 'SELECT'),
  'profiles_policies', (select coalesce(jsonb_agg(policyname order by policyname), '[]'::jsonb)
                          from pg_policies where schemaname = 'public' and tablename = 'profiles'),
  'admins_can_read_profiles', exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
       and cmd = 'SELECT' and policyname not like '%own row%'),

  'trigger_functions', (
    select jsonb_object_agg(p.proname, jsonb_build_object(
             'anon', has_function_privilege('anon', p.oid, 'EXECUTE'),
             'authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
             'public', (p.proacl is null or exists (
                select 1 from aclexplode(p.proacl) x where x.grantee = 0 and x.privilege_type = 'EXECUTE'))))
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('set_updated_at', 'catalog_set_updated_at', 'validate_product_colors',
                         'coupons_guard', 'coupons_delete_guard', 'site_banners_limit',
                         'audit_log_immutable')),

  'other_trigger_functions_still_open', (
    select coalesce(jsonb_agg(p.proname order by p.proname), '[]'::jsonb)
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prorettype = 'trigger'::regtype
       and (has_function_privilege('anon', p.oid, 'EXECUTE')
            or has_function_privilege('authenticated', p.oid, 'EXECUTE'))),

  'triggers_still_attached', (
    select jsonb_object_agg(f.proname, (
             select count(*) from pg_trigger t where t.tgfoid = f.oid and not t.tgisinternal))
      from pg_proc f
     where f.pronamespace = 'public'::regnamespace
       and f.proname in ('set_updated_at', 'catalog_set_updated_at', 'validate_product_colors',
                         'coupons_guard', 'coupons_delete_guard', 'site_banners_limit',
                         'audit_log_immutable'))
)) as r8_cleanup_check_a;
