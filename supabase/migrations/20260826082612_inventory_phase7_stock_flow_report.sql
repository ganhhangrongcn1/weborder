-- Phase 7: báo cáo Nhập - Xuất - Tồn tổng hợp phía PostgreSQL.
-- Hàm chạy theo quyền người gọi; RLS và inventory_can_access_warehouse vẫn là lớp bảo vệ cuối.

create or replace function public.inventory_get_stock_flow_report(
  p_from_date date,
  p_to_date date,
  p_warehouse_id uuid default null,
  p_item_id uuid default null,
  p_group_id uuid default null,
  p_search text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_from timestamptz;
  v_to_exclusive timestamptz;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_result jsonb;
begin
  if p_from_date is null or p_to_date is null then
    raise exception 'Vui lòng chọn đầy đủ từ ngày và đến ngày.';
  end if;
  if p_from_date > p_to_date then
    raise exception 'Từ ngày không được sau đến ngày.';
  end if;
  if p_to_date - p_from_date > 366 then
    raise exception 'Mỗi lần chỉ xem tối đa 366 ngày.';
  end if;

  v_from := p_from_date::timestamp at time zone 'Asia/Bangkok';
  v_to_exclusive := (p_to_date + 1)::timestamp at time zone 'Asia/Bangkok';

  with accessible_keys as (
    select balance.warehouse_id, balance.item_id
    from public.inventory_stock_balances balance
    where (p_warehouse_id is null or balance.warehouse_id = p_warehouse_id)
      and (p_item_id is null or balance.item_id = p_item_id)
      and (select private.inventory_can_access_warehouse(balance.warehouse_id))
    union
    select movement.warehouse_id, movement.item_id
    from public.inventory_stock_movements movement
    where movement.occurred_at >= v_from
      and (p_warehouse_id is null or movement.warehouse_id = p_warehouse_id)
      and (p_item_id is null or movement.item_id = p_item_id)
      and (select private.inventory_can_access_warehouse(movement.warehouse_id))
  ),
  filtered_keys as (
    select key.warehouse_id, key.item_id
    from accessible_keys key
    join public.inventory_items item on item.id = key.item_id
    where (p_group_id is null or item.group_id = p_group_id)
      and (
        v_search is null
        or item.name ilike '%' || v_search || '%'
        or item.code ilike '%' || v_search || '%'
      )
  ),
  movement_totals as (
    select
      movement.warehouse_id,
      movement.item_id,
      coalesce(sum(case when movement.occurred_at >= v_from and movement.occurred_at < v_to_exclusive and movement.direction = 'in' then movement.quantity else 0 end), 0)::numeric(18,6) as inbound_quantity,
      coalesce(sum(case when movement.occurred_at >= v_from and movement.occurred_at < v_to_exclusive and movement.direction = 'out' then movement.quantity else 0 end), 0)::numeric(18,6) as outbound_quantity,
      coalesce(sum(case
        when movement.occurred_at >= v_to_exclusive and movement.direction = 'in' then movement.quantity
        when movement.occurred_at >= v_to_exclusive and movement.direction = 'out' then -movement.quantity
        else 0
      end), 0)::numeric(18,6) as future_net_quantity,
      coalesce(sum(case when movement.occurred_at >= v_from and movement.occurred_at < v_to_exclusive and movement.direction = 'in' then movement.quantity * movement.unit_cost else 0 end), 0)::numeric(20,2) as inbound_value,
      coalesce(sum(case when movement.occurred_at >= v_from and movement.occurred_at < v_to_exclusive and movement.direction = 'out' then movement.quantity * movement.unit_cost else 0 end), 0)::numeric(20,2) as outbound_value,
      coalesce(sum(case
        when movement.occurred_at >= v_to_exclusive and movement.direction = 'in' then movement.quantity * movement.unit_cost
        when movement.occurred_at >= v_to_exclusive and movement.direction = 'out' then -(movement.quantity * movement.unit_cost)
        else 0
      end), 0)::numeric(20,2) as future_net_value,
      count(*) filter (where movement.occurred_at >= v_from and movement.occurred_at < v_to_exclusive)::integer as movement_count
    from public.inventory_stock_movements movement
    join filtered_keys key
      on key.warehouse_id = movement.warehouse_id
     and key.item_id = movement.item_id
    where movement.occurred_at >= v_from
    group by movement.warehouse_id, movement.item_id
  ),
  report_rows as (
    select
      key.warehouse_id,
      warehouse.code as warehouse_code,
      warehouse.name as warehouse_name,
      key.item_id,
      item.code as item_code,
      item.name as item_name,
      item.group_id,
      item_group.name as group_name,
      item.base_unit_id,
      unit.name as unit_name,
      (
        coalesce(balance.quantity, 0) - coalesce(total.future_net_quantity, 0)
        - coalesce(total.inbound_quantity, 0) + coalesce(total.outbound_quantity, 0)
      )::numeric(18,6) as opening_quantity,
      coalesce(total.inbound_quantity, 0)::numeric(18,6) as inbound_quantity,
      coalesce(total.outbound_quantity, 0)::numeric(18,6) as outbound_quantity,
      (coalesce(balance.quantity, 0) - coalesce(total.future_net_quantity, 0))::numeric(18,6) as closing_quantity,
      (
        coalesce(balance.quantity * balance.average_cost, 0) - coalesce(total.future_net_value, 0)
        - coalesce(total.inbound_value, 0) + coalesce(total.outbound_value, 0)
      )::numeric(20,2) as opening_value,
      coalesce(total.inbound_value, 0)::numeric(20,2) as inbound_value,
      coalesce(total.outbound_value, 0)::numeric(20,2) as outbound_value,
      (coalesce(balance.quantity * balance.average_cost, 0) - coalesce(total.future_net_value, 0))::numeric(20,2) as closing_value,
      coalesce(total.movement_count, 0)::integer as movement_count
    from filtered_keys key
    join public.inventory_warehouses warehouse on warehouse.id = key.warehouse_id
    join public.inventory_items item on item.id = key.item_id
    join public.inventory_units unit on unit.id = item.base_unit_id
    left join public.inventory_item_groups item_group on item_group.id = item.group_id
    left join public.inventory_stock_balances balance
      on balance.warehouse_id = key.warehouse_id
     and balance.item_id = key.item_id
    left join movement_totals total
      on total.warehouse_id = key.warehouse_id
     and total.item_id = key.item_id
  ),
  summary as (
    select
      count(*)::integer as row_count,
      coalesce(sum(opening_value), 0)::numeric(20,2) as opening_value,
      coalesce(sum(inbound_value), 0)::numeric(20,2) as inbound_value,
      coalesce(sum(outbound_value), 0)::numeric(20,2) as outbound_value,
      coalesce(sum(closing_value), 0)::numeric(20,2) as closing_value,
      coalesce(sum(movement_count), 0)::integer as movement_count
    from report_rows
  ),
  paged_rows as (
    select *
    from report_rows
    order by warehouse_name, item_name, item_code
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'from_date', p_from_date,
    'to_date', p_to_date,
    'total_count', summary.row_count,
    'summary', jsonb_build_object(
      'opening_value', summary.opening_value,
      'inbound_value', summary.inbound_value,
      'outbound_value', summary.outbound_value,
      'closing_value', summary.closing_value,
      'movement_count', summary.movement_count
    ),
    'rows', coalesce((select jsonb_agg(to_jsonb(row_data)) from paged_rows row_data), '[]'::jsonb)
  )
  into v_result
  from summary;

  return coalesce(v_result, jsonb_build_object(
    'from_date', p_from_date,
    'to_date', p_to_date,
    'total_count', 0,
    'summary', jsonb_build_object('opening_value', 0, 'inbound_value', 0, 'outbound_value', 0, 'closing_value', 0, 'movement_count', 0),
    'rows', '[]'::jsonb
  ));
end;
$$;

comment on function public.inventory_get_stock_flow_report(date, date, uuid, uuid, uuid, text, integer, integer)
is 'Tổng hợp Nhập - Xuất - Tồn theo kỳ, kho và NVL; chạy theo quyền RLS của người gọi.';

revoke all on function public.inventory_get_stock_flow_report(date, date, uuid, uuid, uuid, text, integer, integer) from public;
revoke all on function public.inventory_get_stock_flow_report(date, date, uuid, uuid, uuid, text, integer, integer) from anon;
grant execute on function public.inventory_get_stock_flow_report(date, date, uuid, uuid, uuid, text, integer, integer) to authenticated;
