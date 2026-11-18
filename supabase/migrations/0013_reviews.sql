-- =============================================================================
-- 0013_reviews.sql
-- Customer reviews with photos and a video, moderated by admins.
--
--   1. Cloudinary cleanup queue learns about videos and review uploads
--   2. Tables: reviews, review_media, review_upload_log
--   3. Triggers: updated_at, product rating, media count
--   4. Audit trigger: a rating recalculation is not an "admin change to a product"
--   5. Row-level security and column grants (browsers never write; user_id/order_id stay hidden)
--   6. Customer functions: reserve_review_upload, submit_review, edit_my_review,
--      delete_my_review, my_review_state
--   7. Public function: product_review_summary
--   8. Admin functions: admin_list_reviews, admin_get_review, admin_moderate_review,
--      admin_delete_review, admin_remove_review_media
--
-- Needs 0002 (products), 0004 (audit log), 0007 (cleanup queue), 0008 (orders).
-- Run it in the Supabase SQL Editor. Run it ONCE.
--
-- How a review with media flows
--   a. The browser makes a review id (a uuid) and asks the sign-upload Edge Function for an upload
--      slot per file. That calls reserve_review_upload(), which checks the customer has a paid order,
--      applies the limit of 10 uploads per hour, writes review_upload_log and answers with the
--      public_id the file MUST be uploaded under.
--   b. The browser uploads straight to Cloudinary.
--   c. submit_review() / edit_my_review() accept ONLY files found in review_upload_log for this
--      customer and this review (or already attached to it), so nobody can attach another file.
--   d. Files that were uploaded but never attached are queued for deletion after one day.
--
-- Error codes (all `raise exception '<code>' using errcode = 'P0001'`, detail = extra info):
--   rating_invalid | text_invalid (detail title|comment) | not_purchased | already_reviewed |
--   media_invalid (detail = why) | invalid_kind | rate_limited | review_invalid |
--   invalid_status
--   P0002: review_not_found, product_not_found, media_not_found
--   42501: not_signed_in, Admins only
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Cloudinary cleanup queue: videos and review uploads
-- -----------------------------------------------------------------------------
alter table public.cloudinary_cleanup_queue
  add column resource_type text not null default 'image';

alter table public.cloudinary_cleanup_queue
  add constraint cloudinary_cleanup_queue_resource_type_check
  check (resource_type in ('image', 'video'));

alter table public.cloudinary_cleanup_queue
  drop constraint cloudinary_cleanup_queue_public_id_check;

alter table public.cloudinary_cleanup_queue
  add constraint cloudinary_cleanup_queue_public_id_check
  check ((public_id ~ '^shopyaro/(products|categories|banners)/[A-Za-z0-9_-]+$'
          or public_id ~ '^shopyaro/reviews/[0-9a-f-]{36}/(photo|video)/[A-Za-z0-9_-]+$')
         and char_length(public_id) <= 255);


