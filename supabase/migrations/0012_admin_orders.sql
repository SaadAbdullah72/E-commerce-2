-- =============================================================================
-- 0012_admin_orders.sql
-- R7 (admin orders): hides the Stripe ids, and gives admins four things to work with orders.
--
--   1. Stripe ids are hidden from browsers. Customers (and admins) can still read every other
--      column of an order; stripe_session_id and stripe_payment_intent_id can only be read
--      through admin_get_order() below.
--   2. admin_get_order(order_id)          full order for the admin detail page, with Stripe ids.
--   3. admin_update_order(order_id, ...)  the ONLY way to ship / deliver an order or edit its
--                                         tracking number. Forward-only: paid -> shipped -> delivered.
--                                         Every change is written to the Activity log.
--   4. admin_order_stats()                order and revenue numbers for Analytics and Overview.
--
-- The orders LIST needs nothing special: admins already read all orders (policy from 0008), and
-- they filter and page through them with the same (created_at, id) cursor customers use.
-- Needs 0001, 0004, 0008, 0009, 0010.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Hide the Stripe ids
-- 0008 granted SELECT on the whole table. Replace it with a column list that leaves out the two
-- Stripe ids. payment_issue stays readable: it is only a flag ("paid_after_cancel" or
-- "amount_mismatch") and the admin list needs it for the "Needs refund" badge.
--
-- Consequence: "select *" on orders is now refused for browsers (permission denied), so always
-- name the columns. A column added to orders later is NOT readable until it is granted here.
-- Server functions (SECURITY DEFINER) and the service role are unaffected.
-- -----------------------------------------------------------------------------
revoke select on table public.orders from authenticated;

grant select (
  id, order_number, user_id, status, cancel_reason,
  currency, subtotal_minor, discount_minor, delivery_fee_minor, total_minor,
  coupon_id, coupon_code,
  ship_name, ship_email, ship_phone, ship_address, ship_state, ship_city, ship_courier, ship_notes,
  tracking_number, payment_issue,
  expires_at, paid_at, shipped_at, delivered_at, cancelled_at, created_at, updated_at
) on table public.orders to authenticated;

-- The admin "needs refund" filter.
create index orders_payment_issue_idx on public.orders (created_at desc)
  where payment_issue is not null;

