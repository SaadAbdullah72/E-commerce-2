-- =============================================================================
-- 0009_order_functions.sql
-- Everything that creates or changes an order. All money, stock and coupon
-- decisions are made HERE, from database prices, never from what the browser sends.
--
-- Who may call what
--   signed-in customer : validate_coupon, place_order, cancel_my_order, get_my_order
--   service role only  : attach_stripe_session, mark_order_paid, release_order,
--                        release_expired_orders   (called by Edge Functions)
--   nobody directly    : delivery_fee_for, coupon_evaluate (helpers)
--
-- Error convention: failures raise errcode P0001 with a short code as the message
-- (invalid_cart, invalid_shipping, product_unavailable, insufficient_stock,
-- mixed_currency, too_many_pending, coupon_<reason>). For product problems the
-- DETAIL holds the product id. The app turns these codes into friendly text.
--
-- Flow:  place_order  -> (Stripe session created) -> attach_stripe_session
--        -> customer pays -> mark_order_paid          (webhook)
--        -> or session expires / is cancelled -> release_order  (stock + coupon returned)
-- Needs 0008.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Delivery fee. TODO(market): placeholder rule, mirrors client/src/shared/constants/market.js
-- (480 minor units everywhere except the Bauchi hub, which is free). Change here AND there.
-- -----------------------------------------------------------------------------
create or replace function public.delivery_fee_for(p_state text)
 returns integer
 language sql
 immutable
 set search_path to ''
as $function$
  select case when p_state = 'Bauchi State (Primary Local Hub)' then 0 else 480 end;
$function$;