-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------
create table public.reviews (
  id                   uuid        not null default gen_random_uuid(),
  product_id           uuid        not null,
  user_id              uuid        not null,
  order_id             uuid,                       -- the paid order that proves the purchase
  rating               smallint    not null,
  title                text,
  comment              text,
  author_name          text        not null,       -- "Sam L.": a snapshot, never the full name
  status               text        not null default 'pending',
  media_count          integer     not null default 0,
  moderated_by         uuid,
  moderated_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  is_verified_purchase boolean generated always as (order_id is not null) stored,
  constraint reviews_pkey primary key (id),
  constraint reviews_product_id_fkey foreign key (product_id) references public.products (id) on delete cascade,
  constraint reviews_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint reviews_order_id_fkey foreign key (order_id) references public.orders (id) on delete set null,
  constraint reviews_moderated_by_fkey foreign key (moderated_by) references auth.users (id) on delete set null,
  -- One review per customer per product.
  constraint reviews_product_user_key unique (product_id, user_id),
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_title_check
    check (title is null or (char_length(title) between 1 and 100 and title !~ '[[:cntrl:]]')),
  -- A comment may have line breaks (\n, \r, \t) but no other control characters.
  constraint reviews_comment_check
    check (comment is null or (char_length(comment) between 1 and 2000
                               and comment !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]')),
  constraint reviews_author_name_check check (char_length(author_name) between 1 and 40),
  constraint reviews_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint reviews_media_count_check check (media_count between 0 and 4)
);

-- The public list of one product, newest first (approved reviews only).
create index reviews_product_approved_idx on public.reviews (product_id, created_at desc, id desc)
  where status = 'approved';
-- The same list filtered by stars.
create index reviews_product_rating_idx on public.reviews (product_id, rating, created_at desc)
  where status = 'approved';
-- The admin queue.
create index reviews_status_idx on public.reviews (status, created_at desc, id desc);

-- Photos and videos of a review. Their visibility is the visibility of the review: approving or
-- rejecting a review approves or rejects all its media together.
create table public.review_media (
  id               uuid         not null default gen_random_uuid(),
  review_id        uuid         not null,
  media_type       text         not null,
  url              text         not null,          -- the Cloudinary secure_url
  public_id        text         not null,          -- the Cloudinary public id (used to delete the file)
  width            integer,
  height           integer,
  duration_seconds numeric(7,2),
  bytes            integer      not null,
  position         integer      not null default 0,
  created_at       timestamptz  not null default now(),
  constraint review_media_pkey primary key (id),
  constraint review_media_review_id_fkey foreign key (review_id) references public.reviews (id) on delete cascade,
  -- A Cloudinary file belongs to exactly one row.
  constraint review_media_public_id_key unique (public_id),
  constraint review_media_media_type_check check (media_type in ('photo', 'video')),
  constraint review_media_position_check check (position >= 0),
  constraint review_media_bytes_check check (bytes > 0),
  constraint review_media_dimensions_check
    check ((width is null or width > 0) and (height is null or height > 0)
           and (duration_seconds is null or duration_seconds >= 0)),
  constraint review_media_url_check
    check (char_length(url) <= 600 and url ~ '^https://res\.cloudinary\.com/[A-Za-z0-9_-]+/(image|video)/upload/'),
  -- The id must sit in our reviews folder and name the same kind (photo/video) as the row.
  constraint review_media_public_id_check
    check (public_id ~ ('^shopyaro/reviews/[0-9a-f-]{36}/' || media_type || '/[A-Za-z0-9_-]+$')
           and char_length(public_id) <= 255)
);

create index review_media_review_idx on public.review_media (review_id, position);

-- Every upload slot we hand out: it is both the rate limit (10 per hour) and the list of files a
-- customer is allowed to attach. Closed to browsers.
create table public.review_upload_log (
  id         bigint generated always as identity,
  user_id    uuid        not null,
  review_id  uuid        not null,
  media_type text        not null,
  public_id  text        not null,
  created_at timestamptz not null default now(),
  constraint review_upload_log_pkey primary key (id),
  constraint review_upload_log_public_id_key unique (public_id),
  constraint review_upload_log_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint review_upload_log_media_type_check check (media_type in ('photo', 'video'))
);

create index review_upload_log_user_idx on public.review_upload_log (user_id, created_at desc);


-- -----------------------------------------------------------------------------
-- 3. Triggers
-- -----------------------------------------------------------------------------
create trigger reviews_updated_at
  before update on public.reviews
  for each row execute function public.catalog_set_updated_at();

-- Only APPROVED reviews count towards a product's rating.
create or replace function public.recalc_product_rating(p_product_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  with s as (
    select coalesce(round(avg(r.rating)::numeric, 1), 0) as average, count(*)::integer as total
      from public.reviews r
     where r.product_id = p_product_id and r.status = 'approved'
  )
  update public.products p
     set rating_avg = s.average, rating_count = s.total
    from s
   where p.id = p_product_id
     and (p.rating_avg, p.rating_count) is distinct from (s.average, s.total);
end $function$;

create or replace function public.reviews_sync_rating()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' then
    perform public.recalc_product_rating(old.product_id);
  else
    perform public.recalc_product_rating(new.product_id);
    if tg_op = 'UPDATE' and old.product_id <> new.product_id then
      perform public.recalc_product_rating(old.product_id);
    end if;
  end if;
  return null;
end $function$;

create trigger reviews_sync_rating
  after insert or delete or update of status, rating, product_id on public.reviews
  for each row execute function public.reviews_sync_rating();

-- reviews.media_count always equals the number of review_media rows.
create or replace function public.review_media_sync_count()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_review uuid := case when tg_op = 'DELETE' then old.review_id else new.review_id end;
begin
  update public.reviews r
     set media_count = (select count(*) from public.review_media m where m.review_id = v_review)
   where r.id = v_review;
  return null;
end $function$;

create trigger review_media_sync_count
  after insert or delete on public.review_media
  for each row execute function public.review_media_sync_count();

-- Deleted or replaced media go to the Cloudinary cleanup queue (same queue as product pictures).
create or replace function public.queue_cloudinary_cleanup()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_column text := case tg_table_name
    when 'product_images' then 'public_id'
    when 'categories'     then 'icon_public_id'
    when 'site_banners'   then 'image_public_id'
    when 'review_media'   then 'public_id'
  end;
  v_old text := to_jsonb(old) ->> v_column;
  v_new text;
  v_type text := case when tg_table_name = 'review_media' and to_jsonb(old) ->> 'media_type' = 'video'
                      then 'video' else 'image' end;
begin
  if tg_op = 'UPDATE' then
    v_new := to_jsonb(new) ->> v_column;
    if v_old is not distinct from v_new then
      return null;                      -- picture unchanged
    end if;
  end if;

  if v_old is null
     or (v_old !~ '^shopyaro/(products|categories|banners)/[A-Za-z0-9_-]+$'
         and v_old !~ '^shopyaro/reviews/[0-9a-f-]{36}/(photo|video)/[A-Za-z0-9_-]+$') then
    return null;                        -- nothing to clean up, or not one of our uploads
  end if;

  begin
    insert into public.cloudinary_cleanup_queue (public_id, source_table, resource_type)
    values (v_old, tg_table_name, v_type)
    on conflict (public_id) do update
      set queued_at = now(), attempts = 0, last_error = null, resource_type = excluded.resource_type;
  exception when others then
    raise warning 'cloudinary cleanup queue insert failed for %: %', v_old, sqlerrm;
  end;
  return null;
end $function$;

revoke all on function public.queue_cloudinary_cleanup() from public, anon, authenticated;

create trigger cloudinary_queue_review_media
  after delete or update of public_id on public.review_media
  for each row execute function public.queue_cloudinary_cleanup();

-- Files that were uploaded but never attached to a review: queue them one day later.
create or replace function public.queue_orphan_review_uploads()
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  insert into public.cloudinary_cleanup_queue (public_id, source_table, resource_type)
  select l.public_id, 'review_upload_log', case l.media_type when 'video' then 'video' else 'image' end
    from public.review_upload_log l
   where l.created_at < now() - interval '1 day'
     and not exists (select 1 from public.review_media m where m.public_id = l.public_id)
  on conflict (public_id) do nothing;

  delete from public.review_upload_log where created_at < now() - interval '1 day';
end $function$;

-- claim_cleanup_batch now also hands out the resource type (a video needs a different Cloudinary
-- call) and knows that review media are "in use". The first three columns are unchanged, so the
-- old delete-assets function keeps working until it is updated.
drop function public.claim_cleanup_batch(integer);

create function public.claim_cleanup_batch(p_limit integer default 20)
 returns table (id bigint, public_id text, resource_type text)
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  perform public.queue_orphan_review_uploads();

  -- Still in use somewhere: nothing to delete.
  delete from public.cloudinary_cleanup_queue q
  where exists (select 1 from public.product_images pi where pi.public_id = q.public_id)
     or exists (select 1 from public.categories c where c.icon_public_id = q.public_id)
     or exists (select 1 from public.site_banners b where b.image_public_id = q.public_id)
     or exists (select 1 from public.review_media m where m.public_id = q.public_id);

  return query
  with picked as (
    select q.id
    from public.cloudinary_cleanup_queue q
    where q.attempts < 5
      and (q.last_attempt_at is null or q.last_attempt_at < now() - interval '1 minute')
    order by q.queued_at
    limit greatest(1, least(coalesce(p_limit, 20), 50))
    for update skip locked
  )
  update public.cloudinary_cleanup_queue q
     set attempts = q.attempts + 1, last_attempt_at = now()
    from picked
   where q.id = picked.id
  returning q.id, q.public_id, q.resource_type;
end $function$;

revoke all on function public.queue_orphan_review_uploads() from public, anon, authenticated;
revoke all on function public.claim_cleanup_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_cleanup_batch(integer) to service_role;


-- -----------------------------------------------------------------------------
-- 4. Audit trigger: a rating recalculation is not an admin change to a product.
--    Identical to the function in 0004 except for the marked block. Without it, every approval
--    would add a bogus "Updated product ... (images or deal tags)" line to the Activity log.
-- -----------------------------------------------------------------------------
create or replace function public.log_admin_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  old_j jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  new_j jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  cur   jsonb := coalesce(new_j, old_j);
  ignore_keys text[] := array['updated_at','used_count'];
  diff    jsonb;
  changed text;
  noun  text := case tg_table_name
    when 'products' then 'product' when 'categories' then 'category'
    when 'deal_tags' then 'deal tag' when 'coupons' then 'coupon'
    when 'site_banners' then 'banner' when 'user_roles' then 'user role'
    else tg_table_name end;
  lbl   text := coalesce(cur->>'title', cur->>'name', cur->>'code',
                         cur->>'role' || ' for ' || (cur->>'user_id'), cur->>'id');
  uid   uuid := auth.uid();
  summ  text;
begin
  -- Normal customer sign-ups also write a 'customer' role row; only admin-role changes matter.
  if tg_table_name = 'user_roles'
     and coalesce(new_j->>'role', '') <> 'admin' and coalesce(old_j->>'role', '') <> 'admin' then
    return null;
  end if;

  -- NEW IN 0013: the rating of a product moves when reviews are approved or removed. That is the
  -- review system's doing, not an edit of the product, so it is not logged here (the review
  -- action itself is logged by the review functions).
  if tg_table_name = 'products' and tg_op = 'UPDATE'
     and (old_j -> 'rating_avg' is distinct from new_j -> 'rating_avg'
          or old_j -> 'rating_count' is distinct from new_j -> 'rating_count')
     and (old_j - 'rating_avg' - 'rating_count' - 'updated_at' - 'used_count')
         = (new_j - 'rating_avg' - 'rating_count' - 'updated_at' - 'used_count') then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_object('from', old_j->k, 'to', new_j->k))
      into diff
      from jsonb_object_keys(new_j) as k
     where k <> all (ignore_keys) and (old_j->k) is distinct from (new_j->k);

    if diff is null then
      if tg_table_name <> 'products' then return null; end if;
      summ := 'Updated product "' || lbl || '" (images or deal tags)';
    else
      select string_agg(k, ', ' order by k) into changed from jsonb_object_keys(diff) k;
      summ := case
        when changed = 'is_active' and (new_j->>'is_active')::boolean
          then 'Reactivated ' || noun || ' "' || lbl || '"'
        when changed = 'is_active'
          then 'Deactivated ' || noun || ' "' || lbl || '"'
        else 'Updated ' || noun || ' "' || lbl || '" (' || changed || ')'
      end;
    end if;
  elsif tg_op = 'INSERT' then
    summ := 'Created ' || noun || ' "' || lbl || '"';
  else
    summ := 'Deleted ' || noun || ' "' || lbl || '"';
    diff := old_j;
  end if;

  insert into public.admin_audit_log
    (actor_id, actor_email, action, table_name, record_id, record_label, summary, changes)
  values
    (uid, case when uid is null then null else auth.jwt()->>'email' end,
     lower(tg_op), tg_table_name, coalesce(cur->>'id', cur->>'user_id'), lbl, summ, diff);
  return null;
