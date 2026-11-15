-- =============================================================================
-- 0003_coupons_banners.sql
-- Coupons and site banners, their guard triggers, and row level security.
-- Needs 0001 (is_admin) and 0002 (catalog_set_updated_at).
-- Reconstructed from production on 2026-11-15. See 0000_baseline.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- coupons (admin only; customers cannot read them. Redemption arrives with checkout.)
-- -----------------------------------------------------------------------------
create table public.coupons (
  id                 uuid        not null default gen_random_uuid(),
  code               text        not null,
  discount_type      text        not null,
  percent_off        integer,
  amount_off_minor   integer,
  max_discount_minor integer,
  min_subtotal_minor integer     not null default 0,
  starts_at          timestamptz,
  expires_at         timestamptz,
  usage_limit        integer,
  per_user_limit     integer     not null default 1,
  used_count         integer     not null default 0,
  is_active          boolean     not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint coupons_pkey primary key (id),
  constraint coupons_code_key unique (code),
  constraint coupons_code_check check (code ~ '^[A-Z0-9_-]{3,30}$'),
  constraint coupons_type_check check (discount_type = any (array['percent'::text, 'fixed'::text])),
  constraint coupons_max_discount_check
    check (max_discount_minor is null or (max_discount_minor >= 1 and max_discount_minor <= 100000000)),
  constraint coupons_min_subtotal_check
    check (min_subtotal_minor >= 0 and min_subtotal_minor <= 100000000),
  constraint coupons_per_user_check check (per_user_limit >= 1 and per_user_limit <= 1000),
  constraint coupons_usage_limit_check
    check (usage_limit is null or (usage_limit >= 1 and usage_limit <= 1000000)),
  constraint coupons_used_count_check
    check (used_count >= 0 and (usage_limit is null or used_count <= usage_limit)),
  constraint coupons_value_matches_type check (
    (discount_type = 'percent' and (percent_off >= 1 and percent_off <= 100) and amount_off_minor is null)
    or
    (discount_type = 'fixed' and (amount_off_minor >= 1 and amount_off_minor <= 100000000)
       and percent_off is null and max_discount_minor is null)
  ),
  constraint coupons_window_check
    check (starts_at is null or expires_at is null or expires_at > starts_at)
);

-- Normalizes the code to UPPERCASE, stops browsers changing used_count, and freezes
-- the code and discount of a coupon that has been used (past orders must stay accurate).
create or replace function public.coupons_guard()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.code := upper(btrim(new.code));

  if tg_op = 'INSERT' then
    if current_user = 'authenticated' and new.used_count <> 0 then
      raise exception 'used_count is managed by the server' using errcode = '42501';
    end if;
  else
    if current_user = 'authenticated' and new.used_count is distinct from old.used_count then
      raise exception 'used_count is managed by the server' using errcode = '42501';
    end if;
    if old.used_count > 0 and (
         new.code               is distinct from old.code
      or new.discount_type      is distinct from old.discount_type
      or new.percent_off        is distinct from old.percent_off
      or new.amount_off_minor   is distinct from old.amount_off_minor
      or new.max_discount_minor is distinct from old.max_discount_minor
    ) then
      raise exception 'A coupon that has been used cannot change its code or discount. Pause it and create a new one.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$function$;

create trigger coupons_guard
  before insert or update on public.coupons
  for each row execute function public.coupons_guard();

create trigger coupons_updated_at
  before update on public.coupons
  for each row execute function public.catalog_set_updated_at();

