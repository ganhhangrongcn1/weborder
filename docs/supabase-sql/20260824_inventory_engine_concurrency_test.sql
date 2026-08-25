-- GHR Inventory concurrency and lost-response test.
-- LOCAL / DISPOSABLE DATABASE ONLY. NEVER RUN THIS FILE ON PRODUCTION.
--
-- Prerequisites:
--   1. Apply docs/supabase-sql/20260725_inventory_mvp.sql first.
--   2. The local Supabase project must contain at least two auth.users rows.
--   3. Run as postgres on a disposable Supabase local database.
--
-- Coverage:
--   A. Two staff complete the same document with the same idempotency key.
--   B. Two different documents compete for stock that can satisfy only one.
--   C. The server commits but the client drops the response, then retries.

\set ON_ERROR_STOP on

set statement_timeout = '30s';
set lock_timeout = '10s';

create extension if not exists dblink;

drop schema if exists inventory_concurrency_test cascade;
create schema inventory_concurrency_test;

create table inventory_concurrency_test.context (
  actor_a uuid not null,
  actor_b uuid not null,
  warehouse_id uuid not null,
  unit_id uuid not null,
  same_item_id uuid not null,
  compete_item_id uuid not null,
  retry_item_id uuid not null,
  same_document_id uuid not null,
  same_line_id uuid not null,
  compete_document_a_id uuid not null,
  compete_line_a_id uuid not null,
  compete_document_b_id uuid not null,
  compete_line_b_id uuid not null,
  retry_document_id uuid not null,
  retry_line_id uuid not null
);

create table inventory_concurrency_test.results (
  scenario text not null,
  worker text not null,
  result jsonb not null
);

do $$
declare
  v_actor_a uuid;
  v_actor_b uuid;
  v_warehouse_id uuid := gen_random_uuid();
  v_unit_id uuid := gen_random_uuid();
  v_same_item_id uuid := gen_random_uuid();
  v_compete_item_id uuid := gen_random_uuid();
  v_retry_item_id uuid := gen_random_uuid();
  v_same_document_id uuid := gen_random_uuid();
  v_same_line_id uuid := gen_random_uuid();
  v_compete_document_a_id uuid := gen_random_uuid();
  v_compete_line_a_id uuid := gen_random_uuid();
  v_compete_document_b_id uuid := gen_random_uuid();
  v_compete_line_b_id uuid := gen_random_uuid();
  v_retry_document_id uuid := gen_random_uuid();
  v_retry_line_id uuid := gen_random_uuid();
  v_run_suffix text := replace(gen_random_uuid()::text, '-', '');
