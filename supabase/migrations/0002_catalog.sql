-- =============================================================================
-- 0002_catalog.sql
-- Catalog: categories, deal_tags, products, product_images, product_deal_tags,
-- their triggers and policies, and the admin_save_product() function.
-- Needs 0001 (is_admin).
-- Reconstructed from production on 2026-11-15. See 0000_baseline.sql.
-- =============================================================================

-- Shared "touch updated_at" function for catalog tables (also used in 0003).
create or replace function public.catalog_set_updated_at()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  new.updated_at := now();
  return new;
end $function$;

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
create table public.categories (
  id             uuid        not null default gen_random_uuid(),
  name           text        not null,
  slug           text        not null,
  icon_url       text,
  icon_public_id text,
  sort_order     integer     not null default 0,
  is_active      boolean     not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint categories_pkey primary key (id),
  constraint categories_slug_key unique (slug),
  constraint categories_name_check
    check (char_length(btrim(name)) >= 1 and char_length(btrim(name)) <= 80),
  constraint categories_slug_check
    check (char_length(slug) <= 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint categories_icon_url_check
    check (icon_url ~ '^https://res\.cloudinary\.com/[A-Za-z0-9_-]+/image/upload/' and char_length(icon_url) <= 2048),
  constraint categories_icon_public_id_check check (char_length(icon_public_id) <= 255)
);

create unique index categories_name_lower_key on public.categories using btree (lower(name));

-- -----------------------------------------------------------------------------
-- deal_tags
-- -----------------------------------------------------------------------------
create table public.deal_tags (
  id         uuid    not null default gen_random_uuid(),
  name       text    not null,
  slug       text    not null,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  constraint deal_tags_pkey primary key (id),
  constraint deal_tags_name_key unique (name),
  constraint deal_tags_slug_key unique (slug),
  constraint deal_tags_name_check
    check (char_length(btrim(name)) >= 1 and char_length(btrim(name)) <= 60),
  constraint deal_tags_slug_check
    check (char_length(slug) <= 60 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- -----------------------------------------------------------------------------
-- products (prices are whole minor units, e.g. cents)
-- -----------------------------------------------------------------------------
create table public.products (
  id                     uuid          not null default gen_random_uuid(),
  slug                   text          not null,
  title                  text          not null,
  description            text,
  category_id            uuid          not null,
  price_minor            integer       not null,
  compare_at_price_minor integer,
  currency               character(3)  not null default 'USD',
  stock                  integer       not null default 0,
  sizes                  text[]        not null default '{}'::text[],
  colors                 jsonb         not null default '[]'::jsonb,
  is_active              boolean       not null default true,
  is_flash_deal          boolean       not null default false,
  flash_ends_at          timestamptz,
  rating_avg             numeric(2,1)  not null default 0,
  rating_count           integer       not null default 0,
  created_at             timestamptz   not null default now(),
  updated_at             timestamptz   not null default now(),
  constraint products_pkey primary key (id),
  constraint products_slug_key unique (slug),
  constraint products_category_id_fkey foreign key (category_id) references public.categories (id) on delete restrict,
  constraint products_title_check
    check (char_length(btrim(title)) >= 1 and char_length(btrim(title)) <= 200),
  constraint products_slug_check
    check (char_length(slug) <= 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint products_description_check check (char_length(description) <= 5000),
  constraint products_price_minor_check check (price_minor >= 0 and price_minor <= 100000000),
  constraint products_compare_at_price_minor_check
    check (compare_at_price_minor >= 0 and compare_at_price_minor <= 100000000),
  constraint products_compare_price_ok
    check (compare_at_price_minor is null or compare_at_price_minor >= price_minor),
  constraint products_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint products_stock_check check (stock >= 0),
  constraint products_sizes_check
    check (cardinality(sizes) <= 20 and char_length(array_to_string(sizes, ',')) <= 200),
  constraint products_flash_end_needs_flash check (flash_ends_at is null or is_flash_deal),
  constraint products_rating_avg_check check (rating_avg >= 0 and rating_avg <= 5),
  constraint products_rating_count_check check (rating_count >= 0)
);

create index products_active_created_idx on public.products using btree (is_active, created_at desc);
create index products_category_idx       on public.products using btree (category_id);

-- Checks the shape of the colors JSON: up to 20 items, each { name, hex }.
create or replace function public.validate_product_colors()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare c jsonb;
begin
  if jsonb_typeof(new.colors) <> 'array' or jsonb_array_length(new.colors) > 20 then
    raise exception 'colors must be an array of at most 20 items';
  end if;
  for c in select * from jsonb_array_elements(new.colors) loop
    if jsonb_typeof(c) <> 'object'
       or jsonb_typeof(c -> 'name') is distinct from 'string'
       or char_length(c ->> 'name') not between 1 and 40
       or (c ->> 'hex') is null
       or (c ->> 'hex') !~ '^#[0-9A-Fa-f]{6}$' then
      raise exception 'each color needs a name (1-40 chars) and a hex like #FF0000';
    end if;
  end loop;
  return new;
end $function$;

-- -----------------------------------------------------------------------------
-- product_images / product_deal_tags
-- -----------------------------------------------------------------------------
create table public.product_images (
  id         uuid        not null default gen_random_uuid(),
  product_id uuid        not null,
  url        text        not null,
  public_id  text        not null,
  alt        text,
  position   integer     not null default 0,
  created_at timestamptz not null default now(),
  constraint product_images_pkey primary key (id),
  constraint product_images_product_id_fkey foreign key (product_id) references public.products (id) on delete cascade,
  constraint product_images_alt_check check (char_length(alt) <= 200),
  constraint product_images_position_check check ("position" >= 0),
  constraint product_images_public_id_check
    check (char_length(public_id) >= 1 and char_length(public_id) <= 255),
  constraint product_images_url_check
    check (url ~ '^https://res\.cloudinary\.com/[A-Za-z0-9_-]+/image/upload/' and char_length(url) <= 2048)
);

-- NOTE: these two indexes are identical in production (see 0000_baseline.sql). Kept as-is.
create index product_images_product_idx          on public.product_images using btree (product_id, "position");
create index product_images_product_position_idx on public.product_images using btree (product_id, "position");

create table public.product_deal_tags (
  product_id  uuid not null,
  deal_tag_id uuid not null,
  constraint product_deal_tags_pkey primary key (product_id, deal_tag_id),
  constraint product_deal_tags_product_id_fkey foreign key (product_id) references public.products (id) on delete cascade,
  constraint product_deal_tags_deal_tag_id_fkey foreign key (deal_tag_id) references public.deal_tags (id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger categories_updated_at
  before update on public.categories
  for each row execute function public.catalog_set_updated_at();

create trigger products_updated_at
  before update on public.products
  for each row execute function public.catalog_set_updated_at();

create trigger products_validate_colors
  before insert or update of colors on public.products
  for each row execute function public.validate_product_colors();

-- -----------------------------------------------------------------------------
-- Row level security
-- Public sees only active rows. Admins see and change everything, but nothing is
-- ever deleted: products, categories and deal tags have no DELETE policy.
-- (Images and tag links can be deleted: the save function replaces them as a set.)
-- -----------------------------------------------------------------------------
alter table public.categories        enable row level security;
alter table public.deal_tags         enable row level security;
alter table public.products          enable row level security;
alter table public.product_images    enable row level security;
alter table public.product_deal_tags enable row level security;

-- categories
create policy "categories: public read active" on public.categories
  for select to anon, authenticated using (is_active);
create policy "categories: admin read all" on public.categories
  for select to authenticated using (((select public.is_admin())));
create policy admin_select_all_categories on public.categories     -- redundant, see baseline note
  for select to authenticated using (public.is_admin());
create policy "categories: admin insert" on public.categories
  for insert to authenticated with check (((select public.is_admin())));
create policy "categories: admin update" on public.categories
  for update to authenticated
  using (((select public.is_admin()))) with check (((select public.is_admin())));

-- deal_tags
create policy "deal_tags: public read active" on public.deal_tags
  for select to anon, authenticated using (is_active);
create policy "deal_tags: admin read all" on public.deal_tags
  for select to authenticated using (((select public.is_admin())));
create policy "deal_tags: admin insert" on public.deal_tags
  for insert to authenticated with check (((select public.is_admin())));
create policy "deal_tags: admin update" on public.deal_tags
  for update to authenticated
  using (((select public.is_admin()))) with check (((select public.is_admin())));

-- products
create policy "products: public read active" on public.products
  for select to anon, authenticated using (is_active);
create policy "products: admin read all" on public.products
  for select to authenticated using (((select public.is_admin())));
create policy admin_select_all_products on public.products           -- redundant, see baseline note
  for select to authenticated using (public.is_admin());
create policy "products: admin insert" on public.products
  for insert to authenticated with check (((select public.is_admin())));
create policy "products: admin update" on public.products
  for update to authenticated
  using (((select public.is_admin()))) with check (((select public.is_admin())));

-- product_images (public can read the images of active products)
create policy "product_images: public read" on public.product_images
  for select to anon, authenticated
  using (exists (select 1 from public.products p
                 where p.id = product_images.product_id and p.is_active));
create policy "product_images: admin read all" on public.product_images
  for select to authenticated using (((select public.is_admin())));
create policy "product_images: admin insert" on public.product_images
  for insert to authenticated with check (((select public.is_admin())));
create policy "product_images: admin update" on public.product_images
  for update to authenticated
  using (((select public.is_admin()))) with check (((select public.is_admin())));
create policy "product_images: admin delete" on public.product_images
  for delete to authenticated using (((select public.is_admin())));

-- product_deal_tags
create policy "product_deal_tags: public read" on public.product_deal_tags
  for select to anon, authenticated
  using (exists (select 1 from public.products p
                 where p.id = product_deal_tags.product_id and p.is_active));
create policy "product_deal_tags: admin read all" on public.product_deal_tags
  for select to authenticated using (((select public.is_admin())));
create policy "product_deal_tags: admin insert" on public.product_deal_tags
  for insert to authenticated with check (((select public.is_admin())));
create policy "product_deal_tags: admin delete" on public.product_deal_tags
  for delete to authenticated using (((select public.is_admin())));

-- -----------------------------------------------------------------------------
-- Grants (as in production). Note: product_deal_tags has UPDATE granted but no
-- UPDATE policy, so it cannot be used.
-- -----------------------------------------------------------------------------
revoke all on table public.categories, public.deal_tags, public.products,
                    public.product_images, public.product_deal_tags
  from anon, authenticated;

grant select on table public.categories        to anon;
grant select on table public.deal_tags         to anon;
grant select on table public.products          to anon;
grant select on table public.product_images    to anon;
grant select on table public.product_deal_tags to anon;

grant select, insert, update         on table public.categories        to authenticated;
grant select, insert, update         on table public.deal_tags         to authenticated;
grant select, insert, update         on table public.products          to authenticated;
grant select, insert, update, delete on table public.product_images    to authenticated;
grant select, insert, update, delete on table public.product_deal_tags to authenticated;

-- -----------------------------------------------------------------------------
-- admin_save_product(): saves a product, its images and its deal tags in ONE
-- transaction. SECURITY INVOKER on purpose: the table policies above still apply,
-- and the function also refuses non-admins itself.
-- -----------------------------------------------------------------------------
create or replace function public.admin_save_product(p_id uuid, p_payload jsonb)
 returns uuid
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_id      uuid;
  v_images  jsonb := coalesce(p_payload -> 'images', '[]'::jsonb);
  v_tag_ids jsonb := coalesce(p_payload -> 'deal_tag_ids', '[]'::jsonb);
  v_sizes   text[];
  v_image   jsonb;
  v_position int := 0;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid product data' using errcode = '22023';
  end if;
  if jsonb_typeof(v_images) <> 'array' or jsonb_array_length(v_images) > 8 then
    raise exception 'A product can have at most 8 images' using errcode = '22023';
  end if;
  if jsonb_typeof(v_tag_ids) <> 'array' or jsonb_array_length(v_tag_ids) > 20 then
    raise exception 'Invalid deal tags' using errcode = '22023';
  end if;

  v_sizes := coalesce(
    array(select jsonb_array_elements_text(coalesce(p_payload -> 'sizes', '[]'::jsonb))),
    '{}'::text[]
  );

  if p_id is null then
    insert into public.products (
      slug, title, description, category_id, price_minor, compare_at_price_minor,
      currency, stock, sizes, colors, is_active, is_flash_deal, flash_ends_at
    ) values (
      p_payload ->> 'slug',
      btrim(p_payload ->> 'title'),
      nullif(btrim(coalesce(p_payload ->> 'description', '')), ''),
      (p_payload ->> 'category_id')::uuid,
      (p_payload ->> 'price_minor')::int,
      (p_payload ->> 'compare_at_price_minor')::int,
      coalesce(p_payload ->> 'currency', 'USD'),
      coalesce((p_payload ->> 'stock')::int, 0),
      v_sizes,
      coalesce(p_payload -> 'colors', '[]'::jsonb),
      coalesce((p_payload ->> 'is_active')::boolean, true),
      coalesce((p_payload ->> 'is_flash_deal')::boolean, false),
      (p_payload ->> 'flash_ends_at')::timestamptz
    )
    returning id into v_id;
  else
    update public.products set
      slug                   = p_payload ->> 'slug',
      title                  = btrim(p_payload ->> 'title'),
      description            = nullif(btrim(coalesce(p_payload ->> 'description', '')), ''),
      category_id            = (p_payload ->> 'category_id')::uuid,
      price_minor            = (p_payload ->> 'price_minor')::int,
      compare_at_price_minor = (p_payload ->> 'compare_at_price_minor')::int,
      currency               = coalesce(p_payload ->> 'currency', 'USD'),
      stock                  = coalesce((p_payload ->> 'stock')::int, 0),
      sizes                  = v_sizes,
      colors                 = coalesce(p_payload -> 'colors', '[]'::jsonb),
      is_active              = coalesce((p_payload ->> 'is_active')::boolean, true),
      is_flash_deal          = coalesce((p_payload ->> 'is_flash_deal')::boolean, false),
      flash_ends_at          = (p_payload ->> 'flash_ends_at')::timestamptz
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Product not found' using errcode = 'P0002';
    end if;
  end if;

  -- Images: replaced as a set; the array order is the display order (first = main).
  delete from public.product_images where product_id = v_id;
  for v_image in select value from jsonb_array_elements(v_images) loop
    if coalesce(v_image ->> 'url', '') not like 'https://res.cloudinary.com/dk1jm0rwi/image/upload/%'
       or coalesce(v_image ->> 'public_id', '') not like 'shopyaro/products/%' then
      raise exception 'Invalid image' using errcode = '22023';
    end if;
    insert into public.product_images (product_id, url, public_id, alt, position)
    values (
      v_id,
      v_image ->> 'url',
      v_image ->> 'public_id',
      nullif(btrim(coalesce(v_image ->> 'alt', '')), ''),
      v_position
    );
    v_position := v_position + 1;
  end loop;

  -- Deal tags: replaced as a set (unknown tag ids fail on the foreign key).
  delete from public.product_deal_tags where product_id = v_id;
  insert into public.product_deal_tags (product_id, deal_tag_id)
  select distinct v_id, t.value::uuid
  from jsonb_array_elements_text(v_tag_ids) as t(value);

  return v_id;
end;
$function$;

-- Signed-in users only (the function then checks is_admin() itself).
revoke all on function public.admin_save_product(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_product(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Starter reference data (NOT live data). Names/slugs/order only: category icons
-- are uploaded later from the admin panel. Safe to re-run.
-- -----------------------------------------------------------------------------
insert into public.categories (name, slug, sort_order) values
  ('Electronics',    'electronics',  1),
  ('Gadgets',        'gadgets',      2),
  ('Home & Kitchen', 'home-kitchen', 3),
  ('Fashion',        'fashion',      4),
  ('Footwear',       'footwear',     5),
  ('Beauty',         'beauty',       6)
on conflict (slug) do nothing;

insert into public.deal_tags (name, slug, sort_order) values
  ('Lightning Deals',     'lightning-deals',     1),
  ('Under $5 Store',      'under-5-store',       2),
  ('50% OFF Clearance',   '50-off-clearance',    3),
  ('Buy 1 Get 1 Free',    'buy-1-get-1-free',    4),
  ('Free Shipping Deals', 'free-shipping-deals', 5),
  ('Top Rated Items',     'top-rated-items',     6)
on conflict (slug) do nothing;