-- -----------------------------------------------------------------------------
-- coupon_evaluate: the one place that decides whether a coupon applies and for how
-- much. p_lock = true locks the coupon row (used while placing an order).
-- Returns { ok: true, coupon_id, code, discount_minor }
--      or { ok: false, error: <reason>, min_subtotal_minor? }.
-- Reasons: not_found, not_started, expired, used_up, already_used, min_subtotal.
-- -----------------------------------------------------------------------------
create or replace function public.coupon_evaluate(
  p_code text, p_subtotal_minor integer, p_user uuid, p_lock boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_code     text := upper(btrim(coalesce(p_code, '')));
  c          public.coupons%rowtype;
  v_discount integer;
  v_uses     integer;
begin
  if v_code !~ '^[A-Z0-9_-]{3,30}$' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if p_lock then
    select * into c from public.coupons where code = v_code for update;
  else
    select * into c from public.coupons where code = v_code;
  end if;

  if not found or not c.is_active then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if c.starts_at is not null and c.starts_at > now() then
    return jsonb_build_object('ok', false, 'error', 'not_started');
  end if;
  if c.expires_at is not null and c.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    return jsonb_build_object('ok', false, 'error', 'used_up');
  end if;

  select count(*) into v_uses
  from public.coupon_redemptions r
  where r.coupon_id = c.id and r.user_id = p_user;
  if v_uses >= c.per_user_limit then
    return jsonb_build_object('ok', false, 'error', 'already_used');
  end if;

  if p_subtotal_minor < c.min_subtotal_minor then
    return jsonb_build_object('ok', false, 'error', 'min_subtotal',
                              'min_subtotal_minor', c.min_subtotal_minor);
  end if;

  if c.discount_type = 'percent' then
    v_discount := (p_subtotal_minor::bigint * c.percent_off / 100)::integer;
    if c.max_discount_minor is not null then
      v_discount := least(v_discount, c.max_discount_minor);
    end if;
  else
    v_discount := c.amount_off_minor;
  end if;
  v_discount := greatest(0, least(v_discount, p_subtotal_minor));

  return jsonb_build_object('ok', true, 'coupon_id', c.id, 'code', c.code,
                            'discount_minor', v_discount);
end $function$;

-- -----------------------------------------------------------------------------
-- validate_coupon: the "Apply" button at checkout. Only a preview; place_order
-- checks everything again. Does not reveal the coupon's id.
-- -----------------------------------------------------------------------------
create or replace function public.validate_coupon(p_code text, p_subtotal_minor integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Sign in to use a coupon' using errcode = '42501';
  end if;
  if p_subtotal_minor is null or p_subtotal_minor < 0 or p_subtotal_minor > 100000000 then
    raise exception 'invalid_cart' using errcode = 'P0001';
  end if;
  return public.coupon_evaluate(p_code, p_subtotal_minor, auth.uid(), false) - 'coupon_id';
end $function$;

-- -----------------------------------------------------------------------------
-- release_order: gives an UNPAID order's stock and coupon back and cancels it.
-- Safe to call twice (returns false when there was nothing to release).
-- -----------------------------------------------------------------------------
create or replace function public.release_order(p_order_id uuid, p_reason text)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  o public.orders%rowtype;
begin
  if p_reason is null or p_reason <> all (array['expired','payment_failed','customer','error']) then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found or o.status <> 'pending_payment' then
    return false;
  end if;

  -- Lock the products in a fixed order first, so two releases cannot deadlock.
  perform 1 from public.products
   where id in (select product_id from public.order_items where order_id = o.id)
   order by id for update;

  update public.products p
     set stock = p.stock + s.qty
    from (select product_id, sum(quantity)::integer as qty
            from public.order_items where order_id = o.id group by product_id) s
   where p.id = s.product_id;

  if o.coupon_id is not null then
    delete from public.coupon_redemptions where order_id = o.id;
    if found then
      update public.coupons set used_count = greatest(used_count - 1, 0) where id = o.coupon_id;
    end if;
  end if;

  update public.orders
     set status = 'cancelled', cancel_reason = p_reason, cancelled_at = now()
   where id = o.id;
  return true;
end $function$;

-- Releases unpaid orders whose hold ran out (plus a 10 minute grace for late payments).
create or replace function public.release_expired_orders(p_limit integer default 25)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select id from public.orders
     where status = 'pending_payment' and expires_at < now() - interval '10 minutes'
     order by expires_at
     limit greatest(1, least(coalesce(p_limit, 25), 100))
     for update skip locked
  loop
    if public.release_order(r.id, 'expired') then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end $function$;

-- -----------------------------------------------------------------------------
-- place_order: validates the cart against live data, reserves stock, applies the
-- coupon, and creates a pending_payment order. All or nothing (one transaction).
--
--   p_items    [{ "product_id": uuid, "size": text|null, "color": text|null, "quantity": 1..99 }, ...]
--   p_shipping { "full_name", "email", "phone", "address", "state", "city", "courier"?, "notes"? }
--   p_coupon_code optional
-- Returns { order_id, order_number, total_minor, currency, expires_at }.
-- -----------------------------------------------------------------------------
create or replace function public.place_order(
  p_items jsonb, p_shipping jsonb, p_coupon_code text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user     uuid := auth.uid();
  v_ship     jsonb := coalesce(p_shipping, '{}'::jsonb);
  v_name     text := btrim(coalesce(v_ship ->> 'full_name', ''));
  v_email    text := btrim(coalesce(v_ship ->> 'email', ''));
  v_phone    text := btrim(coalesce(v_ship ->> 'phone', ''));
  v_address  text := btrim(coalesce(v_ship ->> 'address', ''));
  v_state    text := btrim(coalesce(v_ship ->> 'state', ''));
  v_city     text := btrim(coalesce(v_ship ->> 'city', ''));
  v_courier  text := nullif(btrim(coalesce(v_ship ->> 'courier', '')), '');
  v_notes    text := nullif(btrim(coalesce(v_ship ->> 'notes', '')), '');
  v_lines    jsonb;
  l          record;
  p          public.products%rowtype;
  v_currency character(3);
  v_subtotal bigint := 0;
  v_discount integer := 0;
  v_delivery integer;
  v_coupon   jsonb;
  v_order    public.orders%rowtype;
begin
  if v_user is null then
    raise exception 'Sign in to place an order' using errcode = '42501';
  end if;

  -- Housekeeping: free the stock of old unpaid orders (no scheduler needed).
  perform public.release_expired_orders(25);

  -- ---- Shipping details ------------------------------------------------------
  if char_length(v_name) not between 1 and 100
     or char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or char_length(v_phone) not between 5 and 32
     or char_length(v_address) not between 5 and 300
     or char_length(v_state) not between 1 and 100
     or char_length(v_city) not between 1 and 100
     or char_length(v_courier) > 100
     or char_length(v_notes) > 500 then
    raise exception 'invalid_shipping' using errcode = 'P0001';
  end if;

  -- ---- Cart shape (never trust the browser) ----------------------------------
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 50
     or exists (
       select 1 from jsonb_array_elements(p_items) i
       where jsonb_typeof(i) <> 'object'
          or coalesce(i ->> 'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          or coalesce(i ->> 'quantity', '') !~ '^[1-9][0-9]?$'
     ) then
    raise exception 'invalid_cart' using errcode = 'P0001';
  end if;

  -- Same product + size + colour on two lines becomes one line.
  select jsonb_agg(
           jsonb_build_object('product_id', product_id, 'size', size, 'color', color, 'quantity', quantity)
           order by product_id, size nulls first, color nulls first)
    into v_lines
    from (
      select (i ->> 'product_id')::uuid                  as product_id,
             nullif(btrim(coalesce(i ->> 'size', '')), '')  as size,
             nullif(btrim(coalesce(i ->> 'color', '')), '') as color,
             sum((i ->> 'quantity')::integer)            as quantity
        from jsonb_array_elements(p_items) i
       group by 1, 2, 3
    ) g;

  -- Cap on unpaid orders, so nobody can hold all the stock.
  if (select count(*) from public.orders
       where user_id = v_user and status = 'pending_payment' and expires_at > now()) >= 3 then
    raise exception 'too_many_pending' using errcode = 'P0001';
  end if;

  -- ---- Pass 1: lock and check every product (in id order), price from the database
  for l in
    select * from jsonb_to_recordset(v_lines)
      as x(product_id uuid, size text, color text, quantity integer)
  loop
    -- Lines for the same variant were merged above; the merged total is capped too.
    if l.quantity > 99 then
      raise exception 'invalid_cart' using errcode = 'P0001';
    end if;

    select pr.* into p
      from public.products pr
      join public.categories c on c.id = pr.category_id
     where pr.id = l.product_id and pr.is_active and c.is_active
     for update of pr;
    if not found then
      raise exception 'product_unavailable' using errcode = 'P0001', detail = l.product_id::text;
    end if;

    -- The chosen size / colour must be one the product really offers.
    if cardinality(p.sizes) > 0 then
      if l.size is null or not (l.size = any (p.sizes)) then
        raise exception 'product_unavailable' using errcode = 'P0001', detail = l.product_id::text;
      end if;
    elsif l.size is not null then
      raise exception 'product_unavailable' using errcode = 'P0001', detail = l.product_id::text;
    end if;

    if jsonb_array_length(p.colors) > 0 then
      if l.color is null
         or not exists (select 1 from jsonb_array_elements(p.colors) k where k ->> 'name' = l.color) then
        raise exception 'product_unavailable' using errcode = 'P0001', detail = l.product_id::text;
      end if;
    elsif l.color is not null then
      raise exception 'product_unavailable' using errcode = 'P0001', detail = l.product_id::text;
    end if;

    if p.stock < l.quantity then
      raise exception 'insufficient_stock' using errcode = 'P0001', detail = l.product_id::text;
    end if;

    if v_currency is null then
      v_currency := p.currency;
    elsif v_currency <> p.currency then
      raise exception 'mixed_currency' using errcode = 'P0001';
    end if;

    v_subtotal := v_subtotal + p.price_minor::bigint * l.quantity;
  end loop;

  if v_subtotal > 100000000 then
    raise exception 'invalid_cart' using errcode = 'P0001';
  end if;

  -- ---- Coupon and delivery ----------------------------------------------------
  if nullif(btrim(coalesce(p_coupon_code, '')), '') is not null then
    v_coupon := public.coupon_evaluate(p_coupon_code, v_subtotal::integer, v_user, true);
    if (v_coupon ->> 'ok')::boolean is not true then
      raise exception 'coupon_%', v_coupon ->> 'error' using errcode = 'P0001';
    end if;
    v_discount := (v_coupon ->> 'discount_minor')::integer;
  end if;
  v_delivery := public.delivery_fee_for(v_state);

  -- ---- Create the order --------------------------------------------------------
  insert into public.orders (
    user_id, currency, subtotal_minor, discount_minor, delivery_fee_minor, total_minor,
    coupon_id, coupon_code,
    ship_name, ship_email, ship_phone, ship_address, ship_state, ship_city, ship_courier, ship_notes,
    expires_at
  ) values (
    v_user, v_currency, v_subtotal::integer, v_discount, v_delivery,
    v_subtotal::integer - v_discount + v_delivery,
    (v_coupon ->> 'coupon_id')::uuid, v_coupon ->> 'code',
    v_name, v_email, v_phone, v_address, v_state, v_city, v_courier, v_notes,
    now() + interval '31 minutes'   -- Stripe sessions last at least 30 minutes
  )
  returning * into v_order;

  -- ---- Pass 2: take the stock and write the lines ------------------------------
  for l in
    select * from jsonb_to_recordset(v_lines)
      as x(product_id uuid, size text, color text, quantity integer)
  loop
    -- Also guards two variants of one product that together exceed the stock.
    update public.products
       set stock = stock - l.quantity
     where id = l.product_id and stock >= l.quantity;
    if not found then
      raise exception 'insufficient_stock' using errcode = 'P0001', detail = l.product_id::text;
    end if;

    insert into public.order_items (
      order_id, product_id, title, image_url, size, color,
      unit_price_minor, quantity, line_total_minor)
    select v_order.id, pr.id, pr.title,
           (select pi.url from public.product_images pi
             where pi.product_id = pr.id order by pi."position" limit 1),
           l.size, l.color, pr.price_minor, l.quantity, pr.price_minor * l.quantity
      from public.products pr
     where pr.id = l.product_id;
  end loop;

  if v_coupon is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, order_id)
    values ((v_coupon ->> 'coupon_id')::uuid, v_user, v_order.id);
    -- coupons_guard only blocks browsers from changing used_count, not this function.
    update public.coupons set used_count = used_count + 1
     where id = (v_coupon ->> 'coupon_id')::uuid;
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'total_minor', v_order.total_minor,
    'currency', v_order.currency,
    'expires_at', v_order.expires_at);
end $function$;

-- -----------------------------------------------------------------------------
-- attach_stripe_session: remembers the Stripe Checkout session for an order and
-- aligns the stock hold with the session's own expiry.
-- -----------------------------------------------------------------------------
create or replace function public.attach_stripe_session(
  p_order_id uuid, p_session_id text, p_expires_at timestamptz)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  update public.orders
     set stripe_session_id = p_session_id,
         expires_at = greatest(p_expires_at, now() + interval '1 minute')
   where id = p_order_id and status = 'pending_payment' and stripe_session_id is null;
  return found;
end $function$;

-- -----------------------------------------------------------------------------
-- mark_order_paid: called by the Stripe webhook after a successful payment.
-- Idempotent (Stripe may send the same event twice). Never trusts the order alone:
-- the amount and currency Stripe reports must match the order.
-- Returns 'paid' | 'already_paid' | 'needs_refund'.
--   needs_refund = the money arrived but the order cannot be fulfilled (it was already
--   cancelled, or the amount differed). payment_issue is set so the webhook refunds it.
-- -----------------------------------------------------------------------------
create or replace function public.mark_order_paid(
  p_order_id uuid, p_session_id text, p_payment_intent text,
  p_amount_total integer, p_currency text)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if o.status in ('paid', 'shipped', 'delivered') then
    return 'already_paid';
  end if;
  if o.stripe_session_id is not null and p_session_id is distinct from o.stripe_session_id then
    raise exception 'session_mismatch' using errcode = 'P0001';
  end if;

  if p_amount_total is distinct from o.total_minor or lower(p_currency) <> lower(o.currency) then
    update public.orders
       set payment_issue = 'amount_mismatch', stripe_payment_intent_id = p_payment_intent
     where id = o.id;
    return 'needs_refund';
  end if;

  if o.status = 'cancelled' then
    update public.orders
       set payment_issue = 'paid_after_cancel', stripe_payment_intent_id = p_payment_intent
     where id = o.id;
    return 'needs_refund';
  end if;

  update public.orders
     set status = 'paid', paid_at = now(), stripe_payment_intent_id = p_payment_intent,
         payment_issue = null
   where id = o.id;
  return 'paid';
end $function$;

-- -----------------------------------------------------------------------------
-- cancel_my_order: the customer backs out of an UNPAID order (e.g. "Cancel" on the
-- Stripe page). Their stock and coupon are returned straight away.
-- -----------------------------------------------------------------------------
create or replace function public.cancel_my_order(p_order_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if not exists (select 1 from public.orders where id = p_order_id and user_id = auth.uid()) then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  return public.release_order(p_order_id, 'customer');
end $function$;

-- -----------------------------------------------------------------------------
-- get_my_order: one order with its lines, for the success page and My Orders.
-- SECURITY INVOKER on purpose: row level security decides who can see it, so a
-- customer gets only their own order (admins get any). Not found = null.
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

-- -----------------------------------------------------------------------------
-- Permissions. Functions are open to PUBLIC by default, so close everything first.
-- -----------------------------------------------------------------------------
revoke all on function public.delivery_fee_for(text)                              from public, anon, authenticated;
revoke all on function public.coupon_evaluate(text, integer, uuid, boolean)       from public, anon, authenticated;
revoke all on function public.validate_coupon(text, integer)                      from public, anon, authenticated;
revoke all on function public.place_order(jsonb, jsonb, text)                     from public, anon, authenticated;
revoke all on function public.cancel_my_order(uuid)                               from public, anon, authenticated;
revoke all on function public.get_my_order(uuid)                                  from public, anon, authenticated;
revoke all on function public.attach_stripe_session(uuid, text, timestamptz)      from public, anon, authenticated;
revoke all on function public.mark_order_paid(uuid, text, text, integer, text)    from public, anon, authenticated;
revoke all on function public.release_order(uuid, text)                           from public, anon, authenticated;
revoke all on function public.release_expired_orders(integer)                     from public, anon, authenticated;

-- Signed-in customers (never anonymous visitors).
grant execute on function public.validate_coupon(text, integer)   to authenticated;
grant execute on function public.place_order(jsonb, jsonb, text)  to authenticated;
grant execute on function public.cancel_my_order(uuid)            to authenticated;
grant execute on function public.get_my_order(uuid)               to authenticated;

-- Edge Functions only (service role).
grant execute on function public.attach_stripe_session(uuid, text, timestamptz)   to service_role;
grant execute on function public.mark_order_paid(uuid, text, text, integer, text) to service_role;
grant execute on function public.release_order(uuid, text)                        to service_role;
grant execute on function public.release_expired_orders(integer)                  to service_role;
