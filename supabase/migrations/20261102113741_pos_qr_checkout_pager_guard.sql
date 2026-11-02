-- Serialize competing QR orders for the same pager, preserving retry behavior.
do $patch$
declare definition text;
begin
  definition:=pg_get_functiondef('pos_checkout_private.save_pos_qr_checkout(uuid,jsonb,jsonb)'::regprocedure);
  if position('pos-qr-pager-guard' in definition)=0 then
    if position($anchor$  select count(*),sum((x->>'line_total')::numeric) into item_count,item_sum from jsonb_array_elements(p_items) x;$anchor$ in definition)=0 then raise exception 'Checkout changed; review pager patch'; end if;
    definition:=replace(definition,$anchor$  select count(*),sum((x->>'line_total')::numeric) into item_count,item_sum from jsonb_array_elements(p_items) x;$anchor$,$guard$  -- pos-qr-pager-guard
  if coalesce(s.pager_number,'')<>'' then
    perform pg_advisory_xact_lock(hashtextextended(s.branch_uuid::text||':'||s.pager_number,0));
    if exists(select 1 from public.orders q where q.branch_uuid=s.branch_uuid and q.id<>o.id
      and coalesce(q.metadata->>'pagerNumber',q.metadata->>'pager_number')=s.pager_number
      and lower(q.status) not in ('done','completed','cancelled','canceled','refunded')
      and coalesce(q.metadata->>'pagerStatus',q.metadata->>'pager_status','assigned') not in ('released','returned','available')) then
      raise exception 'Thẻ rung đang có đơn chưa hoàn tất.';
    end if;
  end if;
  select count(*),sum((x->>'line_total')::numeric) into item_count,item_sum from jsonb_array_elements(p_items) x;$guard$);
    execute definition;
  end if;
end $patch$;