begin
  select user_source.id
  into v_actor_a
  from auth.users user_source
  order by user_source.created_at, user_source.id
  limit 1;

  select user_source.id
  into v_actor_b
  from auth.users user_source
  order by user_source.created_at, user_source.id
  offset 1
  limit 1;

  if v_actor_a is null or v_actor_b is null or v_actor_a = v_actor_b then
    raise exception 'Concurrency test cần ít nhất hai tài khoản khác nhau trong auth.users của Supabase local.';
  end if;

  insert into public.inventory_warehouses (
    id, code, name, warehouse_type, allow_negative_stock, is_active, created_by
  )
  values (
    v_warehouse_id,
    'CONC-WH-' || v_run_suffix,
    'Kho kiểm thử đồng thời',
    'branch',
    false,
    true,
    v_actor_a
  );

  insert into public.inventory_units (
    id, code, name, unit_type, decimal_places, is_active, created_by
  )
  values (
    v_unit_id,
    'CONC-UNIT-' || v_run_suffix,
    'Đơn vị kiểm thử đồng thời',
    'count',
    0,
    true,
    v_actor_a
  );

  insert into public.inventory_items (
    id, code, name, item_type, base_unit_id, purchase_unit_id,
    purchase_to_base_ratio, is_active, created_by
  )
  values
    (
      v_same_item_id,
      'CONC-SAME-' || v_run_suffix,
      'Mặt hàng cùng phiếu',
      'ingredient',
      v_unit_id,
      v_unit_id,
      1,
      true,
      v_actor_a
    ),
    (
      v_compete_item_id,
      'CONC-STOCK-' || v_run_suffix,
      'Mặt hàng tranh chấp tồn',
      'ingredient',
      v_unit_id,
      v_unit_id,
      1,
      true,
      v_actor_a
    ),
    (
      v_retry_item_id,
      'CONC-RETRY-' || v_run_suffix,
      'Mặt hàng thử mất phản hồi',
      'ingredient',
      v_unit_id,
      v_unit_id,
      1,
      true,
      v_actor_a
    );

  insert into public.inventory_user_access (
    auth_user_id, warehouse_id, role, is_active, created_by
  )
  values
    (v_actor_a, null, 'owner', true, v_actor_a),
    (v_actor_b, null, 'owner', true, v_actor_a)
  on conflict (auth_user_id, warehouse_id, role)
  do update set is_active = true;

  insert into public.inventory_stock_balances (
    warehouse_id, item_id, quantity, average_cost
  )
  values
    (v_warehouse_id, v_same_item_id, 20, 10),
    (v_warehouse_id, v_compete_item_id, 10, 10),
    (v_warehouse_id, v_retry_item_id, 10, 10);

  insert into public.inventory_documents (
    id, document_no, idempotency_key, document_type, status,
    source_warehouse_id, occurred_at, notes, created_by, submitted_at, submitted_by
  )
  values
    (
      v_same_document_id,
      'CONC-SAME-' || v_run_suffix,
      'conc-same-document-' || v_run_suffix,
      'stock_issue',
      'submitted',
      v_warehouse_id,
      clock_timestamp(),
      'Hai nhân viên cùng hoàn tất một phiếu',
      v_actor_a,
      clock_timestamp(),
      v_actor_a
    ),
    (
      v_compete_document_a_id,
      'CONC-STOCK-A-' || v_run_suffix,
      'conc-stock-a-document-' || v_run_suffix,
      'stock_issue',
      'submitted',
      v_warehouse_id,
      clock_timestamp(),
      'Phiếu A tranh chấp tồn',
      v_actor_a,
      clock_timestamp(),
      v_actor_a
    ),
    (
      v_compete_document_b_id,
      'CONC-STOCK-B-' || v_run_suffix,
      'conc-stock-b-document-' || v_run_suffix,
      'stock_issue',
      'submitted',
      v_warehouse_id,
      clock_timestamp(),
      'Phiếu B tranh chấp tồn',
      v_actor_b,
      clock_timestamp(),
      v_actor_b
    ),
    (
      v_retry_document_id,
      'CONC-RETRY-' || v_run_suffix,
      'conc-retry-document-' || v_run_suffix,
      'stock_issue',
      'submitted',
      v_warehouse_id,
      clock_timestamp(),
      'Máy khách mất phản hồi rồi gửi lại',
      v_actor_a,
      clock_timestamp(),
      v_actor_a
    );

  insert into public.inventory_document_lines (
    id, document_id, item_id, unit_id, conversion_to_base,
    expected_quantity, actual_quantity, base_quantity, unit_price, notes
  )
  values
    (
      v_same_line_id,
      v_same_document_id,
      v_same_item_id,
      v_unit_id,
      1,
      5,
      5,
      5,
      10,
      'Chỉ được trừ một lần'
    ),
    (
      v_compete_line_a_id,
      v_compete_document_a_id,
      v_compete_item_id,
      v_unit_id,
      1,
      7,
      7,
      7,
      10,
      'Phiếu A cần 7 trên tồn 10'
    ),
    (
      v_compete_line_b_id,
      v_compete_document_b_id,
      v_compete_item_id,
      v_unit_id,
      1,
      7,
      7,
      7,
      10,
      'Phiếu B cần 7 trên tồn 10'
    ),
    (
      v_retry_line_id,
      v_retry_document_id,
      v_retry_item_id,
      v_unit_id,
      1,
      2,
      2,
      2,
      10,
      'Chỉ được trừ một lần dù mất phản hồi'
    );

  insert into inventory_concurrency_test.context values (
    v_actor_a,
    v_actor_b,
    v_warehouse_id,
    v_unit_id,
    v_same_item_id,
    v_compete_item_id,
    v_retry_item_id,
    v_same_document_id,
    v_same_line_id,
    v_compete_document_a_id,
    v_compete_line_a_id,
    v_compete_document_b_id,
    v_compete_line_b_id,
    v_retry_document_id,
    v_retry_line_id
  );