end $function$;

revoke all on function public.log_admin_change() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 5. Row-level security and grants
--    Browsers can only READ, and only these columns. user_id and order_id are never readable
--    directly. A customer reads their own review through my_review_state(); an admin through the
--    admin_* functions. Nobody writes to these tables from a browser.
-- -----------------------------------------------------------------------------
alter table public.reviews           enable row level security;
alter table public.review_media      enable row level security;
alter table public.review_upload_log enable row level security;

revoke all on table public.reviews           from anon, authenticated;
revoke all on table public.review_media      from anon, authenticated;
revoke all on table public.review_upload_log from anon, authenticated;

grant select (id, product_id, rating, title, comment, author_name, status, media_count,
              is_verified_purchase, created_at, updated_at)
  on table public.reviews to anon, authenticated;

grant select (id, review_id, media_type, url, width, height, duration_seconds, position, created_at)
  on table public.review_media to anon, authenticated;

create policy "reviews: public read approved" on public.reviews
  for select to anon, authenticated using (status = 'approved');
create policy "reviews: admin read all" on public.reviews
  for select to authenticated using ((select public.is_admin()));

create policy "review_media: public read approved" on public.review_media
  for select to anon, authenticated
  using (exists (select 1 from public.reviews r where r.id = review_id and r.status = 'approved'));
