-- Sales-only switch. No stock/document writes; existing completed events stay immutable.
-- Abort if another release changed the three sales entrypoints since the audit.
do $$
begin
  if md5(pg_get_functiondef('private.inventory_process_sales_event(uuid)'::regprocedure)) <> '6eb7cb05c214797a84bbe9c08b26487a'
    or md5(pg_get_functiondef('private.inventory_queue_sales_event(text,text,text,text,text,uuid,timestamptz)'::regprocedure)) <> '63344f470224283290e9f0618290dff4'
    or md5(pg_get_functiondef('private.inventory_retry_sales_order_event(uuid)'::regprocedure)) <> 'd9c65f84ea6c9f5a604a2ca0089e82ba' then
    raise exception 'Sales entrypoints changed since audit. Rebase this migration before applying.';
  end if;
end;
$$;
create table if not exists private.inventory_sales_deduction_settings (
  branch_uuid uuid primary key references public.branches(branch_uuid),
  enabled boolean not null default false,
  enabled_from timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid,
  check (not enabled or enabled_from is not null)
);
create table if not exists private.inventory_sales_deduction_history (
  id bigint generated always as identity primary key,
  branch_uuid uuid not null,
  enabled boolean not null,
  enabled_from timestamptz,
  changed_at timestamptz not null default clock_timestamp(),
  changed_by uuid
);
alter table private.inventory_sales_deduction_settings enable row level security;
alter table private.inventory_sales_deduction_history enable row level security;
revoke all on private.inventory_sales_deduction_settings, private.inventory_sales_deduction_history from public, anon, authenticated;
insert into private.inventory_sales_deduction_settings(branch_uuid)
select branch_uuid from public.branches where branch_uuid is not null
on conflict do nothing;

create or replace function private.inventory_can_manage_sales_deduction()
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (select private.inventory_is_admin())
    and not exists (select 1 from public.profiles
      where auth_user_id = (select auth.uid()) and branch_uuid is not null);
$$;
revoke all on function private.inventory_can_manage_sales_deduction() from public, anon;
grant execute on function private.inventory_can_manage_sales_deduction() to authenticated;

create or replace function private.inventory_read_sales_deduction_settings()
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Bạn cần đăng nhập.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'can_manage', private.inventory_can_manage_sales_deduction(),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'branch_uuid', b.branch_uuid, 'branch_name', coalesce(b.name, b.data ->> 'name', b.branch_code),
        'enabled', coalesce(s.enabled, false), 'enabled_from', s.enabled_from,
        'updated_at', s.updated_at,
        'has_warehouse', exists(select 1 from public.inventory_warehouses w
          where w.branch_uuid = b.branch_uuid and w.is_active and w.deleted_at is null and w.is_default_for_branch)
      ) order by b.name)
      from public.branches b left join private.inventory_sales_deduction_settings s using(branch_uuid)
      where b.branch_uuid is not null and (
        private.inventory_can_manage_sales_deduction()
        or (private.inventory_can_view_sales_branch(b.branch_uuid) and not exists (
          select 1 from public.profiles p where p.auth_user_id = (select auth.uid())
            and p.branch_uuid is not null and p.branch_uuid <> b.branch_uuid
        ))
      )
    ), '[]'::jsonb));
end;
$$;
create or replace function public.inventory_read_sales_deduction_settings()
returns jsonb language sql security invoker set search_path = ''
as $$ select private.inventory_read_sales_deduction_settings(); $$;
revoke all on function private.inventory_read_sales_deduction_settings(), public.inventory_read_sales_deduction_settings() from public, anon;
grant execute on function private.inventory_read_sales_deduction_settings(), public.inventory_read_sales_deduction_settings() to authenticated;

