-- =============================================================================
-- R6 check B: behaviour test. NOT a migration. Paste the WHOLE file into the Supabase SQL
-- Editor and run it AFTER 0010_profile_and_orders.sql and r6_check_a_structure.sql.
-- It edits a profile, tries forbidden edits, places and cancels orders and pages through
-- them, then fails ON PURPOSE so EVERYTHING is rolled back. The red error that starts with
-- "R6 TEST RESULTS" is the report.
-- Needs: one customer (non-admin) account that has a profile row, one other account, and one
-- active product with stock >= 8.
-- =============================================================================
do $test$
declare
  v_results jsonb := '[]'::jsonb;
  v_user    uuid;
  v_other   uuid;
  v_old     timestamptz;
  v_row     public.profiles%rowtype;
  v_name    text;
  v_frag    text;
  v_err     text;
  v_n       integer;
  p         public.products%rowtype;
  v_items   jsonb;
  v_ship    jsonb := jsonb_build_object('full_name','Test Customer','email','test@example.com',
                      'phone','+10000000000','address','1 Test Street','state','Some State','city','Some City');
  v_o1 jsonb; v_o2 jsonb; v_o3 jsonb;
  v_id1 uuid; v_id2 uuid; v_id3 uuid;
  v_json    jsonb;
  v_json2   jsonb;
  v_page    jsonb;
  v_cur_at  text;
  v_cur_id  uuid;
  v_ids     uuid[] := '{}';
  v_all     uuid[];
  v_loops   integer := 0;
