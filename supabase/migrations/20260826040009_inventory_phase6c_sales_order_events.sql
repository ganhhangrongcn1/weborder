-- Phase 6C: tự động ghi nhận đơn bán vào sổ kho theo hàng đợi idempotent.
-- Migration này KHÔNG backfill đơn lịch sử. Chỉ thay đổi trạng thái phát sinh sau khi triển khai mới được xếp hàng.

alter table public.inventory_documents alter column created_by drop not null;

create table if not exists public.inventory_sales_order_events (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('order', 'partner_order')),
  source_order_key text not null,
  source_row_id text not null,
  event_type text not null check (event_type in ('sale', 'reversal')),
  source_status text not null default '',
  branch_uuid uuid,
  warehouse_id uuid references public.inventory_warehouses(id),
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'completed', 'blocked', 'ignored')),
  issue_code text,
  issue_message text,
  document_id uuid references public.inventory_documents(id),
  reverses_event_id uuid references public.inventory_sales_order_events(id),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default (now() + interval '30 seconds'),
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_order_key, event_type)
);

create table if not exists public.inventory_sales_order_event_lines (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.inventory_sales_order_events(id) on delete cascade,
  source_line_key text not null default '',
  source_line_name text not null default '',
  menu_entity_type text,
  menu_entity_id text,
  menu_entity_name text,
  recipe_id uuid references public.inventory_sales_recipes(id),
  item_id uuid references public.inventory_items(id),
  required_quantity numeric(18,6),
  line_status text not null check (line_status in ('ready', 'blocked', 'ignored')),
  issue_code text,
  issue_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists inventory_sales_order_events_queue_idx
  on public.inventory_sales_order_events (processing_status, available_at, created_at)
  where processing_status = 'pending';
create index if not exists inventory_sales_order_events_branch_idx
  on public.inventory_sales_order_events (branch_uuid, created_at desc);
create index if not exists inventory_sales_order_events_document_idx
  on public.inventory_sales_order_events (document_id)
  where document_id is not null;
create index if not exists inventory_sales_order_event_lines_event_idx
  on public.inventory_sales_order_event_lines (event_id, line_status);

create or replace function private.inventory_sales_normalize_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(
    regexp_replace(btrim(coalesce(p_value, '')), '[[:space:]]+', ' ', 'g'),
    '[[:space:]]*\((tự trộn|trộn đều topping|trộn đều|trộn sẵn|xé và trộn sẵn|để riêng tự trộn)\)[[:space:]]*$',
    '',
    'i'
  ));
$$;

