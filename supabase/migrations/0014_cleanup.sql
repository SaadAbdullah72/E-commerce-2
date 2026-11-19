-- =============================================================================
-- 0014_cleanup.sql
-- Tidy-ups found while building the shop (listed in the notes of 0000_baseline.sql). Nothing here
-- changes what any customer or admin can do; it removes duplicates and closes doors that were
-- never meant to be open.
--
--   1. Drop the duplicate index on product_images
--   2. Drop the two redundant admin policies on categories and products
--   3. Take away EXECUTE on trigger functions (nobody can call them directly anyway)
--
-- NOT touched, on purpose: admin_select_all_profiles. The baseline notes call it redundant, but
-- the migrations show NO other admin read policy on profiles, so it is the one that lets admins
-- read profiles. check_a below proves this on the live database.
--
-- Safe to run once. It stops with an error (and changes nothing) if the database is not in the
-- state this file expects. Run it in the Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Duplicate index: product_images_product_idx and product_images_product_position_idx are
--    the same index (product_id, position). Keep the first, drop the second.
-- -----------------------------------------------------------------------------
do $$
declare
  v_keep text;
  v_drop text;
begin
  select indexdef into v_keep from pg_indexes
   where schemaname = 'public' and indexname = 'product_images_product_idx';
  select indexdef into v_drop from pg_indexes
   where schemaname = 'public' and indexname = 'product_images_product_position_idx';

  if v_drop is null then
    raise notice 'product_images_product_position_idx is already gone, nothing to do';
  elsif v_keep is null then
    raise exception 'product_images_product_idx is missing: refusing to drop the only index';
  elsif replace(v_keep, 'product_images_product_idx', 'X')
        <> replace(v_drop, 'product_images_product_position_idx', 'X') then
    raise exception 'the two product_images indexes are not identical: refusing to drop one';
  else
    drop index public.product_images_product_position_idx;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Redundant admin read policies. Each table already has "<table>: admin read all", which says
--    the same thing (and evaluates is_admin() once per query instead of once per row).
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'categories'
                and policyname = 'admin_select_all_categories') then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'categories'
                      and policyname = 'categories: admin read all') then
      raise exception 'categories: admin read all is missing: refusing to drop the other admin read policy';
    end if;
    drop policy admin_select_all_categories on public.categories;
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products'
                and policyname = 'admin_select_all_products') then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products'
                      and policyname = 'products: admin read all') then
      raise exception 'products: admin read all is missing: refusing to drop the other admin read policy';
    end if;
    drop policy admin_select_all_products on public.products;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Trigger functions. They return "trigger", so they cannot be called from SQL anyway, but they
--    kept the default EXECUTE for everyone. Postgres checks EXECUTE only when a trigger is CREATED,
--    not each time it fires, so the triggers keep working. (check_b proves it.)
-- -----------------------------------------------------------------------------
do $$
declare
  v_name text;
  v_oid  regprocedure;
begin
  foreach v_name in array array[
    'set_updated_at', 'catalog_set_updated_at', 'validate_product_colors', 'coupons_guard',
    'coupons_delete_guard', 'site_banners_limit', 'audit_log_immutable'
  ] loop
    v_oid := to_regprocedure('public.' || v_name || '()');
    if v_oid is null then
      raise notice 'public.%() does not exist, skipped', v_name;
    else
      execute format('revoke all on function %s from public, anon, authenticated', v_oid);
    end if;
  end loop;
end $$;
