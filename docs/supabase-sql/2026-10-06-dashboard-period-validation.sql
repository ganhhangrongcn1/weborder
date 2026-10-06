begin isolation level repeatable read read only;set local statement_timeout='3s';select (select to_jsonb(r) from (with bounds as (
  select
    '2026-10-06T00:00:00+07:00'::timestamptz as current_from,
    '2026-10-07T00:00:00+07:00'::timestamptz as current_to,
    '2026-10-06T00:00:00+07:00'::timestamptz - ('2026-10-07T00:00:00+07:00'::timestamptz - '2026-10-06T00:00:00+07:00'::timestamptz) as previous_from,
    '2026-10-06T00:00:00+07:00'::timestamptz as previous_to,
    '2026-10-06T00:00:00+07:00'::timestamptz - interval '7 days' as week_from,
    '2026-10-07T00:00:00+07:00'::timestamptz - interval '7 days' as week_to
),
periods as (
  select 'current'::text as period_key, current_from as date_from, current_to as date_to
  from bounds
  union all
  select 'previous', previous_from, previous_to
  from bounds
  union all
  select 'week', week_from, week_to
  from bounds
),
web_orders as (
  select
    o.created_at as order_time,
    public.normalize_vietnam_phone(o.customer_phone) as customer_key,
    coalesce(
      nullif(trim(o.delivery_branch_name), ''),
      nullif(trim(o.pickup_branch_name), ''),
      nullif(trim(o.branch_name), ''),
      'ChÆ°a xÃ¡c Ä‘á»‹nh'
    ) as branch_name,
    coalesce(o.delivery_branch_uuid, o.pickup_branch_uuid, o.branch_uuid)::text as branch_uuid,
    public.normalize_dashboard_channel(
      coalesce(
        nullif(trim(o.metadata ->> 'orderSource'), ''),
        nullif(trim(o.metadata ->> 'source'), ''),
        nullif(trim(o.metadata ->> 'channel'), ''),
        nullif(trim(o.metadata ->> 'sourceType'), ''),
        nullif(trim(o.metadata ->> 'platform'), ''),
        ''
      ),
      o.fulfillment_type
    ) as channel_key,
    case
      when public.normalize_order_counting_status(o.status) in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded')
        then 'cancelled'
      when public.normalize_order_counting_status(o.status) in ('preorder', 'preordered', 'scheduled', 'dattruoc')
        then 'preorder'
      when public.normalize_order_counting_status(o.status) in ('pending', 'pendingzalo', 'new')
        then 'pending'
      when public.normalize_order_counting_status(o.status) in ('delivering', 'shipping')
        then 'delivering'
      when public.normalize_order_counting_status(o.status) in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
        then 'done'
      when public.normalize_order_counting_status(o.status) in (
        'preparing', 'cooking', 'doing', 'pick', 'picking', 'inprogress',
        'confirmed', 'accepted', 'processing', 'ready', 'readytopickup', 'readytoship'
      ) then 'preparing'
      else 'unknown'
    end as status_group,
    greatest(coalesce(o.total_amount, 0)::numeric - coalesce(o.shipping_fee, 0)::numeric, 0) as net_revenue
  from public.orders o
  cross join bounds b
  where o.created_at >= least(b.previous_from, b.week_from)
    and o.created_at < b.current_to
    and (
      (coalesce(trim(null::text), '') = '' and coalesce(trim(null::text), '') = '')
      or (
        coalesce(trim(null::text), '') <> ''
        and coalesce(o.delivery_branch_uuid, o.pickup_branch_uuid, o.branch_uuid)::text = trim(null::text)
      )
      or public.normalize_order_counting_status(
        coalesce(
          nullif(trim(o.delivery_branch_name), ''),
          nullif(trim(o.pickup_branch_name), ''),
          nullif(trim(o.branch_name), ''),
          'ChÆ°a xÃ¡c Ä‘á»‹nh'
        )
      ) = public.normalize_order_counting_status(null::text)
    )
),
partner_orders as (
  select
    coalesce(po.order_time, po.created_at) as order_time,
    public.normalize_vietnam_phone(
      coalesce(nullif(trim(po.customer_phone_key), ''), po.customer_phone)
    ) as customer_key,
    coalesce(
      nullif(trim(po.branch_name), ''),
      nullif(trim(po.nexpos_site_name), ''),
      nullif(trim(po.nexpos_hub_name), ''),
      'ChÆ°a xÃ¡c Ä‘á»‹nh'
    ) as branch_name,
    po.branch_uuid::text as branch_uuid,
    public.normalize_dashboard_channel(po.partner_source) as channel_key,
    case
      when public.normalize_order_counting_status(po.order_status) in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded')
        or public.normalize_order_counting_status(po.nexpos_status) in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded')
        or public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded')
        then 'cancelled'
      when public.normalize_order_counting_status(po.order_status) in ('preorder', 'preordered', 'scheduled', 'dattruoc')
        or public.normalize_order_counting_status(po.nexpos_status) in ('preorder', 'preordered', 'scheduled', 'dattruoc')
        or public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) in ('preorder', 'preordered', 'scheduled', 'dattruoc')
        then 'preorder'
      when public.normalize_order_counting_status(po.order_status) in ('delivering', 'shipping')
        or public.normalize_order_counting_status(po.nexpos_status) in ('delivering', 'shipping')
        then 'delivering'
      when public.normalize_order_counting_status(po.order_status) in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
        or public.normalize_order_counting_status(po.nexpos_status) in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
        then 'done'
      when public.normalize_order_counting_status(po.order_status) in ('', 'pending', 'pendingzalo', 'new')
        and public.normalize_order_counting_status(po.nexpos_status) in ('', 'pending', 'pendingzalo', 'new')
        then 'pending'
      when public.normalize_order_counting_status(po.order_status) in (
        'preparing', 'cooking', 'doing', 'pick', 'picking', 'inprogress',
        'confirmed', 'accepted', 'processing', 'ready', 'readytopickup', 'readytoship'
      )
        or public.normalize_order_counting_status(po.nexpos_status) in (
          'preparing', 'cooking', 'doing', 'pick', 'picking', 'inprogress',
          'confirmed', 'accepted', 'processing', 'ready', 'readytopickup', 'readytoship'
        )
        or public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) in (
          'preparing', 'cooking', 'doing', 'pick', 'picking', 'inprogress',
          'confirmed', 'accepted', 'processing', 'ready', 'readytopickup', 'readytoship'
        ) then 'preparing'
      else 'unknown'
    end as status_group,
    greatest(
      coalesce(
        public.dashboard_to_numeric(po.raw_data #>> '{finance_data,real_received}'),
        public.dashboard_to_numeric(po.raw_data #>> '{finance_data,net_received}'),
        public.dashboard_to_numeric(po.raw_data ->> 'total_for_biz'),
        public.dashboard_to_numeric(po.raw_data #>> '{finance_data,gross_received}'),
        coalesce(po.total_amount, 0)::numeric - coalesce(po.shipping_fee, 0)::numeric
      ),
      0
    ) as net_revenue
  from public.partner_orders po
  cross join bounds b
  where coalesce(po.order_time, po.created_at) >= least(b.previous_from, b.week_from)
    and coalesce(po.order_time, po.created_at) < b.current_to
    and (
      (coalesce(trim(null::text), '') = '' and coalesce(trim(null::text), '') = '')
      or (
        coalesce(trim(null::text), '') <> ''
        and po.branch_uuid::text = trim(null::text)
      )
      or public.normalize_order_counting_status(
        coalesce(
          nullif(trim(po.branch_name), ''),
          nullif(trim(po.nexpos_site_name), ''),
          nullif(trim(po.nexpos_hub_name), ''),
          'ChÆ°a xÃ¡c Ä‘á»‹nh'
        )
      ) = public.normalize_order_counting_status(null::text)
    )
),
unified_orders as (
  select * from web_orders
  union all
  select * from partner_orders
),
period_metrics as (
  select
    p.period_key,
    count(*) filter (where u.status_group <> 'preorder')::integer as total_orders,
    coalesce(sum(u.net_revenue) filter (where u.status_group not in ('cancelled', 'preorder')), 0)::numeric as net_revenue,
    count(*) filter (where u.status_group not in ('cancelled', 'preorder'))::integer as revenue_order_count,
    count(*) filter (where u.status_group = 'pending')::integer as pending_orders,
    count(*) filter (where u.status_group = 'preparing')::integer as preparing_orders,
    count(*) filter (where u.status_group = 'delivering')::integer as delivering_orders,
    count(*) filter (where u.status_group = 'cancelled')::integer as cancelled_orders,
    count(*) filter (where u.status_group = 'done')::integer as completed_orders
  from periods p
  left join unified_orders u
    on u.order_time >= p.date_from
   and u.order_time < p.date_to
  group by p.period_key
),
metric_json as (
  select
    period_key,
    jsonb_build_object(
      'total_orders', total_orders,
      'net_revenue', net_revenue,
      'average_order_value', case when revenue_order_count > 0 then net_revenue / revenue_order_count else 0 end,
      'pending_orders', pending_orders,
      'preparing_orders', preparing_orders,
      'delivering_orders', delivering_orders,
      'cancelled_orders', cancelled_orders,
      'completed_orders', completed_orders,
      'cancel_rate', case when total_orders > 0 then cancelled_orders::numeric / total_orders else 0 end
    ) as metrics
  from period_metrics
),
channels as (
  select
    u.channel_key,
    count(*) filter (where u.status_group <> 'preorder')::integer as total_orders,
    count(*) filter (where u.status_group not in ('cancelled', 'preorder'))::integer as revenue_order_count,
    coalesce(sum(u.net_revenue) filter (where u.status_group not in ('cancelled', 'preorder')), 0)::numeric as net_revenue
  from unified_orders u
  cross join bounds b
  where u.order_time >= b.current_from
    and u.order_time < b.current_to
  group by u.channel_key
)
select
  (
    select count(*)::bigint
    from public.profiles p
    where p.role = 'customer'
  ) as total_customers,
  (
    select count(distinct u.customer_key)::bigint
    from unified_orders u
    cross join bounds b
    where u.order_time >= b.current_from
      and u.order_time < b.current_to
      and u.status_group not in ('cancelled', 'preorder')
      and coalesce(u.customer_key, '') <> ''
  ) as period_customers,
  coalesce((select metrics from metric_json where period_key = 'current'), '{}'::jsonb) as current_metrics,
  coalesce((select metrics from metric_json where period_key = 'previous'), '{}'::jsonb) as previous_metrics,
  coalesce((select metrics from metric_json where period_key = 'week'), '{}'::jsonb) as week_metrics,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'channel', channel_key,
          'total_orders', total_orders,
          'revenue_order_count', revenue_order_count,
          'net_revenue', net_revenue
        )
        order by total_orders desc, channel_key
      )
      from channels
    ),
    '[]'::jsonb
  ) as channel_breakdown)r) is not distinct from (select to_jsonb(r) from public.get_admin_dashboard_summary('2026-10-06T00:00:00+07:00'::timestamptz,'2026-10-07T00:00:00+07:00'::timestamptz,null::text,null::text)r) deployed_output_equal;rollback;