end;
$$;

-- Scenario A: same document + same idempotency key from two staff sessions.
select dblink_connect(
  'same_a',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres'
);
select dblink_connect(
  'same_b',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres'
);

select dblink_send_query(
  'same_a',
  format(
    $query$
      with claims as materialized (
        select
          set_config('request.jwt.claim.sub', %L, false),
          set_config('request.jwt.claims', %L, false)
      )
      select public.inventory_complete_simple_document(%L::uuid, 'conc-same-complete')::text
      from claims
    $query$,
    context.actor_a::text,
    jsonb_build_object('sub', context.actor_a, 'role', 'authenticated')::text,
    context.same_document_id::text
  )
)
from inventory_concurrency_test.context context;

select dblink_send_query(
  'same_b',
  format(
    $query$
      with claims as materialized (
        select
          set_config('request.jwt.claim.sub', %L, false),
          set_config('request.jwt.claims', %L, false)
      )
      select public.inventory_complete_simple_document(%L::uuid, 'conc-same-complete')::text
      from claims
    $query$,
    context.actor_b::text,
    jsonb_build_object('sub', context.actor_b, 'role', 'authenticated')::text,
    context.same_document_id::text
  )
)
from inventory_concurrency_test.context context;

insert into inventory_concurrency_test.results (scenario, worker, result)
select 'same_document', 'worker_a', remote.result::jsonb
from dblink_get_result('same_a') as remote(result text);

insert into inventory_concurrency_test.results (scenario, worker, result)
select 'same_document', 'worker_b', remote.result::jsonb
from dblink_get_result('same_b') as remote(result text);

select dblink_disconnect('same_a');
select dblink_disconnect('same_b');

do $$
declare
  v_context inventory_concurrency_test.context%rowtype;
begin
  select * into v_context from inventory_concurrency_test.context;

  if (select quantity from public.inventory_stock_balances
      where warehouse_id = v_context.warehouse_id and item_id = v_context.same_item_id) <> 15 then
    raise exception 'Scenario A thất bại: tồn phải là 15 sau khi chỉ trừ một lần.';
  end if;

  if (select count(*) from public.inventory_stock_movements
      where document_id = v_context.same_document_id) <> 1 then
    raise exception 'Scenario A thất bại: phải có đúng một movement.';
  end if;

  if (select count(*) from public.inventory_document_operations
      where document_id = v_context.same_document_id and operation = 'complete') <> 1 then
    raise exception 'Scenario A thất bại: phải có đúng một operation hoàn tất.';
  end if;

  if (select count(*) from inventory_concurrency_test.results
      where scenario = 'same_document' and (result ->> 'idempotent_replay')::boolean = false) <> 1
     or (select count(*) from inventory_concurrency_test.results
         where scenario = 'same_document' and (result ->> 'idempotent_replay')::boolean = true) <> 1 then
    raise exception 'Scenario A thất bại: cần một kết quả gốc và một idempotent replay.';
  end if;
end;
$$;

-- Scenario B: two documents compete for quantity 10; each requests 7.
select dblink_connect(
  'stock_a',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres'
);
select dblink_connect(
  'stock_b',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres'
);

