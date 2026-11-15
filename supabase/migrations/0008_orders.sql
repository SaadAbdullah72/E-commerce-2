-- =============================================================================
-- 0008_orders.sql
-- Orders, order lines and coupon redemptions (the tables behind Stripe checkout).
--
-- Design rules
--   * Browsers can only READ their own orders. Every write goes through the
--     SECURITY DEFINER functions in 0009 (or the service role used by Edge
--     Functions), so prices, stock and totals can never be chosen by the customer.
--   * Orders keep a SNAPSHOT of what was bought (title, price, address), so later
--     edits to a product or profile never change a past order.
--   * order_items.product_id is ON DELETE RESTRICT: a product that has ever been
--     ordered can never be deleted (this is what blocks the admin Delete button).
--   * coupon_redemptions.coupon_id is ON DELETE RESTRICT, for the same reason.
-- Needs 0001 to 0007.
-- =============================================================================

create sequence public.order_number_seq start 1001;
revoke all on sequence public.order_number_seq from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- orders
-- -----------------------------------------------------------------------------
create table public.orders (
  id                        uuid         not null default gen_random_uuid(),
  order_number              text         not null
                              default ('SY-' || lpad(nextval('public.order_number_seq')::text, 6, '0')),
  user_id                   uuid         not null,
  status                    text         not null default 'pending_payment',
  cancel_reason             text,
  -- Money, in minor units (cents). TODO(market): currency follows the products.
  currency                  character(3) not null,
  subtotal_minor            integer      not null,
  discount_minor            integer      not null default 0,
  delivery_fee_minor        integer      not null default 0,
  total_minor               integer      not null,
  coupon_id                 uuid,
  coupon_code               text,
  -- Shipping snapshot.
  ship_name                 text         not null,
  ship_email                text         not null,
  ship_phone                text         not null,
  ship_address              text         not null,
  ship_state                text         not null,
  ship_city                 text         not null,
  ship_courier              text,
  ship_notes                text,
  tracking_number           text,
  -- Stripe.
  stripe_session_id         text,
  stripe_payment_intent_id  text,
  -- Set when money arrived that must be returned (paid after the order was
  -- cancelled, or the amount did not match). The payment webhook refunds it.
  payment_issue             text,
  -- Stock is held until this time while the customer pays.
  expires_at                timestamptz  not null,
  paid_at                   timestamptz,
  shipped_at                timestamptz,
  delivered_at              timestamptz,
  cancelled_at              timestamptz,
  created_at                timestamptz  not null default now(),
  updated_at                timestamptz  not null default now(),
  constraint orders_pkey primary key (id),
  constraint orders_order_number_key unique (order_number),
  constraint orders_stripe_session_id_key unique (stripe_session_id),
  constraint orders_stripe_payment_intent_id_key unique (stripe_payment_intent_id),
  constraint orders_user_id_fkey foreign key (user_id) references auth.users (id) on delete restrict,
  constraint orders_coupon_id_fkey foreign key (coupon_id) references public.coupons (id) on delete restrict,
  constraint orders_status_check
    check (status = any (array['pending_payment','paid','shipped','delivered','cancelled'])),
  constraint orders_cancel_reason_check
    check (cancel_reason is null or cancel_reason = any (array['expired','payment_failed','customer','error'])),
  constraint orders_cancel_consistency
    check ((status = 'cancelled') = (cancel_reason is not null)),
  constraint orders_payment_issue_check
    check (payment_issue is null or payment_issue = any (array['paid_after_cancel','amount_mismatch'])),
  constraint orders_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint orders_amounts_check
    check (subtotal_minor >= 0 and discount_minor >= 0 and delivery_fee_minor >= 0
           and discount_minor <= subtotal_minor and total_minor >= 0),
  constraint orders_total_check
    check (total_minor = subtotal_minor - discount_minor + delivery_fee_minor),
  constraint orders_ship_name_check    check (char_length(btrim(ship_name)) between 1 and 100),
  constraint orders_ship_email_check   check (char_length(ship_email) <= 254 and ship_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint orders_ship_phone_check   check (char_length(btrim(ship_phone)) between 5 and 32),
  constraint orders_ship_address_check check (char_length(btrim(ship_address)) between 5 and 300),
  constraint orders_ship_state_check   check (char_length(btrim(ship_state)) between 1 and 100),
  constraint orders_ship_city_check    check (char_length(btrim(ship_city)) between 1 and 100),
  constraint orders_ship_courier_check check (char_length(ship_courier) <= 100),
  constraint orders_ship_notes_check   check (char_length(ship_notes) <= 500),
  constraint orders_tracking_check     check (char_length(tracking_number) <= 100)
);

create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at desc);
-- Finds unpaid orders whose stock hold has run out.
create index orders_pending_expiry_idx on public.orders (expires_at) where status = 'pending_payment';

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.catalog_set_updated_at();

