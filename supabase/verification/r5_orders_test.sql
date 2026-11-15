-- =============================================================================
-- R5 orders behaviour test. NOT a migration: paste the WHOLE file into the
-- Supabase SQL Editor and run it. It places, pays, cancels and tries forbidden
-- actions, then fails ON PURPOSE so everything is rolled back. You will always see
-- a red error starting with "R5 TEST RESULTS": that is the report.
-- Needs: one customer (non-admin) account, and one active product with stock >= 8.
-- =============================================================================
do $test$
declare
  v_results jsonb := '[]'::jsonb;
  v_user    uuid;
  p         public.products%rowtype;
  v_size    text;
  v_color   text;
  v_items   jsonb;
  v_items2  jsonb;
  v_ship    jsonb := jsonb_build_object('full_name','Test Customer','email','test@example.com',
                      'phone','+10000000000','address','1 Test Street','state','Some State','city','Some City');
  v_stock0  integer;
  v_o1 jsonb; v_o2 jsonb; v_o3 jsonb; v_oc jsonb;
  v_id1 uuid; v_id2 uuid; v_id3 uuid; v_idc uuid;
  v_json    jsonb;
  v_flag    boolean;
  v_text    text;
  v_err     text;
  v_n       integer;
  v_coupon  uuid;
  v_expected integer;