create policy "review_media: admin read all" on public.review_media
  for select to authenticated using ((select public.is_admin()));
-- review_upload_log: RLS on, no policy, no grant: closed.


-- -----------------------------------------------------------------------------
-- 6. Internal helpers (no one can call them directly)
-- -----------------------------------------------------------------------------

-- The most recent paid / shipped / delivered order of this customer that contains the product.
create or replace function public.review_order_for(p_user uuid, p_product uuid)
 returns uuid
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select o.id
    from public.orders o
    join public.order_items i on i.order_id = o.id
   where o.user_id = p_user
     and i.product_id = p_product
     and o.status in ('paid', 'shipped', 'delivered')
   order by o.paid_at desc nulls last, o.created_at desc
   limit 1;
$function$;

-- "Sam Lee" -> "Sam L.", "Sam" -> "Sam", nothing -> "Customer".
create or replace function public.review_author_name(p_user uuid)
 returns text
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_name  text;
  v_parts text[];
  v_first text;
begin
  select regexp_replace(btrim(p.full_name), '[[:cntrl:]]', '', 'g') into v_name
    from public.profiles p where p.id = p_user;
  v_parts := regexp_split_to_array(coalesce(v_name, ''), '\s+');
  v_first := left(v_parts[1], 30);
  if v_first is null or v_first = '' then return 'Customer'; end if;
  if array_length(v_parts, 1) > 1 then
    return v_first || ' ' || upper(left(v_parts[array_length(v_parts, 1)], 1)) || '.';
  end if;
  return v_first;
end $function$;