select dblink_send_query(
  'stock_a',
  format(
    $query$
      with claims as materialized (
        select
          set_config('request.jwt.claim.sub', %L, false),
          set_config('request.jwt.claims', %L, false)
      )
      select public.inventory_complete_simple_document(%L::uuid, 'conc-stock-complete-a')::text
      from claims
    $query$,
    context.actor_a::text,
    jsonb_build_object('sub', context.actor_a, 'role', 'authenticated')::text,
    context.compete_document_a_id::text
  )
)
from inventory_concurrency_test.context context;

select dblink_send_query(
  'stock_b',
  format(
    $query$
      with claims as materialized (
        select
          set_config('request.jwt.claim.sub', %L, false),
          set_config('request.jwt.claims', %L, false)
      )
      select public.inventory_complete_simple_document(%L::uuid, 'conc-stock-complete-b')::text
      from claims
    $query$,
    context.actor_b::text,
    jsonb_build_object('sub', context.actor_b, 'role', 'authenticated')::text,
    context.compete_document_b_id::text
  )
)
from inventory_concurrency_test.context context;

insert into inventory_concurrency_test.results (scenario, worker, result)
select 'competing_stock', 'worker_a', remote.result::jsonb
from dblink_get_result('stock_a', false) as remote(result text);

insert into inventory_concurrency_test.results (scenario, worker, result)
select 'competing_stock', 'worker_b', remote.result::jsonb
from dblink_get_result('stock_b', false) as remote(result text);

select dblink_disconnect('stock_a');
select dblink_disconnect('stock_b');

do $$
declare
  v_context inventory_concurrency_test.context%rowtype;
begin
  select * into v_context from inventory_concurrency_test.context;

  if (select quantity from public.inventory_stock_balances
      where warehouse_id = v_context.warehouse_id and item_id = v_context.compete_item_id) <> 3 then
    raise exception 'Scenario B thất bại: tồn phải là 3 và không được âm.';
  end if;

  if (select count(*) from public.inventory_documents
      where id in (v_context.compete_document_a_id, v_context.compete_document_b_id)
        and status = 'completed') <> 1
     or (select count(*) from public.inventory_documents
         where id in (v_context.compete_document_a_id, v_context.compete_document_b_id)
           and status = 'submitted') <> 1 then
    raise exception 'Scenario B thất bại: đúng một phiếu hoàn tất và một phiếu phải giữ submitted.';
  end if;

  if (select count(*) from public.inventory_stock_movements
      where document_id in (v_context.compete_document_a_id, v_context.compete_document_b_id)) <> 1 then
    raise exception 'Scenario B thất bại: hai phiếu cạnh tranh chỉ được tạo một movement.';
  end if;

  if (select count(*) from inventory_concurrency_test.results
      where scenario = 'competing_stock') <> 1 then
    raise exception 'Scenario B thất bại: phải có đúng một worker thành công.';
  end if;
end;
$$;

-- Scenario C: commit succeeds, client drops the response, then retries the same key.
select dblink_connect(
  'lost_response',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres'
);

select dblink_send_query(
  'lost_response',
  format(
    $query$
      with claims as materialized (
        select
          set_config('request.jwt.claim.sub', %L, false),
          set_config('request.jwt.claims', %L, false)
      )
      select public.inventory_complete_simple_document(%L::uuid, 'conc-lost-response')::text
      from claims
    $query$,
    context.actor_a::text,
    jsonb_build_object('sub', context.actor_a, 'role', 'authenticated')::text,
    context.retry_document_id::text
  )
)
from inventory_concurrency_test.context context;

do $$
begin
  while dblink_is_busy('lost_response') = 1 loop
    perform pg_sleep(0.02);
  end loop;
end;
$$;

-- Disconnect without reading the completed response: this models a lost client response.
select dblink_disconnect('lost_response');

