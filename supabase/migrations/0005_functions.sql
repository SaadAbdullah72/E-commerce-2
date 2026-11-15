-- =============================================================================
-- 0005_functions.sql
-- Admin analytics: admin_catalog_stats().
-- (The other functions live with the tables they belong to: is_admin and
-- handle_new_user in 0001, admin_save_product and validate_product_colors in 0002,
-- the coupon/banner guards in 0003, the audit functions in 0004.)
-- Needs 0001, 0002 (and reads profiles/user_roles).
-- Reconstructed from production on 2026-11-15. See 0000_baseline.sql.
-- =============================================================================

-- Real catalog and customer numbers for the Analytics page. SECURITY INVOKER, so the
-- admin-only read policies still apply, and it also refuses non-admins itself.
create or replace function public.admin_catalog_stats()
 returns jsonb
 language plpgsql
 stable
 set search_path to ''
as $function$
declare
  low_threshold constant int := 5;
  result jsonb;
begin
  if not (select public.is_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'products', jsonb_build_object(
      'total',    count(*),
      'active',   count(*) filter (where is_active),
      'inactive', count(*) filter (where not is_active)),
    'stock', jsonb_build_object(
      'out_of_stock', count(*) filter (where is_active and stock = 0),
      'low',          count(*) filter (where is_active and stock between 1 and low_threshold),
      'healthy',      count(*) filter (where is_active and stock > low_threshold)),
    'inventory_value_minor',
      coalesce(sum(price_minor::bigint * stock) filter (where is_active), 0)
  ) into result
  from public.products;

  result := result || jsonb_build_object(
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name,
               'active', coalesce(p.active, 0), 'inactive', coalesce(p.inactive, 0))
             order by coalesce(p.active, 0) desc, c.name)
      from public.categories c
      left join (
        select category_id,
               count(*) filter (where is_active)     as active,
               count(*) filter (where not is_active) as inactive
        from public.products group by category_id) p on p.category_id = c.id
    ), '[]'::jsonb),

    'customers', (
      select count(*) from public.profiles pr
      where not exists (select 1 from public.user_roles r
                        where r.user_id = pr.id and r.role = 'admin')),

    'signups_30d', (
      select jsonb_agg(jsonb_build_object('day', d::date, 'count', coalesce(n.cnt, 0)) order by d)
      from generate_series(current_date - 29, current_date, interval '1 day') d
      left join (
        select (created_at at time zone 'utc')::date as day, count(*) as cnt
        from public.profiles pr
        where not exists (select 1 from public.user_roles r
                          where r.user_id = pr.id and r.role = 'admin')
        group by 1) n on n.day = d::date)
  );
  return result;
end $function$;

-- Signed-in users only; the function then checks is_admin() itself.
revoke all on function public.admin_catalog_stats() from public, anon;
grant execute on function public.admin_catalog_stats() to authenticated;
