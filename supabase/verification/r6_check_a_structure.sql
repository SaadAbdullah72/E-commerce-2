-- =============================================================================
-- R6 check A: structure (READ-ONLY). Run this after 0010_profile_and_orders.sql.
--
-- Expected:
--   new_columns             -> default_address, default_city, default_state
--   authenticated_can_update-> TRUE only for full_name, phone, default_address,
--                              default_city, default_state. FALSE for id, avatar_url,
--                              terms_accepted_at, terms_version, created_at, updated_at.
--   anon_can_update_any     -> false
--   authenticated_table_level -> insert false, delete false
--   policies                -> includes "profiles: update own row [UPDATE]"
-- =============================================================================
select jsonb_pretty(jsonb_build_object(
  'new_columns', (
    select jsonb_agg(column_name order by column_name)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name like 'default\_%'),
  'authenticated_can_update', (
    select jsonb_object_agg(c, has_column_privilege('authenticated', 'public.profiles', c, 'UPDATE'))
    from unnest(array['id','full_name','avatar_url','phone','terms_accepted_at','terms_version',
                      'created_at','updated_at','default_address','default_city','default_state']) c),
  'anon_can_update_any', (
    select bool_or(has_column_privilege('anon', 'public.profiles', c, 'UPDATE'))
    from unnest(array['id','full_name','avatar_url','phone','terms_accepted_at','terms_version',
                      'created_at','updated_at','default_address','default_city','default_state']) c),
  'authenticated_table_level', jsonb_build_object(
    'insert', has_table_privilege('authenticated', 'public.profiles', 'INSERT'),
    'delete', has_table_privilege('authenticated', 'public.profiles', 'DELETE')),
  'policies', (
    select jsonb_agg(policyname || ' [' || cmd || ']' order by policyname)
    from pg_policies where schemaname = 'public' and tablename = 'profiles')
)) as r6_check_a;
