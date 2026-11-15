-- =============================================================================
-- 0007_cloudinary_cleanup.sql
-- A database queue of Cloudinary pictures that are no longer used, so the
-- `delete-assets` Edge Function can remove them from Cloudinary.
--
-- How it works
--   1. Triggers add a picture's public_id to the queue whenever a row that held it
--      is deleted, or the picture is replaced (product images, category icons,
--      banner images). This happens in the SAME transaction as the change, so it
--      cannot be forgotten.
--   2. The Edge Function claims a batch with claim_cleanup_batch(). That function
--      skips any picture that is STILL in use. This matters because
--      admin_save_product() deletes and re-inserts every image of a product on each
--      save: kept pictures get queued, then found "still in use", and are never deleted.
--   3. After Cloudinary confirms, the function calls complete_cleanup(); failures go
--      to fail_cleanup() and are retried (up to 5 attempts).
-- The browser never sends public_ids to delete: the function only works through
-- this queue. Browsers cannot read or write the queue at all.
-- Needs 0002 (product_images, categories) and 0003 (site_banners).
-- =============================================================================

create table public.cloudinary_cleanup_queue (
  id              bigint generated always as identity,
  public_id       text        not null,
  source_table    text        not null,
  queued_at       timestamptz not null default now(),
  attempts        integer     not null default 0,
  last_attempt_at timestamptz,
  last_error      text,
  constraint cloudinary_cleanup_queue_pkey primary key (id),
  -- One row per picture, however many times it is queued.
  constraint cloudinary_cleanup_queue_public_id_key unique (public_id),
  -- Only our own upload folders can ever be queued.
  constraint cloudinary_cleanup_queue_public_id_check
    check (public_id ~ '^shopyaro/(products|categories|banners)/[A-Za-z0-9_-]+$'
           and char_length(public_id) <= 255)
);

-- Closed to browsers: RLS on, no policies, no grants. Only the SECURITY DEFINER
-- functions below (and the service role used by the Edge Function) can touch it.
alter table public.cloudinary_cleanup_queue enable row level security;
revoke all on table public.cloudinary_cleanup_queue from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Queueing: runs after a delete, or after the picture column changes.
-- Never blocks the admin's change: a value that is not ours is skipped, and any
-- unexpected problem is only logged as a warning.
-- -----------------------------------------------------------------------------
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
  end;
  v_old text := to_jsonb(old) ->> v_column;
  v_new text;
begin
  if tg_op = 'UPDATE' then
    v_new := to_jsonb(new) ->> v_column;
    if v_old is not distinct from v_new then
      return null;                      -- picture unchanged
    end if;
  end if;

  if v_old is null or v_old !~ '^shopyaro/(products|categories|banners)/[A-Za-z0-9_-]+$' then
    return null;                        -- nothing to clean up, or not one of our uploads
  end if;

  begin
    insert into public.cloudinary_cleanup_queue (public_id, source_table)
    values (v_old, tg_table_name)
    on conflict (public_id) do update
      set queued_at = now(), attempts = 0, last_error = null;
  exception when others then
    raise warning 'cloudinary cleanup queue insert failed for %: %', v_old, sqlerrm;
  end;
  return null;
end $function$;

revoke all on function public.queue_cloudinary_cleanup() from public, anon, authenticated;

-- Fires for cascaded deletes too (deleting a product removes its product_images rows).
create trigger cloudinary_queue_product_images
  after delete or update of public_id on public.product_images
  for each row execute function public.queue_cloudinary_cleanup();

create trigger cloudinary_queue_categories
  after delete or update of icon_public_id on public.categories
  for each row execute function public.queue_cloudinary_cleanup();

create trigger cloudinary_queue_site_banners
  after delete or update of image_public_id on public.site_banners
  for each row execute function public.queue_cloudinary_cleanup();

-- -----------------------------------------------------------------------------
-- Draining (called by the Edge Function with the service role only)
-- -----------------------------------------------------------------------------

-- Returns up to p_limit pictures that are safe to delete. Pictures that are still
-- referenced anywhere are removed from the queue instead. A picture claimed in the
-- last minute is skipped, so two runs at once do not repeat the same work.
create or replace function public.claim_cleanup_batch(p_limit integer default 20)
 returns table (id bigint, public_id text)
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  -- Still in use somewhere: nothing to delete.
  delete from public.cloudinary_cleanup_queue q
  where exists (select 1 from public.product_images pi where pi.public_id = q.public_id)
     or exists (select 1 from public.categories c where c.icon_public_id = q.public_id)
     or exists (select 1 from public.site_banners b where b.image_public_id = q.public_id);

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
  returning q.id, q.public_id;
end $function$;

-- Cloudinary confirmed these are gone (or never existed): drop them from the queue.
create or replace function public.complete_cleanup(p_ids bigint[])
 returns void
 language sql
 security definer
 set search_path to ''
as $function$
  delete from public.cloudinary_cleanup_queue where id = any (p_ids);
$function$;

-- Cloudinary refused or failed: keep the row, remember why, retry later.
create or replace function public.fail_cleanup(p_id bigint, p_error text)
 returns void
 language sql
 security definer
 set search_path to ''
as $function$
  update public.cloudinary_cleanup_queue
     set last_error = left(coalesce(p_error, 'unknown error'), 500)
   where id = p_id;
$function$;

-- Service role only: browsers (anon / signed-in) can never call these.
revoke all on function public.claim_cleanup_batch(integer) from public, anon, authenticated;
revoke all on function public.complete_cleanup(bigint[])   from public, anon, authenticated;
revoke all on function public.fail_cleanup(bigint, text)   from public, anon, authenticated;
grant execute on function public.claim_cleanup_batch(integer) to service_role;
grant execute on function public.complete_cleanup(bigint[])   to service_role;
grant execute on function public.fail_cleanup(bigint, text)   to service_role;
