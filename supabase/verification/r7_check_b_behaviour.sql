-- =============================================================================
-- R7 check B: behaviour test. NOT a migration. Paste the WHOLE file (down to the last line,
-- "$test$;") into the Supabase SQL Editor and run it AFTER 0012_admin_orders.sql and
-- r7_check_a_structure.sql.
-- It places and pays test orders, ships and delivers them as an admin, tries every forbidden
-- move as a customer, an admin and a visitor, then fails ON PURPOSE so EVERYTHING is rolled
-- back. The red error that starts with "R7 TEST RESULTS" is the report.
-- Needs: one customer (non-admin) account, one admin account, and one active product with
-- stock >= 8.
-- =============================================================================
do $test$
declare
  v_r       jsonb := '[]'::jsonb;
  v_user    uuid;
  v_admin   uuid;
  p         public.products%rowtype;
  v_items   jsonb;
  v_ship    jsonb := jsonb_build_object('full_name','Test Customer','email','test@example.com',
                      'phone','+10000000000','address','1 Test Street','state','Some State','city','Some City');
  v_o1 jsonb; v_o2 jsonb; v_o3 jsonb;
  v_id1 uuid; v_id2 uuid; v_id3 uuid;
  v_ghost   uuid := gen_random_uuid();
  v_num1    text;
  v_cur     text;
  v_total   integer;
  v_json    jsonb;
  v_s0 jsonb; v_s1 jsonb; v_s2 jsonb; v_s3 jsonb;
  v_res     text;
  v_n       integer;
  v_n2      integer;
  v_txt     text;
  v_aud     public.admin_audit_log%rowtype;
  v_row     public.orders%rowtype;