-- -----------------------------------------------------------------------------
-- site_banners: hero slides and the announcement ticker
-- -----------------------------------------------------------------------------
create table public.site_banners (
  id              uuid        not null default gen_random_uuid(),
  kind            text        not null,
  badge           text,
  title           text        not null,
  subtitle        text,
  button_text     text,
  link_path       text,
  image_url       text,
  image_public_id text,
  theme           text        not null default 'ocean',
  sort_order      integer     not null default 0,
  is_active       boolean     not null default true,
  starts_at       timestamptz,
  ends_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint site_banners_pkey primary key (id),
  constraint site_banners_kind_check check (kind = any (array['hero'::text, 'announcement'::text])),
  constraint site_banners_announcement_shape check (
    kind = 'hero' or (badge is null and subtitle is null and button_text is null and image_url is null)
  ),
  constraint site_banners_badge_check check (badge is null or char_length(badge) <= 40),
  constraint site_banners_button_check check (button_text is null or char_length(button_text) <= 30),
  constraint site_banners_image_id_check check (
    image_public_id is null
    or (image_public_id like 'shopyaro/banners/%' and char_length(image_public_id) <= 255)
  ),
  constraint site_banners_image_pair_check check ((image_url is null) = (image_public_id is null)),
  constraint site_banners_image_url_check check (
    image_url is null
    or (image_url ~ '^https://res\.cloudinary\.com/[A-Za-z0-9_-]+/image/upload/' and char_length(image_url) <= 2048)
  ),
  -- Internal links only: must start with a single "/", no "//", limited characters.
  constraint site_banners_link_check check (
    link_path is null
    or (link_path ~ '^/[A-Za-z0-9/_?=&%.-]*$' and link_path !~ '//' and char_length(link_path) <= 200)
  ),
  constraint site_banners_sort_check check (sort_order >= 0 and sort_order <= 1000),
  constraint site_banners_subtitle_check check (subtitle is null or char_length(subtitle) <= 160),
  constraint site_banners_theme_check check (theme = any (array['ocean'::text, 'sunset'::text, 'midnight'::text])),
  constraint site_banners_title_check
    check (char_length(btrim(title)) >= 1 and char_length(btrim(title)) <= 120),
  constraint site_banners_window_check check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index site_banners_kind_order_idx on public.site_banners using btree (kind, sort_order);

-- At most 6 active hero slides and 10 active announcements. An advisory lock makes
-- two admins activating banners at the same moment unable to both slip past the limit.
create or replace function public.site_banners_limit()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_max   integer := case new.kind when 'hero' then 6 else 10 end;
  v_count integer;
begin
  if new.is_active then
    perform pg_advisory_xact_lock(hashtext('site_banners_limit'));
    select count(*) into v_count
    from public.site_banners
    where kind = new.kind and is_active and id <> new.id;
    if v_count >= v_max then
      raise exception 'Too many active % banners (limit %)', new.kind, v_max using errcode = '23514';
    end if;
  end if;
  return new;
end;
$function$;

create trigger site_banners_limit
  before insert or update on public.site_banners
  for each row execute function public.site_banners_limit();

create trigger site_banners_updated_at
  before update on public.site_banners
  for each row execute function public.catalog_set_updated_at();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.coupons      enable row level security;
alter table public.site_banners enable row level security;

-- coupons: admins only, and no DELETE policy (coupons are paused, never deleted)
create policy "coupons: admin read all" on public.coupons
  for select to authenticated using (((select public.is_admin())));
create policy "coupons: admin insert" on public.coupons
  for insert to authenticated with check (((select public.is_admin())));
create policy "coupons: admin update" on public.coupons
  for update to authenticated
  using (((select public.is_admin()))) with check (((select public.is_admin())));

-- site_banners: the public sees only live banners (active and inside their dates)
create policy "site_banners: public read live" on public.site_banners
  for select to anon, authenticated
  using (is_active
         and (starts_at is null or starts_at <= now())
         and (ends_at is null or ends_at > now()));
create policy "site_banners: admin read all" on public.site_banners
  for select to authenticated using (((select public.is_admin())));
create policy "site_banners: admin insert" on public.site_banners
  for insert to authenticated with check (((select public.is_admin())));
create policy "site_banners: admin update" on public.site_banners
  for update to authenticated
  using (((select public.is_admin()))) with check (((select public.is_admin())));

-- -----------------------------------------------------------------------------
-- Grants (as in production). Banners and coupons are never deleted: no DELETE grant.
-- -----------------------------------------------------------------------------
revoke all on table public.coupons, public.site_banners from anon, authenticated;

grant select, insert, update on table public.coupons      to authenticated;
grant select                 on table public.site_banners to anon;
grant select, insert, update on table public.site_banners to authenticated;

-- Banner seed rows are intentionally NOT included: they are editable content
-- (marketing claims), managed from Admin > Banners.