-- -----------------------------------------------------------------------------
-- 2. admin_get_order: one order with everything, for the admin detail page
-- SECURITY DEFINER so it can read the hidden Stripe ids; it refuses anyone who is not an admin.
-- Returns null when the order does not exist.
-- -----------------------------------------------------------------------------
create or replace function public.admin_get_order(p_order_id uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  result jsonb;
begin
  if not (select public.is_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'cancel_reason', o.cancel_reason,
    'payment_issue', o.payment_issue,
    'currency', o.currency,
    'subtotal_minor', o.subtotal_minor,
    'discount_minor', o.discount_minor,
    'delivery_fee_minor', o.delivery_fee_minor,
    'total_minor', o.total_minor,
    'coupon_code', o.coupon_code,
    'user_id', o.user_id,
    'account_email', (select u.email from auth.users u where u.id = o.user_id),
    'ship_name', o.ship_name,
    'ship_email', o.ship_email,
    'ship_phone', o.ship_phone,
    'ship_address', o.ship_address,
    'ship_state', o.ship_state,
    'ship_city', o.ship_city,
    'ship_courier', o.ship_courier,
    'ship_notes', o.ship_notes,
    'tracking_number', o.tracking_number,
    'stripe_session_id', o.stripe_session_id,
    'stripe_payment_intent_id', o.stripe_payment_intent_id,
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
    into result
    from public.orders o
   where o.id = p_order_id;

  return result;
end $function$;

revoke all on function public.admin_get_order(uuid) from public, anon, authenticated;
grant execute on function public.admin_get_order(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. admin_update_order: ship, deliver, or edit the tracking number
--
--   p_status   null = leave the status alone, otherwise 'shipped' or 'delivered'.
--              Allowed moves: paid -> shipped, shipped -> delivered. Nothing else, and never
--              backwards. Asking for the status the order already has is a harmless no-op
--              (a double click does not fail and is not logged twice).
--   p_tracking null = leave the tracking number alone; blank = remove it; otherwise set it
--              (max 100 characters). Only orders that are paid, shipped or delivered have one.
--
-- Errors (errcode P0001 unless noted; DETAIL carries the current status):
--   invalid_transition  the status change is not allowed, or tracking on an unpaid/cancelled order
--   invalid_tracking    too long, or contains control characters
--   order_not_found     (P0002)
--   42501               not an admin
--
-- The order row is locked while it is changed, so two admins clicking at once cannot both win.
-- One Activity log entry is written per real change.
-- -----------------------------------------------------------------------------
create or replace function public.admin_update_order(
  p_order_id uuid, p_status text default null, p_tracking text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  o                  public.orders%rowtype;
  v_new_status       text;
  v_status_changed   boolean := false;
  v_tracking         text;
  v_tracking_changed boolean := false;
  v_old_tracking     text;
  v_diff             jsonb := '{}'::jsonb;
  v_summary          text;
begin
  if not (select public.is_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  v_new_status := o.status;
  if p_status is not null and p_status <> o.status then
    if not ((o.status = 'paid' and p_status = 'shipped')
         or (o.status = 'shipped' and p_status = 'delivered')) then
      raise exception 'invalid_transition' using errcode = 'P0001', detail = o.status;
    end if;
    v_new_status := p_status;
    v_status_changed := true;
  end if;

  if p_tracking is not null then
    v_tracking := nullif(btrim(p_tracking), '');
    if v_tracking is not null and (char_length(v_tracking) > 100 or v_tracking ~ '[[:cntrl:]]') then
      raise exception 'invalid_tracking' using errcode = 'P0001';
    end if;
    if v_new_status not in ('paid', 'shipped', 'delivered') then
      raise exception 'invalid_transition' using errcode = 'P0001', detail = o.status;
    end if;
    v_tracking_changed := v_tracking is distinct from o.tracking_number;
  end if;

  if v_status_changed or v_tracking_changed then
    v_old_tracking := o.tracking_number;
    update public.orders
       set status          = v_new_status,
           shipped_at      = case when v_status_changed and v_new_status = 'shipped'
                                  then now() else shipped_at end,
           delivered_at    = case when v_status_changed and v_new_status = 'delivered'
                                  then now() else delivered_at end,
           tracking_number = case when v_tracking_changed then v_tracking else tracking_number end
     where id = o.id
    returning * into o;

    if v_status_changed then
      v_diff := v_diff || jsonb_build_object('status',
        jsonb_build_object('from', case v_new_status when 'shipped' then 'paid' else 'shipped' end,
                           'to', v_new_status));
    end if;
    if v_tracking_changed then
      -- Only the tracking number is logged, never any other order detail.
      v_diff := v_diff || jsonb_build_object('tracking_number',
        jsonb_build_object('from', v_old_tracking, 'to', v_tracking));
    end if;

    v_summary := case
      when v_status_changed then 'Marked order ' || o.order_number || ' as ' || v_new_status
      when v_tracking is null then 'Removed the tracking number of order ' || o.order_number
      else 'Updated the tracking number of order ' || o.order_number
    end;
    if v_status_changed and v_tracking_changed then
      v_summary := v_summary || case
        when v_tracking is null then ' (tracking number removed)'
        else ' (tracking ' || v_tracking || ')' end;
    end if;

    insert into public.admin_audit_log
      (actor_id, actor_email, action, table_name, record_id, record_label, summary, changes)
    values
      (auth.uid(), auth.jwt() ->> 'email', 'update', 'orders', o.id::text, o.order_number,
       v_summary, v_diff);
  end if;

  return jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'tracking_number', o.tracking_number,
    'shipped_at', o.shipped_at,
    'delivered_at', o.delivered_at,
    'changed', v_status_changed or v_tracking_changed);
end $function$;

revoke all on function public.admin_update_order(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_update_order(uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. admin_order_stats: numbers for Analytics and Overview
-- SECURITY INVOKER (admins read every order through row level security), and it refuses
-- non-admins itself, like admin_catalog_stats().
--
-- "Revenue" = the amount charged (items minus discount plus delivery) on orders that are paid,
-- shipped or delivered, counted from the moment they were paid. It is GROSS: refunds are made by
-- hand in Stripe and are not subtracted. Amounts are kept per currency, never mixed.
-- 'daily' lists only days that had sales (UTC days); the page fills in the empty days.
-- -----------------------------------------------------------------------------
create or replace function public.admin_order_stats()
 returns jsonb
 language plpgsql
 stable
 set search_path to ''
as $function$
declare
  result jsonb;
begin
  if not (select public.is_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'by_status', jsonb_build_object(
      'pending_payment', count(*) filter (where status = 'pending_payment'),
      'paid',            count(*) filter (where status = 'paid'),
      'shipped',         count(*) filter (where status = 'shipped'),
      'delivered',       count(*) filter (where status = 'delivered'),
      'cancelled',       count(*) filter (where status = 'cancelled')),
    'to_ship',      count(*) filter (where status = 'paid'),
    'needs_refund', count(*) filter (where payment_issue is not null)
  ) into result
  from public.orders;

  result := result || jsonb_build_object(
    'revenue', coalesce((
      select jsonb_agg(jsonb_build_object(
               'currency', r.currency,
               'orders', r.n,
               'all_time_minor', r.total,
               'last_24h_minor', r.d1,
               'last_7d_minor', r.d7,
               'last_30d_minor', r.d30,
               'average_order_minor', (r.total / r.n)::bigint)
             order by r.currency)
        from (
          select currency,
                 count(*) as n,
                 sum(total_minor)::bigint as total,
                 coalesce(sum(total_minor) filter (where paid_at >= now() - interval '24 hours'), 0)::bigint as d1,
                 coalesce(sum(total_minor) filter (where paid_at >= now() - interval '7 days'), 0)::bigint as d7,
                 coalesce(sum(total_minor) filter (where paid_at >= now() - interval '30 days'), 0)::bigint as d30
            from public.orders
           where status in ('paid', 'shipped', 'delivered') and paid_at is not null
           group by currency
        ) r), '[]'::jsonb),

    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
               'day', d.day, 'currency', d.currency, 'orders', d.n, 'revenue_minor', d.rev)
             order by d.day, d.currency)
        from (
          select (paid_at at time zone 'UTC')::date as day, currency,
                 count(*) as n, sum(total_minor)::bigint as rev
            from public.orders
           where status in ('paid', 'shipped', 'delivered') and paid_at >= now() - interval '30 days'
           group by 1, 2
        ) d), '[]'::jsonb),

    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_id', t.product_id, 'title', t.title, 'currency', t.currency,
               'units', t.units, 'revenue_minor', t.rev)
             order by t.units desc, t.rev desc, t.title)
        from (
          select i.product_id, max(i.title) as title, o.currency,
                 sum(i.quantity)::bigint as units, sum(i.line_total_minor)::bigint as rev
            from public.order_items i
            join public.orders o on o.id = i.order_id
           where o.status in ('paid', 'shipped', 'delivered') and o.paid_at is not null
           group by i.product_id, o.currency
           order by units desc, rev desc, title
           limit 5
        ) t), '[]'::jsonb));

  return result;
end $function$;

revoke all on function public.admin_order_stats() from public, anon, authenticated;
grant execute on function public.admin_order_stats() to authenticated;