begin
  begin
    -- ---- helpers (temporary: they disappear with the rollback) ----------------------------
    create function pg_temp.act_as(p_uid uuid, p_email text, p_role text) returns void
      language plpgsql as $f$
    begin
      perform set_config('request.jwt.claims',
        jsonb_strip_nulls(jsonb_build_object('sub', p_uid, 'email', p_email, 'role', p_role))::text, true);
      perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
    end $f$;

    -- Run one statement as a role; answer 'ok' or 'SQLSTATE|message|detail'.
    create function pg_temp.try_as(p_role text, p_sql text) returns text
      language plpgsql as $f$
    declare v_out text; v_detail text;
    begin
      execute 'set local role ' || quote_ident(p_role);
      begin
        execute p_sql;
        v_out := 'ok';
      exception when others then
        get stacked diagnostics v_detail = pg_exception_detail;
        v_out := sqlstate || '|' || sqlerrm || '|' || coalesce(v_detail, '');
      end;
      execute 'reset role';
      return v_out;
    end $f$;

    create function pg_temp.rec(p_all jsonb, p_check text, p_pass boolean, p_detail jsonb)
      returns jsonb language sql as $f$
      select p_all || jsonb_build_object('check', p_check, 'pass', coalesce(p_pass, false), 'detail', p_detail)
    $f$;

    -- one number out of admin_order_stats() for a currency
    create function pg_temp.rev(p_stats jsonb, p_cur text, p_key text) returns bigint
      language sql as $f$
      select coalesce((select (e ->> p_key)::bigint
                         from jsonb_array_elements(p_stats -> 'revenue') e
                        where e ->> 'currency' = p_cur), 0)
    $f$;

    create function pg_temp.st(p_stats jsonb, p_key text) returns bigint
      language sql as $f$ select (p_stats -> 'by_status' ->> p_key)::bigint $f$;

    -- ---- who and what to borrow -----------------------------------------------------------
    select u.id into v_user
      from auth.users u
     where not exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin')
     order by u.created_at limit 1;
    if v_user is null then raise exception 'no customer account found'; end if;
    select user_id into v_admin from public.user_roles where role = 'admin' order by created_at limit 1;
    if v_admin is null then raise exception 'no admin account found'; end if;

    select pr.* into p
      from public.products pr join public.categories c on c.id = pr.category_id
     where pr.is_active and c.is_active and pr.stock >= 8
     order by pr.stock desc limit 1;
    if not found then raise exception 'need an active product with stock >= 8'; end if;
    v_items := jsonb_build_array(jsonb_build_object('product_id', p.id, 'size', p.sizes[1],
                                  'color', p.colors -> 0 ->> 'name', 'quantity', 1));

    -- ---- setup: three orders for the customer ---------------------------------------------
    perform pg_temp.act_as(v_user, 'customer@test.example', 'authenticated');
    execute 'set local role authenticated';
    v_o1 := public.place_order(v_items, v_ship, null);          -- will be paid, shipped, delivered
    v_o3 := public.place_order(v_items, v_ship, null);          -- will be cancelled
    perform public.cancel_my_order((v_o3 ->> 'order_id')::uuid);
    v_o2 := public.place_order(v_items, v_ship, null);          -- stays unpaid
    execute 'reset role';
    v_id1 := (v_o1 ->> 'order_id')::uuid;
    v_id2 := (v_o2 ->> 'order_id')::uuid;
    v_id3 := (v_o3 ->> 'order_id')::uuid;
    select order_number, currency, total_minor into v_num1, v_cur, v_total from public.orders where id = v_id1;
    update public.orders set stripe_session_id = 'cs_test_r7' where id = v_id1;

    -- stats BEFORE the payment
    perform pg_temp.act_as(v_admin, 'admin@test.example', 'authenticated');
    execute 'set local role authenticated';
    v_s0 := public.admin_order_stats();
    execute 'reset role';

    -- the "money arrived" paths, run as the server would (the webhook)
    update public.orders set payment_issue = 'paid_after_cancel' where id = v_id3;
    v_res := public.mark_order_paid(v_id1, 'cs_test_r7', 'pi_test_r7', v_total, v_cur);

    execute 'set local role authenticated';
    v_s1 := public.admin_order_stats();
    execute 'reset role';

    v_r := pg_temp.rec(v_r, '0 setup: the test order was marked paid by the webhook function', v_res = 'paid',
      to_jsonb(v_res));

    -- =========================================================================================
    -- A. THE CUSTOMER
    -- =========================================================================================
    perform pg_temp.act_as(v_user, 'customer@test.example', 'authenticated');

    execute 'set local role authenticated';
    select count(*) into v_n from (
      select order_number, status, total_minor, ship_name, ship_address, tracking_number,
             payment_issue, shipped_at, delivered_at, cancelled_at, expires_at
        from public.orders where id = v_id1) x;
    select payment_issue into v_txt from public.orders where id = v_id3;
    v_json := public.get_my_order(v_id1);
    execute 'reset role';
    v_r := pg_temp.rec(v_r, 'A1 customer can read every non-Stripe column of their own order', v_n = 1, to_jsonb(v_n));
    v_r := pg_temp.rec(v_r, 'A2 customer can still see the payment_issue flag of their own order',
      v_txt = 'paid_after_cancel', to_jsonb(v_txt));
    v_r := pg_temp.rec(v_r, 'A3 get_my_order still works for the customer (paid order, 1 line)',
      v_json ->> 'status' = 'paid' and jsonb_array_length(v_json -> 'items') = 1, v_json -> 'status');

    v_res := pg_temp.try_as('authenticated', 'select stripe_session_id from public.orders');
    v_r := pg_temp.rec(v_r, 'A4 customer cannot read stripe_session_id (42501)', left(v_res, 5) = '42501', to_jsonb(v_res));
    v_res := pg_temp.try_as('authenticated', 'select stripe_payment_intent_id from public.orders');
    v_r := pg_temp.rec(v_r, 'A5 customer cannot read stripe_payment_intent_id (42501)', left(v_res, 5) = '42501', to_jsonb(v_res));
    v_res := pg_temp.try_as('authenticated', 'select * from public.orders limit 1');
    v_r := pg_temp.rec(v_r, 'A6 customer cannot "select *" from orders (42501)', left(v_res, 5) = '42501', to_jsonb(v_res));
    v_res := pg_temp.try_as('authenticated', 'select 1 from public.orders where stripe_session_id is not null');
    v_r := pg_temp.rec(v_r, 'A7 customer cannot even filter by a Stripe column (42501)', left(v_res, 5) = '42501', to_jsonb(v_res));

    v_res := pg_temp.try_as('authenticated', format('update public.orders set tracking_number = ''X'' where id = %L', v_id1));
    v_r := pg_temp.rec(v_r, 'A8 customer cannot edit an order directly (42501)', left(v_res, 5) = '42501', to_jsonb(v_res));
    v_res := pg_temp.try_as('authenticated', format('select public.admin_get_order(%L)', v_id1));
    v_r := pg_temp.rec(v_r, 'A9 customer cannot call admin_get_order (42501)', left(v_res, 5) = '42501', to_jsonb(v_res));
    v_res := pg_temp.try_as('authenticated', format('select public.admin_update_order(%L, ''shipped'', ''X'')', v_id1));
    v_r := pg_temp.rec(v_r, 'A10 customer cannot ship their own order (42501)', left(v_res, 5) = '42501', to_jsonb(v_res));
    v_res := pg_temp.try_as('authenticated', 'select public.admin_order_stats()');
    v_r := pg_temp.rec(v_r, 'A11 customer cannot read the admin stats (42501)', left(v_res, 5) = '42501', to_jsonb(v_res));
    select status into v_txt from public.orders where id = v_id1;
    v_r := pg_temp.rec(v_r, 'A12 the order is still "paid" after those attempts', v_txt = 'paid', to_jsonb(v_txt));

    -- =========================================================================================
    -- B. A VISITOR WHO IS NOT SIGNED IN
    -- =========================================================================================
    perform pg_temp.act_as(null, null, 'anon');
    v_res := pg_temp.try_as('anon', 'select order_number from public.orders');
    v_r := pg_temp.rec(v_r, 'B1 visitor cannot read orders (42501)', left(v_res, 5) = '42501', to_jsonb(v_res));
    v_res := pg_temp.try_as('anon', format('select public.admin_get_order(%L)', v_id1));
    v_r := pg_temp.rec(v_r, 'B2 visitor cannot call admin_get_order (42501)', left(v_res, 5) = '42501', to_jsonb(v_res));
    v_res := pg_temp.try_as('anon', format('select public.admin_update_order(%L, ''shipped'', null)', v_id1));
    v_r := pg_temp.rec(v_r, 'B3 visitor cannot call admin_update_order (42501)', left(v_res, 5) = '42501', to_jsonb(v_res));
    v_res := pg_temp.try_as('anon', 'select public.admin_order_stats()');
    v_r := pg_temp.rec(v_r, 'B4 visitor cannot call admin_order_stats (42501)', left(v_res, 5) = '42501', to_jsonb(v_res));

    -- =========================================================================================
    -- C. THE ADMIN: reading
    -- =========================================================================================
    perform pg_temp.act_as(v_admin, 'admin@test.example', 'authenticated');

    execute 'set local role authenticated';
    select count(*) into v_n from public.orders where id in (v_id1, v_id2, v_id3);
    select payment_issue into v_txt from public.orders where id = v_id3;
    v_json := public.admin_get_order(v_id1);
    execute 'reset role';
    v_r := pg_temp.rec(v_r, 'C1 admin reads all three test orders directly, including payment_issue',
      v_n = 3 and v_txt = 'paid_after_cancel', jsonb_build_object('orders', v_n, 'payment_issue', v_txt));
    v_res := pg_temp.try_as('authenticated', 'select stripe_payment_intent_id from public.orders');
    v_r := pg_temp.rec(v_r, 'C2 admin cannot read Stripe columns directly either (42501)', left(v_res, 5) = '42501', to_jsonb(v_res));
    v_r := pg_temp.rec(v_r, 'C3 admin_get_order returns the Stripe ids',
      v_json ->> 'stripe_session_id' = 'cs_test_r7' and v_json ->> 'stripe_payment_intent_id' = 'pi_test_r7',
      jsonb_build_object('session', v_json -> 'stripe_session_id', 'intent', v_json -> 'stripe_payment_intent_id'));
    v_r := pg_temp.rec(v_r, 'C4 admin_get_order returns the whole order: status, address, account email, 1 line',
      v_json ->> 'status' = 'paid' and v_json ->> 'ship_address' = '1 Test Street'
      and v_json ->> 'order_number' = v_num1 and (v_json ->> 'account_email') is not null
      and jsonb_array_length(v_json -> 'items') = 1 and (v_json ->> 'user_id')::uuid = v_user,
      jsonb_build_object('account_email', v_json -> 'account_email'));
    execute 'set local role authenticated';
    v_json := public.admin_get_order(v_ghost);
    execute 'reset role';
    v_r := pg_temp.rec(v_r, 'C5 admin_get_order gives null for an order that does not exist',
      v_json is null or v_json = 'null'::jsonb, v_json);

    -- =========================================================================================
    -- D. THE ADMIN: shipping (paid -> shipped)
    -- =========================================================================================
    execute 'set local role authenticated';
    v_json := public.admin_update_order(v_id1, 'shipped', '  TRK-1  ');
    execute 'reset role';
    select * into v_row from public.orders where id = v_id1;
    v_r := pg_temp.rec(v_r, 'D1 paid -> shipped with a tracking number (trimmed)',
      v_json ->> 'status' = 'shipped' and v_json ->> 'tracking_number' = 'TRK-1' and v_json ->> 'changed' = 'true'
      and v_row.status = 'shipped' and v_row.tracking_number = 'TRK-1',
      v_json);
    v_r := pg_temp.rec(v_r, 'D2 shipped_at is filled in, delivered_at is still empty',
      v_row.shipped_at is not null and v_row.delivered_at is null,
      jsonb_build_object('shipped_at', v_row.shipped_at));

    select * into v_aud from public.admin_audit_log
     where table_name = 'orders' and record_id = v_id1::text order by id desc limit 1;
    select count(*) into v_n from public.admin_audit_log where table_name = 'orders' and record_id = v_id1::text;
    v_r := pg_temp.rec(v_r, 'D3 exactly one Activity log entry, with who, what and the order number',
      v_n = 1 and v_aud.action = 'update' and v_aud.actor_id = v_admin
      and v_aud.actor_email = 'admin@test.example' and v_aud.record_label = v_num1
      and v_aud.summary = 'Marked order ' || v_num1 || ' as shipped (tracking TRK-1)',
      jsonb_build_object('count', v_n, 'summary', v_aud.summary));
    v_r := pg_temp.rec(v_r, 'D4 the log records the status change from paid to shipped',
      v_aud.changes -> 'status' ->> 'from' = 'paid' and v_aud.changes -> 'status' ->> 'to' = 'shipped'
      and v_aud.changes -> 'tracking_number' ->> 'to' = 'TRK-1',
      v_aud.changes);

    -- a double click: the same request again does nothing and is not logged twice
    execute 'set local role authenticated';
    v_json := public.admin_update_order(v_id1, 'shipped', 'TRK-1');
    execute 'reset role';
    select count(*) into v_n from public.admin_audit_log where table_name = 'orders' and record_id = v_id1::text;
    v_r := pg_temp.rec(v_r, 'D5 repeating the same shipment is a harmless no-op (changed false, still 1 log entry)',
      v_json ->> 'changed' = 'false' and v_n = 1, jsonb_build_object('changed', v_json -> 'changed', 'log_entries', v_n));
    execute 'set local role authenticated';
    v_json := public.admin_update_order(v_id1, 'shipped', null);
    execute 'reset role';
    select count(*) into v_n from public.admin_audit_log where table_name = 'orders' and record_id = v_id1::text;
    v_r := pg_temp.rec(v_r, 'D6 asking for the current status without tracking is a no-op too',
      v_json ->> 'changed' = 'false' and v_n = 1, to_jsonb(v_n));

    -- =========================================================================================
    -- E. THE ADMIN: tracking number only
    -- =========================================================================================
    execute 'set local role authenticated';
    v_json := public.admin_update_order(v_id1, null, 'TRK-2');
    execute 'reset role';
    select * into v_aud from public.admin_audit_log
     where table_name = 'orders' and record_id = v_id1::text order by id desc limit 1;
    select * into v_row from public.orders where id = v_id1;
    v_r := pg_temp.rec(v_r, 'E1 tracking number can be changed on its own; the status stays shipped',
      v_row.tracking_number = 'TRK-2' and v_row.status = 'shipped' and v_json ->> 'changed' = 'true',
      v_json);
    v_r := pg_temp.rec(v_r, 'E2 the log says tracking changed from TRK-1 to TRK-2 and nothing about status',
      v_aud.summary = 'Updated the tracking number of order ' || v_num1
      and v_aud.changes -> 'tracking_number' ->> 'from' = 'TRK-1'
      and v_aud.changes -> 'tracking_number' ->> 'to' = 'TRK-2'
      and not (v_aud.changes ? 'status'),
      v_aud.changes);

    execute 'set local role authenticated';
    v_json := public.admin_update_order(v_id1, null, '   ');
    execute 'reset role';
    select * into v_aud from public.admin_audit_log
     where table_name = 'orders' and record_id = v_id1::text order by id desc limit 1;
    select * into v_row from public.orders where id = v_id1;
    v_r := pg_temp.rec(v_r, 'E3 a blank tracking number removes it, and the log says so',
      v_row.tracking_number is null and v_aud.summary = 'Removed the tracking number of order ' || v_num1,
      to_jsonb(v_aud.summary));

    -- stats after shipping
    execute 'set local role authenticated';
    v_s2 := public.admin_order_stats();
    execute 'reset role';

    -- =========================================================================================
    -- F. THE ADMIN: everything that must be refused (and must leave no log entry)
    -- =========================================================================================
    v_res := pg_temp.try_as('authenticated', format('select public.admin_update_order(%L, ''paid'', null)', v_id1));
    v_r := pg_temp.rec(v_r, 'F1 shipped -> paid (backwards) is refused: invalid_transition, detail shipped',
      v_res = 'P0001|invalid_transition|shipped', to_jsonb(v_res));
    v_res := pg_temp.try_as('authenticated', format('select public.admin_update_order(%L, ''shipped'', null)', v_id2));
    v_r := pg_temp.rec(v_r, 'F2 an UNPAID order cannot be shipped',
      v_res = 'P0001|invalid_transition|pending_payment', to_jsonb(v_res));
    v_res := pg_temp.try_as('authenticated', format('select public.admin_update_order(%L, ''delivered'', null)', v_id2));
    v_r := pg_temp.rec(v_r, 'F3 an unpaid order cannot be delivered',
      v_res = 'P0001|invalid_transition|pending_payment', to_jsonb(v_res));
    v_res := pg_temp.try_as('authenticated', format('select public.admin_update_order(%L, ''processing'', null)', v_id1));
    v_r := pg_temp.rec(v_r, 'F4 there is no "processing" status',
      v_res = 'P0001|invalid_transition|shipped', to_jsonb(v_res));
    v_res := pg_temp.try_as('authenticated', format('select public.admin_update_order(%L, ''pending_payment'', null)', v_id1));
    v_r := pg_temp.rec(v_r, 'F5 an order cannot be moved back to unpaid',
      v_res = 'P0001|invalid_transition|shipped', to_jsonb(v_res));
    v_res := pg_temp.try_as('authenticated', format('select public.admin_update_order(%L, ''shipped'', null)', v_id3));
    v_r := pg_temp.rec(v_r, 'F6 a CANCELLED order cannot be shipped',
      v_res = 'P0001|invalid_transition|cancelled', to_jsonb(v_res));
    v_res := pg_temp.try_as('authenticated', format('select public.admin_update_order(%L, null, ''T1'')', v_id3));
    v_r := pg_temp.rec(v_r, 'F7 a cancelled order cannot get a tracking number',
      v_res = 'P0001|invalid_transition|cancelled', to_jsonb(v_res));
    v_res := pg_temp.try_as('authenticated', format('select public.admin_update_order(%L, null, ''T1'')', v_id2));
    v_r := pg_temp.rec(v_r, 'F8 an unpaid order cannot get a tracking number',
      v_res = 'P0001|invalid_transition|pending_payment', to_jsonb(v_res));
    v_res := pg_temp.try_as('authenticated', format('select public.admin_update_order(%L, null, %L)', v_id1, repeat('x', 101)));
    v_r := pg_temp.rec(v_r, 'F9 a tracking number over 100 characters is refused',
      v_res = 'P0001|invalid_tracking|', to_jsonb(v_res));
    v_res := pg_temp.try_as('authenticated', format('select public.admin_update_order(%L, null, %L)', v_id1, 'ab' || chr(7) || 'cd'));
    v_r := pg_temp.rec(v_r, 'F10 a tracking number with control characters is refused',
      v_res = 'P0001|invalid_tracking|', to_jsonb(v_res));
    v_res := pg_temp.try_as('authenticated', format('select public.admin_update_order(%L, ''shipped'', null)', v_ghost));
    v_r := pg_temp.rec(v_r, 'F11 an order that does not exist: order_not_found (P0002)',
      v_res = 'P0002|order_not_found|', to_jsonb(v_res));
    -- a rejected request must not have been half-applied
    select * into v_row from public.orders where id = v_id1;
    select count(*) into v_n from public.admin_audit_log where table_name = 'orders' and record_id = v_id1::text;
    select count(*) into v_n2 from public.admin_audit_log where table_name = 'orders' and record_id in (v_id2::text, v_id3::text);
    v_r := pg_temp.rec(v_r, 'F12 none of the refused requests changed the order or wrote a log entry',
      v_row.status = 'shipped' and v_row.tracking_number is null and v_n = 3 and v_n2 = 0,
      jsonb_build_object('log_entries_order1', v_n, 'log_entries_orders_2_3', v_n2));

    -- =========================================================================================
    -- G. THE ADMIN: delivering (shipped -> delivered)
    -- =========================================================================================
    execute 'set local role authenticated';
    v_json := public.admin_update_order(v_id1, 'delivered', null);
    execute 'reset role';
    select * into v_row from public.orders where id = v_id1;
    select * into v_aud from public.admin_audit_log
     where table_name = 'orders' and record_id = v_id1::text order by id desc limit 1;
    v_r := pg_temp.rec(v_r, 'G1 shipped -> delivered: status, delivered_at, and shipped_at kept',
      v_row.status = 'delivered' and v_row.delivered_at is not null and v_row.shipped_at is not null,
      jsonb_build_object('delivered_at', v_row.delivered_at));
    v_r := pg_temp.rec(v_r, 'G2 the log says delivered',
      v_aud.summary = 'Marked order ' || v_num1 || ' as delivered'
      and v_aud.changes -> 'status' ->> 'from' = 'shipped',
      to_jsonb(v_aud.summary));
    v_res := pg_temp.try_as('authenticated', format('select public.admin_update_order(%L, ''shipped'', null)', v_id1));
    v_r := pg_temp.rec(v_r, 'G3 delivered -> shipped (backwards) is refused',
      v_res = 'P0001|invalid_transition|delivered', to_jsonb(v_res));
    execute 'set local role authenticated';
    v_json := public.admin_update_order(v_id1, 'delivered', null);
    v_s3 := public.admin_order_stats();
    execute 'reset role';
    select count(*) into v_n from public.admin_audit_log where table_name = 'orders' and record_id = v_id1::text;
    v_r := pg_temp.rec(v_r, 'G4 delivering twice is a no-op; the order has exactly 4 log entries in total',
      v_json ->> 'changed' = 'false' and v_n = 4, jsonb_build_object('log_entries', v_n));

    -- =========================================================================================
    -- H. THE NUMBERS (admin_order_stats)
    -- =========================================================================================
    v_r := pg_temp.rec(v_r, 'H1 stats carry every section',
      v_s1 ?& array['by_status', 'to_ship', 'needs_refund', 'revenue', 'daily', 'top_products']
      and v_s1 -> 'by_status' ?& array['pending_payment', 'paid', 'shipped', 'delivered', 'cancelled'],
      to_jsonb(array(select jsonb_object_keys(v_s1))));
    v_r := pg_temp.rec(v_r, 'H2 paying an order: paid +1, unpaid -1, to_ship +1',
      pg_temp.st(v_s1, 'paid') = pg_temp.st(v_s0, 'paid') + 1
      and pg_temp.st(v_s1, 'pending_payment') = pg_temp.st(v_s0, 'pending_payment') - 1
      and (v_s1 ->> 'to_ship')::bigint = (v_s0 ->> 'to_ship')::bigint + 1,
      jsonb_build_object('paid', pg_temp.st(v_s1, 'paid'), 'before', pg_temp.st(v_s0, 'paid')));
    v_r := pg_temp.rec(v_r, 'H3 revenue grows by exactly the order total, and the order count by one',
      pg_temp.rev(v_s1, v_cur, 'all_time_minor') = pg_temp.rev(v_s0, v_cur, 'all_time_minor') + v_total
      and pg_temp.rev(v_s1, v_cur, 'orders') = pg_temp.rev(v_s0, v_cur, 'orders') + 1
      and pg_temp.rev(v_s1, v_cur, 'last_24h_minor') >= v_total
      and pg_temp.rev(v_s1, v_cur, 'last_30d_minor') >= v_total,
      jsonb_build_object('total', v_total, 'currency', v_cur));
    v_r := pg_temp.rec(v_r, 'H4 an order with a payment problem is counted under needs_refund',
      (v_s1 ->> 'needs_refund')::bigint = (v_s0 ->> 'needs_refund')::bigint + 1,
      v_s1 -> 'needs_refund');
    v_r := pg_temp.rec(v_r, 'H5 the daily list has today with at least this order',
      exists (select 1 from jsonb_array_elements(v_s1 -> 'daily') e
               where e ->> 'currency' = v_cur
                 and (e ->> 'day')::date = (now() at time zone 'UTC')::date
                 and (e ->> 'revenue_minor')::bigint >= v_total),
      v_s1 -> 'daily');
    v_r := pg_temp.rec(v_r, 'H6 average order value is the total divided by the count',
      exists (select 1 from jsonb_array_elements(v_s1 -> 'revenue') e
               where e ->> 'currency' = v_cur
                 and (e ->> 'average_order_minor')::bigint = ((e ->> 'all_time_minor')::bigint / (e ->> 'orders')::bigint)),
      v_s1 -> 'revenue');
    v_r := pg_temp.rec(v_r, 'H7 shipping moves the order from paid to shipped and leaves revenue alone',
      pg_temp.st(v_s2, 'shipped') = pg_temp.st(v_s1, 'shipped') + 1
      and pg_temp.st(v_s2, 'paid') = pg_temp.st(v_s1, 'paid') - 1
      and (v_s2 ->> 'to_ship')::bigint = (v_s1 ->> 'to_ship')::bigint - 1
      and pg_temp.rev(v_s2, v_cur, 'all_time_minor') = pg_temp.rev(v_s1, v_cur, 'all_time_minor'),
      to_jsonb(pg_temp.st(v_s2, 'shipped')));
    v_r := pg_temp.rec(v_r, 'H8 delivering moves it from shipped to delivered and leaves revenue alone',
      pg_temp.st(v_s3, 'delivered') = pg_temp.st(v_s2, 'delivered') + 1
      and pg_temp.st(v_s3, 'shipped') = pg_temp.st(v_s2, 'shipped') - 1
      and pg_temp.rev(v_s3, v_cur, 'all_time_minor') = pg_temp.rev(v_s2, v_cur, 'all_time_minor'),
      to_jsonb(pg_temp.st(v_s3, 'delivered')));
    v_r := pg_temp.rec(v_r, 'H9 the unpaid and the cancelled test orders are counted by status but add no revenue',
      pg_temp.rev(v_s3, v_cur, 'all_time_minor') = pg_temp.rev(v_s0, v_cur, 'all_time_minor') + v_total
      and pg_temp.st(v_s3, 'cancelled') >= 1 and pg_temp.st(v_s3, 'pending_payment') >= 1,
      jsonb_build_object('cancelled', pg_temp.st(v_s3, 'cancelled'), 'unpaid', pg_temp.st(v_s3, 'pending_payment')));

  exception when others then
    execute 'reset role';
    v_r := v_r || jsonb_build_object('check','UNEXPECTED ERROR','pass', false, 'detail', sqlerrm || ' [' || sqlstate || ']');
  end;

  -- Always fail on purpose so that EVERYTHING above is rolled back.
  raise exception E'R7 TEST RESULTS (all test data was rolled back). Passed: % of %\n%',
    (select count(*) from jsonb_array_elements(v_r) r where (r ->> 'pass')::boolean),
    jsonb_array_length(v_r),
    jsonb_pretty(v_r);
end
$test$;
