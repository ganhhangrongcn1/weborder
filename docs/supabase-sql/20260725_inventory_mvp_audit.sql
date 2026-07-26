-- Read-only audit for Ganh Hang Rong Inventory MVP.

select
  table_name,
  relation.relrowsecurity as row_security
from information_schema.tables information
join pg_catalog.pg_class relation
  on relation.relname = information.table_name
where information.table_schema = 'public'
  and information.table_name like 'inventory_%'
order by information.table_name;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename like 'inventory_%'
order by tablename, policyname;

select
  access.role,
  access.is_active,
  warehouse.code as warehouse_code,
  warehouse.name as warehouse_name,
  count(*) over (partition by access.auth_user_id) as access_count
from public.inventory_user_access access
left join public.inventory_warehouses warehouse
  on warehouse.id = access.warehouse_id
order by access.created_at;

select
  document.document_no,
  document.document_type,
  document.status,
  count(line.id) as line_count
from public.inventory_documents document
left join public.inventory_document_lines line
  on line.document_id = document.id
group by document.id
having document.status <> 'draft'
   and count(line.id) = 0;

select
  balance.warehouse_id,
  balance.item_id,
  balance.quantity
from public.inventory_stock_balances balance
where balance.quantity < 0;