-- Checks the media list of a review and returns it cleaned up (with positions).
-- The limits live HERE (not in table checks) so they are easy to change later.
create or replace function public.review_validate_media(p_review_id uuid, p_user uuid, p_media jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  c_max_photos        constant integer := 3;
  c_max_videos        constant integer := 1;
  c_max_photo_bytes   constant integer := 5 * 1024 * 1024;     -- 5 MB
  c_max_video_bytes   constant integer := 10 * 1024 * 1024;    -- 10 MB
  c_max_video_seconds constant integer := 60;
  v_item    jsonb;
  v_out     jsonb := '[]'::jsonb;
  v_seen    text[] := '{}';
  v_photos  integer := 0;
  v_videos  integer := 0;
  v_type    text;
  v_pid     text;
  v_url     text;
  v_bytes   bigint;
  v_w       integer;
  v_h       integer;
  v_dur     numeric;
  v_max_bytes bigint;   -- computed before each IF: plpgsql cuts an IF condition at the first THEN,
  v_kind    text;       -- so a CASE (which has its own THEN) must never sit inside an IF
begin
  if p_media is null then p_media := '[]'::jsonb; end if;
  if jsonb_typeof(p_media) <> 'array' or jsonb_array_length(p_media) > c_max_photos + c_max_videos then
    raise exception 'media_invalid' using errcode = 'P0001', detail = 'too_many';
  end if;

  for v_item in select e.value from jsonb_array_elements(p_media) as e loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'media_invalid' using errcode = 'P0001', detail = 'shape';
    end if;

    v_type := v_item ->> 'media_type';
    if v_type is null or v_type not in ('photo', 'video') then
      raise exception 'media_invalid' using errcode = 'P0001', detail = 'type';
    end if;

    v_pid := v_item ->> 'public_id';
    if v_pid is null or v_pid !~ ('^shopyaro/reviews/' || p_review_id::text || '/' || v_type || '/[A-Za-z0-9_-]+$')
       or char_length(v_pid) > 255 then
      raise exception 'media_invalid' using errcode = 'P0001', detail = 'public_id';
    end if;
    if v_pid = any (v_seen) then
      raise exception 'media_invalid' using errcode = 'P0001', detail = 'duplicate';
    end if;
    v_seen := v_seen || v_pid;

    -- The address must be a Cloudinary delivery URL of exactly this file.
    v_url := v_item ->> 'url';
    v_kind := case v_type when 'photo' then 'image' else 'video' end;
    if v_url is null or char_length(v_url) > 600
       or v_url !~ ('^https://res\.cloudinary\.com/[A-Za-z0-9_-]+/' || v_kind
                    || '/upload/(.+/)?' || v_pid || '(\.[A-Za-z0-9]+)?$') then
      raise exception 'media_invalid' using errcode = 'P0001', detail = 'url';
    end if;

    if jsonb_typeof(v_item -> 'bytes') is distinct from 'number' then
      raise exception 'media_invalid' using errcode = 'P0001', detail = 'size';
    end if;
    v_bytes := round((v_item ->> 'bytes')::numeric);
    v_max_bytes := case v_type when 'photo' then c_max_photo_bytes else c_max_video_bytes end;
    if v_bytes < 1 or v_bytes > v_max_bytes then
      raise exception 'media_invalid' using errcode = 'P0001', detail = 'size';
    end if;

    if (v_item ? 'width' and jsonb_typeof(v_item -> 'width') not in ('number', 'null'))
       or (v_item ? 'height' and jsonb_typeof(v_item -> 'height') not in ('number', 'null'))
       or (v_item ? 'duration_seconds' and jsonb_typeof(v_item -> 'duration_seconds') not in ('number', 'null')) then
      raise exception 'media_invalid' using errcode = 'P0001', detail = 'dimensions';
    end if;
    v_w   := case when jsonb_typeof(v_item -> 'width') = 'number' then round((v_item ->> 'width')::numeric)::integer end;
    v_h   := case when jsonb_typeof(v_item -> 'height') = 'number' then round((v_item ->> 'height')::numeric)::integer end;
    v_dur := case when jsonb_typeof(v_item -> 'duration_seconds') = 'number' then (v_item ->> 'duration_seconds')::numeric end;
    if (v_w is not null and v_w not between 1 and 20000) or (v_h is not null and v_h not between 1 and 20000) then
      raise exception 'media_invalid' using errcode = 'P0001', detail = 'dimensions';
    end if;
    if v_dur is not null and (v_dur < 0 or v_dur > c_max_video_seconds) then
      raise exception 'media_invalid' using errcode = 'P0001', detail = 'duration';
    end if;

    -- Only files we handed an upload slot for (to this customer, for this review), or files that
    -- already belong to this review, can be attached.
    if not exists (select 1 from public.review_upload_log l
                    where l.public_id = v_pid and l.user_id = p_user and l.review_id = p_review_id
                      and l.media_type = v_type)
       and not exists (select 1 from public.review_media m
                        where m.public_id = v_pid and m.review_id = p_review_id) then
      raise exception 'media_invalid' using errcode = 'P0001', detail = 'not_uploaded';
    end if;

    if v_type = 'photo' then v_photos := v_photos + 1; else v_videos := v_videos + 1; end if;
    v_out := v_out || jsonb_build_object(
      'media_type', v_type, 'url', v_url, 'public_id', v_pid, 'width', v_w, 'height', v_h,
      'duration_seconds', v_dur, 'bytes', v_bytes, 'position', jsonb_array_length(v_out));
  end loop;

  if v_photos > c_max_photos or v_videos > c_max_videos then
    raise exception 'media_invalid' using errcode = 'P0001', detail = 'too_many';
  end if;
  return v_out;
end $function$;

-- Checks title and comment; returns them trimmed (empty becomes null).
create or replace function public.review_clean_text(p_title text, p_comment text)
 returns text[]
 language plpgsql
 immutable
 set search_path to ''
as $function$
declare
  v_title   text := nullif(btrim(coalesce(p_title, '')), '');
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if v_title is not null and (char_length(v_title) > 100 or v_title ~ '[[:cntrl:]]') then
    raise exception 'text_invalid' using errcode = 'P0001', detail = 'title';
  end if;
  if v_comment is not null and (char_length(v_comment) > 2000
                                or v_comment ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]') then
    raise exception 'text_invalid' using errcode = 'P0001', detail = 'comment';
  end if;
  return array[v_title, v_comment];
end $function$;

revoke all on function public.recalc_product_rating(uuid)                    from public, anon, authenticated;
revoke all on function public.reviews_sync_rating()                          from public, anon, authenticated;
revoke all on function public.review_media_sync_count()                       from public, anon, authenticated;
revoke all on function public.review_order_for(uuid, uuid)                   from public, anon, authenticated;
revoke all on function public.review_author_name(uuid)                       from public, anon, authenticated;
revoke all on function public.review_validate_media(uuid, uuid, jsonb)       from public, anon, authenticated;
revoke all on function public.review_clean_text(text, text)                  from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 7. Customer functions
-- -----------------------------------------------------------------------------

-- An upload slot. Called by the sign-upload Edge Function with the customer's own token.
-- Answers with the public_id the file must be uploaded under.
create or replace function public.reserve_review_upload(p_review_id uuid, p_kind text)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  c_per_hour constant integer := 10;
  v_user     uuid := auth.uid();
  v_public_id text;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_review_id is null or p_kind is null or p_kind not in ('photo', 'video') then
    raise exception 'invalid_kind' using errcode = 'P0001';
  end if;

  -- Serialise this customer's requests so two at once cannot both slip under the limit.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  -- A review that already exists must be this customer's own.
  if exists (select 1 from public.reviews r where r.id = p_review_id and r.user_id <> v_user) then
    raise exception 'review_not_found' using errcode = 'P0002';
  end if;

  -- Only customers who have bought something can upload anything.
  if not exists (select 1 from public.orders o
                  where o.user_id = v_user and o.status in ('paid', 'shipped', 'delivered')) then
    raise exception 'not_purchased' using errcode = 'P0001';
  end if;

  if (select count(*) from public.review_upload_log l
       where l.user_id = v_user and l.created_at > now() - interval '1 hour') >= c_per_hour then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_public_id := 'shopyaro/reviews/' || p_review_id::text || '/' || p_kind || '/'
                 || replace(gen_random_uuid()::text, '-', '');
  insert into public.review_upload_log (user_id, review_id, media_type, public_id)
  values (v_user, p_review_id, p_kind, v_public_id);
  return v_public_id;
end $function$;

-- A new review. It starts "pending" and is invisible to others until an admin approves it.
-- p_review_id is made by the browser first because the uploaded files already sit in a folder
-- named after it.
create or replace function public.submit_review(
  p_review_id uuid, p_product_id uuid, p_rating integer, p_title text, p_comment text,
  p_media jsonb default '[]'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user    uuid := auth.uid();
  v_text    text[];
  v_order   uuid;
  v_media   jsonb;
  v_status  text;
  v_count   integer;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_review_id is null then
    raise exception 'review_invalid' using errcode = 'P0001';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'rating_invalid' using errcode = 'P0001';
  end if;
  v_text := public.review_clean_text(p_title, p_comment);

  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  v_order := public.review_order_for(v_user, p_product_id);
  if v_order is null then
    raise exception 'not_purchased' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.reviews r
              where (r.product_id = p_product_id and r.user_id = v_user) or r.id = p_review_id) then
    raise exception 'already_reviewed' using errcode = 'P0001';
  end if;

  v_media := public.review_validate_media(p_review_id, v_user, p_media);

  begin
    insert into public.reviews (id, product_id, user_id, order_id, rating, title, comment, author_name)
    values (p_review_id, p_product_id, v_user, v_order, p_rating, v_text[1], v_text[2],
            public.review_author_name(v_user));
  exception when unique_violation then
    raise exception 'already_reviewed' using errcode = 'P0001';
  end;

  insert into public.review_media
    (review_id, media_type, url, public_id, width, height, duration_seconds, bytes, position)
  select p_review_id, e ->> 'media_type', e ->> 'url', e ->> 'public_id',
         (e ->> 'width')::integer, (e ->> 'height')::integer,
         (e ->> 'duration_seconds')::numeric, (e ->> 'bytes')::integer, (e ->> 'position')::integer
    from jsonb_array_elements(v_media) as e;

  select r.status, r.media_count into v_status, v_count from public.reviews r where r.id = p_review_id;
  return jsonb_build_object('id', p_review_id, 'status', v_status, 'media_count', v_count);
end $function$;

-- Edit your own review. It goes back to "pending" (so moderation cannot be skipped by editing).
-- p_media is the COMPLETE new list: files left out are removed, new ones are added.
create or replace function public.edit_my_review(
  p_review_id uuid, p_rating integer, p_title text, p_comment text,
  p_media jsonb default '[]'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user   uuid := auth.uid();
  v_text   text[];
  v_media  jsonb;
  v_status text;
  v_count  integer;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'rating_invalid' using errcode = 'P0001';
  end if;
  v_text := public.review_clean_text(p_title, p_comment);

  perform 1 from public.reviews r where r.id = p_review_id and r.user_id = v_user for update;
  if not found then
    raise exception 'review_not_found' using errcode = 'P0002';
  end if;

  v_media := public.review_validate_media(p_review_id, v_user, p_media);

  update public.reviews
     set rating = p_rating, title = v_text[1], comment = v_text[2],
         status = 'pending', moderated_by = null, moderated_at = null
   where id = p_review_id;

  -- Remove the files that are no longer wanted (the trigger queues them for Cloudinary)...
  delete from public.review_media m
   where m.review_id = p_review_id
     and m.public_id <> all (array(select e ->> 'public_id' from jsonb_array_elements(v_media) as e));

  -- ...and add the new ones. Kept files only get their new position.
  insert into public.review_media
    (review_id, media_type, url, public_id, width, height, duration_seconds, bytes, position)
  select p_review_id, e ->> 'media_type', e ->> 'url', e ->> 'public_id',
         (e ->> 'width')::integer, (e ->> 'height')::integer,
         (e ->> 'duration_seconds')::numeric, (e ->> 'bytes')::integer, (e ->> 'position')::integer
    from jsonb_array_elements(v_media) as e
  on conflict (public_id) do update set position = excluded.position
    where public.review_media.review_id = excluded.review_id;

  select r.status, r.media_count into v_status, v_count from public.reviews r where r.id = p_review_id;
  return jsonb_build_object('id', p_review_id, 'status', v_status, 'media_count', v_count);
end $function$;

-- Delete your own review and its media (the files are queued for Cloudinary by a trigger).
create or replace function public.delete_my_review(p_review_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  delete from public.reviews r where r.id = p_review_id and r.user_id = v_user;
  if not found then
    raise exception 'review_not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('id', p_review_id, 'deleted', true);
end $function$;

-- Everything the product page needs to know about THIS customer and THIS product:
-- may they review it, and what did they write (in any status, with its media)?
create or replace function public.my_review_state(p_product_id uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_user   uuid := auth.uid();
  v_review jsonb;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select jsonb_build_object(
           'id', r.id, 'rating', r.rating, 'title', r.title, 'comment', r.comment,
           'status', r.status, 'author_name', r.author_name,
           'created_at', r.created_at, 'updated_at', r.updated_at,
           'media', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', m.id, 'media_type', m.media_type, 'url', m.url, 'public_id', m.public_id,
                      'width', m.width, 'height', m.height, 'duration_seconds', m.duration_seconds,
                      'bytes', m.bytes, 'position', m.position) order by m.position)
               from public.review_media m where m.review_id = r.id), '[]'::jsonb))
    into v_review
    from public.reviews r
   where r.product_id = p_product_id and r.user_id = v_user;

  if v_review is not null then
    return jsonb_build_object('eligible', false, 'reason', 'already_reviewed', 'review', v_review);
  end if;
  if public.review_order_for(v_user, p_product_id) is null then
    return jsonb_build_object('eligible', false, 'reason', 'not_purchased', 'review', null);
  end if;
  return jsonb_build_object('eligible', true, 'reason', null, 'review', null);
