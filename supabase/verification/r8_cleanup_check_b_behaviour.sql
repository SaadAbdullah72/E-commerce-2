-- =============================================================================
-- R8 cleanup check B: behaviour test. NOT a migration. Paste the WHOLE file (down to the last
-- line, "$test$;") into the Supabase SQL Editor and run it AFTER 0014_cleanup.sql.
-- It proves that dropping two policies and revoking EXECUTE on trigger functions broke nothing:
-- reads still work for visitors, customers and admins, the triggers still fire for them, and the
-- trigger functions can no longer be called directly. It then fails ON PURPOSE so everything is
-- rolled back. The red error that starts with "R8 CLEANUP TEST RESULTS" is the report.
-- Needs: one customer (non-admin) with a profile, one admin, one product.
-- =============================================================================
do $test$
declare
  v_r      jsonb := '[]'::jsonb;
  v_user   uuid;
  v_admin  uuid;
  v_prod   uuid;
  v_res    text;
  v_res2   text;
  v_res3   text;
  v_all    integer;
  v_active integer;
  v_old    timestamptz := now() - interval '3 days';
  v_new    timestamptz;
  v_audit  bigint;
begin
  begin
    create function pg_temp.act_as(p_uid uuid, p_email text, p_role text) returns void
      language plpgsql as $f$
    begin
      perform set_config('request.jwt.claims',
        jsonb_strip_nulls(jsonb_build_object('sub', p_uid, 'email', p_email, 'role', p_role))::text, true);
      perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
    end $f$;

    -- Run one statement that returns one value, as a role: 'ok|<value>' or 'SQLSTATE|message'.
    create function pg_temp.call_as(p_role text, p_sql text) returns text
      language plpgsql as $f$
    declare v_out text; v_val text;
    begin
      execute 'set local role ' || quote_ident(p_role);
      begin
        execute p_sql into v_val;
        v_out := 'ok|' || coalesce(v_val, '');
      exception when others then
        v_out := sqlstate || '|' || sqlerrm;
      end;
      execute 'reset role';
      return v_out;
    end $f$;

    create function pg_temp.rec(p_all jsonb, p_check text, p_pass boolean, p_detail jsonb)
      returns jsonb language sql as $f$
      select p_all || jsonb_build_object('check', p_check, 'pass', coalesce(p_pass, false), 'detail', p_detail)
    $f$;

    select u.id into v_user from auth.users u
      join public.profiles pr on pr.id = u.id
     where not exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin')
     order by u.created_at limit 1;
    if v_user is null then raise exception 'no customer with a profile found'; end if;
    select user_id into v_admin from public.user_roles where role = 'admin' order by created_at limit 1;
    if v_admin is null then raise exception 'no admin account found'; end if;
    select id into v_prod from public.products order by created_at limit 1;
    if v_prod is null then raise exception 'no product found'; end if;

    -- ---- reads still work --------------------------------------------------------------
    select count(*) into v_all from public.products;
    select count(*) into v_active from public.products where is_active;

    perform pg_temp.act_as(null, null, 'anon');
    v_res := pg_temp.call_as('anon', 'select count(*)::text from public.products');
    v_res2 := pg_temp.call_as('anon', 'select count(*)::text from public.categories');
    v_r := pg_temp.rec(v_r, 'R1 a visitor sees only active products and categories',
      v_res = 'ok|' || v_active and v_res2 = 'ok|' || (select count(*) from public.categories where is_active),
      jsonb_build_array(v_res, v_res2));

    perform pg_temp.act_as(v_admin, 'admin@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', 'select count(*)::text from public.products');
    v_res2 := pg_temp.call_as('authenticated', 'select count(*)::text from public.categories');
    v_res3 := pg_temp.call_as('authenticated', 'select count(*)::text from public.profiles');
    v_r := pg_temp.rec(v_r, 'R2 an admin still sees EVERY product, category and profile (also the inactive ones)',
      v_res = 'ok|' || v_all and v_res2 = 'ok|' || (select count(*) from public.categories)
      and v_res3 = 'ok|' || (select count(*) from public.profiles),
      jsonb_build_array(v_res, v_res2, v_res3));

    perform pg_temp.act_as(v_user, 'customer@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', 'select count(*)::text from public.profiles');
    v_res2 := pg_temp.call_as('authenticated', 'select count(*)::text from public.products');
    v_r := pg_temp.rec(v_r, 'R3 a customer sees only their own profile and only active products',
      v_res = 'ok|1' and v_res2 = 'ok|' || v_active, jsonb_build_array(v_res, v_res2));

    -- ---- triggers still fire for people who lost EXECUTE -------------------------------
    update public.products set updated_at = v_old where id = v_prod;
    update public.profiles set updated_at = v_old where id = v_user;

    perform pg_temp.act_as(v_user, 'customer@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated',
      format('update public.profiles set full_name = full_name where id = %L returning ''done''', v_user));
    select updated_at into v_new from public.profiles where id = v_user;
    v_r := pg_temp.rec(v_r, 'T1 a customer saving their profile still moves updated_at (set_updated_at trigger fires)',
      v_new > v_old, jsonb_build_array(v_res, v_new));

    select coalesce(max(id), 0) into v_audit from public.admin_audit_log;
    perform pg_temp.act_as(v_admin, 'admin@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated',
      format('update public.products set stock = stock + 1 where id = %L returning ''done''', v_prod));
    select updated_at into v_new from public.products where id = v_prod;
    v_r := pg_temp.rec(v_r, 'T2 an admin editing a product still moves updated_at (catalog_set_updated_at fires)',
      v_new > v_old, jsonb_build_array(v_res, v_new));
    v_r := pg_temp.rec(v_r, 'T3 ...and the Activity log still records it',
      exists (select 1 from public.admin_audit_log where id > v_audit and table_name = 'products'
                 and record_id = v_prod::text), to_jsonb(v_audit));

    -- the log can never be edited: the guard trigger still runs (and answers with its own error,
    -- not "permission denied")
    v_res := pg_temp.call_as('postgres',
      format('update public.admin_audit_log set summary = ''x'' where id > %s returning ''changed''', v_audit));
    v_r := pg_temp.rec(v_r, 'T4 the Activity log is still protected from edits (audit_log_immutable fires)',
      left(v_res, 3) <> 'ok|' and v_res not like '42501%' and v_res not like '%permission denied%', to_jsonb(v_res));

    -- ---- nobody can call a trigger function by hand ------------------------------------
    perform pg_temp.act_as(v_user, 'customer@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', 'select public.set_updated_at()::text');
    v_res2 := pg_temp.call_as('authenticated', 'select public.catalog_set_updated_at()::text');
    perform pg_temp.act_as(null, null, 'anon');
    v_res3 := pg_temp.call_as('anon', 'select public.audit_log_immutable()::text');
    v_r := pg_temp.rec(v_r, 'X1 trigger functions are closed to customers and visitors (42501)',
      left(v_res, 5) = '42501' and left(v_res2, 5) = '42501' and left(v_res3, 5) = '42501',
      jsonb_build_array(left(v_res, 5), left(v_res2, 5), left(v_res3, 5)));

    -- ---- things that must NOT have changed ----------------------------------------------
    v_res := pg_temp.call_as('anon', 'select public.is_admin()::text');
    v_r := pg_temp.rec(v_r, 'K1 is_admin() is still callable (the policies need it)', v_res = 'ok|false', to_jsonb(v_res));
    v_r := pg_temp.rec(v_r, 'K2 the other admin read policies are still there',
      (select count(*) from pg_policies where schemaname = 'public'
         and policyname in ('categories: admin read all', 'products: admin read all')) = 2,
      null);

  exception when others then
    execute 'reset role';
    v_r := v_r || jsonb_build_object('check', 'UNEXPECTED ERROR', 'pass', false, 'detail', sqlerrm || ' [' || sqlstate || ']');
  end;

  -- Always fail on purpose so that EVERYTHING above is rolled back.
  raise exception E'R8 CLEANUP TEST RESULTS (all test data was rolled back). Passed: % of %\n%',
    (select count(*) from jsonb_array_elements(v_r) r where (r ->> 'pass')::boolean),
    jsonb_array_length(v_r),
    jsonb_pretty(v_r);
end
$test$;