-- -----------------------------------------------------------------------------
-- order_items (one row per product + size + colour in an order)
-- -----------------------------------------------------------------------------
create table public.order_items (
  id               uuid    not null default gen_random_uuid(),
  order_id         uuid    not null,
  product_id       uuid    not null,
  title            text    not null,
  image_url        text,
  size             text,
  color            text,
  unit_price_minor integer not null,
  quantity         integer not null,
  line_total_minor integer not null,
  constraint order_items_pkey primary key (id),
  constraint order_items_order_id_fkey foreign key (order_id) references public.orders (id) on delete cascade,
  -- RESTRICT: an ordered product can never be deleted (deactivate it instead).
  constraint order_items_product_id_fkey foreign key (product_id) references public.products (id) on delete restrict,
  constraint order_items_quantity_check check (quantity between 1 and 99),
  constraint order_items_price_check check (unit_price_minor >= 0),
  constraint order_items_line_total_check check (line_total_minor = unit_price_minor * quantity)
);

create index order_items_order_idx   on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);
-- The same variant is one line, never two.
create unique index order_items_variant_key
  on public.order_items (order_id, product_id, coalesce(size, ''), coalesce(color, ''));

-- -----------------------------------------------------------------------------
-- coupon_redemptions (who used which coupon on which order)
-- Counts toward the coupon's limits while the order is pending or paid; the row
-- is removed again if the order is cancelled.
-- -----------------------------------------------------------------------------
create table public.coupon_redemptions (
  id         uuid        not null default gen_random_uuid(),
  coupon_id  uuid        not null,
  user_id    uuid        not null,
  order_id   uuid        not null,
  created_at timestamptz not null default now(),
  constraint coupon_redemptions_pkey primary key (id),
  constraint coupon_redemptions_order_id_key unique (order_id),
  constraint coupon_redemptions_coupon_id_fkey foreign key (coupon_id) references public.coupons (id) on delete restrict,
  constraint coupon_redemptions_user_id_fkey foreign key (user_id) references auth.users (id) on delete restrict,
  constraint coupon_redemptions_order_id_fkey foreign key (order_id) references public.orders (id) on delete cascade
);

create index coupon_redemptions_coupon_user_idx on public.coupon_redemptions (coupon_id, user_id);

-- -----------------------------------------------------------------------------
-- Row level security and grants
-- New tables get broad default grants from Supabase, so everything is revoked
-- first and only what is needed is granted back.
-- -----------------------------------------------------------------------------
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.coupon_redemptions enable row level security;

revoke all on table public.orders, public.order_items, public.coupon_redemptions
  from anon, authenticated;

-- Read only. No INSERT / UPDATE / DELETE grant exists for browsers on these tables.
grant select on table public.orders, public.order_items to authenticated;

-- A customer sees their own orders; an admin sees all of them.
create policy "orders: owner or admin read" on public.orders
  for select to authenticated
  using ((user_id = (select auth.uid())) or (select public.is_admin()));

-- Lines are visible exactly when their order is (orders' own policy decides).
create policy "order_items: read with order" on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id));

-- coupon_redemptions: RLS on, no policy, no grant. Server functions only.
