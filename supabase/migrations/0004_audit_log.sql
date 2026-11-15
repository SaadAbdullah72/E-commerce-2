-- =============================================================================
-- 0004_audit_log.sql
-- Append-only admin activity log, the trigger function that writes it, and the
-- triggers on the six audited tables.
-- Needs 0001 (is_admin, user_roles), 0002 (products, categories, deal_tags) and
-- 0003 (coupons, site_banners).
-- Reconstructed from production on 2026-11-15. See 0000_baseline.sql.
-- =============================================================================

create table public.admin_audit_log (
  id           bigint generated always as identity,
  created_at   timestamptz not null default now(),
  actor_id     uuid,            -- null = the change was made directly in the database
  actor_email  text,
  action       text        not null,
  table_name   text        not null,
  record_id    text,
  record_label text,
  summary      text        not null,
  changes      jsonb,
  constraint admin_audit_log_pkey primary key (id),
  constraint admin_audit_log_action_check
    check (action = any (array['insert'::text, 'update'::text, 'delete'::text]))
);

create index admin_audit_log_created_idx on public.admin_audit_log using btree (created_at desc);
create index admin_audit_log_table_idx   on public.admin_audit_log using btree (table_name, created_at desc);

-- -----------------------------------------------------------------------------
-- Row level security: admins can read. Nobody can write from the browser; only the
-- trigger function below inserts (it runs as the table owner).
-- -----------------------------------------------------------------------------
alter table public.admin_audit_log enable row level security;

create policy "admin read audit log" on public.admin_audit_log
  for select to authenticated
  using (((select public.is_admin())));

revoke all on table public.admin_audit_log from anon, authenticated;
grant select on table public.admin_audit_log to authenticated;

-- -----------------------------------------------------------------------------
-- Append-only: block UPDATE, DELETE and TRUNCATE for everyone, including the SQL editor.
-- (To ever clear the log, drop these two triggers first, deliberately.)
-- -----------------------------------------------------------------------------
create or replace function public.audit_log_immutable()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  raise exception 'The audit log cannot be changed or deleted';
end $function$;

create trigger audit_log_no_change
  before update or delete on public.admin_audit_log
  for each row execute function public.audit_log_immutable();

create trigger audit_log_no_truncate
  before truncate on public.admin_audit_log
  for each statement execute function public.audit_log_immutable();

-- -----------------------------------------------------------------------------
-- log_admin_change(): writes one log row per change. SECURITY DEFINER so it can
-- insert although browsers have no insert right. Ignores updated_at and used_count.
-- Only admin-role changes on user_roles are logged (customer sign-ups are not).
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

-- Only the triggers run this function; nobody calls it directly.
revoke all on function public.log_admin_change() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- The six audited tables
-- -----------------------------------------------------------------------------
create trigger audit_products
  after insert or update or delete on public.products
  for each row execute function public.log_admin_change();
create trigger audit_categories
  after insert or update or delete on public.categories
  for each row execute function public.log_admin_change();
create trigger audit_deal_tags
  after insert or update or delete on public.deal_tags
  for each row execute function public.log_admin_change();
create trigger audit_coupons
  after insert or update or delete on public.coupons
  for each row execute function public.log_admin_change();
create trigger audit_site_banners
  after insert or update or delete on public.site_banners
  for each row execute function public.log_admin_change();
create trigger audit_user_roles
  after insert or update or delete on public.user_roles
  for each row execute function public.log_admin_change();
