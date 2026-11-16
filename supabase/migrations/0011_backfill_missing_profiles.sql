-- =============================================================================
-- 0011_backfill_missing_profiles.sql
-- One-off data fix: two old accounts were created before the sign-up trigger existed and have
-- no profiles row (and possibly no user_roles row). Without a profile row the new Profile
-- page cannot save anything for them.
--
-- Same rules as handle_new_user() (0001):
--   * full_name from raw_user_meta_data full_name, then name, else 'Customer' (trimmed, max 100)
--   * terms_accepted_at stays NULL and terms_version NULL: they never accepted terms in-app
--   * a 'customer' user_roles row, only if missing
-- Idempotent: safe to run twice (nothing is overwritten, existing rows are skipped).
-- Touches ONLY the two accounts listed below.
-- =============================================================================
insert into public.profiles (id, full_name, terms_accepted_at, terms_version)
select u.id,
       left(coalesce(nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name',
                                           u.raw_user_meta_data ->> 'name', '')), ''), 'Customer'), 100),
       null,
       null
  from auth.users u
 where u.email in ('saad489254@gmail.com', 'cursorsghh@gmail.com')
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select u.id, 'customer'
  from auth.users u
 where u.email in ('saad489254@gmail.com', 'cursorsghh@gmail.com')
on conflict (user_id) do nothing;

-- Check (read-only): both rows should show a profile and the 'customer' role.
select u.email, p.full_name, p.terms_accepted_at, r.role
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.user_roles r on r.user_id = u.id
 where u.email in ('saad489254@gmail.com', 'cursorsghh@gmail.com');