end $function$;


-- -----------------------------------------------------------------------------
-- 8. Public function: the star breakdown of a product (approved reviews only)
--    SECURITY INVOKER: row-level security already limits what anyone can count.
-- -----------------------------------------------------------------------------
create or replace function public.product_review_summary(p_product_id uuid)
 returns jsonb
 language sql
 stable
 set search_path to ''
as $function$
  select jsonb_build_object(
    'average', coalesce(round(avg(r.rating)::numeric, 1), 0),
    'count', count(*),
    'stars', jsonb_build_object(
      '5', count(*) filter (where r.rating = 5),
      '4', count(*) filter (where r.rating = 4),
      '3', count(*) filter (where r.rating = 3),
      '2', count(*) filter (where r.rating = 2),
      '1', count(*) filter (where r.rating = 1)))
    from public.reviews r
   where r.product_id = p_product_id and r.status = 'approved';
$function$;


-- -----------------------------------------------------------------------------
-- 9. Admin functions (every one refuses anyone who is not an admin with 42501)
-- -----------------------------------------------------------------------------

-- One page of the moderation queue, newest first, chained by (created_at, id).
-- p_status null = every status. p_has_media null = either. Search looks at the title, comment,
-- author name, product name and the account email.
create or replace function public.admin_list_reviews(
  p_status text default null, p_rating integer default null, p_has_media boolean default null,
  p_search text default null, p_before_created timestamptz default null,
  p_before_id uuid default null, p_limit integer default 25)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_limit  integer := greatest(1, least(coalesce(p_limit, 25), 50));
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_rows   jsonb;
  v_n      integer;
