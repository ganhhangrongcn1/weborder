-- Kitchen partner item backfill from raw_data.dishes
-- Safe to rerun:
-- - Inserts only partner orders that have raw_data.dishes and no partner_order_items.
-- - Uses line_index as the stable dish position.
-- - Does not update or delete existing item rows.

with missing_orders as (
  select
    po.*
  from public.partner_orders po
  where jsonb_array_length(coalesce(po.raw_data -> 'dishes', '[]'::jsonb)) > 0
    and not exists (
      select 1
      from public.partner_order_items poi
      where poi.partner_order_id = po.id
    )
),
raw_dishes as (
  select
    mo.id as partner_order_id,
    mo.order_code,
    mo.display_order_code,
    mo.partner_source,
    mo.branch_id,
    mo.branch_code,
    mo.branch_uuid,
    mo.nexpos_hub_id,
    mo.nexpos_site_id,
    mo.order_status,
    mo.kitchen_status,
    mo.kitchen_work_status,
    mo.nexpos_status,
    mo.kitchen_done_at,
    mo.order_time,
    mo.created_at,
    mo.raw_data,
    dish.value as dish,
    dish.ordinality - 1 as line_index
  from missing_orders mo
  cross join lateral jsonb_array_elements(coalesce(mo.raw_data -> 'dishes', '[]'::jsonb)) with ordinality as dish(value, ordinality)
  where lower(coalesce(dish.value ->> 'is_gift', 'false')) not in ('true', '1', 'yes')
),
parsed as (
  select
    rd.*,
    nullif(regexp_replace(coalesce(rd.dish ->> 'quantity', ''), '[^0-9.]', '', 'g'), '') as clean_quantity,
    nullif(regexp_replace(coalesce(rd.dish ->> 'unit_price', rd.dish ->> 'price', ''), '[^0-9.]', '', 'g'), '') as clean_unit_price,
    nullif(regexp_replace(coalesce(
      rd.dish ->> 'discount_price',
      rd.dish ->> 'line_total',
      rd.dish ->> 'total_price',
      rd.dish ->> 'total',
      rd.dish ->> 'price',
      ''
    ), '[^0-9.]', '', 'g'), '') as clean_line_total
  from raw_dishes rd
),
inserted as (
  insert into public.partner_order_items (
    partner_order_id,
    item_key,
    line_index,
    order_code,
    partner_source,
    branch_id,
    branch_code,
    branch_uuid,
    nexpos_hub_id,
    nexpos_site_id,
    partner_item_id,
    partner_item_sku,
    partner_item_name,
    web_product_id,
    web_product_name,
    quantity,
    unit_price,
    line_total,
    options,
    note,
    item_status,
    kitchen_item_status,
    kitchen_done_at
  )
  select
    p.partner_order_id,
    concat(
      coalesce(nullif(p.display_order_code, ''), nullif(p.order_code, ''), nullif(p.raw_data ->> 'order_id', ''), p.partner_order_id::text),
      '-',
      p.line_index::text
    ) as item_key,
    p.line_index,
    coalesce(nullif(p.order_code, ''), nullif(p.raw_data ->> 'order_id', '')),
    coalesce(nullif(p.partner_source, ''), nullif(p.raw_data ->> 'source', ''), 'partner'),
    coalesce(nullif(p.branch_id, ''), nullif(p.raw_data ->> 'site_id', '')),
    coalesce(nullif(p.branch_code, ''), nullif(p.raw_data ->> 'branch_code', '')),
    p.branch_uuid,
    coalesce(nullif(p.nexpos_hub_id, ''), nullif(p.raw_data ->> 'hub_id', '')),
    coalesce(nullif(p.nexpos_site_id, ''), nullif(p.raw_data ->> 'site_id', ''), nullif(p.branch_id, '')),
    coalesce(
      nullif(p.dish ->> 'item_id', ''),
      nullif(p.dish ->> 'model_id', ''),
      nullif(p.dish ->> 'code', ''),
      concat('line-', p.line_index::text)
    ),
    coalesce(nullif(p.dish ->> 'code', ''), ''),
    coalesce(nullif(p.dish ->> 'name', ''), 'Khong ten mon'),
    null,
    '',
    greatest(1, coalesce(
      case when p.clean_quantity ~ '^[0-9]+(\.[0-9]+)?$' then p.clean_quantity::numeric end,
      1
    )),
    coalesce(
      case when p.clean_unit_price ~ '^[0-9]+(\.[0-9]+)?$' then p.clean_unit_price::numeric end,
      0
    ),
    coalesce(
      case when p.clean_line_total ~ '^[0-9]+(\.[0-9]+)?$' then p.clean_line_total::numeric end,
      case when p.clean_unit_price ~ '^[0-9]+(\.[0-9]+)?$' then p.clean_unit_price::numeric end,
      0
    ),
    case
      when jsonb_typeof(p.dish -> 'options') = 'array' then p.dish -> 'options'
      else '[]'::jsonb
    end,
    coalesce(nullif(p.dish ->> 'note', ''), nullif(p.dish ->> 'description', ''), ''),
    'pending',
    case
      when lower(coalesce(p.kitchen_work_status, p.kitchen_status, p.order_status, p.nexpos_status, '')) in ('done', 'completed', 'complete', 'finish', 'finished')
      then 'done'
      else 'pending'
    end,
    case
      when lower(coalesce(p.kitchen_work_status, p.kitchen_status, p.order_status, p.nexpos_status, '')) in ('done', 'completed', 'complete', 'finish', 'finished')
      then coalesce(p.kitchen_done_at, p.order_time, p.created_at)
      else null
    end
  from parsed p
  where not exists (
    select 1
    from public.partner_order_items existing
    where existing.partner_order_id = p.partner_order_id
      and existing.line_index = p.line_index
  )
  returning id
)
select
  'inserted_partner_items' as metric,
  count(*)::text as value
from inserted;
