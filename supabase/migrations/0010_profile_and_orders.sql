-- =============================================================================
-- 0010_profile_and_orders.sql
-- R6 (customer account): lets a customer edit their own profile, adds a default shipping
-- address, and gives get_my_order the dates a status timeline needs.
--
--   1. profiles gets default_address / default_city / default_state.
--   2. Customers may UPDATE only their OWN row, and only five columns:
--        full_name, phone, default_address, default_city, default_state
--      Everything else (id, avatar_url, terms_accepted_at, terms_version, created_at,
--      updated_at) stays closed: a column-level grant means the database refuses the change
--      even if someone calls the API directly. Roles are in user_roles and are not touched.
--   3. get_my_order also returns shipped_at, delivered_at, cancelled_at and expires_at.
--      shipped_at / delivered_at stay empty until the admin orders phase (R7) fills them.
--
-- The orders LIST needs nothing new: row level security already shows a customer only their
-- own orders (0008), and the list pages through them with a (created_at, id) cursor.
-- Needs 0001, 0008 and 0009.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Default shipping address
-- -----------------------------------------------------------------------------
-- Empty means "none": the app sends NULL, never an empty string.
alter table public.profiles
  add column default_address text,
  add column default_city    text,
  add column default_state   text,
  add constraint profiles_default_address_check
    check (default_address is null or char_length(btrim(default_address)) between 1 and 300),
  add constraint profiles_default_city_check
    check (default_city is null or char_length(btrim(default_city)) between 1 and 100),
  add constraint profiles_default_state_check
    check (default_state is null or char_length(btrim(default_state)) between 1 and 100);

-- -----------------------------------------------------------------------------
-- 2. A customer edits their own profile (five columns only)
-- Until now "authenticated" had SELECT only, and there was no update policy.
-- full_name and phone are already length-checked by 0001's constraints.
-- -----------------------------------------------------------------------------
grant update (full_name, phone, default_address, default_city, default_state)
  on table public.profiles to authenticated;

create policy "profiles: update own row" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- updated_at is kept current by the existing profiles_updated_at trigger.

-- -----------------------------------------------------------------------------
-- 3. get_my_order: add the dates for a status timeline
-- Same signature as 0009, so this replaces the function in place (grants are kept; they
-- are restated below anyway). Still SECURITY INVOKER: row level security decides who can
-- see an order.
-- -----------------------------------------------------------------------------
create or replace function public.get_my_order(p_order_id uuid)
 returns jsonb
 language sql
 stable
 security invoker
 set search_path to ''
as $function$
  select jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'currency', o.currency,
    'subtotal_minor', o.subtotal_minor,
    'discount_minor', o.discount_minor,
    'delivery_fee_minor', o.delivery_fee_minor,
    'total_minor', o.total_minor,
    'coupon_code', o.coupon_code,
    'ship_name', o.ship_name,
    'ship_email', o.ship_email,
    'ship_phone', o.ship_phone,
    'ship_address', o.ship_address,
    'ship_state', o.ship_state,
    'ship_city', o.ship_city,
    'ship_courier', o.ship_courier,
    'tracking_number', o.tracking_number,
    'created_at', o.created_at,
    'paid_at', o.paid_at,
    'shipped_at', o.shipped_at,
    'delivered_at', o.delivered_at,
    'cancelled_at', o.cancelled_at,
    'expires_at', o.expires_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_id', i.product_id, 'title', i.title, 'image_url', i.image_url,
               'size', i.size, 'color', i.color, 'unit_price_minor', i.unit_price_minor,
               'quantity', i.quantity, 'line_total_minor', i.line_total_minor)
             order by i.title)
        from public.order_items i where i.order_id = o.id), '[]'::jsonb))
  from public.orders o
  where o.id = p_order_id;
$function$;

revoke all on function public.get_my_order(uuid) from public, anon, authenticated;
grant execute on function public.get_my_order(uuid) to authenticated;