begin
  if not (select public.is_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(x.item order by x.created_at desc, x.id desc), '[]'::jsonb), count(*)
    into v_rows, v_n
    from (
      select r.id, r.created_at,
             jsonb_build_object(
               'id', r.id, 'product_id', r.product_id, 'product_title', p.title,
               'author_name', r.author_name, 'account_email', u.email,
               'rating', r.rating, 'title', r.title, 'comment_preview', left(r.comment, 200),
               'media_count', r.media_count, 'status', r.status, 'created_at', r.created_at) as item
        from public.reviews r
        join public.products p on p.id = r.product_id
        left join auth.users u on u.id = r.user_id
       where (p_status is null or r.status = p_status)
         and (p_rating is null or r.rating = p_rating)
         and (p_has_media is null or (r.media_count > 0) = p_has_media)
         and (v_search is null
              or position(v_search in lower(coalesce(r.title, ''))) > 0
              or position(v_search in lower(coalesce(r.comment, ''))) > 0
              or position(v_search in lower(r.author_name)) > 0
              or position(v_search in lower(p.title)) > 0
              or position(v_search in lower(coalesce(u.email, ''))) > 0)
         and (p_before_created is null or p_before_id is null
              or (r.created_at, r.id) < (p_before_created, p_before_id))
       order by r.created_at desc, r.id desc
       limit v_limit + 1
    ) x;

  if v_n > v_limit then
    -- one more than asked for means there is another page; drop the extra row
    v_rows := (select coalesce(jsonb_agg(e.value order by e.ord), '[]'::jsonb)
                 from jsonb_array_elements(v_rows) with ordinality as e(value, ord)
                where e.ord <= v_limit);
    return jsonb_build_object('items', v_rows, 'has_more', true);
  end if;
  return jsonb_build_object('items', v_rows, 'has_more', false);
end $function$;

-- One review with everything the admin needs. Null when it does not exist.
create or replace function public.admin_get_review(p_review_id uuid)
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
           'id', r.id, 'product_id', r.product_id, 'product_title', p.title, 'product_slug', p.slug,
           'user_id', r.user_id, 'account_email', u.email, 'author_name', r.author_name,
           'order_id', r.order_id, 'order_number', o.order_number,
           'rating', r.rating, 'title', r.title, 'comment', r.comment, 'status', r.status,
           'media_count', r.media_count, 'is_verified_purchase', r.is_verified_purchase,
           'moderated_by', r.moderated_by, 'moderated_at', r.moderated_at,
           'created_at', r.created_at, 'updated_at', r.updated_at,
           'media', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', m.id, 'media_type', m.media_type, 'url', m.url, 'public_id', m.public_id,
                      'width', m.width, 'height', m.height, 'duration_seconds', m.duration_seconds,
                      'bytes', m.bytes, 'position', m.position) order by m.position)
               from public.review_media m where m.review_id = r.id), '[]'::jsonb))
    into result
    from public.reviews r
    join public.products p on p.id = r.product_id
    left join auth.users u on u.id = r.user_id
    left join public.orders o on o.id = r.order_id
   where r.id = p_review_id;
  return result;
end $function$;

