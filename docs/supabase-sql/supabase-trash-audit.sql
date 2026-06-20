-- GHR Supabase trash-data audit
-- Chay trong Supabase SQL Editor.
-- File nay chi SELECT / audit, KHONG xoa du lieu.
-- Ket qua nam o bang tam thoi pg_temp.ghr_trash_audit_results trong phien chay.
-- Neu Supabase hien canh bao RLS/destructive operation:
-- - RLS warning la do script tao TEMP table, khong phai bang public that.
-- - Destructive warning la do TRUNCATE bang TEMP de reset ket qua cu trong cung phien.
-- - Script khong co DELETE/TRUNCATE/DROP tren public.*.

create temp table if not exists pg_temp.ghr_trash_audit_results (
  id bigserial primary key,
  area text not null,
  table_name text not null,
  issue text not null,
  severity text not null,
  affected_rows bigint not null default 0,
  sample_rows jsonb not null default '[]'::jsonb,
  note text,
  checked_at timestamptz not null default now()
);

truncate table pg_temp.ghr_trash_audit_results;

create or replace function pg_temp.ghr_table_exists(p_table text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = p_table
  );
$$;

create or replace function pg_temp.ghr_column_exists(p_table text, p_column text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = p_table
      and column_name = p_column
  );
$$;

create or replace function pg_temp.ghr_add_result(
  p_area text,
  p_table_name text,
  p_issue text,
  p_severity text,
  p_affected_rows bigint,
  p_sample_rows jsonb default '[]'::jsonb,
  p_note text default null
)
returns void
language plpgsql
as $$
begin
  insert into pg_temp.ghr_trash_audit_results (
    area,
    table_name,
    issue,
    severity,
    affected_rows,
    sample_rows,
    note
  )
  values (
    p_area,
    p_table_name,
    p_issue,
    p_severity,
    coalesce(p_affected_rows, 0),
    coalesce(p_sample_rows, '[]'::jsonb),
    p_note
  );
end;
$$;

create or replace function pg_temp.ghr_audit_where(
  p_area text,
  p_table_name text,
  p_issue text,
  p_severity text,
  p_where_sql text,
  p_note text default null
)
returns void
language plpgsql
as $$
declare
  v_count bigint := 0;
  v_sample jsonb := '[]'::jsonb;
begin
  if not pg_temp.ghr_table_exists(p_table_name) then
    perform pg_temp.ghr_add_result(
      p_area,
      p_table_name,
      p_issue,
      'skip',
      0,
      '[]'::jsonb,
      'Bang khong ton tai trong public schema.'
    );
    return;
  end if;

  execute format('select count(*) from public.%I where %s', p_table_name, p_where_sql)
    into v_count;

  if v_count > 0 then
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb)
       from (
         select *
         from public.%I
         where %s
         limit 5
       ) t',
      p_table_name,
      p_where_sql
    )
      into v_sample;
  end if;

  perform pg_temp.ghr_add_result(
    p_area,
    p_table_name,
    p_issue,
    p_severity,
    v_count,
    v_sample,
    p_note
  );
exception
  when others then
    perform pg_temp.ghr_add_result(
      p_area,
      p_table_name,
      p_issue,
      'error',
      0,
      '[]'::jsonb,
      'Khong audit duoc muc nay: ' || sqlerrm
    );
end;
$$;

create or replace function pg_temp.ghr_table_count(p_table_name text)
returns bigint
language plpgsql
as $$
declare
  v_count bigint := 0;
begin
  if not pg_temp.ghr_table_exists(p_table_name) then
    return null;
  end if;

  execute format('select count(*) from public.%I', p_table_name)
    into v_count;

  return v_count;
end;
$$;

do $$
declare
  v_table text;
  v_count bigint;
  v_tables text[] := array[
    'orders',
    'order_items',
    'partner_orders',
    'cake_orders',
    'profiles',
    'customers',
    'customer_addresses',
    'loyalty_accounts',
    'loyalty_ledger',
    'products',
    'categories',
    'toppings',
    'option_groups',
    'option_group_options',
    'product_option_groups',
    'branches',
    'coupons',
    'app_configs'
  ];