create or replace function private.inventory_is_operational_option(p_group text, p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    private.inventory_sales_normalize_text(p_group) like '%cách chế biến%'
    or private.inventory_sales_normalize_text(p_group) in ('mức độ cay', 'độ cay')
    or private.inventory_sales_normalize_text(p_name) like any (array[
      '%trộn đều topping%', '%để riêng tự trộn%', '%không cay%', '%hơi cay%', '%cay vừa%', '%cay sấp mặt%'
    ]);
$$;

create or replace function private.inventory_queue_sales_event(
  p_source_type text,
  p_source_order_key text,
  p_source_row_id text,
  p_event_type text,
  p_source_status text,
  p_branch_uuid uuid,
  p_occurred_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  if p_source_type not in ('order', 'partner_order')
     or p_event_type not in ('sale', 'reversal')
     or nullif(btrim(p_source_order_key), '') is null
     or nullif(btrim(p_source_row_id), '') is null then
    return null;
  end if;

  insert into public.inventory_sales_order_events (
    source_type, source_order_key, source_row_id, event_type, source_status,
    branch_uuid, processing_status, available_at, occurred_at, updated_at
  ) values (
    p_source_type, btrim(p_source_order_key), btrim(p_source_row_id), p_event_type,
    lower(btrim(coalesce(p_source_status, ''))), p_branch_uuid, 'pending',
    now() + interval '30 seconds', coalesce(p_occurred_at, now()), now()
  )
  on conflict (source_type, source_order_key, event_type) do update
  set source_row_id = excluded.source_row_id,
      source_status = excluded.source_status,
      branch_uuid = coalesce(excluded.branch_uuid, public.inventory_sales_order_events.branch_uuid),
      available_at = case
        when public.inventory_sales_order_events.processing_status in ('completed', 'blocked', 'ignored')
          then public.inventory_sales_order_events.available_at
        else now() + interval '30 seconds'
      end,
      processing_status = case
        when public.inventory_sales_order_events.processing_status in ('completed', 'blocked', 'ignored')
          then public.inventory_sales_order_events.processing_status
        else 'pending'
      end,
      issue_code = case when public.inventory_sales_order_events.processing_status in ('completed', 'blocked', 'ignored')
        then public.inventory_sales_order_events.issue_code else null end,
      issue_message = case when public.inventory_sales_order_events.processing_status in ('completed', 'blocked', 'ignored')
        then public.inventory_sales_order_events.issue_message else null end,
      updated_at = now()
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function private.inventory_enqueue_sales_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_key text;
  v_branch uuid;
begin
  if tg_table_name = 'orders' then
    v_status := lower(btrim(coalesce(new.status, '')));
    if v_status not in ('done', 'cancelled') then return new; end if;
    if tg_op = 'UPDATE' and lower(btrim(coalesce(old.status, ''))) = v_status then return new; end if;
    v_key := new.id;
    v_branch := coalesce(new.branch_uuid, new.pickup_branch_uuid, new.delivery_branch_uuid, new.branch_id, new.pickup_branch_id, new.delivery_branch_id);
    perform private.inventory_queue_sales_event(
      'order', v_key, new.id,
      case when v_status = 'done' then 'sale' else 'reversal' end,
      v_status, v_branch, coalesce(new.updated_at, new.created_at, now())
    );
  else
    v_status := lower(btrim(coalesce(new.order_status, '')));
    if v_status not in ('completed', 'cancelled') then return new; end if;
    if tg_op = 'UPDATE' and lower(btrim(coalesce(old.order_status, ''))) = v_status then return new; end if;
    v_key := lower(btrim(coalesce(new.partner_source, 'other'))) || ':' || coalesce(nullif(btrim(new.nexpos_order_id), ''), new.id::text);
    perform private.inventory_queue_sales_event(
      'partner_order', v_key, new.id::text,
      case when v_status = 'completed' then 'sale' else 'reversal' end,
      v_status, new.branch_uuid, coalesce(new.updated_at, new.order_time, new.created_at, now())
    );
  end if;
  return new;
end;
$$;

create or replace function private.inventory_requeue_sales_event_from_line()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_order_id text := coalesce(new.order_id, old.order_id);
  v_partner_order_id uuid := coalesce(new.partner_order_id, old.partner_order_id);
  v_status text;
begin
  if tg_table_name = 'order_items' then
    select * into v_order from public.orders where id = v_order_id;
    if not found then return coalesce(new, old); end if;
    v_status := lower(btrim(coalesce(v_order.status, '')));
    if v_status in ('done', 'cancelled') then
      perform private.inventory_queue_sales_event(
        'order', v_order.id, v_order.id,
        case when v_status = 'done' then 'sale' else 'reversal' end,
        v_status,
        coalesce(v_order.branch_uuid, v_order.pickup_branch_uuid, v_order.delivery_branch_uuid, v_order.branch_id, v_order.pickup_branch_id, v_order.delivery_branch_id),
        coalesce(v_order.updated_at, v_order.created_at, now())
      );
    end if;
  else
    select * into v_order from public.partner_orders where id = v_partner_order_id;
    if not found then return coalesce(new, old); end if;
    v_status := lower(btrim(coalesce(v_order.order_status, '')));
    if v_status in ('completed', 'cancelled') then
      perform private.inventory_queue_sales_event(
        'partner_order',
        lower(btrim(coalesce(v_order.partner_source, 'other'))) || ':' || coalesce(nullif(btrim(v_order.nexpos_order_id), ''), v_order.id::text),
        v_order.id::text,
        case when v_status = 'completed' then 'sale' else 'reversal' end,
        v_status, v_order.branch_uuid,
        coalesce(v_order.updated_at, v_order.order_time, v_order.created_at, now())
      );
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists inventory_enqueue_sales_order_status on public.orders;
create trigger inventory_enqueue_sales_order_status
after insert or update of status on public.orders
for each row execute function private.inventory_enqueue_sales_order_status();

drop trigger if exists inventory_enqueue_partner_order_status on public.partner_orders;
create trigger inventory_enqueue_partner_order_status
after insert or update of order_status on public.partner_orders
for each row execute function private.inventory_enqueue_sales_order_status();

drop trigger if exists inventory_requeue_sales_event_from_order_item on public.order_items;
create trigger inventory_requeue_sales_event_from_order_item
after insert or update or delete on public.order_items
for each row execute function private.inventory_requeue_sales_event_from_line();

drop trigger if exists inventory_requeue_sales_event_from_partner_item on public.partner_order_items;
create trigger inventory_requeue_sales_event_from_partner_item
after insert or update or delete on public.partner_order_items
for each row execute function private.inventory_requeue_sales_event_from_line();

create or replace function private.inventory_sales_add_recipe_requirements(
  p_event_id uuid,
  p_source_line_key text,
  p_source_line_name text,
  p_menu_entity_type text,
  p_menu_entity_id text,
  p_menu_entity_name text,
  p_sales_quantity numeric,
  p_branch_uuid uuid,
  p_effective_date date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipe public.inventory_sales_recipes%rowtype;
begin
  select recipe.* into v_recipe
  from public.inventory_sales_recipes recipe
  where recipe.menu_entity_type = p_menu_entity_type
    and recipe.menu_entity_id = p_menu_entity_id
    and recipe.status = 'active'
    and recipe.deleted_at is null
    and recipe.effective_from <= coalesce(p_effective_date, current_date)
    and (recipe.effective_to is null or recipe.effective_to >= coalesce(p_effective_date, current_date))
    and (recipe.branch_uuid = p_branch_uuid or recipe.branch_uuid is null)
  order by (recipe.branch_uuid = p_branch_uuid) desc, recipe.version desc
  limit 1;

  if not found then
    insert into public.inventory_sales_order_event_lines (
      event_id, source_line_key, source_line_name, menu_entity_type, menu_entity_id,
      menu_entity_name, line_status, issue_code, issue_message
    ) values (
      p_event_id, coalesce(p_source_line_key, ''), coalesce(p_source_line_name, ''),
      p_menu_entity_type, p_menu_entity_id, p_menu_entity_name,
      'blocked', 'missing_recipe', 'Món chưa có định lượng đang áp dụng.'
    );
    return false;
  end if;

  insert into public.inventory_sales_order_event_lines (
    event_id, source_line_key, source_line_name, menu_entity_type, menu_entity_id,
    menu_entity_name, recipe_id, item_id, required_quantity, line_status
  )
  select
    p_event_id, coalesce(p_source_line_key, ''), coalesce(p_source_line_name, ''),
    p_menu_entity_type, p_menu_entity_id, p_menu_entity_name,
    v_recipe.id, component.item_id,
    round(greatest(coalesce(p_sales_quantity, 0), 0) * component.base_quantity / v_recipe.yield_quantity, 6),
    'ready'
  from public.inventory_sales_recipe_components component
  where component.recipe_id = v_recipe.id
    and component.base_quantity > 0;

  if not found then
    insert into public.inventory_sales_order_event_lines (
      event_id, source_line_key, source_line_name, menu_entity_type, menu_entity_id,
      menu_entity_name, recipe_id, line_status, issue_code, issue_message
    ) values (
      p_event_id, coalesce(p_source_line_key, ''), coalesce(p_source_line_name, ''),
      p_menu_entity_type, p_menu_entity_id, p_menu_entity_name, v_recipe.id,
      'blocked', 'empty_recipe', 'Định lượng chưa có thành phần hợp lệ.'
    );
    return false;
  end if;

  return true;
end;
$$;

create or replace function private.inventory_process_sales_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.inventory_sales_order_events%rowtype;
  v_order record;
  v_line record;
  v_option record;
  v_mapping public.inventory_channel_mappings%rowtype;
  v_target record;
  v_requirement record;
  v_original_event public.inventory_sales_order_events%rowtype;
  v_warehouse public.inventory_warehouses%rowtype;
  v_document_id uuid;
  v_document_line_id uuid;
  v_old_quantity numeric(18,6);
  v_old_average_cost numeric(18,2);
  v_new_quantity numeric(18,6);
  v_new_average_cost numeric(18,2);
  v_source_date date;
  v_current_status text;
  v_movement_count integer := 0;
  v_block_count integer := 0;
  v_ready_count integer := 0;
begin
  select * into v_event
  from public.inventory_sales_order_events event
  where event.id = p_event_id
  for update;

  if not found then return jsonb_build_object('ok', false, 'message', 'Không tìm thấy sự kiện đơn bán.'); end if;
  if v_event.processing_status = 'completed' then
    return jsonb_build_object('ok', true, 'idempotent_replay', true, 'event_id', v_event.id, 'document_id', v_event.document_id);
  end if;

  update public.inventory_sales_order_events
  set processing_status = 'processing', attempts = attempts + 1, updated_at = now()
  where id = v_event.id;

  if v_event.event_type = 'reversal' then
    select * into v_original_event
    from public.inventory_sales_order_events original
    where original.source_type = v_event.source_type
      and original.source_order_key = v_event.source_order_key
      and original.event_type = 'sale'
      and original.processing_status = 'completed'
    for update;

    if not found then
      update public.inventory_sales_order_events
      set processing_status = 'ignored', issue_code = 'sale_not_recorded',
          issue_message = 'Đơn bị hủy trước khi phát sinh bút toán xuất kho.',
          processed_at = now(), updated_at = now()
      where id = v_event.id;
      return jsonb_build_object('ok', true, 'status', 'ignored');
    end if;

    select * into v_warehouse from public.inventory_warehouses where id = v_original_event.warehouse_id for share;
    if not found then raise exception 'Kho của bút toán gốc không còn tồn tại.'; end if;

    insert into public.inventory_stock_balances (warehouse_id, item_id, quantity, average_cost, updated_at)
    select distinct v_original_event.warehouse_id, line.item_id, 0, 0, now()
    from public.inventory_document_lines line
    where line.document_id = v_original_event.document_id
    on conflict (warehouse_id, item_id) do nothing;

    perform balance.item_id
    from public.inventory_stock_balances balance
    join public.inventory_document_lines line on line.item_id = balance.item_id
    where balance.warehouse_id = v_original_event.warehouse_id
      and line.document_id = v_original_event.document_id
    order by balance.item_id
    for update of balance;

    insert into public.inventory_documents (
      document_no, idempotency_key, document_type, status, destination_warehouse_id,
      source_document_id, reference_no, occurred_at, notes, metadata, created_by,
      completed_at, reversal_reason
    ) values (
      'REV-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || upper(substr(replace(v_event.id::text, '-', ''), 1, 6)),
      'sales-reversal:' || v_event.source_type || ':' || v_event.source_order_key,
      'reversal', 'completed', v_original_event.warehouse_id, v_original_event.document_id,
      v_event.source_order_key, v_event.occurred_at,
      'Hoàn tồn do đơn bán bị hủy.',
      jsonb_build_object('sales_event_id', v_event.id, 'source_type', v_event.source_type, 'source_row_id', v_event.source_row_id),
      null, now(), 'Đơn bán đã hủy sau khi ghi nhận xuất kho.'
    ) returning id into v_document_id;

    for v_line in
      select line.*, movement.unit_cost
      from public.inventory_document_lines line
      join public.inventory_stock_movements movement
        on movement.document_line_id = line.id
       and movement.document_id = line.document_id
       and movement.direction = 'out'
      where line.document_id = v_original_event.document_id
      order by line.item_id
    loop
      select balance.quantity, balance.average_cost
      into v_old_quantity, v_old_average_cost
      from public.inventory_stock_balances balance
      where balance.warehouse_id = v_original_event.warehouse_id and balance.item_id = v_line.item_id
      for update;

      insert into public.inventory_document_lines (
        document_id, item_id, unit_id, conversion_to_base, expected_quantity,
        received_quantity, actual_quantity, base_quantity, unit_price, notes
      ) values (
        v_document_id, v_line.item_id, v_line.unit_id, 1, v_line.base_quantity,
        v_line.base_quantity, v_line.base_quantity, v_line.base_quantity, v_line.unit_cost,
        'Hoàn lại từ phiếu ' || v_original_event.document_id::text
      ) returning id into v_document_line_id;

      v_new_quantity := v_old_quantity + v_line.base_quantity;
      v_new_average_cost := case
        when v_new_quantity <= 0 then v_old_average_cost
        when v_old_quantity > 0 then round(((v_old_quantity * v_old_average_cost) + (v_line.base_quantity * v_line.unit_cost)) / v_new_quantity, 2)
        else round(v_line.unit_cost, 2)
      end;

      insert into public.inventory_stock_movements (
        warehouse_id, item_id, document_id, document_line_id, direction,
        movement_stage, quantity, unit_cost, occurred_at, created_by
      ) values (
        v_original_event.warehouse_id, v_line.item_id, v_document_id, v_document_line_id,
        'in', 'reversal', v_line.base_quantity, v_line.unit_cost, v_event.occurred_at, null
      );

      update public.inventory_stock_balances
      set quantity = v_new_quantity, average_cost = v_new_average_cost, updated_at = now()
      where warehouse_id = v_original_event.warehouse_id and item_id = v_line.item_id;
      v_movement_count := v_movement_count + 1;
    end loop;

    update public.inventory_sales_order_events
    set processing_status = 'completed', warehouse_id = v_original_event.warehouse_id,
        document_id = v_document_id, reverses_event_id = v_original_event.id,
        issue_code = null, issue_message = null, processed_at = now(), updated_at = now()
    where id = v_event.id;

    return jsonb_build_object('ok', true, 'status', 'completed', 'document_id', v_document_id, 'movement_count', v_movement_count);
  end if;

  delete from public.inventory_sales_order_event_lines where event_id = v_event.id;

  if v_event.source_type = 'order' then
    select * into v_order from public.orders where id = v_event.source_row_id;
    if not found then raise exception 'Không tìm thấy đơn Website/POS/QR.'; end if;
    v_current_status := lower(btrim(coalesce(v_order.status, '')));
    v_event.branch_uuid := coalesce(v_order.branch_uuid, v_order.pickup_branch_uuid, v_order.delivery_branch_uuid, v_order.branch_id, v_order.pickup_branch_id, v_order.delivery_branch_id);
    v_source_date := coalesce(v_order.updated_at, v_order.created_at, now())::date;
    if v_current_status <> 'done' then
      update public.inventory_sales_order_events set processing_status = 'ignored', issue_code = 'not_completed',
        issue_message = 'Đơn không còn ở trạng thái hoàn tất.', processed_at = now(), updated_at = now() where id = v_event.id;
      return jsonb_build_object('ok', true, 'status', 'ignored');
    end if;
  else
    select * into v_order from public.partner_orders where id = v_event.source_row_id::uuid;
    if not found then raise exception 'Không tìm thấy đơn đối tác.'; end if;
    v_current_status := lower(btrim(coalesce(v_order.order_status, '')));
    v_event.branch_uuid := v_order.branch_uuid;
    v_source_date := coalesce(v_order.order_time, v_order.updated_at, v_order.created_at, now())::date;
    if v_current_status <> 'completed' then
      update public.inventory_sales_order_events set processing_status = 'ignored', issue_code = 'not_completed',
        issue_message = 'Đơn đối tác không còn ở trạng thái hoàn tất.', processed_at = now(), updated_at = now() where id = v_event.id;
      return jsonb_build_object('ok', true, 'status', 'ignored');
    end if;
  end if;

  if v_event.branch_uuid is null then
    update public.inventory_sales_order_events set processing_status = 'blocked', issue_code = 'missing_branch',
      issue_message = 'Đơn chưa xác định được chi nhánh.', branch_uuid = null, updated_at = now() where id = v_event.id;
    return jsonb_build_object('ok', false, 'status', 'blocked', 'issue_code', 'missing_branch');
  end if;

  select * into v_warehouse
  from public.inventory_warehouses warehouse
  where warehouse.branch_uuid = v_event.branch_uuid
    and warehouse.is_default_for_branch
    and warehouse.is_active
    and warehouse.deleted_at is null
  order by warehouse.updated_at desc
  limit 1;

  if not found then
    update public.inventory_sales_order_events set processing_status = 'blocked', branch_uuid = v_event.branch_uuid,
      issue_code = 'missing_warehouse', issue_message = 'Chi nhánh chưa thiết lập kho trừ mặc định.', updated_at = now()
    where id = v_event.id;
    return jsonb_build_object('ok', false, 'status', 'blocked', 'issue_code', 'missing_warehouse');
  end if;

  if v_event.source_type = 'order' then
    for v_line in select * from public.order_items where order_id = v_event.source_row_id order by id
    loop
      perform private.inventory_sales_add_recipe_requirements(
        v_event.id, v_line.id::text, v_line.product_name, 'product', v_line.product_id,
        v_line.product_name, v_line.quantity, v_event.branch_uuid, v_source_date
      );

      for v_option in
        select
          coalesce(option_row ->> 'id', option_row ->> 'optionId', '') as option_id,
          coalesce(option_row ->> 'name', option_row ->> 'optionName', '') as option_name,
          coalesce(nullif(option_row ->> 'quantity', '')::numeric, 1) as option_quantity
        from jsonb_array_elements(case when jsonb_typeof(v_line.toppings) = 'array' then v_line.toppings else '[]'::jsonb end) option_row
        union all
        select
          coalesce(option_row ->> 'id', option_row ->> 'optionId', '') as option_id,
          coalesce(option_row ->> 'name', option_row ->> 'optionName', '') as option_name,
          coalesce(nullif(option_row ->> 'quantity', '')::numeric, 1) as option_quantity
        from jsonb_array_elements(case when jsonb_typeof(v_line.option_groups) = 'array' then v_line.option_groups else '[]'::jsonb end) group_row
        cross join lateral jsonb_array_elements(case when jsonb_typeof(group_row -> 'options') = 'array' then group_row -> 'options' else '[]'::jsonb end) option_row
      loop
        if exists (
          select 1 from public.inventory_sales_recipes recipe
          where recipe.menu_entity_type = 'topping' and recipe.menu_entity_id = v_option.option_id
            and recipe.status = 'active' and recipe.deleted_at is null
            and (recipe.branch_uuid = v_event.branch_uuid or recipe.branch_uuid is null)
        ) then
          perform private.inventory_sales_add_recipe_requirements(
            v_event.id, v_line.id::text || ':option:' || v_option.option_id, v_option.option_name,
            'topping', v_option.option_id, v_option.option_name,
            v_line.quantity * v_option.option_quantity, v_event.branch_uuid, v_source_date
          );
        end if;
      end loop;
    end loop;
  else
    for v_line in select * from public.partner_order_items where partner_order_id = v_event.source_row_id::uuid order by line_index nulls last, id
    loop
      select mapping.* into v_mapping
      from public.inventory_channel_mappings mapping
      where mapping.partner_source = lower(btrim(v_line.partner_source))
        and mapping.mapping_kind = 'item' and mapping.status = 'active'
        and (mapping.partner_source = 'shopeefood' or mapping.branch_uuid = v_event.branch_uuid)
        and (
          (nullif(btrim(mapping.external_item_id), '') is not null and nullif(btrim(v_line.partner_item_id), '') = btrim(mapping.external_item_id))
          or private.inventory_sales_normalize_text(mapping.external_item_name) = private.inventory_sales_normalize_text(v_line.partner_item_name)
        )
      order by (mapping.branch_uuid = v_event.branch_uuid) desc, mapping.updated_at desc
      limit 1;

      if not found then
        insert into public.inventory_sales_order_event_lines (
          event_id, source_line_key, source_line_name, line_status, issue_code, issue_message
        ) values (
          v_event.id, v_line.id::text, v_line.partner_item_name, 'blocked', 'missing_mapping', 'Món trên app chưa được gán vào Menu.'
        );
      elsif v_mapping.ignore_inventory then
        insert into public.inventory_sales_order_event_lines (
          event_id, source_line_key, source_line_name, line_status, issue_code, issue_message
        ) values (
          v_event.id, v_line.id::text, v_line.partner_item_name, 'ignored', 'ignored_mapping', 'Món được cấu hình không trừ kho.'
        );
      else
        for v_target in select * from public.inventory_channel_mapping_targets where mapping_id = v_mapping.id order by display_order, id
        loop
          perform private.inventory_sales_add_recipe_requirements(
            v_event.id, v_line.id::text, v_line.partner_item_name,
            v_target.menu_entity_type, v_target.menu_entity_id, v_target.menu_entity_name,
            v_line.quantity * v_target.quantity, v_event.branch_uuid, v_source_date
          );
        end loop;
      end if;

      for v_option in
        select
          coalesce(nullif(btrim(option_row ->> 'option_name'), ''), nullif(btrim(option_row ->> 'groupName'), ''), 'Tùy chọn') as option_group,
          coalesce(nullif(btrim(option_row ->> 'option_item'), ''), nullif(btrim(option_row ->> 'name'), '')) as option_name,
          coalesce(nullif(option_row ->> 'quantity', '')::numeric, 1) as option_quantity
        from jsonb_array_elements(case when jsonb_typeof(v_line.options) = 'array' then v_line.options else '[]'::jsonb end) option_row
      loop
        if private.inventory_is_operational_option(v_option.option_group, v_option.option_name) then continue; end if;

        select mapping.* into v_mapping
        from public.inventory_channel_mappings mapping
        where mapping.partner_source = lower(btrim(v_line.partner_source))
          and mapping.mapping_kind = 'option' and mapping.status = 'active'
          and (mapping.partner_source = 'shopeefood' or mapping.branch_uuid = v_event.branch_uuid)
          and (mapping.external_item_name = '*' or private.inventory_sales_normalize_text(mapping.external_item_name) = private.inventory_sales_normalize_text(v_line.partner_item_name))
          and private.inventory_sales_normalize_text(mapping.external_option_group) = private.inventory_sales_normalize_text(v_option.option_group)
          and private.inventory_sales_normalize_text(mapping.external_option_name) = private.inventory_sales_normalize_text(v_option.option_name)
        order by (mapping.branch_uuid = v_event.branch_uuid) desc, mapping.updated_at desc
        limit 1;

        if not found then
          insert into public.inventory_sales_order_event_lines (
            event_id, source_line_key, source_line_name, line_status, issue_code, issue_message, metadata
          ) values (
            v_event.id, v_line.id::text || ':option:' || private.inventory_sales_normalize_text(v_option.option_name),
            v_option.option_name, 'blocked', 'missing_option_mapping', 'Lựa chọn trên app chưa được gán vào Menu.',
            jsonb_build_object('option_group', v_option.option_group)
          );
        elsif v_mapping.ignore_inventory then
          insert into public.inventory_sales_order_event_lines (
            event_id, source_line_key, source_line_name, line_status, issue_code, issue_message
          ) values (
            v_event.id, v_line.id::text || ':option:' || private.inventory_sales_normalize_text(v_option.option_name),
            v_option.option_name, 'ignored', 'ignored_mapping', 'Lựa chọn được cấu hình không trừ kho.'
          );
        else
          for v_target in select * from public.inventory_channel_mapping_targets where mapping_id = v_mapping.id order by display_order, id
          loop
            perform private.inventory_sales_add_recipe_requirements(
              v_event.id, v_line.id::text || ':option:' || private.inventory_sales_normalize_text(v_option.option_name),
              v_option.option_name, v_target.menu_entity_type, v_target.menu_entity_id, v_target.menu_entity_name,
              v_line.quantity * v_option.option_quantity * v_target.quantity,
              v_event.branch_uuid, v_source_date
            );
          end loop;
        end if;
      end loop;
    end loop;
  end if;

  select count(*) filter (where line_status = 'blocked'), count(*) filter (where line_status = 'ready')
  into v_block_count, v_ready_count
  from public.inventory_sales_order_event_lines where event_id = v_event.id;

  if v_block_count > 0 then
    update public.inventory_sales_order_events
    set processing_status = 'blocked', branch_uuid = v_event.branch_uuid, warehouse_id = v_warehouse.id,
        issue_code = 'configuration_incomplete',
        issue_message = v_block_count || ' dòng chưa đủ định lượng hoặc ánh xạ.', updated_at = now()
    where id = v_event.id;
    return jsonb_build_object('ok', false, 'status', 'blocked', 'blocked_lines', v_block_count);
  end if;

  if v_ready_count = 0 then
    update public.inventory_sales_order_events
    set processing_status = 'ignored', branch_uuid = v_event.branch_uuid, warehouse_id = v_warehouse.id,
        issue_code = 'no_inventory_effect', issue_message = 'Đơn không có món cần trừ kho.',
        processed_at = now(), updated_at = now()
    where id = v_event.id;
    return jsonb_build_object('ok', true, 'status', 'ignored');
  end if;

  insert into public.inventory_stock_balances (warehouse_id, item_id, quantity, average_cost, updated_at)
  select v_warehouse.id, item_id, 0, 0, now()
  from public.inventory_sales_order_event_lines
  where event_id = v_event.id and line_status = 'ready'
  group by item_id
  on conflict (warehouse_id, item_id) do nothing;

  perform balance.item_id
  from public.inventory_stock_balances balance
  join (
    select item_id from public.inventory_sales_order_event_lines
    where event_id = v_event.id and line_status = 'ready' group by item_id
  ) requirement on requirement.item_id = balance.item_id
  where balance.warehouse_id = v_warehouse.id
  order by balance.item_id
  for update of balance;

  for v_requirement in
    select item_id, round(sum(required_quantity), 6) as quantity
    from public.inventory_sales_order_event_lines
    where event_id = v_event.id and line_status = 'ready'
    group by item_id order by item_id
  loop
    select quantity, average_cost into v_old_quantity, v_old_average_cost
    from public.inventory_stock_balances
    where warehouse_id = v_warehouse.id and item_id = v_requirement.item_id
    for update;
    if not v_warehouse.allow_negative_stock and v_old_quantity < v_requirement.quantity then
      insert into public.inventory_sales_order_event_lines (
        event_id, source_line_key, source_line_name, item_id, required_quantity,
        line_status, issue_code, issue_message, metadata
      ) values (
        v_event.id, 'stock:' || v_requirement.item_id::text, '', v_requirement.item_id,
        v_requirement.quantity, 'blocked', 'insufficient_stock', 'Tồn kho không đủ để ghi nhận đơn.',
        jsonb_build_object('available_quantity', v_old_quantity)
      );
      v_block_count := v_block_count + 1;
    end if;
  end loop;

  if v_block_count > 0 then
    update public.inventory_sales_order_events
    set processing_status = 'blocked', branch_uuid = v_event.branch_uuid, warehouse_id = v_warehouse.id,
        issue_code = 'insufficient_stock', issue_message = 'Tồn kho không đủ; chưa ghi giảm bất kỳ mặt hàng nào.', updated_at = now()
    where id = v_event.id;
    return jsonb_build_object('ok', false, 'status', 'blocked', 'issue_code', 'insufficient_stock');
  end if;

  insert into public.inventory_documents (
    document_no, idempotency_key, document_type, status, source_warehouse_id,
    reference_no, occurred_at, notes, metadata, created_by, completed_at
  ) values (
    'SALE-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || upper(substr(replace(v_event.id::text, '-', ''), 1, 6)),
    'sales-order:' || v_event.source_type || ':' || v_event.source_order_key,
    'stock_issue', 'completed', v_warehouse.id, v_event.source_order_key, v_event.occurred_at,
    'Xuất kho tự động theo đơn bán hoàn tất.',
    jsonb_build_object('sales_event_id', v_event.id, 'source_type', v_event.source_type, 'source_row_id', v_event.source_row_id),
    null, now()
  ) returning id into v_document_id;

  for v_requirement in
    select event_line.item_id, round(sum(event_line.required_quantity), 6) as quantity,
           item.base_unit_id
    from public.inventory_sales_order_event_lines event_line
    join public.inventory_items item on item.id = event_line.item_id
    where event_line.event_id = v_event.id and event_line.line_status = 'ready'
    group by event_line.item_id, item.base_unit_id
    order by event_line.item_id
  loop
    select quantity, average_cost into v_old_quantity, v_old_average_cost
    from public.inventory_stock_balances
    where warehouse_id = v_warehouse.id and item_id = v_requirement.item_id
    for update;

    insert into public.inventory_document_lines (
      document_id, item_id, unit_id, conversion_to_base, expected_quantity,
      shipped_quantity, actual_quantity, base_quantity, unit_price, notes
    ) values (
      v_document_id, v_requirement.item_id, v_requirement.base_unit_id, 1,
      v_requirement.quantity, v_requirement.quantity, v_requirement.quantity,
      v_requirement.quantity, v_old_average_cost, 'Tổng hợp từ định lượng món bán.'
    ) returning id into v_document_line_id;

    insert into public.inventory_stock_movements (
      warehouse_id, item_id, document_id, document_line_id, direction,
      movement_stage, quantity, unit_cost, occurred_at, created_by
    ) values (
      v_warehouse.id, v_requirement.item_id, v_document_id, v_document_line_id,
      'out', 'order_consumption', v_requirement.quantity, v_old_average_cost, v_event.occurred_at, null
    );

    update public.inventory_stock_balances
    set quantity = v_old_quantity - v_requirement.quantity, updated_at = now()
    where warehouse_id = v_warehouse.id and item_id = v_requirement.item_id;
    v_movement_count := v_movement_count + 1;
  end loop;

  update public.inventory_sales_order_events
  set processing_status = 'completed', branch_uuid = v_event.branch_uuid, warehouse_id = v_warehouse.id,
      document_id = v_document_id, issue_code = null, issue_message = null,
      processed_at = now(), updated_at = now()
  where id = v_event.id;

  return jsonb_build_object('ok', true, 'status', 'completed', 'document_id', v_document_id, 'movement_count', v_movement_count);
exception when others then
  update public.inventory_sales_order_events
  set processing_status = 'blocked', issue_code = 'processing_error', issue_message = sqlerrm, updated_at = now()
  where id = p_event_id and processing_status <> 'completed';
  return jsonb_build_object('ok', false, 'status', 'blocked', 'message', sqlerrm);
end;
$$;

create or replace function private.inventory_process_sales_event_queue(p_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event record;
  v_processed integer := 0;
begin
  for v_event in
    select event.id
    from public.inventory_sales_order_events event
    where event.processing_status = 'pending' and event.available_at <= now()
    order by event.created_at, case when event.event_type = 'sale' then 0 else 1 end
    limit greatest(1, least(coalesce(p_limit, 50), 200))
    for update skip locked
  loop
    perform private.inventory_process_sales_event(v_event.id);
    v_processed := v_processed + 1;
  end loop;
  return v_processed;
end;
$$;

create or replace function public.inventory_retry_sales_order_event(p_event_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.inventory_sales_order_events%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Bạn cần đăng nhập để thử xử lý lại.'; end if;
  select * into v_event from public.inventory_sales_order_events where id = p_event_id;
  if not found or not (select private.inventory_can_view_sales_branch(v_event.branch_uuid)) then
    raise exception 'Không tìm thấy sự kiện hoặc tài khoản không có quyền.';
  end if;
  if v_event.processing_status not in ('blocked', 'ignored') then
    raise exception 'Chỉ sự kiện đang treo mới được thử lại.';
  end if;
  update public.inventory_sales_order_events
  set processing_status = 'pending', issue_code = null, issue_message = null,
      available_at = now(), processed_at = null, updated_at = now()
  where id = p_event_id;
  return p_event_id;
end;
$$;

alter table public.inventory_sales_order_events enable row level security;
alter table public.inventory_sales_order_event_lines enable row level security;

drop policy if exists inventory_sales_order_events_select on public.inventory_sales_order_events;
create policy inventory_sales_order_events_select on public.inventory_sales_order_events
for select to authenticated
using ((select private.inventory_can_view_sales_branch(branch_uuid)));

drop policy if exists inventory_sales_order_event_lines_select on public.inventory_sales_order_event_lines;
create policy inventory_sales_order_event_lines_select on public.inventory_sales_order_event_lines
for select to authenticated
using (exists (
  select 1 from public.inventory_sales_order_events event
  where event.id = event_id and (select private.inventory_can_view_sales_branch(event.branch_uuid))
));

revoke all on table public.inventory_sales_order_events from public, anon;
revoke all on table public.inventory_sales_order_event_lines from public, anon;
grant select on table public.inventory_sales_order_events to authenticated, service_role;
grant select on table public.inventory_sales_order_event_lines to authenticated, service_role;
grant insert, update, delete on table public.inventory_sales_order_events to service_role;
grant insert, update, delete on table public.inventory_sales_order_event_lines to service_role;

revoke all on function public.inventory_retry_sales_order_event(uuid) from public, anon;
grant execute on function public.inventory_retry_sales_order_event(uuid) to authenticated, service_role;
revoke all on function private.inventory_sales_normalize_text(text) from public, anon, authenticated;
revoke all on function private.inventory_is_operational_option(text, text) from public, anon, authenticated;
revoke all on function private.inventory_queue_sales_event(text,text,text,text,text,uuid,timestamptz) from public, anon, authenticated;
revoke all on function private.inventory_process_sales_event(uuid) from public, anon, authenticated;
revoke all on function private.inventory_process_sales_event_queue(integer) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and not exists (select 1 from cron.job where jobname = 'inventory-sales-events-every-minute') then
    perform cron.schedule(
      'inventory-sales-events-every-minute',
      '* * * * *',
      'select private.inventory_process_sales_event_queue(50);'
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';