create or replace function private.inventory_set_sales_deduction(
  p_branch_uuid uuid, p_enabled boolean, p_expected_updated_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_setting private.inventory_sales_deduction_settings%rowtype;
  v_new boolean;
  v_now timestamptz;
begin
  if not private.inventory_can_manage_sales_deduction() then
    raise exception 'Chỉ Admin toàn hệ thống hoặc Kho Tổng được đổi chế độ trừ kho.' using errcode = '42501';
  end if;
  if p_enabled is null or not exists(select 1 from public.branches where branch_uuid = p_branch_uuid) then
    raise exception 'Chi nhánh hoặc chế độ không hợp lệ.';
  end if;
  insert into private.inventory_sales_deduction_settings(branch_uuid)
  values(p_branch_uuid) on conflict do nothing;
  v_new := found;
  select * into v_setting from private.inventory_sales_deduction_settings
  where branch_uuid = p_branch_uuid for update;
  if not v_new and v_setting.updated_at is distinct from p_expected_updated_at then
    raise exception 'Cài đặt đã thay đổi. Hãy tải lại trước khi lưu.';
  end if;
  if v_setting.enabled = p_enabled then return to_jsonb(v_setting); end if;
  if p_enabled and not exists(select 1 from public.inventory_warehouses
    where branch_uuid = p_branch_uuid and is_active and deleted_at is null and is_default_for_branch) then
    raise exception 'Chi nhánh chưa có kho trừ mặc định đang hoạt động.';
  end if;
  -- Timestamp taken AFTER obtaining the settings lock; no stale transaction time.
  v_now := clock_timestamp();
  update private.inventory_sales_deduction_settings
  set enabled = p_enabled, enabled_from = case when p_enabled then v_now else null end,
      updated_at = v_now, updated_by = (select auth.uid())
  where branch_uuid = p_branch_uuid returning * into v_setting;
  insert into private.inventory_sales_deduction_history(branch_uuid, enabled, enabled_from, changed_at, changed_by)
  values(p_branch_uuid, p_enabled, v_setting.enabled_from, v_now, (select auth.uid()));
  return to_jsonb(v_setting);
end;
$$;
create or replace function public.inventory_set_sales_deduction(
  p_branch_uuid uuid, p_enabled boolean, p_expected_updated_at timestamptz default null
) returns jsonb language sql security invoker set search_path = ''
as $$ select private.inventory_set_sales_deduction(p_branch_uuid,p_enabled,p_expected_updated_at); $$;
revoke all on function private.inventory_set_sales_deduction(uuid,boolean,timestamptz),
  public.inventory_set_sales_deduction(uuid,boolean,timestamptz) from public, anon;
grant execute on function private.inventory_set_sales_deduction(uuid,boolean,timestamptz),
  public.inventory_set_sales_deduction(uuid,boolean,timestamptz) to authenticated;

-- Called only by the existing trusted queue/worker/retry functions, never a public API.
-- Locks one event then one branch setting. Setter never locks events: no lock inversion.
create or replace function private.inventory_exclude_disabled_sale(p_event_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.inventory_sales_order_events%rowtype;
  v_branch uuid;
  v_started_at timestamptz;
  v_setting private.inventory_sales_deduction_settings%rowtype;
  v_reason text;
begin
  select * into v_event from public.inventory_sales_order_events where id=p_event_id for update;
  if not found or v_event.event_type <> 'sale' or v_event.processing_status = 'completed' then return false; end if;
  v_reason := nullif(v_event.metadata ->> 'sales_deduction_excluded', '');
  if v_reason is null then
    v_branch := v_event.branch_uuid;
    if v_event.source_type = 'order' then
      select coalesce(branch_uuid,pickup_branch_uuid,delivery_branch_uuid,branch_id,pickup_branch_id,delivery_branch_id),
        created_at into v_branch,v_started_at from public.orders where id=v_event.source_row_id;
    else
      select branch_uuid, coalesce(order_time,created_at) into v_branch,v_started_at
      from public.partner_orders where id=v_event.source_row_id::uuid;
    end if;
    select * into v_setting from private.inventory_sales_deduction_settings
    where branch_uuid=v_branch for share;
    if not found or not v_setting.enabled then v_reason := 'sales_deduction_disabled';
    elsif v_started_at is null then v_reason := 'sales_order_time_missing';
    elsif v_started_at < v_setting.enabled_from or v_event.created_at < v_setting.enabled_from then
      v_reason := 'sales_before_activation';
    end if;
  end if;
  if v_reason is null then return false; end if;
  update public.inventory_sales_order_events
  set processing_status='ignored', issue_code=v_reason,
      issue_message=case v_reason
        when 'sales_deduction_disabled' then 'Tạm tắt tự trừ khi bán. Đơn này không trừ kho và không trừ bù khi bật lại.'
        when 'sales_order_time_missing' then 'Không xác định được thời điểm tạo đơn; không tự trừ để tránh trừ đơn cũ.'
        else 'Đơn trước thời điểm áp dụng; không trừ bù. Tồn được chốt qua kiểm kê.'
      end,
      metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('sales_deduction_excluded',v_reason),
      processed_at=coalesce(processed_at,clock_timestamp()), updated_at=clock_timestamp()
  where id=p_event_id;
  return true;
end;
$$;
revoke all on function private.inventory_exclude_disabled_sale(uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.inventory_queue_sales_event(p_source_type text, p_source_order_key text, p_source_row_id text, p_event_type text, p_source_status text, p_branch_uuid uuid, p_occurred_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  perform private.inventory_exclude_disabled_sale(v_event_id);
  return v_event_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.inventory_process_sales_event(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if private.inventory_exclude_disabled_sale(p_event_id) then
    return jsonb_build_object('ok', true, 'status', 'ignored', 'deduction_disabled', true);
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
          and (
            mapping.external_option_group = '*'
            or private.inventory_sales_normalize_text(mapping.external_option_group) = private.inventory_sales_normalize_text(v_option.option_group)
          )
          and private.inventory_sales_normalize_text(mapping.external_option_name) = private.inventory_sales_normalize_text(v_option.option_name)
        order by
          (private.inventory_sales_normalize_text(mapping.external_option_group) = private.inventory_sales_normalize_text(v_option.option_group)) desc,
          (mapping.branch_uuid = v_event.branch_uuid) desc,
          mapping.updated_at desc
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
$function$;

CREATE OR REPLACE FUNCTION private.inventory_retry_sales_order_event(p_event_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_event public.inventory_sales_order_events%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Bạn cần đăng nhập để thử xử lý lại.';
  end if;

  select *
  into v_event
  from public.inventory_sales_order_events
  where id = p_event_id
  for update;

  if not found
    or not (select private.inventory_can_view_sales_branch(v_event.branch_uuid)) then
    raise exception 'Không tìm thấy sự kiện hoặc tài khoản không có quyền.';
  end if;

  if private.inventory_exclude_disabled_sale(p_event_id) then
    return p_event_id;
  end if;

  if v_event.processing_status not in ('blocked', 'ignored') then
    raise exception 'Chỉ sự kiện đang treo mới được thử lại.';
  end if;

  update public.inventory_sales_order_events
  set
    processing_status = 'pending',
    issue_code = null,
    issue_message = null,
    available_at = now(),
    processed_at = null,
    updated_at = now()
  where id = p_event_id;

  return p_event_id;
end;
$function$;


-- No bulk event updates. Historical pending/blocked events remain unchanged.
-- The runtime guard decides exclusion only when each event is processed or retried.
notify pgrst, 'reload schema';
