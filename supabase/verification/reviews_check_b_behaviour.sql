-- =============================================================================
-- Reviews check B: behaviour test. NOT a migration. Paste the WHOLE file (down to the last line,
-- "$test$;") into the Supabase SQL Editor and run it AFTER 0013_reviews.sql and
-- reviews_check_a_structure.sql.
-- It buys a product, writes reviews with photos and a video, moderates, edits and deletes them,
-- tries every forbidden move as a customer, an admin and a visitor, then fails ON PURPOSE so
-- EVERYTHING is rolled back. The red error that starts with "REVIEWS TEST RESULTS" is the report.
-- Needs: one customer (non-admin) account, one admin account, and two active products with
-- stock (one with stock >= 2) that the customer has not bought and has not reviewed.
-- =============================================================================
do $test$
declare
  v_r       jsonb := '[]'::jsonb;
  v_user    uuid;
  v_admin   uuid;
  p         public.products%rowtype;
  p2        public.products%rowtype;
  v_items   jsonb;
  v_items2  jsonb;
  v_ship    jsonb := jsonb_build_object('full_name','Test Customer','email','test@example.com',
                      'phone','+10000000000','address','1 Test Street','state','Some State','city','Some City');
  v_o1 jsonb; v_o2 jsonb;
  v_id1 uuid; v_id2 uuid;
  v_total   integer;
  v_cur     text;
  v_pay     text;
  r1        uuid := gen_random_uuid();
  r2        uuid := gen_random_uuid();
  v_ghost   uuid := gen_random_uuid();
  pa text; pb text; pv text; pc text; pd text; pw text; pe text; pf text; px text;
  v_res     text;
  v_res2    text;
  v_res3    text;
  v_res4    text;
  v_res5    text;
  v_j       jsonb;
  v_n       integer;
  v_n2      integer;
  v_txt     text;
  v_cnt0    integer;
  v_avg0    numeric;
  v_paud0   integer;
  v_token   text := 'rvzz-' || substr(gen_random_uuid()::text, 1, 8);
  v_aud     public.admin_audit_log%rowtype;
  v_rev     public.reviews%rowtype;
  v_media_a uuid;
  v_media_e uuid;
  v_created timestamptz;
  v_stop    text;
  v_ok      integer;
  v_a       integer;
  v_b       integer;
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

    -- Run one statement that returns one value, as a role. Answers 'ok|<value>' or
    -- 'SQLSTATE|message|detail'.
    create function pg_temp.call_as(p_role text, p_sql text) returns text
      language plpgsql as $f$
    declare v_out text; v_detail text; v_val text;
    begin
      execute 'set local role ' || quote_ident(p_role);
      begin
        execute p_sql into v_val;
        v_out := 'ok|' || coalesce(v_val, '');
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

    -- one media item, shaped like what the browser sends after a Cloudinary upload
    create function pg_temp.mk(p_review uuid, p_pid text, p_kind text,
                               p_bytes integer default 100000, p_dur numeric default null)
      returns jsonb language sql as $f$
      select jsonb_build_object(
        'media_type', p_kind,
        'url', 'https://res.cloudinary.com/demo/' || case p_kind when 'photo' then 'image' else 'video' end
               || '/upload/v1700000000/' || p_pid || case p_kind when 'photo' then '.jpg' else '.mp4' end,
        'public_id', p_pid, 'width', 800, 'height', 600, 'duration_seconds', p_dur, 'bytes', p_bytes)
    $f$;

    create function pg_temp.sub_sql(p_id uuid, p_prod uuid, p_rating integer, p_title text, p_comment text,
                                    p_media jsonb) returns text language sql as $f$
      select format('select public.submit_review(%L, %L, %s, %L, %L, %L::jsonb)::text',
                    p_id, p_prod, coalesce(p_rating::text, 'null'), p_title, p_comment, p_media::text)
    $f$;

    create function pg_temp.edit_sql(p_id uuid, p_rating integer, p_title text, p_comment text,
                                     p_media jsonb) returns text language sql as $f$
      select format('select public.edit_my_review(%L, %s, %L, %L, %L::jsonb)::text',
                    p_id, coalesce(p_rating::text, 'null'), p_title, p_comment, p_media::text)
    $f$;

    create function pg_temp.slot_sql(p_review uuid, p_kind text) returns text language sql as $f$
      select format('select public.reserve_review_upload(%L, %L)', p_review, p_kind)
    $f$;

    -- ---- who and what to borrow -----------------------------------------------------------
    select u.id into v_user
      from auth.users u
     where not exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin')
     order by u.created_at limit 1;
    if v_user is null then raise exception 'no customer account found'; end if;
    select user_id into v_admin from public.user_roles where role = 'admin' order by created_at limit 1;
    if v_admin is null then raise exception 'no admin account found'; end if;

    -- the product the customer buys and reviews
    select pr.* into p
      from public.products pr join public.categories c on c.id = pr.category_id
     where pr.is_active and c.is_active and pr.stock >= 2
       and not exists (select 1 from public.reviews rv where rv.product_id = pr.id and rv.user_id = v_user)
     order by pr.stock desc limit 1;
    if not found then raise exception 'need an active product with stock >= 2 that the customer has not reviewed'; end if;

    -- a product the customer has NOT bought (only an unpaid order will exist for it)
    select pr.* into p2
      from public.products pr join public.categories c on c.id = pr.category_id
     where pr.is_active and c.is_active and pr.stock >= 1 and pr.id <> p.id
       and not exists (select 1 from public.orders o join public.order_items i on i.order_id = o.id
                        where o.user_id = v_user and i.product_id = pr.id
                          and o.status in ('paid', 'shipped', 'delivered'))
     order by pr.stock desc limit 1;
    if not found then raise exception 'need a second active product the customer has not bought'; end if;

    v_items  := jsonb_build_array(jsonb_build_object('product_id', p.id, 'size', p.sizes[1],
                                    'color', p.colors -> 0 ->> 'name', 'quantity', 1));
    v_items2 := jsonb_build_array(jsonb_build_object('product_id', p2.id, 'size', p2.sizes[1],
                                    'color', p2.colors -> 0 ->> 'name', 'quantity', 1));

    -- ---- setup: a PAID order for p, an UNPAID order for p2 --------------------------------
    perform pg_temp.act_as(v_user, 'customer@test.example', 'authenticated');
    execute 'set local role authenticated';
    v_o1 := public.place_order(v_items, v_ship, null);
    v_o2 := public.place_order(v_items2, v_ship, null);
    execute 'reset role';
    v_id1 := (v_o1 ->> 'order_id')::uuid;
    v_id2 := (v_o2 ->> 'order_id')::uuid;
    select currency, total_minor into v_cur, v_total from public.orders where id = v_id1;
    update public.orders set stripe_session_id = 'cs_test_rv' where id = v_id1;
    v_pay := public.mark_order_paid(v_id1, 'cs_test_rv', 'pi_test_rv', v_total, v_cur);

    select rating_count, rating_avg into v_cnt0, v_avg0 from public.products where id = p.id;
    select count(*) into v_paud0 from public.admin_audit_log
     where table_name = 'products' and record_id = p.id::text;

    v_r := pg_temp.rec(v_r, '0 setup: the order for the product was paid', v_pay = 'paid', to_jsonb(v_pay));

    -- =========================================================================================
    -- A. WHO MAY REVIEW
    -- =========================================================================================
    perform pg_temp.act_as(v_user, 'customer@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', format('select public.my_review_state(%L)::text', p.id));
    v_j := substr(v_res, 4)::jsonb;
    v_r := pg_temp.rec(v_r, 'A1 a customer with a paid order for the product may review it',
      left(v_res, 3) = 'ok|' and v_j ->> 'eligible' = 'true' and v_j -> 'review' = 'null'::jsonb, v_j);
    v_res := pg_temp.call_as('authenticated', format('select public.my_review_state(%L)::text', p2.id));
    v_j := substr(v_res, 4)::jsonb;
    v_r := pg_temp.rec(v_r, 'A2 an UNPAID order does not count: not_purchased',
      v_j ->> 'eligible' = 'false' and v_j ->> 'reason' = 'not_purchased', v_j);
    perform pg_temp.act_as(null, null, 'anon');
    v_res := pg_temp.call_as('anon', format('select public.my_review_state(%L)::text', p.id));
    v_r := pg_temp.rec(v_r, 'A3 a visitor cannot ask (42501)', left(v_res, 5) = '42501', to_jsonb(v_res));

    -- =========================================================================================
    -- S. UPLOAD SLOTS (reserve_review_upload)
    -- =========================================================================================
    perform pg_temp.act_as(v_user, 'customer@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', pg_temp.slot_sql(r1, 'photo')); pa := substr(v_res, 4);
    v_r := pg_temp.rec(v_r, 'S1 a slot answers with a public_id inside the review''s own folder',
      left(v_res, 3) = 'ok|' and pa ~ ('^shopyaro/reviews/' || r1::text || '/photo/[0-9a-f]{32}$'), to_jsonb(pa));
    v_res := pg_temp.call_as('authenticated', pg_temp.slot_sql(r1, 'photo')); pb := substr(v_res, 4);
    v_res := pg_temp.call_as('authenticated', pg_temp.slot_sql(r1, 'video')); pv := substr(v_res, 4);
    v_res2 := pg_temp.call_as('authenticated', pg_temp.slot_sql(r1, 'photo')); pc := substr(v_res2, 4);
    v_res3 := pg_temp.call_as('authenticated', pg_temp.slot_sql(r1, 'photo')); pd := substr(v_res3, 4);
    v_res4 := pg_temp.call_as('authenticated', pg_temp.slot_sql(r1, 'video')); pw := substr(v_res4, 4);
    v_res5 := pg_temp.call_as('authenticated', pg_temp.slot_sql(r1, 'photo')); pe := substr(v_res5, 4);
    select count(*) into v_n from public.review_upload_log where user_id = v_user and review_id = r1;
    v_r := pg_temp.rec(v_r, 'S2 every slot is written to the upload log, and a video slot says video',
      v_n = 7 and pv ~ '/video/[0-9a-f]{32}$' and pb <> pa and pc <> pd,
      jsonb_build_object('slots', v_n, 'video', pv));
    v_res := pg_temp.call_as('authenticated', pg_temp.slot_sql(r1, 'gif'));
    v_r := pg_temp.rec(v_r, 'S3 only photo and video slots exist (invalid_kind)',
      v_res = 'P0001|invalid_kind|', to_jsonb(v_res));
    perform pg_temp.act_as(null, null, 'anon');
    v_res := pg_temp.call_as('anon', pg_temp.slot_sql(r1, 'photo'));
    v_r := pg_temp.rec(v_r, 'S4 a visitor cannot get an upload slot (42501)', left(v_res, 5) = '42501', to_jsonb(v_res));

    -- =========================================================================================
    -- B. A REVIEW THAT MUST BE REFUSED (and must leave nothing behind)
    -- =========================================================================================
    perform pg_temp.act_as(v_user, 'customer@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 0, null, 'ok', '[]'::jsonb));
    v_r := pg_temp.rec(v_r, 'B1 rating 0 is refused', v_res = 'P0001|rating_invalid|', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 6, null, 'ok', '[]'::jsonb));
    v_r := pg_temp.rec(v_r, 'B2 rating 6 is refused', v_res = 'P0001|rating_invalid|', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, repeat('x', 101), 'ok', '[]'::jsonb));
    v_r := pg_temp.rec(v_r, 'B3 a title over 100 characters is refused', v_res = 'P0001|text_invalid|title', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, 'a' || chr(7) || 'b', 'ok', '[]'::jsonb));
    v_r := pg_temp.rec(v_r, 'B4 a title with a control character is refused', v_res = 'P0001|text_invalid|title', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, null, repeat('x', 2001), '[]'::jsonb));
    v_r := pg_temp.rec(v_r, 'B5 a comment over 2000 characters is refused', v_res = 'P0001|text_invalid|comment', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, null, 'a' || chr(7) || 'b', '[]'::jsonb));
    v_r := pg_temp.rec(v_r, 'B6 a comment with a control character is refused', v_res = 'P0001|text_invalid|comment', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p2.id, 5, null, 'ok', '[]'::jsonb));
    v_r := pg_temp.rec(v_r, 'B7 a product that was only ordered (unpaid), not bought: not_purchased',
      v_res = 'P0001|not_purchased|', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, v_ghost, 5, null, 'ok', '[]'::jsonb));
    v_r := pg_temp.rec(v_r, 'B8 a product that does not exist: product_not_found (P0002)',
      v_res = 'P0002|product_not_found|', to_jsonb(v_res));

    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, null, 'ok',
      jsonb_build_array(pg_temp.mk(r1, pa, 'photo'), pg_temp.mk(r1, pb, 'photo'),
                        pg_temp.mk(r1, pc, 'photo'), pg_temp.mk(r1, pd, 'photo'))));
    v_r := pg_temp.rec(v_r, 'B9 four photos are too many (max 3)', v_res = 'P0001|media_invalid|too_many', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, null, 'ok',
      jsonb_build_array(pg_temp.mk(r1, pv, 'video', 100000, 10), pg_temp.mk(r1, pw, 'video', 100000, 10))));
    v_r := pg_temp.rec(v_r, 'B10 two videos are too many (max 1)', v_res = 'P0001|media_invalid|too_many', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, null, 'ok',
      jsonb_build_array(pg_temp.mk(r1, pa, 'photo'), pg_temp.mk(r1, pb, 'photo'), pg_temp.mk(r1, pc, 'photo'),
                        pg_temp.mk(r1, pd, 'photo'), pg_temp.mk(r1, pe, 'photo'))));
    v_r := pg_temp.rec(v_r, 'B11 a list of five files is too many', v_res = 'P0001|media_invalid|too_many', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, null, 'ok',
      jsonb_build_array(pg_temp.mk(r1, pa, 'photo', 5 * 1024 * 1024 + 1))));
    v_r := pg_temp.rec(v_r, 'B12 a photo over 5 MB is refused', v_res = 'P0001|media_invalid|size', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, null, 'ok',
      jsonb_build_array(pg_temp.mk(r1, pv, 'video', 10 * 1024 * 1024 + 1, 10))));
    v_r := pg_temp.rec(v_r, 'B13 a video over 10 MB is refused', v_res = 'P0001|media_invalid|size', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, null, 'ok',
      jsonb_build_array(pg_temp.mk(r1, 'shopyaro/reviews/' || gen_random_uuid()::text || '/photo/abc123', 'photo'))));
    v_r := pg_temp.rec(v_r, 'B14 a file from ANOTHER review folder is refused (public_id)',
      v_res = 'P0001|media_invalid|public_id', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, null, 'ok',
      jsonb_build_array(jsonb_set(pg_temp.mk(r1, pa, 'photo'), '{url}', to_jsonb('http://evil.example/x.jpg'::text)))));
    v_r := pg_temp.rec(v_r, 'B15 an address that is not a Cloudinary https URL is refused',
      v_res = 'P0001|media_invalid|url', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, null, 'ok',
      jsonb_build_array(jsonb_set(pg_temp.mk(r1, pa, 'photo'), '{url}',
        to_jsonb('https://res.cloudinary.com/demo/image/upload/v1/shopyaro/reviews/' || r1::text || '/photo/someoneelse.jpg')))));
    v_r := pg_temp.rec(v_r, 'B16 a Cloudinary URL of a DIFFERENT file than the public_id is refused',
      v_res = 'P0001|media_invalid|url', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, null, 'ok',
      jsonb_build_array(pg_temp.mk(r1, 'shopyaro/reviews/' || r1::text || '/photo/unreserved000', 'photo'))));
    v_r := pg_temp.rec(v_r, 'B17 a file we never gave an upload slot for is refused (not_uploaded)',
      v_res = 'P0001|media_invalid|not_uploaded', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, null, 'ok',
      jsonb_build_array(pg_temp.mk(r1, pa, 'photo'), pg_temp.mk(r1, pa, 'photo'))));
    v_r := pg_temp.rec(v_r, 'B18 the same file twice is refused', v_res = 'P0001|media_invalid|duplicate', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, null, 'ok',
      jsonb_build_array(pg_temp.mk(r1, pv, 'video', 100000, 61))));
    v_r := pg_temp.rec(v_r, 'B19 a video longer than 60 seconds is refused', v_res = 'P0001|media_invalid|duration', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, null, 'ok',
      jsonb_build_array(jsonb_set(pg_temp.mk(r1, pa, 'photo'), '{media_type}', '"gif"'::jsonb))));
    v_r := pg_temp.rec(v_r, 'B20 an unknown media type is refused', v_res = 'P0001|media_invalid|type', to_jsonb(v_res));

    -- somebody else's upload slot cannot be attached to this customer's review
    insert into public.review_upload_log (user_id, review_id, media_type, public_id)
    values (v_admin, r1, 'photo', 'shopyaro/reviews/' || r1::text || '/photo/adminslot0001');
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, null, 'ok',
      jsonb_build_array(pg_temp.mk(r1, 'shopyaro/reviews/' || r1::text || '/photo/adminslot0001', 'photo'))));
    v_r := pg_temp.rec(v_r, 'B21 a file uploaded under ANOTHER person''s slot is refused',
      v_res = 'P0001|media_invalid|not_uploaded', to_jsonb(v_res));

    perform pg_temp.act_as(null, null, 'anon');
    v_res := pg_temp.call_as('anon', pg_temp.sub_sql(r1, p.id, 5, null, 'ok', '[]'::jsonb));
    v_r := pg_temp.rec(v_r, 'B22 a visitor cannot submit a review (42501)', left(v_res, 5) = '42501', to_jsonb(v_res));

    select count(*) into v_n from public.reviews where user_id = v_user and product_id in (p.id, p2.id);
    v_r := pg_temp.rec(v_r, 'B23 none of the refused reviews left a row behind', v_n = 0, to_jsonb(v_n));

    -- =========================================================================================
    -- D. A GOOD REVIEW WITH TWO PHOTOS AND A VIDEO
    -- =========================================================================================
    perform pg_temp.act_as(v_user, 'customer@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 4, '  Great buy  ',
      E'First line\nsecond line ' || v_token,
      jsonb_build_array(pg_temp.mk(r1, pa, 'photo'), pg_temp.mk(r1, pb, 'photo'),
                        pg_temp.mk(r1, pv, 'video', 5000000, 12.5))));
    v_j := case when left(v_res, 3) = 'ok|' then substr(v_res, 4)::jsonb end;
    select * into v_rev from public.reviews where id = r1;
    v_r := pg_temp.rec(v_r, 'D1 a valid review is accepted: pending, 3 files',
      v_j ->> 'status' = 'pending' and (v_j ->> 'media_count')::integer = 3, coalesce(v_j, to_jsonb(v_res)));
    v_r := pg_temp.rec(v_r, 'D2 stored correctly: trimmed title, line break kept, short author name, verified, order linked',
      v_rev.title = 'Great buy' and v_rev.comment = E'First line\nsecond line ' || v_token
      and v_rev.rating = 4 and v_rev.author_name ~ '^[^ ]+( [^ ]\.)?$'
      and v_rev.is_verified_purchase and v_rev.order_id = v_id1 and v_rev.media_count = 3
      and v_rev.product_id = p.id and v_rev.user_id = v_user,
      jsonb_build_object('author_name', v_rev.author_name, 'order_ok', v_rev.order_id = v_id1));
    select jsonb_agg(jsonb_build_object('t', media_type, 'pos', position, 'w', width, 'dur', duration_seconds) order by position)
      into v_j from public.review_media where review_id = r1;
    v_r := pg_temp.rec(v_r, 'D3 the files are stored in order with their sizes (photo, photo, video 12.5 s)',
      v_j -> 0 ->> 't' = 'photo' and v_j -> 1 ->> 't' = 'photo' and v_j -> 2 ->> 't' = 'video'
      and (v_j -> 2 ->> 'dur')::numeric = 12.5 and (v_j -> 0 ->> 'w')::integer = 800
      and (v_j -> 2 ->> 'pos')::integer = 2, v_j);
    v_r := pg_temp.rec(v_r, 'D4 a pending review does not count towards the product rating',
      (select rating_count from public.products where id = p.id) = v_cnt0, to_jsonb(v_cnt0));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(gen_random_uuid(), p.id, 5, null, 'again', '[]'::jsonb));
    v_r := pg_temp.rec(v_r, 'D5 a second review of the same product is refused (already_reviewed)',
      v_res = 'P0001|already_reviewed|', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r1, p.id, 5, null, 'again', '[]'::jsonb));
    v_r := pg_temp.rec(v_r, 'D6 submitting the same review id again is refused too',
      v_res = 'P0001|already_reviewed|', to_jsonb(v_res));
    perform pg_temp.act_as(v_admin, 'admin@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', pg_temp.slot_sql(r1, 'photo'));
    v_r := pg_temp.rec(v_r, 'D7 nobody else can take an upload slot in this review''s folder',
      v_res = 'P0002|review_not_found|', to_jsonb(v_res));

    -- =========================================================================================
    -- E. WHO CAN SEE AND TOUCH WHAT
    -- =========================================================================================
    perform pg_temp.act_as(null, null, 'anon');
    v_res := pg_temp.call_as('anon', format('select count(*)::text from public.reviews where id = %L', r1));
    v_res2 := pg_temp.call_as('anon', format('select count(*)::text from public.review_media where review_id = %L', r1));
    v_r := pg_temp.rec(v_r, 'E1 a visitor cannot see a pending review or its media',
      v_res = 'ok|0' and v_res2 = 'ok|0', jsonb_build_array(v_res, v_res2));

    perform pg_temp.act_as(v_user, 'customer@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', 'select user_id from public.reviews limit 1');
    v_res2 := pg_temp.call_as('authenticated', 'select order_id from public.reviews limit 1');
    v_res3 := pg_temp.call_as('authenticated', 'select * from public.reviews limit 1');
    v_r := pg_temp.rec(v_r, 'E2 user_id, order_id and "select *" are refused for a customer (42501)',
      left(v_res, 5) = '42501' and left(v_res2, 5) = '42501' and left(v_res3, 5) = '42501',
      jsonb_build_array(v_res, v_res2, v_res3));
    v_res := pg_temp.call_as('authenticated', format('update public.reviews set rating = 5 where id = %L', r1));
    v_res2 := pg_temp.call_as('authenticated', format('delete from public.reviews where id = %L', r1));
    v_res3 := pg_temp.call_as('authenticated', format(
      'insert into public.reviews (product_id, user_id, rating, author_name) values (%L, %L, 5, ''X'')', p2.id, v_user));
    v_r := pg_temp.rec(v_r, 'E3 a customer cannot insert, edit or delete reviews directly (42501)',
      left(v_res, 5) = '42501' and left(v_res2, 5) = '42501' and left(v_res3, 5) = '42501',
      jsonb_build_array(v_res, v_res2, v_res3));
    v_res := pg_temp.call_as('authenticated', format('delete from public.review_media where review_id = %L', r1));
    v_res2 := pg_temp.call_as('authenticated', format(
      'insert into public.review_media (review_id, media_type, url, public_id, bytes) values (%L, ''photo'', ''https://res.cloudinary.com/x/image/upload/a'', ''shopyaro/reviews/%s/photo/zzz'', 1)', r1, r1));
    v_r := pg_temp.rec(v_r, 'E4 a customer cannot write review media directly (42501)',
      left(v_res, 5) = '42501' and left(v_res2, 5) = '42501', jsonb_build_array(v_res, v_res2));
    v_res := pg_temp.call_as('authenticated', 'select count(*)::text from public.review_upload_log');
    v_res2 := pg_temp.call_as('authenticated', 'select count(*)::text from public.cloudinary_cleanup_queue');
    v_r := pg_temp.rec(v_r, 'E5 the upload log and the cleanup queue are closed to browsers (42501)',
      left(v_res, 5) = '42501' and left(v_res2, 5) = '42501', jsonb_build_array(v_res, v_res2));
    v_res := pg_temp.call_as('authenticated', format('select count(*)::text from public.reviews where id = %L', r1));
    v_r := pg_temp.rec(v_r, 'E6 a plain select does not return the customer''s own pending review (they use my_review_state)',
      v_res = 'ok|0', to_jsonb(v_res));
    v_res := pg_temp.call_as('authenticated', format('select public.my_review_state(%L)::text', p.id));
    v_j := substr(v_res, 4)::jsonb;
    v_r := pg_temp.rec(v_r, 'E7 my_review_state returns the customer''s own pending review with its 3 files',
      v_j ->> 'eligible' = 'false' and v_j ->> 'reason' = 'already_reviewed'
      and v_j -> 'review' ->> 'status' = 'pending' and jsonb_array_length(v_j -> 'review' -> 'media') = 3
      and (v_j -> 'review' -> 'media' -> 0 ->> 'public_id') = pa,
      v_j -> 'review' -> 'status');

    perform pg_temp.act_as(v_admin, 'admin@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', format('select count(*)::text from public.reviews where id = %L', r1));
    v_res2 := pg_temp.call_as('authenticated', format('select count(*)::text from public.review_media where review_id = %L', r1));
    v_r := pg_temp.rec(v_r, 'E8 an admin sees the pending review and its media',
      v_res = 'ok|1' and v_res2 = 'ok|3', jsonb_build_array(v_res, v_res2));

    perform pg_temp.act_as(v_user, 'customer@test.example', 'authenticated');
    v_res  := pg_temp.call_as('authenticated', format('select public.admin_get_review(%L)::text', r1));
    v_res2 := pg_temp.call_as('authenticated', format('select public.admin_moderate_review(%L, ''approved'')::text', r1));
    v_res3 := pg_temp.call_as('authenticated', 'select public.admin_list_reviews()::text');
    v_res4 := pg_temp.call_as('authenticated', format('select public.admin_delete_review(%L)::text', r1));
    v_res5 := pg_temp.call_as('authenticated', format('select public.admin_remove_review_media(%L)::text', gen_random_uuid()));
    v_r := pg_temp.rec(v_r, 'E9 a customer cannot call any admin review function (42501)',
      left(v_res, 5) = '42501' and left(v_res2, 5) = '42501' and left(v_res3, 5) = '42501'
      and left(v_res4, 5) = '42501' and left(v_res5, 5) = '42501',
      jsonb_build_array(left(v_res, 5), left(v_res2, 5), left(v_res3, 5), left(v_res4, 5), left(v_res5, 5)));
    perform pg_temp.act_as(null, null, 'anon');
    v_res  := pg_temp.call_as('anon', format('select public.admin_moderate_review(%L, ''approved'')::text', r1));
    v_res2 := pg_temp.call_as('anon', format('select public.edit_my_review(%L, 5, null, null, ''[]'')::text', r1));
    v_res3 := pg_temp.call_as('anon', format('select public.delete_my_review(%L)::text', r1));
    v_r := pg_temp.rec(v_r, 'E10 a visitor cannot moderate, edit or delete (42501)',
      left(v_res, 5) = '42501' and left(v_res2, 5) = '42501' and left(v_res3, 5) = '42501',
      jsonb_build_array(left(v_res, 5), left(v_res2, 5), left(v_res3, 5)));

    -- =========================================================================================
    -- F. MODERATION
    -- =========================================================================================
    perform pg_temp.act_as(v_admin, 'admin@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', format('select public.admin_moderate_review(%L, ''approved'')::text', r1));
    v_j := case when left(v_res, 3) = 'ok|' then substr(v_res, 4)::jsonb end;
    select * into v_rev from public.reviews where id = r1;
    v_r := pg_temp.rec(v_r, 'F1 approving makes the review approved and records who and when',
      v_j ->> 'status' = 'approved' and v_j ->> 'changed' = 'true' and v_rev.status = 'approved'
      and v_rev.moderated_by = v_admin and v_rev.moderated_at is not null, coalesce(v_j, to_jsonb(v_res)));
    v_r := pg_temp.rec(v_r, 'F2 the product rating now includes it (average and count match the approved reviews)',
      (select rating_count from public.products where id = p.id) = v_cnt0 + 1
      and (select rating_avg from public.products where id = p.id) =
          (select coalesce(round(avg(rating)::numeric, 1), 0) from public.reviews
            where product_id = p.id and status = 'approved'),
      jsonb_build_object('count', (select rating_count from public.products where id = p.id),
                         'avg', (select rating_avg from public.products where id = p.id)));
    select count(*) into v_n from public.admin_audit_log where table_name = 'products' and record_id = p.id::text;
    v_r := pg_temp.rec(v_r, 'F3 the rating update did NOT add a "product updated" line to the Activity log',
      v_n = v_paud0, jsonb_build_object('before', v_paud0, 'after', v_n));
    select * into v_aud from public.admin_audit_log where table_name = 'reviews' and record_id = r1::text order by id desc limit 1;
    select count(*) into v_n from public.admin_audit_log where table_name = 'reviews' and record_id = r1::text;
    v_r := pg_temp.rec(v_r, 'F4 exactly one log entry: who, what, status pending -> approved',
      v_n = 1 and v_aud.action = 'update' and v_aud.actor_id = v_admin and v_aud.actor_email = 'admin@test.example'
      and v_aud.summary = 'Approved the review by ' || v_rev.author_name || ' on "' || p.title || '"'
      and v_aud.changes -> 'status' ->> 'from' = 'pending' and v_aud.changes -> 'status' ->> 'to' = 'approved',
      to_jsonb(v_aud.summary));
    v_res := pg_temp.call_as('authenticated', format('select public.admin_moderate_review(%L, ''approved'')::text', r1));
    v_j := substr(v_res, 4)::jsonb;
    select count(*) into v_n from public.admin_audit_log where table_name = 'reviews' and record_id = r1::text;
    v_r := pg_temp.rec(v_r, 'F5 approving twice is a no-op (changed false, still 1 log entry)',
      v_j ->> 'changed' = 'false' and v_n = 1, v_j);

    perform pg_temp.act_as(null, null, 'anon');
    v_res := pg_temp.call_as('anon', format(
      'select r.author_name || ''|'' || r.is_verified_purchase::text || ''|'' || r.media_count::text from public.reviews r where r.id = %L', r1));
    v_res2 := pg_temp.call_as('anon', format('select count(*)::text from public.review_media where review_id = %L', r1));
    v_r := pg_temp.rec(v_r, 'F6 a visitor now sees the review (verified purchase) and its 3 files',
      v_res = 'ok|' || v_rev.author_name || '|true|3' and v_res2 = 'ok|3', jsonb_build_array(v_res, v_res2));
    v_res := pg_temp.call_as('anon', 'select user_id from public.reviews limit 1');
    v_res2 := pg_temp.call_as('anon', 'select public_id from public.review_media limit 1');
    v_res3 := pg_temp.call_as('anon', 'select order_id from public.reviews limit 1');
    v_r := pg_temp.rec(v_r, 'F7 even for approved reviews a visitor cannot read user_id, order_id or the Cloudinary public_id (42501)',
      left(v_res, 5) = '42501' and left(v_res2, 5) = '42501' and left(v_res3, 5) = '42501',
      jsonb_build_array(left(v_res, 5), left(v_res2, 5), left(v_res3, 5)));
    v_res := pg_temp.call_as('anon', format('select public.product_review_summary(%L)::text', p.id));
    v_j := substr(v_res, 4)::jsonb;
    v_r := pg_temp.rec(v_r, 'F8 the star summary counts it: one more review, one more 4-star',
      (v_j ->> 'count')::integer = v_cnt0 + 1 and (v_j -> 'stars' ->> '4')::integer >= 1
      and v_j -> 'stars' ?& array['5', '4', '3', '2', '1'], v_j);

    perform pg_temp.act_as(v_admin, 'admin@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', format('select public.admin_moderate_review(%L, ''rejected'')::text', r1));
    select * into v_aud from public.admin_audit_log where table_name = 'reviews' and record_id = r1::text order by id desc limit 1;
    perform pg_temp.act_as(null, null, 'anon');
    v_res2 := pg_temp.call_as('anon', format('select count(*)::text from public.reviews where id = %L', r1));
    v_res3 := pg_temp.call_as('anon', format('select count(*)::text from public.review_media where review_id = %L', r1));
    v_r := pg_temp.rec(v_r, 'F9 rejecting hides the review AND its files again, and takes it out of the rating',
      substr(v_res, 4)::jsonb ->> 'status' = 'rejected' and v_res2 = 'ok|0' and v_res3 = 'ok|0'
      and (select rating_count from public.products where id = p.id) = v_cnt0
      and (select rating_avg from public.products where id = p.id) = v_avg0
      and v_aud.summary = 'Rejected the review by ' || v_rev.author_name || ' on "' || p.title || '"',
      jsonb_build_array(v_res2, v_res3));
    perform pg_temp.act_as(v_admin, 'admin@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', format('select public.admin_moderate_review(%L, ''approved'')::text', r1));
    v_r := pg_temp.rec(v_r, 'F10 a rejected review can be approved later (back in the rating)',
      substr(v_res, 4)::jsonb ->> 'changed' = 'true'
      and (select rating_count from public.products where id = p.id) = v_cnt0 + 1, to_jsonb(v_res));
    v_res  := pg_temp.call_as('authenticated', format('select public.admin_moderate_review(%L, ''pending'')::text', r1));
    v_res2 := pg_temp.call_as('authenticated', format('select public.admin_moderate_review(%L, ''approved'')::text', v_ghost));
    v_r := pg_temp.rec(v_r, 'F11 only approved/rejected are accepted (invalid_status); a missing review is review_not_found',
      v_res = 'P0001|invalid_status|' and v_res2 = 'P0002|review_not_found|', jsonb_build_array(v_res, v_res2));

    -- =========================================================================================
    -- G. THE CUSTOMER EDITS THEIR REVIEW (media replaced)
    -- =========================================================================================
    select id into v_media_a from public.review_media where public_id = pa;
    perform pg_temp.act_as(v_admin, 'admin@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', pg_temp.edit_sql(r1, 5, 'x', 'y', '[]'::jsonb));
    v_r := pg_temp.rec(v_r, 'G1 only the owner can edit a review (an admin is refused: review_not_found)',
      v_res = 'P0002|review_not_found|', to_jsonb(v_res));
    perform pg_temp.act_as(v_user, 'customer@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', pg_temp.edit_sql(r1, 9, 'x', 'y', '[]'::jsonb));
    v_res2 := pg_temp.call_as('authenticated', pg_temp.edit_sql(r1, 5, null, 'y',
      jsonb_build_array(jsonb_set(pg_temp.mk(r1, pa, 'photo'), '{url}', to_jsonb('http://evil.example/x.jpg'::text)))));
    v_res3 := pg_temp.call_as('authenticated', pg_temp.edit_sql(r1, 5, null, 'y',
      jsonb_build_array(pg_temp.mk(r1, 'shopyaro/reviews/' || gen_random_uuid()::text || '/photo/abc123', 'photo'))));
    v_r := pg_temp.rec(v_r, 'G2 an edit is validated like a new review (rating, URL, foreign folder)',
      v_res = 'P0001|rating_invalid|' and v_res2 = 'P0001|media_invalid|url' and v_res3 = 'P0001|media_invalid|public_id',
      jsonb_build_array(v_res, v_res2, v_res3));
    select status into v_txt from public.reviews where id = r1;
    v_r := pg_temp.rec(v_r, 'G3 refused edits changed nothing (still approved)', v_txt = 'approved', to_jsonb(v_txt));

    -- keep photo a, drop photo b and the video, add photo e
    v_res := pg_temp.call_as('authenticated', pg_temp.edit_sql(r1, 5, 'Even better', 'Updated ' || v_token,
      jsonb_build_array(pg_temp.mk(r1, pe, 'photo'), pg_temp.mk(r1, pa, 'photo'))));
    v_j := case when left(v_res, 3) = 'ok|' then substr(v_res, 4)::jsonb end;
    select * into v_rev from public.reviews where id = r1;
    v_r := pg_temp.rec(v_r, 'G4 an edit puts the review back to pending and updates the text, rating and file count',
      v_j ->> 'status' = 'pending' and (v_j ->> 'media_count')::integer = 2 and v_rev.rating = 5
      and v_rev.title = 'Even better' and v_rev.moderated_by is null and v_rev.moderated_at is null
      and v_rev.media_count = 2, coalesce(v_j, to_jsonb(v_res)));
    v_r := pg_temp.rec(v_r, 'G5 a pending review is out of the product rating again',
      (select rating_count from public.products where id = p.id) = v_cnt0
      and (select rating_avg from public.products where id = p.id) = v_avg0, to_jsonb(v_cnt0));
    select jsonb_agg(jsonb_build_object('pid', public_id, 'pos', position) order by position)
      into v_j from public.review_media where review_id = r1;
    select count(*) into v_n from public.review_media where id = v_media_a and public_id = pa;
    v_r := pg_temp.rec(v_r, 'G6 the kept photo is the SAME row, the new photo comes second, the dropped files are gone',
      jsonb_array_length(v_j) = 2 and v_j -> 0 ->> 'pid' = pe and v_j -> 1 ->> 'pid' = pa
      and v_n = 1 and not exists (select 1 from public.review_media where public_id in (pb, pv)),
      v_j);
    select count(*) filter (where public_id = pb and resource_type = 'image'),
           count(*) filter (where public_id = pv and resource_type = 'video'),
           count(*) filter (where public_id in (pa, pe))
      into v_n, v_n2, v_ok from public.cloudinary_cleanup_queue where public_id in (pa, pb, pv, pe);
    v_r := pg_temp.rec(v_r, 'G7 the dropped photo is queued for Cloudinary as an image and the dropped video as a VIDEO; kept files are not queued',
      v_n = 1 and v_n2 = 1 and v_ok = 0, jsonb_build_object('photo', v_n, 'video', v_n2, 'kept', v_ok));
    perform pg_temp.act_as(null, null, 'anon');
    v_res := pg_temp.call_as('anon', format('select count(*)::text from public.reviews where id = %L', r1));
    v_r := pg_temp.rec(v_r, 'G8 the edited review is hidden from visitors until it is approved again', v_res = 'ok|0', to_jsonb(v_res));

    -- ---- cleanup mechanics (run here as the database owner; the Edge Function uses service_role) ----
    -- (a) an old queue entry for a file that is STILL in use must never be deleted
    insert into public.cloudinary_cleanup_queue (public_id, source_table, resource_type)
    values (pa, 'review_media', 'image');
    -- (b) a slot handed out two days ago and never attached is an orphan; an old slot that WAS attached is not
    insert into public.review_upload_log (user_id, review_id, media_type, public_id, created_at)
    values (v_user, v_ghost, 'video', 'shopyaro/reviews/' || v_ghost::text || '/video/orphan0000000001', now() - interval '2 days');
    update public.review_upload_log set created_at = now() - interval '3 days' where public_id = pe;
    select count(*) filter (where c.public_id = 'shopyaro/reviews/' || v_ghost::text || '/video/orphan0000000001'
                              and c.resource_type = 'video'),
           count(*) filter (where c.public_id = pv and c.resource_type = 'video'),
           count(*) filter (where c.public_id = pa)
      into v_a, v_b, v_ok
      from public.claim_cleanup_batch(50) c;
    select count(*) into v_n2 from public.cloudinary_cleanup_queue where public_id = pa;
    v_r := pg_temp.rec(v_r, 'G9 claim_cleanup_batch hands out the orphaned slot as a video, and the dropped video as a video',
      v_a = 1 and v_b = 1 and v_ok = 0, jsonb_build_object('orphan_video', v_a, 'dropped_video', v_b, 'in_use_handed_out', v_ok));
    v_r := pg_temp.rec(v_r, 'G10 a queued file that is still used by a review is NOT handed out and is removed from the queue',
      v_n2 = 0 and v_ok = 0, to_jsonb(v_n2));
    select count(*) into v_n from public.cloudinary_cleanup_queue where public_id = pe;
    select count(*) into v_n2 from public.review_upload_log where public_id = pe;
    v_r := pg_temp.rec(v_r, 'G11 an old but attached slot is not treated as an orphan; old log rows are cleared',
      v_n = 0 and v_n2 = 0, jsonb_build_object('queued', v_n, 'still_in_log', v_n2));

    -- =========================================================================================
    -- H. THE ADMIN'S VIEW (list, filters, one review)
    -- =========================================================================================
    perform pg_temp.act_as(v_admin, 'admin@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', format(
      'select public.admin_list_reviews(%L, null, null, %L)::text', 'pending', v_token));
    v_j := substr(v_res, 4)::jsonb;
    v_r := pg_temp.rec(v_r, 'H1 the pending list finds the review by a word in its comment, with product, email and counts',
      jsonb_array_length(v_j -> 'items') = 1 and v_j -> 'items' -> 0 ->> 'id' = r1::text
      and v_j -> 'items' -> 0 ->> 'product_title' = p.title and (v_j -> 'items' -> 0 ->> 'account_email') is not null
      and (v_j -> 'items' -> 0 ->> 'media_count')::integer = 2 and v_j ->> 'has_more' = 'false'
      and v_j -> 'items' -> 0 ->> 'author_name' = v_rev.author_name, v_j -> 'items');
    v_res  := pg_temp.call_as('authenticated', format('select public.admin_list_reviews(null, 5, true, %L)::text', v_token));
    v_res2 := pg_temp.call_as('authenticated', format('select public.admin_list_reviews(null, 3, null, %L)::text', v_token));
    v_res3 := pg_temp.call_as('authenticated', format('select public.admin_list_reviews(null, null, false, %L)::text', v_token));
    v_res4 := pg_temp.call_as('authenticated', format('select public.admin_list_reviews(''approved'', null, null, %L)::text', v_token));
    v_r := pg_temp.rec(v_r, 'H2 filters: 5 stars + has media finds it; 3 stars, "no media" and "approved" do not',
      jsonb_array_length(substr(v_res, 4)::jsonb -> 'items') = 1
      and jsonb_array_length(substr(v_res2, 4)::jsonb -> 'items') = 0
      and jsonb_array_length(substr(v_res3, 4)::jsonb -> 'items') = 0
      and jsonb_array_length(substr(v_res4, 4)::jsonb -> 'items') = 0,
      jsonb_build_array(left(v_res, 3), left(v_res2, 3)));
    v_res  := pg_temp.call_as('authenticated', format('select public.admin_list_reviews(null, null, null, %L)::text', lower(left(p.title, 6))));
    v_res2 := pg_temp.call_as('authenticated', format('select public.admin_list_reviews(null, null, null, %L)::text', lower(v_rev.author_name)));
    v_r := pg_temp.rec(v_r, 'H3 search also finds it by product name and by author name',
      exists (select 1 from jsonb_array_elements(substr(v_res, 4)::jsonb -> 'items') e where e ->> 'id' = r1::text)
      and exists (select 1 from jsonb_array_elements(substr(v_res2, 4)::jsonb -> 'items') e where e ->> 'id' = r1::text),
      jsonb_build_array(left(v_res, 3), left(v_res2, 3)));
    select created_at into v_created from public.reviews where id = r1;
    v_res  := pg_temp.call_as('authenticated', format('select public.admin_list_reviews(null, null, null, %L, %L, %L, 1)::text',
                                                       v_token, v_created, r1));
    v_res2 := pg_temp.call_as('authenticated', 'select public.admin_list_reviews(null, null, null, null, null, null, 1)::text');
    v_r := pg_temp.rec(v_r, 'H4 paging: "before this review" no longer contains it; a limit of 1 returns at most 1',
      jsonb_array_length(substr(v_res, 4)::jsonb -> 'items') = 0
      and jsonb_array_length(substr(v_res2, 4)::jsonb -> 'items') <= 1,
      jsonb_build_array(left(v_res, 3), left(v_res2, 3)));
    v_res := pg_temp.call_as('authenticated', format('select public.admin_get_review(%L)::text', r1));
    v_j := substr(v_res, 4)::jsonb;
    v_r := pg_temp.rec(v_r, 'H5 one review: full text, 2 files with public_id and size, account email, link to the order',
      v_j ->> 'comment' = 'Updated ' || v_token and jsonb_array_length(v_j -> 'media') = 2
      and (v_j -> 'media' -> 0 ->> 'public_id') = pe and (v_j -> 'media' -> 0 ->> 'bytes')::integer = 100000
      and (v_j ->> 'account_email') is not null and v_j ->> 'order_id' = v_id1::text
      and v_j ->> 'order_number' = (select order_number from public.orders where id = v_id1)
      and v_j ->> 'user_id' = v_user::text and v_j ->> 'is_verified_purchase' = 'true'
      and (v_j ->> 'product_slug') = p.slug,
      jsonb_build_object('order_number', v_j -> 'order_number'));
    v_res  := pg_temp.call_as('authenticated', format('select coalesce(public.admin_get_review(%L)::text, ''none'')', v_ghost));
    v_res2 := pg_temp.call_as('authenticated', 'select public.admin_list_reviews(''bogus'')::text');
    v_r := pg_temp.rec(v_r, 'H6 a missing review is null; an unknown status is invalid_status',
      v_res = 'ok|none' and v_res2 = 'P0001|invalid_status|', jsonb_build_array(v_res, v_res2));

    -- =========================================================================================
    -- I. THE ADMIN REMOVES ONE PHOTO
    -- =========================================================================================
    select id into v_media_e from public.review_media where public_id = pe;
    v_res := pg_temp.call_as('authenticated', format('select public.admin_remove_review_media(%L)::text', v_media_e));
    v_j := case when left(v_res, 3) = 'ok|' then substr(v_res, 4)::jsonb end;
    select * into v_aud from public.admin_audit_log where table_name = 'reviews' and record_id = r1::text order by id desc limit 1;
    select count(*) into v_n from public.cloudinary_cleanup_queue where public_id = pe and resource_type = 'image';
    select media_count into v_n2 from public.reviews where id = r1;
    v_r := pg_temp.rec(v_r, 'I1 removing one photo keeps the review and its other file; the count follows',
      (v_j ->> 'media_count')::integer = 1 and v_n2 = 1
      and (select count(*) from public.review_media where review_id = r1) = 1
      and exists (select 1 from public.reviews where id = r1), coalesce(v_j, to_jsonb(v_res)));
    v_r := pg_temp.rec(v_r, 'I2 the removed photo is queued for Cloudinary, and the action is logged (2 -> 1 files)',
      v_n = 1 and v_aud.summary = 'Removed a photo from the review by ' || v_rev.author_name || ' on "' || p.title || '"'
      and (v_aud.changes -> 'media_count' ->> 'from')::integer = 2 and (v_aud.changes -> 'media_count' ->> 'to')::integer = 1,
      to_jsonb(v_aud.summary));
    v_res := pg_temp.call_as('authenticated', format('select public.admin_remove_review_media(%L)::text', v_ghost));
    v_r := pg_temp.rec(v_r, 'I3 a file that does not exist: media_not_found', v_res = 'P0002|media_not_found|', to_jsonb(v_res));

    -- =========================================================================================
    -- J. THE CUSTOMER DELETES THEIR REVIEW
    -- =========================================================================================
    perform pg_temp.act_as(v_admin, 'admin@test.example', 'authenticated');
    perform pg_temp.call_as('authenticated', format('select public.admin_moderate_review(%L, ''approved'')::text', r1));
    v_res := pg_temp.call_as('authenticated', format('select public.delete_my_review(%L)::text', r1));
    v_r := pg_temp.rec(v_r, 'J1 only the owner can delete a review (an admin using the customer function: review_not_found)',
      v_res = 'P0002|review_not_found|', to_jsonb(v_res));
    perform pg_temp.act_as(v_user, 'customer@test.example', 'authenticated');
    v_res := pg_temp.call_as('authenticated', format('select public.delete_my_review(%L)::text', r1));
    select count(*) into v_n from public.reviews where id = r1;
    select count(*) into v_n2 from public.review_media where review_id = r1;
    v_r := pg_temp.rec(v_r, 'J2 the customer deletes it: the review and its media rows are gone',
      v_res like 'ok|%' and v_n = 0 and v_n2 = 0, to_jsonb(v_res));
    select count(*) into v_n from public.cloudinary_cleanup_queue where public_id = pa and resource_type = 'image';
    v_r := pg_temp.rec(v_r, 'J3 the remaining file is queued for Cloudinary', v_n = 1, to_jsonb(v_n));
    v_r := pg_temp.rec(v_r, 'J4 the product rating drops it again (approved -> deleted)',
      (select rating_count from public.products where id = p.id) = v_cnt0
      and (select rating_avg from public.products where id = p.id) = v_avg0,
      to_jsonb(v_cnt0));
    v_res := pg_temp.call_as('authenticated', format('select public.delete_my_review(%L)::text', r1));
    v_r := pg_temp.rec(v_r, 'J5 deleting it again: review_not_found', v_res = 'P0002|review_not_found|', to_jsonb(v_res));

    -- =========================================================================================
    -- K. A NEW REVIEW AFTER DELETING, THEN THE ADMIN DELETES IT
    -- =========================================================================================
    v_res := pg_temp.call_as('authenticated', pg_temp.slot_sql(r2, 'photo')); pf := substr(v_res, 4);
    v_res := pg_temp.call_as('authenticated', pg_temp.slot_sql(r2, 'video')); px := substr(v_res, 4);
    v_res := pg_temp.call_as('authenticated', pg_temp.sub_sql(r2, p.id, 2, null, null,
      jsonb_build_array(pg_temp.mk(r2, pf, 'photo'), pg_temp.mk(r2, px, 'video', 3000000, 8))));
    v_j := case when left(v_res, 3) = 'ok|' then substr(v_res, 4)::jsonb end;
    v_r := pg_temp.rec(v_r, 'K1 after deleting, the customer can review the product again (rating only, no text, 2 files)',
      v_j ->> 'status' = 'pending' and (v_j ->> 'media_count')::integer = 2, coalesce(v_j, to_jsonb(v_res)));
    perform pg_temp.act_as(v_admin, 'admin@test.example', 'authenticated');
    perform pg_temp.call_as('authenticated', format('select public.admin_moderate_review(%L, ''approved'')::text', r2));
    select * into v_rev from public.reviews where id = r2;
    v_res := pg_temp.call_as('authenticated', format('select public.admin_delete_review(%L)::text', r2));
    select * into v_aud from public.admin_audit_log where table_name = 'reviews' and record_id = r2::text order by id desc limit 1;
    select count(*) into v_n from public.reviews where id = r2;
    select count(*) into v_n2 from public.cloudinary_cleanup_queue
     where (public_id = pf and resource_type = 'image') or (public_id = px and resource_type = 'video');
    v_r := pg_temp.rec(v_r, 'K2 the admin deletes it: review and files gone, both files queued (photo as image, video as video)',
      v_res like 'ok|%' and v_n = 0 and v_n2 = 2, jsonb_build_object('left', v_n, 'queued', v_n2));
    v_r := pg_temp.rec(v_r, 'K3 the log keeps who, which review and the rating, never the review text',
      v_aud.action = 'delete' and v_aud.actor_id = v_admin
      and v_aud.summary = 'Deleted the review by ' || v_rev.author_name || ' on "' || p.title || '"'
      and (v_aud.changes ->> 'rating')::integer = 2 and (v_aud.changes ->> 'media_count')::integer = 2
      and not (v_aud.changes ? 'comment') and not (v_aud.changes ? 'title'),
      v_aud.changes);
    v_r := pg_temp.rec(v_r, 'K4 the rating is back to what it was before any review',
      (select rating_count from public.products where id = p.id) = v_cnt0
      and (select rating_avg from public.products where id = p.id) = v_avg0, to_jsonb(v_cnt0));
    v_res := pg_temp.call_as('authenticated', format('select public.admin_delete_review(%L)::text', v_ghost));
    v_r := pg_temp.rec(v_r, 'K5 deleting a missing review: review_not_found', v_res = 'P0002|review_not_found|', to_jsonb(v_res));

    -- =========================================================================================
    -- L. THE LIMIT OF 10 UPLOADS PER HOUR
    -- =========================================================================================
    perform pg_temp.act_as(v_user, 'customer@test.example', 'authenticated');
    v_stop := null;
    for v_n in 1..15 loop
      v_res := pg_temp.call_as('authenticated', pg_temp.slot_sql(r2, 'photo'));
      if left(v_res, 3) <> 'ok|' then v_stop := v_res; exit; end if;
    end loop;
    select count(*) into v_n2 from public.review_upload_log
     where user_id = v_user and created_at > now() - interval '1 hour';
    v_r := pg_temp.rec(v_r, 'L1 the 11th upload slot within an hour is refused (rate_limited) and exactly 10 are recorded',
      v_stop = 'P0001|rate_limited|' and v_n2 = 10, jsonb_build_object('stopped_with', v_stop, 'recorded', v_n2));

    -- =========================================================================================
    -- M. THE CLEANUP QUEUE ONLY ACCEPTS OUR OWN PATHS
    -- =========================================================================================
    v_res := pg_temp.call_as('postgres', $q$ insert into public.cloudinary_cleanup_queue (public_id, source_table)
                                             values ('somebody/elses/file', 'x') $q$);
    v_res2 := pg_temp.call_as('postgres', $q$ insert into public.cloudinary_cleanup_queue (public_id, source_table, resource_type)
                                              values ('shopyaro/reviews/00000000-0000-4000-8000-000000000000/video/okfile1', 'x', 'video')
                                              returning public_id $q$);
    v_res3 := pg_temp.call_as('postgres', $q$ insert into public.cloudinary_cleanup_queue (public_id, source_table, resource_type)
                                              values ('shopyaro/products/okfile2', 'x', 'document') $q$);
    v_r := pg_temp.rec(v_r, 'M1 the queue refuses a path that is not ours and an unknown resource type, and accepts a review video',
      left(v_res, 5) = '23514' and left(v_res2, 3) = 'ok|' and left(v_res3, 5) = '23514',
      jsonb_build_array(left(v_res, 5), v_res2, left(v_res3, 5)));

  exception when others then
    execute 'reset role';
    v_r := v_r || jsonb_build_object('check','UNEXPECTED ERROR','pass', false, 'detail', sqlerrm || ' [' || sqlstate || ']');
  end;

  -- Always fail on purpose so that EVERYTHING above is rolled back.
  raise exception E'REVIEWS TEST RESULTS (all test data was rolled back). Passed: % of %\n%',
    (select count(*) from jsonb_array_elements(v_r) r where (r ->> 'pass')::boolean),
    jsonb_array_length(v_r),
    jsonb_pretty(v_r);
end
$test$;
