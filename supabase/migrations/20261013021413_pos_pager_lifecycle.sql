-- Server-owned pager lifecycle. Existing Android clients already read pagerStatus.
-- Only pager metadata is written; payment, order status, items and benefits stay intact.
set lock_timeout = '3s';
set statement_timeout = '30s';

create or replace function private.pos_pager_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_pager text := coalesce(nullif(btrim(new.metadata->>'pagerNumber'), ''), nullif(btrim(new.metadata->>'pager_number'), ''));
  v_reason text;
  v_keys text[] := array['pagerStatus','pager_status','pagerReleasedAt','pagerReleasedBy','pagerReleaseReason'];
begin
  if v_pager is null then return new; end if;

  -- A stale client upsert must not re-lock a pager already returned for this bill.
  if tg_op = 'UPDATE' then
    if coalesce(nullif(btrim(old.metadata->>'pagerNumber'), ''), nullif(btrim(old.metadata->>'pager_number'), '')) = v_pager
      and lower(btrim(coalesce(nullif(old.metadata->>'pagerStatus',''),old.metadata->>'pager_status','')))
        in ('released','returned','available') then
      new.metadata := (coalesce(new.metadata,'{}') - v_keys)
        || (select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(old.metadata) where key=any(v_keys));
      return new;
    end if;
  end if;
  if lower(btrim(coalesce(new.metadata->>'source',''))) not in ('pos','pos_mobile','posmobile','counter','tai_quay') then
    return new;
  end if;
  if lower(btrim(coalesce(nullif(new.metadata->>'pagerStatus',''),new.metadata->>'pager_status','')))
    in ('released','returned','available') then return new; end if;

  if lower(btrim(coalesce(nullif(new.status,''),new.metadata->>'status',new.metadata->>'orderStatus','')))
    in ('done','completed','complete','cancelled','canceled','cancel','refunded') then
    v_reason := 'order_closed';
  elsif lower(btrim(coalesce(nullif(new.kitchen_status,''),new.metadata->>'kitchenStatus',new.metadata->>'kitchen_status','')))
    in ('done','completed','complete','cancelled','canceled','cancel') then
    v_reason := 'kitchen_closed';
  elsif new.created_at <= now() - interval '24 hours' then
    v_reason := 'stale_assignment_24h';
  else
    return new;
  end if;

  new.metadata := coalesce(new.metadata,'{}') || jsonb_build_object(
    'pagerStatus','released','pager_status','released',
    'pagerReleasedAt',now(),'pagerReleasedBy','server_pager_lifecycle','pagerReleaseReason',v_reason);
  return new;
end;
$function$;

revoke all on function private.pos_pager_before_write() from public,anon,authenticated;
drop trigger if exists orders_01_pos_pager_lifecycle on public.orders;
create trigger orders_01_pos_pager_lifecycle
before insert or update of metadata,status,kitchen_status,created_at on public.orders
for each row execute function private.pos_pager_before_write();

-- No exposed RPC or SECURITY DEFINER endpoint. Only the database scheduler calls this.
create or replace function private.release_stale_pos_pagers()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_order public.orders;
  v_after jsonb;
  v_count integer := 0;
  v_errors jsonb := '[]';
  v_keys text[] := array['pagerStatus','pager_status','pagerReleasedAt','pagerReleasedBy','pagerReleaseReason'];
begin
  for v_order in
    select o.* from public.orders o
    where o.created_at <= now() - interval '24 hours'
      and coalesce(nullif(btrim(o.metadata->>'pagerNumber'),''),nullif(btrim(o.metadata->>'pager_number'),'')) is not null
      and lower(btrim(coalesce(o.metadata->>'source',''))) in ('pos','pos_mobile','posmobile','counter','tai_quay')
      and lower(btrim(coalesce(nullif(o.metadata->>'pagerStatus',''),o.metadata->>'pager_status','')))
        not in ('released','returned','available')
      and (o.status is null or o.status not in ('done','completed','complete','cancelled','canceled','cancel'))
      and (o.kitchen_status is null or o.kitchen_status not in ('done','completed','complete','cancelled','canceled','cancel'))
    order by o.created_at,o.id
    limit 200 for update skip locked
  loop
    begin
      update public.orders o
      set metadata = coalesce(o.metadata,'{}') || jsonb_build_object(
        'pagerStatus','released','pager_status','released','pagerReleasedAt',now(),
        'pagerReleasedBy','server_pager_lifecycle','pagerReleaseReason','stale_assignment_24h')
      where o.id=v_order.id
      returning to_jsonb(o) into v_after;
      if (v_after-'metadata'-'updated_at') is distinct from (to_jsonb(v_order)-'metadata'-'updated_at')
        or ((v_after->'metadata')-v_keys) is distinct from (coalesce(v_order.metadata,'{}')-v_keys) then
        raise exception 'Non-pager fields changed';
      end if;
      v_count := v_count+1;
    exception when others then
      -- Keep other stale bills recoverable if a historical bill fails existing validation.
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('orderId',v_order.id,'error',sqlerrm));
      raise warning 'Pager release failed for order %: %',v_order.id,sqlerrm;
    end;
  end loop;
  if jsonb_array_length(v_errors)>0 then
    -- Fail the job visibly; the transaction rolls back and the next run retries.
    raise exception 'Pager release validation failed: %',v_errors;
  end if;
  return jsonb_build_object('released',v_count,'errors',v_errors);
end;
$function$;

revoke all on function private.release_stale_pos_pagers() from public,anon,authenticated;
select cron.schedule('release-stale-pos-pagers','0 * * * *',
  $job$set statement_timeout='25s'; select private.release_stale_pos_pagers();$job$);

