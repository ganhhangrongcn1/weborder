begin;
set local lock_timeout='2s';
set local statement_timeout='5s';
do $migration$
declare v_definition text;
begin
select pg_get_functiondef('public.get_admin_dashboard_summary(timestamptz,timestamptz,text,text)'::regprocedure) into v_definition;
if md5(v_definition)='87ad04bf021962524130a5d527add611' then return; end if;
if md5(v_definition)<>'d460c5236edbbda2ab73e8fbdcd98533' then raise exception 'Unexpected dashboard version; aborting'; end if;
v_definition := replace(v_definition,replace($old$    and o.created_at < b.current_to
    and exists (
      select 1 from periods active_period
      where o.created_at >= active_period.date_from
        and o.created_at < active_period.date_to
    )$old$, chr(13), ''),$new$    and o.created_at < b.current_to$new$);
v_definition := replace(v_definition,replace($old$    and coalesce(po.order_time, po.created_at) < b.current_to
    and exists (
      select 1 from periods active_period
      where coalesce(po.order_time, po.created_at) >= active_period.date_from
        and coalesce(po.order_time, po.created_at) < active_period.date_to
    )$old$, chr(13), ''),$new$    and coalesce(po.order_time, po.created_at) < b.current_to$new$);
execute v_definition;
if md5(pg_get_functiondef('public.get_admin_dashboard_summary(timestamptz,timestamptz,text,text)'::regprocedure))<>'87ad04bf021962524130a5d527add611' then raise exception 'Unexpected patched definition; aborting'; end if;
end;
$migration$;
commit;