begin
  -- 1) Tong quan so dong theo bang.
  foreach v_table in array v_tables loop
    v_count := pg_temp.ghr_table_count(v_table);

    if v_count is null then
      perform pg_temp.ghr_add_result(
        '01_overview',
        v_table,
        'Bang chua ton tai',
        'info',
        0,
        '[]'::jsonb,
        'Neu app khong dung bang nay thi co the bo qua.'
      );
    else
      perform pg_temp.ghr_add_result(
        '01_overview',
        v_table,
        'Tong so dong hien co',
        'info',
        v_count,
        '[]'::jsonb,
        'Dung de nhin nhanh bang nao dang phinh to.'
      );
    end if;
  end loop;

  -- 2) Don hang test / demo / du lieu gia.
  if pg_temp.ghr_column_exists('orders', 'customer_name') then
    perform pg_temp.ghr_audit_where(
      '02_test_data',
      'orders',
      'Don web co ten khach nghi la test/demo',
      'review',
      '(customer_name ilike ''%test%'' or customer_name ilike ''%demo%'' or customer_name ilike ''%admin%'' or customer_name ilike ''%khach test%'')',
      'Kiem tra bang mat truoc khi xoa vi co the la ten that.'
    );
  end if;

  if pg_temp.ghr_column_exists('orders', 'customer_phone') then
    perform pg_temp.ghr_audit_where(
      '02_test_data',
      'orders',
      'Don web co so dien thoai nghi la gia',
      'review',
      '(customer_phone is null or btrim(customer_phone) = '''' or regexp_replace(customer_phone, ''\D'', '''', ''g'') in (''0000000000'', ''0123456789'', ''0999999999'', ''1111111111'', ''1234567890'') or length(regexp_replace(customer_phone, ''\D'', '''', ''g'')) < 9)',
      'Nen doi chieu voi don hang that truoc khi xoa.'
    );
  end if;

  if pg_temp.ghr_column_exists('partner_orders', 'customer_name') then
    perform pg_temp.ghr_audit_where(
      '02_test_data',
      'partner_orders',
      'Don doi tac co ten khach nghi la test/demo',
      'review',
      '(customer_name ilike ''%test%'' or customer_name ilike ''%demo%'' or customer_name ilike ''%admin%'' or customer_name ilike ''%khach test%'')',
      'Don tu Grab/ShopeeFood/doi tac can giu neu la don that.'
    );
  end if;

  if pg_temp.ghr_column_exists('partner_orders', 'customer_phone') then
    perform pg_temp.ghr_audit_where(
      '02_test_data',
      'partner_orders',
      'Don doi tac co so dien thoai nghi la gia',
      'review',
      '(customer_phone is null or btrim(customer_phone) = '''' or regexp_replace(customer_phone, ''\D'', '''', ''g'') in (''0000000000'', ''0123456789'', ''0999999999'', ''1111111111'', ''1234567890'') or length(regexp_replace(customer_phone, ''\D'', '''', ''g'')) < 9)',
      'Nhieu don doi tac co the bi an so dien thoai, dung xoa voi khi chua chac.'
    );
  end if;

  if pg_temp.ghr_column_exists('cake_orders', 'customer_name') then
    perform pg_temp.ghr_audit_where(
      '02_test_data',
      'cake_orders',
      'Don banh co ten khach nghi la test/demo',
      'review',
      '(customer_name ilike ''%test%'' or customer_name ilike ''%demo%'' or customer_name ilike ''%admin%'' or customer_name ilike ''%khach test%'')',
      'Chi audit, chua xoa.'
    );
  end if;

  -- 3) Du lieu mo coi: item/dia chi/loyalty khong con cha lien quan.
  if pg_temp.ghr_table_exists('order_items')
    and pg_temp.ghr_table_exists('orders')
    and pg_temp.ghr_column_exists('order_items', 'order_id')
    and pg_temp.ghr_column_exists('orders', 'id')
  then
    perform pg_temp.ghr_audit_where(
      '03_orphan_data',
      'order_items',
      'Order item khong tim thay orders.id',
      'high',
      'order_id is not null and not exists (select 1 from public.orders o where o.id = order_items.order_id)',
      'Co the xoa sau khi backup neu chac chan orders da mat.'
    );
  end if;

  if pg_temp.ghr_table_exists('customer_addresses')
    and pg_temp.ghr_table_exists('profiles')
    and pg_temp.ghr_column_exists('customer_addresses', 'customer_phone')
    and pg_temp.ghr_column_exists('profiles', 'phone')
  then
    perform pg_temp.ghr_audit_where(
      '03_orphan_data',
      'customer_addresses',
      'Dia chi khach khong co profile tuong ung',
      'review',
      'customer_phone is not null and not exists (select 1 from public.profiles p where p.phone = customer_addresses.customer_phone)',
      'Neu khach co don hang thi nen giu/merge ve profiles.'
    );
  end if;

  if pg_temp.ghr_table_exists('loyalty_accounts')
    and pg_temp.ghr_table_exists('profiles')
    and pg_temp.ghr_column_exists('loyalty_accounts', 'customer_phone')
    and pg_temp.ghr_column_exists('profiles', 'phone')
  then
    perform pg_temp.ghr_audit_where(
      '03_orphan_data',
      'loyalty_accounts',
      'Tai khoan tich diem khong co profile tuong ung',
      'review',
      'customer_phone is not null and not exists (select 1 from public.profiles p where p.phone = loyalty_accounts.customer_phone)',
      'Nen kiem tra lich su don hang truoc khi xoa.'
    );
  end if;

  if pg_temp.ghr_table_exists('loyalty_ledger')
    and pg_temp.ghr_table_exists('loyalty_accounts')
    and pg_temp.ghr_column_exists('loyalty_ledger', 'customer_phone')
    and pg_temp.ghr_column_exists('loyalty_accounts', 'customer_phone')
  then
    perform pg_temp.ghr_audit_where(
      '03_orphan_data',
      'loyalty_ledger',
      'Lich su diem khong co loyalty account tuong ung',
      'review',
      'customer_phone is not null and not exists (select 1 from public.loyalty_accounts a where a.customer_phone = loyalty_ledger.customer_phone)',
      'Khong xoa neu can doi soat diem cu.'
    );
  end if;

  -- 4) Du lieu catalog mo coi.
  if pg_temp.ghr_table_exists('products')
    and pg_temp.ghr_table_exists('categories')
    and pg_temp.ghr_column_exists('products', 'category_id')
    and pg_temp.ghr_column_exists('categories', 'id')
  then
    perform pg_temp.ghr_audit_where(
      '04_catalog_data',
      'products',
      'San pham gan category_id khong ton tai',
      'high',
      'category_id is not null and not exists (select 1 from public.categories c where c.id = products.category_id)',
      'Nen sua category truoc, chi xoa neu la san pham rac.'
    );
  end if;

  if pg_temp.ghr_table_exists('categories')
    and pg_temp.ghr_table_exists('products')
    and pg_temp.ghr_column_exists('categories', 'id')
    and pg_temp.ghr_column_exists('products', 'category_id')
  then
    perform pg_temp.ghr_audit_where(
      '04_catalog_data',
      'categories',
      'Danh muc khong co san pham nao',
      'review',
      'not exists (select 1 from public.products p where p.category_id = categories.id)',
      'Co the la danh muc dang an hoac danh muc sap dung.'
    );
  end if;

  if pg_temp.ghr_table_exists('product_option_groups')
    and pg_temp.ghr_table_exists('products')
    and pg_temp.ghr_column_exists('product_option_groups', 'product_id')
    and pg_temp.ghr_column_exists('products', 'id')
  then
    perform pg_temp.ghr_audit_where(
      '04_catalog_data',
      'product_option_groups',
      'Link option group khong co product tuong ung',
      'high',
      'product_id is not null and not exists (select 1 from public.products p where p.id = product_option_groups.product_id)',
      'Thuong la du lieu rac sau khi xoa/sync san pham.'
    );
  end if;

  if pg_temp.ghr_table_exists('option_group_options')
    and pg_temp.ghr_table_exists('option_groups')
    and pg_temp.ghr_column_exists('option_group_options', 'group_id')
    and pg_temp.ghr_column_exists('option_groups', 'id')
  then
    perform pg_temp.ghr_audit_where(
      '04_catalog_data',
      'option_group_options',
      'Option khong co group tuong ung',
      'high',
      'group_id is not null and not exists (select 1 from public.option_groups g where g.id = option_group_options.group_id)',
      'Co the xoa sau backup neu khong con group.'
    );
  end if;

  -- 5) Ban ghi trung lap theo phone / code / slug.
  if pg_temp.ghr_table_exists('profiles') and pg_temp.ghr_column_exists('profiles', 'phone') then
    perform pg_temp.ghr_audit_where(
      '05_duplicates',
      'profiles',
      'Profile trung so dien thoai',
      'high',
      'phone is not null and phone in (select phone from public.profiles where phone is not null group by phone having count(*) > 1)',
      'Nen merge thanh 1 profile chinh, khong xoa ngay.'
    );
  end if;

  if pg_temp.ghr_table_exists('customers') and pg_temp.ghr_column_exists('customers', 'phone') then
    perform pg_temp.ghr_audit_where(
      '05_duplicates',
      'customers',
      'Customer legacy trung so dien thoai',
      'review',
      'phone is not null and phone in (select phone from public.customers where phone is not null group by phone having count(*) > 1)',
      'Bang customers co the la legacy trong giai doan chuyen sang profiles.'
    );
  end if;

  if pg_temp.ghr_table_exists('orders') and pg_temp.ghr_column_exists('orders', 'code') then
    perform pg_temp.ghr_audit_where(
      '05_duplicates',
      'orders',
      'Don web trung ma don',
      'high',
      'code is not null and code in (select code from public.orders where code is not null group by code having count(*) > 1)',
      'Can doi soat ky, vi xoa sai se mat lich su don.'
    );
  end if;

  if pg_temp.ghr_table_exists('products') and pg_temp.ghr_column_exists('products', 'id') then
    perform pg_temp.ghr_audit_where(
      '05_duplicates',
      'products',
      'San pham trung id',
      'high',
      'id is not null and id in (select id from public.products where id is not null group by id having count(*) > 1)',
      'Neu co unique constraint thi muc nay se bang 0.'
    );
  end if;

  -- 6) Ban ghi cu co the can archive thay vi xoa.
  if pg_temp.ghr_table_exists('orders') and pg_temp.ghr_column_exists('orders', 'created_at') then
    perform pg_temp.ghr_audit_where(
      '06_old_data',
      'orders',
      'Don web cu hon 18 thang',
      'archive',
      'created_at < now() - interval ''18 months''',
      'Nen export/backup truoc. Voi du lieu doanh thu, uu tien archive hon delete.'
    );
  end if;

  if pg_temp.ghr_table_exists('partner_orders') and pg_temp.ghr_column_exists('partner_orders', 'created_at') then
    perform pg_temp.ghr_audit_where(
      '06_old_data',
      'partner_orders',
      'Don doi tac cu hon 18 thang',
      'archive',
      'created_at < now() - interval ''18 months''',
      'Nen giu neu con dung bao cao nam.'
    );
  end if;

  if pg_temp.ghr_table_exists('loyalty_ledger') and pg_temp.ghr_column_exists('loyalty_ledger', 'created_at') then
    perform pg_temp.ghr_audit_where(
      '06_old_data',
      'loyalty_ledger',
      'Lich su diem cu hon 18 thang',
      'archive',
      'created_at < now() - interval ''18 months''',
      'Khong nen xoa neu can doi soat diem khach.'
    );
  end if;

  -- 7) Cau hinh co the thua.
  if pg_temp.ghr_table_exists('app_configs') and pg_temp.ghr_column_exists('app_configs', 'key') then
    perform pg_temp.ghr_audit_where(
      '07_config_data',
      'app_configs',
      'Config key nghi la test/demo/backup',
      'review',
      '(key ilike ''%test%'' or key ilike ''%demo%'' or key ilike ''%backup%'' or key ilike ''%old%'')',
      'Chi xoa config khi biet chac app khong doc key do.'
    );
  end if;

  if pg_temp.ghr_table_exists('branches') and pg_temp.ghr_column_exists('branches', 'name') then
    perform pg_temp.ghr_audit_where(
      '07_config_data',
      'branches',
      'Chi nhanh nghi la test/demo',
      'review',
      '(name ilike ''%test%'' or name ilike ''%demo%'' or name ilike ''%old%'')',
      'Neu chi nhanh tung co don hang, nen an thay vi xoa.'
    );
  end if;

  -- 8) Du lieu trong bang legacy customers da co profile cung phone.
  if pg_temp.ghr_table_exists('customers')
    and pg_temp.ghr_table_exists('profiles')
    and pg_temp.ghr_column_exists('customers', 'phone')
    and pg_temp.ghr_column_exists('profiles', 'phone')
  then
    perform pg_temp.ghr_audit_where(
      '08_legacy_data',
      'customers',
      'Customer legacy da co profile cung phone',
      'review',
      'phone is not null and exists (select 1 from public.profiles p where p.phone = customers.phone)',
      'Co the la du lieu duplicate do chuyen tu customers sang profiles.'
    );
  end if;
end $$;

-- Tong quan tat ca bang, ke ca bang khong co van de.
select
  area,
  table_name,
  issue,
  severity,
  affected_rows,
  note
from pg_temp.ghr_trash_audit_results
order by area, table_name, issue;

-- Ket qua chinh: xem cac muc co nguy co / can xu ly.
-- Day la bang quan trong nhat.
select
  area,
  table_name,
  issue,
  severity,
  affected_rows,
  note,
  sample_rows
from pg_temp.ghr_trash_audit_results
where severity <> 'info'
   or affected_rows > 0
order by
  case severity
    when 'error' then 1
    when 'high' then 2
    when 'review' then 3
    when 'archive' then 4
    when 'skip' then 5
    else 6
  end,
  area,
  table_name,
  affected_rows desc;
