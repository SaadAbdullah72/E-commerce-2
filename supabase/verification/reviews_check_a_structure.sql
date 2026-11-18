-- =============================================================================
-- Reviews check A: structure (READ-ONLY). Run this after 0013_reviews.sql.
--
-- Expected:
--   rls_enabled                       -> reviews, review_media, review_upload_log: all true
--   reviews_columns_visible_to_anon   -> TRUE for: id, product_id, rating, title, comment, author_name,
--                                        status, media_count, is_verified_purchase, created_at,
--                                        updated_at. FALSE for: user_id, order_id, moderated_by,
--                                        moderated_at.   (authenticated: exactly the same)
--   media_columns_visible_to_anon     -> TRUE for: id, review_id, media_type, url, width, height,
--                                        duration_seconds, position, created_at.
--                                        FALSE for: public_id, bytes.   (authenticated: the same)
--   table_level_select                -> all false (no whole-table grant for anon or authenticated)
--   can_write                         -> every insert/update/delete false, for both roles, on all
--                                        three tables
--   upload_log_and_queue_closed       -> every select false for anon and authenticated
--   policies                          -> reviews: "public read approved" + "admin read all";
--                                        review_media: the same two; review_upload_log: none
--   functions                         -> see the list: security_definer / who can execute
--                                        (anon_can_execute true ONLY for product_review_summary;
--                                         internal helpers: nobody but the owner)
--   claim_cleanup_batch               -> returns id, public_id, resource_type; only service_role
--   queue_resource_type               -> column exists, default 'image'
--   triggers                          -> the five new triggers exist
--   audit_function_skips_rating       -> true
--   indexes                           -> all true
--   constraints                       -> all true
-- =============================================================================
select jsonb_pretty(jsonb_build_object(
  'rls_enabled', (
    select jsonb_object_agg(c.relname, c.relrowsecurity)
      from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relname in ('reviews', 'review_media', 'review_upload_log')),

  'reviews_columns_visible_to_anon', (
    select jsonb_object_agg(a.attname, has_column_privilege('anon', 'public.reviews', a.attname, 'SELECT')
                            order by a.attname)
      from pg_attribute a
     where a.attrelid = 'public.reviews'::regclass and a.attnum > 0 and not a.attisdropped),
  'reviews_columns_visible_to_authenticated', (
    select jsonb_object_agg(a.attname, has_column_privilege('authenticated', 'public.reviews', a.attname, 'SELECT')
                            order by a.attname)
      from pg_attribute a
     where a.attrelid = 'public.reviews'::regclass and a.attnum > 0 and not a.attisdropped),
  'media_columns_visible_to_anon', (
    select jsonb_object_agg(a.attname, has_column_privilege('anon', 'public.review_media', a.attname, 'SELECT')
                            order by a.attname)
      from pg_attribute a
     where a.attrelid = 'public.review_media'::regclass and a.attnum > 0 and not a.attisdropped),
  'media_columns_visible_to_authenticated', (
    select jsonb_object_agg(a.attname, has_column_privilege('authenticated', 'public.review_media', a.attname, 'SELECT')
                            order by a.attname)
      from pg_attribute a
     where a.attrelid = 'public.review_media'::regclass and a.attnum > 0 and not a.attisdropped),

  'table_level_select', (
    select jsonb_object_agg(t.tbl || ' / ' || r.role, has_table_privilege(r.role, 'public.' || t.tbl, 'SELECT'))
      from (values ('reviews'), ('review_media')) t(tbl)
      cross join (values ('anon'), ('authenticated')) r(role)),

  'can_write', (
    select jsonb_object_agg(t.tbl || ' / ' || r.role,
             jsonb_build_object(
               'insert', has_table_privilege(r.role, 'public.' || t.tbl, 'INSERT'),
               'update', has_table_privilege(r.role, 'public.' || t.tbl, 'UPDATE'),
               'delete', has_table_privilege(r.role, 'public.' || t.tbl, 'DELETE')))
      from (values ('reviews'), ('review_media'), ('review_upload_log')) t(tbl)
      cross join (values ('anon'), ('authenticated')) r(role)),

  'upload_log_and_queue_closed', (
    select jsonb_object_agg(t.tbl || ' / ' || r.role, has_table_privilege(r.role, 'public.' || t.tbl, 'SELECT'))
      from (values ('review_upload_log'), ('cloudinary_cleanup_queue')) t(tbl)
      cross join (values ('anon'), ('authenticated')) r(role)),

  'policies', (
    select jsonb_object_agg(x.tablename, x.names)
      from (select tablename, jsonb_agg(policyname order by policyname) as names
              from pg_policies
             where schemaname = 'public' and tablename in ('reviews', 'review_media', 'review_upload_log')
             group by tablename) x),

  'functions', (
    select jsonb_object_agg(p.proname, jsonb_build_object(
             'security_definer', p.prosecdef,
             'anon_can_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
             'authenticated_can_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
             'public_can_execute', (p.proacl is null or exists (
                select 1 from aclexplode(p.proacl) x where x.grantee = 0 and x.privilege_type = 'EXECUTE'))))
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('reserve_review_upload', 'submit_review', 'edit_my_review', 'delete_my_review',
                         'my_review_state', 'product_review_summary', 'admin_list_reviews',
                         'admin_get_review', 'admin_moderate_review', 'admin_delete_review',
                         'admin_remove_review_media', 'recalc_product_rating', 'reviews_sync_rating',
                         'review_media_sync_count', 'review_order_for', 'review_author_name',
                         'review_validate_media', 'review_clean_text', 'queue_orphan_review_uploads')),

  'claim_cleanup_batch', (
    select jsonb_build_object(
             'returns', pg_get_function_result(p.oid),
             'service_role_can_execute', has_function_privilege('service_role', p.oid, 'EXECUTE'),
             'authenticated_can_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
             'anon_can_execute', has_function_privilege('anon', p.oid, 'EXECUTE'))
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname = 'claim_cleanup_batch'),

  'queue_resource_type', (
    select jsonb_build_object('exists', true, 'default', column_default)
      from information_schema.columns
     where table_schema = 'public' and table_name = 'cloudinary_cleanup_queue'
       and column_name = 'resource_type'),

  'triggers', (
    select jsonb_agg(tgname order by tgname)
      from pg_trigger
     where not tgisinternal
       and tgname in ('reviews_updated_at', 'reviews_sync_rating', 'review_media_sync_count',
                      'cloudinary_queue_review_media', 'cloudinary_queue_product_images',
                      'cloudinary_queue_categories', 'cloudinary_queue_site_banners')),

  'audit_function_skips_rating', (
    select p.prosrc like '%rating_avg%'
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname = 'log_admin_change'),

  'indexes', (
    select jsonb_object_agg(i.name, exists (
             select 1 from pg_indexes where schemaname = 'public' and indexname = i.name))
      from (values ('reviews_product_approved_idx'), ('reviews_product_rating_idx'), ('reviews_status_idx'),
                   ('review_media_review_idx'), ('review_upload_log_user_idx')) i(name)),

  'constraints', (
    select jsonb_object_agg(k.name, exists (select 1 from pg_constraint where conname = k.name))
      from (values ('reviews_product_user_key'), ('reviews_rating_check'), ('reviews_title_check'),
                   ('reviews_comment_check'), ('reviews_status_check'), ('reviews_media_count_check'),
                   ('review_media_public_id_key'), ('review_media_media_type_check'),
                   ('review_media_url_check'), ('review_media_public_id_check'),
                   ('review_upload_log_public_id_key'),
                   ('cloudinary_cleanup_queue_public_id_check'),
                   ('cloudinary_cleanup_queue_resource_type_check')) k(name))
)) as reviews_check_a;