insert into inventory_concurrency_test.results (scenario, worker, result)
select
  'lost_response',
  'retrying_client',
  public.inventory_complete_simple_document(context.retry_document_id, 'conc-lost-response')
from inventory_concurrency_test.context context
cross join lateral (
  select
    set_config('request.jwt.claim.sub', context.actor_a::text, false),
    set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', context.actor_a, 'role', 'authenticated')::text,
      false
    )
) claims;

do $$
declare
  v_context inventory_concurrency_test.context%rowtype;
begin
  select * into v_context from inventory_concurrency_test.context;

  if (select quantity from public.inventory_stock_balances
      where warehouse_id = v_context.warehouse_id and item_id = v_context.retry_item_id) <> 8 then
    raise exception 'Scenario C thất bại: mất phản hồi rồi retry chỉ được trừ tồn một lần.';
  end if;

  if (select count(*) from public.inventory_stock_movements
      where document_id = v_context.retry_document_id) <> 1 then
    raise exception 'Scenario C thất bại: phải có đúng một movement.';
  end if;

  if (select count(*) from public.inventory_document_operations
      where document_id = v_context.retry_document_id and operation = 'complete') <> 1 then
    raise exception 'Scenario C thất bại: phải có đúng một operation hoàn tất.';
  end if;

  if not coalesce((select (result ->> 'idempotent_replay')::boolean
                   from inventory_concurrency_test.results
                   where scenario = 'lost_response'), false) then
    raise exception 'Scenario C thất bại: lần gửi lại phải là idempotent replay.';
  end if;
end;
$$;

select
  'PASS' as test_status,
  scenario,
  worker,
  result ->> 'status' as document_status,
  result ->> 'idempotent_replay' as idempotent_replay
from inventory_concurrency_test.results
order by scenario, worker;

-- Cleanup all fixtures so the test is safe to rerun on the disposable database.
delete from public.inventory_stock_movements movement
using inventory_concurrency_test.context context
where movement.document_id in (
  context.same_document_id,
  context.compete_document_a_id,
  context.compete_document_b_id,
  context.retry_document_id
);

delete from public.inventory_document_events event
using inventory_concurrency_test.context context
where event.document_id in (
  context.same_document_id,
  context.compete_document_a_id,
  context.compete_document_b_id,
  context.retry_document_id
);

delete from public.inventory_document_operations operation
using inventory_concurrency_test.context context
where operation.document_id in (
  context.same_document_id,
  context.compete_document_a_id,
  context.compete_document_b_id,
  context.retry_document_id
);

delete from public.inventory_document_lines line
using inventory_concurrency_test.context context
where line.id in (
  context.same_line_id,
  context.compete_line_a_id,
  context.compete_line_b_id,
  context.retry_line_id
);

delete from public.inventory_documents document
using inventory_concurrency_test.context context
where document.id in (
  context.same_document_id,
  context.compete_document_a_id,
  context.compete_document_b_id,
  context.retry_document_id
);

delete from public.inventory_stock_balances balance
using inventory_concurrency_test.context context
where balance.warehouse_id = context.warehouse_id
  and balance.item_id in (context.same_item_id, context.compete_item_id, context.retry_item_id);

delete from public.inventory_items item
using inventory_concurrency_test.context context
where item.id in (context.same_item_id, context.compete_item_id, context.retry_item_id);

delete from public.inventory_user_access access
using inventory_concurrency_test.context context
where access.auth_user_id in (context.actor_a, context.actor_b)
  and access.warehouse_id is null
  and access.role = 'owner';

delete from public.inventory_units unit
using inventory_concurrency_test.context context
where unit.id = context.unit_id;

delete from public.inventory_warehouses warehouse
using inventory_concurrency_test.context context
where warehouse.id = context.warehouse_id;

drop schema inventory_concurrency_test cascade;

reset statement_timeout;
reset lock_timeout;