begin
  begin
    -- Any customer account will do; it is only borrowed for the test.
    select u.id into v_user
      from auth.users u
     where not exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin')
     order by u.created_at limit 1;
    if v_user is null then raise exception 'no customer account found'; end if;

    select pr.* into p
      from public.products pr join public.categories c on c.id = pr.category_id
     where pr.is_active and c.is_active and pr.stock >= 8
     order by pr.stock desc limit 1;
    if not found then raise exception 'need an active product with stock >= 8'; end if;

    v_size  := p.sizes[1];
    v_color := p.colors -> 0 ->> 'name';
    v_items  := jsonb_build_array(jsonb_build_object('product_id', p.id, 'size', v_size, 'color', v_color, 'quantity', 2));
    v_items2 := jsonb_build_array(jsonb_build_object('product_id', p.id, 'size', v_size, 'color', v_color, 'quantity', 1));
    v_stock0 := p.stock;

    -- act as the test customer
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_user::text, true);

    -- 1. place an order
    execute 'set local role authenticated';
    v_o1 := public.place_order(v_items, v_ship, null);
    execute 'reset role';
    v_id1 := (v_o1 ->> 'order_id')::uuid;
    v_expected := p.price_minor * 2 + 480;
    select stock into v_n from public.products where id = p.id;
    v_results := v_results || jsonb_build_object('check','1 order placed, stock reserved, total = price x2 + 480',
      'pass', v_n = v_stock0 - 2 and (v_o1 ->> 'total_minor')::int = v_expected
              and (select status from public.orders where id = v_id1) = 'pending_payment',
      'detail', jsonb_build_object('stock_before', v_stock0, 'stock_after', v_n, 'total', v_o1 ->> 'total_minor', 'expected', v_expected));

    -- 2. get_my_order: owner sees it, a stranger gets nothing
    execute 'set local role authenticated';
    v_json := public.get_my_order(v_id1);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
    v_text := public.get_my_order(v_id1)::text;
    execute 'reset role';
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_user::text, true);
    v_results := v_results || jsonb_build_object('check','2 owner sees order with 1 line; a stranger gets null',
      'pass', jsonb_array_length(v_json -> 'items') = 1 and v_text is null,
      'detail', coalesce(v_text, 'null'));

    -- 3. cancel returns the stock; a second cancel does nothing
    execute 'set local role authenticated';
    v_flag := public.cancel_my_order(v_id1);
    execute 'reset role';
    select stock into v_n from public.products where id = p.id;
    execute 'set local role authenticated';
    v_text := public.cancel_my_order(v_id1)::text;
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','3 cancel restores stock; second cancel returns false',
      'pass', v_flag and v_n = v_stock0 and v_text = 'false'
              and (select cancel_reason from public.orders where id = v_id1) = 'customer',
      'detail', jsonb_build_object('stock_after_cancel', v_n));

    -- 4. bad carts are refused with the right code
    -- 4a: shrink the stock (rolled back at the end), then ask for more than is left
    update public.products set stock = 1 where id = p.id;
    v_err := null;
    begin
      execute 'set local role authenticated';
      perform public.place_order(v_items, v_ship, null);   -- wants 2, only 1 left
    exception when others then v_err := sqlerrm; end;
    execute 'reset role';
    update public.products set stock = v_stock0 where id = p.id;
    v_results := v_results || jsonb_build_object('check','4a more than the stock -> insufficient_stock', 'pass', coalesce(v_err, '') = 'insufficient_stock', 'detail', v_err);

    -- 4f: two lines of the same item add up to more than 99
    v_err := null;
    begin
      execute 'set local role authenticated';
      perform public.place_order(jsonb_build_array(
        jsonb_build_object('product_id', p.id, 'size', v_size, 'color', v_color, 'quantity', 60),
        jsonb_build_object('product_id', p.id, 'size', v_size, 'color', v_color, 'quantity', 60)), v_ship, null);
    exception when others then v_err := sqlerrm; end;
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','4f merged quantity over 99 -> invalid_cart', 'pass', coalesce(v_err, '') = 'invalid_cart', 'detail', v_err);

    v_err := null;
    begin
      execute 'set local role authenticated';
      perform public.place_order(jsonb_build_array(jsonb_build_object('product_id', p.id, 'quantity', 0)), v_ship, null);
    exception when others then v_err := sqlerrm; end;
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','4b quantity 0 -> invalid_cart', 'pass', coalesce(v_err, '') = 'invalid_cart', 'detail', v_err);

    v_err := null;
    begin
      execute 'set local role authenticated';
      perform public.place_order(jsonb_build_array(jsonb_build_object('product_id', gen_random_uuid(), 'quantity', 1)), v_ship, null);
    exception when others then v_err := sqlerrm; end;
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','4c unknown product -> product_unavailable', 'pass', coalesce(v_err, '') = 'product_unavailable', 'detail', v_err);

    v_err := null;
    begin
      execute 'set local role authenticated';
      perform public.place_order(v_items, v_ship || '{"address":""}'::jsonb, null);
    exception when others then v_err := sqlerrm; end;
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','4d empty address -> invalid_shipping', 'pass', coalesce(v_err, '') = 'invalid_shipping', 'detail', v_err);

    if v_size is not null then
      v_err := null;
      begin
        execute 'set local role authenticated';
        perform public.place_order(jsonb_build_array(jsonb_build_object('product_id', p.id, 'size', 'NOPE-SIZE', 'color', v_color, 'quantity', 1)), v_ship, null);
      exception when others then v_err := sqlerrm; end;
      execute 'reset role';
      v_results := v_results || jsonb_build_object('check','4e size the product does not offer -> product_unavailable', 'pass', coalesce(v_err, '') = 'product_unavailable', 'detail', v_err);
    end if;

    -- 5. coupon: applied, counted, one use per customer, returned on cancel
    insert into public.coupons (code, discount_type, percent_off, per_user_limit)
    values ('ZTEST10', 'percent', 10, 1) returning id into v_coupon;
    v_expected := (p.price_minor::bigint * 2 * 10 / 100)::integer;

    execute 'set local role authenticated';
    v_oc := public.place_order(v_items, v_ship, 'ztest10');
    execute 'reset role';
    v_idc := (v_oc ->> 'order_id')::uuid;
    select used_count into v_n from public.coupons where id = v_coupon;
    v_results := v_results || jsonb_build_object('check','5a coupon (lowercase input) gives 10% off and counts as used',
      'pass', (select discount_minor from public.orders where id = v_idc) = v_expected and v_n = 1
              and (select count(*) from public.coupon_redemptions where order_id = v_idc) = 1,
      'detail', jsonb_build_object('discount', (select discount_minor from public.orders where id = v_idc), 'expected', v_expected, 'used_count', v_n));

    v_err := null;
    begin
      execute 'set local role authenticated';
      perform public.place_order(v_items2, v_ship, 'ZTEST10');
    exception when others then v_err := sqlerrm; end;
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','5b same customer cannot reuse it -> coupon_already_used', 'pass', coalesce(v_err, '') = 'coupon_already_used', 'detail', v_err);

    execute 'set local role authenticated';
    perform public.cancel_my_order(v_idc);
    execute 'reset role';
    select used_count into v_n from public.coupons where id = v_coupon;
    v_results := v_results || jsonb_build_object('check','5c cancelling returns the coupon use',
      'pass', v_n = 0 and (select count(*) from public.coupon_redemptions where order_id = v_idc) = 0,
      'detail', jsonb_build_object('used_count', v_n));

    -- 6. payment: wrong amount is flagged, right amount marks paid, repeat is harmless
    execute 'set local role authenticated';
    v_o2 := public.place_order(v_items2, v_ship, null);
    execute 'reset role';
    v_id2 := (v_o2 ->> 'order_id')::uuid;

    execute 'set local role service_role';
    v_text := public.mark_order_paid(v_id2, 'cs_test_x', 'pi_test_x', 1, 'usd');
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','6a wrong amount -> needs_refund, order stays unpaid',
      'pass', v_text = 'needs_refund' and (select status from public.orders where id = v_id2) = 'pending_payment'
              and (select payment_issue from public.orders where id = v_id2) = 'amount_mismatch',
      'detail', v_text);

    execute 'set local role service_role';
    v_text := public.mark_order_paid(v_id2, 'cs_test_x', 'pi_test_x', (v_o2 ->> 'total_minor')::int, 'USD');
    v_err  := public.mark_order_paid(v_id2, 'cs_test_x', 'pi_test_x', (v_o2 ->> 'total_minor')::int, 'USD');
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','6b right amount -> paid; repeat -> already_paid',
      'pass', v_text = 'paid' and v_err = 'already_paid'
              and (select status from public.orders where id = v_id2) = 'paid',
      'detail', jsonb_build_object('first', v_text, 'second', v_err));

    execute 'set local role authenticated';
    v_flag := public.cancel_my_order(v_id2);
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','6c a paid order cannot be cancelled by the customer', 'pass', v_flag = false, 'detail', v_flag);

    -- paid after the order was cancelled -> flagged for refund
    execute 'set local role authenticated';
    v_o3 := public.place_order(v_items2, v_ship, null);
    execute 'reset role';
    v_id3 := (v_o3 ->> 'order_id')::uuid;
    execute 'set local role authenticated';
    perform public.cancel_my_order(v_id3);
    execute 'reset role';
    execute 'set local role service_role';
    v_text := public.mark_order_paid(v_id3, 'cs_test_y', 'pi_test_y', (v_o3 ->> 'total_minor')::int, 'usd');
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','6d paying a cancelled order -> needs_refund (paid_after_cancel)',
      'pass', v_text = 'needs_refund' and (select payment_issue from public.orders where id = v_id3) = 'paid_after_cancel'
              and (select status from public.orders where id = v_id3) = 'cancelled',
      'detail', v_text);

    -- 7. an ordered product can never be deleted
    v_err := null;
    begin
      delete from public.products where id = p.id;
    exception when others then v_err := sqlstate; end;
    v_results := v_results || jsonb_build_object('check','7 deleting an ordered product is blocked (23503)', 'pass', coalesce(v_err, '') = '23503', 'detail', v_err);

    -- 8. at most 3 open unpaid orders
    execute 'set local role authenticated';
    perform public.place_order(v_items2, v_ship, null);
    perform public.place_order(v_items2, v_ship, null);
    perform public.place_order(v_items2, v_ship, null);
    execute 'reset role';
    v_err := null;
    begin
      execute 'set local role authenticated';
      perform public.place_order(v_items2, v_ship, null);
    exception when others then v_err := sqlerrm; end;
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','8 a 4th open order is refused -> too_many_pending', 'pass', coalesce(v_err, '') = 'too_many_pending', 'detail', v_err);

    -- 9. what browsers must NOT be able to do
    v_err := null;
    begin
      execute 'set local role authenticated';
      perform public.release_order(v_id2, 'error');
    exception when others then v_err := sqlstate; end;
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','9a customer cannot call release_order (42501)', 'pass', coalesce(v_err, '') = '42501', 'detail', v_err);

    v_err := null;
    begin
      execute 'set local role authenticated';
      update public.orders set status = 'delivered' where id = v_id2;
    exception when others then v_err := sqlstate; end;
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','9b customer cannot edit an order directly (42501)', 'pass', coalesce(v_err, '') = '42501', 'detail', v_err);

    v_err := null;
    begin
      execute 'set local role anon';
      perform public.place_order(v_items2, v_ship, null);
    exception when others then v_err := sqlstate; end;
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','9c a visitor who is not signed in cannot place an order (42501)', 'pass', coalesce(v_err, '') = '42501', 'detail', v_err);

    v_err := null;
    begin
      execute 'set local role anon';
      perform count(*) from public.orders;
    exception when others then v_err := sqlstate; end;
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','9d a visitor cannot read orders (42501)', 'pass', coalesce(v_err, '') = '42501', 'detail', v_err);

  exception when others then
    execute 'reset role';
    v_results := v_results || jsonb_build_object('check','UNEXPECTED ERROR','pass', false, 'detail', sqlerrm || ' [' || sqlstate || ']');
  end;

  -- Always fail on purpose so that EVERYTHING above is rolled back.
  raise exception E'R5 TEST RESULTS (all test data was rolled back). Passed: % of %\n%',
    (select count(*) from jsonb_array_elements(v_results) r where (r ->> 'pass')::boolean),
    jsonb_array_length(v_results),
    jsonb_pretty(v_results);
end
$test$;