begin
  begin
    -- A customer who HAS a profile row (some old accounts have none; editing would match nothing).
    select u.id into v_user
      from auth.users u
      join public.profiles pr on pr.id = u.id
     where not exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin')
     order by u.created_at limit 1;
    if v_user is null then raise exception 'no customer account with a profile row found'; end if;
    select id into v_other from public.profiles where id <> v_user order by created_at limit 1;

    select pr.* into p
      from public.products pr join public.categories c on c.id = pr.category_id
     where pr.is_active and c.is_active and pr.stock >= 8
     order by pr.stock desc limit 1;
    if not found then raise exception 'need an active product with stock >= 8'; end if;
    v_items := jsonb_build_array(jsonb_build_object('product_id', p.id, 'size', p.sizes[1],
                                  'color', p.colors -> 0 ->> 'name', 'quantity', 1));

    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_user::text, true);

    -- 1. a customer can edit their own five columns
    select updated_at into v_old from public.profiles where id = v_user;
    execute 'set local role authenticated';
    update public.profiles
       set full_name = 'R6 Test Name', phone = '+10000000000', default_address = '1 Test Street',
           default_city = 'Test City', default_state = 'Test State'
     where id = v_user;
    get diagnostics v_n = row_count;
    execute 'reset role';
    select * into v_row from public.profiles where id = v_user;
    v_results := v_results || jsonb_build_object('check','1 own profile: name, phone and default address can be changed',
      'pass', v_n = 1 and v_row.full_name = 'R6 Test Name' and v_row.phone = '+10000000000'
              and v_row.default_address = '1 Test Street' and v_row.default_city = 'Test City'
              and v_row.default_state = 'Test State' and v_row.updated_at > v_old,
      'detail', jsonb_build_object('rows', v_n, 'updated_at_moved', v_row.updated_at > v_old));

    -- 2. ...but never someone else's row (row level security: it simply matches nothing)
    if v_other is not null then
      select full_name into v_name from public.profiles where id = v_other;
      execute 'set local role authenticated';
      update public.profiles set full_name = 'HACKED' where id = v_other;
      get diagnostics v_n = row_count;
      execute 'reset role';
      v_results := v_results || jsonb_build_object('check','2 another customer''s profile cannot be changed',
        'pass', v_n = 0 and (select full_name from public.profiles where id = v_other) = v_name,
        'detail', jsonb_build_object('rows', v_n));
    end if;

    -- 3. protected columns are refused by the database itself (42501)
    foreach v_frag in array array[
      'avatar_url = ''https://x.example/a.png''',
      'terms_version = ''v9''',
      'terms_accepted_at = now()',
      'created_at = now()',
      'updated_at = now()',
      'id = gen_random_uuid()'
    ] loop
      v_err := null;
      begin
        execute 'set local role authenticated';
        execute 'update public.profiles set ' || v_frag || ' where id = $1' using v_user;
      exception when others then v_err := sqlstate; end;
      execute 'reset role';
      v_results := v_results || jsonb_build_object('check','3 protected column refused: ' || v_frag,
        'pass', coalesce(v_err, '') = '42501', 'detail', v_err);
    end loop;

    -- 4. bad values are refused (23514 = check constraint)
    foreach v_frag in array array[
      'full_name = ''''',
      'full_name = repeat(''x'', 101)',
      'phone = repeat(''1'', 33)',
      'default_address = repeat(''a'', 301)',
      'default_address = ''   ''',
      'default_city = repeat(''c'', 101)',
      'default_state = ''  '''
    ] loop
      v_err := null;
      begin
        execute 'set local role authenticated';
        execute 'update public.profiles set ' || v_frag || ' where id = $1' using v_user;
      exception when others then v_err := sqlstate; end;
      execute 'reset role';
      v_results := v_results || jsonb_build_object('check','4 bad value refused: ' || v_frag,
        'pass', coalesce(v_err, '') = '23514', 'detail', v_err);
    end loop;

    -- 5. the default address can be cleared (NULL)
    execute 'set local role authenticated';
    update public.profiles set default_address = null, default_city = null, default_state = null where id = v_user;
    get diagnostics v_n = row_count;
    execute 'reset role';
    select * into v_row from public.profiles where id = v_user;
    v_results := v_results || jsonb_build_object('check','5 default address can be cleared',
      'pass', v_n = 1 and v_row.default_address is null and v_row.default_city is null and v_row.default_state is null,
      'detail', v_n);

    -- 6. a visitor who is not signed in cannot edit anything
    v_err := null;
    begin
      execute 'set local role anon';
      update public.profiles set full_name = 'X' where id = v_user;
    exception when others then v_err := sqlstate; end;
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','6 anonymous visitor cannot edit a profile (42501)',
      'pass', coalesce(v_err, '') = '42501', 'detail', v_err);

    -- 7. get_my_order now carries the timeline dates
    execute 'set local role authenticated';
    v_o1 := public.place_order(v_items, v_ship, null);
    execute 'reset role';
    v_id1 := (v_o1 ->> 'order_id')::uuid;
    execute 'set local role authenticated';
    v_json := public.get_my_order(v_id1);
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','7a pending order: has shipped_at, delivered_at, cancelled_at (null) and expires_at (set)',
      'pass', v_json ? 'shipped_at' and v_json ? 'delivered_at' and v_json ? 'cancelled_at' and v_json ? 'expires_at'
              and v_json -> 'shipped_at' = 'null'::jsonb and v_json -> 'delivered_at' = 'null'::jsonb
              and v_json -> 'cancelled_at' = 'null'::jsonb and v_json -> 'expires_at' <> 'null'::jsonb,
      'detail', jsonb_build_object('expires_at', v_json -> 'expires_at'));

    execute 'set local role authenticated';
    perform public.cancel_my_order(v_id1);
    v_json2 := public.get_my_order(v_id1);
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','7b cancelled order: cancelled_at is filled in, status cancelled',
      'pass', v_json2 ->> 'status' = 'cancelled' and v_json2 -> 'cancelled_at' <> 'null'::jsonb
              and v_json2 -> 'shipped_at' = 'null'::jsonb,
      'detail', v_json2 -> 'cancelled_at');

    -- 8. cursor pagination: no repeats, no gaps, even when created_at is identical
    --    (all test orders below share ONE created_at because they are made in one transaction)
    execute 'set local role authenticated';
    v_o2 := public.place_order(v_items, v_ship, null);
    perform public.cancel_my_order((v_o2 ->> 'order_id')::uuid);
    v_o3 := public.place_order(v_items, v_ship, null);
    execute 'reset role';
    v_id2 := (v_o2 ->> 'order_id')::uuid;
    v_id3 := (v_o3 ->> 'order_id')::uuid;

    execute 'set local role authenticated';
    loop
      v_loops := v_loops + 1;
      exit when v_loops > 200;
      -- the same (created_at, id) rule the app will use: older created_at, or same created_at and smaller id
      select jsonb_agg(jsonb_build_object('id', x.id, 'at', x.created_at::text) order by x.created_at desc, x.id desc)
        into v_page
        from (
          select id, created_at from public.orders
           where v_cur_at is null
              or created_at < v_cur_at::timestamptz
              or (created_at = v_cur_at::timestamptz and id < v_cur_id)
           order by created_at desc, id desc
           limit 2
        ) x;
      exit when v_page is null;
      v_ids := v_ids || (select array_agg((e ->> 'id')::uuid order by ord)
                           from jsonb_array_elements(v_page) with ordinality as t(e, ord));
      v_cur_at := v_page -> -1 ->> 'at';
      v_cur_id := (v_page -> -1 ->> 'id')::uuid;
    end loop;
    select array_agg(id order by created_at desc, id desc) into v_all from public.orders;
    execute 'reset role';

    v_results := v_results || jsonb_build_object('check','8a paging 2 at a time returns every order once, in the same order as one big query',
      'pass', v_ids = v_all and (select count(distinct u) from unnest(v_ids) u) = cardinality(v_ids)
              and v_id1 = any (v_ids) and v_id2 = any (v_ids) and v_id3 = any (v_ids),
      'detail', jsonb_build_object('orders_seen', cardinality(v_ids), 'pages', v_loops - 1));
    v_results := v_results || jsonb_build_object('check','8b the three test orders really share one created_at (tie-break was exercised)',
      'pass', (select count(distinct created_at) from public.orders where id in (v_id1, v_id2, v_id3)) = 1,
      'detail', null);

  exception when others then
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','UNEXPECTED ERROR','pass', false, 'detail', sqlerrm || ' [' || sqlstate || ']');
  end;

  -- Always fail on purpose so that EVERYTHING above is rolled back.
  raise exception E'R6 TEST RESULTS (all test data was rolled back). Passed: % of %\n%',
    (select count(*) from jsonb_array_elements(v_results) r where (r ->> 'pass')::boolean),
    jsonb_array_length(v_results),
    jsonb_pretty(v_results);
end
$test$;
