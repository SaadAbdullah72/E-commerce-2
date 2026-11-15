-- =============================================================================
-- 0006_admin_delete.sql
-- Lets admins permanently delete products, categories, coupons and banners.
-- Safety comes from the database itself:
--   * products   -> blocked later by a foreign key from order_items (added in the
--                   checkout migration; today no product has been ordered)
--   * categories -> blocked by the existing foreign key products.category_id
--                   (ON DELETE RESTRICT), including INACTIVE products
--   * coupons    -> blocked by the trigger below once used_count > 0
--   * banners    -> no restriction
-- Every delete is recorded in admin_audit_log by the existing audit triggers
-- (with the full removed row).
-- This replaces the earlier "pause only, never delete" rule noted in 0000.
-- Needs 0001 to 0004.
-- =============================================================================

-- Browsers need the DELETE privilege as well as a policy.
grant delete on table public.products,
                      public.categories,
                      public.coupons,
                      public.site_banners
  to authenticated;

create policy "products: admin delete" on public.products
  for delete to authenticated
  using (((select public.is_admin())));

create policy "categories: admin delete" on public.categories
  for delete to authenticated
  using (((select public.is_admin())));

create policy "coupons: admin delete" on public.coupons
  for delete to authenticated
  using (((select public.is_admin())));

create policy "site_banners: admin delete" on public.site_banners
  for delete to authenticated
  using (((select public.is_admin())));

-- A used coupon can never be deleted (past orders must stay accurate).
-- This guards the SQL editor too, not only the admin panel.
create or replace function public.coupons_delete_guard()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if old.used_count > 0 then
    raise exception 'A coupon that has been used cannot be deleted. Pause it instead.'
      using errcode = '23514';
  end if;
  return old;
end;
$function$;

create trigger coupons_delete_guard
  before delete on public.coupons
  for each row execute function public.coupons_delete_guard();