-- Approve or reject a review. Its media follow it (their visibility is the review's).
-- Answering the status it already has changes nothing and writes no log entry.
create or replace function public.admin_moderate_review(p_review_id uuid, p_status text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  r       public.reviews%rowtype;
  v_title text;
  v_old   text;
begin
  if not (select public.is_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('approved', 'rejected') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select * into r from public.reviews where id = p_review_id for update;
  if not found then
    raise exception 'review_not_found' using errcode = 'P0002';
  end if;

  if r.status = p_status then
    return jsonb_build_object('id', r.id, 'status', r.status, 'changed', false);
  end if;

  v_old := r.status;
  select title into v_title from public.products where id = r.product_id;
  update public.reviews
     set status = p_status, moderated_by = auth.uid(), moderated_at = now()
   where id = r.id;

  insert into public.admin_audit_log
    (actor_id, actor_email, action, table_name, record_id, record_label, summary, changes)
  values
    (auth.uid(), auth.jwt() ->> 'email', 'update', 'reviews', r.id::text,
     'Review by ' || r.author_name || ' on ' || coalesce(v_title, 'a product'),
     case p_status when 'approved' then 'Approved' else 'Rejected' end
       || ' the review by ' || r.author_name || ' on "' || coalesce(v_title, 'a product') || '"',
     jsonb_build_object('status', jsonb_build_object('from', v_old, 'to', p_status)));

  return jsonb_build_object('id', r.id, 'status', p_status, 'changed', true);
end $function$;

-- Delete a review and all its media (the files are queued for Cloudinary by a trigger).
-- The log keeps who, what and the star rating, never the text.
create or replace function public.admin_delete_review(p_review_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  r       public.reviews%rowtype;
  v_title text;
begin
  if not (select public.is_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  select * into r from public.reviews where id = p_review_id for update;
  if not found then
    raise exception 'review_not_found' using errcode = 'P0002';
  end if;
  select title into v_title from public.products where id = r.product_id;

  delete from public.reviews where id = r.id;

  insert into public.admin_audit_log
    (actor_id, actor_email, action, table_name, record_id, record_label, summary, changes)
  values
    (auth.uid(), auth.jwt() ->> 'email', 'delete', 'reviews', r.id::text,
     'Review by ' || r.author_name || ' on ' || coalesce(v_title, 'a product'),
     'Deleted the review by ' || r.author_name || ' on "' || coalesce(v_title, 'a product') || '"',
     jsonb_build_object('rating', r.rating, 'status', r.status, 'media_count', r.media_count,
                        'author_name', r.author_name, 'product_id', r.product_id));

  return jsonb_build_object('id', r.id, 'deleted', true);
end $function$;

-- Remove ONE photo or video from a review (for example one inappropriate picture). The review
-- itself and its other media stay.
create or replace function public.admin_remove_review_media(p_media_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  m       public.review_media%rowtype;
  r       public.reviews%rowtype;
  v_title text;
  v_count integer;
begin
  if not (select public.is_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  select * into m from public.review_media where id = p_media_id for update;
  if not found then
    raise exception 'media_not_found' using errcode = 'P0002';
  end if;
  select * into r from public.reviews where id = m.review_id;
  select title into v_title from public.products where id = r.product_id;

  delete from public.review_media where id = m.id;
  select media_count into v_count from public.reviews where id = r.id;

  insert into public.admin_audit_log
    (actor_id, actor_email, action, table_name, record_id, record_label, summary, changes)
  values
    (auth.uid(), auth.jwt() ->> 'email', 'update', 'reviews', r.id::text,
     'Review by ' || r.author_name || ' on ' || coalesce(v_title, 'a product'),
     'Removed a ' || m.media_type || ' from the review by ' || r.author_name
       || ' on "' || coalesce(v_title, 'a product') || '"',
     jsonb_build_object('media_count', jsonb_build_object('from', v_count + 1, 'to', v_count)));

  return jsonb_build_object('id', r.id, 'media_count', v_count);
end $function$;


-- -----------------------------------------------------------------------------
-- 10. Who may call what
-- -----------------------------------------------------------------------------
revoke all on function public.reserve_review_upload(uuid, text)                          from public, anon, authenticated;
revoke all on function public.submit_review(uuid, uuid, integer, text, text, jsonb)      from public, anon, authenticated;
revoke all on function public.edit_my_review(uuid, integer, text, text, jsonb)           from public, anon, authenticated;
revoke all on function public.delete_my_review(uuid)                                     from public, anon, authenticated;
revoke all on function public.my_review_state(uuid)                                      from public, anon, authenticated;
revoke all on function public.product_review_summary(uuid)                               from public, anon, authenticated;
revoke all on function public.admin_list_reviews(text, integer, boolean, text, timestamptz, uuid, integer)
                                                                                         from public, anon, authenticated;
revoke all on function public.admin_get_review(uuid)                                     from public, anon, authenticated;
revoke all on function public.admin_moderate_review(uuid, text)                          from public, anon, authenticated;
revoke all on function public.admin_delete_review(uuid)                                  from public, anon, authenticated;
revoke all on function public.admin_remove_review_media(uuid)                            from public, anon, authenticated;

grant execute on function public.reserve_review_upload(uuid, text)                       to authenticated;
grant execute on function public.submit_review(uuid, uuid, integer, text, text, jsonb)   to authenticated;
grant execute on function public.edit_my_review(uuid, integer, text, text, jsonb)        to authenticated;
grant execute on function public.delete_my_review(uuid)                                  to authenticated;
grant execute on function public.my_review_state(uuid)                                   to authenticated;
grant execute on function public.product_review_summary(uuid)                            to anon, authenticated;
grant execute on function public.admin_list_reviews(text, integer, boolean, text, timestamptz, uuid, integer)
                                                                                         to authenticated;
grant execute on function public.admin_get_review(uuid)                                  to authenticated;
grant execute on function public.admin_moderate_review(uuid, text)                       to authenticated;
grant execute on function public.admin_delete_review(uuid)                               to authenticated;
grant execute on function public.admin_remove_review_media(uuid)                         to authenticated;
