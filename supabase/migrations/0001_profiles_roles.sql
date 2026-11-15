-- =============================================================================
-- 0001_profiles_roles.sql
-- Accounts: app_role enum, profiles, user_roles, is_admin(), the sign-up
-- trigger, and their row level security.
-- Reconstructed from production on 2026-11-15. See 0000_baseline.sql.
-- =============================================================================

-- Extensions (Supabase normally has these already; "if not exists" keeps this safe).
-- supabase_vault, pg_stat_statements and plpgsql are platform-managed and not created here.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

create type public.app_role as enum ('customer', 'admin');

-- Shared "touch updated_at" trigger function (used by profiles and user_roles).
create or replace function public.set_updated_at()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin new.updated_at = now(); return new; end $function$;

-- -----------------------------------------------------------------------------
-- profiles: one row per auth user (created by handle_new_user below)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                uuid        not null,
  full_name         text        not null,
  avatar_url        text,
  phone             text,
  terms_accepted_at timestamptz,
  terms_version     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade,
  constraint profiles_full_name_check
    check (char_length(btrim(full_name)) >= 1 and char_length(btrim(full_name)) <= 100),
  constraint profiles_avatar_url_check check (char_length(avatar_url) <= 2048),
  constraint profiles_phone_check check (char_length(phone) <= 32),
  constraint profiles_terms_version_check check (char_length(terms_version) <= 32)
);

-- -----------------------------------------------------------------------------
-- user_roles: one role per user. Role is read from here, never from the browser.
-- -----------------------------------------------------------------------------
create table public.user_roles (
  id         uuid        not null default gen_random_uuid(),
  user_id    uuid        not null,
  role       public.app_role not null default 'customer'::public.app_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_roles_pkey primary key (id),
  constraint user_roles_user_id_key unique (user_id),
  constraint user_roles_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger user_roles_updated_at
  before update on public.user_roles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- is_admin(): SECURITY DEFINER so policies can ask "is the caller an admin?"
-- without the caller being able to read user_roles directly.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$function$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Sign-up trigger: every new auth user gets a profile and a 'customer' role.
-- Reads full_name (email sign-up) or name (Google) from the user metadata.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_name text;
begin
  v_name := btrim(coalesce(new.raw_user_meta_data ->> 'full_name',
                           new.raw_user_meta_data ->> 'name', ''));
  v_name := left(coalesce(nullif(v_name, ''), 'Customer'), 100);

  insert into public.profiles (id, full_name, terms_accepted_at, terms_version)
  values (
    new.id, v_name,
    case when new.raw_user_meta_data ->> 'terms_accepted' = 'true' then now() end,
    left(new.raw_user_meta_data ->> 'terms_version', 32)
  );
  insert into public.user_roles (user_id, role) values (new.id, 'customer');
  return new;
end $function$;

-- Only the trigger runs this function; nobody calls it directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.user_roles enable row level security;

create policy "profiles: read own row" on public.profiles
  for select to authenticated
  using (((select auth.uid()) = id));

create policy admin_select_all_profiles on public.profiles
  for select to authenticated
  using (public.is_admin());

create policy "user_roles: read own row" on public.user_roles
  for select to authenticated
  using (((select auth.uid()) = user_id));

-- -----------------------------------------------------------------------------
-- Grants: read-only for signed-in users. (No insert/update/delete from the
-- browser; there is no update policy on profiles.)
-- -----------------------------------------------------------------------------
revoke all on table public.profiles   from anon, authenticated;
revoke all on table public.user_roles from anon, authenticated;
grant select on table public.profiles   to authenticated;
grant select on table public.user_roles to authenticated;
