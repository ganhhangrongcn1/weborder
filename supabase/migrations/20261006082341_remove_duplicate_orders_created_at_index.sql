-- Only a duplicate non-unique index is removed; no rows, grants or functions change.
set local lock_timeout='100ms';
set local statement_timeout='5s';
do $migration$
declare
  v_old oid;
  v_keep oid;
begin
  -- Never queue an exclusive table lock behind live queries.
  lock table public.orders in access exclusive mode nowait;
  v_old := to_regclass('public.idx_orders_created_at');
  v_keep := to_regclass('public.orders_created_at_desc_idx');
  if v_keep is null or not exists (
    select 1 from pg_index i join pg_class c on c.oid=i.indexrelid
    where i.indexrelid=v_keep and i.indrelid='public.orders'::regclass
      and i.indisvalid and i.indisready and i.indislive and not i.indisunique
      and not i.indisprimary and not i.indisreplident
      and c.relkind='i'
      and pg_get_indexdef(i.indexrelid)='CREATE INDEX orders_created_at_desc_idx ON public.orders USING btree (created_at DESC)'
  ) then raise exception 'Retained index missing or changed; aborting'; end if;
  if v_old is null then return; end if;
  if not exists (
    select 1 from pg_index a join pg_index b on b.indexrelid=v_keep
    join pg_class ac on ac.oid=a.indexrelid
    join pg_class bc on bc.oid=b.indexrelid
    where a.indexrelid=v_old and a.indrelid=b.indrelid
      and a.indisvalid and a.indisready and a.indislive and b.indislive
      and not a.indisunique and not a.indisprimary
      and not a.indisreplident and not a.indisclustered
      and a.indkey=b.indkey and a.indclass=b.indclass
      and a.indcollation=b.indcollation and a.indoption=b.indoption
      and a.indnatts=b.indnatts and a.indnkeyatts=b.indnkeyatts
      and a.indexprs is null and b.indexprs is null
      and a.indpred is null and b.indpred is null
      and ac.relkind='i' and ac.relam=bc.relam
      and ac.reltablespace=bc.reltablespace
      and ac.relpersistence=bc.relpersistence
      and ac.reloptions is not distinct from bc.reloptions
      and pg_get_indexdef(a.indexrelid)='CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC)'
      and not exists (select 1 from pg_constraint con where con.conindid=a.indexrelid)
      and not exists (select 1 from pg_depend d where d.refobjid=a.indexrelid and d.refclassid='pg_class'::regclass)
      and not exists (select 1 from pg_inherits h where h.inhrelid=a.indexrelid or h.inhparent=a.indexrelid)
  ) then raise exception 'Duplicate index no longer matches; aborting'; end if;
  drop index public.idx_orders_created_at restrict;
  if to_regclass('public.idx_orders_created_at') is not null then
    raise exception 'Duplicate index removal failed';
  end if;
end;
$migration$;
